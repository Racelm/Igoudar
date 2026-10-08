# Igoudar

Rechnungen, Verträge und gespeicherte Seiten an einem sicheren Ort.
Benannt nach den *Igoudar*, den Speicherburgen der Amazigh, in denen jede Familie ihre Vorräte und Urkunden verwahrte.

**Stack:** Next.js 15 (Vercel) · Supabase (PostgreSQL, Auth, Storage) · OpenAI GPT-4o-mini · unpdf

## Stand: Woche 1

| Funktion | Status |
| --- | --- |
| Login mit Google oder E-Mail-Link | fertig |
| PDF-Upload (Drag and drop, mehrere Dateien, Duplikaterkennung) | fertig |
| Text aus PDF lesen | fertig (Scans ohne Textebene: OCR folgt) |
| KI-Analyse: Typ, Anbieter, Datum, Betrag, Vertragsnummer, Kündigungsfrist | fertig |
| Felder korrigieren, neu analysieren, löschen | fertig |
| Universelle Suche mit Monats-/Jahres- und Typerkennung, Tippfehler-Toleranz | fertig |
| Datenbank für Postfächer, Regeln, Links, Verträge, Erinnerungen | angelegt, Oberfläche folgt |
| Gmail/Outlook-Anbindung, Browser-Erweiterung, Vertragsübersicht | Woche 2 |

## Einrichtung (ca. 15 Minuten)

### 1. Supabase

1. Neues Projekt anlegen, Region **Frankfurt (eu-central-1)**.
2. **SQL Editor** → Inhalt von `supabase/migrations/20261008000000_init.sql` einfügen → *Run*.
   Das legt alle Tabellen, die Zugriffsregeln, den privaten Bucket `documents` und die Suchfunktion an.
3. **Authentication → URL Configuration**
   - *Site URL*: deine Vercel-Adresse, z. B. `https://igoudar.vercel.app`
   - *Redirect URLs*: `https://igoudar.vercel.app/auth/callback` und `http://localhost:3000/auth/callback`
4. **Project Settings → API**: *Project URL* und den *anon/publishable key* notieren.
5. Optional **Authentication → Providers → Google** aktivieren (braucht einen OAuth-Client aus der Google Cloud Console).
   Ohne Google funktioniert die Anmeldung per E-Mail-Link sofort.

### 2. Vercel

1. *Add New → Project* → Repository `racelm/Igoudar` importieren.
2. Umgebungsvariablen eintragen:

   | Name | Wert |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL aus Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key |
   | `OPENAI_API_KEY` | Schlüssel von platform.openai.com (optional) |
   | `OPENAI_MODEL` | `gpt-4o-mini` |

3. *Deploy*. Danach baut Vercel bei jedem Push auf `main` automatisch neu.

### 3. Lokal (optional)

```bash
cp .env.example .env.local   # Werte eintragen
npm install
npm run dev                  # http://localhost:3000
npm test                     # Tests für den Suchparser
```

## Erfolgstest

1. Anmelden.
2. Unter **Dokumente** drei PDFs hochladen: eine Rechnung, eine Auftragsbestätigung, einen Vertrag.
3. Oben suchen: den Anbieter, „Rechnung März“, „Vertrag“, einen Begriff aus dem PDF-Text, einen Tippfehler.

## Aufbau

```
supabase/migrations/   Datenbankschema, Zugriffsregeln, Suchfunktion search_all()
src/middleware.ts      Session erneuern, nicht angemeldete Nutzer zu /login
src/app/login          Anmeldung
src/app/(app)/         Übersicht, Dokumente, Dokument-Detail, Suche
src/app/api/documents  Upload verarbeiten, korrigieren, löschen, neu analysieren
src/lib/pdf.ts         Text aus PDF
src/lib/analyze.ts     KI-Analyse mit festem JSON-Schema
src/lib/search-parse.ts  "Amazon Rechnung März" → Text + Filter
```

## Datenschutz

- Jede Tabelle und jede Datei ist per Row Level Security an den angemeldeten Nutzer gebunden.
- PDFs liegen in einem privaten Bucket; die Vorschau nutzt 10-Minuten-Links.
- OAuth-Tokens der Postfächer (Woche 2) liegen in einer eigenen Tabelle ohne Lesezugriff für Nutzer.
- An OpenAI gehen nur die ersten ~12.000 Zeichen eines Dokuments; die API speichert sie nicht zum Training.
