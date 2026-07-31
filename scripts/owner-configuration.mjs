import { constants } from "node:fs"
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptPath = fileURLToPath(import.meta.url)
const repositoryRoot = resolve(dirname(scriptPath), "..")

const MAC_OWNER_KEYS = [
  "CLAWCHAT_RAILWAY_ORIGIN",
  "NEXT_PUBLIC_RAILWAY_WS_BASE_URL",
]
const IOS_OWNER_KEYS = [
  "DEVELOPMENT_TEAM",
  "PRODUCT_BUNDLE_IDENTIFIER",
  "RELAY_CONSOLE_API_BASE_URL",
  "RELAY_CONSOLE_WEB_ASSET_BASE_URL",
  "RELAY_CONSOLE_WEBSOCKET_BASE_URL",
  "SENTRY_DSN",
]
const WEB_OWNER_KEYS = [
  "CLAWCHAT_RAILWAY_ORIGIN",
  "NEXT_PUBLIC_RAILWAY_WS_BASE_URL",
]

function cleanValue(rawValue) {
  const value = rawValue?.trim().replace(/^(["'])(.*)\1$/u, "$2") ?? ""
  if (!value || value.startsWith("$(")) return ""
  if (/your-|example\.com|replace-me|placeholder/i.test(value)) return ""
  return value
}

export function parseEnvironment(source) {
  const values = new Map()
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const match = line.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u,
    )
    if (match) values.set(match[1], cleanValue(match[2]))
  }
  return values
}

export function projectSetting(source, key) {
  const expression = new RegExp(`^\\s*${key}:\\s*(.*)$`, "mu")
  return cleanValue(source.match(expression)?.[1])
}

export function plistString(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
  const expression = new RegExp(
    `<key>${escaped}<\\/key>\\s*<string>([^<]*)<\\/string>`,
    "u",
  )
  return cleanValue(source.match(expression)?.[1])
}

export function swiftEnvironmentFallback(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
  const expression = new RegExp(
    `environment\\["${escaped}"\\]\\s*\\?\\?\\s*"([^"]+)"`,
    "u",
  )
  return cleanValue(source.match(expression)?.[1])
}

export function swiftStaticString(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
  const expression = new RegExp(
    `(?:public\\s+)?static\\s+let\\s+${escaped}\\s*=\\s*"([^"]+)"`,
    "u",
  )
  return cleanValue(source.match(expression)?.[1])
}

function decodeXcconfigValue(value) {
  return value.replaceAll(":/$()/", "://")
}

export function parseXcconfig(source) {
  const values = new Map()
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("//") || line.startsWith("#")) continue
    const match = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/u)
    if (match) values.set(match[1], cleanValue(decodeXcconfigValue(match[2])))
  }
  return values
}

function requirePublicOrigin(value, { websocket = false, apiPath = false } = {}) {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.username || url.password || url.port || url.search || url.hash) return false
  if (websocket ? url.protocol !== "wss:" : url.protocol !== "https:") return false
  if (!url.hostname || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return false
  return apiPath ? url.pathname === "/api/v1" : url.pathname === "/" && !url.search
}

function sameBackendHost(...values) {
  return new Set(values.map((value) => new URL(value).hostname)).size === 1
}

function encodeXcconfigValue(value) {
  return value.replaceAll("://", ":/$()/")
}

function environmentFile(values) {
  return `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`
}

function xcconfigFile(values) {
  const lines = [
    "// Private Relay Console owner configuration. Keep this file out of Git.",
    ...Object.entries(values).map(
      ([key, value]) => `${key} = ${encodeXcconfigValue(value)}`,
    ),
  ]
  return `${lines.join("\n")}\n`
}

async function writePrivateFile(path, source) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, source, { encoding: "utf8", flag: "wx", mode: 0o600 })
}

