// Schlanker Gmail-Client über die REST-API (nur Lesen).

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"];

export class GmailAuthError extends Error {}

export function gmailAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account", // liefert immer einen Refresh-Token, Konto frei wählbar
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    const msg = json.error_description || json.error || `HTTP ${res.status}`;
    if (json.error === "invalid_grant") throw new GmailAuthError(msg);
    throw new Error(`Google-Anmeldung fehlgeschlagen: ${msg}`);
  }
  return json;
}

export function exchangeCode(code: string, redirectUri: string) {
  return tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

export async function revokeToken(token: string) {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
}

export type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
};

export type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
};

export class GmailClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = `${API}${path}${params ? `?${new URLSearchParams(params)}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (res.status === 401) throw new GmailAuthError("Zugriff auf Gmail abgelaufen");
    if (!res.ok) throw new Error(`Gmail-API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  }

  profile() {
    return this.get<{ emailAddress: string; messagesTotal: number }>("/profile");
  }

  async listMessageIds(q: string, max = 1000): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const page = await this.get<{ messages?: { id: string }[]; nextPageToken?: string }>("/messages", {
        q,
        maxResults: "500",
        ...(pageToken ? { pageToken } : {}),
      });
      for (const m of page.messages ?? []) ids.push(m.id);
      pageToken = page.nextPageToken;
    } while (pageToken && ids.length < max);
    return ids.slice(0, max);
  }

  getMessage(id: string) {
    return this.get<GmailMessage>(`/messages/${id}`, { format: "full" });
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    const res = await this.get<{ data: string }>(`/messages/${messageId}/attachments/${attachmentId}`);
    return Buffer.from(res.data, "base64url");
  }
}

export function header(part: GmailPart | undefined, name: string) {
  const lower = name.toLowerCase();
  return part?.headers?.find((h) => h.name.toLowerCase() === lower)?.value ?? "";
}

export function pdfParts(part: GmailPart | undefined, out: GmailPart[] = []): GmailPart[] {
  if (!part) return out;
  const name = (part.filename ?? "").toLowerCase();
  const isPdf = part.mimeType === "application/pdf" || name.endsWith(".pdf");
  if (isPdf && (part.body?.attachmentId || part.body?.data)) out.push(part);
  for (const p of part.parts ?? []) pdfParts(p, out);
  return out;
}

// "Amazon.de <rechnung@amazon.de>" → { name, address }
export function parseFrom(value: string) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  if (m) return { name: m[1].trim() || null, address: m[2].trim().toLowerCase() };
  return { name: null, address: value.trim().toLowerCase() };
}
