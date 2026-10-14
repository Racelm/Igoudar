import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Merkt sich, wann ein Link zuletzt geöffnet wurde ("Zuletzt benutzt").
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  await supabase.from("links").update({ last_opened_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ ok: true });
}
