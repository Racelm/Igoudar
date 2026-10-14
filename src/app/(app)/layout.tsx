import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { CommandPalette } from "@/components/CommandPalette";
import { PaletteTrigger } from "@/components/PaletteTrigger";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/" aria-label="Igoudar Übersicht">
            <Logo />
          </Link>
          <nav className="order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto">
            <NavLink href="/">Übersicht</NavLink>
            <NavLink href="/documents">Dokumente</NavLink>
            <NavLink href="/links">Links</NavLink>
            <NavLink href="/settings">Einstellungen</NavLink>
          </nav>
          <div className="ml-auto w-48 sm:w-64">
            <PaletteTrigger />
          </div>
        </div>
        <div className="lozenge-band" aria-hidden />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <CommandPalette />
    </div>
  );
}
