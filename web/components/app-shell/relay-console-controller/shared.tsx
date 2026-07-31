import type {
  BridgeDevice,
  TaskRecurrenceRule,
  TaskTargetType,
  ThreadWrapUpReport,
  Workspace,
} from "@clawchat/contracts"
import { ClawChatApiError, ClawChatNetworkError } from "@clawchat/web-sdk"
import { type AppSection } from "@/components/app-shell/app-sidebar"
import { type AgentGroupType } from "@/components/app-shell/relay-console-domain"

export const WORKSPACE_KEY = "clawchat.web.selected-workspace"

export const THREAD_KEY = "clawchat.web.selected-thread"

export const REPORT_ARCHIVE_KEY = "clawchat.web.archived-reports"

export const TASK_ARCHIVE_KEY = "clawchat.web.archived-tasks"

export const THREAD_VIEW_MODE_KEY = "clawchat.web.thread-view-modes"

export const APPLICATION_CLASSIFICATIONS_KEY =
  "clawchat.web.application-classifications"

export const DEFAULT_OPENCLAW_AGENT_MODEL = "gpt-5.5"

export const THREAD_LIST_PAGE_SIZE = 30

export const APP_THEME_DEFAULT = "clawchat-classic"

export const FIRST_WORKSPACE_SECTION: AppSection = "threads"

export function logAppPerf(
  action: string,
  details: Record<string, unknown> = {}
) {
  if (process.env.NODE_ENV === "production") {
    return
  }
  const elapsed =
    typeof performance !== "undefined" ? Math.round(performance.now()) : null
  console.debug("[Relay Console app perf]", action, { elapsed, ...details })
}

export function isSessionAuthMiss(error: unknown) {
  return (
    error instanceof ClawChatApiError &&
    (error.status === 401 || error.status === 403)
  )
}

export function backendUnavailableMessage(error: unknown) {
  if (error instanceof ClawChatNetworkError) {
    return error.kind === "timeout"
      ? "The Relay service did not respond before the request timeout. Retry when the connection is stable."
      : "Could not reach the Relay service. Check your connection and retry."
  }

  if (error instanceof ClawChatApiError && error.status >= 500) {
    return `The Relay service returned ${error.status}. Retry in a moment.`
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Could not reach the Relay service. Retry in a moment."
}

export type { AgentGroupType } from "@/components/app-shell/relay-console-domain"

export type AgentStructureCreateTarget = "organization" | "department" | "team"

export type ThreadFilterGroup = "all" | AgentGroupType

export type AgentManagementTab =
  | "detail"
  | "edit"
  | "instructions"
  | "library"
  | "memory"
  | "skills"
  | "create-org"
  | "cron"
  | "structure"
  | "classify"
  | "calendar"
  | "tasks"

export type InsightsTab = "report" | "analytics"

export type NewChatMode =
  | "direct"
  | "team"
  | "department"
  | "agent_to_agent"
  | "company_meeting"

export type ReportKind = "snapshot" | "wrap_up"

export type WorkspaceMembershipRole = "owner" | "admin" | "member" | "viewer"

export type WorkspaceDetail = Workspace & {
  stats?: Record<string, unknown>
  membershipRole?: WorkspaceMembershipRole
}

export type MissionControlView =
  | "dashboard"
  | "marketplace"
  | "pipeline"
  | "classify"

export const isWrapUpReportPending = (report?: ThreadWrapUpReport | null) =>
  report?.status === "generating"

export type PublicSettingsView =
  | "account"
  | "billing"
  | "appearance"
  | "workspace"
  | "team_members"
  | "integrations"
  | "notifications"
  | "harnesses"
  | "existing_agents"
  | "runtime"
  | "security"
  | "privacy"

export type AppTheme = typeof APP_THEME_DEFAULT

export type ThemeOption = {
  id: AppTheme
  label: string
  description: string
  swatches: string[]
}

export type ReportListItem =
  | ({
      kind: "snapshot"
      reportId: string
    } & import("@clawchat/contracts").ReportSnapshot)
  | ({ kind: "wrap_up"; reportId: string } & ThreadWrapUpReport)

export type ReportListGroup = {
  id: string
  title: string
  subtitle: string
  avatarLabel: string
  avatarUrl?: string | null
  badgeLabel: string
  badgeTone: string
  latestCreatedAt: string
  isCollapsible: boolean
  reports: ReportListItem[]
}

export const AGENT_DISPLAY_NAME_KEY = "clawchat.web.agent-display-names"

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: APP_THEME_DEFAULT,
    label: "Relay Console Classic",
    description:
      "The current Relay Console interface: dark operations surfaces, blue and green accents, compact panels, and the existing card, chat, avatar, menu, and control styling.",
    swatches: ["#121920", "#172028", "#508dd7", "#64d78d", "#fbfbfb"],
  },
]

