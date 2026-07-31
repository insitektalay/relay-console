import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { NextRequest } from "next/server"
import { proxy } from "../proxy"

const webRoot = resolve(import.meta.dirname, "..")
const proxySource = readFileSync(resolve(webRoot, "proxy.ts"), "utf8")
const nextConfig = readFileSync(resolve(webRoot, "next.config.mjs"), "utf8")
const csrfMiddleware = readFileSync(
  resolve(webRoot, "../backend/src/common/middleware/web-csrf.middleware.ts"),
  "utf8"
)

function withNodeEnv<T>(nodeEnv: string, operation: () => T): T {
  const mutableEnv = process.env as unknown as Record<
    string,
    string | undefined
  >
  const previous = mutableEnv["NODE_ENV"]
  mutableEnv["NODE_ENV"] = nodeEnv
  try {
    return operation()
  } finally {
    if (previous === undefined) {
      delete mutableEnv["NODE_ENV"]
    } else {
      mutableEnv["NODE_ENV"] = previous
    }
  }
}

function apiRequest(headers: Record<string, string>) {
  return new NextRequest(
    "https://relayconsole.work/api/v1/auth/web/login",
    { headers }
  )
}

test("production preserves API request headers for every Host representation", () => {
  withNodeEnv("production", () => {
    const cases: Array<Record<string, string>> = [
      { host: "localhost:3033", origin: "https://attacker.example" },
      { host: "127.0.0.1", origin: "null" },
      { host: "[::1]:3033", origin: "https://attacker.example" },
      { host: "LOCALHOST", origin: "https://attacker.example" },
      {
        host: "relayconsole.work",
        "x-forwarded-host": "localhost",
        origin: "https://attacker.example",
      },
      {
        host: "localhost.evil.example",
        origin: "https://attacker.example",
      },
    ]
    for (const headers of cases) {
      const response = proxy(apiRequest(headers))
      assert.equal(response.headers.get("x-middleware-next"), "1")
      assert.equal(
        response.headers.get("x-middleware-override-headers"),
        null
      )
      assert.equal(response.headers.get("x-middleware-request-origin"), null)
    }
  })
})

test("only exact development runtime mode removes Origin, independently of Host", () => {
  withNodeEnv("development", () => {
    const loopback = proxy(
      apiRequest({
        host: "localhost:3033",
        origin: "https://first.example",
      })
    )
    const publicHost = proxy(
      apiRequest({
        host: "relayconsole.work",
        "x-forwarded-host": "attacker.example",
        origin: "https://second.example",
      })
    )

    for (const response of [loopback, publicHost]) {
      const overrides =
        response.headers.get("x-middleware-override-headers") ?? ""
      assert.ok(overrides)
      assert.equal(overrides.split(",").includes("origin"), false)
      assert.equal(response.headers.get("x-middleware-request-origin"), null)
    }
  })

  withNodeEnv("test", () => {
    const response = proxy(
      apiRequest({
        host: "localhost",
        origin: "https://attacker.example",
      })
    )
    assert.equal(response.headers.get("x-middleware-override-headers"), null)
  })
})

test("request-controlled routing values have no Origin-policy authority", () => {
  assert.match(proxySource, /process\.env\.NODE_ENV === "development"/)
  assert.doesNotMatch(proxySource, /headers\.get\(["']host["']\)/)
  assert.doesNotMatch(proxySource, /nextUrl\.host/)
  assert.doesNotMatch(proxySource, /x-forwarded-host/i)
  assert.doesNotMatch(proxySource, /localhost|127\.0\.0\.1|::1/)
  assert.match(proxySource, /requestHeaders\.delete\("origin"\)/)
})

test("the behavior cannot change the Railway API target or replace double-submit CSRF", () => {
  assert.match(
    nextConfig,
    /source: "\/api\/v1\/:path\*"[\s\S]{0,120}destination: `\$\{railwayOrigin\}\/api\/v1\/:path\*`/
  )
  assert.match(nextConfig, /cannot target a local backend/)
  assert.match(csrfMiddleware, /headerToken !== cookieToken/)
  assert.match(csrfMiddleware, /BROWSER_CSRF_REQUIRED_PATHS/)
  assert.doesNotMatch(csrfMiddleware, /headers\.origin|header\(["']origin/i)
})
