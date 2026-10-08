export const DOC_TYPE_LABEL: Record<string, string> = {
  invoice: "Rechnung",
  order_confirmation: "Auftragsbestätigung",
  delivery_note: "Lieferschein",
  contract: "Vertrag",
  other: "Sonstiges",
};

export function formatAmount(cents: number | null | undefined, currency = "EUR") {
  if (cents === null || cents === undefined) return "–";
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2).replace(".", ",")} ${currency}`;
  }
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "–";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Wartet",
  extracting: "Text wird gelesen",
  analyzing: "Wird analysiert",
  done: "Fertig",
  failed: "Fehler",
};
