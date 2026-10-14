"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Item = {
  key: string;
  name: string;
  state: "uploading" | "analyzing" | "done" | "duplicate" | "error";
  id?: string;
  error?: string;
};

const MAX_BYTES = 25 * 1024 * 1024;

export function Uploader({ userId }: { userId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);

  const patch = (key: string, p: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function uploadOne(file: File) {
    const key = crypto.randomUUID();
    setItems((list) => [{ key, name: file.name, state: "uploading" }, ...list]);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return patch(key, { state: "error", error: "Nur PDF-Dateien" });
    }
    if (file.size > MAX_BYTES) return patch(key, { state: "error", error: "Größer als 25 MB" });

    const path = `${userId}/${key}.pdf`;
    const { error } = await createClient()
      .storage.from("documents")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (error) return patch(key, { state: "error", error: error.message });

    patch(key, { state: "analyzing" });
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, filename: file.name }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; duplicate?: boolean; error?: string };
    if (!res.ok) return patch(key, { state: "error", error: json.error ?? "Fehler beim Verarbeiten" });
    patch(key, { state: json.duplicate ? "duplicate" : "done", id: json.id });
  }

  async function handle(files: FileList | File[]) {
    // nacheinander: schont das Gratis-Kontingent und hält die Reihenfolge
    for (const f of Array.from(files)) await uploadOne(f);
    router.refresh();
  }

  const label: Record<Item["state"], string> = {
    uploading: "Wird hochgeladen…",
    analyzing: "Text lesen und analysieren…",
    done: "Fertig",
    duplicate: "Schon vorhanden",
    error: "Fehler",
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        className={`cursor-pointer rounded-3xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          over ? "border-accent bg-accent-soft" : "border-line bg-surface/60 hover:border-glow"
        }`}
      >
        <p className="font-medium">PDFs hierher ziehen oder klicken</p>
        <p className="mt-1 text-sm text-muted">Rechnungen, Auftragsbestätigungen, Verträge · bis 25 MB je Datei</p>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => e.target.files && handle(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  i.state === "error" ? "bg-bad" : i.state === "done" || i.state === "duplicate" ? "bg-good" : "animate-pulse bg-warn"
                }`}
              />
              <span className="min-w-0 flex-1 truncate">{i.name}</span>
              <span className={i.state === "error" ? "text-bad" : "text-muted"}>{i.error ?? label[i.state]}</span>
              {i.id && (
                <Link href={`/documents/${i.id}`} className="font-medium text-accent">
                  Öffnen
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
