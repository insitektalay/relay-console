"use client"

import { appConfig } from "@/lib/config"

export const TELEMETRY_PREFERENCES_STORAGE_KEY =
  "relay.telemetry.preferences.v1"

export type TelemetryPreferences = {
  choiceCompleted: boolean
  productAnalytics: boolean
  crashReports: boolean
}

export const DEFAULT_TELEMETRY_PREFERENCES: TelemetryPreferences = {
  choiceCompleted: false,
  productAnalytics: false,
  crashReports: false,
}

type ProductEventName =
  | "app_launched"
  | "product_action"
  | "screen_viewed"
  | "telemetry_consent_changed"

type ProductEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>

export type SanitizedClientError = {
  event: "web.client.error" | "web.client.unhandled_rejection"
  message: string
  name: string
  pagePath: string | null
  filename?: string | null
  lineno?: number | null
  colno?: number | null
  stack?: string | null
}

let currentPreferences = DEFAULT_TELEMETRY_PREFERENCES
let postHogModule: typeof import("posthog-js") | null = null
let sentryModule: typeof import("@sentry/nextjs") | null = null
let postHogStarted = false
let sentryStarted = false
let postHogStartPromise: Promise<void> | null = null
let sentryStartPromise: Promise<void> | null = null

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean"
}

export function readTelemetryPreferences(): TelemetryPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_TELEMETRY_PREFERENCES
  }

  try {
    const raw = window.localStorage.getItem(TELEMETRY_PREFERENCES_STORAGE_KEY)
    if (!raw) return DEFAULT_TELEMETRY_PREFERENCES

    const parsed = JSON.parse(raw) as Partial<TelemetryPreferences>
    if (
      parsed.choiceCompleted !== true ||
      !isBoolean(parsed.productAnalytics) ||
      !isBoolean(parsed.crashReports)
    ) {
      return DEFAULT_TELEMETRY_PREFERENCES
    }

    return {
      choiceCompleted: true,
      productAnalytics: parsed.productAnalytics,
      crashReports: parsed.crashReports,
    }
  } catch {
    return DEFAULT_TELEMETRY_PREFERENCES
  }
}

export function saveTelemetryPreferences(
  preferences: TelemetryPreferences
): TelemetryPreferences {
  const normalized: TelemetryPreferences = {
    choiceCompleted: true,
    productAnalytics: preferences.productAnalytics === true,
    crashReports: preferences.crashReports === true,
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      TELEMETRY_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalized)
    )
  }
  currentPreferences = normalized
  void applyTelemetryPreferences(normalized)
  return normalized
}

function redactTelemetryValue(value: unknown, maxLength = 500) {
  return String(value ?? "")
    .replace(/:\/\/([^:@/\s]+):([^@/\s]+)@/g, "://[REDACTED]@")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_JWT]"
    )
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret|authorization|cookie|csrf|pairing[_-]?code)\b\s*[:=]\s*["']?([^"',&\s}]+)/gi,
      "$1=[REDACTED]"
    )
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[EMAIL_REDACTED]"
    )
    .replace(/\bfile:\/\/\/[^\s)]+/gi, "[REDACTED_FILE]")
    .replace(
      /(^|[\s(])\/(?:Users|home|private|tmp|var)\/[^\s)]+/g,
      "$1[REDACTED_PATH]"
    )
    .replace(
      /(^|[\s(])[A-Z]:\\(?:Users|Documents and Settings)\\[^\s)]+/gi,
      "$1[REDACTED_PATH]"
    )
    .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/gi, "$1")
    .slice(0, maxLength)
}

