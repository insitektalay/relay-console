const DEFAULT_RAILWAY_ORIGIN = "https://your-backend.up.railway.app"
const DEFAULT_RAILWAY_WS_BASE_URL = "wss://your-backend.up.railway.app"
const CSP_NONCE_BYTES = 24
const CSP_NONCE_PATTERN = /^[A-Za-z0-9+/]{32}$/

type CspEnvironment = Readonly<Record<string, string | undefined>>

export function createCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CSP_NONCE_BYTES))
  const nonce = btoa(String.fromCharCode(...bytes))
  if (!isValidCspNonce(nonce)) {
    throw new Error("CSP nonce generation failed.")
  }
  return nonce
}

export function isValidCspNonce(value: string | null): value is string {
  return typeof value === "string" && CSP_NONCE_PATTERN.test(value)
}

export function createContentSecurityPolicy(
  nonce: string,
  environment: CspEnvironment = process.env
): string {
  if (!isValidCspNonce(nonce)) {
    throw new Error("CSP requires a valid per-request nonce.")
  }

  const isDevelopment = environment.NODE_ENV !== "production"
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ]
  const connectSources = resolveConnectSources(environment)

  return compactHeaderValue(`
    default-src 'self';
    base-uri 'self';
    object-src 'none';
    frame-ancestors 'none';
    frame-src 'none';
    form-action 'self';
    script-src ${scriptSources.join(" ")};
    script-src-attr 'none';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https:;
    font-src 'self' data:;
    connect-src ${connectSources.join(" ")};
    media-src 'self' data: blob:;
    worker-src 'self' blob:;
    manifest-src 'self';
    upgrade-insecure-requests
  `)
}

function resolveConnectSources(environment: CspEnvironment): string[] {
  const sources = new Set<string>(["'self'"])
  sources.add(
    exactOrigin(
      environment.CLAWCHAT_RAILWAY_ORIGIN || DEFAULT_RAILWAY_ORIGIN,
      new Set(["https:"]),
      "CLAWCHAT_RAILWAY_ORIGIN"
    )
  )
  sources.add(
    exactOrigin(
      environment.NEXT_PUBLIC_RAILWAY_WS_BASE_URL ||
        DEFAULT_RAILWAY_WS_BASE_URL,
      new Set(["wss:"]),
      "NEXT_PUBLIC_RAILWAY_WS_BASE_URL"
    )
  )

  if (environment.NEXT_PUBLIC_POSTHOG_PROJECT_ID?.trim()) {
    const postHogOrigin = telemetryOrigin(
      environment.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
      false
    )
    if (postHogOrigin) sources.add(postHogOrigin)
  }

  const sentryOrigin = telemetryOrigin(
    environment.NEXT_PUBLIC_SENTRY_DSN || "",
    true
  )
  if (sentryOrigin) sources.add(sentryOrigin)
  return [...sources]
}

function exactOrigin(
  value: string,
  protocols: ReadonlySet<string>,
  label: string
): string {
  const url = parseURL(value)
  if (
    !url ||
    !protocols.has(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} is not a valid CSP origin.`)
  }
  return url.origin
}

function telemetryOrigin(
  value: string,
  allowPublicUsername: boolean
): string | null {
  const url = parseURL(value)
  if (
    !url ||
    url.protocol !== "https:" ||
    (!allowPublicUsername && url.username) ||
    url.password
  ) {
    return null
  }
  return url.origin
}

function parseURL(value: string): URL | null {
  try {
    return new URL(value.trim())
  } catch {
    return null
  }
}

function compactHeaderValue(value: string): string {
  return value.replace(/\s{2,}/g, " ").trim()
}
