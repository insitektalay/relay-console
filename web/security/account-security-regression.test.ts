import assert from "node:assert/strict"
import test from "node:test"
import { ClawChatWebSdk } from "../../packages/web-sdk/src/index"
import { relayAppSource } from "./relay-app-source.test"

const appSource = relayAppSource

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

test("web SDK exposes account security endpoints", async () => {
  const sdk = new ClawChatWebSdk({ apiBaseUrl: "/api/v1" })
  const calls: Array<{ url: string; init: RequestInit }> = []

  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} })
    const url = String(input)
    const method = init?.method ?? "GET"
    if (url.endsWith("/auth/web/sessions") && method === "GET") {
      return jsonResponse([{ id: "session-1", active: true }])
    }
    if (url.endsWith("/auth/sessions") && method === "GET") {
      return jsonResponse([{ id: "mobile-1", active: true, current: false }])
    }
    if (url.endsWith("/auth/change-password")) {
      return new Response(null, { status: 204 })
    }
    if (url.endsWith("/auth/web/sessions/session-1/revoke")) {
      return jsonResponse({ success: true, sessionId: "session-1" })
    }
    if (url.endsWith("/auth/web/sessions/revoke-all")) {
      return jsonResponse({ success: true, revokedSessionIds: ["session-2"] })
    }
    if (url.endsWith("/auth/sessions/mobile-1")) {
      return jsonResponse({ success: true, sessionId: "mobile-1" })
    }
    if (url.endsWith("/auth/sessions") && method === "DELETE") {
      return jsonResponse({ success: true, revokedSessionIds: [] })
    }
    return jsonResponse({ message: "unexpected" }, 500)
  }) as typeof fetch

  await assert.deepEqual(await sdk.auth.sessions(), [
    { id: "session-1", active: true },
  ])
  await assert.deepEqual(await sdk.auth.mobileSessions(), [
    { id: "mobile-1", active: true, current: false },
  ])
  await assert.equal(
    await sdk.auth.changePassword("old-pass", "new-pass-123"),
    undefined
  )
  await assert.deepEqual(await sdk.auth.revokeSession("session-1"), {
    success: true,
    sessionId: "session-1",
  })
  await assert.deepEqual(await sdk.auth.revokeAllSessions(), {
    success: true,
    revokedSessionIds: ["session-2"],
  })
  await assert.deepEqual(await sdk.auth.revokeMobileSession("mobile-1"), {
    success: true,
    sessionId: "mobile-1",
  })
  await assert.deepEqual(await sdk.auth.revokeAllMobileSessions(), {
    success: true,
    revokedSessionIds: [],
  })

  assert.deepEqual(
    calls.map((call) => [call.url, call.init.method]),
    [
      ["/api/v1/auth/web/sessions", "GET"],
      ["/api/v1/auth/sessions", "GET"],
      ["/api/v1/auth/change-password", "POST"],
      ["/api/v1/auth/web/sessions/session-1/revoke", "POST"],
      ["/api/v1/auth/web/sessions/revoke-all", "POST"],
      ["/api/v1/auth/sessions/mobile-1", "DELETE"],
      ["/api/v1/auth/sessions", "DELETE"],
    ]
  )
  assert.equal(
    calls[2].init.body,
    JSON.stringify({ currentPassword: "old-pass", newPassword: "new-pass-123" })
  )
})

test("settings security screen wires password and all-device session controls", () => {
  assert.match(appSource, /const webSessionsQuery = useQuery\(/)
  assert.match(appSource, /queryFn: \(\) => sdk\.auth\.sessions\(\)/)
  assert.match(
    appSource,
    /sdk\.auth\.changePassword\(currentPasswordDraft, newPasswordDraft\)/
  )
  assert.match(appSource, /sdk\.auth\.revokeSession\(sessionId\)/)
  assert.match(appSource, /sdk\.auth\.revokeAllSessions\(\)/)
  assert.match(appSource, /sdk\.auth\.mobileSessions\(\)/)
  assert.match(appSource, /sdk\.auth\.revokeMobileSession\(sessionId\)/)
  assert.match(appSource, /sdk\.auth\.revokeAllMobileSessions\(\)/)
  assert.match(appSource, /Mobile devices/)
  assert.match(appSource, /Web browsers/)
  assert.match(appSource, /Sign out in this browser/)
  assert.match(appSource, /Privacy Policy/)
  assert.match(appSource, /Data Export & Deletion/)
  assert.match(appSource, /Third-party Notices/)
  assert.doesNotMatch(appSource, /Railway\s+auth cookie flow/)
  assert.match(appSource, /Password changed\. Sign in again to continue\./)
})
