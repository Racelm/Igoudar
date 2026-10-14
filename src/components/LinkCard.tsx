"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type LinkRow = {
  id: string;
  url: string;
  title: string | null;
  domain: string;
  ai_category: string | null;
  category_confirmed: boolean;
  tags: string[];
  summary: string | null;
  note: string | null;
  image_url: string | null;
  favicon_url: string | null;
  created_at: string;
};

export function LinkCard({ link, categories }: { link: LinkRow; categories: readonly string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [imgOk, setImgOk] = useState(Boolean(link.image_url));
  const [saving, setSaving] = useState(false);

  function open() {
    fetch(`/api/links/${link.id}/open`, { method: "POST", keepalive: true }).catch(() => undefined);
  }

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/links/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Diesen Link löschen?")) return;
    await fetch(`/api/links/${link.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition-colors hover:border-glow">
      <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={open} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
          {imgOk && link.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={link.image_url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgOk(false)}
              className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-2xl text-muted">{link.domain}</div>
          )}
          {link.ai_category && (
            <span
              className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs backdrop-blur ${
                link.category_confirmed ? "bg-bg/80 text-ink" : "border border-dashed border-accent bg-bg/70 text-accent"
              }`}
              title={link.category_confirmed ? "Kategorie" : "Von der KI vorgeschlagen"}
            >
              {link.ai_category}
            </span>
          )}
        </div>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            {link.favicon_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={link.favicon_url} alt="" className="h-4 w-4 rounded-sm" referrerPolicy="no-referrer" />
            )}
            <span className="truncate">{link.domain}</span>
          </div>
          <h3 className="mt-1 line-clamp-2 font-medium leading-snug">{link.title ?? link.url}</h3>
          {(link.note || link.summary) && <p className="mt-1 line-clamp-2 text-sm text-muted">{link.note || link.summary}</p>}
        </div>
      </a>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 px-4 pb-4 pt-3">
        {link.tags.map((t) => (
          <a key={t} href={`/links?tag=${encodeURIComponent(t)}`} className="rounded-full bg-glow-soft px-2 py-0.5 text-xs text-ink hover:bg-glow/30">
            #{t}
          </a>
        ))}
        <button onClick={() => setEditing((v) => !v)} className="ml-auto rounded-full px-2 py-0.5 text-xs text-muted hover:text-ink" aria-expanded={editing}>
          {editing ? "Fertig" : "Bearbeiten"}
        </button>
      </div>

      {editing && (
        <div className="space-y-2 border-t border-line px-4 py-3 text-sm">
          <label className="block">
            <span className="text-muted">Kategorie</span>
            <select
              defaultValue={link.ai_category ?? "Sonstiges"}
              onChange={(e) => patch({ ai_category: e.target.value })}
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-1.5"
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-muted">Schlagwörter, mit Komma getrennt</span>
            <input
              defaultValue={link.tags.join(", ")}
              onBlur={(e) => e.target.value !== link.tags.join(", ") && patch({ tags: e.target.value })}
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-1.5"
            />
          </label>
          <label className="block">
            <span className="text-muted">Notiz</span>
            <textarea
              defaultValue={link.note ?? ""}
              rows={2}
              onBlur={(e) => e.target.value !== (link.note ?? "") && patch({ note: e.target.value })}
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-1.5"
            />
          </label>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted">{saving ? "Speichert…" : "Änderungen werden automatisch gespeichert"}</span>
            <button onClick={remove} className="text-xs text-bad">Löschen</button>
          </div>
        </div>
      )}
    </article>
  );
}
