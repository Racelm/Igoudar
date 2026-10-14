"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Saved = { title: string | null; ai_category: string | null; tags: string[]; summary: string | null };

// Ziel des Lesezeichen-Knopfs: speichert die übergebene Seite sofort.
function SaveInner() {
  const params = useSearchParams();
  const url = params.get("url") ?? "";
  const title = params.get("title") ?? "";
  const [state, setState] = useState<"saving" | "saved" | "duplicate" | "error">("saving");
  const [link, setLink] = useState<Saved | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [id, setId] = useState<string | null>(null);
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (!url) {
      setState("error");
      setError("Keine Webadresse übergeben.");
      return;
    }
    fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, title }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Speichern fehlgeschlagen");
        setLink(json.link);
        setId(json.link.id);
        setState(json.duplicate ? "duplicate" : "saved");
      })
      .catch((e: Error) => {
        setState("error");
        setError(e.message);
      });
  }, [url, title]);

  async function saveNote() {
    if (!id || !note.trim()) return;
    await fetch(`/api/links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    window.close();
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="oracle p-6">
        {state === "saving" && (
          <>
            <p className="font-display text-lg">Wird gespeichert…</p>
            <p className="mt-2 truncate text-sm text-muted">{title || url}</p>
            <p className="mt-4 text-sm text-muted">Igoudar liest die Seite und ordnet sie ein.</p>
          </>
        )}
        {(state === "saved" || state === "duplicate") && link && (
          <>
            <p className="text-sm text-good">{state === "saved" ? "Gespeichert" : "War schon gespeichert"}</p>
            <p className="mt-1 font-display text-lg leading-snug">{link.title}</p>
            {link.summary && <p className="mt-2 text-sm text-muted">{link.summary}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {link.ai_category && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-ink">{link.ai_category}</span>}
              {link.tags.map((t) => (
                <span key={t} className="rounded-full bg-glow-soft px-2 py-0.5 text-xs">#{t}</span>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Notiz hinzufügen (optional)"
              className="mt-4 w-full rounded-2xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-glow"
            />
            <div className="mt-3 flex gap-2">
              <button onClick={saveNote} disabled={!note.trim()} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-40">
                Notiz speichern
              </button>
              <button onClick={() => window.close()} className="rounded-full border border-line px-4 py-2 text-sm">
                Schließen
              </button>
            </div>
          </>
        )}
        {state === "error" && (
          <>
            <p className="font-display text-lg">Nicht gespeichert</p>
            <p className="mt-2 text-sm text-bad">{error}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function SavePage() {
  return (
    <Suspense>
      <SaveInner />
    </Suspense>
  );
}
