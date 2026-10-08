import { extractText, getDocumentProxy } from "unpdf";

export interface PdfText {
  text: string;
  pageCount: number;
  // true, wenn kaum Text gefunden wurde → vermutlich ein Scan (OCR folgt später)
  looksScanned: boolean;
}

export async function readPdfText(bytes: Uint8Array): Promise<PdfText> {
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const clean = String(text)
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    text: clean,
    pageCount: totalPages,
    looksScanned: clean.length < 50 * Math.max(1, totalPages),
  };
}
