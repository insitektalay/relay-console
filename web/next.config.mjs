import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const DEFAULT_RAILWAY_ORIGIN = "https://your-backend.up.railway.app"
const DEFAULT_RAILWAY_WS_BASE_URL = "wss://your-backend.up.railway.app"

const isProduction = process.env.NODE_ENV === "production"

const isLoopbackHostname = (hostname) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname.endsWith(".localhost")

const resolveRequiredOrigin = (
  envName,
  expectedProtocol,
  developmentDefault
) => {
  const configuredValue = process.env[envName]?.trim()
  if (isProduction && !configuredValue) {
    throw new Error(
      `Relay Console web production requires ${envName}; set it to the Railway backend origin.`
    )
  }

  const rawValue = configuredValue || developmentDefault
  let url
  try {
    url = new URL(rawValue)
  } catch {
    throw new Error(
      `Relay Console web requires ${envName} to be a valid absolute URL.`
    )
  }

  if (url.protocol !== expectedProtocol) {
    throw new Error(
      `Relay Console web requires ${envName} to use ${expectedProtocol}.`
    )
  }

  if (isLoopbackHostname(url.hostname)) {
    throw new Error(
      `Relay Console web is Railway-only. ${envName} cannot target a local backend.`
    )
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      `Relay Console web requires ${envName} to be an origin only, without path, query, or hash.`
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
  "NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS",
  "NEXT_PUBLIC_ENABLE_MARKETPLACE",
  "NEXT_PUBLIC_ENABLE_LOCAL_WORKSPACE_FILES",
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

const RETIRED_MISSION_CONTROL_ENV = [
  "CLAWCHAT_ENABLE_MISSION_CONTROL_API",
  "MISSION_CONTROL_ADMIN_SECRET",
  "MISSION_CONTROL_PROFILE",
  "MISSION_CONTROL_REPOS_ROOT",
  "MISSION_CONTROL_EXECUTION_REPOS_ROOT",
  "MISSION_CONTROL_WSL_DISTRO",
  "OPENCLAW_WEBHOOK_SECRET",
]

const configuredRetiredMissionControlEnv = RETIRED_MISSION_CONTROL_ENV.filter(
  (key) => Object.hasOwn(process.env, key)
)

if (configuredRetiredMissionControlEnv.length > 0) {
  throw new Error(
    `Web-hosted Mission Control is retired. Remove these variables: ${configuredRetiredMissionControlEnv.join(", ")}.`
  )
}

const railwayOrigin = resolveRequiredOrigin(
  "CLAWCHAT_RAILWAY_ORIGIN",
  "https:",
  DEFAULT_RAILWAY_ORIGIN
)
const railwayWsBaseUrl = resolveRequiredOrigin(
  "NEXT_PUBLIC_RAILWAY_WS_BASE_URL",
  "wss:",
  DEFAULT_RAILWAY_WS_BASE_URL
)

if (new URL(railwayOrigin).hostname !== new URL(railwayWsBaseUrl).hostname) {
  throw new Error(
    "Relay Console web requires CLAWCHAT_RAILWAY_ORIGIN and NEXT_PUBLIC_RAILWAY_WS_BASE_URL to target the same Railway host."
  )
}

const securityHeaders = [
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
]

if (isProduction) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  })
}

const nextConfig = {
  transpilePackages: ["@clawchat/contracts", "@clawchat/web-sdk"],
  devIndicators: false,
  experimental: {
    // The persistent Turbopack graph grows pathologically for this large
    // workspace and has repeatedly driven `next dev` into multi-core GC loops.
    // Keep Turbopack's in-process incremental compiler, but rebuild its graph
    // for each development session instead of restoring the on-disk database.
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${railwayOrigin}/api/v1/:path*`,
      },
    ]
  },
}

const sentryBuildCredentials = {
  authToken: process.env.SENTRY_AUTH_TOKEN?.trim(),
  org: process.env.SENTRY_ORG?.trim(),
  project: process.env.SENTRY_PROJECT?.trim(),
}
const sentryBuildCredentialCount = Object.values(
  sentryBuildCredentials
).filter(Boolean).length

if (sentryBuildCredentialCount > 0 && sentryBuildCredentialCount < 3) {
  throw new Error(
    "Sentry source-map upload requires SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT together."
  )
}

const exportedConfig =
  sentryBuildCredentialCount === 3
    ? withSentryConfig(nextConfig, {
        authToken: sentryBuildCredentials.authToken,
        org: sentryBuildCredentials.org,
        project: sentryBuildCredentials.project,
        silent: true,
        telemetry: false,
        sourcemaps: {
          deleteSourcemapsAfterUpload: true,
        },
        webpack: {
          autoInstrumentAppDirectory: false,
          autoInstrumentMiddleware: false,
          autoInstrumentServerFunctions: false,
          automaticVercelMonitors: false,
          treeshake: {
            removeDebugLogging: true,
            removeTracing: true,
          },
        },
      })
    : nextConfig

export default exportedConfig
