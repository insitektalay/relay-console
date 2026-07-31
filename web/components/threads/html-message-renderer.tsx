"use client"

import DOMPurify from "dompurify"
import { useEffect, useState } from "react"

export function HtmlMessageRenderer({
  html,
  attachedChrome = false,
}: {
  html: string
  attachedChrome?: boolean
}) {
  const [sanitizedHtml, setSanitizedHtml] = useState<string | null>(null)

  useEffect(() => {
    setSanitizedHtml(sanitizeHtmlReply(html))
  }, [html])

  if (sanitizedHtml === null) {
    return (
      <div
        className={`cc-html-reply-host ${
          attachedChrome ? "cc-html-reply-host-attached" : ""
        }`}
      >
        <style>{CLAWCHAT_HTML_REPLY_FALLBACK_CSS}</style>
      </div>
    )
  }

  if (!sanitizedHtml) {
    return (
      <pre className="whitespace-pre-wrap rounded-[4px] border border-red-400/20 bg-red-500/10 p-3 text-sm leading-5 text-red-50">
        {stripHtmlToPlainText(html) || "HTML response could not be rendered."}
      </pre>
    )
  }

  return (
    <div
      className={`cc-html-reply-host ${
        attachedChrome ? "cc-html-reply-host-attached" : ""
      }`}
    >
      <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      <style>{CLAWCHAT_HTML_REPLY_FALLBACK_CSS}</style>
    </div>
  )
}

