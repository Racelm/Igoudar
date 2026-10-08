import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuery } from "./search-parse.ts";

const today = new Date("2026-10-08T12:00:00Z");

test("Amazon Rechnung März → Rechnungen von Amazon im März 2026", () => {
  const q = parseQuery("Amazon Rechnung März", today);
  assert.equal(q.text, "Amazon");
  assert.deepEqual(q.docTypes, ["invoice"]);
  assert.deepEqual(q.kinds, ["document"]);
  assert.equal(q.dateFrom, "2026-03-01");
  assert.equal(q.dateTo, "2026-03-31");
});

test("Monat in der Zukunft meint das Vorjahr", () => {
  const q = parseQuery("Rechnung Dezember", today);
  assert.equal(q.dateFrom, "2025-12-01");
  assert.equal(q.dateTo, "2025-12-31");
  assert.equal(q.text, "");
});

test("Vodafone Vertrag sucht Verträge und Dokumente", () => {
  const q = parseQuery("Vodafone Vertrag", today);
  assert.equal(q.text, "Vodafone");
  assert.deepEqual(q.kinds?.sort(), ["contract", "document"]);
  assert.equal(q.docTypes, null);
});

test("gespeicherte Seiten über Urlaub → nur Links", () => {
  const q = parseQuery("gespeicherte Seiten über Urlaub", today);
  assert.equal(q.text, "Urlaub");
  assert.deepEqual(q.kinds, ["link"]);
});

test("Jahr und Februar im Schaltjahr", () => {
  const q = parseQuery("Telekom Februar 2028", today);
  assert.equal(q.text, "Telekom");
  assert.equal(q.dateTo, "2028-02-29");
});

test("freier Text bleibt unverändert", () => {
  const q = parseQuery("Kopfhörer Bose", today);
  assert.equal(q.text, "Kopfhörer Bose");
  assert.equal(q.kinds, null);
  assert.equal(q.dateFrom, null);
});
