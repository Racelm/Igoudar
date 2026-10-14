import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Holt fremde Webseiten, ohne interne Adressen (Server, Router, Cloud-Metadaten) erreichbar zu machen.

export function normalizeUrl(input: string): URL | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    if (!u.hostname.includes(".") && isIP(u.hostname) === 0) return null;
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

function privateV4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function isPrivateAddress(ip: string) {
  const v = isIP(ip);
  if (v === 4) return privateV4(ip);
  if (v === 6) {
    const s = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapped) return privateV4(mapped[1]);
    return s === "::" || s === "::1" || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe8") ||
      s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb");
  }
  return true;
}

async function assertPublic(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error("Interne Adressen sind nicht erlaubt");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error("Interne Adressen sind nicht erlaubt");
  }
}

export type FetchedPage = { url: string; status: number; contentType: string; body: string | null };

const MAX_BYTES = 1_500_000;

export async function fetchPage(start: URL, timeoutMs = 8000): Promise<FetchedPage> {
  let url = start;
  const signal = AbortSignal.timeout(timeoutMs);

  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IgoudarBot/1.0; +https://github.com/Racelm/Igoudar)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "Accept-Language": "de,en;q=0.8,fr;q=0.6",
      },
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = normalizeUrl(new URL(res.headers.get("location")!, url).toString());
      if (!next) throw new Error("Ungültige Weiterleitung");
      url = next;
      continue;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(contentType) || !res.body) {
      await res.body?.cancel();
      return { url: url.toString(), status: res.status, contentType, body: null };
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => undefined);

    const bytes = Buffer.concat(chunks);
    const charset = /charset=([\w-]+)/i.exec(contentType)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(bytes.subarray(0, 4096).toString("latin1"))?.[1] ?? "utf-8";
    let body: string;
    try {
      body = new TextDecoder(charset.toLowerCase()).decode(bytes);
    } catch {
      body = new TextDecoder("utf-8").decode(bytes);
    }
    return { url: url.toString(), status: res.status, contentType, body };
  }
  throw new Error("Zu viele Weiterleitungen");
}
