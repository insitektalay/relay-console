const DEFAULT_RAILWAY_WS_BASE_URL = "wss://your-backend.up.railway.app"
const isProduction = process.env.NODE_ENV === "production"

const isLoopbackHostname = (hostname: string) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname.endsWith(".localhost")

const resolveRailwayWsBaseUrl = () => {
  const configuredValue = process.env.NEXT_PUBLIC_RAILWAY_WS_BASE_URL?.trim()
  if (isProduction && !configuredValue) {
    throw new Error(
      "Relay Console web production requires NEXT_PUBLIC_RAILWAY_WS_BASE_URL."
    )
  }

  const rawValue = configuredValue || DEFAULT_RAILWAY_WS_BASE_URL
  let url: URL
  try {
    url = new URL(rawValue)
  } catch {
    throw new Error(
      "Relay Console web requires NEXT_PUBLIC_RAILWAY_WS_BASE_URL to be a valid absolute URL."
    )
  }

  if (url.protocol !== "wss:") {
    throw new Error(
      "Relay Console web requires NEXT_PUBLIC_RAILWAY_WS_BASE_URL to use wss:."
    )
  }

  if (isLoopbackHostname(url.hostname)) {
    throw new Error(
      "Relay Console web is Railway-only. NEXT_PUBLIC_RAILWAY_WS_BASE_URL cannot target a local backend."
    )
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      "Relay Console web requires NEXT_PUBLIC_RAILWAY_WS_BASE_URL to be an origin only, without path, query, or hash."
    )
  }

  return url.origin
}

const SECRET_NAME_PATTERN =
  /(SECRET|TOKEN|PASSWORD|PRIVATE|DATABASE|JWT|ENCRYPTION|WEBHOOK|OAUTH|KEY)/i
const ALLOWED_PUBLIC_ENV = new Set([
  "NEXT_PUBLIC_RAILWAY_WS_BASE_URL",
  "NEXT_PUBLIC_ENABLE_OPERATIONS",
  "NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT",
  "NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT_REALTIME",
  "NEXT_PUBLIC_ENABLE_AGENT_OPS",
  "NEXT_PUBLIC_ENABLE_MARKETPLACE",
  "NEXT_PUBLIC_ENABLE_LOCAL_WORKSPACE_FILES",
  "NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS",
  "NEXT_PUBLIC_POSTHOG_PROJECT_ID",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_TELEMETRY_ENVIRONMENT",
])
const ALLOWED_PUBLIC_ENV_PREFIXES = ["NEXT_PUBLIC_VERCEL_"]

for (const key of Object.keys(process.env)) {
  if (!key.startsWith("NEXT_PUBLIC_")) continue
  const isAllowed =
    ALLOWED_PUBLIC_ENV.has(key) ||
    ALLOWED_PUBLIC_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))

  if (!isAllowed || SECRET_NAME_PATTERN.test(key)) {
    throw new Error(
      `Unsafe public environment variable for Relay Console web beta: ${key}`
    )
  }
}

if (process.env.NEXT_PUBLIC_API_BASE_URL) {
  throw new Error(
    "Relay Console web is Railway-only. NEXT_PUBLIC_API_BASE_URL is retired and cannot be set."
  )
}

if (process.env.NEXT_PUBLIC_WS_BASE_URL) {
  throw new Error(
    "Relay Console web is Railway-only. NEXT_PUBLIC_WS_BASE_URL is retired and cannot be set."
  )
}

const apiBaseUrl = "/api/v1"

const publicFeatureFlag = (key: string, defaultValue: boolean) => {
  const value = process.env[key]
  if (value === undefined || value === "") {
    return defaultValue
  }
  return value === "true"
}

const optionalHttpsUrl = (
  value: string | undefined,
  label: string,
  fallback = ""
) => {
  const candidate = value?.trim() || fallback
  if (!candidate) return ""

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new Error(`${label} must be a valid absolute URL.`)
  }
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use https:.`)
  }
  return url.toString().replace(/\/$/, "")
}

const railwayWsBaseUrl = resolveRailwayWsBaseUrl()

export const appConfig = {
  apiBaseUrl,
  wsBaseUrl: railwayWsBaseUrl,
  postHogProjectId: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID?.trim() ?? "",
  postHogHost: optionalHttpsUrl(
    process.env.NEXT_PUBLIC_POSTHOG_HOST,
    "NEXT_PUBLIC_POSTHOG_HOST",
    "https://eu.i.posthog.com"
  ),
  sentryDsn: optionalHttpsUrl(
    process.env.NEXT_PUBLIC_SENTRY_DSN,
    "NEXT_PUBLIC_SENTRY_DSN"
  ),
  telemetryEnvironment:
    process.env.NEXT_PUBLIC_TELEMETRY_ENVIRONMENT?.trim() ||
    (isProduction ? "production" : "development"),
  enableOperations: publicFeatureFlag("NEXT_PUBLIC_ENABLE_OPERATIONS", false),
  enableCondensedTeamChat: publicFeatureFlag(
    "NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT",
    false
  ),
  enableCondensedTeamChatRealtime: publicFeatureFlag(
    "NEXT_PUBLIC_ENABLE_CONDENSED_TEAM_CHAT_REALTIME",
    false
  ),
  enableAgentOps: publicFeatureFlag("NEXT_PUBLIC_ENABLE_AGENT_OPS", false),
  enableMarketplace: publicFeatureFlag("NEXT_PUBLIC_ENABLE_MARKETPLACE", true),
  enableLocalWorkspaceFiles: publicFeatureFlag(
    "NEXT_PUBLIC_ENABLE_LOCAL_WORKSPACE_FILES",
    false
  ),
  enableAgentOpsDebugControls: publicFeatureFlag(
    "NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS",
    false
  ),
}
