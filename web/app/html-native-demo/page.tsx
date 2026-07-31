"use client"

import { HtmlMessageRenderer } from "@/components/threads/html-message-renderer"

const variants = [
  {
    name: "Elegant Glass Report",
    description:
      "Soft premium panel, subtle cyan glow, refined cards, and a warmer bottom-line finish.",
    html: buildDemoHtml("cc-html-variant-glass"),
  },
  {
    name: "Compact Command Brief",
    description:
      "Denser operational hierarchy with a status-strip feel and sharper command-center rhythm.",
    html: buildDemoHtml("cc-html-variant-command"),
  },
  {
    name: "Editorial Insight Card",
    description:
      "More spacious, editorial typography and softer section treatment without becoming a landing page.",
    html: buildDemoHtml("cc-html-variant-editorial"),
  },
]

function buildDemoHtml(variantClass: string) {
  return `
<section class="cc-html-reply ${variantClass}">
  <div class="cc-html-shell">
    <header class="cc-html-header">
      <div>
        <div class="cc-html-kicker">Linc Hermes · Capability Brief</div>
        <h2 class="cc-html-title">Ready for careful local operations</h2>
        <p class="cc-html-subtitle">A concise view of what I can inspect, draft, validate, and operate for LinkCrest while keeping approval gates intact.</p>
      </div>
      <div class="cc-html-pill-row">
        <span class="cc-html-pill">Read-only first</span>
        <span class="cc-html-pill">Approval-aware</span>
        <span class="cc-html-pill">Local runtime</span>
      </div>
    </header>

    <div class="cc-html-summary">
      I can help manage LinkCrest by reviewing files, explaining workflows, drafting safe payloads, and carrying out approved local app changes. I will not bypass auth, expose secrets, or perform state-changing operations without explicit approval.
    </div>

    <div class="cc-html-callout cc-html-callout-warning">
      <strong>Current limitation:</strong> live app reads need the app running with valid auth context. Until then, I can inspect code and prepare plans, but cannot confirm live data.
    </div>

    <div class="cc-html-grid">
      <article class="cc-html-card">
        <h3 class="cc-html-card-title">Inspect</h3>
        <div class="cc-html-card-body">
          <ul class="cc-html-list">
            <li>Review docs, schemas, routes, and UI flows.</li>
            <li>Explain approval gates and context-pack behavior.</li>
            <li>Run safe non-mutating diagnostics.</li>
          </ul>
        </div>
      </article>

      <article class="cc-html-card">
        <h3 class="cc-html-card-title">Draft</h3>
        <div class="cc-html-card-body">
          <ul class="cc-html-list">
            <li>Prepare campaign, content, target, and task payloads.</li>
            <li>Write concise action plans before execution.</li>
            <li>Format data changes for review.</li>
          </ul>
        </div>
      </article>

      <article class="cc-html-card">
        <h3 class="cc-html-card-title">Operate</h3>
        <div class="cc-html-card-body">
          <ul class="cc-html-list">
            <li>Create or update records after approval.</li>
            <li>Claim, complete, or fail tasks through workflows.</li>
            <li>Refresh context packs and append audit logs.</li>
          </ul>
        </div>
      </article>

      <article class="cc-html-card">
        <h3 class="cc-html-card-title">Boundaries</h3>
        <div class="cc-html-card-body">
          <ul class="cc-html-list">
            <li>No secret exposure or auth bypass.</li>
            <li>No scraping, auto-posting, or external account operation.</li>
            <li>No approval-gate weakening.</li>
          </ul>
        </div>
      </article>
    </div>

    <div class="cc-html-bottom-line">
      Bottom line: useful immediately for review, planning, and approved local operations, while keeping risky actions gated.
    </div>
  </div>
</section>
`
}

export default function HtmlNativeDemoPage() {
  return (
    <main className="min-h-screen bg-[var(--claw-bg-base)] px-6 py-8 text-[var(--claw-text-primary)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="rounded-[8px] border border-white/8 bg-[var(--claw-bg-surface)] px-4 py-3">
          <div className="claw-kicker text-[var(--claw-text-muted)]">
            Local fixture
          </div>
          <h1 className="mt-1 text-lg font-semibold">
            HTML/CSS Native visual directions
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--claw-text-muted)]">
            Three app-owned design presets using the same sanitizer-safe Linc
            Hermes content. No runtime call and no custom agent CSS.
          </p>
        </div>

        <div className="grid gap-5">
          {variants.map((variant) => (
            <section
              key={variant.name}
              className="rounded-[10px] border border-white/8 bg-black/10 p-4"
            >
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="claw-kicker text-[var(--claw-accent-blue)]">
                    Variant
                  </div>
                  <h2 className="mt-1 text-base font-semibold">
                    {variant.name}
                  </h2>
                </div>
                <p className="max-w-xl text-right text-xs leading-5 text-[var(--claw-text-muted)]">
                  {variant.description}
                </p>
              </div>
              <HtmlMessageRenderer html={variant.html} />
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
