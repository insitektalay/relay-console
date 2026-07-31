export function formatTaskDateTime(
  value?: string | null,
  timeZone?: string | null
) {
  if (!value) return "n/a"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "n/a"
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || defaultTaskTimezone(),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(parsed)
}

export function formatTaskScheduleLabel(task: Task) {
  if (task.status === "cancelled") {
    return "Cancelled"
  }

  if (task.nextRunAt) {
    const nextRunTime = new Date(task.nextRunAt).getTime()
    if (!Number.isNaN(nextRunTime)) {
      return nextRunTime <= Date.now()
        ? `Due ${relativeTime(task.nextRunAt)}`
        : `Sends ${relativeTime(task.nextRunAt)}`
    }
  }

  if (task.scheduledFor) {
    const scheduledTime = new Date(task.scheduledFor).getTime()
    if (!Number.isNaN(scheduledTime)) {
      return scheduledTime <= Date.now()
        ? `Due ${relativeTime(task.scheduledFor)}`
        : `Sends ${relativeTime(task.scheduledFor)}`
    }
  }

  if (task.lastDispatchedAt) {
    return `Sent ${relativeTime(task.lastDispatchedAt)}`
  }

  return `Created ${relativeTime(task.createdAt)}`
}

export function formatTaskRecurrence(value?: string | null) {
  switch (value) {
    case "every_15_minutes":
      return "Every 15 minutes"
    case "every_30_minutes":
      return "Every 30 minutes"
    case "every_45_minutes":
      return "Every 45 minutes"
    case "hourly":
      return "Every hour"
    case "daily":
      return "Every day"
    case "weekdays":
      return "Weekdays"
    case "weekly":
      return "Every week"
    case "monthly":
      return "Every month"
    case "none":
    case undefined:
    case null:
      return "One-off"
    default:
      return value
  }
}

export function formatTaskStatusLabel(value?: string | null) {
  switch (value) {
    case "queued":
      return "Queued"
    case "dispatched":
      return "Dispatched"
    case "running":
      return "Running"
    case "blocked":
      return "Blocked"
    case "completed":
      return "Completed"
    case "failed":
      return "Failed"
    case "cancelled":
      return "Cancelled"
    default:
      return value ?? undefined
  }
}

export function formatTaskDisplayStatusLabel(
  task: Pick<Task, "status" | "requiresApproval">
) {
  if (task.status === "blocked") {
    return task.requiresApproval ? "Awaiting approval" : "Paused"
  }
  if (task.status === "queued") {
    return "Scheduled"
  }
  return formatTaskStatusLabel(task.status)
}

export function describeTaskSchedule({
  scheduledFor,
  timezone,
  recurrenceRule,
  status,
  requiresApproval,
}: {
  scheduledFor?: string | null
  timezone?: string | null
  recurrenceRule?: string | null
  status?: string | null
  requiresApproval?: boolean | null
}) {
  const effectiveTimezone = timezone || defaultTaskTimezone()
  if (status === "cancelled") {
    return "This schedule has been cancelled. Re-queue it if you want to send the message again."
  }
  if (status === "blocked") {
    return requiresApproval
      ? "This schedule is held for approval. It will not send until approval clears and it returns to the queue."
      : "This schedule is paused. It will not send again until you resume it."
  }

  const sendAt = scheduledFor
    ? formatTaskDateTime(scheduledFor, effectiveTimezone)
    : null
  const repeats = formatTaskRecurrence(recurrenceRule)

  if (!sendAt) {
    return "No send time is saved for this task yet."
  }
  if (!recurrenceRule || recurrenceRule === "none") {
    return `This message will be sent on ${sendAt} in ${effectiveTimezone}.`
  }
  return `This message will first send on ${sendAt} in ${effectiveTimezone}, then repeat ${repeats.toLowerCase()}.`
}

export function canPauseTaskSchedule(task: Task) {
  return ["queued", "dispatched", "running"].includes(task.status)
}

export function canResumeTaskSchedule(task: Task) {
  return task.status === "blocked" && !task.requiresApproval
}

export function getTaskManualStatusActionLabel(
  action: (typeof TASK_MANUAL_STATUS_ACTIONS)[number],
  task: Task
) {
  if (action.status === "blocked" && !task.requiresApproval) {
    return "Pause schedule"
  }
  if (action.status === "queued" && canResumeTaskSchedule(task)) {
    return "Resume schedule"
  }
  return action.label
}

export function formatWorkCalendarCompactDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return format(date, "MM/dd")
}

export function formatWorkCalendarHours(minutes: number) {
  if (minutes <= 0) return "0h"
  const hours = minutes / 60
  return Math.abs(Math.round(hours) - hours) < 0.05
    ? `${Math.round(hours)}h`
    : `${hours.toFixed(1)}h`
}

