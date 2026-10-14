"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Doc = {
  id: string;
  doc_type: string | null;
  vendor: string | null;
  document_date: string | null;
  amount_cents: number | null;
  currency: string | null;
  contract_number: string | null;
  notice_period: string | null;
  summary: string | null;
  user_edited: boolean;
  ai_confidence: number | null;
};

const TYPES = [
  ["invoice", "Rechnung"],
  ["order_confirmation", "Auftragsbestätigung"],
  ["delivery_note", "Lieferschein"],
  ["contract", "Vertrag"],
  ["other", "Sonstiges"],
] as const;

export function DocumentForm({ doc, fileUrl }: { doc: Doc; fileUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "save" | "ai" | "delete">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy("save");
    setMsg(null);
    const body = Object.fromEntries(form.entries());
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    setMsg(res.ok ? { ok: true, text: "Gespeichert" } : { ok: false, text: json.error ?? "Fehler" });
    if (res.ok) router.refresh();
  }

  async function reanalyze() {
    if (doc.user_edited && !confirm("Deine Korrekturen werden durch die KI-Werte ersetzt. Fortfahren?")) return;
    setBusy("ai");
    setMsg(null);
    const res = await fetch(`/api/documents/${doc.id}/reanalyze`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    setMsg(res.ok ? { ok: true, text: "Neu analysiert" } : { ok: false, text: json.error ?? "Fehler" });
    router.refresh();
  }

  async function remove() {
    if (!confirm("Dokument und PDF endgültig löschen?")) return;
    setBusy("delete");
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/documents");
      router.refresh();
    } else {
      setBusy("");
      setMsg({ ok: false, text: "Löschen fehlgeschlagen" });
    }
  }

  const field = "w-full rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-accent";
  const amount = doc.amount_cents !== null ? (doc.amount_cents / 100).toFixed(2).replace(".", ",") : "";

  return (
    <form onSubmit={save} className="h-fit space-y-4 rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-medium">Erkannte Angaben</h2>
        <span className="text-xs text-muted">
          {doc.user_edited
            ? "von dir korrigiert"
            : doc.ai_confidence !== null
              ? `KI, ${Math.round(doc.ai_confidence * 100)} % sicher`
              : ""}
        </span>
      </div>

      <label className="block text-sm">
        <span className="text-muted">Typ</span>
        <select name="doc_type" defaultValue={doc.doc_type ?? "other"} className={field}>
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-muted">Anbieter</span>
        <input name="vendor" defaultValue={doc.vendor ?? ""} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-muted">Datum</span>
          <input type="date" name="document_date" defaultValue={doc.document_date ?? ""} className={field} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Betrag</span>
          <div className="flex gap-2">
            <input name="amount" inputMode="decimal" defaultValue={amount} className={field} />
            <input name="currency" defaultValue={doc.currency ?? "EUR"} maxLength={3} className={`${field} w-16 uppercase`} />
          </div>
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-muted">Vertrags- / Kundennummer</span>
        <input name="contract_number" defaultValue={doc.contract_number ?? ""} className={field} />
      </label>
      <label className="block text-sm">
        <span className="text-muted">Kündigungsfrist</span>
        <input name="notice_period" defaultValue={doc.notice_period ?? ""} placeholder="z. B. 3 Monate zum Laufzeitende" className={field} />
      </label>
      <label className="block text-sm">
        <span className="text-muted">Kurzbeschreibung</span>
        <textarea name="summary" defaultValue={doc.summary ?? ""} rows={2} className={field} />
      </label>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button disabled={!!busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-60">
          {busy === "save" ? "Speichert…" : "Speichern"}
        </button>
        <button type="button" onClick={reanalyze} disabled={!!busy} className="rounded-lg border border-line px-4 py-2 text-sm disabled:opacity-60">
          {busy === "ai" ? "Analysiert…" : "Neu analysieren"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</span>}
      </div>

      <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
        {fileUrl ? (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent">
            PDF öffnen
          </a>
        ) : (
          <span />
        )}
        <button type="button" onClick={remove} disabled={!!busy} className="text-bad">
          {busy === "delete" ? "Löscht…" : "Löschen"}
        </button>
      </div>
    </form>
  );
}
