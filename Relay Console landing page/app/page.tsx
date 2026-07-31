import Image from "next/image";
import { Check } from "lucide-react";

const relayFeatures = [
  "Relay for Mac",
  "Access from the web, iPhone, and iPad",
  "Use Hermes Agent or OpenClaw",
  "Run your assistant on a Mac, PC, Mac mini, or VPS",
  "Keep your existing assistants and files",
  "Sync chats and managed agent files across devices",
] as const;

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <section id="top" className="mx-auto w-full max-w-7xl px-5 pb-14 pt-14 text-center sm:px-8 sm:pb-20 sm:pt-20">
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <Image
            src="/images/relay-console-icon.png"
            alt=""
            width={973}
            height={993}
            priority
            className="size-[clamp(5rem,9vw,7.5rem)] object-contain"
            style={{
              width: "clamp(5rem, 9vw, 7.5rem)",
              height: "clamp(5rem, 9vw, 7.5rem)",
            }}
          />
          <Image
            src="/images/relay-console-logo.png"
            alt="Relay Console"
            width={1507}
            height={502}
            priority
            className="mt-7 h-auto w-[min(82vw,34rem)] object-contain"
            style={{ width: "min(82vw, 34rem)", height: "auto" }}
          />
          <h1 className="mt-10 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Your AI assistants, wherever you are.
          </h1>
          <p className="mt-6 max-w-3xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
            Run Hermes or OpenClaw on a computer you control, then reach your assistants from your
            Mac, phone, tablet, and the web.
          </p>
        </div>
      </section>

      <section id="compare" className="mx-auto w-full max-w-7xl scroll-mt-6 px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--relay-cyan)]">
            One Relay subscription
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Use your assistants across all your devices
          </h2>
        </div>

        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--relay-panel)] shadow-2xl shadow-black/25">
          <div className="border-b border-[color:var(--border)] bg-[color:var(--relay-rail)] p-7 text-center sm:p-9">
            <div className="text-2xl font-semibold text-foreground">Relay</div>
            <div className="mt-5 flex items-end justify-center gap-2 text-foreground">
              <span className="text-5xl font-semibold tracking-tight">$9.99</span>
              <span className="pb-1 text-sm text-muted-foreground">per month</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              One subscription for Mac, web, iPhone, and iPad.
            </p>
          </div>
          <div className="grid gap-4 p-7 sm:grid-cols-2 sm:p-9">
            {relayFeatures.map((feature) => (
              <div key={feature} className="flex items-start gap-3 text-sm leading-6 text-foreground">
                <Check className="mt-1 size-5 shrink-0 text-[color:var(--relay-green)]" aria-hidden="true" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <p className="border-t border-[color:var(--border)] bg-[color:var(--relay-sidebar)] px-7 py-5 text-sm leading-6 text-muted-foreground sm:px-9">
            Your assistant is available while the computer running Hermes or OpenClaw is switched
            on, online, and connected to Relay. Relay does not include model usage or computer
            hosting.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--relay-sidebar)] p-7 sm:p-10">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--relay-green)]">
            No complicated move
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            Relay brings your assistants to the devices you already use.
            </h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl items-center gap-3 text-center sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--relay-panel)] px-5 py-6 font-semibold text-foreground">
              Your Hermes or OpenClaw assistant
            </div>
            <div className="text-2xl text-[color:var(--relay-blue)]" aria-hidden="true">↓</div>
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--relay-panel)] px-5 py-6 font-semibold text-foreground">
              Relay Console
            </div>
            <div className="text-2xl text-[color:var(--relay-blue)]" aria-hidden="true">↓</div>
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--relay-panel)] px-5 py-6 font-semibold text-foreground">
              Mac, iPhone, iPad and web
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-20 sm:px-8">
        <article className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--relay-panel)] p-7 sm:p-9">
          <p className="text-sm font-semibold text-[color:var(--relay-blue)]">You choose where it runs</p>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">Use a computer you already own or operate</h2>
          <p className="mt-4 max-w-4xl leading-7 text-muted-foreground">
            Run Hermes or OpenClaw on your usual Mac or PC. If you want continuous access, you can
            use an always-on Mac mini, server, or VPS. Relay connects your apps to that computer
            without moving your runtime or pretending an offline computer is available.
          </p>
        </article>
      </section>

      <footer className="border-t border-[color:var(--border)] bg-[color:var(--relay-rail)]/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-muted-foreground sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/relay-console-icon.png"
              alt=""
              width={973}
              height={993}
              className="size-7 object-contain"
            />
            <p>© 2026 Relay Console. All rights reserved.</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
            <a className="transition-colors hover:text-foreground" href="mailto:hello@relayconsole.work">Contact</a>
            <a className="transition-colors hover:text-foreground" href="/privacy">Privacy</a>
            <a className="transition-colors hover:text-foreground" href="/terms">Terms</a>
            <a className="transition-colors hover:text-foreground" href="/acceptable-use">Acceptable use</a>
            <a className="transition-colors hover:text-foreground" href="/security">Security</a>
            <a className="transition-colors hover:text-foreground" href="/data-deletion">Data deletion</a>
            <a className="transition-colors hover:text-foreground" href="/subprocessors">Subprocessors</a>
            <a className="transition-colors hover:text-foreground" href="/support">Support</a>
            <a className="transition-colors hover:text-foreground" href="/known-issues">Known issues</a>
            <a className="transition-colors hover:text-foreground" href="/third-party-notices">Notices</a>
            <a className="transition-colors hover:text-foreground" href="/status">Status</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
