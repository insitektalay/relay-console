import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { NextRequest } from "next/server"
import { proxy } from "../proxy"
import {
  createContentSecurityPolicy,
  createCspNonce,
  isValidCspNonce,
} from "./content-security-policy"

const testDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(testDir, "..")

const nextConfigSource = readFileSync(join(webRoot, "next.config.mjs"), "utf8")
const proxySource = readFileSync(join(webRoot, "proxy.ts"), "utf8")
const cspPolicySource = readFileSync(
  join(webRoot, "security/content-security-policy.ts"),
  "utf8"
)
const htmlRendererSource = readFileSync(
  join(webRoot, "components/threads/html-message-renderer.tsx"),
  "utf8"
)
const layoutSource = readFileSync(join(webRoot, "app/layout.tsx"), "utf8")
const globalsSource = readFileSync(join(webRoot, "app/globals.css"), "utf8")
const betaOperationsSource = readFileSync(
  join(webRoot, "..", "docs/BETA_OPERATIONS.md"),
  "utf8"
)

test("web app emits beta security headers and CSP", () => {
  assert.doesNotMatch(nextConfigSource, /Content-Security-Policy/)
  assert.match(cspPolicySource, /default-src 'self'/)
  assert.match(cspPolicySource, /base-uri 'self'/)
  assert.match(cspPolicySource, /object-src 'none'/)
  assert.match(cspPolicySource, /frame-ancestors 'none'/)
  assert.match(cspPolicySource, /frame-src 'none'/)
  assert.match(cspPolicySource, /form-action 'self'/)
  assert.match(cspPolicySource, /script-src \$\{scriptSources\.join\(" "\)\}/)
  assert.match(cspPolicySource, /script-src-attr 'none'/)
  assert.doesNotMatch(cspPolicySource, /style-src-attr 'none'/)
  assert.match(cspPolicySource, /connect-src \$\{connectSources\.join\(" "\)\}/)
  assert.match(cspPolicySource, /NEXT_PUBLIC_POSTHOG_HOST/)
  assert.match(cspPolicySource, /NEXT_PUBLIC_SENTRY_DSN/)
  assert.match(nextConfigSource, /Referrer-Policy/)
  assert.match(nextConfigSource, /strict-origin-when-cross-origin/)
  assert.match(nextConfigSource, /Permissions-Policy/)
  assert.match(nextConfigSource, /X-Content-Type-Options/)
  assert.match(nextConfigSource, /nosniff/)
  assert.match(nextConfigSource, /X-Frame-Options/)
  assert.match(nextConfigSource, /DENY/)
  assert.match(nextConfigSource, /Strict-Transport-Security/)
  assert.match(nextConfigSource, /max-age=31536000/)
})

test("production CSP uses a fresh valid nonce and no inline-script bypass", () => {
  const firstNonce = createCspNonce()
  const secondNonce = createCspNonce()
  assert.equal(isValidCspNonce(firstNonce), true)
  assert.equal(isValidCspNonce(secondNonce), true)
  assert.notEqual(firstNonce, secondNonce)

  const policy = createContentSecurityPolicy(firstNonce, {
    NODE_ENV: "production",
    CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
    NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "wss://api.relayconsole.work",
    NEXT_PUBLIC_POSTHOG_PROJECT_ID: "project",
    NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
    NEXT_PUBLIC_SENTRY_DSN: "https://public@sentry.example/123",
  })
  const scriptDirective = policy
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("script-src "))
  assert.ok(scriptDirective)
  assert.match(scriptDirective, /'self'/)
  assert.equal(scriptDirective.includes(`'nonce-${firstNonce}'`), true)
  assert.match(scriptDirective, /'strict-dynamic'/)
  assert.doesNotMatch(scriptDirective, /'unsafe-inline'/)
  assert.doesNotMatch(scriptDirective, /'unsafe-eval'/)
  assert.equal(policy.split(firstNonce).length - 1, 1)
  assert.match(
    policy,
    /connect-src 'self' https:\/\/api\.relayconsole\.work wss:\/\/api\.relayconsole\.work https:\/\/eu\.i\.posthog\.com https:\/\/sentry\.example/
  )
  assert.throws(
    () =>
      createContentSecurityPolicy(firstNonce, {
        NODE_ENV: "production",
        CLAWCHAT_RAILWAY_ORIGIN:
          "https://api.relayconsole.work injected.example",
        NEXT_PUBLIC_RAILWAY_WS_BASE_URL: "wss://api.relayconsole.work",
      }),
    /CLAWCHAT_RAILWAY_ORIGIN/
  )
})