export function formatDate(value?: string | null) {
  if (!value) return "n/a"
  return format(new Date(value), "MMM d, yyyy")
}

export function buildThreadAnalyticsFilename(
  title: string,
  extension: "csv" | "json"
) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `${slug || "thread"}-analytics.${extension}`
}

export function buildThreadAnalyticsCsv(analytics: ThreadAnalytics) {
  const rows: string[][] = [
    ["section", "field", "value"],
    ["summary", "thread_id", analytics.threadId],
    ["summary", "thread_title", analytics.threadTitle],
    ["summary", "thread_type", analytics.threadType],
    ["summary", "total_messages", String(analytics.totalMessages)],
    ["summary", "total_senders", String(analytics.totalSenders)],
    ["summary", "total_sessions", String(analytics.totalSessions)],
    ["summary", "activity_gap_minutes", String(analytics.activityGapMinutes)],
    ["summary", "first_message_at", analytics.firstMessageAt ?? ""],
    ["summary", "last_message_at", analytics.lastMessageAt ?? ""],
    ["summary", "elapsed_minutes", String(analytics.elapsedMinutes)],
  ]

  rows.push([])
  rows.push([
    "senders",
    "sender_name",
    "sender_kind",
    "message_count",
    "share_percent",
    "session_count",
    "first_message_at",
    "last_message_at",
  ])
  for (const sender of analytics.messageCountsBySender) {
    rows.push([
      "senders",
      sender.senderName,
      sender.senderKind,
      String(sender.messageCount),
      String(Math.round(sender.shareOfMessages * 100)),
      String(sender.sessionCount),
      sender.firstMessageAt,
      sender.lastMessageAt,
    ])
  }

  rows.push([])
  rows.push([
    "active_periods",
    "index",
    "started_at",
    "ended_at",
    "message_count",
    "unique_sender_count",
    "duration_minutes",
  ])
  analytics.activePeriods.forEach((period, index) => {
    rows.push([
      "active_periods",
      String(index + 1),
      period.startedAt,
      period.endedAt,
      String(period.messageCount),
      String(period.uniqueSenderCount),
      String(period.durationMinutes),
    ])
  })

  rows.push([])
  rows.push([
    "sessions",
    "thread_session_id",
    "sequence_number",
    "status",
    "message_count",
    "agent_message_count",
    "agent_repeat_analysis_status",
    "agent_repeat_analysis_error_message",
    "repeated_agent_message_count",
    "repeated_cross_agent_message_count",
    "agent_repeat_group_count",
    "first_message_at",
    "last_message_at",
  ])
  for (const session of analytics.sessionBreakdown) {
    rows.push([
      "sessions",
      session.threadSessionId,
      String(session.sequenceNumber ?? ""),
      session.status ?? "",
      String(session.messageCount),
      String(session.agentMessageCount),
      session.agentRepeatAnalysisStatus,
      session.agentRepeatAnalysisErrorMessage ?? "",
      String(session.repeatedAgentMessageCount),
      String(session.repeatedCrossAgentMessageCount),
      String(session.agentRepeatGroupCount),
      session.firstMessageAt ?? "",
      session.lastMessageAt ?? "",
    ])
  }

  rows.push([])
  rows.push([
    "session_repeated_agent_messages",
    "thread_session_id",
    "representative_message",
    "occurrence_count",
    "repeated_count",
    "sender_count",
    "sender_names",
    "first_message_at",
    "last_message_at",
  ])
  for (const session of analytics.sessionBreakdown) {
    for (const group of session.repeatedAgentMessageGroups) {
      rows.push([
        "session_repeated_agent_messages",
        session.threadSessionId,
        group.representativeMessage,
        String(group.occurrenceCount),
        String(group.repeatedCount),
        String(group.senderCount),
        group.senderNames.join(" | "),
        group.firstMessageAt,
        group.lastMessageAt,
      ])
    }
  }

  return rows
    .map((row) => row.map((cell) => escapeCsvCell(cell ?? "")).join(","))
    .join("\n")
}

export function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

import type { Task, TaskStatus, ThreadAnalytics } from "@clawchat/contracts"
import { format } from "date-fns"
import { defaultTaskTimezone } from "@/features/tasks/task-schedule"
import { relativeTime } from "@/lib/relay-presentation-utils"

export const TASK_MANUAL_STATUS_ACTIONS: Array<{
  status: Extract<TaskStatus, "queued" | "blocked" | "completed" | "failed">
  label: string
}> = [
  { status: "queued", label: "Return to queue" },
  { status: "blocked", label: "Mark blocked" },
  { status: "completed", label: "Mark complete" },
  { status: "failed", label: "Mark failed" },
]
