import OpenAI from "openai";

export interface DocumentAnalysis {
  doc_type: "invoice" | "order_confirmation" | "delivery_note" | "contract" | "other";
  vendor: string | null;
  document_date: string | null; // YYYY-MM-DD
  amount: number | null; // Gesamtbetrag brutto
  currency: string | null; // ISO 4217
  contract_number: string | null;
  notice_period: string | null;
  summary: string;
  confidence: number; // 0..1
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "doc_type", "vendor", "document_date", "amount", "currency",
    "contract_number", "notice_period", "summary", "confidence",
  ],
  properties: {
    doc_type: {
      type: "string",
      enum: ["invoice", "order_confirmation", "delivery_note", "contract", "other"],
      description: "invoice = Rechnung, order_confirmation = Auftrags-/Bestellbestätigung, delivery_note = Lieferschein/Versandbestätigung, contract = Vertrag/Vertragsbestätigung",
    },
    vendor: { type: ["string", "null"], description: "Firma, die das Dokument ausgestellt hat, kurz (z. B. 'Vodafone', 'Amazon')" },
    document_date: { type: ["string", "null"], description: "Ausstellungsdatum im Format YYYY-MM-DD" },
    amount: { type: ["number", "null"], description: "Gesamtbetrag brutto als Zahl, z. B. 24.99" },
    currency: { type: ["string", "null"], description: "ISO-Währungscode, z. B. EUR oder MAD" },
    contract_number: { type: ["string", "null"], description: "Vertrags-, Kunden- oder Rechnungsnummer" },
    notice_period: { type: ["string", "null"], description: "Kündigungsfrist im Wortlaut, z. B. '3 Monate zum Ende der Mindestlaufzeit'" },
    summary: { type: "string", description: "Ein Satz auf Deutsch, worum es geht (max. 140 Zeichen)" },
    confidence: { type: "number", description: "Wie sicher die Angaben sind, 0 bis 1" },
  },
} as const;

const SYSTEM = `Du liest Geschäftsdokumente (Rechnungen, Bestellbestätigungen, Lieferscheine, Verträge) auf Deutsch, Französisch, Englisch oder Arabisch.
Gib nur Werte zurück, die im Text stehen. Erfinde nichts; unbekannt = null.
Datumsangaben immer als YYYY-MM-DD. Beträge als Zahl mit Punkt als Dezimaltrenner.`;

export function aiEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function analyzeDocument(text: string, filename: string, emailSubject?: string | null): Promise<DocumentAnalysis> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Die ersten ~12.000 Zeichen reichen für Kopf, Summen und Vertragsbedingungen.
  const excerpt = text.length > 12000 ? text.slice(0, 9000) + "\n…\n" + text.slice(-3000) : text;

  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Dateiname: ${filename}\n${emailSubject ? `Betreff der E-Mail: ${emailSubject}\n` : ""}\nText:\n${excerpt}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "document_analysis", strict: true, schema: SCHEMA },
    },
  });

  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Leere Antwort der KI");
  return JSON.parse(content) as DocumentAnalysis;
}

export function toRow(a: DocumentAnalysis) {
  const validDate = a.document_date && /^\d{4}-\d{2}-\d{2}$/.test(a.document_date) ? a.document_date : null;
  return {
    doc_type: a.doc_type,
    vendor: a.vendor?.trim() || null,
    document_date: validDate,
    amount_cents: typeof a.amount === "number" && Number.isFinite(a.amount) ? Math.round(a.amount * 100) : null,
    currency: a.currency && /^[A-Z]{3}$/.test(a.currency) ? a.currency : "EUR",
    contract_number: a.contract_number?.trim() || null,
    notice_period: a.notice_period?.trim() || null,
    summary: a.summary?.trim() || null,
    ai_confidence: Math.max(0, Math.min(1, a.confidence ?? 0)),
    ai_raw: a,
  };
}
