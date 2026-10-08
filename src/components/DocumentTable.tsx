import Link from "next/link";
import { DOC_TYPE_LABEL, STATUS_LABEL, formatAmount, formatDate } from "@/lib/format";

export type DocRow = {
  id: string;
  filename: string;
  vendor: string | null;
  doc_type: string | null;
  document_date: string | null;
  amount_cents: number | null;
  currency: string | null;
  status: string;
  created_at: string;
};

export function DocumentTable({ rows }: { rows: DocRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-muted">Noch keine Dokumente.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2.5 font-medium">Datum</th>
            <th className="px-4 py-2.5 font-medium">Anbieter</th>
            <th className="px-4 py-2.5 font-medium">Typ</th>
            <th className="px-4 py-2.5 text-right font-medium">Betrag</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((d) => (
            <tr key={d.id} className="hover:bg-bg">
              <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDate(d.document_date ?? d.created_at)}</td>
              <td className="px-4 py-2.5">
                <Link href={`/documents/${d.id}`} className="font-medium hover:text-accent">
                  {d.vendor ?? d.filename}
                </Link>
                {d.status !== "done" && (
                  <span className={`ml-2 text-xs ${d.status === "failed" ? "text-bad" : "text-warn"}`}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-muted">{d.doc_type ? DOC_TYPE_LABEL[d.doc_type] : "–"}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                {formatAmount(d.amount_cents, d.currency ?? "EUR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
