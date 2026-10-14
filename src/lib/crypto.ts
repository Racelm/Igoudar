import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM. Der Schlüssel wird aus TOKEN_ENCRYPTION_KEY (beliebig lange Zufallszeichenkette) abgeleitet.
function key() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY ?? "";
  if (secret.length < 16) throw new Error("TOKEN_ENCRYPTION_KEY fehlt oder ist kürzer als 16 Zeichen");
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(token: string): string {
  const [iv, tag, data] = token.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !data) throw new Error("Ungültiger verschlüsselter Wert");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
