// Zerlegt eine freie Suchanfrage wie "Amazon Rechnung März" in
// Suchtext + Filter (Typ, Dokumentart, Zeitraum).

export type SearchKind = "document" | "link" | "contract";
export type DocType = "invoice" | "order_confirmation" | "delivery_note" | "contract" | "other";

export interface ParsedQuery {
  text: string;
  kinds: SearchKind[] | null;
  docTypes: DocType[] | null;
  dateFrom: string | null; // YYYY-MM-DD
  dateTo: string | null;
}

const MONTHS: Record<string, number> = {
  januar: 1, jan: 1, jänner: 1,
  februar: 2, feb: 2,
  märz: 3, maerz: 3, mär: 3, mar: 3,
  april: 4, apr: 4,
  mai: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  dezember: 12, dez: 12,
};

const DOC_TYPE_WORDS: Record<string, DocType> = {
  rechnung: "invoice", rechnungen: "invoice", invoice: "invoice", facture: "invoice",
  auftragsbestätigung: "order_confirmation", auftragsbestätigungen: "order_confirmation",
  bestellbestätigung: "order_confirmation", bestellung: "order_confirmation",
  lieferschein: "delivery_note", lieferscheine: "delivery_note", lieferung: "delivery_note",
};

const KIND_WORDS: Record<string, SearchKind> = {
  vertrag: "contract", verträge: "contract", vertraege: "contract", contrat: "contract",
  link: "link", links: "link", seite: "link", seiten: "link", webseite: "link", webseiten: "link",
  lesezeichen: "link", bookmark: "link",
  dokument: "document", dokumente: "document", pdf: "document", pdfs: "document",
};

// Füllwörter, die nach dem Herausnehmen der Filter übrig bleiben würden
const STOP = new Set(["gespeicherte", "gespeicherten", "über", "ueber", "von", "vom", "aus", "im", "in", "meine", "mein", "alle"]);

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function lastDay(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseQuery(input: string, today: Date = new Date()): ParsedQuery {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const rest: string[] = [];
  const kinds = new Set<SearchKind>();
  const docTypes = new Set<DocType>();
  let month: number | null = null;
  let year: number | null = null;

  for (const raw of tokens) {
    const t = raw.toLowerCase().replace(/[.,;:!?]+$/, "");

    if (/^(19|20)\d{2}$/.test(t)) {
      year = Number(t);
      continue;
    }
    if (t in MONTHS) {
      month = MONTHS[t];
      continue;
    }
    const mm = /^(\d{1,2})\/((?:19|20)\d{2})$/.exec(t);
    if (mm && Number(mm[1]) >= 1 && Number(mm[1]) <= 12) {
      month = Number(mm[1]);
      year = Number(mm[2]);
      continue;
    }
    if (t in DOC_TYPE_WORDS) {
      docTypes.add(DOC_TYPE_WORDS[t]);
      continue;
    }
    if (t in KIND_WORDS) {
      const k = KIND_WORDS[t];
      // "Vertrag" filtert nicht weg, sondern sucht Verträge UND Vertragsdokumente
      if (k === "contract") {
        kinds.add("contract");
        kinds.add("document");
      } else {
        kinds.add(k);
      }
      continue;
    }
    if (STOP.has(t)) continue;
    rest.push(raw);
  }

  // Dokumentarten implizieren Dokumente
  if (docTypes.size > 0) kinds.add("document");

  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  if (month !== null) {
    // Monat ohne Jahr: der letzte vergangene (oder aktuelle) Monat mit diesem Namen
    const y = year ?? (month <= today.getMonth() + 1 ? today.getFullYear() : today.getFullYear() - 1);
    dateFrom = `${y}-${pad(month)}-01`;
    dateTo = `${y}-${pad(month)}-${pad(lastDay(y, month))}`;
  } else if (year !== null) {
    dateFrom = `${year}-01-01`;
    dateTo = `${year}-12-31`;
  }

  // Nur Filterwörter ("Rechnung März")? Dann bleiben die Filter, Text ist leer.
  return {
    text: rest.join(" "),
    kinds: kinds.size ? [...kinds] : null,
    docTypes: docTypes.size ? [...docTypes] : null,
    dateFrom,
    dateTo,
  };
}
