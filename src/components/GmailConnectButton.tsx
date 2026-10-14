"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/lib/google-login";

// Ein Klick: Google fragt nach Gmail-Lesezugriff, danach geht es zurück in die App
// und die PDFs werden automatisch geholt.
export function GmailConnectButton({
  label = "Gmail verbinden",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "link";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function connect() {
    setBusy(true);
    setError("");
    const { error } = await signInWithGoogle({ withGmail: true, next: "/" });
    if (error) {
      setBusy(false);
      setError(error.message);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        onClick={connect}
        disabled={busy}
        className={
          variant === "primary"
            ? "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60"
            : "text-sm text-accent hover:text-ink disabled:opacity-60"
        }
      >
        {busy ? "Weiter zu Google…" : label}
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </span>
  );
}
