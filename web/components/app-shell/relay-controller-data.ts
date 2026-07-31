import type {
  Agent,
  AgentWorkCalendar,
  MarketplaceApp,
  MarketplaceInstall,
  Message,
  Paginated,
  Thread,
} from "@clawchat/contracts"
import { addDays, format } from "date-fns"
import type {
  AgentGroupType,
  RuntimeAgentDraftType,
  WorkCalendarGroup,
} from "@/components/app-shell/relay-console-domain"
import type { AgentAppBadge } from "@/components/shared/agent-app-badge-strip"
import {
  THREAD_MESSAGE_PAGE_SIZE,
  logMessageSyncDiagnostic,
} from "@/lib/message-cache"
import { sdk } from "@/lib/sdk"

const DEFAULT_OPENCLAW_AGENT_MODEL = "gpt-5.5"

export function getAgentRuntimeType(agent?: Agent | null) {
  const runtimeType = agent?.runtimeBinding?.runtimeType?.trim().toLowerCase()
  if (runtimeType) {
    return runtimeType
  }

  const source = agent?.source?.trim().toLowerCase()
  if (
    source === "openclaw" ||
    source === "claude_code" ||
    source === "hermes"
  ) {
    return source
  }

  return null
}

export function isAgentExecutionAvailable(agent: Agent) {
  return agent.executionAvailable === true
}

export function defaultRuntimeAgentModel(runtimeType: RuntimeAgentDraftType) {
  if (runtimeType === "claude_code") {
    return "sonnet"
  }
  if (runtimeType === "openclaw") {
    return DEFAULT_OPENCLAW_AGENT_MODEL
  }
  return "gpt-5.5"
}

export function buildAgentSearchText(agent: Agent, displayName: string) {
  return [
    displayName,
    agent.name,
    agent.role,
    agent.externalId,
    agent.source,
    agent.description,
    agent.provisioningStatus,
    agent.runtimeBinding?.runtimeType,
    agent.runtimeBinding?.adapterKind,
    agent.runtimeBinding?.routingMode,
    agent.runtimeBinding?.repoKey,
    agent.runtimeBinding?.workspaceRoot,
    agent.runtimeBinding?.healthStatus,
    ...agent.capabilities,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()
}

export function marketplaceAppNameFromSlug(slug: string) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ")
}

export function isActiveMarketplaceInstall(install: MarketplaceInstall) {
  return Boolean(install.agentId.trim()) && install.installStatus !== "removed"
}

export function buildAgentAppBadgesByAgentId({
  apps,
  installs,
}: {
  apps: MarketplaceApp[]
  installs: MarketplaceInstall[]
}) {
  const appsBySlug = new Map(apps.map((app) => [app.slug, app]))
  const badgesByAgentId = new Map<string, Map<string, AgentAppBadge>>()

  for (const install of installs) {
    if (!isActiveMarketplaceInstall(install)) continue

    const appSlug = install.appSlug.trim()
    if (!appSlug) continue

    const agentBadges =
      badgesByAgentId.get(install.agentId) ?? new Map<string, AgentAppBadge>()

    if (!agentBadges.has(appSlug)) {
      agentBadges.set(appSlug, {
        slug: appSlug,
        name:
          appsBySlug.get(appSlug)?.name ?? marketplaceAppNameFromSlug(appSlug),
      })
    }

    badgesByAgentId.set(install.agentId, agentBadges)
  }

  return Object.fromEntries(
    [...badgesByAgentId.entries()].map(([agentId, badges]) => [
      agentId,
      [...badges.values()].sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
    ])
  )
}

export async function listAllWorkspaceAgents(
  workspaceId: string
): Promise<Paginated<Agent>> {
  const pageSize = 100
  let page = 1
  let total = 0
  const agents: Agent[] = []

  while (true) {
    const response = await sdk.agents.list({
      workspaceId,
      page,
      pageSize,
    })

    agents.push(
      ...response.data.filter(
        (agent) => !agent.lifecycleStatus || agent.lifecycleStatus === "active"
      )
    )
    total = response.total

    if (!response.hasMore) {
      return {
        data: agents,
        total,
        page: 1,
        pageSize: agents.length || pageSize,
        hasMore: false,
      }
    }

    page += 1
  }
}