const CLAWCHAT_HTML_REPLY_FALLBACK_CSS = `
.cc-html-reply-host {
  width: 100%;
  max-width: 100%;
  --cc-html-surface: color-mix(in srgb, var(--claw-bg-surface) 86%, #050b13);
  --cc-html-surface-2: color-mix(in srgb, var(--claw-bg-surface) 74%, #0b1421);
  --cc-html-border: color-mix(in srgb, var(--claw-border) 46%, transparent);
  --cc-html-border-soft: color-mix(in srgb, var(--claw-border) 26%, transparent);
  --cc-html-text: var(--claw-text-primary);
  --cc-html-muted: var(--claw-text-muted);
  --cc-html-blue: #79b8ff;
  --cc-html-cyan: #7dd3fc;
  --cc-html-green: #7ee6b1;
  --cc-html-amber: #f3c76b;
}
.cc-html-reply-host.cc-html-reply-host-attached .cc-html-shell,
.cc-html-reply-host.cc-html-reply-host-attached .cc-html-reply:not(:has(.cc-html-shell)) {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
.cc-html-reply-host.cc-html-reply-host-attached .cc-html-shell::before,
.cc-html-reply-host.cc-html-reply-host-attached .cc-html-reply:not(:has(.cc-html-shell))::before {
  opacity: 0.55;
}
.cc-html-reply-host .cc-html-reply {
  width: 100%;
  max-width: 100%;
  min-height: 0;
  color: var(--cc-html-text);
  font-family: var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: 0.9rem;
  line-height: 1.46;
  overflow: hidden;
}
.cc-html-reply-host .cc-html-shell,
.cc-html-reply-host .cc-html-reply:not(:has(.cc-html-shell)) {
  position: relative;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--cc-html-border);
  border-radius: 10px;
  background:
    radial-gradient(circle at 12% -12%, rgba(125, 211, 252, 0.13), transparent 30%),
    radial-gradient(circle at 96% 0%, rgba(96, 165, 250, 0.09), transparent 26%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.014)),
    var(--cc-html-surface);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.045),
    0 18px 44px rgba(0, 0, 0, 0.24);
  padding: 15px;
}
.cc-html-reply-host .cc-html-shell::before,
.cc-html-reply-host .cc-html-reply:not(:has(.cc-html-shell))::before {
  content: "";
  position: absolute;
  top: 0;
  right: 12px;
  left: 12px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(125, 211, 252, 0.55), transparent);
  opacity: 0.86;
}
.cc-html-reply-host .cc-html-reply,
.cc-html-reply-host .cc-html-reply * {
  box-sizing: border-box;
}
.cc-html-reply-host .cc-html-reply h1,
.cc-html-reply-host .cc-html-reply h2,
.cc-html-reply-host .cc-html-reply h3,
.cc-html-reply-host .cc-html-reply h4,
.cc-html-reply-host .cc-html-reply h5,
.cc-html-reply-host .cc-html-reply h6 {
  margin: 0;
  letter-spacing: 0;
}
.cc-html-reply-host .cc-html-reply p {
  margin: 0 0 6px;
}
.cc-html-reply-host .cc-html-reply p:last-child {
  margin-bottom: 0;
}
.cc-html-reply-host .cc-html-reply a {
  color: #9dd7ff;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.cc-html-reply-host .cc-html-reply code {
  border: 1px solid var(--cc-html-border-soft);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.22);
  padding: 1px 5px;
  color: #d8e7f2;
  font-size: 0.9em;
}
.cc-html-reply-host .cc-html-code {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--cc-html-border-soft);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.22);
  padding: 1px 5px;
  color: #d8e7f2;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.82em;
}
.cc-html-reply-host .cc-html-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--cc-html-border-soft);
  padding-bottom: 11px;
  margin-bottom: 11px;
}
.cc-html-reply-host .cc-html-title,
.cc-html-reply-host .cc-title {
  margin: 0;
  color: #f3f7fb;
  font-size: 1.05rem;
  font-weight: 740;
  line-height: 1.2;
}
.cc-html-reply-host .cc-html-subtitle,
.cc-html-reply-host .cc-subtitle {
  margin: 4px 0 0;
  max-width: 72ch;
  color: color-mix(in srgb, var(--cc-html-text) 76%, var(--cc-html-muted));
  font-size: 0.82rem;
  font-weight: 520;
  letter-spacing: 0;
}
.cc-html-reply-host .cc-html-kicker,
.cc-html-reply-host .cc-kicker {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  border: 1px solid rgba(125, 211, 252, 0.22);
  border-radius: 4px;
  background:
    linear-gradient(180deg, rgba(125, 211, 252, 0.12), rgba(59, 130, 246, 0.055));
  padding: 2px 6px;
  color: #c8e7ff;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.cc-html-reply-host .cc-html-summary,
.cc-html-reply-host .cc-summary {
  position: relative;
  border: 1px solid rgba(125, 211, 252, 0.18);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(125, 211, 252, 0.075), rgba(59, 130, 246, 0.035)),
    rgba(255, 255, 255, 0.018);
  padding: 10px 12px 10px 13px;
  margin: 10px 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
}
.cc-html-reply-host .cc-html-grid,
.cc-html-reply-host .cc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr));
  gap: 9px;
  margin: 10px 0;
}
.cc-html-reply-host .cc-html-card,
.cc-html-reply-host .cc-card,
.cc-html-reply-host .cc-section {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--cc-html-border-soft);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.016)),
    var(--cc-html-surface-2);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 8px 22px rgba(0, 0, 0, 0.14);
  padding: 11px 12px;
  margin: 0;
}
.cc-html-reply-host .cc-html-card::before,
.cc-html-reply-host .cc-card::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: linear-gradient(180deg, rgba(125, 211, 252, 0.6), rgba(96, 165, 250, 0.12));
}
.cc-html-reply-host .cc-html-card-title {
  margin: 0 0 7px;
  color: #edf5ff;
  font-size: 0.85rem;
  font-weight: 730;
  line-height: 1.25;
}
.cc-html-reply-host .cc-html-card-body {
  color: color-mix(in srgb, var(--cc-html-text) 86%, var(--cc-html-muted));
  font-size: 0.82rem;
}
.cc-html-reply-host .cc-html-callout,
.cc-html-reply-host .cc-callout,
.cc-html-reply-host .cc-callout-warning,
.cc-html-reply-host .cc-callout-success,
.cc-html-reply-host .cc-html-status,
.cc-html-reply-host .cc-status {
  border: 1px solid rgba(125, 211, 252, 0.24);
  border-left-width: 3px;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(125, 211, 252, 0.09), rgba(59, 130, 246, 0.04));
  padding: 9px 11px;
  margin: 10px 0;
  color: #dcecff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
}
.cc-html-reply-host .cc-html-callout-warning,
.cc-html-reply-host .cc-callout-warning {
  border-color: rgba(251, 191, 36, 0.34);
  background: linear-gradient(180deg, rgba(251, 191, 36, 0.11), rgba(251, 191, 36, 0.045));
  color: #f8e7bc;
}
.cc-html-reply-host .cc-html-callout-success,
.cc-html-reply-host .cc-callout-success {
  border-color: rgba(52, 211, 153, 0.3);
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.11), rgba(16, 185, 129, 0.045));
  color: #d7f7e8;
}
.cc-html-reply-host .cc-html-pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 8px 0 0;
}
.cc-html-reply-host .cc-html-pill,
.cc-html-reply-host .cc-pill,
.cc-html-reply-host .cc-status {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.065), rgba(255, 255, 255, 0.025));
  padding: 2px 7px;
  margin: 0;
  color: #d8e6f0;
  font-size: 0.7rem;
  font-weight: 650;
  line-height: 1.35;
}
.cc-html-reply-host .cc-html-bottom-line {
  border: 1px solid rgba(125, 211, 252, 0.16);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(125, 211, 252, 0.09), rgba(96, 165, 250, 0.035)),
    rgba(255, 255, 255, 0.018);
  margin-top: 10px;
  padding: 9px 11px;
  color: #dfeaf5;
  font-size: 0.84rem;
  font-weight: 650;
}
.cc-html-reply-host .cc-html-muted,
.cc-html-reply-host .cc-muted {
  color: var(--claw-text-muted);
}
.cc-html-reply-host .cc-html-list,
.cc-html-reply-host .cc-list,
.cc-html-reply-host .cc-html-reply ul,
.cc-html-reply-host .cc-html-reply ol {
  margin: 6px 0 0;
  padding-left: 16px;
}
.cc-html-reply-host .cc-html-reply li {
  margin: 3px 0;
  color: color-mix(in srgb, var(--claw-text-primary) 88%, var(--claw-text-muted));
}

/* Visual design presets used by the local fixture and future runtime contract. */
.cc-html-reply-host .cc-html-variant-glass {
  --cc-html-accent: #73d7ff;
  --cc-html-accent-2: #7c9cff;
  --cc-html-warm: #f7d58c;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-shell {
  border-color: rgba(132, 212, 255, 0.22);
  border-radius: 14px;
  background:
    radial-gradient(circle at 10% -15%, rgba(105, 213, 255, 0.22), transparent 34%),
    radial-gradient(circle at 92% 10%, rgba(124, 156, 255, 0.16), transparent 32%),
    linear-gradient(145deg, rgba(19, 34, 50, 0.96), rgba(9, 16, 26, 0.96) 54%, rgba(13, 25, 38, 0.96)),
    var(--cc-html-surface);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.09),
    inset 0 -1px 0 rgba(125, 211, 252, 0.05),
    0 22px 60px rgba(0, 0, 0, 0.34),
    0 0 42px rgba(64, 177, 255, 0.08);
  padding: 18px;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-shell::before {
  right: 18px;
  left: 18px;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(115, 215, 255, 0.95), rgba(124, 156, 255, 0.65), transparent);
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-header {
  border-bottom-color: rgba(156, 210, 255, 0.12);
  padding-bottom: 14px;
  margin-bottom: 14px;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-kicker {
  border: 0;
  background: linear-gradient(90deg, rgba(115, 215, 255, 0.18), rgba(124, 156, 255, 0.12));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  color: #dff6ff;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-title {
  margin-top: 7px;
  color: #f7fbff;
  font-size: 1.18rem;
  font-weight: 760;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-subtitle {
  max-width: 62ch;
  color: rgba(222, 237, 247, 0.74);
  font-size: 0.86rem;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-pill {
  border-color: rgba(143, 211, 255, 0.22);
  background: rgba(8, 20, 34, 0.46);
  color: #d9efff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-summary {
  border: 0;
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(115, 215, 255, 0.13), rgba(124, 156, 255, 0.06)),
    rgba(255, 255, 255, 0.035);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 12px 28px rgba(0, 0, 0, 0.14);
  padding: 13px 14px;
  color: rgba(239, 247, 255, 0.9);
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr));
  gap: 10px;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-card {
  border-color: rgba(142, 205, 255, 0.15);
  border-radius: 12px;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.025)),
    rgba(8, 18, 30, 0.62);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 14px 30px rgba(0, 0, 0, 0.2);
  padding: 14px 14px 13px;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-card::before {
  top: 10px;
  bottom: auto;
  left: 14px;
  width: 34px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, #73d7ff, rgba(124, 156, 255, 0.22));
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-card-title {
  padding-top: 8px;
  color: #f2f8ff;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-card-body .cc-html-list,
.cc-html-reply-host .cc-html-variant-command .cc-html-card-body .cc-html-list,
.cc-html-reply-host .cc-html-variant-editorial .cc-html-card-body .cc-html-list {
  list-style: none;
  padding-left: 0;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-card-body li,
.cc-html-reply-host .cc-html-variant-command .cc-html-card-body li,
.cc-html-reply-host .cc-html-variant-editorial .cc-html-card-body li {
  position: relative;
  padding-left: 13px;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-card-body li::before,
.cc-html-reply-host .cc-html-variant-command .cc-html-card-body li::before,
.cc-html-reply-host .cc-html-variant-editorial .cc-html-card-body li::before {
  content: "";
  position: absolute;
  top: 0.68em;
  left: 0;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.48;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-callout {
  border-color: rgba(247, 213, 140, 0.22);
  border-left: 0;
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(247, 213, 140, 0.13), rgba(115, 215, 255, 0.045)),
    rgba(255, 255, 255, 0.028);
  color: #f8ebc9;
}
.cc-html-reply-host .cc-html-variant-glass .cc-html-bottom-line {
  border: 0;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(115, 215, 255, 0.17), rgba(124, 156, 255, 0.09));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial),
.cc-html-reply-host .cc-html-variant-command {
  --cc-html-accent: #7dd3fc;
  --cc-html-command-green: #7ee6b1;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-shell,
.cc-html-reply-host .cc-html-variant-command .cc-html-shell {
  border-color: rgba(125, 211, 252, 0.2);
  border-radius: 9px;
  background:
    linear-gradient(90deg, rgba(125, 211, 252, 0.06) 1px, transparent 1px),
    linear-gradient(180deg, rgba(125, 211, 252, 0.045) 1px, transparent 1px),
    linear-gradient(145deg, #0e1722, #09111b 58%, #0b1822);
  background-size: 22px 22px, 22px 22px, auto;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 18px 42px rgba(0, 0, 0, 0.28);
  padding: 14px;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-shell::before,
.cc-html-reply-host .cc-html-variant-command .cc-html-shell::before {
  right: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, #7dd3fc, #7ee6b1 42%, rgba(125, 211, 252, 0.1));
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-header,
.cc-html-reply-host .cc-html-variant-command .cc-html-header {
  align-items: center;
  border-bottom-color: rgba(125, 211, 252, 0.14);
  padding: 2px 0 12px;
  margin-bottom: 11px;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-kicker,
.cc-html-reply-host .cc-html-variant-command .cc-html-kicker {
  border-color: rgba(126, 230, 177, 0.32);
  background: rgba(126, 230, 177, 0.1);
  color: #c8ffe5;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-title,
.cc-html-reply-host .cc-html-variant-command .cc-html-title {
  margin-top: 6px;
  color: #f4fbff;
  font-size: 1rem;
  text-transform: none;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-subtitle,
.cc-html-reply-host .cc-html-variant-command .cc-html-subtitle {
  color: rgba(218, 234, 244, 0.7);
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-pill,
.cc-html-reply-host .cc-html-variant-command .cc-html-pill {
  border-color: rgba(125, 211, 252, 0.18);
  background: rgba(4, 13, 22, 0.68);
  color: #dcefff;
  font-size: 0.68rem;
  text-transform: uppercase;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-summary,
.cc-html-reply-host .cc-html-variant-command .cc-html-summary {
  border-color: rgba(126, 230, 177, 0.2);
  border-radius: 7px;
  background: rgba(5, 18, 27, 0.78);
  box-shadow: inset 3px 0 0 rgba(126, 230, 177, 0.58);
  padding: 10px 12px 10px 14px;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-grid,
.cc-html-reply-host .cc-html-variant-command .cc-html-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr));
  gap: 8px;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-card,
.cc-html-reply-host .cc-html-variant-command .cc-html-card {
  border-color: rgba(125, 211, 252, 0.14);
  border-radius: 7px;
  background: rgba(8, 19, 30, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);
  padding: 10px 11px;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-card::before,
.cc-html-reply-host .cc-html-variant-command .cc-html-card::before {
  width: 100%;
  height: 1px;
  bottom: auto;
  background: linear-gradient(90deg, rgba(125, 211, 252, 0.62), transparent);
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-card-title,
.cc-html-reply-host .cc-html-variant-command .cc-html-card-title {
  color: #dff6ff;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-card-body,
.cc-html-reply-host .cc-html-variant-command .cc-html-card-body {
  font-size: 0.78rem;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-callout,
.cc-html-reply-host .cc-html-variant-command .cc-html-callout {
  border-color: rgba(247, 213, 140, 0.28);
  border-radius: 7px;
  background: rgba(44, 34, 14, 0.5);
  color: #f6dfad;
}
.cc-html-reply-host .cc-html-reply:not(.cc-html-variant-glass):not(.cc-html-variant-editorial) .cc-html-bottom-line,
.cc-html-reply-host .cc-html-variant-command .cc-html-bottom-line {
  border-color: rgba(126, 230, 177, 0.2);
  border-radius: 7px;
  background: linear-gradient(90deg, rgba(126, 230, 177, 0.13), rgba(125, 211, 252, 0.06));
  color: #dcfff0;
}

.cc-html-reply-host .cc-html-variant-editorial .cc-html-shell {
  border-color: rgba(211, 224, 235, 0.13);
  border-radius: 16px;
  background:
    radial-gradient(circle at 78% -18%, rgba(123, 182, 255, 0.16), transparent 38%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.018)),
    #0d1622;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 24px 64px rgba(0, 0, 0, 0.3);
  padding: 22px;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-shell::before {
  top: 16px;
  right: auto;
  left: 22px;
  width: 42px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, #f6d08c, #7dd3fc);
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-header {
  display: block;
  border-bottom: 0;
  padding: 10px 0 4px;
  margin-bottom: 12px;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-kicker {
  border: 0;
  background: transparent;
  padding: 0;
  color: #f1cf92;
  font-size: 0.66rem;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-title {
  margin-top: 8px;
  max-width: 17ch;
  color: #f8fbff;
  font-size: 1.34rem;
  font-weight: 780;
  line-height: 1.08;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-subtitle {
  margin-top: 8px;
  max-width: 58ch;
  color: rgba(224, 235, 245, 0.72);
  font-size: 0.9rem;
  line-height: 1.5;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-pill-row {
  margin-top: 13px;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-pill {
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.065);
  color: rgba(235, 244, 252, 0.82);
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-summary {
  border: 0;
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.085), rgba(125, 211, 252, 0.04)),
    rgba(255, 255, 255, 0.025);
  padding: 14px 15px;
  color: rgba(243, 248, 252, 0.92);
  font-size: 0.9rem;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
  gap: 11px;
  margin-top: 12px;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-card {
  border: 0;
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.028)),
    rgba(255, 255, 255, 0.018);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 10px 24px rgba(0, 0, 0, 0.16);
  padding: 15px;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-card::before {
  display: none;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-card-title {
  color: #f8fbff;
  font-size: 0.92rem;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-card-body {
  color: rgba(222, 233, 242, 0.78);
  font-size: 0.84rem;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-callout {
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(246, 208, 140, 0.14), rgba(125, 211, 252, 0.055));
  color: #f7e8ca;
}
.cc-html-reply-host .cc-html-variant-editorial .cc-html-bottom-line {
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.075);
  color: rgba(241, 248, 255, 0.9);
  padding: 10px 14px;
}
`

