"use client"

import { useEffect } from "react"
import { captureSanitizedClientError } from "@/lib/telemetry"

const MAX_VALUE_LENGTH = 500
const MAX_EVENT_BUFFER_LENGTH = 25

type ClientMonitoringEventName =
  | "web.client.error"
  | "web.client.unhandled_rejection"

export type ClientMonitoringEvent = {
  event: ClientMonitoringEventName
  source: "clawchat-web"
  checkedAt: string
  pagePath: string | null
  message: string
  name: string
  filename?: string | null
  lineno?: number | null
  colno?: number | null
  stack?: string | null
}

export type ClientMonitoringSnapshot = {
  supportModel: "local-buffer-and-opt-in-sentry"
  capturedAt: string
  pagePath: string | null
  eventCount: number
  recentEvents: ClientMonitoringEvent[]
}

declare global {
  interface Window {
    __clawChatClientErrors?: ClientMonitoringEvent[]
    clawChatSupportSnapshot?: () => ClientMonitoringSnapshot
  }
}

const clientMonitoringEvents: ClientMonitoringEvent[] = []

export function sanitizeClientMonitoringValue(value: unknown) {
  return String(value ?? "")
    .replace(/:\/\/([^:@/\s]+):([^@/\s]+)@/g, "://[REDACTED]@")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret|authorization|cookie|csrf|pairing[_-]?code)\b\s*[:=]\s*["']?([^"',&\s}]+)/gi,
      "$1=[REDACTED]"
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_REDACTED]")
    .slice(0, MAX_VALUE_LENGTH)
}

function getClientPagePath() {
  if (typeof window === "undefined") return null
  return window.location.pathname || "/"
}

function sanitizeClientUrl(value: unknown) {
  const raw = String(value ?? "")
  if (!raw) return null
  try {
    const url = new URL(raw, window.location.origin)
    return url.origin === window.location.origin ? url.pathname : url.origin
  } catch {
    return sanitizeClientMonitoringValue(raw)
  }
}

function reportClientMonitoringEvent(
  event: ClientMonitoringEventName,
  details: Omit<ClientMonitoringEvent, "event" | "source" | "checkedAt" | "pagePath">
) {
  const payload: ClientMonitoringEvent = {
    event,
    source: "clawchat-web",
    checkedAt: new Date().toISOString(),
    pagePath: getClientPagePath(),
    ...details,
  }
  rememberClientMonitoringEvent(payload)
  console.error(JSON.stringify(payload))
  void captureSanitizedClientError(payload)
}

function rememberClientMonitoringEvent(event: ClientMonitoringEvent) {
  clientMonitoringEvents.push(event)
  if (clientMonitoringEvents.length > MAX_EVENT_BUFFER_LENGTH) {
    clientMonitoringEvents.splice(
      0,
      clientMonitoringEvents.length - MAX_EVENT_BUFFER_LENGTH
    )
  }
  window.__clawChatClientErrors = clientMonitoringEvents.slice()
}

export function getClientMonitoringSnapshot(): ClientMonitoringSnapshot {
  return {
    supportModel: "local-buffer-and-opt-in-sentry",
    capturedAt: new Date().toISOString(),
    pagePath: getClientPagePath(),
    eventCount: clientMonitoringEvents.length,
    recentEvents: clientMonitoringEvents.slice(),
  }
}

export function ClientErrorMonitor() {
  useEffect(() => {
    window.__clawChatClientErrors = clientMonitoringEvents.slice()
    window.clawChatSupportSnapshot = getClientMonitoringSnapshot

    const onError = (event: ErrorEvent) => {
      reportClientMonitoringEvent("web.client.error", {
        message: sanitizeClientMonitoringValue(event.message),
        name: sanitizeClientMonitoringValue(event.error?.name ?? "Error"),
        filename: sanitizeClientUrl(event.filename),
        lineno: event.lineno || null,
        colno: event.colno || null,
        stack: sanitizeClientMonitoringValue(event.error?.stack ?? ""),
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      reportClientMonitoringEvent("web.client.unhandled_rejection", {
        message: sanitizeClientMonitoringValue(
          reason instanceof Error ? reason.message : reason
        ),
        name: sanitizeClientMonitoringValue(
          reason instanceof Error ? reason.name : "UnhandledRejection"
        ),
        stack: sanitizeClientMonitoringValue(
          reason instanceof Error ? reason.stack : ""
        ),
      })
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onUnhandledRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
      delete window.__clawChatClientErrors
      delete window.clawChatSupportSnapshot
    }
  }, [])

  return null
}
