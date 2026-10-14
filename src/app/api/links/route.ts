import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveLink } from "@/lib/save-link";

export const runtime = "nodejs";
export const maxDuration = 30;

// Webseite speichern: Seite lesen, KI ordnet ein (Kategorie, Schlagwörter, Kurzbeschreibung).
export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json().catch(() => ({}))) as { url?: string; title?: string; note?: string };
  if (!body.url) return NextResponse.json({ error: "Webadresse fehlt" }, { status: 400 });

  try {
    const result = await saveLink(supabase, { url: body.url, title: body.title, note: body.note });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Speichern fehlgeschlagen" }, { status: 400 });
  }
}
