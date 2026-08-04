import { useMemo, type ReactNode } from "react"
import type { Agent, Department, Thread } from "@clawchat/contracts"
import {
  Archive,
  MessageCircle,
  MessagesSquare,
  UsersRound,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { ThreadListSkeleton } from "@/components/app-shell/skeletons"
import { DepartmentAvatarBadge } from "@/components/shared/department-avatar-badge"
import {
  AgentAppBadgeStrip,
  type AgentAppBadge,
} from "@/components/shared/agent-app-badge-strip"

const THREAD_TYPE_META: Record<string, { label: string; className: string }> = {
  direct: {
    label: "Direct",
    className:
      "border-[var(--claw-accent-green)]/28 bg-[var(--claw-accent-green)]/8 text-[#c8f3d7]",
  },
  team: {
    label: "Team",
    className:
      "border-[var(--claw-accent-blue)]/30 bg-[var(--claw-accent-blue)]/10 text-[#b9d6f8]",
  },
  department: {
    label: "Department",
    className:
      "border-[var(--claw-border)]/25 bg-[var(--claw-bg-surface)] text-[var(--claw-text-muted)]",
  },
  company_meeting: {
    label: "Meeting",
    className:
      "border-[var(--claw-accent-blue)]/28 bg-[var(--claw-accent-blue)]/8 text-[#b9d6f8]",
  },
  agent_to_agent: {
    label: "Agent to Agent",
    className:
      "border-[var(--claw-border)]/25 bg-[var(--claw-bg-surface)] text-[var(--claw-text-muted)]",
  },
  group_agent: {
    label: "Group Agent",
    className:
      "border-[var(--claw-border)]/25 bg-[var(--claw-bg-surface)] text-[var(--claw-text-muted)]",
  },
  system: {
    label: "System",
    className:
      "border-[var(--claw-border)]/25 bg-[var(--claw-bg-surface)] text-[var(--claw-text-muted)]",
  },
  approval: {
    label: "Approval",
    className:
      "border-[var(--claw-accent-green)]/20 bg-[var(--claw-accent-green)]/8 text-[#c8f3d7]",
  },
  incident: {
    label: "Incident",
    className:
      "border-[var(--claw-border)]/25 bg-[var(--claw-bg-surface)] text-[var(--claw-text-muted)]",
  },
  report: {
    label: "Report",
    className:
      "border-[var(--claw-accent-blue)]/20 bg-[var(--claw-accent-blue)]/8 text-[#b9d6f8]",
  },
  unknown: {
    label: "Unknown",
    className:
      "border-[var(--claw-border)]/25 bg-[var(--claw-bg-surface)] text-[var(--claw-text-muted)]",
  },
}

function getThreadTypeMeta(type: string) {
  return (
    THREAD_TYPE_META[type] ?? {
      label: type.replaceAll("_", " "),
      className:
        "border-[var(--claw-border)]/25 bg-[var(--claw-bg-surface)] text-[var(--claw-text-muted)]",
    }
  )
}

function getAgentRuntimeType(agent?: Agent | null) {
  const runtimeType = agent?.runtimeBinding?.runtimeType?.trim().toLowerCase()
  if (runtimeType === "hermes" || runtimeType === "openclaw") {
    return runtimeType
  }

  const source = agent?.source?.trim().toLowerCase()
  return source === "hermes" || source === "openclaw" ? source : null
}

function RuntimeIcon({ agent }: { agent?: Agent | null }) {
  const runtimeType = getAgentRuntimeType(agent)
  if (!runtimeType) {
    return null
  }

  const runtimeLabel = runtimeType === "hermes" ? "Hermes" : "OpenClaw"
  const runtimeIcon = runtimeType === "hermes" ? "hermes" : "openclaw"

  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--claw-border)_45%,transparent)] bg-white"
      title={`${runtimeLabel} runtime`}
      aria-label={`${runtimeLabel} runtime`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- shared runtime artwork is sourced from the Swift app. */}
      <img
        src={`/runtime-icons/${runtimeIcon}.png`}
        alt=""
        aria-hidden="true"
        className="size-full object-cover"
      />
    </span>
  )
}

