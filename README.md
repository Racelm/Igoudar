# Igoudar

Rechnungen, Verträge und gespeicherte Seiten an einem sicheren Ort.
Benannt nach den *Igoudar*, den Speicherburgen der Amazigh, in denen jede Familie ihre Vorräte und Urkunden verwahrte.

**Stack:** Next.js 15 (Test: Vercel, dauerhaft: Hostinger Node.js Web App) · Supabase (PostgreSQL, Auth, Storage) · OpenAI · Tavily · Gmail API

## Was die App kann

| Funktion | Status |
| --- | --- |
| Login mit Google oder E-Mail-Link | fertig |
| PDF-Upload (Drag and drop, mehrere Dateien, Duplikaterkennung) | fertig |
| **Gmail mit einem Klick:** beim Google-Login gleich mit verbunden, PDFs kommen automatisch; Regeln (ignorieren / nur bestimmte Absender) | fertig |
| KI liest jedes PDF: Typ, Anbieter, Datum, Betrag, Vertragsnummer, Kündigungsfrist (nutzt auch den Mail-Betreff) | fertig |
| **Websuche in der App** und Speichern mit einem Klick | fertig |
| **Intelligentes Speichern:** Seite wird gelesen, KI vergibt Kategorie, Schlagwörter, Kurzbeschreibung, Vorschaubild | fertig |
| Lesezeichen-Knopf „In Igoudar speichern“ für Chrome, Firefox, Safari, Edge | fertig |
| Befehlspalette (Strg K / ⌘K): Live-Suche über alles, Webadresse einfügen = speichern, Websuche starten | fertig |
| Universelle Suche: PDF-Text, Mail-Betreff, Seitentext, Notizen; „März“, „2025“, „Rechnung“ werden als Filter erkannt; Tippfehler-Toleranz | fertig |
| Scans ohne Textebene (OCR), Outlook, Vertragsübersicht mit Erinnerungen | als Nächstes |

## Einrichtung

### 1. Supabase

1. Projekt anlegen, Region **Frankfurt (eu-central-1)**.
2. **SQL Editor** → nacheinander ausführen (jeweils „New query“, Inhalt einfügen, *Run*):
   1. `supabase/migrations/20261008000000_init.sql`
   2. `supabase/migrations/20261015000000_smart.sql`
3. **Authentication → URL Configuration**
   - *Site URL*: Adresse deiner App, z. B. `https://igoudar-xyz.vercel.app`
   - *Redirect URLs*: `https://igoudar-xyz.vercel.app/auth/callback` und `http://localhost:3000/auth/callback`
4. **Project Settings → API**: *Project URL* und *anon/publishable key* notieren.

### 2. Google-Login mit Gmail (einmalig, ca. 10 Minuten)

Für Nutzer ist es ein Klick: **Mit Google anmelden** → Google fragt, ob Igoudar Gmail lesen darf → die PDFs kommen automatisch.
Dafür brauchst du einmalig einen Google-Zugang, den Supabase und die App gemeinsam nutzen.

1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt „Igoudar“.
2. **APIs & Dienste → Bibliothek** → „Gmail API“ → *Aktivieren*.
3. **Google Auth Platform / OAuth-Zustimmungsbildschirm:**
   - Nutzertyp **Extern**, App-Name „Igoudar“, deine E-Mail als Support-Adresse.
   - **Datenzugriff:** `openid`, `.../auth/userinfo.email` und `.../auth/gmail.readonly` hinzufügen.
   - **Zielgruppe → Testnutzer:** deine Gmail-Adresse(n) eintragen. Status bleibt **Testen**.
4. **Clients / Anmeldedaten → OAuth-Client-ID erstellen** → Typ **Webanwendung**.
   *Autorisierte Weiterleitungs-URI:* die Callback-URL aus Supabase
   (*Authentication → Sign In / Providers → Google*, sieht aus wie `https://xxxx.supabase.co/auth/v1/callback`).
5. *Client-ID* und *Clientschlüssel* in **Supabase → Authentication → Providers → Google** eintragen und Google aktivieren.
6. **Dieselben zwei Werte** auch als `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` in die App (Schritt 3) – damit erneuert Igoudar den Gmail-Zugang selbst.

> Im Testmodus läuft der Gmail-Zugang nach **7 Tagen** ab. Igoudar zeigt dann „Neu verbinden“ – ein Klick.
> Vor dem Verkauf: App bei Google veröffentlichen und den Gmail-Zugriff prüfen lassen, dann entfällt der Ablauf.

