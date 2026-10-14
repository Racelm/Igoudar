import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseQuery } from "@/lib/search-parse";

// Live-Suche für die Befehlspalette (⌘K).
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const parsed = parseQuery(q);
  if (!q || (!parsed.text && !parsed.kinds && !parsed.docTypes && !parsed.dateFrom)) {
    return NextResponse.json({ hits: [], parsed });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_all", {
    q: parsed.text,
    kinds: parsed.kinds,
    doc_types: parsed.docTypes,
    date_from: parsed.dateFrom,
    date_to: parsed.dateTo,
    lim: 8,
  });
  if (error) return NextResponse.json({ error: error.message, hits: [], parsed }, { status: 500 });
  return NextResponse.json({ hits: data ?? [], parsed });
}
