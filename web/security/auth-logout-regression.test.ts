import assert from "node:assert/strict"
import test from "node:test"
import {
  ClawChatApiError,
  ClawChatWebSdk,
} from "../../packages/web-sdk/src/index"
import { relayAppSource } from "./relay-app-source.test"

const appSource = relayAppSource

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function sessionResponse() {
  return jsonResponse({
    user: {
      id: "user-1",
      email: "tester@example.com",
      name: "Tester",
      role: "user",
    },
    csrfToken: "csrf",
  })
}

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

test("web SDK logout surfaces non-401 Railway logout failures", async () => {
  const sdk = new ClawChatWebSdk({ apiBaseUrl: "/api/v1" })

  globalThis.fetch = (async () =>
    jsonResponse({ message: "Forbidden" }, 403)) as typeof fetch

  await assert.rejects(
    () => sdk.auth.logout(),
    (error) =>
      error instanceof ClawChatApiError &&
      error.status === 403 &&
      error.message === "Forbidden"
  )
})

test("web SDK logout retries after an expired access cookie before clearing UI state", async () => {
  const sdk = new ClawChatWebSdk({ apiBaseUrl: "/api/v1" })
  const calls: string[] = []
  const responses = [
    jsonResponse({ message: "Unauthorized" }, 401),
    jsonResponse({ csrfToken: "csrf" }),
    sessionResponse(),
    jsonResponse({ success: true }),
  ]

  globalThis.fetch = (async (input) => {
    calls.push(String(input))
    return responses.shift() ?? jsonResponse({ message: "unexpected" }, 500)
  }) as typeof fetch

  await assert.deepEqual(await sdk.auth.logout(), { success: true })
  assert.deepEqual(calls, [
    "/api/v1/auth/web/logout",
    "/api/v1/auth/csrf",
    "/api/v1/auth/web/refresh",
    "/api/v1/auth/web/logout",
  ])
})

test("web SDK logout treats 401 plus failed refresh as already signed out", async () => {
  const sdk = new ClawChatWebSdk({ apiBaseUrl: "/api/v1" })
  const responses = [
    jsonResponse({ message: "Unauthorized" }, 401),
    jsonResponse({ csrfToken: "csrf" }),
    jsonResponse({ message: "No refresh cookie present" }, 401),
  ]

  globalThis.fetch = (async () =>
    responses.shift() ??
    jsonResponse({ message: "unexpected" }, 500)) as typeof fetch

  await assert.deepEqual(await sdk.auth.logout(), { success: true })
})

test("auth UI clears sensitive drafts only after successful auth transitions", () => {
  assert.match(
    appSource,
    /const clearSensitiveAuthDrafts = useCallback\(\(\) => \{\s*setPassword\(""\)\s*setConfirmResetPassword\(""\)\s*setInviteCode\(""\)\s*\}/
  )
  assert.match(
    appSource,
    /onSuccess: \(result\) => \{[\s\S]*?clearSensitiveAuthDrafts\(\)[\s\S]*?queryClient\.setQueryData\(\["session"\], result\)[\s\S]*?\},\s*onError:/
  )
  assert.match(
    appSource,
    /onSuccess: \(\) => \{[\s\S]*?clearSensitiveAuthDrafts\(\)[\s\S]*?queryClient\.clear\(\)[\s\S]*?\},\s*onError:/
  )
  assert.doesNotMatch(
    appSource,
    /onError: \(error: Error\) => \{\s*clearSensitiveAuthDrafts\(\)/
  )
})
