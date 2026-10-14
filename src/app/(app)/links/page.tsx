import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { features } from "@/lib/env";
import { CATEGORIES } from "@/lib/categorize";
import { LinkCard, type LinkRow } from "@/components/LinkCard";
import { WebSearchPanel } from "@/components/WebSearchPanel";

export const metadata = { title: "Links" };

type Search = { web?: string; category?: string; tag?: string; sort?: string };

export default async function LinksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { web = "", category = "", tag = "", sort = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("links")
    .select("id, url, title, domain, ai_category, category_confirmed, tags, summary, note, image_url, favicon_url, created_at")
    .limit(120);
  if (category) query = query.eq("ai_category", category);
  if (tag) query = query.contains("tags", [tag]);
  query =
    sort === "used"
      ? query.order("last_opened_at", { ascending: false, nullsFirst: false })
      : query.order("created_at", { ascending: false });

  const [{ data: links }, { data: all }] = await Promise.all([
    query,
    supabase.from("links").select("ai_category, tags").limit(2000),
  ]);

  // Kategorien mit Anzahl – die KI legt sie an, der Nutzer muss nichts sortieren
  const counts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  for (const r of all ?? []) {
    const c = (r.ai_category as string) ?? "Sonstiges";
    counts.set(c, (counts.get(c) ?? 0) + 1);
    for (const t of (r.tags as string[]) ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const cats = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  const total = all?.length ?? 0;

  const href = (p: Partial<Search>) => {
    const s = new URLSearchParams();
    const merged = { category, tag, sort, ...p };
    for (const [k, v] of Object.entries(merged)) if (v) s.set(k, v);
    const qs = s.toString();
    return qs ? `/links?${qs}` : "/links";
  };

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
      active ? "bg-glow-soft text-ink shadow-[inset_0_0_0_1px_var(--glow)]" : "text-muted hover:text-ink"
    }`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium sm:text-3xl">Links</h1>
        <p className="mt-2 max-w-xl text-muted">
          Suche im Web und speichere mit einem Klick. Igoudar liest jede Seite und ordnet sie selbst ein.
        </p>
      </div>

      <WebSearchPanel initialQuery={web} enabled={features().webSearch} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-1">
          <Link href={href({ category: "", tag: "" })} className={chip(!category && !tag)}>
            Alle <span className="text-muted">{total}</span>
          </Link>
          {cats.map(([c, n]) => (
            <Link key={c} href={href({ category: c, tag: "" })} className={chip(category === c)}>
              {c} <span className="text-muted">{n}</span>
            </Link>
          ))}
          <span className="ml-auto flex gap-1">
            <Link href={href({ sort: "" })} className={chip(sort !== "used")}>Neueste</Link>
            <Link href={href({ sort: "used" })} className={chip(sort === "used")}>Zuletzt geöffnet</Link>
          </span>
        </div>

        {topTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {topTags.map(([t, n]) => (
              <Link
                key={t}
                href={href({ tag: tag === t ? "" : t, category: "" })}
                className={`rounded-full px-2.5 py-0.5 text-xs ${tag === t ? "bg-accent text-accent-ink" : "bg-surface text-muted hover:text-ink"}`}
              >
                #{t} {n > 1 && <span className="opacity-60">{n}</span>}
              </Link>
            ))}
          </div>
        )}

        {(links?.length ?? 0) === 0 ? (
          <p className="rounded-3xl border border-dashed border-line px-6 py-10 text-center text-muted">
            {total === 0
              ? "Noch keine Seiten gespeichert. Such oben nach etwas oder füg eine Webadresse ein."
              : "In dieser Auswahl liegt nichts."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(links as LinkRow[]).map((l) => (
              <LinkCard key={l.id} link={l} categories={CATEGORIES} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
