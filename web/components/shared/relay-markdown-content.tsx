import { useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import { Check, Copy } from "lucide-react"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { normalizeEscapedMarkdownForDisplay } from "@/lib/markdown-display"

export type MarkdownSection = {
  id: string
  title: string
  body: string
  markdown: string
}

export async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "")
  textarea.style.position = "absolute"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)

  try {
    textarea.select()
    const didCopy = document.execCommand("copy")

    if (!didCopy) {
      throw new Error("Legacy clipboard copy failed")
    }
  } finally {
    document.body.removeChild(textarea)
  }
}

export function slugifyMarkdownHeading(value: string) {
  return value
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function splitMarkdownSections(value: string): MarkdownSection[] {
  const normalized = value.replace(/\r\n/g, "\n").trim()

  if (!normalized) {
    return []
  }

  const lines = normalized.split("\n")
  const sections: MarkdownSection[] = []
  const preamble: string[] = []
  let current: {
    title: string
    headingLine: string
    lines: string[]
  } | null = null
  let inFence = false

  const pushCurrent = () => {
    if (!current) {
      return
    }

    const body = current.lines.join("\n").trim()
    const markdown = [current.headingLine, body].filter(Boolean).join("\n\n")

    sections.push({
      id:
        slugifyMarkdownHeading(current.title) ||
        `section-${sections.length + 1}`,
      title: current.title,
      body,
      markdown,
    })
    current = null
  }

  for (const line of lines) {
    if (/^(```|~~~)/.test(line.trim())) {
      inFence = !inFence
    }

    const headingMatch = !inFence ? /^(#{1,2})\s+(.+?)\s*$/.exec(line) : null

    if (headingMatch) {
      pushCurrent()
      current = {
        title: headingMatch[2].replace(/\s+#+\s*$/, "").trim(),
        headingLine: line.trim(),
        lines: [],
      }
      continue
    }

    if (current) {
      current.lines.push(line)
    } else {
      preamble.push(line)
    }
  }

  pushCurrent()

  const preambleMarkdown = preamble.join("\n").trim()

  if (preambleMarkdown) {
    sections.unshift({
      id: "overview",
      title: "Overview",
      body: preambleMarkdown,
      markdown: preambleMarkdown,
    })
  }

  return sections.length
    ? sections
    : [
        {
          id: "report",
          title: "Report",
          body: normalized,
          markdown: normalized,
        },
      ]
}

export function ReportCopyButton({
  value,
  label,
  successLabel,
}: {
  value: string
  label: string
  successLabel: string
}) {
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (!isCopied) {
      return
    }

    const timeoutId = window.setTimeout(() => setIsCopied(false), 1600)
    return () => window.clearTimeout(timeoutId)
  }, [isCopied])

  async function handleCopy() {
    try {
      await copyTextToClipboard(value)
      setIsCopied(true)
      toast.success(successLabel)
    } catch {
      toast.error("Could not copy this report section.")
    }
  }

  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      onClick={() => void handleCopy()}
    >
      {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {isCopied ? "Copied" : label}
    </Button>
  )
}

export function RenderMarkdownContent({ value }: { value: string }) {
  return (
    <div className="space-y-4 text-sm leading-7 text-zinc-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-zinc-50">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="pt-2 text-lg font-semibold tracking-[-0.02em] text-zinc-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-zinc-100">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-7 text-zinc-200">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-1.5 pl-5 text-zinc-200">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="space-y-1.5 pl-5 text-zinc-200">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="list-disc leading-7">{children}</li>
          ),
          code: ({ children }) => (
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-zinc-100">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-black/30 p-3 text-xs leading-6 text-zinc-200">
              {children}
            </pre>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-50">{children}</strong>
          ),
          a: ({ children, href }) => (
            <a
              className="text-cyan-300 underline underline-offset-4"
              href={href}
              rel="noreferrer"
              target="_blank"
            >
              {children}
            </a>
          ),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}

export function RenderAgentKnowledgeMarkdown({ value }: { value: string }) {
  const displayValue = useMemo(
    () => normalizeEscapedMarkdownForDisplay(value),
    [value]
  )

  return (
    <div className="claw-reading-body text-[var(--claw-text-primary)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="claw-reading-title mb-4 border-b border-[color-mix(in_srgb,var(--claw-border)_70%,transparent)] pb-3 text-zinc-50">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="claw-reading-heading mt-7 mb-3 border-b border-[color-mix(in_srgb,var(--claw-border)_55%,transparent)] pb-2 text-zinc-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-2 text-lg font-semibold text-zinc-100">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 leading-7 text-[var(--claw-text-primary)]">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-1.5 pl-6 text-[var(--claw-text-primary)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-1.5 pl-6 text-[var(--claw-text-primary)]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-[var(--claw-accent-blue)] pl-4 text-[var(--claw-text-secondary)]">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-5 border-[color-mix(in_srgb,var(--claw-border)_55%,transparent)]" />
          ),
          code: ({ children }) => (
            <code className="claw-reading-code rounded-[3px] bg-black/30 px-1.5 py-0.5 font-mono text-zinc-100">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="claw-reading-code my-4 overflow-x-auto rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-black/30 p-4 leading-6 text-zinc-200">
              {children}
            </pre>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-50">{children}</strong>
          ),
          a: ({ children, href }) => (
            <a
              className="text-[var(--claw-accent-blue)] underline underline-offset-4"
              href={href}
              rel="noreferrer"
              target="_blank"
            >
              {children}
            </a>
          ),
        }}
      >
        {displayValue}
      </ReactMarkdown>
    </div>
  )
}

export function MarkdownBlock({ value }: { value: string }) {
  const sections = useMemo(() => splitMarkdownSections(value), [value])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-4 py-3">
        <div>
          <div className="text-sm font-medium text-zinc-100">
            Markdown report
          </div>
          <div className="text-xs text-zinc-500">
            Copy the full report or copy individual sections.
          </div>
        </div>
        <ReportCopyButton
          value={value}
          label="Copy full report"
          successLabel="Report copied to clipboard"
        />
      </div>
      <div className="space-y-3">
        {sections.map((section) => (
          <div
            key={section.id}
            className="rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-4 py-3">
              <div className="text-sm font-medium text-zinc-100">
                {section.title}
              </div>
              <ReportCopyButton
                value={section.markdown}
                label="Copy section"
                successLabel={`Copied ${section.title}`}
              />
            </div>
            <div className="mission-scrollbar overflow-x-auto px-4 py-4">
              <RenderMarkdownContent value={section.body || section.markdown} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
