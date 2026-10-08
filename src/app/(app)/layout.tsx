import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { SearchBox } from "@/components/SearchBox";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/" aria-label="Igoudar Startseite">
            <Logo />
          </Link>
          <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <Suspense>
              <SearchBox />
            </Suspense>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink href="/">Übersicht</NavLink>
            <NavLink href="/documents">Dokumente</NavLink>
          </nav>
          <form action="/auth/signout" method="post" className="ml-auto sm:ml-0">
            <button className="text-sm text-muted hover:text-ink">Abmelden</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
