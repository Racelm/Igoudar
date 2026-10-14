import OpenAI from "openai";

export const CATEGORIES = [
  "Shopping",
  "Reise",
  "Arbeit",
  "Finanzen",
  "Behörden",
  "Wissen",
  "Nachrichten",
  "Technik",
  "Gesundheit",
  "Essen",
  "Wohnen",
  "Unterhaltung",
  "Social Media",
  "Sonstiges",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type LinkInsight = {
  category: Category;
  tags: string[];
  summary: string | null;
  title: string | null;
};

// Ohne KI: Einordnung nach bekannten Domains und Stichwörtern.
const RULES: [RegExp, Category][] = [
  [/amazon\.|ebay\.|otto\.de|zalando|jumia|aliexpress|temu|idealo|ikea|decathlon|marjane|avito|etsy|shop|store|kaufen/, "Shopping"],
  [/booking\.|airbnb|expedia|tripadvisor|ryanair|lufthansa|royalairmaroc|easyjet|bahn\.de|oncf|flug|hotel|reise|trip/, "Reise"],
  [/linkedin|xing|github|gitlab|notion|slack|atlassian|figma|indeed|stepstone|rekrute|jira|trello/, "Arbeit"],
  [/paypal|sparkasse|volksbank|n26|ing\.de|comdirect|dkb|attijari|cihbank|bmce|bank|boerse|finanzen|trade|crypto|steuer/, "Finanzen"],
  [/\.gov|\.gouv\.|bund\.de|elster|service-public|finanzamt|bundesagentur|arbeitsagentur|amt|stadt-|consulat|ambassade/, "Behörden"],
  [/wikipedia|medium\.com|stackoverflow|coursera|udemy|khanacademy|scholar|arxiv|wiki/, "Wissen"],
  [/spiegel|zeit\.de|faz\.net|sueddeutsche|tagesschau|bbc|cnn|hespress|le360|lematin|news|welt\.de|heise/, "Nachrichten"],
  [/youtube|netflix|spotify|twitch|primevideo|disney|imdb|deezer|shahid/, "Unterhaltung"],
  [/facebook|instagram|twitter\.com|x\.com|tiktok|reddit|pinterest|threads\.net|snapchat/, "Social Media"],
  [/doctolib|apotheke|gesund|health|klinik|arzt|dkv|aok|tk\.de/, "Gesundheit"],
  [/rezept|chefkoch|lieferando|glovo|ubereats|cuisine|recipe/, "Essen"],
  [/immobilien|immoscout|immowelt|wohnung|mubawab|sarouty/, "Wohnen"],
];

export function categorizeByRules(url: string, title: string | null): LinkInsight {
  const hay = `${url} ${title ?? ""}`.toLowerCase();
  const hit = RULES.find(([re]) => re.test(hay));
  return { category: hit?.[1] ?? "Sonstiges", tags: [], summary: null, title: null };
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["category", "tags", "summary", "title"],
  properties: {
    category: { type: "string", enum: [...CATEGORIES] },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "2 bis 5 kurze Schlagwörter, kleingeschrieben, auf Deutsch. Vorhandene Schlagwörter des Nutzers bevorzugen.",
    },
    summary: { type: "string", description: "Ein Satz auf Deutsch, wozu die Seite gut ist (max. 140 Zeichen)" },
    title: { type: "string", description: "Klarer, kurzer Titel (max. 70 Zeichen), ohne Seitennamen-Anhängsel wie ' | Shop'" },
  },
} as const;

export async function categorizeWithAi(input: {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  text: string;
  note?: string | null;
  existingTags: string[];
}): Promise<LinkInsight> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Du ordnest gespeicherte Webseiten für eine persönliche Sammlung ein. Antworte nur mit den Feldern des Schemas. " +
          "Erfinde nichts, was nicht auf der Seite steht.",
      },
      {
        role: "user",
        content: [
          `URL: ${input.url}`,
          `Titel: ${input.title ?? "-"}`,
          `Seite: ${input.siteName ?? "-"}`,
          `Beschreibung: ${input.description ?? "-"}`,
          input.note ? `Notiz des Nutzers: ${input.note}` : "",
          `Vorhandene Schlagwörter: ${input.existingTags.slice(0, 40).join(", ") || "-"}`,
          `Textauszug:\n${input.text.slice(0, 3500)}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    response_format: { type: "json_schema", json_schema: { name: "link_insight", strict: true, schema: SCHEMA } },
  });

  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as Partial<LinkInsight>;
  const category = CATEGORIES.includes(parsed.category as Category) ? (parsed.category as Category) : "Sonstiges";
  const tags = Array.from(
    new Set(
      (parsed.tags ?? [])
        .map((t) => String(t).toLowerCase().trim().replace(/^#/, "").slice(0, 30))
        .filter(Boolean),
    ),
  ).slice(0, 5);
  return {
    category,
    tags,
    summary: parsed.summary?.trim().slice(0, 200) || null,
    title: parsed.title?.trim().slice(0, 120) || null,
  };
}
