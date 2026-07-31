import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { ClawChatWebSdk } from "../../packages/web-sdk/src/index"

const repoRoot = resolve(import.meta.dirname, "../..")
const strategy = readFileSync(
  resolve(repoRoot, "backend/src/modules/auth/strategies/jwt.strategy.ts"),
  "utf8"
)
const authService = readFileSync(
  resolve(repoRoot, "backend/src/modules/auth/auth.service.ts"),
  "utf8"
)
const sdkSource = readFileSync(
  resolve(repoRoot, "packages/web-sdk/src/index.ts"),
  "utf8"
)

test("browser access tokens remain cookie-only and session-revocation-aware", () => {
  assert.match(
    strategy,
    /payload\.kind === "web" &&[\s\S]{0,100}RELAY_JWT_AUDIENCES\.webAccess/
  )
  assert.match(strategy, /hasBearerToken \|\| !hasWebCookie \|\| !payload\.sid/)
  assert.match(strategy, /revokedAt: IsNull\(\)/)
  assert.match(strategy, /Invalid browser session/)
})

test("session-bound mobile API tokens remain bearer-only and legacy tokens stay retired", () => {
  assert.match(
    strategy,
    /payload\.kind !== "mobile" \|\|[\s\S]{0,140}RELAY_JWT_AUDIENCES\.mobileAccess[\s\S]{0,100}!payload\.sid \|\|[\s\S]{0,50}!hasBearerToken/
  )
  assert.match(strategy, /Invalid API session/)
  assert.match(strategy, /mobileSessionRepository\.findOne/)
  assert.match(strategy, /Invalid mobile session/)
  assert.doesNotMatch(strategy, /legacyRefreshToken|Temporary compatibility/)
  assert.match(strategy, /issuer: resolveRelayJwtIssuer/)
  assert.match(strategy, /algorithms: \[RELAY_JWT_ALGORITHM\]/)
})

test("refresh JWTs are unique and session rotation is compare-and-swap", () => {
  assert.match(authService, /jti: randomUUID\(\)/)
  assert.match(authService, /refreshTokenHash: session\.refreshTokenHash/)
  assert.match(authService, /rotation\.affected === 1/)
  assert.match(authService, /refresh token already rotated/)
})

test("the web SDK coalesces simultaneous refresh attempts", async () => {
  assert.match(sdkSource, /browserRefreshPromise/)
  const originalFetch = globalThis.fetch
  const calls: string[] = []
  globalThis.fetch = (async (input) => {
    const path = String(input)
    calls.push(path)
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
    await Promise.all([client.auth.refresh(), client.auth.refresh()])
    assert.deepEqual(calls, ["/api/v1/auth/csrf", "/api/v1/auth/web/refresh"])
  } finally {
    globalThis.fetch = originalFetch
  }
})
