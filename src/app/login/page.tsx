"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const redirectTo = () => `${window.location.origin}/auth/callback`;

  async function withGoogle() {
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    }
  }

  async function withEmail(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" />
        <h1 className="font-display text-3xl font-medium leading-tight">Deine Papiere. Ein sicherer Ort.</h1>
        <p className="mt-2 text-muted">
          Rechnungen, Verträge und gespeicherte Seiten – auf jedem Gerät da.
        </p>

        <div className="oracle oracle-pulse mt-8 p-6">
          <button
            onClick={withGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-bg px-4 py-3 font-medium hover:border-glow"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.3v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.1z" />
              <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.1H2a11 11 0 0 0 0 9.8L5.7 14z" />
              <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7.1L5.7 10c.9-2.7 3.4-4.6 6.3-4.6z" />
            </svg>
            Mit Google anmelden
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> oder per E-Mail-Link <span className="h-px flex-1 bg-line" />
          </div>

          {state === "sent" ? (
            <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm">
              Link verschickt an <strong>{email}</strong>. Öffne die Mail auf diesem Gerät.
            </p>
          ) : (
            <form onSubmit={withEmail} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@beispiel.de"
                className="w-full rounded-2xl border border-line bg-bg px-4 py-3 outline-none focus:border-glow"
              />
              <button
                disabled={state === "sending"}
                className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-accent-ink disabled:opacity-60"
              >
                {state === "sending" ? "Wird gesendet…" : "Anmeldelink senden"}
              </button>
            </form>
          )}
          {state === "error" && <p className="mt-3 text-sm text-bad">{message}</p>}
        </div>
      </div>
    </main>
  );
}