*Optional – mehrere Gmail-Adressen pro Nutzer:* zusätzlich `https://<deine-app>/api/email/callback` als Weiterleitungs-URI eintragen.
Dann erscheint in den Einstellungen „Weiteres Gmail-Konto mit anderer Adresse verbinden“.

### 3. Umgebungsvariablen

| Name | Wert | Pflicht |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL aus Supabase | ja |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key | ja |
| `OPENAI_API_KEY` | platform.openai.com → API keys | empfohlen |
| `OPENAI_MODEL` | `gpt-4o-mini` | |
| `TAVILY_API_KEY` | tavily.com, 1.000 Suchen/Monat gratis. Ohne: Websuche über OpenAI | optional |
| `GOOGLE_CLIENT_ID` | aus Schritt 2 (dieselbe wie in Supabase) | für Gmail |
| `GOOGLE_CLIENT_SECRET` | aus Schritt 2 (derselbe wie in Supabase) | für Gmail |
| `TOKEN_ENCRYPTION_KEY` | Zufallszeichenkette, mind. 32 Zeichen – z. B. ein langes Passwort aus deinem Passwortmanager oder `openssl rand -base64 32`. Später nicht mehr ändern. | für Gmail |

Unter **Einstellungen** in der App siehst du, welche Funktionen eingerichtet sind.

### 4a. Zum Testen: Vercel (gratis)

1. vercel.com → *Add New → Project* → `Racelm/Igoudar` importieren.
2. Umgebungsvariablen aus der Tabelle eintragen → *Deploy*.
3. Die Vercel-Adresse in Supabase eintragen (Schritt 1.3).
4. Nach jeder Änderung an Variablen: *Deployments → Redeploy*.

### 4b. Dauerhaft: Hostinger

Voraussetzung: **Business Web Hosting** oder ein **Cloud-Tarif** (Single und Premium können keine Node.js-Apps).

1. hPanel → **Websites → Website hinzufügen → Node.js web app** → **Import Git repository** → `Racelm/Igoudar`.
2. Framework Next.js, Branch `main`, Node.js **22**, Build-Befehl `npm run build`, Output `.next`.
3. Dieselben Umgebungsvariablen eintragen → *Deploy*.
4. Domain verbinden und die neue Adresse in Supabase eintragen.

### 5. Lokal (optional)

```bash
cp .env.example .env.local   # Werte eintragen
npm install
npm run dev                  # http://localhost:3000
npm test                     # Tests: Suchparser, Mail-Regeln, Seitenauswertung, URL-Schutz
```

## Testablauf

1. Anmelden.
2. **Mit Google anmelden** (Häkchen „PDF-Rechnungen aus Gmail automatisch holen“ bleibt an) → bei Google erlauben. Die PDFs der letzten 12 Monate werden geholt und analysiert.
3. **Links** → z. B. „Riad Marrakesch Dachterrasse“ suchen → zwei Ergebnisse speichern. Kategorie und Schlagwörter erscheinen automatisch.
4. **Einstellungen** → den Knopf „In Igoudar speichern“ in die Lesezeichenleiste ziehen, auf einer beliebigen Seite anklicken.
5. **Strg K** → „Amazon Rechnung März“, „Vertrag“, „Urlaub“ – alles kommt aus einer Suche.

## Aufbau

```
supabase/migrations/          Schema, Zugriffsregeln, Suchfunktion search_all()
src/app/(app)/                Übersicht, Dokumente, Links, Einstellungen, Suche, Speichern
src/app/api/email/            Gmail verbinden, Rückkehr von Google, Abruf, Trennen
src/app/api/links/            Seite speichern, bearbeiten, löschen
src/app/api/web-search/       Websuche (Tavily oder OpenAI)
src/lib/email-sync.ts         Mails mit PDF lesen, Regeln anwenden, PDFs ablegen
src/lib/save-link.ts          Seite lesen und durch die KI einordnen
src/lib/safe-fetch.ts         Fremde Seiten abrufen ohne Zugriff auf interne Adressen
src/components/CommandPalette.tsx  Strg K
```

## Datenschutz

- Jede Tabelle und jede Datei ist per Row Level Security an den angemeldeten Nutzer gebunden.
- Gmail: nur Lesezugriff. Zugangs-Tokens sind mit AES-256-GCM verschlüsselt; der Schlüssel liegt nur auf dem Server.
- Gespeichert werden PDF-Anhänge und Absender/Betreff – keine Mail-Texte.
- PDFs liegen in einem privaten Bucket; die Vorschau nutzt 10-Minuten-Links.
- An OpenAI gehen nur Auszüge (PDF: ~12.000 Zeichen, Webseite: ~3.500 Zeichen); die API nutzt sie nicht zum Training.
