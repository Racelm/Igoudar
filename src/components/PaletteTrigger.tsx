"use client";

import { openPalette } from "./CommandPalette";

export function PaletteTrigger() {
  return (
    <button
      onClick={() => openPalette()}
      className="flex w-full items-center gap-3 rounded-full border border-line bg-surface/70 px-4 py-2 text-left text-sm text-muted hover:border-glow hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" aria-hidden>
        <path d="M12 3 L21 12 L12 21 L3 12 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <span className="flex-1">Suchen oder speichern</span>
      <kbd className="hidden rounded-md border border-line px-1.5 text-xs sm:block">Strg K</kbd>
    </button>
  );
}

// Das große Suchfeld auf der Übersicht
export function OracleTrigger() {
  return (
    <button
      onClick={() => openPalette()}
      className="oracle oracle-pulse flex w-full items-center gap-4 px-6 py-5 text-left sm:px-8 sm:py-6"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-accent" aria-hidden>
        <path d="M12 2 L22 12 L12 22 L2 12 Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7 L17 12 L12 17 L7 12 Z" fill="var(--glow-soft)" stroke="var(--glow)" strokeWidth="1.2" />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block text-lg text-ink sm:text-xl">Was suchst du?</span>
        <span className="block truncate text-sm text-muted">„Vodafone Vertrag“, „Amazon Rechnung März“, eine Webadresse oder etwas fürs Web</span>
      </span>
      <kbd className="hidden rounded-md border border-line px-2 py-1 text-xs text-muted sm:block">Strg K</kbd>
    </button>
  );
}
