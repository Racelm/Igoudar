import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { processDocument } from "@/lib/process-document";

export const runtime = "nodejs";
export const maxDuration = 60;

// Wird nach dem direkten Upload in Supabase Storage aufgerufen:
// legt den Datensatz an, liest den Text und startet die KI-Analyse.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { path?: string; filename?: string } | null;
  const path = body?.path ?? "";
  const filename = (body?.filename ?? "").slice(0, 255) || "dokument.pdf";
  if (!path.startsWith(`${user.id}/`) || path.includes("..")) {
    return NextResponse.json({ error: "Ungültiger Dateipfad" }, { status: 400 });
  }

  const { data: file, error: dlError } = await supabase.storage.from("documents").download(path);
  if (dlError || !file) return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    await supabase.storage.from("documents").remove([path]);
    return NextResponse.json({ error: "Das ist keine PDF-Datei" }, { status: 400 });
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  // Gleiche Datei schon vorhanden? Dann den Upload verwerfen und auf das Original zeigen.
  const { data: existing } = await supabase.from("documents").select("id").eq("sha256", sha256).maybeSingle();
  if (existing) {
    await supabase.storage.from("documents").remove([path]);
    return NextResponse.json({ id: existing.id, duplicate: true });
  }

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      source: "upload",
      storage_path: path,
      filename,
      file_size: bytes.length,
      sha256,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !doc) {
    return NextResponse.json({ error: insertError?.message ?? "Speichern fehlgeschlagen" }, { status: 500 });
  }

  try {
    await processDocument(supabase, doc.id);
  } catch {
    // Status "failed" + Fehlertext stehen schon am Dokument; Upload selbst war erfolgreich.
  }

  return NextResponse.json({ id: doc.id, duplicate: false });
}
