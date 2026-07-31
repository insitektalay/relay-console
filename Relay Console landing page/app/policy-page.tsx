import Link from "next/link";
import type { ReactNode } from "react";

export function PolicyPage({
  title,
  description,
  eyebrow = "Public beta draft for review",
  updatedLabel = "Last updated: 20 July 2026",
  children,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  updatedLabel?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-12 sm:px-8">
      <Link className="text-sm text-[color:var(--relay-green)] hover:underline" href="/">
        Relay Console home
      </Link>
      <header className="mt-8 border-b border-[color:var(--border)] pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--relay-amber)]">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">{description}</p>
        <p className="mt-3 text-sm text-muted-foreground">{updatedLabel}</p>
      </header>
      <article className="policy-content py-8 text-sm leading-7 text-muted-foreground">
        {children}
      </article>
      <footer className="border-t border-[color:var(--border)] pt-6 text-sm text-muted-foreground">
        <nav className="flex flex-wrap gap-5" aria-label="Policy pages">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/acceptable-use">Acceptable use</Link>
          <Link href="/security">Security</Link>
          <Link href="/subprocessors">Subprocessors</Link>
          <Link href="/data-deletion">Data deletion</Link>
          <Link href="/support">Support</Link>
          <Link href="/known-issues">Known issues</Link>
          <Link href="/third-party-notices">Third-party notices</Link>
          <Link href="/status">Status</Link>
          <Link href="/updates">Updates</Link>
        </nav>
      </footer>
    </main>
  );
}
