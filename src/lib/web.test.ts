import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHtml, decodeEntities } from "./html.ts";
import { normalizeUrl, isPrivateAddress } from "./safe-fetch.ts";
import { categorizeByRules } from "./categorize.ts";

test("HTML: Meta-Daten und Text", () => {
  const html = `<!doctype html><html lang="de"><head>
    <title>Riad Anika – Marrakesch | Booking.com</title>
    <meta property="og:title" content="Riad Anika &amp; Spa">
    <meta content="Dachterrasse mit Blick" name="description">
    <meta property='og:image' content='/img/riad.jpg'>
    <meta property="og:site_name" content="Booking.com">
    <link rel="shortcut icon" href="/favicon.ico">
    <script>var x = "<p>nicht anzeigen</p>";</script>
  </head><body><nav>Menü</nav><h1>Willkommen</h1><p>Frühstück&nbsp;inklusive &#8211; Pool</p></body></html>`;
  const p = parseHtml(html, "https://www.booking.com/hotel/ma/anika.html");
  assert.equal(p.title, "Riad Anika & Spa");
  assert.equal(p.description, "Dachterrasse mit Blick");
  assert.equal(p.image, "https://www.booking.com/img/riad.jpg");
  assert.equal(p.icon, "https://www.booking.com/favicon.ico");
  assert.equal(p.siteName, "Booking.com");
  assert.equal(p.lang, "de");
  assert.match(p.text, /Frühstück inklusive – Pool/);
  assert.doesNotMatch(p.text, /nicht anzeigen|Menü/);
});

test("Entities", () => {
  assert.equal(decodeEntities("M&uuml;ller &#x26; S&ouml;hne"), "Müller & Söhne");
});

test("URL normalisieren", () => {
  assert.equal(normalizeUrl("amazon.de/dp/123#x")?.toString(), "https://amazon.de/dp/123");
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("http://user:pw@site.de"), null);
  assert.equal(normalizeUrl("intranet"), null);
});

test("interne Adressen erkennen", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.1.1", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1", "0.0.0.0"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "142.250.185.78", "2a00:1450:4001:82b::200e"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("Kategorie ohne KI", () => {
  assert.equal(categorizeByRules("https://www.amazon.de/dp/B0", null).category, "Shopping");
  assert.equal(categorizeByRules("https://www.booking.com/x", null).category, "Reise");
  assert.equal(categorizeByRules("https://www.service-public.fr/", null).category, "Behörden");
  assert.equal(categorizeByRules("https://example.org/", "Irgendwas").category, "Sonstiges");
});
