"use client"

import {
  getMessageDocumentReferences,
  type DocumentReference,
  type Message,
} from "@clawchat/contracts"
import { memo, useEffect, useRef, useState, type ReactNode } from "react"
import { format } from "date-fns"
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Files,
  FileText,
  Globe,
  LockKeyhole,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DepartmentAvatarBadge } from "@/components/shared/department-avatar-badge"
import { HtmlMessageRenderer } from "@/components/threads/html-message-renderer"
import type { ParticipantMessageStyle } from "@/lib/participant-message-style"

export type AgentCardTone = ParticipantMessageStyle

export const MessageBubble = memo(function MessageBubble({
  message,
  senderName,
  initials,
  agentTone,
  resolvedAvatarUrl,
  departmentColor,
  runtimeLabel,
  isManager = false,
  onCopyFromMessage,
}: {
  message: Message
  senderName?: string
  initials: (value: string) => string
  agentTone?: AgentCardTone
  resolvedAvatarUrl?: string
  departmentColor?: string | null
  runtimeLabel?: string | null
  isManager?: boolean
  onCopyFromMessage?: (message: Message) => Promise<void> | void
}) {
  const resolvedSenderName = senderName ?? message.senderName
  const isUser = message.isFromUser
  const isHtmlMessage = message.contentFormat === "html"
  const isHtmlAgentMessage = isHtmlMessage && !isUser
  const localSendState =
    typeof message.metadata?.localSendState === "string"
      ? message.metadata.localSendState
      : null
  const localErrorMessage =
    typeof message.metadata?.localErrorMessage === "string"
      ? message.metadata.localErrorMessage
      : null
  const isFailedLocalSend = isUser && localSendState === "failed"
  const tone = agentTone
  const containerStyle = isFailedLocalSend
    ? {
        borderColor: "rgba(248, 113, 113, 0.34)",
        backgroundColor: "rgba(127, 29, 29, 0.18)",
      }
    : isHtmlAgentMessage
      ? {
          borderColor: "transparent",
          backgroundColor: "transparent",
          ["--message-accent" as string]: tone?.accent,
        }
    : tone
      ? {
          borderColor: tone.border,
          backgroundColor: tone.background,
          ["--message-accent" as string]: tone.accent,
        }
      : undefined
  const roleLabel = isUser ? "You" : (runtimeLabel ?? "Operator")
  const avatarBorderStyle = tone ? { borderColor: tone.border } : undefined
  const avatarFallbackStyle = tone
    ? { backgroundColor: tone.avatar, color: tone.label }
    : undefined
  const documentReferences = isUser
    ? []
    : getMessageDocumentReferences(message.metadata)
  const [isCopied, setIsCopied] = useState(false)
  const [isThreadTailCopied, setIsThreadTailCopied] = useState(false)
  const [isLongMessage, setIsLongMessage] = useState(false)
  const messageTopRef = useRef<HTMLDivElement | null>(null)
  const messageBottomRef = useRef<HTMLDivElement | null>(null)
  const messageContentRef = useRef<HTMLDivElement | null>(null)
  const actionControls = (
    <div
      className={`flex items-center gap-1 ${isUser ? "mr-[-24px]" : ""}`}
    >
      {onCopyFromMessage ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-[var(--claw-text-muted)] hover:bg-white/[0.05] hover:text-[var(--claw-text-primary)]"
          aria-label={
            isThreadTailCopied
              ? "Copied thread from this message"
              : "Copy thread from this message"
          }
          title={
            isThreadTailCopied
              ? "Copied thread from here"
              : "Copy thread from here"
          }
          onClick={() => void copyThreadFromMessage()}
        >
          {isThreadTailCopied ? (
            <Check className="size-4" />
          ) : (
            <Files className="size-4" />
          )}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-[var(--claw-text-muted)] hover:bg-white/[0.05] hover:text-[var(--claw-text-primary)]"
        aria-label={isCopied ? "Copied message" : "Copy message"}
        title={isCopied ? "Copied" : "Copy message"}
        onClick={copyMessageContent}
      >
        {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
  const avatar = (
    <Avatar className="size-10 shrink-0 border" style={avatarBorderStyle}>
      <AvatarImage
        src={resolvedAvatarUrl ?? message.senderAvatarUrl ?? undefined}
      />
      <AvatarFallback
        className="claw-caption bg-[var(--claw-bg-surface)] font-semibold"
        style={avatarFallbackStyle}
      >
        {initials(resolvedSenderName)}
      </AvatarFallback>
      <DepartmentAvatarBadge color={departmentColor} />
    </Avatar>
  )

  useEffect(() => {
    if (!isCopied) {
      return
    }

    const timeoutId = window.setTimeout(() => setIsCopied(false), 1600)
    return () => window.clearTimeout(timeoutId)
  }, [isCopied])

  useEffect(() => {
    if (!isThreadTailCopied) {
      return
    }

    const timeoutId = window.setTimeout(
      () => setIsThreadTailCopied(false),
      1600
    )
    return () => window.clearTimeout(timeoutId)
  }, [isThreadTailCopied])

  useEffect(() => {
    const content = messageContentRef.current
    if (!content) {
      setIsLongMessage(false)
      return
    }

    function updateLongMessageState() {
      if (!content) return
      setIsLongMessage(content.scrollHeight > 560)
    }

    updateLongMessageState()

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver(updateLongMessageState)
    observer.observe(content)

    return () => observer.disconnect()
  }, [message.content])

  function scrollToMessageEdge(edge: "top" | "bottom") {
    const target =
      edge === "top" ? messageTopRef.current : messageBottomRef.current

    target?.scrollIntoView({
      block: edge === "top" ? "start" : "end",
      behavior: "smooth",
    })
  }

  const jumpToBottomControl = isLongMessage && !isHtmlAgentMessage ? (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="claw-meta mb-3 h-6 gap-1 border border-white/10 bg-white/[0.03] px-2 text-[var(--claw-text-muted)] hover:bg-white/[0.06] hover:text-[var(--claw-text-primary)]"
      aria-label="Jump to bottom of message"
      title="Jump to bottom of message"
      onClick={() => scrollToMessageEdge("bottom")}
    >
      <ArrowDown className="size-3" />
      Bottom
    </Button>
  ) : null

  const jumpToTopControl = isLongMessage && !isHtmlAgentMessage ? (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="claw-meta mt-3 h-6 gap-1 border border-white/10 bg-white/[0.03] px-2 text-[var(--claw-text-muted)] hover:bg-white/[0.06] hover:text-[var(--claw-text-primary)]"
      aria-label="Jump to top of message"
      title="Jump to top of message"
      onClick={() => scrollToMessageEdge("top")}
    >
      <ArrowUp className="size-3" />
      Top
    </Button>
  ) : null

  async function copyMessageContent() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message.content)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = message.content
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

      setIsCopied(true)
    } catch {
      toast.error("Could not copy this message.")
    }
  }

  async function copyThreadFromMessage() {
    if (!onCopyFromMessage) {
      return
    }

    try {
      await onCopyFromMessage(message)
      setIsThreadTailCopied(true)
    } catch {
      toast.error("Could not copy the thread from this message.")
    }
  }

  return (
    <div className="flex w-full">
      <div
        ref={messageTopRef}
        className={`relative w-full rounded-[4px] border text-left shadow-none before:absolute before:top-0 before:bottom-0 before:w-0.5 before:bg-[var(--message-accent,var(--claw-accent-blue))] ${
          isHtmlAgentMessage
            ? "px-0 py-1 before:hidden"
            : isUser
              ? "py-4 pr-5 pl-12 before:right-0 before:rounded-r-[4px]"
              : "py-4 pr-12 pl-5 before:left-0 before:rounded-l-[4px]"
        }`}
        style={containerStyle}
      >
        <div
          className={`mb-3 flex items-center gap-3 text-xs text-[var(--claw-text-muted)] ${
            isHtmlAgentMessage
              ? "mb-0 rounded-t-[9px] border border-b-0 border-[rgba(125,211,252,0.2)] bg-[#0b141f]/85 px-4 py-2.5"
              : ""
          }`}
        >
          {isUser ? <div className="mr-auto">{actionControls}</div> : avatar}
          <span className="text-sm font-semibold text-[var(--claw-text-primary)]">
            {resolvedSenderName}
          </span>
          {isFailedLocalSend ? (
            <span className="claw-kicker rounded-md border border-red-400/20 bg-red-500/10 px-1.5 py-0.5 font-medium tracking-normal text-red-100 uppercase">
              Failed
            </span>
          ) : null}
          <span
            className="claw-kicker rounded border px-2 py-0.5 leading-4 font-medium tracking-normal uppercase"
            style={{
              borderColor: tone?.border,
              color: tone?.label ?? "var(--claw-text-muted)",
              backgroundColor: "rgba(255,255,255,0.03)",
            }}
          >
            {roleLabel}
          </span>
          {isManager ? (
            <span className="claw-kicker rounded border border-[color-mix(in_srgb,var(--claw-accent-blue)_42%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_10%,transparent)] px-2 py-0.5 leading-4 font-semibold tracking-normal text-[#b9d6f8] uppercase">
              Manager
            </span>
          ) : null}
          <span>{format(new Date(message.createdAt), "HH:mm")}</span>
          {isUser ? avatar : <div className="ml-auto">{actionControls}</div>}
        </div>
        {jumpToBottomControl ? (
          <div
            className={`flex ${isUser ? "justify-end pr-[52px]" : "pl-[52px]"}`}
          >
            {jumpToBottomControl}
          </div>
        ) : null}
        <div
          ref={messageContentRef}
          className={`text-sm leading-5 text-[var(--claw-text-primary)] ${
            isHtmlMessage ? "px-0" : isUser ? "pr-[52px]" : "pl-[52px]"
          }`}
        >
          {isHtmlMessage ? (
            <HtmlMessageRenderer
              html={message.content}
              attachedChrome={isHtmlAgentMessage}
            />
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 whitespace-pre-wrap last:mb-0">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="[&>ol]:mt-1 [&>ol]:mb-0 [&>p]:mb-0 [&>p]:whitespace-pre-wrap [&>ul]:mt-1 [&>ul]:mb-0">
                    {children}
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-white">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="text-zinc-100 italic">{children}</em>
                ),
                code: ({ children }) => (
                  <code className="claw-caption rounded bg-black/20 px-1 py-0.5 font-mono text-[#c7d4df]">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="claw-caption mb-2 overflow-x-auto rounded-md border border-white/8 bg-black/20 p-3 font-mono leading-5 last:mb-0">
                    {children}
                  </pre>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-200 underline underline-offset-2"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {message.attachments?.length ? (
          <div
            className={`mt-3 grid gap-2 ${isUser ? "pr-[52px]" : "pl-[52px]"}`}
          >
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="claw-caption flex items-center gap-2 rounded-[4px] border border-white/8 bg-black/10 px-3 py-2"
                title={
                  attachment.status === "unavailable"
                    ? "This file is stored on the OpenClaw machine and is unavailable while OpenClaw is disconnected."
                    : attachment.filename
                }
              >
                <FileText className="size-4 shrink-0 text-[var(--claw-text-muted)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-[var(--claw-text-primary)]">
                    {attachment.filename}
                  </div>
                  <div className="claw-meta truncate text-[var(--claw-text-muted)]">
                    {attachment.mimeType} · {formatBytes(attachment.sizeBytes)}{" "}
                    · {attachment.status}
                  </div>
                </div>
                <span className="claw-kicker rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[var(--claw-text-muted)]">
                  OpenClaw local
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {jumpToTopControl ? (
          <div
            className={`flex ${isUser ? "justify-end pr-[52px]" : "pl-[52px]"}`}
          >
            {jumpToTopControl}
          </div>
        ) : null}
        {!isUser ? (
          <DocumentReferencesPanel
            references={documentReferences}
            integrated={isHtmlAgentMessage}
            trailingAction={!isHtmlAgentMessage ? actionControls : null}
          />
        ) : null}
        <div ref={messageBottomRef} />
        {isFailedLocalSend ? (
          <div className="claw-meta mt-2 leading-5 text-red-100/80">
            {localErrorMessage ?? "Message failed to send."}
          </div>
        ) : null}
      </div>
    </div>
  )
})

function DocumentReferencesPanel({
  references,
  integrated = false,
  trailingAction,
}: {
  references: DocumentReference[]
  integrated?: boolean
  trailingAction?: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const hasReferences = references.length > 0
  const visibleReferences = references.slice(0, 24)
  const hiddenCount = Math.max(0, references.length - visibleReferences.length)
  const sensitiveCount = references.filter(
    (reference) => reference.sensitive
  ).length

  return (
    <div
      className={
        integrated
          ? "mt-0 rounded-b-[9px] border border-t-0 border-[rgba(125,211,252,0.2)] bg-[#0b141f]/55 px-4 py-3"
          : "mt-4 border-t border-white/8 pt-3 pl-[52px]"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={`claw-meta h-7 gap-1.5 border px-2 ${
            hasReferences
              ? "border-white/8 bg-white/[0.03] text-[var(--claw-text-muted)] hover:bg-white/[0.06] hover:text-[var(--claw-text-primary)]"
              : "cursor-default border-white/5 bg-white/[0.015] text-zinc-600 hover:bg-white/[0.015] hover:text-zinc-600"
          }`}
          aria-expanded={isOpen}
          disabled={!hasReferences}
          title={
            hasReferences
              ? "Show documents referenced by this response"
              : "No document references were provided for this response"
          }
          onClick={() => {
            if (!hasReferences) return
            setIsOpen((current) => !current)
          }}
        >
          {!hasReferences ? (
            <ChevronRight className="size-3.5 opacity-45" />
          ) : isOpen ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          {hasReferences ? "Documents referenced" : "No documents referenced"}
          <span className="claw-kicker rounded border border-white/10 bg-black/15 px-1.5 leading-4 text-zinc-300">
            {references.length}
          </span>
        </Button>
        {trailingAction ? (
          <div className="shrink-0 pt-0.5">{trailingAction}</div>
        ) : null}
      </div>

      {hasReferences && isOpen ? (
        <div className="mt-2 rounded-[4px] border border-white/8 bg-black/10">
          <div className="divide-y divide-white/7">
            {visibleReferences.map((reference, index) => (
              <DocumentReferenceRow
                key={documentReferenceRenderKey(reference, index)}
                reference={reference}
              />
            ))}
          </div>
          {hiddenCount || sensitiveCount ? (
            <div className="claw-meta border-t border-white/8 px-3 py-2 leading-4 text-[var(--claw-text-muted)]">
              {hiddenCount ? `${hiddenCount} more references hidden. ` : null}
              {sensitiveCount
                ? `${sensitiveCount} marked sensitive by the runtime.`
                : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function documentReferenceRenderKey(reference: DocumentReference, index: number) {
  return [
    reference.id,
    reference.uri,
    reference.displayPath,
    reference.title,
    index,
  ]
    .filter((part) => part !== null && part !== undefined && `${part}`.trim())
    .join("|")
}

function DocumentReferenceRow({ reference }: { reference: DocumentReference }) {
  const title =
    reference.title ??
    reference.displayPath ??
    reference.uri ??
    documentReferenceKindLabel(reference.kind)
  const metaParts = [
    documentReferenceKindLabel(reference.kind),
    reference.role ? documentReferenceTokenLabel(reference.role) : null,
    reference.action ? documentReferenceTokenLabel(reference.action) : null,
    reference.confidence
      ? documentReferenceTokenLabel(reference.confidence)
      : null,
  ].filter(Boolean)

  return (
    <div className="claw-meta flex items-start gap-2 px-3 py-2 leading-4">
      <div className="mt-0.5 text-[var(--claw-text-muted)]">
        {reference.kind === "web" ? (
          <Globe className="size-3.5" />
        ) : reference.sensitive || reference.redacted ? (
          <LockKeyhole className="size-3.5" />
        ) : (
          <FileText className="size-3.5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-[var(--claw-text-primary)]">
          {title}
        </div>
        {reference.displayPath && reference.displayPath !== title ? (
          <div className="truncate text-[var(--claw-text-muted)]">
            {reference.displayPath}
          </div>
        ) : null}
        {metaParts.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {metaParts.map((part) => (
              <span
                key={part}
                className="claw-kicker rounded border border-white/8 bg-white/[0.03] px-1.5 py-0.5 leading-3 text-[var(--claw-text-muted)]"
              >
                {part}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function documentReferenceKindLabel(kind: DocumentReference["kind"]) {
  switch (kind) {
    case "workspace_file":
      return "Workspace"
    case "memory_file":
      return "Memory"
    case "library_doc":
      return "Library"
    case "system_doc":
      return "System"
    case "web":
      return "Web"
    case "artifact":
      return "Artifact"
    case "skill":
      return "Skill"
    case "workflow":
      return "Workflow"
    default:
      return "Reference"
  }
}

function documentReferenceTokenLabel(value: string) {
  return value.replace(/_/g, " ")
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}
