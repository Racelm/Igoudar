import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { features } from "@/lib/env";
import { storeGmailAccount } from "@/lib/gmail-store";

// Ziel nach Google-Login oder Klick auf den E-Mail-Link.
// Hat der Nutzer bei Google den Gmail-Zugriff erlaubt, wird das Postfach hier gleich verbunden.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) return NextResponse.redirect(`${origin}/login?error=auth`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) return NextResponse.redirect(`${origin}/login?error=auth`);

  const { provider_token: accessToken, provider_refresh_token: refreshToken, user } = data.session;
  if (accessToken && refreshToken && features().gmail) {
    try {
      const address = await storeGmailAccount(supabase, user.id, { accessToken, refreshToken });
      if (address) {
        const url = new URL(target, origin);
        url.searchParams.set("gmail", "connected");
        url.searchParams.set("address", address);
        return NextResponse.redirect(url);
      }
    } catch {
      // Anmeldung hat trotzdem geklappt; Gmail kann später verbunden werden
    }
  }

  return NextResponse.redirect(`${origin}${target}`);
}
