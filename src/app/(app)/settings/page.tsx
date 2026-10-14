import { createClient } from "@/lib/supabase/server";
import { features } from "@/lib/env";
import { SyncPanel, type AccountInfo } from "@/components/SyncPanel";
import { DisconnectButton, RulesEditor } from "@/components/AccountActions";
import { Bookmarklet } from "@/components/Bookmarklet";

export const metadata = { title: "Einstellungen" };

function Status({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rotate-45 ${ok ? "bg-good" : "bg-line"}`} aria-hidden />
      <span>
        <span className="block">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
    </li>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; reason?: string }>;
}) {
  const { gmail, reason } = await searchParams;
  const f = features();
  const supabase = await createClient();
  const [{ data: accounts }, { data: rules }, { count: pending }] = await Promise.all([
    supabase.from("email_accounts").select("id, address, status, last_synced_at, last_error").order("created_at"),
    supabase.from("capture_rules").select("id, sender_pattern, subject_pattern, action").order("created_at"),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const section = "rounded-3xl border border-line bg-surface/60 p-5 sm:p-6";

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium sm:text-3xl">Einstellungen</h1>

      {gmail === "error" && <p className="rounded-2xl bg-bad/15 px-4 py-3 text-sm text-bad">Gmail-Verbindung fehlgeschlagen: {reason}</p>}
      {gmail === "not_configured" && (
        <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm">
          Für Gmail fehlen noch Umgebungsvariablen: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET und TOKEN_ENCRYPTION_KEY. Anleitung im README.
        </p>
      )}

      <section className={section}>
        <h2 className="font-display text-lg font-medium">Postfächer</h2>
        <p className="mt-1 text-sm text-muted">Igoudar liest nur – es verschickt, löscht oder verschiebt keine Mails.</p>

        {(accounts?.length ?? 0) > 0 && (
          <ul className="mt-4 divide-y divide-line">
            {(accounts as AccountInfo[]).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{a.address}</span>
                  <span className={`block text-sm ${a.status === "reauth_required" || a.last_error ? "text-bad" : "text-muted"}`}>
                    {a.status === "reauth_required"
                      ? "Zugriff abgelaufen – neu verbinden"
                      : a.last_error ?? (a.last_synced_at ? `Zuletzt abgerufen ${new Date(a.last_synced_at).toLocaleString("de-DE")}` : "Noch nicht abgerufen")}
                  </span>
                </span>
                {a.status === "reauth_required" && (
                  <a href="/api/email/connect" className="text-sm text-accent">Neu verbinden</a>
                )}
                <DisconnectButton id={a.id} address={a.address} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-3">
          <SyncPanel accounts={(accounts ?? []) as AccountInfo[]} pending={pending ?? 0} gmailReady={f.gmail} />
          {(accounts?.length ?? 0) > 0 && f.gmail && (
            <a href="/api/email/connect" className="inline-block text-sm text-glow hover:text-ink">
              Weiteres Gmail-Konto verbinden
            </a>
          )}
        </div>
      </section>

      <section className={section}>
        <h2 className="font-display text-lg font-medium">Regeln für den Mail-Import</h2>
        <div className="mt-3">
          <RulesEditor rules={rules ?? []} />
        </div>
      </section>

      <section className={section}>
        <h2 className="font-display text-lg font-medium">Aus jedem Browser speichern</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Zieh den Knopf in die Lesezeichenleiste von Chrome oder Firefox. Auf einer Webseite anklicken – sie landet
          eingeordnet in deinen Links.
        </p>
        <div className="mt-4">
          <Bookmarklet />
        </div>
      </section>

      <section className={section}>
        <h2 className="font-display text-lg font-medium">Eingerichtete Funktionen</h2>
        <ul className="mt-2 divide-y divide-line">
          <Status ok={f.ai} label="KI-Analyse" hint={f.ai ? "Dokumente und Seiten werden automatisch eingeordnet" : "OPENAI_API_KEY fehlt – Einordnung nur nach festen Regeln"} />
          <Status ok={f.gmail} label="Gmail" hint={f.gmail ? "Bereit zum Verbinden" : "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY fehlen"} />
          <Status ok={f.webSearch} label="Websuche" hint={f.webSearch ? `Über ${f.webSearchProvider}` : "TAVILY_API_KEY oder OPENAI_API_KEY fehlt"} />
        </ul>
      </section>

      <form action="/auth/signout" method="post">
        <button className="text-sm text-muted hover:text-ink">Abmelden</button>
      </form>
    </div>
  );
}
