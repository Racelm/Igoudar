"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Result = { title: string; url: string; snippet: string; domain: string; savedId: string | null };
type Response = { provider?: string; answer?: string | null; results?: Result[]; error?: string };

function looksLikeUrl(s: string) {
  return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s.trim()) && !s.includes(" ");
}

export function WebSearchPanel({ initialQuery = "", enabled }: { initialQuery?: string; enabled: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [state, setState] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [data, setData] = useState<Response | null>(null);
  const [saving, setSaving] = useState<Record<string, "saving" | "saved" | string>>({});
  const [direct, setDirect] = useState<string | null>(null);
  const ran = useRef(false);

  const saveUrl = useCallback(
    async (url: string, title?: string) => {
      setSaving((s) => ({ ...s, [url]: "saving" }));
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; link?: { ai_category?: string }; duplicate?: boolean };
      if (!res.ok) {
        setSaving((s) => ({ ...s, [url]: json.error ?? "Fehler" }));
        return false;
      }
      setSaving((s) => ({ ...s, [url]: "saved" }));
      if (!json.duplicate && json.link?.ai_category) setDirect(`Gespeichert unter ${json.link.ai_category}`);
      else if (json.duplicate) setDirect("War schon gespeichert");
      router.refresh();
      return true;
    },
    [router],
  );

  const search = useCallback(
    async (term: string) => {
      const t = term.trim();
      if (!t) return;
      setDirect(null);
      if (looksLikeUrl(t)) {
        setState("idle");
        if (await saveUrl(t)) setQ("");
        return;
      }
      if (!enabled) {
        setState("error");
        setData({ error: "Websuche ist noch nicht eingerichtet (TAVILY_API_KEY oder OPENAI_API_KEY)." });
        return;
      }
      setState("searching");
      setData(null);
      const res = await fetch(`/api/web-search?q=${encodeURIComponent(t)}`);
      const json = (await res.json().catch(() => ({ error: "Keine Antwort" }))) as Response;
      setData(json);
      setState(res.ok ? "done" : "error");
    },
    [enabled, saveUrl],
  );

  useEffect(() => {
    if (initialQuery && !ran.current) {
      ran.current = true;
      void search(initialQuery);
    }
  }, [initialQuery, search]);

  return (
    <section className="oracle p-5 sm:p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Im Web suchen oder Webadresse einfügen"
          aria-label="Im Web suchen oder Webadresse einfügen"
          className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-3 text-base outline-none focus:border-glow"
        />
        <button
          disabled={state === "searching" || !q.trim()}
          className="rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-ink disabled:opacity-50"
        >
          {state === "searching" ? "Sucht…" : looksLikeUrl(q) ? "Speichern" : "Suchen"}
        </button>
      </form>

      {direct && <p className="mt-3 text-sm text-good">{direct}</p>}
      {Object.entries(saving).some(([, v]) => v !== "saving" && v !== "saved") && !data && (
        <p className="mt-3 text-sm text-bad">{Object.values(saving).find((v) => v !== "saving" && v !== "saved")}</p>
      )}
      {state === "error" && data?.error && <p className="mt-3 text-sm text-bad">{data.error}</p>}

      {state === "searching" && (
        <ul className="mt-5 space-y-3" aria-label="Lädt">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </ul>
      )}

      {state === "done" && data && (
        <div className="mt-5">
          {data.answer && <p className="mb-4 max-w-prose text-[15px] leading-relaxed text-ink/90">{data.answer}</p>}
          <ul className="divide-y divide-line">
            {(data.results ?? []).map((r) => {
              const s = r.savedId ? "saved" : saving[r.url];
              return (
                <li key={r.url} className="flex items-start gap-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://www.google.com/s2/favicons?domain=${r.domain}&sz=64`} alt="" className="mt-1 h-5 w-5 rounded" referrerPolicy="no-referrer" />
                  <div className="min-w-0 flex-1">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="line-clamp-1 font-medium hover:text-accent">
                      {r.title}
                    </a>
                    <p className="truncate text-xs text-muted">{r.domain}</p>
                    {r.snippet && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.snippet}</p>}
                    {s && s !== "saving" && s !== "saved" && <p className="mt-1 text-xs text-bad">{s}</p>}
                  </div>
                  <button
                    onClick={() => saveUrl(r.url, r.title)}
                    disabled={s === "saving" || s === "saved"}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${
                      s === "saved" ? "text-good" : "border border-glow text-ink hover:bg-glow-soft disabled:opacity-60"
                    }`}
                  >
                    {s === "saved" ? "Gespeichert" : s === "saving" ? "Speichert…" : "Speichern"}
                  </button>
                </li>
              );
            })}
          </ul>
          {data.results?.length === 0 && <p className="text-sm text-muted">Keine Ergebnisse. Versuch andere Begriffe.</p>}
          {data.provider && <p className="mt-3 text-xs text-muted">Websuche über {data.provider}</p>}
        </div>
      )}
    </section>
  );
}