function sanitizeHtmlReply(rawHtml: string) {
  if (!rawHtml.trim()) return ""
  const scopedHtml = sanitizeScopedStyleBlocks(rawHtml)
  const purified = DOMPurify.sanitize(scopedHtml, {
    ALLOWED_TAGS: [
      "style",
      "section",
      "article",
      "aside",
      "header",
      "footer",
      "main",
      "div",
      "span",
      "p",
      "br",
      "hr",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "dl",
      "dt",
      "dd",
      "strong",
      "em",
      "b",
      "i",
      "small",
      "code",
      "pre",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
    ],
    ALLOWED_ATTR: [
      "class",
      "href",
      "title",
      "target",
      "rel",
      "role",
      "aria-label",
      "scope",
      "colspan",
      "rowspan",
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: [
      "script",
      "iframe",
      "form",
      "input",
      "button",
      "object",
      "embed",
      "link",
      "meta",
      "img",
      "svg",
      "math",
    ],
    FORBID_ATTR: ["style", "src", "srcset", "onerror", "onclick", "onload"],
  }).trim()

  if (!/^<section\b[^>]*class=["'][^"']*\bcc-html-reply\b/i.test(purified)) {
    return ""
  }

  return purified
}

function sanitizeScopedStyleBlocks(html: string) {
  let styleBlockCount = 0
  return html.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_match, css: string) => {
      styleBlockCount += 1
      if (styleBlockCount > 1) return ""
      const nextCss = sanitizeScopedCss(css)
      return nextCss ? `<style>${nextCss}</style>` : ""
    }
  )
}

