import Image from "next/image";

// Placeholder until the Relay Console source repository is published.
const PUBLIC_REPOSITORY_URL_PLACEHOLDER =
  "https://github.com/insitektalay/relay-console";
const DOCUMENTATION_URL = `${PUBLIC_REPOSITORY_URL_PLACEHOLDER}/tree/main/docs`;
const SETUP_GUIDE_URL = `${PUBLIC_REPOSITORY_URL_PLACEHOLDER}/blob/main/docs/RUNTIME_SETUP.md`;
const LICENSE_URL = `${PUBLIC_REPOSITORY_URL_PLACEHOLDER}/blob/main/LICENSE`;

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[#060809] text-[#dcd8ca]">
      <section className="flex flex-1 items-center justify-center px-6 py-16 sm:py-20">
        <div className="flex w-full max-w-3xl flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <Image
              src="/images/relay-console-icon.png"
              alt=""
              width={973}
              height={993}
              priority
              className="size-11 object-contain sm:size-12"
            />
            <span className="text-xl font-semibold tracking-tight sm:text-2xl">
              Relay Console
            </span>
          </div>

          <p className="mt-8 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[0.65rem] font-semibold tracking-[0.22em] text-[#96999e]">
            EARLY ALPHA
          </p>

          <h1 className="mt-7 text-balance text-4xl font-semibold tracking-[-0.035em] text-[#ece9df] sm:text-6xl sm:leading-[1.08]">
            Open-source control for your AI agents
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-[#96999e] sm:text-lg sm:leading-8">
            A developer-focused workspace for running and managing Hermes and
            OpenClaw agents. Build the clients from source and deploy your own
            backend.
          </p>

          <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <a
              href={PUBLIC_REPOSITORY_URL_PLACEHOLDER}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#dcd8ca] px-5 text-sm font-semibold text-[#060809] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dcd8ca]"
            >
              View on GitHub
            </a>
            <a
              href={SETUP_GUIDE_URL}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 bg-white/[0.03] px-5 text-sm font-semibold text-[#dcd8ca] transition-colors hover:border-white/25 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dcd8ca]"
            >
              Setup Guide
            </a>
          </div>

          <p className="mt-8 text-xs tracking-wide text-[#777b80] sm:text-sm">
            MIT licensed · Self-hosted · Built for developers and tinkerers
          </p>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] px-6 py-6">
        <nav
          className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-[#777b80] sm:text-sm"
          aria-label="Footer"
        >
          <a className="transition-colors hover:text-[#dcd8ca]" href={DOCUMENTATION_URL}>
            Documentation
          </a>
          <a className="transition-colors hover:text-[#dcd8ca]" href="/security">
            Security
          </a>
          <a className="transition-colors hover:text-[#dcd8ca]" href="/privacy">
            Privacy
          </a>
          <a className="transition-colors hover:text-[#dcd8ca]" href={LICENSE_URL}>
            MIT License
          </a>
        </nav>
      </footer>
    </main>
  );
}