export async function listAllThreadMessages(
  threadId: string,
  threadSessionId?: string
): Promise<Paginated<Message>> {
  const pageSize = 100
  let page = 1
  let total = 0
  const messagesById = new Map<string, Message>()

  while (true) {
    const response = await sdk.messages.list(
      threadId,
      page,
      pageSize,
      threadSessionId
    )

    for (const message of response.data) {
      messagesById.set(message.id, message)
    }
    total = response.total

    if (!response.hasMore) {
      const messages = [...messagesById.values()]
      messages.sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime()
      )

      return {
        data: messages,
        total: Math.max(total, messages.length),
        page: 1,
        pageSize: messages.length || pageSize,
        hasMore: false,
      }
    }

    page += 1
  }
}

export async function listThreadMessageWindow(
  threadId: string,
  threadSessionId?: string | null,
  before?: string
): Promise<Paginated<Message>> {
  logMessageSyncDiagnostic(
    before ? "load older window" : "load latest window",
    {
      threadId,
      threadSessionId: threadSessionId ?? "active",
      before: before ?? null,
      pageSize: THREAD_MESSAGE_PAGE_SIZE,
    }
  )

  return sdk.messages.list(
    threadId,
    1,
    THREAD_MESSAGE_PAGE_SIZE,
    threadSessionId ?? undefined,
    before
  )
}

export async function listLatestThreadMessages(
  threadId: string,
  before?: string
): Promise<Paginated<Message>> {
  logMessageSyncDiagnostic(
    before ? "load older latest window" : "load latest fast window",
    {
      threadId,
      before: before ?? null,
      pageSize: THREAD_MESSAGE_PAGE_SIZE,
    }
  )
  const messages = await sdk.messages.latest(
    threadId,
    THREAD_MESSAGE_PAGE_SIZE,
    before
  )

  return {
    data: messages,
    total: messages.length,
    page: 1,
    pageSize: THREAD_MESSAGE_PAGE_SIZE,
    hasMore: messages.length === THREAD_MESSAGE_PAGE_SIZE,
  }
}

export async function listAllWorkspaceThreads(
  workspaceId: string
): Promise<Paginated<Thread>> {
  const pageSize = 20
  let page = 1
  let total = 0
  const threads: Thread[] = []

  while (true) {
    const response = await sdk.threads.list(workspaceId, page, pageSize)
    threads.push(...response.data)
    total = response.total

    if (!response.hasMore) {
      return {
        data: threads,
        total,
        page: 1,
        pageSize: threads.length || pageSize,
        hasMore: false,
      }
    }

    page += 1
  }
}

