import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { features } from "@/lib/env";
import { gmailAuthUrl } from "@/lib/gmail";

// Startet die Verbindung mit einem Gmail-Postfach.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (!features().gmail) {
    return NextResponse.redirect(`${origin}/settings?gmail=not_configured`);
  }

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(gmailAuthUrl(`${origin}/api/email/callback`, state));
  response.cookies.set("igoudar_gmail_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/email",
    maxAge: 600,
  });
  return response;
}
