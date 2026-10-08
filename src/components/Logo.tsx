export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="7" fill="var(--accent)" />
        <path d="M7 26V12l9-6 9 6v14z" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M13 26v-6a3 3 0 0 1 6 0v6" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" />
        <path d="M11 14h2M15 14h2M19 14h2" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight">Igoudar</span>
    </span>
  );
}
