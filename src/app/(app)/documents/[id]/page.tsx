import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentForm } from "@/components/DocumentForm";
import { DOC_TYPE_LABEL, STATUS_LABEL, formatSize } from "@/lib/format";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select(
      "id, filename, storage_path, file_size, page_count, doc_type, vendor, document_date, amount_cents, currency, contract_number, notice_period, summary, status, error, user_edited, ai_confidence",
    )
    .eq("id", id)
    .maybeSingle();
  if (!doc) notFound();

  // Kurzlebiger Link (10 Min.) zur PDF-Vorschau
  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 600);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/documents" className="text-sm text-muted hover:text-ink">← Dokumente</Link>
        <h1 className="mt-2 font-display text-3xl font-semibold">{doc.vendor ?? doc.filename}</h1>
        <p className="mt-1 text-sm text-muted">
          {doc.doc_type ? DOC_TYPE_LABEL[doc.doc_type] : "Typ unbekannt"} · {doc.filename} · {formatSize(doc.file_size)}
          {doc.page_count ? ` · ${doc.page_count} Seite${doc.page_count === 1 ? "" : "n"}` : ""}
          {doc.status !== "done" && ` · ${STATUS_LABEL[doc.status] ?? doc.status}`}
        </p>
        {doc.error && <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-sm">{doc.error}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {signed?.signedUrl ? (
            <iframe src={signed.signedUrl} title={doc.filename} className="h-[75vh] w-full" />
          ) : (
            <p className="p-6 text-muted">Vorschau nicht verfügbar.</p>
          )}
        </div>
        <DocumentForm doc={doc} fileUrl={signed?.signedUrl ?? null} />
      </div>
    </div>
  );
}