export const SIDEBAR_COLLAPSED_KEY = "clawchat.sidebarCollapsed"

export type RelayConsoleWebAppProps = {
  initialAuthMode?: "login" | "register"
}

export function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function slugifyLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

export function formatTaskTargetTypeLabel(value?: string | null) {
  switch (value) {
    case "direct":
      return "Direct"
    case "team":
      return "Team"
    case "department":
      return "Department"
    case "agent_to_agent":
      return "Agent-to-agent"
    default:
      return value ?? "Direct"
  }
}

export function isDefaultProvisionFilename(filename: string) {
  return [
    "SOUL.md",
    "IDENTITY.md",
    "AGENTS.md",
    "USER.md",
    "TOOLS.md",
    "MEMORY.md",
    "HEARTBEAT.md",
  ].includes(filename.toUpperCase())
}

export function slugifyOpenClawId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
}

export const APP_THEME_STORAGE_KEY = "clawchat.web.theme"

export const TASK_TARGET_TYPE_OPTIONS: Array<{
  value: TaskTargetType
  label: string
}> = [
  { value: "direct", label: "Direct chat" },
  { value: "team", label: "Team chat" },
  { value: "department", label: "Department chat" },
  { value: "company_meeting", label: "Company meeting" },
  { value: "agent_to_agent", label: "Agent-to-agent chat" },
]

export const TASK_RECURRENCE_OPTIONS: Array<{
  value: TaskRecurrenceRule
  label: string
}> = [
  { value: "none", label: "One-off" },
  { value: "every_15_minutes", label: "Every 15 minutes" },
  { value: "every_30_minutes", label: "Every 30 minutes" },
  { value: "every_45_minutes", label: "Every 45 minutes" },
  { value: "hourly", label: "Every hour" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
]

export function getThemeLabel(theme: AppTheme) {
  return THEME_OPTIONS.find((option) => option.id === theme)?.label ?? "Theme"
}

export function bridgeDeviceRuntimeLabel(
  device: Pick<BridgeDevice, "capabilities">
) {
  const capabilities = device.capabilities ?? []
  return capabilities.includes("clawchat.runtime.hermes")
    ? "Hermes"
    : "OpenClaw"
}

export const BRIDGE_PLUGIN_REPO_URL =
  "https://github.com/insitektalay/relay-console-bridge-plugins"

export const BRIDGE_PLUGIN_INSTALL_URL =
  "https://github.com/insitektalay/relay-console-bridge-plugins/blob/main/docs/INSTALL.md"

export function railwayHttpOriginFromWsBaseUrl(wsBaseUrl: string) {
  try {
    const url = new URL(wsBaseUrl)
    url.protocol = url.protocol === "wss:" ? "https:" : "http:"
    url.pathname = ""
    url.search = ""
    url.hash = ""
    return url.toString().replace(/\/$/, "")
  } catch {
    throw new Error("Invalid Railway websocket base URL.")
  }
}
