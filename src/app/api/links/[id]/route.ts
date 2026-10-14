import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/categorize";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    note?: string;
    tags?: string[] | string;
    ai_category?: string;
  };

  const update: Record<string, unknown> = {};
  if (typeof body.title === "string") update.title = body.title.trim().slice(0, 300) || null;
  if (typeof body.note === "string") update.note = body.note.trim().slice(0, 2000) || null;
  if (body.tags !== undefined) {
    const list = Array.isArray(body.tags) ? body.tags : String(body.tags).split(",");
    update.tags = Array.from(new Set(list.map((t) => String(t).toLowerCase().trim().replace(/^#/, "")).filter(Boolean))).slice(0, 12);
  }
  if (body.ai_category !== undefined) {
    if (!(CATEGORIES as readonly string[]).includes(body.ai_category)) {
      return NextResponse.json({ error: "Unbekannte Kategorie" }, { status: 400 });
    }
    update.ai_category = body.ai_category;
    update.category_confirmed = true;
  }

  const { error } = await supabase.from("links").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("links").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
