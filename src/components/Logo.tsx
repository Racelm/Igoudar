// Zeichen: eine Speicherburg aus drei Kammerreihen, als Raute gefasst.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <path d="M16 2 L30 16 L16 30 L2 16 Z" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
        <path d="M16 7 L25 16 L16 25 L7 16 Z" fill="var(--glow-soft)" stroke="var(--glow)" strokeWidth="1.2" />
        <path d="M12 14h8M11 17h10M13 20h6" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[17px] font-medium tracking-[0.02em]">igoudar</span>
    </span>
  );
}
