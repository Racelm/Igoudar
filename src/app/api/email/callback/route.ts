import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, GmailClient } from "@/lib/gmail";

// Google leitet nach der Freigabe hierher zurück.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${origin}/settings?gmail=error&reason=${encodeURIComponent(reason)}`);
    res.cookies.delete({ name: "igoudar_gmail_state", path: "/api/email" });
    return res;
  };

  if (url.searchParams.get("error")) return fail("Freigabe bei Google abgebrochen");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = request.cookies.get("igoudar_gmail_state")?.value;
  if (!code || !state || !expected || state !== expected) return fail("Sicherheitsprüfung fehlgeschlagen, bitte erneut verbinden");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const tokens = await exchangeCode(code, `${origin}/api/email/callback`);
    if (!tokens.refresh_token) return fail("Google hat keinen dauerhaften Zugriff erteilt");
    if (!tokens.scope?.includes("gmail.readonly")) return fail("Bitte beim Verbinden den Zugriff auf Gmail erlauben (Häkchen setzen)");

    const profile = await new GmailClient(tokens.access_token).profile();
    const address = profile.emailAddress.toLowerCase();

    const { data: account, error } = await supabase
      .from("email_accounts")
      .upsert(
        { user_id: user.id, provider: "gmail", address, status: "active", last_error: null },
        { onConflict: "user_id,provider,address" },
      )
      .select("id")
      .single();
    if (error || !account) return fail(error?.message ?? "Postfach konnte nicht gespeichert werden");

    const { error: secretError } = await supabase.from("email_account_secrets").upsert({
      email_account_id: account.id,
      access_token_enc: encrypt(tokens.access_token),
      refresh_token_enc: encrypt(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (secretError) return fail(secretError.message);

    const res = NextResponse.redirect(`${origin}/?gmail=connected&address=${encodeURIComponent(address)}`);
    res.cookies.delete({ name: "igoudar_gmail_state", path: "/api/email" });
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unbekannter Fehler");
  }
}
