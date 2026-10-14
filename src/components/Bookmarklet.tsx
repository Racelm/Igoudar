"use client";

import { useEffect, useRef } from "react";

// Lesezeichen-Knopf für jeden Browser (Chrome, Firefox, Safari, Edge):
// in die Lesezeichenleiste ziehen, auf einer Seite anklicken → in Igoudar gespeichert.
export function Bookmarklet() {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const origin = window.location.origin;
    const code =
      "javascript:(()=>{window.open('" +
      origin +
      "/save?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'igoudar','width=460,height=620')})()";
    // React blockiert javascript:-Links im JSX, daher direkt am Element setzen
    ref.current?.setAttribute("href", code);
  }, []);

  return (
    <a
      ref={ref}
      href="#"
      onClick={(e) => {
        e.preventDefault();
        alert("Zieh diesen Knopf in deine Lesezeichenleiste. Auf einer Webseite anklicken – fertig.");
      }}
      className="inline-flex cursor-grab items-center gap-2 rounded-full border border-dashed border-accent px-4 py-2 text-sm text-accent active:cursor-grabbing"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path d="M12 3 L21 12 L12 21 L3 12 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      In Igoudar speichern
    </a>
  );
}
