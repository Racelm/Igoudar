import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DocumentTable, type DocRow } from "@/components/DocumentTable";
import { formatDate } from "@/lib/format";

export default async function Overview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [docs, invoices, contracts, links, recent, review] = await Promise.all([
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("doc_type", "invoice"),
    supabase
      .from("documents")
      .select("id, vendor, filename, notice_period, document_date", { count: "exact" })
      .eq("doc_type", "contract")
      .order("document_date", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase.from("links").select("id", { count: "exact", head: true }),
    supabase
      .from("documents")
      .select("id, filename, vendor, doc_type, document_date, amount_cents, currency, status, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);

  const docCount = docs.count ?? 0;
  const name = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  const tiles = [
    { label: "Dokumente", value: docCount },
    { label: "Rechnungen", value: invoices.count ?? 0 },
    { label: "Verträge erkannt", value: contracts.count ?? 0 },
    { label: "Gespeicherte Seiten", value: links.count ?? 0 },
  ];

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-display text-3xl font-semibold">{name ? `Salam, ${name}` : "Übersicht"}</h1>
        <p className="mt-1 text-muted">Alles, was in deinem Igoudar liegt.</p>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl border border-line bg-surface px-4 py-4">
              <div className="font-display text-3xl font-semibold tabular-nums">{t.value}</div>
              <div className="mt-1 text-sm text-muted">{t.label}</div>
            </div>
          ))}
        </div>
      </section>

      {docCount === 0 && (
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-display text-xl font-semibold">So legst du los</h2>
          <ol className="mt-4 space-y-3">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-ink">1</span>
              <span>
                <Link href="/documents" className="font-medium text-accent">3 PDFs hochladen</Link> – eine Rechnung, eine
                Auftragsbestätigung, einen Vertrag.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold">2</span>
              <span>Oben suchen, z. B. nach dem Anbieter oder „Rechnung März“.</span>
            </li>
            <li className="flex gap-3 text-muted">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold">3</span>
              <span>Gmail verbinden und Browser-Erweiterung – kommen in Woche 2.</span>
            </li>
          </ol>
        </section>
      )}

      {(contracts.data?.length ?? 0) > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold">Verträge</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {contracts.data!.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <Link href={`/documents/${c.id}`} className="font-medium hover:text-accent">
                  {c.vendor ?? c.filename}
                </Link>
                <span className="text-sm text-muted">vom {formatDate(c.document_date)}</span>
                <span className="ml-auto text-sm">{c.notice_period ?? "Kündigungsfrist nicht erkannt"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {docCount > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Zuletzt hinzugefügt</h2>
            <Link href="/documents" className="text-sm font-medium text-accent">Alle Dokumente</Link>
          </div>
          {(review.count ?? 0) > 0 && (
            <p className="mt-2 text-sm text-bad">{review.count} Dokument(e) konnten nicht verarbeitet werden.</p>
          )}
          <div className="mt-3">
            <DocumentTable rows={(recent.data ?? []) as DocRow[]} />
          </div>
        </section>
      )}
    </div>
  );
}
