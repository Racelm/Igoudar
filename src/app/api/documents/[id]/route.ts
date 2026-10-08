import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const DOC_TYPES = ["invoice", "order_confirmation", "delivery_note", "contract", "other"];

// Felder korrigieren. Setzt user_edited, damit die KI sie nicht wieder überschreibt.
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const update: Record<string, unknown> = { user_edited: true };

  if ("vendor" in body) update.vendor = str(body.vendor);
  if ("doc_type" in body) {
    if (body.doc_type !== null && !DOC_TYPES.includes(String(body.doc_type))) {
      return NextResponse.json({ error: "Unbekannter Dokumenttyp" }, { status: 400 });
    }
    update.doc_type = body.doc_type;
  }
  if ("document_date" in body) {
    const d = str(body.document_date, 10);
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return NextResponse.json({ error: "Datum als JJJJ-MM-TT" }, { status: 400 });
    update.document_date = d;
  }
  if ("amount" in body) {
    const raw = body.amount;
    if (raw === null || raw === "") update.amount_cents = null;
    else {
      const n = Number(String(raw).replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n)) return NextResponse.json({ error: "Betrag ist keine Zahl" }, { status: 400 });
      update.amount_cents = Math.round(n * 100);
    }
  }
  if ("currency" in body) {
    const c = str(body.currency, 3)?.toUpperCase() ?? "EUR";
    if (!/^[A-Z]{3}$/.test(c)) return NextResponse.json({ error: "Währung als ISO-Code, z. B. EUR" }, { status: 400 });
    update.currency = c;
  }
  if ("contract_number" in body) update.contract_number = str(body.contract_number);
  if ("notice_period" in body) update.notice_period = str(body.notice_period, 300);
  if ("summary" in body) update.summary = str(body.summary, 500);

  const { error } = await supabase.from("documents").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await supabase.storage.from("documents").remove([doc.storage_path]);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
