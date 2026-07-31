import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { ClawChatWebSdk } from "../../packages/web-sdk/src/index"
import { relayAppSource } from "./relay-app-source.test"

const repoRoot = resolve(import.meta.dirname, "../..")
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8")
const middleware = read("backend/src/common/middleware/web-csrf.middleware.ts")
const proxySource = read("web/proxy.ts")
const cookies = read("backend/src/modules/auth/auth.constants.ts")
const sdk = read("packages/web-sdk/src/index.ts")
const app = relayAppSource
const lifecycleDoc = read("docs/beta-auth-account-lifecycle.md")
const preflightDoc = read(
  "docs/relay-cloud/BROWSER_SESSION_CSRF_PREFLIGHT_2026-07-15.md"
)

test("browser login, registration, and refresh require double-submit CSRF", () => {
  for (const path of [
    "/api/v1/auth/web/login",
    "/api/v1/auth/web/register",
    "/api/v1/auth/web/refresh",
  ]) {
    assert.match(
      middleware,
      new RegExp(`BROWSER_CSRF_REQUIRED_PATHS[\\s\\S]{0,260}${path}`)
    )
  }
  assert.match(middleware, /headerToken !== cookieToken/)
  assert.match(middleware, /hasWebCookies && !requiresBrowserCsrf/)
})

test("the browser obtains and returns the CSRF token without exposing auth cookies", () => {
  assert.match(app, /await sdk\.auth\.csrf\(\)/)
  assert.match(sdk, /getCookie\("clawchat_web_csrf"\)/)
  assert.match(sdk, /headers\.set\("x-csrf-token", csrfToken\)/)
  assert.match(sdk, /headers: await this\.browserCsrfHeaders\(\)/)
  assert.match(cookies, /httpOnly: true/)
  assert.match(cookies, /sameSite: 'lax'/)
  assert.match(cookies, /secure: isProduction/)
})

test("the SDK obtains CSRF before browser login and sends the returned header", async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ path: string; csrf: string | null }> = []
  globalThis.fetch = (async (input, init) => {
    const path = String(input)
    const headers = new Headers(init?.headers)
    calls.push({ path, csrf: headers.get("x-csrf-token") })
    if (path.endsWith("/auth/csrf")) {
      return new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }
    return new Response(
      JSON.stringify({
        user: { id: "user-1", email: "user@example.com", name: "User" },
        csrfToken: "rotated-token",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  try {
    const client = new ClawChatWebSdk({ apiBaseUrl: "/api/v1" })
    await client.auth.login("user@example.com", "password")
    assert.deepEqual(calls, [
      { path: "/api/v1/auth/csrf", csrf: null },
      { path: "/api/v1/auth/web/login", csrf: "csrf-token" },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("browser-session security documentation stays aligned with enforcement", () => {
  for (const path of [
    "/api/v1/auth/web/login",
    "/api/v1/auth/web/register",
    "/api/v1/auth/web/refresh",
  ]) {
    assert.match(lifecycleDoc, new RegExp(path.replaceAll("/", "\\/")))
    assert.match(preflightDoc, new RegExp(path.replaceAll("/", "\\/")))
  }
  assert.match(lifecycleDoc, /HttpOnly/)
  assert.match(lifecycleDoc, /SameSite=Lax/)
  assert.match(lifecycleDoc, /Authorization: Bearer/)
  assert.match(preflightDoc, /No reusable CSRF signing secret is needed/)
})

test("production Origin handling cannot be selected by request Host", () => {
  assert.match(proxySource, /process\.env\.NODE_ENV === "development"/)
  assert.match(proxySource, /requestHeaders\.delete\("origin"\)/)
  assert.doesNotMatch(proxySource, /headers\.get\(["']host["']\)/)
  assert.doesNotMatch(proxySource, /nextUrl\.host|x-forwarded-host/i)
  assert.doesNotMatch(proxySource, /localhost|127\.0\.0\.1|::1/)
  assert.doesNotMatch(middleware, /headers\.origin|header\(["']origin/i)
})