export async function buildAgentWorkCalendarFallback({
  workspaceId,
  startDate,
  endDate,
  groupType,
  activityGapMinutes,
  timeZone,
}: {
  workspaceId: string
  startDate: string
  endDate: string
  groupType: WorkCalendarGroup
  activityGapMinutes: number
  timeZone: string
}): Promise<AgentWorkCalendar> {
  const [agentResponse, threadResponse, departments] = await Promise.all([
    listAllWorkspaceAgents(workspaceId),
    listAllWorkspaceThreads(workspaceId),
    sdk.departments.list(workspaceId),
  ])
  const days = buildCalendarDateRange(startDate, endDate)
  const daySet = new Set(days)
  const rangeStart = new Date(`${startDate}T00:00:00.000Z`)
  const rangeEnd = new Date(`${endDate}T23:59:59.999Z`)
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 1)
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1)

  const agents = agentResponse.data.filter(
    (agent) =>
      groupType === "all" || resolveAgentGroupTypeValue(agent) === groupType
  )
  const agentIds = new Set(agents.map((agent) => agent.id))
  const relevantThreads = threadResponse.data.filter((thread) =>
    thread.agentIds.some((agentId) => agentIds.has(agentId))
  )
  const messagesByThread = await Promise.all(
    relevantThreads.map(async (thread) => {
      const response = await listAllThreadMessages(thread.id)
      return {
        threadId: thread.id,
        messages: response.data.filter((message) => {
          const createdAt = new Date(message.createdAt).getTime()
          return (
            !Number.isNaN(createdAt) &&
            createdAt >= rangeStart.getTime() &&
            createdAt <= rangeEnd.getTime()
          )
        }),
      }
    })
  )
  const stats = new Map<
    string,
    { totalMs: number; sessionKeys: Set<string>; messageCount: number }
  >()
  const gapMs = activityGapMinutes * 60_000

  for (const { threadId, messages } of messagesByThread) {
    let period: {
      startedAt: Date
      endedAt: Date
      lastAt: Date
      messages: Message[]
      agentIds: Set<string>
    } | null = null

    const flushPeriod = () => {
      if (!period || !period.agentIds.size) return
      const startMs = period.startedAt.getTime()
      const endMs = period.endedAt.getTime()
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        return
      }

      for (const agentId of period.agentIds) {
        const agentMessageCount = period.messages.filter(
          (message) => message.senderId === agentId
        ).length
        for (const allocation of allocateCalendarPeriodByDay(
          startMs,
          endMs,
          timeZone,
          daySet
        )) {
          const key = `${agentId}:${allocation.date}`
          const stat = stats.get(key) ?? {
            totalMs: 0,
            sessionKeys: new Set<string>(),
            messageCount: 0,
          }
          stat.totalMs += allocation.ms
          stat.sessionKeys.add(`${threadId}:${period.startedAt.toISOString()}`)
          stat.messageCount += agentMessageCount
          stats.set(key, stat)
        }
      }
    }

    for (const message of messages) {
      const createdAt = new Date(message.createdAt)
      const createdAtMs = createdAt.getTime()
      if (Number.isNaN(createdAtMs)) continue

      if (!period) {
        period = {
          startedAt: createdAt,
          endedAt: createdAt,
          lastAt: createdAt,
          messages: [message],
          agentIds: new Set(
            agentIds.has(message.senderId) ? [message.senderId] : []
          ),
        }
        continue
      }

      if (createdAtMs - period.lastAt.getTime() > gapMs) {
        flushPeriod()
        period = {
          startedAt: createdAt,
          endedAt: createdAt,
          lastAt: createdAt,
          messages: [message],
          agentIds: new Set(
            agentIds.has(message.senderId) ? [message.senderId] : []
          ),
        }
        continue
      }

      period.endedAt = createdAt
      period.lastAt = createdAt
      period.messages.push(message)
      if (agentIds.has(message.senderId)) {
        period.agentIds.add(message.senderId)
      }
    }

    flushPeriod()
  }

  const departmentsById = new Map(
    departments.map((department) => [department.id, department])
  )

  return {
    workspaceId,
    startDate: days[0],
    endDate: days[days.length - 1],
    timeZone,
    groupType,
    activityGapMinutes,
    days,
    agents: agents.map((agent) => {
      const agentDays = days.map((date) => {
        const stat = stats.get(`${agent.id}:${date}`)
        return {
          date,
          minutesWorked: stat ? Math.round(stat.totalMs / 60000) : 0,
          sessionCount: stat?.sessionKeys.size ?? 0,
          messageCount: stat?.messageCount ?? 0,
        }
      })
      const department = agent.departmentId
        ? departmentsById.get(agent.departmentId)
        : null
      return {
        agentId: agent.id,
        agentName: agent.name,
        groupType: resolveAgentGroupTypeValue(agent),
        groupLabel: agent.groupLabel ?? null,
        departmentId: agent.departmentId ?? null,
        departmentName: department?.name ?? null,
        days: agentDays,
        totalMinutesWorked: agentDays.reduce(
          (sum, day) => sum + day.minutesWorked,
          0
        ),
      }
    }),
  }
}

export function getCalendarToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export function getScrollableCalendarDays(endDate: Date) {
  return Array.from({ length: 30 }, (_, index) =>
    toCalendarDate(addDays(endDate, index - 29))
  )
}

export function buildCalendarDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return getScrollableCalendarDays(getCalendarToday())
  }

  const days: string[] = []
  for (
    let cursor = start;
    cursor.getTime() <= end.getTime() && days.length < 31;
    cursor = addDays(cursor, 1)
  ) {
    days.push(toCalendarDate(cursor))
  }
  return days.length ? days : [toCalendarDate(start)]
}

export function toCalendarDate(value: Date) {
  return format(value, "yyyy-MM-dd")
}

export function resolveAgentGroupTypeValue(agent: Agent): AgentGroupType {
  if (agent.groupType === "business" || agent.departmentId || agent.teamId) {
    return "business"
  }
  if (agent.groupType === "family") {
    return "family"
  }
  return "personal"
}

export function formatCalendarDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )
  return `${values.year}-${values.month}-${values.day}`
}

export function allocateCalendarPeriodByDay(
  startedAtMs: number,
  endedAtMs: number,
  timeZone: string,
  allowedDays: Set<string>
) {
  const allocations = new Map<string, number>()
  let cursor = startedAtMs
  while (cursor < endedAtMs) {
    const next = Math.min(cursor + 60_000, endedAtMs)
    const date = formatCalendarDateInTimeZone(new Date(cursor), timeZone)
    if (allowedDays.has(date)) {
      allocations.set(date, (allocations.get(date) ?? 0) + next - cursor)
    }
    cursor = next
  }
  return [...allocations.entries()].map(([date, ms]) => ({ date, ms }))
}
