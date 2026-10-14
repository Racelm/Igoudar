import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { features } from "@/lib/env";
import { DocumentTable, type DocRow } from "@/components/DocumentTable";
import { OracleTrigger } from "@/components/PaletteTrigger";
import { SyncPanel, type AccountInfo } from "@/components/SyncPanel";
import { formatAmount, formatDate } from "@/lib/format";

export default async function Overview({ searchParams }: { searchParams: Promise<{ gmail?: string; address?: string }> }) {
  const { gmail, address } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthIso = monthStart.toISOString().slice(0, 10);

  const [docs, monthInvoices, contracts, recent, links, accounts, pending] = await Promise.all([
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("amount_cents, currency").eq("doc_type", "invoice").gte("document_date", monthIso),
    supabase
      .from("documents")
      .select("id, vendor, filename, notice_period, document_date", { count: "exact" })
      .eq("doc_type", "contract")
      .order("document_date", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from("documents")
      .select("id, filename, vendor, doc_type, document_date, amount_cents, currency, status, created_at, source")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("links")
      .select("id, url, title, domain, ai_category, favicon_url", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("email_accounts").select("id, address, status, last_synced_at, last_error").order("created_at"),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const name = ((user?.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0];
  const eurThisMonth = (monthInvoices.data ?? [])
    .filter((r) => (r.currency ?? "EUR") === "EUR")
    .reduce((n, r) => n + (r.amount_cents ?? 0), 0);

  const facts = [
    { value: String(docs.count ?? 0), label: "Dokumente", href: "/documents" },
    { value: formatAmount(eurThisMonth), label: "Rechnungen diesen Monat", href: "/documents?type=invoice" },
    { value: String(contracts.count ?? 0), label: "Verträge erkannt", href: "/documents?type=contract" },
    { value: String(links.count ?? 0), label: "Gespeicherte Seiten", href: "/links" },
  ];

  return (
    <div className="space-y-10">
      <section className="pt-4 sm:pt-10">
        <p className="text-sm text-muted">{name ? `Salam, ${name}` : "Salam"}</p>
        <h1 className="mt-2 max-w-3xl font-display text-3xl font-medium leading-[1.15] sm:text-5xl">
          Alles, was du aufbewahrst, an einem Ort.
        </h1>
        <div className="mt-8 max-w-3xl">
          <OracleTrigger />
        </div>
      </section>

      {gmail === "connected" && (
        <p className="rounded-2xl bg-good/15 px-4 py-3 text-sm text-good">
          {address} ist verbunden. Igoudar holt jetzt die PDFs der letzten 12 Monate – das kann ein paar Minuten dauern.
        </p>
      )}

      <SyncPanel
        accounts={(accounts.data ?? []) as AccountInfo[]}
        pending={pending.count ?? 0}
        gmailReady={features().gmail}
        auto
      />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-4">
        {facts.map((f) => (
          <Link key={f.label} href={f.href} className="bg-surface px-5 py-5 hover:bg-surface-2">
            <dd className="font-display text-2xl tabular-nums sm:text-[28px]">{f.value}</dd>
            <dt className="mt-1 text-sm text-muted">{f.label}</dt>
          </Link>
        ))}
      </dl>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-medium">Neu im Speicher</h2>
            <Link href="/documents" className="text-sm text-glow hover:text-ink">Alle Dokumente</Link>
          </div>
          {(recent.data?.length ?? 0) > 0 ? (
            <DocumentTable rows={(recent.data ?? []) as DocRow[]} />
          ) : (
            <Link href="/documents" className="block rounded-3xl border border-dashed border-line px-6 py-8 text-center text-muted hover:border-glow hover:text-ink">
              Lade deine ersten PDFs hoch – Rechnung, Auftragsbestätigung, Vertrag.
            </Link>
          )}
        </section>

        <section className="space-y-10">
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-medium">Zuletzt gespeichert</h2>
              <Link href="/links" className="text-sm text-glow hover:text-ink">Alle Links</Link>
            </div>
            {(links.data?.length ?? 0) > 0 ? (
              <ul className="space-y-1">
                {links.data!.map((l) => (
                  <li key={l.id}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.favicon_url ?? ""} alt="" className="h-5 w-5 rounded" referrerPolicy="no-referrer" />
                      <span className="min-w-0 flex-1 truncate">{l.title ?? l.domain}</span>
                      {l.ai_category && <span className="shrink-0 text-xs text-muted">{l.ai_category}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <Link href="/links" className="block rounded-3xl border border-dashed border-line px-6 py-8 text-center text-muted hover:border-glow hover:text-ink">
                Such im Web und speichere Seiten mit einem Klick.
              </Link>
            )}
          </div>

          {(contracts.data?.length ?? 0) > 0 && (
            <div>
              <h2 className="mb-3 font-display text-lg font-medium">Verträge</h2>
              <ul className="space-y-1">
                {contracts.data!.map((c) => (
                  <li key={c.id}>
                    <Link href={`/documents/${c.id}`} className="block rounded-2xl px-2 py-2 hover:bg-surface">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate">{c.vendor ?? c.filename}</span>
                        <span className="shrink-0 text-xs text-muted">{formatDate(c.document_date)}</span>
                      </span>
                      <span className="block truncate text-sm text-muted">{c.notice_period ?? "Kündigungsfrist nicht erkannt"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
