import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncAccount, type EmailAccount, type SyncResult } from "@/lib/email-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

// Ruft neue PDFs aus allen (oder einem) verbundenen Postfach ab.
// Antwort "remaining: true" → der Browser ruft gleich nochmal auf.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { accountId?: string };
  let query = supabase
    .from("email_accounts")
    .select("id, address, provider, status, last_synced_at")
    .eq("provider", "gmail")
    .eq("status", "active"); // abgelaufene Zugänge erst nach "Neu verbinden"
  if (body.accountId) query = query.eq("id", body.accountId);
  const { data: accounts } = await query;

  const deadline = Date.now() + 40_000;
  const results: SyncResult[] = [];
  for (const account of (accounts ?? []) as EmailAccount[]) {
    if (Date.now() > deadline) {
      results.push({ accountId: account.id, address: account.address, scanned: 0, imported: 0, remaining: true });
      continue;
    }
    results.push(await syncAccount(supabase, user.id, account, deadline));
  }

  const { count: pending } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return NextResponse.json({
    results,
    imported: results.reduce((n, r) => n + r.imported, 0),
    remaining: results.some((r) => r.remaining && !r.error),
    pending: pending ?? 0,
  });
}
