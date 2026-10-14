import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processDocument } from "@/lib/process-document";

export const runtime = "nodejs";
export const maxDuration = 60;

// Analysiert wartende Dokumente (z. B. aus Gmail) in kleinen Portionen.
export async function POST() {
  const supabase = await createClient();
  const deadline = Date.now() + 35_000;

  const { data: pending } = await supabase
    .from("documents")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(4);

  let processed = 0;
  for (const doc of pending ?? []) {
    if (Date.now() > deadline) break;
    try {
      await processDocument(supabase, doc.id);
    } catch {
      // Fehler steht am Dokument; mit dem nächsten weitermachen
    }
    processed++;
  }

  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return NextResponse.json({ processed, remaining: count ?? 0 });
}