export async function captureOwnerConfiguration(root = repositoryRoot) {
  const project = await readFile(resolve(root, "ios/project.yml"), "utf8")
  const plist = await readFile(resolve(root, "ios/ClawChat/App/Info.plist"), "utf8")
  const macServices = await readFile(
    resolve(
      root,
      "RelayConsoleSwift/Sources/RelayConsoleCore/RelayConsoleServices.swift",
    ),
    "utf8",
  )
  const macCloudSync = await readFile(
    resolve(root, "RelayConsoleSwift/Sources/RelayConsoleCore/CloudRelaySync.swift"),
    "utf8",
  )

  const apiBase = plistString(plist, "RelayConsoleAPIBaseURL")
  const iosWebsocketOrigin = plistString(plist, "RelayConsoleWebSocketBaseURL")
  const webOrigin = plistString(plist, "RelayConsoleWebAssetBaseURL")

  const macValues = {
    CLAWCHAT_RAILWAY_ORIGIN: swiftEnvironmentFallback(
      macServices,
      "CLAWCHAT_RAILWAY_ORIGIN",
    ),
    NEXT_PUBLIC_RAILWAY_WS_BASE_URL: swiftStaticString(
      macCloudSync,
      "websocketOrigin",
    ),
  }
  const iosValues = {
    DEVELOPMENT_TEAM: projectSetting(project, "DEVELOPMENT_TEAM"),
    PRODUCT_BUNDLE_IDENTIFIER: projectSetting(project, "PRODUCT_BUNDLE_IDENTIFIER"),
    RELAY_CONSOLE_API_BASE_URL: apiBase,
    RELAY_CONSOLE_WEB_ASSET_BASE_URL: webOrigin,
    RELAY_CONSOLE_WEBSOCKET_BASE_URL: iosWebsocketOrigin,
    SENTRY_DSN: projectSetting(project, "SENTRY_DSN"),
    SENTRY_ENVIRONMENT:
      projectSetting(project, "SENTRY_ENVIRONMENT") || "development",
    SENTRY_RELEASE: projectSetting(project, "SENTRY_RELEASE"),
    POSTHOG_PROJECT_TOKEN: projectSetting(project, "POSTHOG_PROJECT_TOKEN"),
    POSTHOG_HOST:
      projectSetting(project, "POSTHOG_HOST") || "https://eu.i.posthog.com",
  }

  const missing = [
    ...MAC_OWNER_KEYS.filter((key) => !macValues[key]),
    ...IOS_OWNER_KEYS.filter((key) => !iosValues[key]),
  ]
  if (missing.length > 0) {
    throw new Error(`Cannot capture required owner keys: ${missing.join(", ")}`)
  }
  if (
    !requirePublicOrigin(macValues.CLAWCHAT_RAILWAY_ORIGIN) ||
    !requirePublicOrigin(macValues.NEXT_PUBLIC_RAILWAY_WS_BASE_URL, {
      websocket: true,
    }) ||
    !requirePublicOrigin(iosValues.RELAY_CONSOLE_API_BASE_URL, { apiPath: true }) ||
    !requirePublicOrigin(iosValues.RELAY_CONSOLE_WEB_ASSET_BASE_URL) ||
    !requirePublicOrigin(iosValues.RELAY_CONSOLE_WEBSOCKET_BASE_URL, {
      websocket: true,
    }) ||
    !sameBackendHost(
      macValues.CLAWCHAT_RAILWAY_ORIGIN,
      macValues.NEXT_PUBLIC_RAILWAY_WS_BASE_URL,
    ) ||
    !sameBackendHost(
      iosValues.RELAY_CONSOLE_API_BASE_URL,
      iosValues.RELAY_CONSOLE_WEBSOCKET_BASE_URL,
    )
  ) {
    throw new Error("Cannot capture malformed or non-public deployment origins.")
  }

  const macPath = resolve(root, "RelayConsoleSwift/Config/owner.env")
  const iosPath = resolve(root, "ios/Config/RelayConsoleOwner.xcconfig")
  await writePrivateFile(macPath, environmentFile(macValues))
  try {
    await writePrivateFile(iosPath, xcconfigFile(iosValues))
  } catch (error) {
    await rm(macPath, { force: true })
    throw error
  }
  return { macPath, iosPath }
}

