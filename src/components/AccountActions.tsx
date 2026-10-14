"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DisconnectButton({ id, address }: { id: string; address: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm(`${address} trennen? Bereits importierte Dokumente bleiben erhalten.`)) return;
        setBusy(true);
        await fetch(`/api/email/accounts/${id}`, { method: "DELETE" });
        router.refresh();
      }}
      className="text-sm text-bad disabled:opacity-50"
    >
      {busy ? "Trennt…" : "Trennen"}
    </button>
  );
}

type Rule = { id: string; sender_pattern: string | null; subject_pattern: string | null; action: string };

export function RulesEditor({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const [sender, setSender] = useState("");
  const [action, setAction] = useState<"save" | "ignore">("ignore");
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_pattern: sender, action }),
    });
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Fehler");
      return;
    }
    setSender("");
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const saves = rules.filter((r) => r.action === "save");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {saves.length > 0
          ? "Es werden nur PDFs von den Absendern unter „Immer übernehmen“ geholt."
          : "Ohne Regeln holt Igoudar jedes PDF aus deinem Postfach. Mit „Immer übernehmen“ legst du fest, dass nur diese Absender zählen."}
      </p>

      {rules.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs ${r.action === "save" ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"}`}>
                {r.action === "save" ? "Immer übernehmen" : "Ignorieren"}
              </span>
              <span className="min-w-0 flex-1 truncate">{r.sender_pattern ?? `Betreff: ${r.subject_pattern}`}</span>
              <button onClick={() => remove(r.id)} className="text-muted hover:text-bad" aria-label="Regel löschen">
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as "save" | "ignore")}
          className="rounded-xl border border-line bg-bg px-3 py-2 text-sm"
          aria-label="Aktion"
        >
          <option value="ignore">Ignorieren</option>
          <option value="save">Immer übernehmen</option>
        </select>
        <input
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          placeholder="Absender enthält, z. B. amazon.de oder newsletter"
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-glow"
        />
        <button disabled={!sender.trim()} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-40">
          Regel hinzufügen
        </button>
      </form>
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
