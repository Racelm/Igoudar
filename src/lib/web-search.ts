// Websuche direkt in der App. Bevorzugt Tavily (1.000 Suchen/Monat gratis),
// sonst OpenAI Websuche mit dem vorhandenen API-Schlüssel.

export type WebResult = { title: string; url: string; snippet: string; domain: string };
export type WebSearchResponse = { provider: "Tavily" | "OpenAI"; answer: string | null; results: WebResult[] };

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function tidy(results: { title?: string; url?: string; snippet?: string }[]): WebResult[] {
  const seen = new Set<string>();
  const out: WebResult[] = [];
  for (const r of results) {
    if (!r.url || !/^https?:\/\//.test(r.url)) continue;
    const key = r.url.replace(/[?#].*$/, "").replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: (r.title || domainOf(r.url)).slice(0, 160),
      url: r.url,
      snippet: (r.snippet || "").replace(/\s+/g, " ").trim().slice(0, 280),
      domain: domainOf(r.url),
    });
  }
  return out.slice(0, 10);
}

async function tavily(q: string): Promise<WebSearchResponse> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({ query: q, max_results: 8, search_depth: "basic", include_answer: true }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Websuche fehlgeschlagen (${res.status})`);
  const json = (await res.json()) as { answer?: string; results?: { title?: string; url?: string; content?: string }[] };
  return {
    provider: "Tavily",
    answer: json.answer?.trim() || null,
    results: tidy((json.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content }))),
  };
}

type OpenAiOutput = {
  type: string;
  content?: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[];
};

async function openai(q: string): Promise<WebSearchResponse> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_SEARCH_MODEL || "gpt-4.1-mini",
      tools: [{ type: "web_search" }],
      input:
        `Suche im Web nach: ${q}\n\n` +
        "Antworte NUR mit JSON in genau dieser Form, ohne Codeblock:\n" +
        '{"answer":"1-2 Sätze auf Deutsch","results":[{"title":"…","url":"https://…","snippet":"1 Satz auf Deutsch"}]}\n' +
        "Gib 6 bis 8 verschiedene, direkt nutzbare Seiten an (keine Suchmaschinen-Links).",
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Websuche fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 160)}`);
  const json = (await res.json()) as { output?: OpenAiOutput[] };

  const texts: string[] = [];
  const citations: { title?: string; url?: string }[] = [];
  for (const item of json.output ?? []) {
    for (const c of item.content ?? []) {
      if (c.text) texts.push(c.text);
      for (const a of c.annotations ?? []) if (a.type === "url_citation") citations.push({ title: a.title, url: a.url });
    }
  }
  const raw = texts.join("\n");
  let answer: string | null = null;
  let results: { title?: string; url?: string; snippet?: string }[] = [];
  const match = /\{[\s\S]*\}/.exec(raw);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { answer?: string; results?: typeof results };
      answer = parsed.answer?.trim() || null;
      results = parsed.results ?? [];
    } catch {
      // Antwort war kein sauberes JSON → Quellenangaben verwenden
    }
  }
  if (results.length === 0) results = citations;
  // OpenAI hängt Tracking-Parameter an
  results = results.map((r) => ({ ...r, url: r.url?.replace(/[?&]utm_source=openai$/, "") }));
  return { provider: "OpenAI", answer, results: tidy(results) };
}

export async function searchWeb(q: string): Promise<WebSearchResponse> {
  if (process.env.TAVILY_API_KEY) return tavily(q);
  if (process.env.OPENAI_API_KEY) return openai(q);
  throw new Error("Keine Websuche eingerichtet: TAVILY_API_KEY oder OPENAI_API_KEY setzen");
}
