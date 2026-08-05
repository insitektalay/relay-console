import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  ClawChatApiError,
  ClawChatNetworkError,
  ClawChatWebSdk,
} from "../../packages/web-sdk/src/index"
import { relayAppSource } from "./relay-app-source.test"

const sdkSource = readFileSync(
  new URL("../../packages/web-sdk/src/index.ts", import.meta.url),
  "utf8"
)
const appSource = relayAppSource

const originalFetch = globalThis.fetch

type RequestForTest = <T>(
  path: string,
  init: RequestInit & { skipRefresh?: boolean; timeoutMs?: number | null }
) => Promise<T>

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

test("web SDK wraps timed out Railway calls in a typed network error", async () => {
  const sdk = new ClawChatWebSdk({ apiBaseUrl: "/api/v1" }) as unknown as {
    request: RequestForTest
  }

  globalThis.fetch = (async (_input, init) => {
    await new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"))
      })
    })
    throw new Error("unreachable")
  }) as typeof fetch

  await assert.rejects(
    () => sdk.request("/slow", { method: "GET", timeoutMs: 1 }),
    (error) =>
      error instanceof ClawChatNetworkError &&
      error.kind === "timeout" &&
      error.path === "/slow" &&
      error.timeoutMs === 1
  )
})

test("web SDK wraps Railway network failures without exposing raw fetch errors", async () => {
  const sdk = new ClawChatWebSdk({ apiBaseUrl: "/api/v1" }) as unknown as {
    request: RequestForTest
  }

  globalThis.fetch = (async () => {
    throw new TypeError("Failed to fetch")
  }) as typeof fetch

  await assert.rejects(
    () => sdk.request("/offline", { method: "GET" }),
    (error) =>
      error instanceof ClawChatNetworkError &&
      error.kind === "network" &&
      error.path === "/offline"
  )
})

test("web SDK replaces Railway infrastructure errors with an actionable service message", async () => {
  const sdk = new ClawChatWebSdk({ apiBaseUrl: "/api/v1" }) as unknown as {
    request: RequestForTest
  }

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message: "Application failed to respond" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    })) as typeof fetch

  await assert.rejects(
    () => sdk.request("/marketplace/connect", { method: "POST" }),
    (error) =>
      error instanceof ClawChatApiError &&
      error.status === 502 &&
      error.message ===
        "Relay service is temporarily unavailable. Please try again shortly."
  )
})

test("web SDK preserves an actionable Railway 503 explanation", async () => {
  const sdk = new ClawChatWebSdk({ apiBaseUrl: "/api/v1" }) as unknown as {
    request: RequestForTest
  }
  const message =
    "Luca Signoff's OpenClaw runtime is not connected to this Railway workspace."

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message }), {
      status: 503,
      headers: { "content-type": "application/json" },
    })) as typeof fetch

  await assert.rejects(
    () => sdk.request("/marketplace/install", { method: "POST" }),
    (error) =>
      error instanceof ClawChatApiError &&
      error.status === 503 &&
      error.message === message
  )
})

test("SDK requests have conservative defaults and an explicit timeout escape hatch", () => {
  assert.match(sdkSource, /const DEFAULT_REQUEST_TIMEOUT_MS = 20_000/)
  assert.match(sdkSource, /timeoutMs\?: number \| null/)
  assert.match(sdkSource, /init\.timeoutMs === null/)
  assert.match(sdkSource, /: DEFAULT_REQUEST_TIMEOUT_MS/)
  assert.match(sdkSource, /export class ClawChatNetworkError extends Error/)
  assert.match(
    sdkSource,
    /error instanceof ClawChatApiError[\s\S]*error\.status !== 401 && error\.status !== 403[\s\S]*throw error/
  )
})

test("app shell distinguishes auth misses from backend unavailability", () => {
  assert.match(appSource, /import \{ ClawChatApiError, ClawChatNetworkError \}/)
  assert.match(appSource, /function isSessionAuthMiss\(error: unknown\)/)
  assert.match(
    appSource,
    /function backendUnavailableMessage\(error: unknown\)/
  )
  assert.match(
    appSource,
    /catch \(error\) \{[\s\S]*if \(isSessionAuthMiss\(error\)\) \{[\s\S]*return null[\s\S]*throw error/
  )
  assert.match(appSource, /!sessionQuery\.isError && !session/)
  assert.match(appSource, /sessionQuery\.isError && !session/)
  assert.match(appSource, /<BackendUnavailableShell/)
  assert.match(appSource, /void sessionQuery\.refetch\(\)/)
  assert.match(appSource, /backendUnavailableMessage\(workspacesQuery\.error\)/)
})