function agentAppBadgesForThread(
  thread: Thread,
  agentAppBadgesByAgentId: Record<string, AgentAppBadge[]>
) {
  const bySlug = new Map<string, AgentAppBadge>()

  for (const agentId of thread.agentIds) {
    const badges = agentAppBadgesByAgentId[agentId] ?? []
    for (const badge of badges) {
      if (!bySlug.has(badge.slug)) {
        bySlug.set(badge.slug, badge)
      }
    }
  }

  return [...bySlug.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

const GROUP_THREAD_TYPES = new Set([
  "team",
  "department",
  "company_meeting",
  "agent_to_agent",
  "group_agent",
])

function ConversationAvatar({
  thread,
  agents,
  departmentColor,
}: {
  thread: Thread
  agents: Agent[]
  departmentColor?: string | null
}) {
  const isGroupThread = GROUP_THREAD_TYPES.has(thread.type)
  const agentAvatarUrls = Array.from(
    new Set(
      agents
        .map((agent) => agent.avatarUrl?.trim())
        .filter((url): url is string => Boolean(url))
    )
  )
  const singleAvatarUrl =
    thread.avatarUrl?.trim() ||
    agentAvatarUrls[0] ||
    thread.lastMessage?.senderAvatarUrl?.trim() ||
    undefined

  if (isGroupThread && !thread.avatarUrl && agentAvatarUrls.length > 1) {
    return (
      <div
        className="relative mt-0.5 size-11 shrink-0 rounded-full bg-[var(--claw-bg-inset)]"
        data-conversation-avatar="group"
        aria-label={`${thread.title} members`}
      >
        {agentAvatarUrls.slice(0, 3).map((url, index) => (
          // eslint-disable-next-line @next/next/no-img-element -- these are authenticated Railway avatar URLs.
          <img
            key={url}
            src={url}
            alt=""
            aria-hidden="true"
            className={`absolute size-7 rounded-full border-2 border-[var(--claw-bg-sidebar)] object-cover ${
              index === 0
                ? "top-0 left-0"
                : index === 1
                  ? "right-0 bottom-0"
                  : "bottom-0 left-0"
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <Avatar
      className="mt-0.5 !size-11 shrink-0"
      data-conversation-avatar={singleAvatarUrl ? "agent" : "fallback"}
    >
      <AvatarImage src={singleAvatarUrl} />
      <AvatarFallback className="text-[var(--claw-text-muted)]">
        {isGroupThread ? (
          <UsersRound className="size-5" aria-hidden="true" />
        ) : (
          <MessageCircle className="size-5" aria-hidden="true" />
        )}
      </AvatarFallback>
      <DepartmentAvatarBadge color={departmentColor} />
    </Avatar>
  )
}

export function ThreadListPane({
  search,
  onSearchChange,
  filters,
  isLoading,
  errorMessage,
  threads,
  agents,
  departments,
  displayNamesByAgentId = {},
  agentAppBadgesByAgentId = {},
  selectedThreadId,
  onSelectThread,
  onArchiveThread,
  archivingThreadId,
  hasMoreThreads = false,
  isLoadingMoreThreads = false,
  onLoadMoreThreads,
  relativeTime,
  actions,
  emptyTitle = "No threads in this workspace",
  emptyDescription = "Once agents or teammates start talking, the conversation stream will appear here.",
  emptyActions,
}: {
  search: string
  onSearchChange: (value: string) => void
  filters?: ReactNode
  isLoading: boolean
  errorMessage?: string | null
  threads: Thread[]
  agents: Agent[]
  departments: Department[]
  displayNamesByAgentId?: Record<string, string>
  agentAppBadgesByAgentId?: Record<string, AgentAppBadge[]>
  selectedThreadId: string | null
  onSelectThread: (threadId: string) => void
  onArchiveThread?: (threadId: string) => void
  archivingThreadId?: string | null
  hasMoreThreads?: boolean
  isLoadingMoreThreads?: boolean
  onLoadMoreThreads?: () => void
  relativeTime: (value: string) => string
  actions?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptyActions?: ReactNode
}) {
  const agentLookup = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents]
  )
  const departmentLookup = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments]
  )
  const resolveThreadTitle = (thread: Thread) => {
    const primaryAgent = resolveThreadAgent(thread)
    if (!primaryAgent) {
      return thread.title
    }

    const displayName = displayNamesByAgentId[primaryAgent.id]
    if (!displayName) {
      return thread.title
    }

    if (thread.type === "direct") {
      return displayName
    }

    const backendName = primaryAgent.name?.trim()
    if (
      backendName &&
      thread.title.trim().toLowerCase() === backendName.toLowerCase()
    ) {
      return displayName
    }

    return thread.title
  }

  const normalizedAgentName = (value?: string | null) =>
    (value ?? "").trim().toLocaleLowerCase().replaceAll("_", " ")

  const resolveThreadAgent = (thread: Thread) => {
    for (const id of [
      ...thread.agentIds,
      thread.lastMessage?.senderId ?? null,
    ]) {
      if (id) {
        const agent = agentLookup.get(id)
        if (agent) return agent
      }
    }

    if (thread.type !== "direct") return null

    // Older imported direct chats can predate thread-agent memberships. Their
    // title or persisted last-message sender still identifies the canonical
    // Railway agent shown inside the conversation.
    const candidateNames = new Set(
      [thread.title, thread.lastMessage?.senderName]
        .map(normalizedAgentName)
        .filter(Boolean)
    )
    const matches = agents.filter((agent) =>
      [agent.name, displayNamesByAgentId[agent.id]]
        .map(normalizedAgentName)
        .some((name) => candidateNames.has(name))
    )
    return matches.length === 1 ? matches[0] : null
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="flex h-[60px] shrink-0 items-center gap-2 px-0">
        <span className="flex size-6 items-center justify-center rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_30%,transparent)] bg-[var(--claw-bg-inset)] text-[var(--claw-text-muted)]">
          <MessagesSquare className="size-[13px]" strokeWidth={1.8} />
        </span>
        <span className="text-sm font-semibold text-[var(--claw-text-primary)]">
          Conversations
        </span>
        {actions ? (
          <div className="ml-auto shrink-0 text-[var(--claw-text-muted)]">
            {actions}
          </div>
        ) : null}
      </div>
      <div
        className="flex h-12 shrink-0 items-center gap-3 rounded-[4px] border bg-[var(--claw-bg-inset)] px-3"
        style={{
          borderColor:
            "color-mix(in srgb, var(--claw-border) 62%, transparent)",
        }}
      >
        <input
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--claw-text-primary)] outline-none placeholder:text-[var(--claw-text-muted)]"
          placeholder="Search conversations..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      {filters ? (
        <div
          className="claw-thread-filters flex min-h-[70px] shrink-0 items-center border-b px-5 py-3"
          style={{
            borderColor:
              "color-mix(in srgb, var(--claw-border) 28%, transparent)",
          }}
        >
          <div className="min-w-0 flex-1">{filters}</div>
        </div>
      ) : null}
      <ScrollArea className="mission-scrollbar min-h-0 w-full min-w-0 flex-1">
        <div className="w-full min-w-0 space-y-1 pt-3">
          {isLoading ? (
            <div className="p-3">
              <ThreadListSkeleton />
            </div>
          ) : errorMessage ? (
            <div className="p-3">
              <div className="rounded-[4px] border border-red-500/20 bg-red-500/[0.05] px-4 py-8 text-center text-sm text-red-200">
                <div className="font-medium">Could not load conversations</div>
                <div className="mt-2 text-red-200/80">{errorMessage}</div>
              </div>
            </div>
          ) : threads.length ? (
            threads.map((thread) => {
              const primaryAgent = resolveThreadAgent(thread)
              const threadAgents = thread.agentIds
                .map((agentId) => agentLookup.get(agentId))
                .filter((agent): agent is Agent => Boolean(agent))
              const avatarAgents =
                primaryAgent &&
                !threadAgents.some((agent) => agent.id === primaryAgent.id)
                  ? [primaryAgent, ...threadAgents]
                  : threadAgents
              const threadTitle = resolveThreadTitle(thread)
              const directAgentRole =
                thread.type === "direct"
                  ? primaryAgent?.role?.trim() ||
                    primaryAgent?.description?.trim() ||
                    ""
                  : ""
              const threadTypeMeta = getThreadTypeMeta(thread.type)
              const appBadges = agentAppBadgesForThread(
                thread,
                agentAppBadgesByAgentId
              )
              const activityLabel = thread.lastMessage?.createdAt
                ? relativeTime(thread.lastMessage.createdAt)
                : "No activity"

              return (
                <div
                  key={thread.id}
                  className={`relative w-full overflow-hidden rounded-[4px] px-3 py-2.5 text-left transition [content-visibility:auto] ${
                    directAgentRole
                      ? "h-[92px] [contain-intrinsic-size:auto_92px]"
                      : "h-[78px] [contain-intrinsic-size:auto_78px]"
                  } ${
                    thread.id === selectedThreadId
                      ? "bg-[color-mix(in_srgb,var(--claw-accent-blue)_13%,var(--claw-bg-sidebar-alt))] text-[var(--claw-text-primary)]"
                      : "bg-transparent text-[var(--claw-text-primary)] hover:bg-[var(--claw-bg-sidebar-alt)]"
                  }`}
                >
                  <div className="flex h-full items-start gap-3">
                    <button
                      className="block h-full min-w-0 flex-1 pr-[98px] text-left"
                      onClick={() => onSelectThread(thread.id)}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <ConversationAvatar
                          thread={thread}
                          agents={avatarAgents}
                          departmentColor={
                            primaryAgent?.departmentId
                              ? departmentLookup.get(primaryAgent.departmentId)
                                  ?.color
                              : null
                          }
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="claw-caption min-w-0 flex-1 truncate leading-5 font-semibold">
                              {threadTitle}
                            </div>
                          </div>
                          {directAgentRole ? (
                            <div
                              className="claw-meta truncate font-normal text-[var(--claw-text-muted)]"
                              data-agent-role
                            >
                              {directAgentRole}
                            </div>
                          ) : null}
                          <AgentAppBadgeStrip badges={appBadges} />
                        </div>
                      </div>
                    </button>
                    <div className="absolute top-3.5 right-7 flex w-[104px] items-center justify-end gap-1.5 text-right">
                      {onArchiveThread ? (
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="size-4 text-[var(--claw-text-muted)] hover:text-[var(--claw-text-primary)] [&_svg]:size-3"
                          disabled={archivingThreadId === thread.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            onArchiveThread(thread.id)
                          }}
                          aria-label={`Archive ${threadTitle}`}
                          title={`Archive ${threadTitle}`}
                        >
                          <Archive />
                        </Button>
                      ) : null}
                      <RuntimeIcon agent={primaryAgent} />
                      <Badge
                        variant="secondary"
                        className={`${threadTypeMeta.className} claw-badge-text h-4 min-w-[3.25rem] rounded-[5px] px-1 text-center font-semibold tracking-[0.16em]`}
                      >
                        {threadTypeMeta.label}
                      </Badge>
                    </div>
                    <div
                      className={`claw-meta absolute right-7 flex w-[82px] justify-end text-right leading-[18px] whitespace-nowrap ${
                        directAgentRole ? "top-[68px]" : "top-[54px]"
                      }`}
                    >
                      <div className="flex items-center justify-end gap-x-1">
                        {thread.unreadCount > 0 ? (
                          <div className="font-medium text-[#b9d6f8]">
                            {thread.unreadCount} unread
                          </div>
                        ) : null}
                        <div className="text-[var(--claw-text-muted)]">
                          {activityLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              actions={emptyActions}
            />
          )}
          {!isLoading && !errorMessage && hasMoreThreads ? (
            <div className="p-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isLoadingMoreThreads}
                onClick={onLoadMoreThreads}
              >
                {isLoadingMoreThreads
                  ? "Loading..."
                  : "Load more conversations"}
              </Button>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}