test("Proxy forwards the exact nonce policy to rendering and the response", () => {
  const response = proxy(
    new NextRequest("https://relayconsole.work/app", {
      headers: {
        "Content-Security-Policy": "script-src 'unsafe-inline'",
        "x-nonce": "attacker-controlled",
      },
    })
  )
  const responsePolicy = response.headers.get("Content-Security-Policy")
  const forwardedPolicy = response.headers.get(
    "x-middleware-request-content-security-policy"
  )
  const forwardedNonce = response.headers.get("x-middleware-request-x-nonce")

  assert.ok(responsePolicy)
  assert.equal(forwardedPolicy, responsePolicy)
  assert.equal(isValidCspNonce(forwardedNonce), true)
  assert.equal(responsePolicy.includes(`'nonce-${forwardedNonce}'`), true)
  assert.doesNotMatch(responsePolicy, /script-src[^;]*'unsafe-inline'/)
  assert.notEqual(forwardedNonce, "attacker-controlled")
  assert.equal(response.headers.get("x-nonce"), null)
  assert.equal(response.headers.get("Cache-Control"), "private, no-store")
  assert.match(proxySource, /requestHeaders\.set\("x-nonce", nonce\)/)
  assert.match(
    proxySource,
    /requestHeaders\.set\("Content-Security-Policy", contentSecurityPolicy\)/
  )
  assert.match(
    proxySource,
    /response\.headers\.set\("Content-Security-Policy", contentSecurityPolicy\)/
  )
  assert.match(layoutSource, /export const dynamic = "force-dynamic"/)
  assert.match(layoutSource, /\(await headers\(\)\)\.get\("x-nonce"\)/)
  assert.match(layoutSource, /isValidCspNonce\(nonce\)/)
  assert.doesNotMatch(proxySource, /next-router-prefetch|purpose.*prefetch/)
  assert.match(betaOperationsSource, /per-request cryptographic nonce/)
  assert.match(betaOperationsSource, /script-src-attr 'none'/)
})

test("CSP stays compatible with sanitized scoped HTML replies", () => {
  assert.match(cspPolicySource, /style-src 'self' 'unsafe-inline'/)
  assert.doesNotMatch(cspPolicySource, /style-src-attr 'none'/)
  assert.match(cspPolicySource, /script-src-attr 'none'/)
  assert.match(htmlRendererSource, /ALLOWED_TAGS:\s*\[[\s\S]*"style"/)
  assert.match(htmlRendererSource, /FORBID_TAGS:\s*\[[\s\S]*"script"/)
  assert.match(htmlRendererSource, /FORBID_TAGS:\s*\[[\s\S]*"iframe"/)
  assert.match(htmlRendererSource, /FORBID_TAGS:\s*\[[\s\S]*"img"/)
  assert.match(htmlRendererSource, /FORBID_ATTR:\s*\[[\s\S]*"style"/)
  assert.match(htmlRendererSource, /FORBID_ATTR:\s*\[[\s\S]*"onclick"/)
  assert.match(htmlRendererSource, /styleBlockCount > 1/)
  assert.match(htmlRendererSource, /isSafeCssDeclaration/)
  assert.match(htmlRendererSource, /return \/\^\\\.cc-html-reply/)
  assert.match(
    htmlRendererSource,
    /javascript:\|expression\\s\*\\\(\|behavior\\s\*:\|url\\s\*\\\(/
  )
})

test("web security headers preserve Railway-only backend targeting", () => {
  assert.match(nextConfigSource, /CLAWCHAT_RAILWAY_ORIGIN/)
  assert.match(nextConfigSource, /NEXT_PUBLIC_RAILWAY_WS_BASE_URL/)
  assert.match(nextConfigSource, /resolveRequiredOrigin/)
  assert.match(nextConfigSource, /isLoopbackHostname/)
  assert.match(nextConfigSource, /cannot target a local backend/)
  assert.match(nextConfigSource, /target the same Railway host/)
  assert.match(nextConfigSource, /source: "\/api\/v1\/:path\*"/)
  assert.match(
    nextConfigSource,
    /destination: `\$\{railwayOrigin\}\/api\/v1\/:path\*`/
  )
})

test("web production build does not depend on network-fetched fonts", () => {
  assert.doesNotMatch(layoutSource, /next\/font\/google/)
  assert.match(globalsSource, /--font-sans:/)
  assert.match(globalsSource, /--font-mono:/)
})
