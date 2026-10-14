import type { SupabaseClient } from "@supabase/supabase-js";
import { parseHtml, type PageInfo } from "./html";
import { fetchPage, normalizeUrl } from "./safe-fetch";
import { categorizeByRules, categorizeWithAi, type LinkInsight } from "./categorize";
import { aiEnabled } from "./analyze";

export type SaveLinkInput = { url: string; title?: string | null; note?: string | null };

export type SavedLink = {
  id: string;
  url: string;
  title: string | null;
  domain: string;
  ai_category: string | null;
  tags: string[];
  summary: string | null;
  image_url: string | null;
  favicon_url: string | null;
};

const SELECT = "id, url, title, domain, ai_category, tags, summary, image_url, favicon_url";

export function screenshotUrl(url: string) {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=800&h=500`;
}

export function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export async function saveLink(
  supabase: SupabaseClient,
  input: SaveLinkInput,
): Promise<{ link: SavedLink; duplicate: boolean }> {
  const url = normalizeUrl(input.url);
  if (!url) throw new Error("Das ist keine gültige Webadresse");
  const href = url.toString();

  const { data: existing } = await supabase.from("links").select(SELECT).eq("url", href).maybeSingle();
  if (existing) return { link: existing as SavedLink, duplicate: true };

  const domain = url.hostname.replace(/^www\./, "");

  // Seite lesen – darf scheitern (Login-Seiten, Bot-Sperren); dann reichen URL und Titel.
  let page: PageInfo | null = null;
  try {
    const fetched = await fetchPage(url);
    if (fetched.body) page = parseHtml(fetched.body, fetched.url);
  } catch {
    page = null;
  }

  const baseTitle = page?.title || input.title?.trim() || null;
  let insight: LinkInsight = categorizeByRules(href, baseTitle);
  if (aiEnabled()) {
    try {
      const { data: tagRows } = await supabase.from("links").select("tags").limit(300);
      const counts = new Map<string, number>();
      for (const r of tagRows ?? []) for (const t of (r.tags as string[]) ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
      const existingTags = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);

      insight = await categorizeWithAi({
        url: href,
        title: baseTitle,
        description: page?.description ?? null,
        siteName: page?.siteName ?? null,
        text: page?.text ?? "",
        note: input.note,
        existingTags,
      });
    } catch {
      // KI nicht erreichbar → Regeln bleiben
    }
  }

  const row = {
    url: href,
    title: (insight.title || baseTitle || domain).slice(0, 300),
    domain,
    site_name: page?.siteName ?? null,
    favicon_url: page?.icon ?? faviconUrl(domain),
    image_url: page?.image ?? screenshotUrl(href),
    note: input.note?.trim().slice(0, 2000) || null,
    tags: insight.tags,
    ai_category: insight.category,
    summary: insight.summary ?? page?.description ?? null,
    page_text: page?.text ?? null,
    source_browser: "web",
  };

  const { data, error } = await supabase.from("links").insert(row).select(SELECT).single();
  if (error) {
    // Gleichzeitig gespeichert? Dann den vorhandenen Eintrag zurückgeben.
    const { data: again } = await supabase.from("links").select(SELECT).eq("url", href).maybeSingle();
    if (again) return { link: again as SavedLink, duplicate: true };
    throw new Error(error.message);
  }
  return { link: data as SavedLink, duplicate: false };
}
