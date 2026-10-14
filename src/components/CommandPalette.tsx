"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Highlight } from "./Highlight";

type Hit = {
  kind: "document" | "link" | "contract";
  id: string;
  title: string;
  subtitle: string | null;
  snippet: string | null;
  url: string;
};

type Item =
  | { type: "hit"; hit: Hit }
  | { type: "action"; id: string; label: string; hint: string; run: () => void | Promise<void> };

export const PALETTE_EVENT = "igoudar:palette";

export function openPalette(q = "") {
  window.dispatchEvent(new CustomEvent(PALETTE_EVENT, { detail: { q } }));
}

function looksLikeUrl(s: string) {
  return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s.trim()) && !s.includes(" ");
}

const KIND_ICON: Record<Hit["kind"], string> = {
  document: "M7 3h7l5 5v13H7zM14 3v5h5",
  link: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1",
  contract: "M6 3h9l4 4v14H6zM9 12h7M9 16h5",
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setBusy(null);
  }, []);

  // Öffnen: ⌘K / Strg+K, "/" oder Ereignis aus der App
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if ((e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ q?: string }>).detail;
      setQ(detail?.q ?? "");
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 10);
  }, [open]);

  // Live-Suche mit kurzer Verzögerung
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const json = (await res.json()) as { hits?: Hit[] };
        setHits(json.hits ?? []);
        setActive(0);
      } catch {
        // abgebrochen
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const go = useCallback(
    (path: string) => {
      close();
      router.push(path);
    },
    [close, router],
  );

  const items: Item[] = useMemo(() => {
    const term = q.trim();
    const out: Item[] = hits.map((hit) => ({ type: "hit", hit }));
    if (term && looksLikeUrl(term)) {
      out.unshift({
        type: "action",
        id: "save-url",
        label: `Seite speichern: ${term}`,
        hint: "Igoudar liest die Seite und ordnet sie ein",
        run: async () => {
          setBusy("save-url");
          const res = await fetch("/api/links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: term }),
          });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            setBusy(null);
            alert(json.error ?? "Speichern fehlgeschlagen");
            return;
          }
          go("/links?saved=1");
          router.refresh();
        },
      });
    }
    if (term) {
      out.push({
        type: "action",
        id: "web",
        label: `Im Web suchen: „${term}“`,
        hint: "Ergebnisse direkt speichern",
        run: () => go(`/links?web=${encodeURIComponent(term)}`),
      });
      out.push({
        type: "action",
        id: "all",
        label: "Alle Treffer anzeigen",
        hint: "Dokumente, Verträge und Seiten",
        run: () => go(`/search?q=${encodeURIComponent(term)}`),
      });
    } else {
      out.push(
        { type: "action", id: "upload", label: "PDF hochladen", hint: "Dokumente", run: () => go("/documents") },
        { type: "action", id: "links", label: "Meine Links", hint: "Gespeicherte Seiten", run: () => go("/links") },
        { type: "action", id: "gmail", label: "Gmail verbinden oder abrufen", hint: "Einstellungen", run: () => go("/settings") },
      );
    }
    return out;
  }, [hits, q, go, router]);

  const runItem = useCallback(
    (item: Item) => {
      if (item.type === "action") return void item.run();
      const { hit } = item;
      if (hit.kind === "link") {
        fetch(`/api/links/${hit.id}/open`, { method: "POST", keepalive: true }).catch(() => undefined);
        window.open(hit.url, "_blank", "noopener,noreferrer");
        close();
      } else {
        go(hit.url);
      }
    },
    [close, go],
  );

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#070921]/70 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Igoudar durchsuchen"
        className="oracle w-full max-w-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4">
          <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-accent ${loading ? "spin-slow" : ""}`} aria-hidden>
            <path d="M12 2 L22 12 L12 22 L2 12 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && items[active]) {
                e.preventDefault();
                runItem(items[active]);
              }
            }}
            placeholder="Suchen, Webadresse einfügen oder im Web suchen"
            aria-label="Suchbegriff"
            className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted"
          />
          <kbd className="rounded-md border border-line px-1.5 py-0.5 text-xs text-muted">Esc</kbd>
        </div>

        <ul ref={list} className="max-h-[55vh] overflow-y-auto border-t border-line p-2" role="listbox">
          {items.map((item, i) => {
            const selected = i === active;
            const base = `flex w-full cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 text-left ${selected ? "bg-glow-soft" : ""}`;
            if (item.type === "hit") {
              const h = item.hit;
              return (
                <li key={`${h.kind}-${h.id}`} data-index={i} role="option" aria-selected={selected}>
                  <button className={base} onMouseEnter={() => setActive(i)} onClick={() => runItem(item)}>
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-glow" aria-hidden>
                      <path d={KIND_ICON[h.kind]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{h.title}</span>
                      {h.subtitle && <span className="block truncate text-sm text-muted">{h.subtitle}</span>}
                      {h.snippet && (
                        <span className="mt-0.5 line-clamp-1 block text-sm text-muted">
                          <Highlight text={h.snippet} />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            }
            return (
              <li key={item.id} data-index={i} role="option" aria-selected={selected}>
                <button className={base} onMouseEnter={() => setActive(i)} onClick={() => runItem(item)} disabled={busy === item.id}>
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden>
                    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{busy === item.id ? "Wird gespeichert…" : item.label}</span>
                    <span className="block truncate text-sm text-muted">{item.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {q.trim() && !loading && hits.length === 0 && (
            <li className="px-3 pb-1 pt-2 text-sm text-muted">In deinem Igoudar nichts gefunden – vielleicht im Web?</li>
          )}
        </ul>
      </div>
    </div>
  );
}
