import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseQuery } from "@/lib/search-parse";
import { DOC_TYPE_LABEL, formatDate } from "@/lib/format";
import { Highlight } from "@/components/Highlight";

export const metadata = { title: "Suche" };

type Hit = {
  kind: "document" | "link" | "contract";
  id: string;
  title: string;
  subtitle: string | null;
  snippet: string | null;
  date: string | null;
  url: string;
  rank: number;
};

const KIND_LABEL: Record<Hit["kind"], string> = {
  document: "Dokumente",
  contract: "Verträge",
  link: "Gespeicherte Seiten",
};

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function describeRange(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (fy === ty && fm === tm) return `${MONTH_NAMES[fm - 1]} ${fy}`;
  if (fy === ty && fm === 1 && tm === 12) return String(fy);
  return `${formatDate(from)} – ${formatDate(to)}`;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const parsed = parseQuery(q);
  const supabase = await createClient();

  const hasFilter = parsed.kinds || parsed.docTypes || parsed.dateFrom;
  let hits: Hit[] = [];
  let failed = false;

  if (q.trim() && (parsed.text || hasFilter)) {
    const { data, error } = await supabase.rpc("search_all", {
      q: parsed.text,
      kinds: parsed.kinds,
      doc_types: parsed.docTypes,
      date_from: parsed.dateFrom,
      date_to: parsed.dateTo,
      lim: 50,
    });
    failed = !!error;
    hits = (data ?? []) as Hit[];
  }

  const chips: string[] = [];
  parsed.docTypes?.forEach((t) => chips.push(DOC_TYPE_LABEL[t]));
  if (!parsed.docTypes && parsed.kinds) parsed.kinds.forEach((k) => chips.push(KIND_LABEL[k]));
  if (parsed.dateFrom && parsed.dateTo) chips.push(describeRange(parsed.dateFrom, parsed.dateTo));

  const groups = (["document", "contract", "link"] as const)
    .map((k) => ({ kind: k, items: hits.filter((h) => h.kind === k) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium sm:text-3xl">Suche</h1>
        <p className="mt-1 text-muted">
          {q ? (
            <>
              {hits.length} Treffer für „{q}“
            </>
          ) : (
            "Gib oben einen Begriff ein."
          )}
        </p>
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Erkannt:</span>
            {chips.map((c) => (
              <span key={c} className="rounded-full bg-accent-soft px-3 py-0.5">{c}</span>
            ))}
            {parsed.text && <span className="text-muted">+ „{parsed.text}“</span>}
          </div>
        )}
      </div>

      {failed && <p className="text-bad">Die Suche ist fehlgeschlagen. Ist die Datenbank-Migration eingespielt?</p>}

      {q && !failed && hits.length === 0 && (
        <p className="rounded-3xl border border-line bg-surface px-4 py-6 text-muted">
          Nichts gefunden. Versuch einen kürzeren Begriff, z. B. nur den Anbieter.
        </p>
      )}

      {groups.map((g) => (
        <section key={g.kind}>
          <h2 className="mb-2 text-sm text-muted">
            {KIND_LABEL[g.kind]} · {g.items.length}
          </h2>
          <ul className="divide-y divide-line rounded-3xl border border-line bg-surface">
            {g.items.map((h) => {
              const external = h.kind === "link";
              const inner = (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-medium group-hover:text-accent">{h.title}</span>
                    {h.subtitle && <span className="text-sm text-muted">{h.subtitle}</span>}
                    <span className="ml-auto text-sm text-muted">{formatDate(h.date)}</span>
                  </div>
                  {h.snippet && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      <Highlight text={h.snippet} />
                    </p>
                  )}
                </>
              );
              return (
                <li key={`${h.kind}-${h.id}`}>
                  {external ? (
                    <a href={h.url} target="_blank" rel="noopener noreferrer" className="group block px-4 py-3 hover:bg-bg">
                      {inner}
                    </a>
                  ) : (
                    <Link href={h.url} className="group block px-4 py-3 hover:bg-bg">
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
