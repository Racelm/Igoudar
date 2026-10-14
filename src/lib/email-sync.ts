import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "./crypto";
import { GmailAuthError, GmailClient, header, parseFrom, pdfParts, refreshAccessToken } from "./gmail";
import { shouldImport, type CaptureRule } from "./rules";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_MESSAGES_PER_RUN = 20;

export type EmailAccount = {
  id: string;
  address: string;
  provider: string;
  status: string;
  last_synced_at: string | null;
};

export type SyncResult = {
  accountId: string;
  address: string;
  scanned: number;
  imported: number;
  remaining: boolean;
  error?: string;
};

// Gültigen Access-Token holen, bei Bedarf mit dem Refresh-Token erneuern.
export async function accessTokenFor(supabase: SupabaseClient, accountId: string) {
  const { data: secret } = await supabase
    .from("email_account_secrets")
    .select("access_token_enc, refresh_token_enc, token_expires_at")
    .eq("email_account_id", accountId)
    .maybeSingle();
  if (!secret?.refresh_token_enc) throw new GmailAuthError("Kein Zugriff gespeichert – Postfach neu verbinden");

  const valid = secret.token_expires_at && Date.parse(secret.token_expires_at) > Date.now() + 60_000;
  if (valid && secret.access_token_enc) return decrypt(secret.access_token_enc);

  const fresh = await refreshAccessToken(decrypt(secret.refresh_token_enc));
  await supabase
    .from("email_account_secrets")
    .update({
      access_token_enc: encrypt(fresh.access_token),
      token_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("email_account_id", accountId);
  return fresh.access_token;
}

function backfillDays() {
  const n = Number(process.env.GMAIL_BACKFILL_DAYS ?? 365);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3650) : 365;
}

// Liest neue Mails mit PDF-Anhang und legt die PDFs als Dokumente (Status "pending") ab.
// Arbeitet in Portionen: remaining = true heißt "nochmal aufrufen".
export async function syncAccount(
  supabase: SupabaseClient,
  userId: string,
  account: EmailAccount,
  deadline: number,
): Promise<SyncResult> {
  const result: SyncResult = { accountId: account.id, address: account.address, scanned: 0, imported: 0, remaining: false };
  const startedAt = new Date().toISOString();

  try {
    const gmail = new GmailClient(await accessTokenFor(supabase, account.id));

    const since = account.last_synced_at
      ? `after:${Math.floor(Date.parse(account.last_synced_at) / 1000) - 2 * 86400}`
      : `newer_than:${backfillDays()}d`;
    const ids = await gmail.listMessageIds(`has:attachment filename:pdf ${since}`);

    // Schon gesehene Mails überspringen
    const seen = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase
        .from("emails")
        .select("provider_message_id")
        .eq("email_account_id", account.id)
        .in("provider_message_id", ids.slice(i, i + 200));
      for (const r of data ?? []) seen.add(r.provider_message_id);
    }
    const todo = ids.filter((id) => !seen.has(id));

    const { data: rules } = await supabase
      .from("capture_rules")
      .select("sender_pattern, subject_pattern, action, is_active, email_account_id")
      .or(`email_account_id.is.null,email_account_id.eq.${account.id}`);

    let processed = 0;
    for (const id of todo) {
      if (processed >= MAX_MESSAGES_PER_RUN || Date.now() > deadline) break;
      processed++;
      result.scanned++;

      const msg = await gmail.getMessage(id);
      const fromRaw = header(msg.payload, "From");
      const from = parseFrom(fromRaw);
      const subject = header(msg.payload, "Subject").slice(0, 500);
      const receivedAt = new Date(Number(msg.internalDate ?? Date.now())).toISOString();
      const parts = pdfParts(msg.payload);
      const wanted = parts.length > 0 && shouldImport((rules ?? []) as CaptureRule[], fromRaw, subject);

      const { data: emailRow, error: emailError } = await supabase
        .from("emails")
        .insert({
          email_account_id: account.id,
          provider_message_id: id,
          from_address: from.address,
          from_name: from.name,
          subject,
          received_at: receivedAt,
          has_pdf: parts.length > 0,
          classification: wanted ? null : "other",
          processed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (emailError || !emailRow) continue; // z. B. parallel schon importiert
      if (!wanted) continue;

      for (const part of parts.slice(0, 10)) {
        if ((part.body?.size ?? 0) > MAX_PDF_BYTES) continue;
        const bytes = part.body?.data
          ? Buffer.from(part.body.data, "base64url")
          : await gmail.getAttachment(id, part.body!.attachmentId!);
        if (bytes.length < 5 || bytes.subarray(0, 5).toString("latin1") !== "%PDF-") continue;

        const sha256 = createHash("sha256").update(bytes).digest("hex");
        const { data: dup } = await supabase.from("documents").select("id").eq("sha256", sha256).maybeSingle();
        if (dup) continue;

        const path = `${userId}/${randomUUID()}.pdf`;
        const { error: upError } = await supabase.storage
          .from("documents")
          .upload(path, bytes, { contentType: "application/pdf", upsert: false });
        if (upError) throw new Error(`Speichern fehlgeschlagen: ${upError.message}`);

        const filename = (part.filename || "anhang.pdf").slice(0, 255);
        const { error: docError } = await supabase.from("documents").insert({
          email_id: emailRow.id,
          source: "email",
          storage_path: path,
          filename,
          file_size: bytes.length,
          sha256,
          email_subject: subject || null,
          // Bis die KI fertig ist: Absender als vorläufiger Anbieter
          vendor: from.name,
          document_date: receivedAt.slice(0, 10),
          status: "pending",
        });
        if (docError) {
          await supabase.storage.from("documents").remove([path]);
          continue;
        }
        result.imported++;
      }
    }

    result.remaining = todo.length > processed;
    await supabase
      .from("email_accounts")
      .update({
        status: "active",
        last_error: null,
        ...(result.remaining ? {} : { last_synced_at: startedAt }),
      })
      .eq("id", account.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    result.error = message;
    await supabase
      .from("email_accounts")
      .update({ last_error: message, ...(e instanceof GmailAuthError ? { status: "reauth_required" } : {}) })
      .eq("id", account.id);
  }

  return result;
}