function sanitizeScopedCss(css: string) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "").trim()
  if (!withoutComments) return ""

  const safeRules: string[] = []
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = rulePattern.exec(withoutComments))) {
    const selectorText = match[1].trim()
    const body = match[2].trim()
    if (!selectorText || !body) continue
    if (/@/i.test(selectorText)) continue
    if (!areSelectorsScoped(selectorText)) continue
    const safeBody = body
      .split(";")
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration && isSafeCssDeclaration(declaration))
      .join("; ")
    if (!safeBody) continue
    safeRules.push(`${selectorText} { ${safeBody}; }`)
  }

  return safeRules.join("\n")
}

function areSelectorsScoped(selectorText: string) {
  return selectorText
    .split(",")
    .map((selector) => selector.trim())
    .every((selector) => {
      if (!selector) return false
      if (
        /(^|[\s>+~,])(?:body|html|:root)(?=$|[\s>+~.#:[\]])/i.test(selector)
      ) {
        return false
      }
      if (/\*/.test(selector)) return false
      return /^\.cc-html-reply(?:$|[\s>+~.:#[\]])/.test(selector)
    })
}

function isSafeCssDeclaration(declaration: string) {
  if (!/^[a-z-]+\s*:/i.test(declaration)) return false
  const [rawProperty, ...rawValueParts] = declaration.split(":")
  const property = rawProperty.trim().toLowerCase()
  const value = rawValueParts.join(":").trim().toLowerCase()
  if (
    /javascript:|expression\s*\(|behavior\s*:|url\s*\(|@import/i.test(
      declaration
    )
  ) {
    return false
  }
  if (property === "position" && value.includes("fixed")) return false
  if (property === "z-index") return false
  if (property.startsWith("animation")) return false
  if (property === "transition" || property.startsWith("transition-")) {
    return false
  }
  return true
}

function stripHtmlToPlainText(value: string) {
  return value
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}
