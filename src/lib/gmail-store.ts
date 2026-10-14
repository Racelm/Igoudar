import type { SupabaseClient } from "@supabase/supabase-js";
import { encrypt } from "./crypto";
import { GmailClient } from "./gmail";

// Speichert ein Gmail-Postfach samt verschlüsseltem Zugang.
// Gibt die Adresse zurück oder null, wenn Google keinen Gmail-Zugriff erteilt hat.
export async function storeGmailAccount(
  supabase: SupabaseClient,
  userId: string,
  tokens: { accessToken: string; refreshToken: string; expiresIn?: number },
): Promise<string | null> {
  let address: string;
  try {
    address = (await new GmailClient(tokens.accessToken).profile()).emailAddress.toLowerCase();
  } catch {
    return null; // Häkchen für Gmail nicht gesetzt
  }

  const { data: account, error } = await supabase
    .from("email_accounts")
    .upsert(
      { user_id: userId, provider: "gmail", address, status: "active", last_error: null },
      { onConflict: "user_id,provider,address" },
    )
    .select("id")
    .single();
  if (error || !account) throw new Error(error?.message ?? "Postfach konnte nicht gespeichert werden");

  const { error: secretError } = await supabase.from("email_account_secrets").upsert({
    email_account_id: account.id,
    access_token_enc: encrypt(tokens.accessToken),
    refresh_token_enc: encrypt(tokens.refreshToken),
    token_expires_at: new Date(Date.now() + (tokens.expiresIn ?? 3000) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (secretError) throw new Error(secretError.message);
  return address;
}