async function assertReadable(path, label, { privateFile = false } = {}) {
  try {
    await access(path, constants.R_OK)
  } catch {
    throw new Error(`${label} is missing.`)
  }
  const details = await stat(path)
  if (privateFile && (details.mode & 0o077) !== 0) {
    throw new Error(`${label} must not grant group or other access.`)
  }
}

export async function checkOwnerConfiguration(root = repositoryRoot) {
  const macPath = resolve(root, "RelayConsoleSwift/Config/owner.env")
  const iosPath = resolve(root, "ios/Config/RelayConsoleOwner.xcconfig")
  const webPath = resolve(root, "web/.env.local")
  await assertReadable(macPath, "macOS owner configuration", {
    privateFile: true,
  })
  await assertReadable(iosPath, "iOS owner configuration", {
    privateFile: true,
  })
  await assertReadable(webPath, "web private environment")

  const mac = parseEnvironment(await readFile(macPath, "utf8"))
  const ios = parseXcconfig(await readFile(iosPath, "utf8"))
  const web = parseEnvironment(await readFile(webPath, "utf8"))
  const missing = [
    ...MAC_OWNER_KEYS.filter((key) => !mac.get(key)).map((key) => `macOS:${key}`),
    ...IOS_OWNER_KEYS.filter((key) => !ios.get(key)).map((key) => `iOS:${key}`),
    ...WEB_OWNER_KEYS.filter((key) => !web.get(key)).map((key) => `web:${key}`),
  ]
  if (missing.length > 0) {
    throw new Error(`Owner configuration is incomplete: ${missing.join(", ")}`)
  }
  if (
    !requirePublicOrigin(mac.get("CLAWCHAT_RAILWAY_ORIGIN")) ||
    !requirePublicOrigin(mac.get("NEXT_PUBLIC_RAILWAY_WS_BASE_URL"), {
      websocket: true,
    }) ||
    !requirePublicOrigin(ios.get("RELAY_CONSOLE_API_BASE_URL"), { apiPath: true }) ||
    !requirePublicOrigin(ios.get("RELAY_CONSOLE_WEB_ASSET_BASE_URL")) ||
    !requirePublicOrigin(ios.get("RELAY_CONSOLE_WEBSOCKET_BASE_URL"), {
      websocket: true,
    }) ||
    !requirePublicOrigin(web.get("CLAWCHAT_RAILWAY_ORIGIN")) ||
    !requirePublicOrigin(web.get("NEXT_PUBLIC_RAILWAY_WS_BASE_URL"), {
      websocket: true,
    }) ||
    !sameBackendHost(
      mac.get("CLAWCHAT_RAILWAY_ORIGIN"),
      mac.get("NEXT_PUBLIC_RAILWAY_WS_BASE_URL"),
    ) ||
    !sameBackendHost(
      ios.get("RELAY_CONSOLE_API_BASE_URL"),
      ios.get("RELAY_CONSOLE_WEBSOCKET_BASE_URL"),
    ) ||
    !sameBackendHost(
      web.get("CLAWCHAT_RAILWAY_ORIGIN"),
      web.get("NEXT_PUBLIC_RAILWAY_WS_BASE_URL"),
    )
  ) {
    throw new Error("Owner configuration contains an invalid deployment origin.")
  }
  return { mac: "ready", ios: "ready", web: "ready" }
}

async function main() {
  const command = process.argv[2]
  if (command === "capture") {
    await captureOwnerConfiguration()
    process.stdout.write("Captured macOS and iOS owner configuration. Values suppressed.\n")
    return
  }
  if (command === "check") {
    const result = await checkOwnerConfiguration()
    process.stdout.write(
      `Owner configuration ready: macOS=${result.mac} iOS=${result.ios} web=${result.web}. Values suppressed.\n`,
    )
    return
  }
  throw new Error("Usage: node scripts/owner-configuration.mjs capture|check")
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Owner configuration failed."}\n`,
    )
    process.exitCode = 1
  })
}
