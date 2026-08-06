"use client"

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  getMessageDocumentReferences,
  type Agent,
  type Department,
  type DocumentReference,
  type Message,
  type MessageAttachment,
  type MessageAttachmentKind,
  type PaperclipConnection,
  type PutThreadPaperclipLinkInput,
  type RuntimeApprovalMode,
  type RuntimeTodoTask,
  type Thread,
  type ThreadPaperclipLinkView,
  type ThreadWrapUpReport,
} from "@clawchat/contracts"
import type {
  RuntimeContextUsageUiState,
  RuntimeDispatchUiState,
  RuntimeParticipantHealthUiState,
} from "@/hooks/use-clawchat-realtime"
import type { TeamRelayState } from "@clawchat/web-sdk"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { sdk } from "@/lib/sdk"
import { DepartmentAvatarBadge } from "@/components/shared/department-avatar-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { CondensedAgentMessage } from "@/components/threads/condensed-agent-message"
import {
  MessageBubble,
  type AgentCardTone,
} from "@/components/threads/message-bubble"
import { MessageSkeleton } from "@/components/app-shell/skeletons"
import {
  buildCondensedRuntimeStatus,
  resolveCondensedMessageText,
} from "@/lib/condensed-thread"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Crown,
  FilePlus2,
  FileText,
  ImageIcon,
  List,
  MessageSquare,
  MessageSquareText,
  PanelTop,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Users,
  UserPlus,
  X,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import {
  getDistinctAgentMessageStyle,
  getParticipantMessageStyle,
} from "@/lib/participant-message-style"

export type ThreadViewMode = "full" | "condensed"

const SEEDANCE_PNG_ASSET_INSTRUCTION_MARKER = "Use all attached PNG assets"
const SEEDANCE_PNG_ASSET_INSTRUCTION =
  "Use all attached PNG assets as visual references for the SeeDance 2 video generation. Do not ignore any attached asset."
const COMPOSER_MAX_LINES = 8

function composerApprovalModeTitle(mode: RuntimeApprovalMode) {
  switch (mode) {
    case "approve_for_me":
      return "Approve for me"
    case "full_access":
      return "Full access"
    default:
      return "Ask for approval"
  }
}

function composerApprovalModeDescription(mode: RuntimeApprovalMode) {
  switch (mode) {
    case "approve_for_me":
      return "Conversations start immediately; Relay asks only before potentially unsafe actions."
    case "full_access":
      return "Conversations and supported actions run without Relay approval prompts."
    default:
      return "Conversations start immediately; Relay asks before tools or external actions run."
  }
}

function composerApprovalModeTone(mode: RuntimeApprovalMode) {
  switch (mode) {
    case "approve_for_me":
      return "#7daee8"
    case "full_access":
      return "#d6ad68"
    default:
      return "var(--claw-text-muted)"
  }
}

function getMentionToken(agent: Agent) {
  return (
    agent.externalId?.trim() ||
    agent.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  )
}

function getAgentRuntimeType(agent?: Agent | null): string | null {
  if (!agent) {
    return null
  }

  const runtimeType = agent.runtimeBinding?.runtimeType?.trim().toLowerCase()
  if (runtimeType) {
    return runtimeType
  }
  const source = agent.source?.trim().toLowerCase()
  if (
    source === "claude_code" ||
    source === "hermes" ||
    source === "openclaw"
  ) {
    return source
  }
  return null
}

function getRuntimeLabel(runtimeType?: string | null) {
  switch (runtimeType) {
    case "claude_code":
      return "Claude Code"
    case "hermes":
      return "Hermes"
    case "openclaw":
      return "OpenClaw"
    default:
      return null
  }
}

function runtimeTodoStatusLabel(status: RuntimeTodoTask["status"]) {
  switch (status) {
    case "in_progress":
      return "Active"
    case "completed":
      return "Completed"
    case "cancelled":
      return "Cancelled"
    default:
      return "Pending"
  }
}

