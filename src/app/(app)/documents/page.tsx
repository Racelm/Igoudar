import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Uploader } from "@/components/Uploader";
import { DocumentTable, type DocRow } from "@/components/DocumentTable";
import { DOC_TYPE_LABEL } from "@/lib/format";

export const metadata = { title: "Dokumente" };

const FILTERS = [
  { key: "", label: "Alle" },
  { key: "invoice", label: "Rechnungen" },
  { key: "order_confirmation", label: "Auftragsbestätigungen" },
  { key: "delivery_note", label: "Lieferscheine" },
  { key: "contract", label: "Verträge" },
  { key: "other", label: "Sonstiges" },
];

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type = "" } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("documents")
    .select("id, filename, vendor, doc_type, document_date, amount_cents, currency, status, created_at")
    .order("document_date", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(200);
  if (type && type in DOC_TYPE_LABEL) query = query.eq("doc_type", type);
  const { data } = await query;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Dokumente</h1>
      <Uploader userId={user!.id} />

      <nav className="flex flex-wrap gap-2" aria-label="Nach Typ filtern">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/documents?type=${f.key}` : "/documents"}
            className={`rounded-full border px-3 py-1 text-sm ${
              type === f.key ? "border-accent bg-accent-soft font-medium" : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <DocumentTable rows={(data ?? []) as DocRow[]} />
    </div>
  );
}
