import type { SupabaseClient } from "@supabase/supabase-js";
import { readPdfText } from "./pdf";
import { aiEnabled, analyzeDocument, toRow } from "./analyze";

// Liest den Text eines gespeicherten PDFs und lässt die KI die Felder ausfüllen.
// Nutzerkorrekturen (user_edited) werden nie überschrieben.
export async function processDocument(supabase: SupabaseClient, documentId: string, opts: { force?: boolean } = {}) {
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, storage_path, filename, extracted_text, user_edited, email_subject")
    .eq("id", documentId)
    .single();
  if (error || !doc) throw new Error("Dokument nicht gefunden");

  try {
    let text: string = doc.extracted_text ?? "";

    if (!text || opts.force) {
      await supabase.from("documents").update({ status: "extracting", error: null }).eq("id", doc.id);
      const { data: file, error: dlError } = await supabase.storage.from("documents").download(doc.storage_path);
      if (dlError || !file) throw new Error("Datei konnte nicht geladen werden");
      const pdf = await readPdfText(new Uint8Array(await file.arrayBuffer()));
      text = pdf.text;
      await supabase
        .from("documents")
        .update({
          extracted_text: text,
          page_count: pdf.pageCount,
          error: pdf.looksScanned ? "Kaum Text gefunden – vermutlich ein Scan. Texterkennung (OCR) folgt in einer späteren Version." : null,
        })
        .eq("id", doc.id);
    }

    if (aiEnabled() && text.length > 0 && (!doc.user_edited || opts.force)) {
      await supabase.from("documents").update({ status: "analyzing" }).eq("id", doc.id);
      const analysis = await analyzeDocument(text, doc.filename, doc.email_subject);
      await supabase.from("documents").update({ ...toRow(analysis), user_edited: false }).eq("id", doc.id);
    }

    await supabase.from("documents").update({ status: "done" }).eq("id", doc.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    await supabase.from("documents").update({ status: "failed", error: message }).eq("id", doc.id);
    throw e;
  }
}
