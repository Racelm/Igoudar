import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldImport, type CaptureRule } from "./rules.ts";
import { parseFrom, pdfParts } from "./gmail.ts";

const rule = (p: Partial<CaptureRule>): CaptureRule => ({
  sender_pattern: null,
  subject_pattern: null,
  action: "save",
  is_active: true,
  ...p,
});

test("ohne Regeln wird alles übernommen", () => {
  assert.equal(shouldImport([], "x@y.de", "Hallo"), true);
});

test("ignore schließt aus", () => {
  const r = [rule({ sender_pattern: "newsletter", action: "ignore" })];
  assert.equal(shouldImport(r, "Shop <newsletter@shop.de>", "Angebote"), false);
  assert.equal(shouldImport(r, "rechnung@shop.de", "Rechnung"), true);
});

test("save-Regeln machen eine Positivliste", () => {
  const r = [rule({ sender_pattern: "amazon" })];
  assert.equal(shouldImport(r, "Amazon.de <auto-confirm@amazon.de>", "Ihre Bestellung"), true);
  assert.equal(shouldImport(r, "info@otto.de", "Rechnung"), false);
});

test("ignore gewinnt gegen save", () => {
  const r = [rule({ sender_pattern: "amazon" }), rule({ subject_pattern: "werbung", action: "ignore" })];
  assert.equal(shouldImport(r, "x@amazon.de", "Werbung für Kindle"), false);
});

test("inaktive Regeln zählen nicht", () => {
  const r = [rule({ sender_pattern: "amazon", is_active: false })];
  assert.equal(shouldImport(r, "info@otto.de", "Rechnung"), true);
});

test("Absender zerlegen", () => {
  assert.deepEqual(parseFrom('"Vodafone GmbH" <Rechnung@Vodafone.de>'), { name: "Vodafone GmbH", address: "rechnung@vodafone.de" });
  assert.deepEqual(parseFrom("info@x.de"), { name: null, address: "info@x.de" });
});

test("PDF-Anhänge in verschachtelten Teilen finden", () => {
  const parts = pdfParts({
    mimeType: "multipart/mixed",
    parts: [
      { mimeType: "text/html", body: { size: 10 } },
      { mimeType: "multipart/alternative", parts: [{ mimeType: "application/pdf", filename: "Rechnung.pdf", body: { attachmentId: "a1", size: 5 } }] },
      { mimeType: "application/octet-stream", filename: "AGB.PDF", body: { attachmentId: "a2", size: 5 } },
      { mimeType: "image/png", filename: "logo.png", body: { attachmentId: "a3", size: 5 } },
    ],
  });
  assert.deepEqual(parts.map((p) => p.body?.attachmentId), ["a1", "a2"]);
});