function RuntimeTodoProgressCard({ tasks }: { tasks: RuntimeTodoTask[] }) {
  const completed = tasks.filter((task) => task.status === "completed").length
  return (
    <section
      aria-label="Hermes task progress"
      className="rounded-lg border border-sky-400/20 bg-sky-500/[0.06] px-3 py-3"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-sky-100">
          <List className="size-4" />
          <span>Task progress</span>
        </div>
        <span className="text-xs text-sky-100/65">
          {completed}/{tasks.length} completed
        </span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-start gap-2.5">
            <span
              className={[
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                task.status === "completed"
                  ? "border-emerald-300/35 bg-emerald-400/15 text-emerald-200"
                  : task.status === "cancelled"
                    ? "border-zinc-400/30 bg-zinc-400/10 text-zinc-400"
                    : task.status === "in_progress"
                      ? "animate-pulse border-sky-300/40 bg-sky-400/15 text-sky-100"
                      : "border-zinc-400/25 text-zinc-400",
              ].join(" ")}
              aria-hidden="true"
            >
              {task.status === "completed"
                ? "✓"
                : task.status === "cancelled"
                  ? "×"
                  : task.status === "in_progress"
                    ? "●"
                    : "○"}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={[
                  "text-sm leading-relaxed",
                  task.status === "cancelled"
                    ? "text-zinc-500 line-through"
                    : task.status === "completed"
                      ? "text-zinc-300"
                      : "text-zinc-100",
                ].join(" ")}
              >
                {task.content}
              </p>
              <span className="text-[10px] tracking-wide text-zinc-500 uppercase">
                {runtimeTodoStatusLabel(task.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function RuntimeStreamingMarkdown({ text }: { text: string }) {
  return (
    <div
      aria-label="Interim agent commentary"
      className="max-w-none rounded-lg border border-sky-300/15 bg-black/15 px-4 py-3 text-sm leading-5 text-zinc-100"
    >
      <div className="claw-kicker mb-2 tracking-[0.12em] text-sky-200/65 uppercase">
        Interim commentary
      </div>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>
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
            <strong className="font-semibold text-white">{children}</strong>
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
        {text}
      </ReactMarkdown>
    </div>
  )
}

function formatRuntimeElapsed(startedAt: string, now: number) {
  const started = Date.parse(startedAt)
  if (!Number.isFinite(started)) return "Live"
  const elapsedSeconds = Math.max(0, Math.floor((now - started) / 1000))
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`
}

function RuntimeElapsedTime({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-100/65">
      <Clock className="size-3" />
      {formatRuntimeElapsed(startedAt, now)}
    </span>
  )
}

function formatContextPercent(value: number | null) {
  if (value === null) return "Usage unknown"
  return `${value.toFixed(1)}% used`
}

function formatCompactContextPercent(value: number | null) {
  if (value === null) return "--"
  return `${Math.round(value)}%`
}

function formatTokenCount(value: number | null) {
  if (value === null) return "?"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return value.toLocaleString()
}

function getContextUsageTone(level: RuntimeContextUsageUiState["level"]) {
  switch (level) {
    case "warn":
      return {
        border: "border-amber-400/25",
        background: "bg-amber-500/[0.08]",
        text: "text-amber-100",
        muted: "text-amber-50/70",
        bar: "bg-amber-300",
      }
    case "critical":
    case "overflow":
      return {
        border: "border-rose-400/25",
        background: "bg-rose-500/[0.08]",
        text: "text-rose-100",
        muted: "text-rose-50/75",
        bar: "bg-rose-300",
      }
    default:
      return {
        border: "border-white/10",
        background: "bg-white/[0.035]",
        text: "text-zinc-200",
        muted: "text-zinc-400",
        bar: "bg-[#4f91e8]",
      }
  }
}

function getRuntimeHealthTone(status: string) {
  const normalized = status.trim().toLowerCase()
  if (["ready", "healthy", "online", "available", "ok"].includes(normalized)) {
    return {
      border: "border-emerald-400/20",
      background: "bg-emerald-500/[0.07]",
      text: "text-emerald-100",
      muted: "text-emerald-50/70",
    }
  }
  if (["degraded", "starting", "reconnecting", "busy"].includes(normalized)) {
    return {
      border: "border-amber-400/25",
      background: "bg-amber-500/[0.08]",
      text: "text-amber-100",
      muted: "text-amber-50/70",
    }
  }
  return {
    border: "border-rose-400/25",
    background: "bg-rose-500/[0.08]",
    text: "text-rose-100",
    muted: "text-rose-50/75",
  }
}

type RuntimeContextUsageDisplayRow = {
  agentId: string
  agentName: string
  avatarUrl?: string
  runtimeType: string | null
  totalTokens: number | null
  contextTokens: number | null
  percentUsed: number | null
  level: RuntimeContextUsageUiState["level"]
  fresh: boolean
  references?: RuntimeContextUsageUiState["references"]
  updatedAt: string | null
}

type RuntimeHealthDisplayRow = {
  agentId: string
  agentName: string
  avatarUrl?: string
  runtimeType: string
  status: string
  message: string | null
  updatedAt: string
}

async function copyTextToClipboard(value: string) {
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

function isPngAssetFile(file: File) {
  const mimeType = file.type.toLowerCase()
  const filename = file.name.toLowerCase()
  return mimeType === "image/png" || filename.endsWith(".png")
}

function inferAttachmentKind(file: File): MessageAttachmentKind {
  const mimeType = file.type.toLowerCase()
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType.startsWith("video/")) return "video"
  if (
    mimeType.startsWith("text/") ||
    [
      "application/pdf",
      "application/json",
      "application/xml",
      "application/yaml",
      "application/x-yaml",
    ].includes(mimeType)
  ) {
    return "document"
  }
  return "file"
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const batchSize = 0x8000
  for (let index = 0; index < bytes.length; index += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + batchSize))
  }
  return btoa(binary)
}

function formatDocumentReferenceForCopy(reference: DocumentReference) {
  const title =
    reference.title ??
    reference.displayPath ??
    reference.uri ??
    documentReferenceKindLabel(reference.kind)
  const path =
    reference.displayPath && reference.displayPath !== title
      ? ` (${reference.displayPath})`
      : ""
  const meta = [
    documentReferenceKindLabel(reference.kind),
    reference.role ? documentReferenceTokenLabel(reference.role) : null,
    reference.action ? documentReferenceTokenLabel(reference.action) : null,
    reference.confidence
      ? documentReferenceTokenLabel(reference.confidence)
      : null,
    reference.sensitive ? "sensitive" : null,
    reference.redacted ? "redacted" : null,
  ].filter(Boolean)

  return `- ${title}${path}${meta.length ? ` [${meta.join(", ")}]` : ""}`
}

export function ThreadDetailPane({
  selectedThread,
  activeThreadSessionId = null,
  viewedWrapUpTranscript = null,
  isLoading,
  loadError = null,
  syncError = null,
  isSyncing = false,
  messages,
  hasOlderMessages = false,
  isLoadingOlderMessages = false,
  onLoadOlderMessages,
  agents,
  departments,
  wrapUpReports = [],
  runtimeDispatches = [],
  runtimeParticipantHealth = [],
  runtimeContextUsage = [],
  displayNamesByAgentId = {},
  managerAgentId = null,
  managerAgentIds = [],
  currentUserAvatarUrl,
  messageDraft,
  onMessageDraftChange,
  onViewLiveChat,
  onViewWrapUpTranscript,
  threadViewMode = "full",
  onThreadViewModeChange,
  isCondensedViewEnabled = false,
  showDetailedRuntimeActivity = true,
  runtimeApprovalMode = "ask_for_approval",
  onRuntimeApprovalModeChange,
  onSendMessage,
  onCancelRuntimeDispatch,
  onRetryRuntimeDispatch,
  isSending,
  typingUsers,
  isAwaitingAgentReply,
  relativeTime,
  initials,
  onAddAgentToTeam,
  onRemoveAgentFromTeam,
  isUpdatingTeamMembers = false,
  onUpdateAvatarUrl,
  onWrapUpThread,
  onOpenWrapUpReport,
  isWrappingUpThread = false,
  emptyTitle = "Select a conversation",
  emptyDescription = "Choose a thread from the left to inspect history and send messages.",
  emptyActions,
  emptyMessageActions,
  modelOptionsByRuntime = {},
  onUpdateAgentModel,
}: {
  selectedThread: Thread | null
  activeThreadSessionId?: string | null
  viewedWrapUpTranscript?: ThreadWrapUpReport | null
  isLoading: boolean
  loadError?: string | null
  syncError?: string | null
  isSyncing?: boolean
  messages: Message[]
  hasOlderMessages?: boolean
  isLoadingOlderMessages?: boolean
  onLoadOlderMessages?: () => void
  agents: Agent[]
  departments: Department[]
  wrapUpReports?: ThreadWrapUpReport[]
  runtimeDispatches?: RuntimeDispatchUiState[]
  runtimeParticipantHealth?: RuntimeParticipantHealthUiState[]
  runtimeContextUsage?: RuntimeContextUsageUiState[]
  displayNamesByAgentId?: Record<string, string>
  managerAgentId?: string | null
  managerAgentIds?: string[]
  currentUserAvatarUrl?: string
  messageDraft: string
  onMessageDraftChange: (value: string) => void
  onViewLiveChat?: () => void
  onViewWrapUpTranscript?: (report: ThreadWrapUpReport) => void
  threadViewMode?: ThreadViewMode
  onThreadViewModeChange?: (mode: ThreadViewMode) => void
  isCondensedViewEnabled?: boolean
  showDetailedRuntimeActivity?: boolean
  runtimeApprovalMode?: RuntimeApprovalMode
  onRuntimeApprovalModeChange?: (mode: RuntimeApprovalMode) => void
  onSendMessage: (
    attachments?: MessageAttachment[],
    authority?: {
      runtimeApprovalMode: RuntimeApprovalMode
      runtimeDispatchConfirmed: boolean
    }
  ) => void
  onCancelRuntimeDispatch?: (dispatch: RuntimeDispatchUiState) => void
  onRetryRuntimeDispatch?: (dispatch: RuntimeDispatchUiState) => void
  isSending: boolean
  typingUsers: string[]
  isAwaitingAgentReply: boolean
  relativeTime: (value: string) => string
  initials: (value: string) => string
  onAddAgentToTeam?: (agentId: string) => void
  onRemoveAgentFromTeam?: (agentId: string) => void
  isUpdatingTeamMembers?: boolean
  onUpdateAvatarUrl?: (url: string) => void
  onWrapUpThread?: () => void
  onOpenWrapUpReport?: (report: ThreadWrapUpReport) => void
  isWrappingUpThread?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyActions?: ReactNode
  emptyMessageActions?: ReactNode
  modelOptionsByRuntime?: Record<
    string,
    { defaultModel: string; models: string[] }
  >
  onUpdateAgentModel?: (agentId: string, model: string) => Promise<void>
  paperclipLinkView?: ThreadPaperclipLinkView | null
  paperclipConnections?: PaperclipConnection[]
  isPaperclipAdmin?: boolean
  isPaperclipLinkLoading?: boolean
  isPaperclipLinkMutating?: boolean
  onPaperclipLink?: (input: PutThreadPaperclipLinkInput) => Promise<unknown>
  onPaperclipUnlink?: () => Promise<unknown>
  onPaperclipRefresh?: () => Promise<unknown> | void
  onOpenPaperclipSettings?: () => void
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const previousThreadIdRef = useRef<string | null>(null)
  const isMessageTimelineAtBottomRef = useRef(true)
  const addAgentDropdownRef = useRef<HTMLDivElement | null>(null)
  const teamMembersDropdownRef = useRef<HTMLDivElement | null>(null)
  const wrapUpHistoryDropdownRef = useRef<HTMLDivElement | null>(null)
  const relayLimitDropdownRef = useRef<HTMLDivElement | null>(null)
  const avatarFileRef = useRef<HTMLInputElement | null>(null)
  const attachmentFileRef = useRef<HTMLInputElement | null>(null)
  const imageAttachmentFileRef = useRef<HTMLInputElement | null>(null)
  const seedancePngAssetFileRef = useRef<HTMLInputElement | null>(null)
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const onViewLiveChatRef = useRef(onViewLiveChat)
  const onOpenWrapUpReportRef = useRef(onOpenWrapUpReport)
  const threadCopiedTimeoutRef = useRef<number | null>(null)
  const threadWithReferencesCopiedTimeoutRef = useRef<number | null>(null)
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [showTeamMembers, setShowTeamMembers] = useState(false)
  const [showWrapUpHistory, setShowWrapUpHistory] = useState(false)
  const [showRelayLimitMenu, setShowRelayLimitMenu] = useState(false)
  const [showCustomRelayLimit, setShowCustomRelayLimit] = useState(false)
  const [isUpdatingDirectModel, setIsUpdatingDirectModel] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<{
      localId: string
      file: File
      status: "uploading" | "uploaded" | "failed" | "cancelled"
      progress: number
      error?: string
      attachment?: MessageAttachment
      abortController?: AbortController
    }>
  >([])
  const [isDraggingAttachment, setIsDraggingAttachment] = useState(false)
  const [showWrapUpConfirm, setShowWrapUpConfirm] = useState(false)
  const [isThreadCopied, setIsThreadCopied] = useState(false)
  const [isThreadWithReferencesCopied, setIsThreadWithReferencesCopied] =
    useState(false)
  const [teamRelay, setTeamRelay] = useState<TeamRelayState | null>(null)
  const [teamRelayError, setTeamRelayError] = useState<string | null>(null)
  const [isTeamRelayLoading, setIsTeamRelayLoading] = useState(false)
  const [isTeamRelayMutating, setIsTeamRelayMutating] = useState(false)

  const resizeComposerTextarea = useCallback(
    (textarea: HTMLTextAreaElement | null = composerTextareaRef.current) => {
      if (!textarea) return

      textarea.style.height = "auto"
      const computedLineHeight = Number.parseFloat(
        window.getComputedStyle(textarea).lineHeight
      )
      const lineHeight = Number.isFinite(computedLineHeight)
        ? computedLineHeight
        : 20
      const maximumHeight = lineHeight * COMPOSER_MAX_LINES
      const contentHeight = textarea.scrollHeight

      textarea.style.height = `${Math.min(contentHeight, maximumHeight)}px`
      textarea.style.overflowY =
        contentHeight > maximumHeight ? "auto" : "hidden"
    },
    []
  )

  useLayoutEffect(() => {
    resizeComposerTextarea()
  }, [messageDraft, resizeComposerTextarea])

  useEffect(() => {
    const handleResize = () => resizeComposerTextarea()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [resizeComposerTextarea])
  const [customRelayLimit, setCustomRelayLimit] = useState("50")

  async function handleAvatarFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !onUpdateAvatarUrl) return
    if (!file.type.startsWith("image/")) return

    setIsUploadingAvatar(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      onUpdateAvatarUrl(dataUrl)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  async function handleAttachmentFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    await uploadAttachmentFiles(files)
  }

  async function handleSeedancePngAssetFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (!files.length) return

    const pngFiles = files.filter(isPngAssetFile)
    if (!pngFiles.length) {
      toast.error("Choose PNG files for SeeDance 2 assets.")
      return
    }
    if (pngFiles.length !== files.length) {
      toast.error("Only PNG files were attached for SeeDance 2 assets.")
    }

    appendSeedancePngAssetInstruction()
    await uploadAttachmentFiles(pngFiles)
  }

  function appendSeedancePngAssetInstruction() {
    if (messageDraft.includes(SEEDANCE_PNG_ASSET_INSTRUCTION_MARKER)) {
      return
    }
    const trimmedDraft = messageDraft.trimEnd()
    onMessageDraftChange(
      trimmedDraft
        ? `${trimmedDraft}\n\n${SEEDANCE_PNG_ASSET_INSTRUCTION}`
        : SEEDANCE_PNG_ASSET_INSTRUCTION
    )
  }

  async function uploadAttachmentFiles(files: File[]) {
    if (!selectedThread?.id || !files.length) return
    const existingCount = pendingAttachments.filter(
      (entry) => entry.status !== "cancelled"
    ).length
    if (existingCount + files.length > 10) {
      toast.error("Messages can include at most 10 attachments.")
      return
    }

    for (const file of files) {
      void uploadAttachmentFile(selectedThread.id, file)
    }
  }

  async function uploadAttachmentFile(threadId: string, file: File) {
    const localId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const abortController = new AbortController()
    setPendingAttachments((current) => [
      ...current,
      {
        localId,
        file,
        status: "uploading",
        progress: 0,
        abortController,
      },
    ])

    let attachmentId: string | null = null

    try {
      const kind = inferAttachmentKind(file)
      const totalChunks = Math.max(1, Math.ceil(file.size / (1024 * 1024)))
      const upload = await sdk.attachments.beginOpenClawUpload({
        threadId,
        filename: file.name || "attachment",
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        kind,
        totalChunks,
      })
      attachmentId = upload.attachmentId
      const chunkSize = upload.chunkSizeBytes

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        if (abortController.signal.aborted) {
          throw new Error("Upload cancelled")
        }
        const offsetBytes = chunkIndex * chunkSize
        const chunk = file.slice(offsetBytes, offsetBytes + chunkSize)
        const chunkBase64 = await blobToBase64(chunk)
        await sdk.attachments.uploadOpenClawChunk({
          threadId,
          attachmentId,
          chunkIndex,
          totalChunks,
          offsetBytes,
          chunkBase64,
        })
        setPendingAttachments((current) =>
          current.map((entry) =>
            entry.localId === localId
              ? {
                  ...entry,
                  progress: Math.round(((chunkIndex + 1) / totalChunks) * 100),
                }
              : entry
          )
        )
      }

      const attachment = await sdk.attachments.completeOpenClawUpload({
        threadId,
        attachmentId,
      })
      setPendingAttachments((current) =>
        current.map((entry) =>
          entry.localId === localId
            ? {
                ...entry,
                status: "uploaded",
                progress: 100,
                attachment,
                abortController: undefined,
              }
            : entry
        )
      )
    } catch (error) {
      if (attachmentId) {
        await sdk.attachments
          .cancelOpenClawUpload({ threadId, attachmentId })
          .catch(() => undefined)
      }
      const message =
        error instanceof Error ? error.message : "Attachment upload failed"
      setPendingAttachments((current) =>
        current.map((entry) =>
          entry.localId === localId
            ? {
                ...entry,
                status: abortController.signal.aborted ? "cancelled" : "failed",
                error: message,
                abortController: undefined,
              }
            : entry
        )
      )
      if (!abortController.signal.aborted) {
        toast.error(message)
      }
    }
  }

  function removePendingAttachment(localId: string) {
    const entry = pendingAttachments.find((item) => item.localId === localId)
    entry?.abortController?.abort()
    if (entry?.attachment && selectedThread?.id) {
      void sdk.attachments.cancelOpenClawUpload({
        threadId: selectedThread.id,
        attachmentId: entry.attachment.id,
      })
    }
    setPendingAttachments((current) =>
      current.filter((item) => item.localId !== localId)
    )
  }

  const isTeamThread = selectedThread?.type === "team"
  const isDirectThread = selectedThread?.type === "direct"
  const directThreadAgent = isDirectThread
    ? (agents.find((agent) => selectedThread?.agentIds.includes(agent.id)) ??
      null)
    : null
  const directThreadModel =
    directThreadAgent?.modelPrimary?.trim() ||
    (typeof directThreadAgent?.runtimeBinding?.configMetadata?.model ===
    "string"
      ? directThreadAgent.runtimeBinding.configMetadata.model.trim()
      : "")
  const directThreadRuntimeType = getAgentRuntimeType(directThreadAgent)
  const directThreadCatalog = directThreadRuntimeType
    ? modelOptionsByRuntime[directThreadRuntimeType]
    : undefined
  const directThreadModelOptions = Array.from(
    new Set(
      [
        ...(directThreadCatalog?.models ?? []),
        directThreadModel,
        ...(directThreadRuntimeType === "claude_code" ? ["sonnet"] : []),
      ].filter(Boolean)
    )
  )
  const isWrappableThread = isTeamThread || isDirectThread
  const selectedThreadId = selectedThread?.id ?? null
  const isViewingWrapUpTranscript = Boolean(viewedWrapUpTranscript)
  const isCondensedMode =
    isCondensedViewEnabled && isTeamThread && threadViewMode === "condensed"
  const selectedWrapUpReportId = viewedWrapUpTranscript?.id ?? null
  const latestWrappedSequence = useMemo(
    () =>
      wrapUpReports.reduce(
        (highest, report) =>
          Math.max(highest, report.threadSessionSequenceNumber ?? 0),
        0
      ),
    [wrapUpReports]
  )
  const currentCycleNumber = Math.max(1, latestWrappedSequence + 1)
  const wrapUpDialogLabel = isTeamThread ? "Team Wrap-Up" : "Chat Wrap-Up"
  const wrapUpDialogTitle = isTeamThread
    ? "Reset this team chat?"
    : "Reset this direct chat?"
  const wrapUpDialogDescription = isTeamThread
    ? "This will generate a wrap-up report for the current conversation, keep the same team name, avatar, and agents, and reopen the chat on a blank canvas."
    : "This will generate a wrap-up report for the current conversation, keep the same chat name, avatar, and agent, and reopen the chat on a blank canvas."

  async function updateDirectThreadModel(model: string) {
    if (!directThreadAgent || !onUpdateAgentModel || !model) return
    setIsUpdatingDirectModel(true)
    try {
      await onUpdateAgentModel(directThreadAgent.id, model)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Agent model update failed"
      )
    } finally {
      setIsUpdatingDirectModel(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    if (!isTeamThread || !selectedThreadId || !activeThreadSessionId) {
      setTeamRelay(null)
      setTeamRelayError(null)
      return
    }
    setIsTeamRelayLoading(true)
    setTeamRelayError(null)
    void sdk.messages
      .teamRelay(selectedThreadId)
      .then((state) => {
        if (cancelled) return
        setTeamRelay(state)
        setCustomRelayLimit(String(state.replyLimit))
      })
      .catch((error) => {
        if (cancelled) return
        setTeamRelayError(
          error instanceof Error
            ? error.message
            : "Team relay controls failed to load"
        )
      })
      .finally(() => {
        if (!cancelled) setIsTeamRelayLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeThreadSessionId, isTeamThread, messages.length, selectedThreadId])

  const mutateTeamRelay = useCallback(
    async (request: () => Promise<TeamRelayState>) => {
      setIsTeamRelayMutating(true)
      setTeamRelayError(null)
      try {
        const state = await request()
        setTeamRelay(state)
        setCustomRelayLimit(String(state.replyLimit))
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Team relay update failed"
        setTeamRelayError(message)
        toast.error(message)
      } finally {
        setIsTeamRelayMutating(false)
      }
    },
    []
  )

  const applyCustomRelayLimit = useCallback(() => {
    if (!selectedThreadId) return false
    const parsed = Number.parseInt(customRelayLimit.trim(), 10)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100_000) {
      toast.error("Reply limit must be between 1 and 100,000.")
      return false
    }
    void mutateTeamRelay(() =>
      sdk.messages.updateTeamRelay(selectedThreadId, parsed)
    )
    return true
  }, [customRelayLimit, mutateTeamRelay, selectedThreadId])

  const teamMemberIds = useMemo(() => {
    return new Set(selectedThread?.agentIds ?? [])
  }, [selectedThread])
  const teamMembers = useMemo(
    () => (isTeamThread ? agents.filter((a) => teamMemberIds.has(a.id)) : []),
    [agents, isTeamThread, teamMemberIds]
  )
  const teamManager = useMemo(
    () =>
      managerAgentId
        ? (teamMembers.find((agent) => agent.id === managerAgentId) ?? null)
        : null,
    [managerAgentId, teamMembers]
  )
  const managerAgentIdSet = useMemo(
    () =>
      new Set([
        ...managerAgentIds,
        ...(managerAgentId ? [managerAgentId] : []),
      ]),
    [managerAgentId, managerAgentIds]
  )
  const teamHasManager = teamMembers.some((agent) =>
    managerAgentIdSet.has(agent.id)
  )
  const agentsNotInTeam = useMemo(
    () => (isTeamThread ? agents.filter((a) => !teamMemberIds.has(a.id)) : []),
    [agents, isTeamThread, teamMemberIds]
  )
  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents]
  )
  const departmentsById = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments]
  )
  const getAgentDepartmentColor = useCallback(
    (agent?: { departmentId?: string | null } | null) =>
      agent?.departmentId
        ? departmentsById.get(agent.departmentId)?.color
        : null,
    [departmentsById]
  )
  const selectedThreadAvatarUrl =
    selectedThread?.avatarUrl ??
    (selectedThread?.agentIds[0]
      ? (agentsById.get(selectedThread.agentIds[0])?.avatarUrl ?? undefined)
      : undefined)
  const participantTonesBySender = useMemo<
    Record<string, AgentCardTone>
  >(() => {
    if (!selectedThread) {
      return {}
    }

    const senderIds: string[] = []
    const includeSender = (senderId?: string | null) => {
      if (!senderId || senderIds.includes(senderId)) {
        return
      }
      senderIds.push(senderId)
    }

    selectedThread.agentIds.forEach(includeSender)

    for (const message of messages) {
      if (message.isFromUser) {
        continue
      }
      includeSender(message.senderId || message.senderName)
    }

    const usedStyleKeys = new Set<string>()
    return Object.fromEntries(
      senderIds.map((senderId) => {
        const participantName =
          displayNamesByAgentId[senderId] ?? agentsById.get(senderId)?.name
        const assignedStyle = getDistinctAgentMessageStyle(
          senderId,
          participantName,
          usedStyleKeys
        )
        usedStyleKeys.add(assignedStyle.key)

        return [senderId, assignedStyle.style]
      })
    )
  }, [agentsById, displayNamesByAgentId, messages, selectedThread])
  const activeThinkingAgentIds = useMemo(() => {
    if (!selectedThread) return []

    const ids = typingUsers.length
      ? typingUsers
      : isAwaitingAgentReply
        ? (selectedThread.agentIds ?? [])
        : []

    return Array.from(new Set(ids.filter(Boolean)))
  }, [isAwaitingAgentReply, selectedThread, typingUsers])
  const activeThinkingAgents = useMemo(
    () =>
      activeThinkingAgentIds.map((agentId) => {
        const agent = agentsById.get(agentId)
        return {
          id: agentId,
          name: displayNamesByAgentId[agentId] ?? agent?.name ?? "Agent",
          avatarUrl: agent?.avatarUrl ?? undefined,
          departmentId: agent?.departmentId ?? null,
        }
      }),
    [activeThinkingAgentIds, agentsById, displayNamesByAgentId]
  )
  const activeRuntimeDispatches = useMemo(
    () =>
      isViewingWrapUpTranscript
        ? []
        : runtimeDispatches.filter((dispatch) =>
            ["queued", "started", "streaming"].includes(dispatch.status)
          ),
    [isViewingWrapUpTranscript, runtimeDispatches]
  )
  const activeRuntimeDispatchSignature = useMemo(
    () =>
      activeRuntimeDispatches
        .map((dispatch) =>
          [
            dispatch.dispatchId,
            dispatch.status,
            dispatch.draftText,
            dispatch.statusMessage,
            dispatch.toolSummary,
            dispatch.tasks
              .map((task) => `${task.id}:${task.status}:${task.content}`)
              .join(","),
            dispatch.toolActivity
              .map((activity) => `${activity.toolName}:${activity.phase}`)
              .join(","),
          ].join(":")
        )
        .join("|"),
    [activeRuntimeDispatches]
  )
  const failedRuntimeDispatches = useMemo(
    () =>
      isViewingWrapUpTranscript
        ? []
        : runtimeDispatches.filter((dispatch) =>
            ["failed", "cancelled"].includes(dispatch.status)
          ),
    [isViewingWrapUpTranscript, runtimeDispatches]
  )
  const runtimeHealthRows = useMemo((): RuntimeHealthDisplayRow[] => {
    if (!selectedThread || isViewingWrapUpTranscript) {
      return []
    }

    const latestByAgentId = new Map<string, RuntimeParticipantHealthUiState>()
    for (const health of runtimeParticipantHealth) {
      const existing = latestByAgentId.get(health.agentId)
      if (!existing || health.updatedAt.localeCompare(existing.updatedAt) > 0) {
        latestByAgentId.set(health.agentId, health)
      }
    }

    const threadAgentIds = new Set(selectedThread.agentIds ?? [])
    return Array.from(latestByAgentId.values())
      .filter(
        (health) => !threadAgentIds.size || threadAgentIds.has(health.agentId)
      )
      .map((health) => {
        const agent = agentsById.get(health.agentId)
        return {
          agentId: health.agentId,
          agentName:
            displayNamesByAgentId[health.agentId] ?? agent?.name ?? "Agent",
          avatarUrl: agent?.avatarUrl ?? undefined,
          runtimeType: health.runtimeType,
          status: health.status,
          message: health.message ?? null,
          updatedAt: health.updatedAt,
        }
      })
      .sort((a, b) => {
        const aReady = [
          "ready",
          "healthy",
          "online",
          "available",
          "ok",
        ].includes(a.status.trim().toLowerCase())
        const bReady = [
          "ready",
          "healthy",
          "online",
          "available",
          "ok",
        ].includes(b.status.trim().toLowerCase())
        if (aReady !== bReady) return aReady ? 1 : -1
        return b.updatedAt.localeCompare(a.updatedAt)
      })
  }, [
    agentsById,
    displayNamesByAgentId,
    isViewingWrapUpTranscript,
    runtimeParticipantHealth,
    selectedThread,
  ])
  const shouldShowThinking =
    Boolean(selectedThread) &&
    !isViewingWrapUpTranscript &&
    activeThinkingAgents.length > 0 &&
    activeRuntimeDispatches.length === 0
  const shouldShowRuntimeContextUsage =
    Boolean(selectedThread) && !isViewingWrapUpTranscript
  const messageAgentNamesById = useMemo(() => {
    const names: Record<string, string> = {}
    for (const message of messages) {
      const senderKey = message.senderId || message.senderName
      if (!message.isFromUser && senderKey && message.senderName) {
        names[senderKey] = message.senderName
      }
    }
    return names
  }, [messages])
  const messageAgentIds = useMemo(() => {
    const ids: string[] = []
    const include = (senderId?: string | null) => {
      if (!senderId || ids.includes(senderId)) {
        return
      }
      ids.push(senderId)
    }

    for (const message of messages) {
      if (!message.isFromUser) {
        include(message.senderId || message.senderName)
      }
    }

    return ids
  }, [messages])
  const runtimeContextUsageRows =
    useMemo((): RuntimeContextUsageDisplayRow[] => {
      if (!shouldShowRuntimeContextUsage) {
        return []
      }

      const threadAgentIds = selectedThread?.agentIds ?? []
      const visibleTeamMemberIds = teamMembers.map((agent) => agent.id)
      const usageByAgentId = new Map(
        runtimeContextUsage.map((entry) => [entry.agentId, entry])
      )
      const rowAgentIds = Array.from(
        new Set([
          ...threadAgentIds,
          ...visibleTeamMemberIds,
          ...messageAgentIds,
          ...runtimeContextUsage.map((entry) => entry.agentId),
        ])
      )

      return rowAgentIds
        .map((agentId) => {
          const usage = usageByAgentId.get(agentId)
          const agent = agentsById.get(agentId)
          return {
            agentId,
            agentName:
              displayNamesByAgentId[agentId] ??
              agent?.name ??
              messageAgentNamesById[agentId] ??
              "Agent",
            avatarUrl: agent?.avatarUrl ?? undefined,
            runtimeType:
              usage?.runtimeType ?? getAgentRuntimeType(agent) ?? null,
            totalTokens: usage?.totalTokens ?? null,
            contextTokens: usage?.contextTokens ?? null,
            percentUsed: usage?.percentUsed ?? null,
            level: usage?.level ?? "unknown",
            fresh: usage?.fresh ?? true,
            references: usage?.references ?? [],
            updatedAt: usage?.updatedAt ?? null,
          }
        })
        .sort((a, b) => {
          const usageDelta = (b.percentUsed ?? -1) - (a.percentUsed ?? -1)
          if (usageDelta !== 0) return usageDelta

          if (a.updatedAt && b.updatedAt) {
            const updatedAtDelta = b.updatedAt.localeCompare(a.updatedAt)
            if (updatedAtDelta !== 0) return updatedAtDelta
          }

          return a.agentName.localeCompare(b.agentName)
        })
    }, [
      agentsById,
      displayNamesByAgentId,
      messageAgentIds,
      messageAgentNamesById,
      runtimeContextUsage,
      selectedThread,
      shouldShowRuntimeContextUsage,
      teamMembers,
    ])
  const uploadedAttachments = pendingAttachments
    .map((entry) => entry.attachment)
    .filter((entry): entry is MessageAttachment => Boolean(entry))
  const isUploadingAttachments = pendingAttachments.some(
    (entry) => entry.status === "uploading"
  )
  const canSendComposer =
    Boolean(messageDraft.trim()) || uploadedAttachments.length > 0
  const handleSendComposerMessage = useCallback(() => {
    if (!canSendComposer || isSending || isUploadingAttachments) {
      return
    }
    onSendMessage(uploadedAttachments, {
      runtimeApprovalMode,
      runtimeDispatchConfirmed: true,
    })
    setPendingAttachments([])
  }, [
    canSendComposer,
    isSending,
    isUploadingAttachments,
    onSendMessage,
    runtimeApprovalMode,
    uploadedAttachments,
  ])
  const resolveThreadTitle = useCallback(
    (thread: Thread) => {
      const primaryAgentId = thread.agentIds[0]
      if (!primaryAgentId) {
        return thread.title
      }

      const displayName = displayNamesByAgentId[primaryAgentId]
      if (!displayName) {
        return thread.title
      }

      if (thread.type === "direct") {
        return displayName
      }

      const backendName = agentsById.get(primaryAgentId)?.name?.trim()
      if (
        backendName &&
        thread.title.trim().toLowerCase() === backendName.toLowerCase()
      ) {
        return displayName
      }

      return thread.title
    },
    [agentsById, displayNamesByAgentId]
  )
  const resolveSenderName = useCallback(
    (message: Message) => {
      if (!message.senderId) {
        return message.senderName
      }

      return displayNamesByAgentId[message.senderId] ?? message.senderName
    },
    [displayNamesByAgentId]
  )
  const buildThreadCopyValue = useCallback(
    (
      copyMessages: Message[],
      options: {
        includeReferences?: boolean
        rangeFromMessage?: Message
      } = {}
    ) => {
      if (!selectedThread) {
        return ""
      }

      const headerLines = [
        `Thread: ${resolveThreadTitle(selectedThread)}`,
        `Type: ${selectedThread.type}`,
        isViewingWrapUpTranscript && viewedWrapUpTranscript
          ? `View: Cycle ${viewedWrapUpTranscript.threadSessionSequenceNumber} transcript`
          : "View: Current chat",
        options.rangeFromMessage
          ? `Range: From ${options.rangeFromMessage.createdAt} by ${resolveSenderName(options.rangeFromMessage)}`
          : null,
      ].filter(Boolean)

      const messageLines = copyMessages.map((message) => {
        const sender = resolveSenderName(message)
        const references =
          options.includeReferences && !message.isFromUser
            ? getMessageDocumentReferences(message.metadata)
            : []
        const referenceLines = references.length
          ? [
              "",
              `Documents referenced (${references.length}):`,
              ...references.map(formatDocumentReferenceForCopy),
            ]
          : []

        return [
          "---",
          `${message.createdAt} | ${sender}${message.isFromUser ? " (user)" : ""}`,
          message.content,
          ...referenceLines,
        ].join("\n")
      })

      return [...headerLines, "", ...messageLines].join("\n")
    },
    [
      isViewingWrapUpTranscript,
      resolveSenderName,
      resolveThreadTitle,
      selectedThread,
      viewedWrapUpTranscript,
    ]
  )
  const threadCopyValue = useMemo(() => {
    if (!selectedThread) {
      return ""
    }

    return buildThreadCopyValue(messages)
  }, [buildThreadCopyValue, messages, selectedThread])
  const threadCopyWithReferencesValue = useMemo(() => {
    if (!selectedThread) {
      return ""
    }

    return buildThreadCopyValue(messages, { includeReferences: true })
  }, [buildThreadCopyValue, messages, selectedThread])
  const canOpenWrapUpReport = Boolean(onOpenWrapUpReport)
  const canCopyThread = Boolean(
    selectedThread &&
    (isDirectThread || isTeamThread || Boolean(threadCopyValue.trim()))
  )
  const handleViewLiveChat = useCallback(() => {
    onViewLiveChatRef.current?.()
  }, [])
  const handleOpenWrapUpReport = useCallback((report: ThreadWrapUpReport) => {
    onOpenWrapUpReportRef.current?.(report)
  }, [])
  const handleCopyThread = useCallback(async () => {
    if (!threadCopyValue.trim()) {
      return
    }

    try {
      await copyTextToClipboard(threadCopyValue)
      setIsThreadCopied(true)
      if (threadCopiedTimeoutRef.current) {
        window.clearTimeout(threadCopiedTimeoutRef.current)
      }
      threadCopiedTimeoutRef.current = window.setTimeout(() => {
        setIsThreadCopied(false)
        threadCopiedTimeoutRef.current = null
      }, 1200)
    } catch {
      setIsThreadCopied(false)
    }
  }, [threadCopyValue])
  const handleCopyThreadWithReferences = useCallback(async () => {
    if (!threadCopyWithReferencesValue.trim()) {
      return
    }

    try {
      await copyTextToClipboard(threadCopyWithReferencesValue)
      setIsThreadWithReferencesCopied(true)
      if (threadWithReferencesCopiedTimeoutRef.current) {
        window.clearTimeout(threadWithReferencesCopiedTimeoutRef.current)
      }
      threadWithReferencesCopiedTimeoutRef.current = window.setTimeout(() => {
        setIsThreadWithReferencesCopied(false)
        threadWithReferencesCopiedTimeoutRef.current = null
      }, 1200)
    } catch {
      setIsThreadWithReferencesCopied(false)
    }
  }, [threadCopyWithReferencesValue])
  const handleCopyThreadFromMessage = useCallback(
    async (message: Message) => {
      const messageIndex = messages.findIndex(
        (entry) => entry.id === message.id
      )
      if (messageIndex < 0) {
        throw new Error("Message not found in thread")
      }

      const copyValue = buildThreadCopyValue(messages.slice(messageIndex), {
        rangeFromMessage: message,
      })
      if (!copyValue.trim()) {
        return
      }

      await copyTextToClipboard(copyValue)
    },
    [buildThreadCopyValue, messages]
  )

  useEffect(() => {
    setIsThreadCopied(false)
    setIsThreadWithReferencesCopied(false)
  }, [threadCopyValue, threadCopyWithReferencesValue])

  useEffect(() => {
    setShowRelayLimitMenu(false)
    setShowCustomRelayLimit(false)
  }, [selectedThreadId])

  useEffect(() => {
    return () => {
      if (threadCopiedTimeoutRef.current) {
        window.clearTimeout(threadCopiedTimeoutRef.current)
      }
      if (threadWithReferencesCopiedTimeoutRef.current) {
        window.clearTimeout(threadWithReferencesCopiedTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (
      !showAddAgent &&
      !showTeamMembers &&
      !showWrapUpHistory &&
      !showRelayLimitMenu
    )
      return

    function handleClick(event: MouseEvent) {
      const target = event.target as Node

      if (
        teamMembersDropdownRef.current &&
        !teamMembersDropdownRef.current.contains(target)
      ) {
        setShowTeamMembers(false)
      }

      if (
        addAgentDropdownRef.current &&
        !addAgentDropdownRef.current.contains(target)
      ) {
        setShowAddAgent(false)
      }

      if (
        wrapUpHistoryDropdownRef.current &&
        !wrapUpHistoryDropdownRef.current.contains(target)
      ) {
        setShowWrapUpHistory(false)
      }

      if (
        relayLimitDropdownRef.current &&
        !relayLimitDropdownRef.current.contains(target)
      ) {
        setShowRelayLimitMenu(false)
        setShowCustomRelayLimit(false)
      }
    }

    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showAddAgent, showRelayLimitMenu, showTeamMembers, showWrapUpHistory])

  useEffect(() => {
    onViewLiveChatRef.current = onViewLiveChat
  }, [onViewLiveChat])

  useEffect(() => {
    onOpenWrapUpReportRef.current = onOpenWrapUpReport
  }, [onOpenWrapUpReport])

  useEffect(() => {
    const bottom = bottomRef.current
    const viewport = bottom?.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!bottom || !viewport) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        isMessageTimelineAtBottomRef.current = entry?.isIntersecting ?? false
      },
      { root: viewport, rootMargin: "0px 0px 96px 0px", threshold: 0 }
    )
    observer.observe(bottom)
    return () => observer.disconnect()
  }, [selectedThreadId])

  useEffect(() => {
    if (!selectedThreadId) {
      previousThreadIdRef.current = null
      isMessageTimelineAtBottomRef.current = true
      setShowWrapUpConfirm(false)
      return
    }

    const threadChanged = previousThreadIdRef.current !== selectedThreadId
    const behavior = threadChanged ? "auto" : "smooth"
    previousThreadIdRef.current = selectedThreadId
    if (!threadChanged && !isMessageTimelineAtBottomRef.current) return

    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" })
    })
  }, [
    selectedThreadId,
    messages.length,
    shouldShowThinking,
    activeRuntimeDispatchSignature,
  ])

  const renderedRuntimeContextUsage = useMemo(
    () =>
      runtimeContextUsageRows.length > 0 ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {runtimeContextUsageRows.map((usage) => {
            const runtimeLabel =
              getRuntimeLabel(usage.runtimeType) ?? usage.runtimeType
            const tone = getContextUsageTone(usage.level)
            const percent =
              usage.percentUsed === null
                ? null
                : Math.max(0, Math.min(100, usage.percentUsed))
            const tokenText =
              usage.contextTokens === null && usage.totalTokens === null
                ? "Token count unknown"
                : `${formatTokenCount(usage.totalTokens)} / ${formatTokenCount(
                    usage.contextTokens
                  )} tokens`
            const detail = [
              usage.agentName,
              runtimeLabel,
              formatContextPercent(usage.percentUsed),
              tokenText,
              usage.references?.length
                ? `Referenced: ${usage.references
                    .map((reference) => reference.title || reference.uri)
                    .slice(0, 5)
                    .join(", ")}`
                : null,
              usage.fresh ? null : "estimate",
            ]
              .filter(Boolean)
              .join(" - ")

            return (
              <div
                key={usage.agentId}
                className={`relative flex h-8 max-w-[7rem] min-w-[4.75rem] shrink-0 items-center gap-1.5 overflow-hidden rounded-[4px] border px-1.5 ${tone.border} ${tone.background}`}
                title={detail}
              >
                <Avatar className="size-5 shrink-0 border border-white/10 bg-white/[0.04]">
                  <AvatarImage src={usage.avatarUrl} />
                  <AvatarFallback className="claw-badge-text">
                    {initials(usage.agentName)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`truncate text-[11px] font-semibold tabular-nums ${tone.text}`}
                >
                  {formatCompactContextPercent(usage.percentUsed)}
                </span>
                {!usage.fresh ? (
                  <span className={`text-[10px] leading-none ${tone.muted}`}>
                    est
                  </span>
                ) : null}
                {usage.references?.length ? (
                  <span className={`text-[10px] leading-none ${tone.muted}`}>
                    {usage.references.length} docs
                  </span>
                ) : null}
                <div className="absolute right-1 bottom-0.5 left-1 h-0.5 overflow-hidden rounded-full bg-black/25">
                  <div
                    className={`h-full rounded-full ${tone.bar}`}
                    style={{ width: `${percent ?? 0}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : null,
    [initials, runtimeContextUsageRows]
  )

  const renderedRuntimeHealth = useMemo(
    () =>
      runtimeHealthRows.length > 0 ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {runtimeHealthRows.map((health) => {
            const runtimeLabel =
              getRuntimeLabel(health.runtimeType) ?? health.runtimeType
            const tone = getRuntimeHealthTone(health.status)
            const detail = [
              health.agentName,
              runtimeLabel,
              health.status,
              health.message,
              relativeTime(health.updatedAt),
            ]
              .filter(Boolean)
              .join(" - ")

            return (
              <div
                key={health.agentId}
                className={`flex h-8 max-w-[11rem] min-w-[6.5rem] shrink-0 items-center gap-1.5 overflow-hidden rounded-[4px] border px-1.5 ${tone.border} ${tone.background}`}
                title={detail}
              >
                <Avatar className="size-5 shrink-0 border border-white/10 bg-white/[0.04]">
                  <AvatarImage src={health.avatarUrl} />
                  <AvatarFallback className="claw-badge-text">
                    {initials(health.agentName)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`truncate text-[11px] font-semibold ${tone.text}`}
                >
                  {runtimeLabel}
                </span>
                <span className={`truncate text-[10px] ${tone.muted}`}>
                  {health.status}
                </span>
              </div>
            )
          })}
        </div>
      ) : null,
    [initials, relativeTime, runtimeHealthRows]
  )

  const renderedMessageHistory = useMemo(
    () => (
      <>
        {isViewingWrapUpTranscript ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-amber-100">
                  {`Viewing Cycle ${viewedWrapUpTranscript?.threadSessionSequenceNumber} transcript`}
                </div>
                <div className="claw-caption mt-1 leading-5 text-amber-50/75">
                  This wrapped-up chat is read-only. Return to the current chat
                  to send new messages.
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canOpenWrapUpReport && viewedWrapUpTranscript ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      handleOpenWrapUpReport(viewedWrapUpTranscript)
                    }
                  >
                    <FileText className="size-3.5" />
                    Open report
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewLiveChat()}
                >
                  Back to current chat
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {syncError && messages.length ? (
          <div className="rounded-[4px] border border-amber-400/20 bg-amber-500/[0.08] px-3 py-2 text-xs leading-5 text-amber-50/80">
            Sync delayed. Showing cached messages while the connection catches
            up.
          </div>
        ) : isSyncing && messages.length ? (
          <div className="rounded-[4px] border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-[var(--claw-text-muted)]">
            Syncing latest message state...
          </div>
        ) : null}
        {loadError ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.08] px-4 py-4">
            <div className="text-sm font-medium text-rose-100">
              {isViewingWrapUpTranscript
                ? "Could not load this wrapped transcript"
                : "Could not load this chat"}
            </div>
            <div className="mt-2 text-sm leading-6 text-rose-50/85">
              {loadError}
            </div>
          </div>
        ) : null}
        {isLoading ? (
          <MessageSkeleton />
        ) : !loadError && messages.length ? (
          <>
            {hasOlderMessages && onLoadOlderMessages ? (
              <div className="flex justify-center py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoadingOlderMessages}
                  onClick={onLoadOlderMessages}
                >
                  <ChevronUp className="size-3.5" />
                  {isLoadingOlderMessages ? "Loading..." : "Load older"}
                </Button>
              </div>
            ) : null}
            {messages.map((message) => {
              const senderAgent = message.senderId
                ? (agentsById.get(message.senderId) ?? null)
                : null
              const runtimeLabel = message.senderId
                ? getRuntimeLabel(
                    getAgentRuntimeType(senderAgent ?? ({} as Agent))
                  )
                : null
              const resolvedAvatarUrl = message.isFromUser
                ? (currentUserAvatarUrl ?? message.senderAvatarUrl ?? undefined)
                : (senderAgent?.avatarUrl ?? undefined)
              const departmentColor = message.isFromUser
                ? undefined
                : getAgentDepartmentColor(senderAgent)
              const agentTone = message.isFromUser
                ? getParticipantMessageStyle(message.senderId, "user")
                : participantTonesBySender[
                    message.senderId || message.senderName
                  ]

              if (isCondensedMode && !message.isFromUser) {
                const condensedMessage = resolveCondensedMessageText(message)
                return (
                  <CondensedAgentMessage
                    key={message.id}
                    senderName={resolveSenderName(message)}
                    createdAt={message.createdAt}
                    text={condensedMessage.text}
                    summaryState={
                      condensedMessage.source === "summary"
                        ? "summary"
                        : condensedMessage.source === "unavailable"
                          ? "unavailable"
                          : "runtime"
                    }
                    runtimeLabel={runtimeLabel}
                    initials={initials}
                    resolvedAvatarUrl={resolvedAvatarUrl}
                    departmentColor={departmentColor}
                    agentTone={agentTone}
                  />
                )
              }

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  senderName={resolveSenderName(message)}
                  runtimeLabel={runtimeLabel}
                  initials={initials}
                  resolvedAvatarUrl={resolvedAvatarUrl}
                  departmentColor={departmentColor}
                  agentTone={agentTone}
                  isManager={
                    !message.isFromUser &&
                    managerAgentIdSet.has(message.senderId)
                  }
                  onCopyFromMessage={handleCopyThreadFromMessage}
                />
              )
            })}
          </>
        ) : !loadError ? (
          <EmptyState
            title="No messages yet"
            description={
              isViewingWrapUpTranscript
                ? "No transcript messages were found for this wrapped-up cycle."
                : isWrappableThread && latestWrappedSequence > 0
                  ? `Cycle ${currentCycleNumber} is now open and empty. The previous conversation is under Cycle ${latestWrappedSequence} transcript.`
                  : "This thread is ready. Start the conversation and the realtime feed will keep the desktop client in sync."
            }
            actions={emptyMessageActions}
          />
        ) : null}
        {shouldShowThinking ? (
          <div className="flex flex-col gap-2">
            {activeThinkingAgents.map((agent) => {
              const tone = participantTonesBySender[agent.id]
              if (isCondensedMode || !showDetailedRuntimeActivity) {
                return (
                  <CondensedAgentMessage
                    key={agent.id}
                    senderName={agent.name}
                    createdAt={new Date().toISOString()}
                    text="Researching"
                    initials={initials}
                    resolvedAvatarUrl={agent.avatarUrl}
                    agentTone={tone}
                    summaryState="runtime"
                  />
                )
              }

              return (
                <div key={agent.id} className="flex justify-start">
                  <div
                    className="w-full rounded-[4px] border px-4 py-3 shadow-none"
                    style={{
                      borderColor:
                        tone?.border ??
                        "var(--agent-card-border-2, rgba(52, 211, 153, 0.22))",
                      backgroundColor:
                        tone?.background ??
                        "var(--agent-card-background-2, rgba(16, 185, 129, 0.08))",
                    }}
                  >
                    <div
                      className="claw-kicker mb-2 flex items-center gap-2 tracking-[0.14em] uppercase"
                      style={{
                        color:
                          tone?.label ??
                          "var(--agent-card-label-2, rgba(209, 250, 229, 0.85))",
                      }}
                    >
                      <Avatar
                        className="h-5 w-5 border"
                        style={{
                          borderColor:
                            tone?.border ??
                            "var(--agent-card-border-2, rgba(52, 211, 153, 0.22))",
                        }}
                      >
                        <AvatarImage src={agent.avatarUrl} />
                        <AvatarFallback
                          className="claw-badge-text"
                          style={{
                            backgroundColor:
                              tone?.avatar ??
                              "var(--agent-card-avatar-2, rgba(52, 211, 153, 0.16))",
                            color:
                              tone?.label ??
                              "var(--agent-card-label-2, rgb(209, 250, 229))",
                          }}
                        >
                          {initials(agent.name)}
                        </AvatarFallback>
                        <DepartmentAvatarBadge
                          color={getAgentDepartmentColor(agent)}
                        />
                      </Avatar>
                      <span>{agent.name} is thinking</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="h-2 w-2 animate-pulse rounded-full"
                          style={{
                            animationDelay: `${dot * 160}ms`,
                            backgroundColor:
                              tone?.label ??
                              "var(--agent-card-label-2, rgba(209, 250, 229, 0.85))",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
        {activeRuntimeDispatches.length > 0 ? (
          <div className="flex flex-col gap-2">
            {activeRuntimeDispatches.map((dispatch) => {
              const agent = agentsById.get(dispatch.agentId)
              const tone = participantTonesBySender[dispatch.agentId]
              const agentName =
                displayNamesByAgentId[dispatch.agentId] ??
                agent?.name ??
                "Agent"
              const agentAvatarUrl = agent?.avatarUrl ?? undefined
              const liveLabel = `${agentName} is still working`
              const condensedRuntimeStatus =
                buildCondensedRuntimeStatus(dispatch)
              const liveStartedAt = dispatch.startedAt ?? dispatch.updatedAt

              if (isCondensedMode) {
                return (
                  <div
                    key={dispatch.dispatchId}
                    aria-label={`Live update. ${liveLabel}`}
                    className="space-y-2 rounded-lg border border-sky-300/20 bg-sky-500/[0.07] px-3 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="relative flex size-2" aria-hidden="true">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-300 opacity-60" />
                        <span className="relative inline-flex size-2 rounded-full bg-sky-300" />
                      </span>
                      <span className="claw-kicker tracking-[0.12em] text-sky-100 uppercase">
                        Live update
                      </span>
                      <RuntimeElapsedTime startedAt={liveStartedAt} />
                    </div>
                    <CondensedAgentMessage
                      senderName={agentName}
                      createdAt={dispatch.updatedAt}
                      text={condensedRuntimeStatus}
                      initials={initials}
                      resolvedAvatarUrl={agentAvatarUrl}
                      departmentColor={getAgentDepartmentColor(agent)}
                      runtimeLabel={getRuntimeLabel(dispatch.runtimeType)}
                      agentTone={tone}
                      summaryState="runtime"
                    />
                    <p className="text-[11px] text-sky-100/60">
                      Still working — the final response will appear when this
                      run finishes.
                    </p>
                    {onCancelRuntimeDispatch ? (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-[11px] text-zinc-200 hover:bg-white/10"
                          onClick={() => onCancelRuntimeDispatch(dispatch)}
                        >
                          <X className="size-3" />
                          <span>Cancel</span>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )
              }

              return (
                <div key={dispatch.dispatchId} className="flex justify-start">
                  <div
                    aria-label={`Live update. ${liveLabel}`}
                    className="w-full space-y-3 rounded-xl border border-sky-300/20 bg-gradient-to-br from-sky-500/[0.09] to-cyan-500/[0.04] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  >
                    <div
                      className="flex items-center gap-2"
                      style={{
                        color:
                          tone?.label ??
                          "var(--agent-card-label-2, rgba(209, 250, 229, 0.85))",
                      }}
                    >
                      <span
                        className="relative flex size-2.5"
                        aria-hidden="true"
                      >
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-300 opacity-60" />
                        <span className="relative inline-flex size-2.5 rounded-full bg-sky-300" />
                      </span>
                      <span className="claw-kicker tracking-[0.14em] text-sky-100 uppercase">
                        Live update
                      </span>
                      <RuntimeElapsedTime startedAt={liveStartedAt} />
                      {onCancelRuntimeDispatch ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="ml-auto h-7 gap-1 px-2 text-[11px] text-zinc-100 hover:bg-white/10"
                          onClick={() => onCancelRuntimeDispatch(dispatch)}
                        >
                          <X className="size-3" />
                          <span>Cancel</span>
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Avatar
                        className="h-5 w-5 border"
                        style={{
                          borderColor:
                            tone?.border ??
                            "var(--agent-card-border-2, rgba(52, 211, 153, 0.22))",
                        }}
                      >
                        <AvatarImage src={agentAvatarUrl} />
                        <AvatarFallback
                          className="claw-badge-text"
                          style={{
                            backgroundColor:
                              tone?.avatar ??
                              "var(--agent-card-avatar-2, rgba(52, 211, 153, 0.16))",
                            color:
                              tone?.label ??
                              "var(--agent-card-label-2, rgb(209, 250, 229))",
                          }}
                        >
                          {initials(agentName)}
                        </AvatarFallback>
                        <DepartmentAvatarBadge
                          color={getAgentDepartmentColor(agent)}
                        />
                      </Avatar>
                      <span className="text-sm font-semibold text-zinc-100">
                        {liveLabel}
                      </span>
                    </div>
                    {dispatch.tasks.length > 0 ? (
                      <RuntimeTodoProgressCard tasks={dispatch.tasks} />
                    ) : null}
                    {dispatch.draftText ? (
                      <RuntimeStreamingMarkdown text={dispatch.draftText} />
                    ) : dispatch.tasks.length === 0 ? (
                      <div
                        aria-label={`${agentName} is thinking`}
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-2"
                        style={{
                          borderColor:
                            tone?.border ??
                            "var(--agent-card-border-2, rgba(52, 211, 153, 0.22))",
                          backgroundColor:
                            tone?.background ??
                            "var(--agent-card-background-2, rgba(16, 185, 129, 0.08))",
                        }}
                      >
                        <span className="text-xs text-zinc-300">Thinking</span>
                        {[0, 1, 2].map((dot) => (
                          <span
                            key={dot}
                            className="h-2 w-2 animate-pulse rounded-full"
                            style={{
                              animationDelay: `${dot * 160}ms`,
                              backgroundColor:
                                tone?.label ??
                                "var(--agent-card-label-2, rgba(209, 250, 229, 0.85))",
                            }}
                          />
                        ))}
                      </div>
                    ) : null}
                    <p className="border-t border-sky-200/10 pt-2 text-xs text-sky-100/60">
                      This is an interim update. The final response will appear
                      as a normal message when the run finishes.
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
        {failedRuntimeDispatches.length > 0 ? (
          <div className="flex flex-col gap-2">
            {failedRuntimeDispatches.map((dispatch) => {
              const agent = agentsById.get(dispatch.agentId)
              const agentName =
                displayNamesByAgentId[dispatch.agentId] ??
                agent?.name ??
                "Agent"
              const agentAvatarUrl = agent?.avatarUrl ?? undefined
              const runtimeLabel =
                getRuntimeLabel(dispatch.runtimeType) ?? dispatch.runtimeType
              const isCancelled = dispatch.status === "cancelled"
              const isOfflineFailure =
                dispatch.errorCode === "openclaw_runtime_offline" ||
                dispatch.errorCode === "openclaw_agent_not_live"
              const headline = isCancelled
                ? `${agentName} was cancelled`
                : isOfflineFailure
                  ? `${agentName} is unavailable right now`
                  : `${agentName} could not reply`
              const detail =
                dispatch.errorMessage ||
                dispatch.statusMessage ||
                (isCancelled
                  ? "The runtime dispatch was cancelled before a reply was posted."
                  : "The runtime dispatch failed before a reply was posted.")
              const canRetry =
                dispatch.status === "failed" &&
                dispatch.retryable === true &&
                Boolean(dispatch.messageId) &&
                Boolean(onRetryRuntimeDispatch)

              return (
                <div key={dispatch.dispatchId} className="flex justify-start">
                  <div className="w-full rounded-[4px] border border-rose-400/20 bg-rose-500/[0.08] px-4 py-3 shadow-none">
                    <div className="claw-kicker mb-2 flex items-center gap-2 tracking-[0.14em] text-rose-200/85 uppercase">
                      <Avatar className="h-5 w-5 border border-rose-300/20">
                        <AvatarImage src={agentAvatarUrl} />
                        <AvatarFallback className="claw-badge-text bg-rose-400/15 text-rose-100">
                          {initials(agentName)}
                        </AvatarFallback>
                        <DepartmentAvatarBadge
                          color={getAgentDepartmentColor(agent)}
                        />
                      </Avatar>
                      <span>{headline}</span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-rose-50/90">
                      {detail}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge className="rounded-[4px] border-rose-300/20 bg-rose-500/10 text-rose-50">
                        {runtimeLabel}
                      </Badge>
                      {dispatch.errorCode ? (
                        <Badge className="rounded-[4px] border-rose-300/20 bg-rose-500/10 text-rose-50">
                          {dispatch.errorCode}
                        </Badge>
                      ) : null}
                      {dispatch.retryable ? (
                        <Badge className="rounded-[4px] border-amber-300/25 bg-amber-500/10 text-amber-50">
                          Retryable
                        </Badge>
                      ) : null}
                      {canRetry ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 border-rose-300/25 bg-rose-950/20 px-2 text-xs text-rose-50 hover:bg-rose-400/10"
                          onClick={() => onRetryRuntimeDispatch?.(dispatch)}
                        >
                          <RotateCcw className="size-3" />
                          <span>Retry</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </>
    ),
    [
      activeRuntimeDispatches,
      activeThinkingAgents,
      participantTonesBySender,
      agentsById,
      currentCycleNumber,
      currentUserAvatarUrl,
      displayNamesByAgentId,
      failedRuntimeDispatches,
      getAgentDepartmentColor,
      handleCopyThreadFromMessage,
      handleOpenWrapUpReport,
      handleViewLiveChat,
      hasOlderMessages,
      initials,
      isCondensedMode,
      showDetailedRuntimeActivity,
      isLoading,
      isLoadingOlderMessages,
      isSyncing,
      isWrappableThread,
      isViewingWrapUpTranscript,
      emptyMessageActions,
      latestWrappedSequence,
      loadError,
      managerAgentIdSet,
      messages,
      onCancelRuntimeDispatch,
      onLoadOlderMessages,
      onRetryRuntimeDispatch,
      canOpenWrapUpReport,
      resolveSenderName,
      shouldShowThinking,
      syncError,
      viewedWrapUpTranscript,
    ]
  )

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[var(--claw-bg-page)]">
      <div className="flex h-full min-h-0 flex-col">
        {selectedThread ? (
          <>
            <div
              className={`shrink-0 px-4 ${
                isDirectThread || isTeamThread ? "h-[52px] pb-1.5" : "h-14"
              }`}
            >
              {isDirectThread ? (
                <div className="flex h-full w-full items-end justify-between gap-3">
                  <Avatar
                    className="size-[22px] shrink-0 bg-[var(--claw-bg-surface)]"
                    title={resolveThreadTitle(selectedThread)}
                  >
                    <AvatarImage
                      src={
                        (selectedThread.agentIds[0]
                          ? agentsById.get(selectedThread.agentIds[0])
                              ?.avatarUrl
                          : undefined) ?? selectedThreadAvatarUrl
                      }
                    />
                    <AvatarFallback className="claw-badge-text">
                      {initials(resolveThreadTitle(selectedThread))}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex min-w-0 shrink-0 items-center gap-1.5">
                    {wrapUpReports.length > 0 ? (
                      <div
                        className="relative shrink-0"
                        ref={wrapUpHistoryDropdownRef}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowRelayLimitMenu(false)
                            setShowCustomRelayLimit(false)
                            setShowWrapUpHistory((value) => !value)
                          }}
                          className="flex h-[26px] min-w-14 items-center justify-center gap-1 rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] px-2.5 text-[11px] font-semibold text-[var(--claw-text-primary)]"
                          title="Open transcript history"
                          aria-label="Open transcript history"
                          aria-expanded={showWrapUpHistory}
                        >
                          <FileText className="size-3" />
                          <span>{wrapUpReports.length}</span>
                          <ChevronDown className="size-2.5" />
                        </button>
                        {showWrapUpHistory ? (
                          <div className="absolute top-full right-0 z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-[4px] border border-white/10 bg-[var(--claw-bg-page)] shadow-xl">
                            {wrapUpReports.map((report) => {
                              const isSelected =
                                selectedWrapUpReportId === report.id
                              const sequenceNumber =
                                report.threadSessionSequenceNumber ?? "?"

                              return (
                                <button
                                  key={report.id}
                                  type="button"
                                  onClick={() => {
                                    onViewWrapUpTranscript?.(report)
                                    setShowWrapUpHistory(false)
                                  }}
                                  className={`claw-caption flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition ${
                                    isSelected
                                      ? "bg-amber-500/[0.12] text-amber-100"
                                      : "text-zinc-300 hover:bg-white/[0.06]"
                                  }`}
                                >
                                  <span>{`Cycle ${sequenceNumber} transcript`}</span>
                                  <FileText className="size-3 shrink-0" />
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className="flex size-[26px] items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-primary)] disabled:opacity-40"
                      disabled={!canCopyThread}
                      onClick={() => void handleCopyThread()}
                      title="Copy thread"
                      aria-label="Copy thread"
                    >
                      <Copy className="size-3" />
                    </button>

                    {onWrapUpThread ? (
                      <button
                        type="button"
                        className="flex size-[26px] items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-primary)] disabled:opacity-40"
                        disabled={
                          isWrappingUpThread ||
                          isViewingWrapUpTranscript ||
                          isLoading ||
                          messages.length === 0
                        }
                        onClick={() => setShowWrapUpConfirm(true)}
                        title="Wrap up and reset"
                        aria-label="Wrap up and reset"
                      >
                        <RotateCcw className="size-3" />
                      </button>
                    ) : null}

                    <span className="mx-1 h-6 w-px bg-[color-mix(in_srgb,var(--claw-border)_28%,transparent)]" />

                    <button
                      type="button"
                      onClick={() => {
                        if (isViewingWrapUpTranscript) onViewLiveChat?.()
                      }}
                      className="flex h-[26px] min-w-[42px] items-center justify-center gap-1 rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] px-2.5 text-[11px] font-semibold text-[var(--claw-text-primary)] tabular-nums"
                      title={`Current chat, cycle ${currentCycleNumber}`}
                      aria-label={`Current chat, cycle ${currentCycleNumber}`}
                    >
                      <MessageSquare className="size-3" />
                      <span>{currentCycleNumber}</span>
                    </button>

                    {runtimeContextUsageRows.map((usage) => {
                      const usageLabel =
                        usage.percentUsed === null
                          ? "?"
                          : `${usage.fresh ? "" : "~"}${Math.round(
                              usage.percentUsed
                            )}%`
                      const runtimeLabel =
                        getRuntimeLabel(usage.runtimeType) ?? usage.runtimeType
                      const detail = [
                        usage.agentName,
                        runtimeLabel,
                        formatContextPercent(usage.percentUsed),
                        usage.totalTokens !== null ||
                        usage.contextTokens !== null
                          ? `${formatTokenCount(usage.totalTokens)} / ${formatTokenCount(
                              usage.contextTokens
                            )} tokens`
                          : "Token count unknown",
                        usage.fresh ? null : "estimate",
                      ]
                        .filter(Boolean)
                        .join(" - ")

                      return (
                        <div
                          key={usage.agentId}
                          className="flex h-[26px] w-[50px] items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] px-2.5 text-[11px] font-semibold text-[var(--claw-text-primary)] tabular-nums"
                          title={detail}
                          aria-label={detail}
                        >
                          {usageLabel}
                        </div>
                      )
                    })}

                    <div
                      className="flex h-[26px] min-w-[42px] items-center justify-center gap-1 rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] px-2.5 text-[11px] font-semibold text-[var(--claw-text-primary)] tabular-nums"
                      title={`${messages.length} messages`}
                      aria-label={`${messages.length} messages`}
                    >
                      <MessageSquareText className="size-3" />
                      <span>{messages.length}</span>
                    </div>
                  </div>
                </div>
              ) : isTeamThread ? (
                <div className="flex h-full w-full items-end justify-between gap-3">
                  <div
                    className="flex min-w-[22px] shrink-0 items-center gap-1.5"
                    aria-label="Team participants"
                  >
                    {teamMembers.slice(0, 4).map((agent) => {
                      const agentName =
                        displayNamesByAgentId[agent.id] ?? agent.name

                      return (
                        <Avatar
                          key={agent.id}
                          className="size-[22px] shrink-0 border border-[var(--claw-bg-page)] bg-[var(--claw-bg-surface)]"
                          title={agentName}
                        >
                          <AvatarImage src={agent.avatarUrl ?? undefined} />
                          <AvatarFallback className="claw-badge-text text-[8px]">
                            {initials(agentName)}
                          </AvatarFallback>
                        </Avatar>
                      )
                    })}
                  </div>

                  <div className="flex min-w-0 shrink-0 items-center gap-1.5">
                    {wrapUpReports.length > 0 ? (
                      <div
                        className="relative shrink-0"
                        ref={wrapUpHistoryDropdownRef}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowRelayLimitMenu(false)
                            setShowCustomRelayLimit(false)
                            setShowWrapUpHistory((value) => !value)
                          }}
                          className="flex h-[26px] min-w-14 items-center justify-center gap-1 rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] px-2.5 text-[11px] font-semibold text-[var(--claw-text-primary)]"
                          title="Open transcript history"
                          aria-label="Open transcript history"
                          aria-expanded={showWrapUpHistory}
                        >
                          <FileText className="size-3" />
                          <span>{wrapUpReports.length}</span>
                          <ChevronDown className="size-2.5" />
                        </button>
                        {showWrapUpHistory ? (
                          <div className="absolute top-full right-0 z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-[4px] border border-white/10 bg-[var(--claw-bg-page)] shadow-xl">
                            {wrapUpReports.map((report) => {
                              const isSelected =
                                selectedWrapUpReportId === report.id
                              const sequenceNumber =
                                report.threadSessionSequenceNumber ?? "?"
                              const statusLabel =
                                report.status === "generating"
                                  ? "generating"
                                  : report.status === "failed"
                                    ? "failed"
                                    : null

                              return (
                                <button
                                  key={report.id}
                                  type="button"
                                  onClick={() => {
                                    onViewWrapUpTranscript?.(report)
                                    setShowWrapUpHistory(false)
                                  }}
                                  className={`claw-caption flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition ${
                                    isSelected
                                      ? "bg-amber-500/[0.12] text-amber-100"
                                      : "text-zinc-300 hover:bg-white/[0.06]"
                                  }`}
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate">{`Cycle ${sequenceNumber} transcript`}</span>
                                    {statusLabel ? (
                                      <span className="claw-kicker block text-zinc-500">
                                        {statusLabel}
                                      </span>
                                    ) : null}
                                  </span>
                                  <FileText className="size-3 shrink-0" />
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {activeThreadSessionId ? (
                      <>
                        <button
                          type="button"
                          className="flex size-[26px] shrink-0 items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-primary)] disabled:opacity-40"
                          disabled={
                            isTeamRelayLoading ||
                            isTeamRelayMutating ||
                            !teamRelay
                          }
                          onClick={() => {
                            if (!selectedThreadId || !teamRelay) return
                            void mutateTeamRelay(() =>
                              teamRelay.runState === "paused"
                                ? sdk.messages.continueTeamRelay(
                                    selectedThreadId
                                  )
                                : sdk.messages.pauseTeamRelay(selectedThreadId)
                            )
                          }}
                          title={
                            teamRelay?.runState === "paused"
                              ? "Continue team relay"
                              : "Pause team relay"
                          }
                          aria-label={
                            teamRelay?.runState === "paused"
                              ? "Continue team relay"
                              : "Pause team relay"
                          }
                        >
                          {teamRelay?.runState === "paused" ? (
                            <Play className="size-3 fill-current" />
                          ) : (
                            <Pause className="size-3 fill-current" />
                          )}
                        </button>

                        <div
                          className="relative shrink-0"
                          ref={relayLimitDropdownRef}
                        >
                          <button
                            type="button"
                            disabled={isTeamRelayLoading || isTeamRelayMutating}
                            onClick={() => {
                              setShowWrapUpHistory(false)
                              setShowRelayLimitMenu((value) => !value)
                              setShowCustomRelayLimit(false)
                            }}
                            className="flex h-[26px] min-w-[78px] items-center justify-center gap-1 rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] px-2.5 text-[11px] font-semibold text-[var(--claw-text-primary)] tabular-nums disabled:opacity-40"
                            title={teamRelayError ?? "Team relay reply limit"}
                            aria-label="Team relay reply limit"
                            aria-expanded={showRelayLimitMenu}
                          >
                            <Clock className="size-3" />
                            <span>
                              {teamRelay
                                ? `${teamRelay.replyCount}/${teamRelay.replyLimit}`
                                : "—/—"}
                            </span>
                            <ChevronDown className="size-2.5" />
                          </button>

                          {showRelayLimitMenu ? (
                            <div className="absolute top-full right-0 z-50 mt-1 w-44 overflow-hidden rounded-[4px] border border-white/10 bg-[var(--claw-bg-page)] p-1 shadow-xl">
                              {showCustomRelayLimit ? (
                                <div className="space-y-2 p-2">
                                  <label
                                    htmlFor="team-relay-custom-limit"
                                    className="claw-caption block font-semibold text-zinc-300"
                                  >
                                    Reply limit
                                  </label>
                                  <input
                                    id="team-relay-custom-limit"
                                    type="number"
                                    min={1}
                                    max={100000}
                                    value={customRelayLimit}
                                    onChange={(event) =>
                                      setCustomRelayLimit(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === "Enter" &&
                                        applyCustomRelayLimit()
                                      ) {
                                        setShowRelayLimitMenu(false)
                                        setShowCustomRelayLimit(false)
                                      }
                                    }}
                                    className="h-8 w-full rounded-[4px] border border-white/10 bg-zinc-950 px-2 text-xs text-zinc-200"
                                    autoFocus
                                  />
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShowCustomRelayLimit(false)
                                      }
                                      className="h-7 rounded-[4px] px-2 text-[11px] font-medium text-zinc-400 hover:bg-white/[0.06]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (applyCustomRelayLimit()) {
                                          setShowRelayLimitMenu(false)
                                          setShowCustomRelayLimit(false)
                                        }
                                      }}
                                      className="h-7 rounded-[4px] bg-white/[0.08] px-2 text-[11px] font-semibold text-zinc-100 hover:bg-white/[0.12]"
                                    >
                                      Apply
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {[
                                    25, 50, 100, 200, 400, 800, 1500, 3000,
                                    5000, 10000,
                                  ].map((limit) => (
                                    <button
                                      key={limit}
                                      type="button"
                                      onClick={() => {
                                        if (!selectedThreadId) return
                                        void mutateTeamRelay(() =>
                                          sdk.messages.updateTeamRelay(
                                            selectedThreadId,
                                            limit
                                          )
                                        )
                                        setShowRelayLimitMenu(false)
                                      }}
                                      className="claw-caption flex h-8 w-full items-center justify-between rounded-[3px] px-2 text-left text-zinc-300 hover:bg-white/[0.06]"
                                    >
                                      <span>{limit}</span>
                                      {teamRelay?.replyLimit === limit ? (
                                        <Check className="size-3" />
                                      ) : null}
                                    </button>
                                  ))}
                                  <div className="my-1 h-px bg-white/10" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomRelayLimit(
                                        String(teamRelay?.replyLimit ?? 50)
                                      )
                                      setShowCustomRelayLimit(true)
                                    }}
                                    className="claw-caption flex h-8 w-full items-center rounded-[3px] px-2 text-left text-zinc-300 hover:bg-white/[0.06]"
                                  >
                                    Custom…
                                  </button>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}

                    <button
                      type="button"
                      className="flex size-[26px] shrink-0 items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-primary)] disabled:opacity-40"
                      disabled={!canCopyThread}
                      onClick={() => void handleCopyThread()}
                      title={isThreadCopied ? "Copied thread" : "Copy thread"}
                      aria-label={
                        isThreadCopied ? "Copied thread" : "Copy thread"
                      }
                    >
                      {isThreadCopied ? (
                        <Check className="size-3" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>

                    {onWrapUpThread ? (
                      <button
                        type="button"
                        className="flex size-[26px] shrink-0 items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-primary)] disabled:opacity-40"
                        disabled={
                          isWrappingUpThread ||
                          isViewingWrapUpTranscript ||
                          isLoading ||
                          messages.length === 0
                        }
                        onClick={() => setShowWrapUpConfirm(true)}
                        title="Wrap up and reset"
                        aria-label="Wrap up and reset"
                      >
                        <RotateCcw className="size-3" />
                      </button>
                    ) : null}

                    <span className="mx-1 h-6 w-px shrink-0 bg-[color-mix(in_srgb,var(--claw-border)_28%,transparent)]" />

                    <button
                      type="button"
                      onClick={() => {
                        if (isViewingWrapUpTranscript) onViewLiveChat?.()
                      }}
                      className="flex h-[26px] min-w-[42px] shrink-0 items-center justify-center gap-1 rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] px-2.5 text-[11px] font-semibold text-[var(--claw-text-primary)] tabular-nums"
                      title={`Current chat, cycle ${currentCycleNumber}`}
                      aria-label={`Current chat, cycle ${currentCycleNumber}`}
                    >
                      <MessageSquare className="size-3" />
                      <span>{currentCycleNumber}</span>
                    </button>

                    {runtimeContextUsageRows.map((usage) => {
                      const usageLabel =
                        usage.percentUsed === null
                          ? "?"
                          : `${usage.fresh ? "" : "~"}${Math.round(
                              usage.percentUsed
                            )}%`
                      const runtimeLabel =
                        getRuntimeLabel(usage.runtimeType) ?? usage.runtimeType
                      const detail = [
                        usage.agentName,
                        runtimeLabel,
                        formatContextPercent(usage.percentUsed),
                        usage.totalTokens !== null ||
                        usage.contextTokens !== null
                          ? `${formatTokenCount(usage.totalTokens)} / ${formatTokenCount(
                              usage.contextTokens
                            )} tokens`
                          : "Token count unknown",
                        usage.references?.length
                          ? `${usage.references.length} docs`
                          : null,
                        usage.fresh ? null : "estimate",
                      ]
                        .filter(Boolean)
                        .join(" - ")
                      const chipWidth =
                        runtimeContextUsageRows.length <= 3
                          ? 50
                          : runtimeContextUsageRows.length <= 6
                            ? 48
                            : 46

                      return (
                        <div
                          key={usage.agentId}
                          className="flex h-[26px] shrink-0 items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] px-2 text-[11px] font-semibold text-[var(--claw-text-primary)] tabular-nums"
                          style={{ width: chipWidth }}
                          title={detail}
                          aria-label={detail}
                        >
                          {usageLabel}
                        </div>
                      )
                    })}

                    <div
                      className="flex h-[26px] min-w-[42px] shrink-0 items-center justify-center gap-1 rounded-[5px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-inset)] px-2.5 text-[11px] font-semibold text-[var(--claw-text-primary)] tabular-nums"
                      title={`${messages.length} messages`}
                      aria-label={`${messages.length} messages`}
                    >
                      <MessageSquareText className="size-3" />
                      <span>{messages.length}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-between gap-3">
                  <div className="claw-caption flex min-w-0 flex-1 items-center gap-1.5 text-zinc-400">
                    {onUpdateAvatarUrl ? (
                      <div className="group relative shrink-0">
                        <input
                          ref={avatarFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarFileChange}
                        />
                        <Avatar
                          className="size-8 cursor-pointer border border-[var(--claw-border)] bg-[var(--claw-bg-surface)]"
                          onClick={() => avatarFileRef.current?.click()}
                        >
                          <AvatarImage src={selectedThreadAvatarUrl} />
                          <AvatarFallback className="claw-badge-text">
                            {isUploadingAvatar
                              ? "..."
                              : initials(resolveThreadTitle(selectedThread))}
                          </AvatarFallback>
                        </Avatar>
                        <button
                          type="button"
                          onClick={() => avatarFileRef.current?.click()}
                          className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full border border-white/10 bg-zinc-950 opacity-0 transition-opacity group-hover:opacity-100"
                          title="Update thread avatar"
                          aria-label="Update thread avatar"
                        >
                          <Pencil className="size-2 text-zinc-300" />
                        </button>
                      </div>
                    ) : null}
                    <span className="min-w-0 truncate text-base font-semibold text-[var(--claw-text-primary)]">
                      {resolveThreadTitle(selectedThread)}
                    </span>
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-[4px] border border-white/10 bg-white/[0.03] text-[var(--claw-text-muted)]"
                      title={selectedThread.type.replaceAll("_", " ")}
                      aria-label={selectedThread.type.replaceAll("_", " ")}
                    >
                      {isTeamThread ? (
                        <Users className="size-3.5" />
                      ) : (
                        <MessageSquare className="size-3.5" />
                      )}
                    </span>
                    <span
                      className="hidden size-7 shrink-0 items-center justify-center rounded-[4px] border border-white/10 bg-white/[0.03] text-[var(--claw-text-muted)] lg:flex"
                      title={`Updated ${relativeTime(selectedThread.updatedAt)}`}
                      aria-label={`Updated ${relativeTime(selectedThread.updatedAt)}`}
                    >
                      <Clock className="size-3.5" />
                    </span>
                    {teamManager ? (
                      <span
                        className="hidden size-7 shrink-0 items-center justify-center rounded-[4px] border border-[#4f91e8]/35 bg-[#4f91e8]/10 text-[#b9d6f8] lg:flex"
                        title={`Manager: ${teamManager.name}`}
                        aria-label={`Manager: ${teamManager.name}`}
                      >
                        <Crown className="size-3.5" />
                      </span>
                    ) : null}
                    {isWrappableThread && activeThreadSessionId ? (
                      <button
                        type="button"
                        onClick={() => onViewLiveChat?.()}
                        className={`flex h-8 shrink-0 items-center gap-1 rounded-[4px] border px-2 text-xs font-medium transition ${
                          isViewingWrapUpTranscript
                            ? "text-[var(--claw-text-muted)] hover:text-[var(--claw-text-primary)]"
                            : "text-[#b9d6f8]"
                        }`}
                        style={{
                          borderColor: isViewingWrapUpTranscript
                            ? "color-mix(in srgb, var(--claw-border) 34%, transparent)"
                            : "color-mix(in srgb, var(--claw-accent-blue) 48%, transparent)",
                          backgroundColor: isViewingWrapUpTranscript
                            ? "var(--claw-bg-surface)"
                            : "color-mix(in srgb, var(--claw-accent-blue) 12%, var(--claw-bg-surface))",
                        }}
                        title={`Current chat, cycle ${currentCycleNumber}`}
                        aria-label={`Current chat, cycle ${currentCycleNumber}`}
                      >
                        <MessageSquare className="size-3.5" />
                        <span>{currentCycleNumber}</span>
                      </button>
                    ) : null}
                    {isWrappableThread && wrapUpReports.length > 0 ? (
                      <div
                        className="relative shrink-0"
                        ref={wrapUpHistoryDropdownRef}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setShowWrapUpHistory((value) => !value)
                          }
                          className={`flex h-8 items-center gap-1 rounded-[4px] border px-2 text-xs font-medium transition ${
                            isViewingWrapUpTranscript
                              ? "text-amber-100"
                              : "text-[var(--claw-text-muted)] hover:text-[var(--claw-text-primary)]"
                          }`}
                          style={{
                            borderColor: isViewingWrapUpTranscript
                              ? "rgba(251, 191, 36, 0.3)"
                              : "color-mix(in srgb, var(--claw-border) 34%, transparent)",
                            backgroundColor: isViewingWrapUpTranscript
                              ? "rgba(245, 158, 11, 0.12)"
                              : "var(--claw-bg-surface)",
                          }}
                          title="Open transcript history"
                          aria-label="Open transcript history"
                          aria-expanded={showWrapUpHistory}
                        >
                          <FileText className="size-3.5" />
                          <span>{wrapUpReports.length}</span>
                          <ChevronDown className="size-3" />
                        </button>
                        {showWrapUpHistory ? (
                          <div className="absolute top-full left-0 z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-[4px] border border-white/10 bg-[var(--claw-bg-page)] shadow-xl">
                            {wrapUpReports.map((report) => {
                              const isSelected =
                                selectedWrapUpReportId === report.id
                              const sequenceNumber =
                                report.threadSessionSequenceNumber ?? "?"
                              const statusLabel =
                                report.status === "generating"
                                  ? "generating"
                                  : report.status === "failed"
                                    ? "failed"
                                    : null

                              return (
                                <button
                                  key={report.id}
                                  type="button"
                                  onClick={() => {
                                    onViewWrapUpTranscript?.(report)
                                    setShowWrapUpHistory(false)
                                  }}
                                  className={`claw-caption flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition ${
                                    isSelected
                                      ? "bg-amber-500/[0.12] text-amber-100"
                                      : "text-zinc-300 hover:bg-white/[0.06]"
                                  }`}
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate">{`Cycle ${sequenceNumber} transcript`}</span>
                                    {statusLabel ? (
                                      <span className="claw-kicker block text-zinc-500">
                                        {statusLabel}
                                      </span>
                                    ) : null}
                                  </span>
                                  <FileText className="size-3 shrink-0" />
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 shrink-0 items-center gap-2">
                    {isTeamThread && activeThreadSessionId ? (
                      <div
                        className="flex h-8 shrink-0 items-center gap-1 rounded-[4px] border border-white/10 bg-[var(--claw-bg-surface)] px-1.5"
                        title={teamRelayError ?? "Team relay reply controls"}
                      >
                        <button
                          type="button"
                          className="rounded px-1.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50"
                          disabled={
                            isTeamRelayLoading ||
                            isTeamRelayMutating ||
                            !teamRelay
                          }
                          onClick={() => {
                            if (!selectedThreadId || !teamRelay) return
                            void mutateTeamRelay(() =>
                              teamRelay.runState === "paused"
                                ? sdk.messages.continueTeamRelay(
                                    selectedThreadId
                                  )
                                : sdk.messages.pauseTeamRelay(selectedThreadId)
                            )
                          }}
                          aria-label={
                            teamRelay?.runState === "paused"
                              ? "Continue team relay"
                              : "Pause team relay"
                          }
                        >
                          {isTeamRelayLoading
                            ? "…"
                            : teamRelay?.runState === "paused"
                              ? "Continue"
                              : "Pause"}
                        </button>
                        <span
                          className="min-w-12 text-center text-xs text-zinc-400 tabular-nums"
                          aria-label="Team relay reply count and limit"
                        >
                          {teamRelay
                            ? `${teamRelay.replyCount}/${teamRelay.replyLimit}`
                            : "—/—"}
                        </span>
                        <select
                          className="h-6 max-w-20 rounded border border-white/10 bg-zinc-950 px-1 text-xs text-zinc-300 disabled:opacity-50"
                          aria-label="Team relay reply limit preset"
                          value={
                            teamRelay &&
                            [
                              25, 50, 100, 200, 400, 800, 1500, 3000, 5000,
                              10000,
                            ].includes(teamRelay.replyLimit)
                              ? String(teamRelay.replyLimit)
                              : "custom"
                          }
                          disabled={isTeamRelayLoading || isTeamRelayMutating}
                          onChange={(event) => {
                            if (
                              !selectedThreadId ||
                              event.target.value === "custom"
                            )
                              return
                            void mutateTeamRelay(() =>
                              sdk.messages.updateTeamRelay(
                                selectedThreadId,
                                Number(event.target.value)
                              )
                            )
                          }}
                        >
                          {[
                            25, 50, 100, 200, 400, 800, 1500, 3000, 5000, 10000,
                          ].map((limit) => (
                            <option key={limit} value={limit}>
                              {limit}
                            </option>
                          ))}
                          <option value="custom">Custom</option>
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={100000}
                          value={customRelayLimit}
                          onChange={(event) =>
                            setCustomRelayLimit(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") applyCustomRelayLimit()
                          }}
                          className="h-6 w-16 rounded border border-white/10 bg-zinc-950 px-1 text-xs text-zinc-300 disabled:opacity-50"
                          aria-label="Custom team relay reply limit"
                          disabled={isTeamRelayLoading || isTeamRelayMutating}
                        />
                        <button
                          type="button"
                          onClick={applyCustomRelayLimit}
                          disabled={isTeamRelayLoading || isTeamRelayMutating}
                          className="rounded px-1 py-1 text-[10px] font-medium text-zinc-400 hover:bg-white/[0.08] disabled:opacity-50"
                        >
                          Set
                        </button>
                      </div>
                    ) : null}
                    {renderedRuntimeHealth ? (
                      <div className="hidden max-w-[24rem] min-w-0 shrink items-center xl:flex">
                        {renderedRuntimeHealth}
                      </div>
                    ) : null}
                    {renderedRuntimeContextUsage ? (
                      <div className="hidden max-w-[30rem] min-w-0 shrink items-center xl:flex">
                        {renderedRuntimeContextUsage}
                      </div>
                    ) : null}
                    {isTeamThread && teamMembers.length ? (
                      <div
                        className="relative shrink"
                        ref={teamMembersDropdownRef}
                      >
                        <button
                          type="button"
                          onClick={() => setShowTeamMembers((value) => !value)}
                          className="flex h-8 min-w-0 shrink items-center gap-1.5 overflow-hidden rounded-[4px] border bg-[var(--claw-bg-surface)] px-2"
                          style={{
                            borderColor:
                              "color-mix(in srgb, var(--claw-border) 34%, transparent)",
                          }}
                          title="Show team members"
                          aria-label="Show team members"
                          aria-expanded={showTeamMembers}
                        >
                          <div className="flex -space-x-2">
                            {teamMembers.slice(0, 3).map((agent) => (
                              <Avatar
                                key={agent.id}
                                className="size-6 border-2 border-[var(--claw-bg-surface)] bg-white/[0.04]"
                                title={agent.name}
                              >
                                <AvatarImage
                                  src={agent.avatarUrl ?? undefined}
                                />
                                <AvatarFallback className="claw-badge-text">
                                  {initials(agent.name)}
                                </AvatarFallback>
                                <DepartmentAvatarBadge
                                  color={getAgentDepartmentColor(agent)}
                                />
                              </Avatar>
                            ))}
                          </div>
                          <span className="claw-badge-text text-[var(--claw-text-muted)]">
                            {teamMembers.length}
                          </span>
                          <ChevronDown className="size-3.5 shrink-0 text-[var(--claw-text-muted)]" />
                        </button>
                        {showTeamMembers ? (
                          <div className="absolute top-full right-0 z-50 mt-1 w-64 overflow-hidden rounded-[4px] border border-white/10 bg-[var(--claw-bg-page)] shadow-xl">
                            <div className="claw-kicker border-b border-white/10 px-3 py-2 font-medium tracking-[0.16em] text-zinc-500 uppercase">
                              Team members
                            </div>
                            <div className="max-h-72 overflow-y-auto py-1">
                              {teamMembers.map((agent) => (
                                <div
                                  key={agent.id}
                                  className="claw-caption flex items-center gap-2 px-3 py-2 text-zinc-300"
                                >
                                  <Avatar className="size-5 shrink-0">
                                    <AvatarImage
                                      src={agent.avatarUrl ?? undefined}
                                    />
                                    <AvatarFallback className="claw-badge-text">
                                      {initials(agent.name)}
                                    </AvatarFallback>
                                    <DepartmentAvatarBadge
                                      color={getAgentDepartmentColor(agent)}
                                    />
                                  </Avatar>
                                  <span className="min-w-0 flex-1 truncate">
                                    {agent.name}
                                  </span>
                                  {managerAgentIdSet.has(agent.id) ? (
                                    <Badge
                                      variant="secondary"
                                      className="claw-kicker h-5 shrink-0 rounded-full border px-2 font-medium text-[#b9d6f8]"
                                      style={{
                                        borderColor:
                                          "color-mix(in srgb, var(--claw-accent-blue) 42%, transparent)",
                                        backgroundColor:
                                          "color-mix(in srgb, var(--claw-accent-blue) 10%, transparent)",
                                      }}
                                    >
                                      Manager
                                    </Badge>
                                  ) : null}
                                  {onRemoveAgentFromTeam ? (
                                    <button
                                      type="button"
                                      disabled={isUpdatingTeamMembers}
                                      onClick={() =>
                                        onRemoveAgentFromTeam(agent.id)
                                      }
                                      className="flex size-6 items-center justify-center rounded-[4px] text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100"
                                      title={`Remove ${agent.name} from this team`}
                                      aria-label={`Remove ${agent.name} from this team`}
                                    >
                                      <X className="size-3" />
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                              {onAddAgentToTeam &&
                              agentsNotInTeam.length > 0 ? (
                                <>
                                  <div className="claw-kicker mt-1 border-t border-white/10 px-3 py-2 font-medium tracking-[0.16em] text-zinc-500 uppercase">
                                    Add agents
                                  </div>
                                  {agentsNotInTeam.map((agent) => {
                                    const blocksSecondManager =
                                      selectedThread?.type === "team" &&
                                      teamHasManager &&
                                      managerAgentIdSet.has(agent.id)
                                    return (
                                      <button
                                        key={agent.id}
                                        type="button"
                                        disabled={
                                          isUpdatingTeamMembers ||
                                          blocksSecondManager
                                        }
                                        onClick={() => {
                                          if (blocksSecondManager) return
                                          onAddAgentToTeam(agent.id)
                                          setShowTeamMembers(false)
                                        }}
                                        className="claw-caption flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                                        title={
                                          blocksSecondManager
                                            ? "Team chats allow one manager"
                                            : undefined
                                        }
                                      >
                                        <Avatar className="size-5 shrink-0">
                                          <AvatarImage
                                            src={agent.avatarUrl ?? undefined}
                                          />
                                          <AvatarFallback className="claw-badge-text">
                                            {initials(agent.name)}
                                          </AvatarFallback>
                                          <DepartmentAvatarBadge
                                            color={getAgentDepartmentColor(
                                              agent
                                            )}
                                          />
                                        </Avatar>
                                        <span className="min-w-0 flex-1 truncate">
                                          {agent.name}
                                        </span>
                                        {managerAgentIdSet.has(agent.id) ? (
                                          <Badge
                                            variant="secondary"
                                            className="claw-kicker h-5 shrink-0 rounded-full border px-2 font-medium text-[#b9d6f8]"
                                          >
                                            Manager
                                          </Badge>
                                        ) : null}
                                      </button>
                                    )
                                  })}
                                </>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {isTeamThread &&
                    onAddAgentToTeam &&
                    agentsNotInTeam.length > 0 ? (
                      <div
                        className="relative shrink-0"
                        ref={addAgentDropdownRef}
                      >
                        <button
                          type="button"
                          disabled={isUpdatingTeamMembers}
                          onClick={() => setShowAddAgent((value) => !value)}
                          className="flex size-8 items-center justify-center rounded-[4px] border border-dashed text-[var(--claw-text-muted)] transition hover:text-[var(--claw-text-primary)]"
                          style={{
                            borderColor:
                              "color-mix(in srgb, var(--claw-border) 34%, transparent)",
                            backgroundColor: "var(--claw-bg-surface)",
                          }}
                          title="Add agent"
                          aria-label="Add agent"
                        >
                          <UserPlus className="size-4" />
                        </button>
                        {showAddAgent ? (
                          <div className="absolute top-full right-0 z-50 mt-1 w-48 overflow-hidden rounded-[4px] border border-white/10 bg-[var(--claw-bg-page)] shadow-xl">
                            {agentsNotInTeam.map((agent) => {
                              const blocksSecondManager =
                                selectedThread?.type === "team" &&
                                teamHasManager &&
                                managerAgentIdSet.has(agent.id)
                              return (
                                <button
                                  key={agent.id}
                                  type="button"
                                  disabled={
                                    isUpdatingTeamMembers || blocksSecondManager
                                  }
                                  onClick={() => {
                                    if (blocksSecondManager) return
                                    onAddAgentToTeam(agent.id)
                                    setShowAddAgent(false)
                                  }}
                                  className="claw-caption flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                                  title={
                                    blocksSecondManager
                                      ? "Team chats allow one manager"
                                      : undefined
                                  }
                                >
                                  <Avatar className="size-5 shrink-0">
                                    <AvatarImage
                                      src={agent.avatarUrl ?? undefined}
                                    />
                                    <AvatarFallback className="claw-badge-text">
                                      {initials(agent.name)}
                                    </AvatarFallback>
                                    <DepartmentAvatarBadge
                                      color={getAgentDepartmentColor(agent)}
                                    />
                                  </Avatar>
                                  <span className="min-w-0 flex-1 truncate">
                                    {agent.name}
                                  </span>
                                  {managerAgentIdSet.has(agent.id) ? (
                                    <Badge
                                      variant="secondary"
                                      className="claw-kicker h-5 shrink-0 rounded-full border px-2 font-medium text-[#b9d6f8]"
                                    >
                                      Manager
                                    </Badge>
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {typingUsers.length && !isViewingWrapUpTranscript ? (
                      <span className="hidden shrink-0 text-cyan-200 2xl:inline">
                        An agent is typing...
                      </span>
                    ) : null}
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="rounded-[4px]"
                      disabled={!canCopyThread}
                      onClick={() => void handleCopyThread()}
                      title={isThreadCopied ? "Copied thread" : "Copy thread"}
                      aria-label={
                        isThreadCopied ? "Copied thread" : "Copy thread"
                      }
                    >
                      {isThreadCopied ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="rounded-[4px]"
                      disabled={!canCopyThread}
                      onClick={() => void handleCopyThreadWithReferences()}
                      title={
                        isThreadWithReferencesCopied
                          ? "Copied thread with references"
                          : "Copy thread with references"
                      }
                      aria-label={
                        isThreadWithReferencesCopied
                          ? "Copied thread with references"
                          : "Copy thread with references"
                      }
                    >
                      {isThreadWithReferencesCopied ? (
                        <Check className="size-3.5" />
                      ) : (
                        <FileText className="size-3.5" />
                      )}
                    </Button>
                    {isWrappableThread && onWrapUpThread ? (
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="rounded-[4px]"
                        disabled={
                          isWrappingUpThread ||
                          isViewingWrapUpTranscript ||
                          isLoading ||
                          messages.length === 0
                        }
                        onClick={() => setShowWrapUpConfirm(true)}
                        title="Wrap up and reset"
                        aria-label="Wrap up and reset"
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                    ) : null}
                    {isCondensedViewEnabled && isTeamThread ? (
                      <div
                        className="flex h-8 items-center overflow-hidden rounded-[4px] border bg-[var(--claw-bg-surface)]"
                        style={{
                          borderColor:
                            "color-mix(in srgb, var(--claw-border) 34%, transparent)",
                        }}
                      >
                        {(["full", "condensed"] as ThreadViewMode[]).map(
                          (mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => onThreadViewModeChange?.(mode)}
                              className={`flex h-full w-9 items-center justify-center transition ${
                                threadViewMode === mode
                                  ? "border border-[var(--claw-accent-blue)] bg-[var(--claw-accent-blue)]/10 text-[#b9d6f8]"
                                  : "text-[var(--claw-text-muted)] hover:text-[var(--claw-text-primary)]"
                              }`}
                              title={
                                mode === "full" ? "Thread view" : "List view"
                              }
                              aria-label={
                                mode === "full" ? "Thread view" : "List view"
                              }
                            >
                              {mode === "full" ? (
                                <PanelTop className="size-3.5" />
                              ) : (
                                <List className="size-3.5" />
                              )}
                            </button>
                          )
                        )}
                      </div>
                    ) : null}
                    <div
                      className="flex h-8 items-center gap-1 rounded-[4px] border border-white/10 bg-white/[0.03] px-2 text-xs text-[var(--claw-text-muted)] tabular-nums"
                      style={{
                        whiteSpace: "nowrap",
                      }}
                      title={`${messages.length} messages`}
                      aria-label={`${messages.length} messages`}
                    >
                      <MessageSquare className="size-3.5" />
                      <span>{messages.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <ScrollArea className="mission-scrollbar min-h-0 flex-1 px-4 py-3">
              <div className="flex w-full flex-col gap-2">
                {renderedMessageHistory}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
            {showWrapUpConfirm ? (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-[1.5rem] border border-white/10 bg-zinc-950/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                  <div className="claw-meta mb-3 flex items-center gap-2 font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                    <FileText className="size-3.5 text-zinc-300" />
                    {wrapUpDialogLabel}
                  </div>
                  <div className="space-y-3">
                    <div className="claw-title-pane font-semibold tracking-[-0.03em] text-zinc-100">
                      {wrapUpDialogTitle}
                    </div>
                    <p className="text-sm leading-6 text-zinc-400">
                      {wrapUpDialogDescription}
                    </p>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setShowWrapUpConfirm(false)}
                      disabled={isWrappingUpThread}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        setShowWrapUpConfirm(false)
                        onWrapUpThread?.()
                      }}
                      disabled={isWrappingUpThread}
                    >
                      {isWrappingUpThread
                        ? "Wrapping up..."
                        : "Generate report & reset"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            <div
              className={`px-6 pt-[10px] pb-6 ${
                pendingAttachments.length ? "min-h-[168px]" : "min-h-[122px]"
              }`}
            >
              <input
                ref={attachmentFileRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleAttachmentFileChange}
              />
              <input
                ref={imageAttachmentFileRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={handleAttachmentFileChange}
              />
              <input
                ref={seedancePngAssetFileRef}
                type="file"
                multiple
                accept=".png,image/png"
                aria-label="Attach PNG assets for SeeDance 2"
                className="hidden"
                onChange={handleSeedancePngAssetFileChange}
              />
              {isTeamThread &&
                teamMembers.length > 0 &&
                (() => {
                  const atMatch = messageDraft.match(/@([A-Za-z0-9._/-]*)$/)
                  if (!atMatch) return null
                  const query = atMatch[1].toLowerCase()
                  const suggestions = teamMembers.filter(
                    (a) =>
                      getMentionToken(a).toLowerCase().includes(query) ||
                      a.name.toLowerCase().includes(query)
                  )
                  if (!suggestions.length) return null
                  return (
                    <div className="mb-1.5 overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-xl">
                      {suggestions.map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            const before = messageDraft.slice(
                              0,
                              messageDraft.lastIndexOf("@")
                            )
                            onMessageDraftChange(
                              `${before}@${getMentionToken(agent)} `
                            )
                          }}
                          className="claw-caption flex w-full items-center gap-2 px-3 py-1.5 text-left text-zinc-300 hover:bg-white/[0.06]"
                        >
                          <Avatar className="size-5 shrink-0">
                            <AvatarImage src={agent.avatarUrl ?? undefined} />
                            <AvatarFallback className="claw-badge-text">
                              {initials(agent.name)}
                            </AvatarFallback>
                            <DepartmentAvatarBadge
                              color={getAgentDepartmentColor(agent)}
                            />
                          </Avatar>
                          <span>{agent.name}</span>
                          <span className="claw-kicker text-zinc-500">
                            @{getMentionToken(agent)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )
                })()}
              <div
                className={`flex w-full flex-col rounded-[4px] border bg-[var(--claw-bg-inset)] px-3 py-2 ${
                  pendingAttachments.length ? "min-h-[134px]" : "min-h-[88px]"
                } ${isDraggingAttachment ? "ring-1 ring-[#4f91e8]" : ""}`}
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--claw-border) 62%, transparent)",
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDraggingAttachment(true)
                }}
                onDragLeave={() => setIsDraggingAttachment(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setIsDraggingAttachment(false)
                  void uploadAttachmentFiles(
                    Array.from(event.dataTransfer.files)
                  )
                }}
              >
                {pendingAttachments.length ? (
                  <div className="mb-2 flex max-h-16 flex-wrap gap-1.5 overflow-y-auto">
                    {pendingAttachments.map((entry) => (
                      <div
                        key={entry.localId}
                        className="claw-meta flex max-w-[220px] items-center gap-2 rounded-[4px] border border-white/10 bg-black/15 px-2 py-1 text-[var(--claw-text-muted)]"
                        title={entry.error ?? entry.file.name}
                      >
                        <FileText className="size-3.5 shrink-0" />
                        <span className="min-w-0 truncate">
                          {entry.file.name || "attachment"}
                        </span>
                        <span className="claw-kicker shrink-0">
                          {entry.status === "uploading"
                            ? `${entry.progress}%`
                            : entry.status}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 text-zinc-500 hover:text-zinc-200"
                          aria-label="Remove attachment"
                          title="Remove attachment"
                          onClick={() => removePendingAttachment(entry.localId)}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <Textarea
                  ref={composerTextareaRef}
                  rows={1}
                  className="min-h-11 shrink-0 resize-none rounded-none border-0 bg-transparent px-0 py-0 text-sm leading-5 shadow-none outline-none placeholder:text-[var(--claw-text-muted)] focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
                  style={{
                    backgroundColor: "transparent",
                    boxShadow: "none",
                  }}
                  placeholder={
                    isSending
                      ? "Sending message."
                      : "Send a message to this conversation"
                  }
                  value={messageDraft}
                  onChange={(event) => {
                    resizeComposerTextarea(event.currentTarget)
                    onMessageDraftChange(event.target.value)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey) {
                      return
                    }

                    event.preventDefault()
                    if (
                      !canSendComposer ||
                      isSending ||
                      isUploadingAttachments
                    ) {
                      return
                    }
                    handleSendComposerMessage()
                  }}
                />
                <div className="flex h-7 items-center gap-2">
                  <div className="flex shrink-0 items-center gap-1.5 text-[var(--claw-text-muted)]">
                    <button
                      type="button"
                      aria-label="Attach files"
                      title="Attach files"
                      onClick={() => attachmentFileRef.current?.click()}
                      className="flex size-7 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)] bg-[var(--claw-bg-surface)] hover:text-[var(--claw-text-primary)] disabled:opacity-45"
                      disabled={isSending || isUploadingAttachments}
                    >
                      <FilePlus2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Attach images or videos"
                      title="Attach images or videos"
                      onClick={() => imageAttachmentFileRef.current?.click()}
                      className="flex size-7 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)] bg-[var(--claw-bg-surface)] hover:text-[var(--claw-text-primary)] disabled:opacity-45"
                      disabled={isSending || isUploadingAttachments}
                    >
                      <ImageIcon className="size-3.5" />
                    </button>
                  </div>
                  <div
                    className="relative flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] border bg-[var(--claw-bg-surface)] px-2"
                    title={composerApprovalModeDescription(runtimeApprovalMode)}
                    style={{
                      borderColor: `color-mix(in srgb, ${composerApprovalModeTone(runtimeApprovalMode)} 24%, transparent)`,
                      color: composerApprovalModeTone(runtimeApprovalMode),
                    }}
                  >
                    <ShieldCheck className="size-3.5 shrink-0" />
                    <select
                      value={runtimeApprovalMode}
                      onChange={(event) =>
                        onRuntimeApprovalModeChange?.(
                          event.target.value as RuntimeApprovalMode
                        )
                      }
                      className="h-full appearance-none bg-transparent pr-3 text-xs font-semibold outline-none"
                      aria-label="Agent approval mode"
                      title="Agent approval mode"
                    >
                      <option value="ask_for_approval">Ask for approval</option>
                      <option value="approve_for_me">Approve for me</option>
                      <option value="full_access">Full access</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 size-2.5" />
                  </div>
                  {isDirectThread ? (
                    <label className="claw-meta flex min-w-0 flex-1 items-center gap-1.5 text-[var(--claw-text-muted)]">
                      <span className="shrink-0">Model</span>
                      <select
                        aria-label="Agent model"
                        className="h-7 max-w-48 min-w-0 rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)] bg-[var(--claw-bg-surface)] px-2 text-xs font-semibold text-[var(--claw-text-primary)] outline-none disabled:opacity-50"
                        value={directThreadModel}
                        disabled={
                          isUpdatingDirectModel ||
                          !directThreadAgent ||
                          !onUpdateAgentModel
                        }
                        onChange={(event) =>
                          void updateDirectThreadModel(event.target.value)
                        }
                      >
                        {!directThreadModel ? (
                          <option value="" disabled>
                            Runtime default — unpinned
                          </option>
                        ) : null}
                        {directThreadModelOptions.map((model) => (
                          <option key={model} value={model}>
                            {model}
                            {model === directThreadCatalog?.defaultModel
                              ? " — default"
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="claw-meta min-w-0 flex-1 truncate text-[var(--claw-text-muted)]">
                      {isTeamThread
                        ? "Type @ to mention a specific agent."
                        : "Mentions are available only in team chats."}
                    </span>
                  )}
                  <button
                    type="button"
                    className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)] bg-[var(--claw-bg-surface)] text-[var(--claw-text-muted)] hover:text-[var(--claw-text-primary)] disabled:opacity-35"
                    disabled={
                      !canSendComposer || isSending || isUploadingAttachments
                    }
                    onClick={handleSendComposerMessage}
                    aria-label={isSending ? "Sending message" : "Send message"}
                    title={isSending ? "Sending..." : "Send message"}
                  >
                    <Send className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex min-h-0 flex-1 items-start justify-center pt-[154px] text-center">
              <div>
                <div className="text-sm font-semibold text-[var(--claw-text-primary)]">
                  {emptyTitle === "Select a conversation"
                    ? "Start chat"
                    : emptyTitle}
                </div>
                <div className="mt-1 text-xs text-[var(--claw-text-muted)]">
                  {emptyTitle === "Select a conversation"
                    ? "Send your first message."
                    : emptyDescription}
                </div>
                {emptyActions ? (
                  <div className="mt-4">{emptyActions}</div>
                ) : null}
              </div>
            </div>
            <div className="h-[122px] px-6 pt-[10px] pb-6">
              <div className="flex h-full w-full flex-col rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_62%,transparent)] bg-[var(--claw-bg-inset)] px-3 py-2 opacity-75">
                <div className="flex-1 text-sm text-[var(--claw-text-muted)]">
                  Send a message to this conversation
                </div>
                <div className="flex h-7 items-center gap-2 text-[var(--claw-text-muted)]">
                  <div className="flex size-7 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)] bg-[var(--claw-bg-surface)]">
                    <FilePlus2 className="size-3.5" />
                  </div>
                  <div className="flex size-7 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)] bg-[var(--claw-bg-surface)]">
                    <ImageIcon className="size-3.5" />
                  </div>
                  <div className="flex h-7 items-center gap-1.5 rounded-[8px] border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)] bg-[var(--claw-bg-surface)] px-2 text-xs font-semibold">
                    <ShieldCheck className="size-3.5" />
                    <span>
                      {composerApprovalModeTitle(runtimeApprovalMode)}
                    </span>
                    <ChevronDown className="size-2.5" />
                  </div>
                  <span className="claw-meta min-w-0 flex-1 truncate">
                    Mentions are available only in team chats.
                  </span>
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_46%,transparent)] bg-[var(--claw-bg-surface)]">
                    <Send className="size-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
