import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchWeb } from "@/lib/web-search";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ error: "Suchbegriff zu kurz" }, { status: 400 });

  const supabase = await createClient();
  try {
    const result = await searchWeb(q.slice(0, 300));
    // Schon gespeicherte Seiten markieren
    const urls = result.results.map((r) => r.url);
    const { data: saved } = urls.length
      ? await supabase.from("links").select("id, url").in("url", urls)
      : { data: [] as { id: string; url: string }[] };
    const savedMap = new Map((saved ?? []).map((s) => [s.url, s.id]));
    return NextResponse.json({
      ...result,
      results: result.results.map((r) => ({ ...r, savedId: savedMap.get(r.url) ?? null })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Websuche fehlgeschlagen" }, { status: 502 });
  }
}
