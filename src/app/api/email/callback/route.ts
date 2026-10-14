import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/gmail";
import { storeGmailAccount } from "@/lib/gmail-store";

// Nur für zusätzliche Gmail-Adressen. Das erste Postfach wird direkt beim Google-Login verbunden.
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
    const address = await storeGmailAccount(supabase, user.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });
    if (!address) return fail("Bitte beim Verbinden den Zugriff auf Gmail erlauben (Häkchen setzen)");

    const res = NextResponse.redirect(`${origin}/?gmail=connected&address=${encodeURIComponent(address)}`);
    res.cookies.delete({ name: "igoudar_gmail_state", path: "/api/email" });
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unbekannter Fehler");
  }
}