function safePagePath(value: string | null | undefined) {
  if (!value) return null
  const path = value.split(/[?#]/, 1)[0]
  return path.startsWith("/") ? path.slice(0, 200) : null
}

function safeDiagnosticFilename(value: string | null | undefined) {
  if (!value || typeof window === "undefined") return null
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin
      ? url.pathname.slice(0, 300)
      : url.origin.slice(0, 200)
  } catch {
    return null
  }
}

async function startPostHog() {
  if (
    postHogStarted ||
    !currentPreferences.productAnalytics ||
    !appConfig.postHogProjectId
  ) {
    return
  }
  if (postHogStartPromise) return postHogStartPromise

  postHogStartPromise = (async () => {
    if (postHogModule) {
      postHogModule.default.opt_in_capturing()
      postHogStarted = true
      return
    }

    const imported = await import("posthog-js")
    if (!currentPreferences.productAnalytics) return
    const posthog = imported.default
    posthog.init(appConfig.postHogProjectId, {
      api_host: appConfig.postHogHost,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_performance: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      advanced_disable_feature_flags: true,
      person_profiles: "identified_only",
      persistence: "localStorage",
      cross_subdomain_cookie: false,
      secure_cookie: process.env.NODE_ENV === "production",
      respect_dnt: true,
    })
    posthog.opt_in_capturing()
    postHogModule = imported
    postHogStarted = true
  })()
  try {
    await postHogStartPromise
  } finally {
    postHogStartPromise = null
  }
}

async function stopPostHog() {
  if (postHogStartPromise) {
    await postHogStartPromise.catch(() => undefined)
  }
  if (currentPreferences.productAnalytics) return
  if (!postHogStarted || !postHogModule) return
  postHogModule.default.opt_out_capturing()
  postHogModule.default.reset()
  postHogStarted = false
}

async function startSentry() {
  if (
    sentryStarted ||
    !currentPreferences.crashReports ||
    !appConfig.sentryDsn
  ) {
    return
  }
  if (sentryStartPromise) return sentryStartPromise

  sentryStartPromise = (async () => {
    const Sentry = await import("@sentry/nextjs")
    if (!currentPreferences.crashReports) return
    Sentry.init({
      dsn: appConfig.sentryDsn,
      environment: appConfig.telemetryEnvironment,
      sendDefaultPii: false,
      defaultIntegrations: false,
      maxBreadcrumbs: 0,
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeSend(event) {
        event.message = event.message
          ? redactTelemetryValue(event.message)
          : event.message
        event.request = undefined
        event.user = event.user?.id
          ? { id: redactTelemetryValue(event.user.id, 100) }
          : undefined
        event.breadcrumbs = undefined
        event.contexts = undefined
        event.extra = event.extra
          ? Object.fromEntries(
              Object.entries(event.extra).map(([key, value]) => [
                key.slice(0, 80),
                redactTelemetryValue(value, 500),
              ])
            )
          : undefined

        for (const exception of event.exception?.values ?? []) {
          exception.value = exception.value
            ? redactTelemetryValue(exception.value)
            : exception.value
          exception.stacktrace?.frames?.forEach((frame) => {
            frame.vars = undefined
          })
        }
        return event
      },
    })
    sentryModule = Sentry
    sentryStarted = true
  })()
  try {
    await sentryStartPromise
  } finally {
    sentryStartPromise = null
  }
}

async function stopSentry() {
  if (sentryStartPromise) {
    await sentryStartPromise.catch(() => undefined)
  }
  if (currentPreferences.crashReports) return
  if (!sentryStarted || !sentryModule) return
  await sentryModule.getClient()?.close(2_000)
  sentryStarted = false
  sentryModule = null
}

export async function applyTelemetryPreferences(
  preferences = readTelemetryPreferences()
) {
  currentPreferences = preferences
  if (!preferences.choiceCompleted) return

  await Promise.allSettled([
    preferences.productAnalytics ? startPostHog() : stopPostHog(),
    preferences.crashReports ? startSentry() : stopSentry(),
  ])
}

export function captureProductEvent(
  event: ProductEventName,
  properties: ProductEventProperties = {}
) {
  if (!currentPreferences.productAnalytics || !postHogStarted) return

  const sanitizedProperties = Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key.slice(0, 80),
      typeof value === "string" ? redactTelemetryValue(value, 200) : value,
    ])
  )
  postHogModule?.default.capture(event, sanitizedProperties)
}

export async function captureSanitizedClientError(
  error: SanitizedClientError
) {
  if (!currentPreferences.choiceCompleted) {
    currentPreferences = readTelemetryPreferences()
  }
  try {
    await startSentry()
  } catch {
    return
  }
  if (!currentPreferences.crashReports || !sentryStarted || !sentryModule) {
    return
  }

  const capturedError = new Error(redactTelemetryValue(error.message))
  capturedError.name = redactTelemetryValue(error.name, 100)
  if (error.stack) {
    capturedError.stack = redactTelemetryValue(error.stack, 4_000)
  }

  sentryModule.withScope((scope) => {
    scope.setTag("relay.event", error.event)
    scope.setTag("relay.platform", "web")
    scope.setExtra("page_path", safePagePath(error.pagePath))
    scope.setExtra("filename", safeDiagnosticFilename(error.filename))
    scope.setExtra("line", error.lineno ?? null)
    scope.setExtra("column", error.colno ?? null)
    sentryModule?.captureException(capturedError)
  })
}

async function hashIdentifier(value: string) {
  if (!globalThis.crypto?.subtle) return null
  const bytes = new TextEncoder().encode(value)
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export async function identifyTelemetryUser(
  userId: string | null | undefined,
  workspaceId: string | null | undefined
) {
  await Promise.allSettled([startPostHog(), startSentry()])
  if (!userId) return

  const distinctId = await hashIdentifier(`relay-user:${userId}`)
  if (!distinctId) return
  const workspaceHash = workspaceId
    ? await hashIdentifier(`relay-workspace:${workspaceId}`)
    : null

  if (currentPreferences.productAnalytics && postHogStarted && postHogModule) {
    postHogModule.default.identify(distinctId, {
      platform: "web",
      workspace_id_hash: workspaceHash,
    })
  }
  if (currentPreferences.crashReports && sentryStarted && sentryModule) {
    sentryModule.setUser({ id: distinctId })
    if (workspaceHash) {
      sentryModule.setTag("workspace_id", workspaceHash)
    }
  }
}
