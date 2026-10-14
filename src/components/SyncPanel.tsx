"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type AccountInfo = {
  id: string;
  address: string;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
};

type Phase = "idle" | "mail" | "analyze" | "done" | "error";

function ago(iso: string | null) {
  if (!iso) return "noch nie";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tagen`;
}

export function SyncPanel({
  accounts,
  pending,
  gmailReady,
  auto = false,
}: {
  accounts: AccountInfo[];
  pending: number;
  gmailReady: boolean;
  auto?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [found, setFound] = useState(0);
  const [left, setLeft] = useState(pending);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    setFound(0);
    let total = 0;
    try {
      if (accounts.length > 0) {
        setPhase("mail");
        for (let i = 0; i < 30; i++) {
          const res = await fetch("/api/email/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          const json = (await res.json()) as { imported?: number; remaining?: boolean; pending?: number; results?: { error?: string }[] };
          if (!res.ok) throw new Error("Abruf fehlgeschlagen");
          total += json.imported ?? 0;
          setFound(total);
          setLeft(json.pending ?? 0);
          const firstError = json.results?.find((r) => r.error)?.error;
          if (firstError) setError(firstError);
          if (!json.remaining) break;
        }
      }
      setPhase("analyze");
      for (let i = 0; i < 60; i++) {
        const res = await fetch("/api/documents/process-pending", { method: "POST" });
        const json = (await res.json()) as { processed?: number; remaining?: number };
        if (!res.ok) throw new Error("Analyse fehlgeschlagen");
        setLeft(json.remaining ?? 0);
        if (!json.remaining || !json.processed) break;
      }
      setPhase("done");
      router.refresh();
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }, [accounts.length, router]);

  // Automatisch abrufen, wenn der letzte Abruf über eine Stunde her ist oder PDFs warten
  useEffect(() => {
    if (!auto || started.current) return;
    const stale = accounts.some(
      (a) => a.status === "active" && (!a.last_synced_at || Date.now() - Date.parse(a.last_synced_at) > 60 * 60 * 1000),
    );
    if (stale || pending > 0) {
      started.current = true;
      void run();
    }
  }, [auto, accounts, pending, run]);

  const busy = phase === "mail" || phase === "analyze";

  if (accounts.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-dashed border-line bg-surface/60 px-5 py-4">
        <MailIcon />
        <div className="min-w-0 flex-1">
          <p className="font-medium">PDFs direkt aus Gmail holen</p>
          <p className="text-sm text-muted">Rechnungen und Bestätigungen landen automatisch hier – nur Lesezugriff.</p>
        </div>
        {gmailReady ? (
          <a href="/api/email/connect" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            Gmail verbinden
          </a>
        ) : (
          <Link href="/settings" className="rounded-full border border-line px-4 py-2 text-sm">
            Einrichten
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-surface/60 px-5 py-4">
      <MailIcon active={busy} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {phase === "mail" && `Postfach wird gelesen… ${found} neue PDFs`}
          {phase === "analyze" && `KI liest die PDFs… noch ${left}`}
          {phase === "done" && (found > 0 ? `${found} neue Dokumente aus Gmail` : "Alles auf dem neuesten Stand")}
          {(phase === "idle" || phase === "error") && accounts.map((a) => a.address).join(", ")}
        </p>
        <p className={`truncate text-sm ${error ? "text-bad" : "text-muted"}`}>
          {error ??
            (accounts.some((a) => a.status === "reauth_required")
              ? "Zugriff abgelaufen – in den Einstellungen neu verbinden"
              : `Zuletzt abgerufen ${ago(accounts[0].last_synced_at)}${left > 0 && phase === "idle" ? ` · ${left} PDFs warten auf Analyse` : ""}`)}
        </p>
      </div>
      <button
        onClick={run}
        disabled={busy}
        className="rounded-full border border-glow px-4 py-2 text-sm text-ink hover:bg-glow-soft disabled:opacity-50"
      >
        {busy ? "Läuft…" : "Jetzt abrufen"}
      </button>
    </div>
  );
}

function MailIcon({ active = false }: { active?: boolean }) {
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-glow-soft text-glow ${active ? "animate-pulse" : ""}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path d="M3 6h18v12H3zM3 7l9 6 9-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
