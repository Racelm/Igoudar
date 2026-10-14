"use client";

import { createClient } from "@/lib/supabase/client";

export const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";

// Anmelden mit Google – auf Wunsch gleich mit Lesezugriff auf Gmail.
// Dasselbe dient als "Gmail verbinden" für bereits angemeldete Nutzer.
export function signInWithGoogle({ withGmail = true, next = "/" }: { withGmail?: boolean; next?: string } = {}) {
  return createClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      ...(withGmail
        ? {
            scopes: GMAIL_READONLY,
            // Ohne diese beiden schickt Google keinen dauerhaften Zugang
            queryParams: { access_type: "offline", prompt: "consent" },
          }
        : {}),
    },
  });
}
