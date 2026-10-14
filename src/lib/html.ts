// HTML-Auswertung ohne Abhängigkeiten: Titel, Beschreibung, Bild, Icon, Fließtext.

export type PageInfo = {
  title: string | null;
  description: string | null;
  siteName: string | null;
  image: string | null;
  icon: string | null;
  lang: string | null;
  text: string;
};

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
  eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ndash: "–", mdash: "—", hellip: "…",
};

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

function attrs(tag: string) {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

function clean(s: string | null | undefined, max = 300) {
  if (!s) return null;
  const t = decodeEntities(s).replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

function absolute(href: string | null | undefined, base: string) {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function parseHtml(html: string, baseUrl: string): PageInfo {
  const head = html.slice(0, 200_000);
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const k = (a.property || a.name || a.itemprop || "").toLowerCase();
    if (k && a.content && !(k in meta)) meta[k] = a.content;
  }

  let icon: string | null = null;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = (a.rel || "").toLowerCase();
    if (a.href && /(^|\s)(icon|apple-touch-icon)(\s|$)/.test(rel)) {
      icon = absolute(a.href, baseUrl);
      if (rel.includes("apple-touch-icon")) break; // größer und schärfer
    }
  }

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const lang = /<html\b[^>]*\blang\s*=\s*["']?([a-zA-Z-]+)/i.exec(head)?.[1] ?? null;

  const body = html
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, 20000);

  return {
    title: clean(meta["og:title"] || meta["twitter:title"] || titleTag, 200),
    description: clean(meta["og:description"] || meta["description"] || meta["twitter:description"], 400),
    siteName: clean(meta["og:site_name"] || meta["application-name"], 80),
    image: absolute(meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || meta["twitter:image:src"], baseUrl),
    icon,
    lang,
    text,
  };
}
