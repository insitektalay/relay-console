import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(testDir, "../..")

test("beta health script verifies public liveness and protected readiness", () => {
  const script = readFileSync(
    resolve(repoRoot, "scripts/check-beta-health.mjs"),
    "utf8"
  )

  assert.match(script, /web_api_rewrite_live/)
  assert.match(script, /web_api_rewrite_ready/)
  assert.match(script, /new URL\("\/api\/v1\/health", webOrigin\)/)
  assert.match(script, /new URL\("\/api\/v1\/health\/ready", webOrigin\)/)
  assert.match(script, /x-relay-operator-secret/)
  assert.match(
    script,
    /Set RELAY_OPERATOR_API_SECRET to verify protected backend readiness/
  )
  assert.match(script, /CLAWCHAT_WEB_ORIGIN/)
})

test("beta health script strict mode fails skipped launch-critical checks", () => {
  const script = readFileSync(
    resolve(repoRoot, "scripts/check-beta-health.mjs"),
    "utf8"
  )

  assert.match(script, /CLAWCHAT_BETA_HEALTH_STRICT/)
  assert.match(script, /argv\.includes\("--strict"\)/)
  assert.match(script, /strictLaunchHealth/)
  assert.match(script, /required_check_skipped/)
  assert.match(
    script,
    /Set CLAWCHAT_WEB_ORIGIN to verify the deployed web \/api\/v1 rewrite/
  )
  assert.match(
    script,
    /Set CLAWCHAT_BETA_SMOKE_EMAIL and CLAWCHAT_BETA_SMOKE_PASSWORD/
  )
  assert.match(script, /ok: !required/)
})

test("beta health script supports optional authenticated websocket smoke", () => {
  const script = readFileSync(
    resolve(repoRoot, "scripts/check-beta-health.mjs"),
    "utf8"
  )

  assert.match(script, /authenticated_websocket_smoke/)
  assert.match(script, /CLAWCHAT_BETA_SMOKE_EMAIL/)
  assert.match(script, /CLAWCHAT_BETA_SMOKE_PASSWORD/)
  assert.match(script, /CLAWCHAT_BETA_SMOKE_WORKSPACE_ID/)
  assert.match(script, /NEXT_PUBLIC_RAILWAY_WS_BASE_URL/)
  assert.match(script, /\/auth\/web\/login/)
  assert.match(script, /\/auth\/ws-ticket/)
  assert.match(script, /websocket_connect/)
  assert.match(script, /authenticated/)
  assert.match(script, /createRequire/)
})

test("beta health script keeps beta origins Railway-only and redacted", () => {
  const script = readFileSync(
    resolve(repoRoot, "scripts/check-beta-health.mjs"),
    "utf8"
  )

  assert.match(script, /Refusing to health-check a loopback backend origin/)
  assert.match(script, /Refusing to health-check a loopback web origin/)
  assert.match(script, /Refusing to health-check a loopback websocket origin/)
  assert.match(script, /copy\.search = ""/)
  assert.match(script, /closeReasonPresent/)
  assert.doesNotMatch(script, /closeReason:/)
  assert.doesNotMatch(script, /sanitizeReason/)
  assert.match(
    script,
    /checkHttp\(name, url, retainBody = false, headers = \{\}\)/
  )
  assert.match(
    script,
    /body: retainBody \? body\.slice\(0, 2_000\) : undefined/
  )
  assert.doesNotMatch(script, /console\.log\([^)]*operatorSecret/)
})

test("beta health script checks secret-safe billing observability in strict mode", () => {
  const script = readFileSync(
    resolve(repoRoot, "scripts/check-beta-health.mjs"),
    "utf8"
  )
  const billingObservabilityService = readFileSync(
    resolve(
      repoRoot,
      "backend/src/modules/cloud-commercial/billing-observability.service.ts"
    ),
    "utf8"
  )

  assert.match(script, /billing_observability/)
  assert.match(script, /RELAY_OPERATOR_API_SECRET/)
  assert.match(script, /\/api\/v1\/operator\/billing-observability/)
  assert.match(script, /x-relay-operator-secret/)
  assert.match(script, /relay\.billing-observability\.v1/)
  assert.match(script, /privacySafe/)
  assert.match(script, /activePaidSubscriptions/)
  assert.match(script, /failedBillingEvents/)
  assert.match(script, /entitlementMismatches/)
  assert.doesNotMatch(script, /console\.log\([^)]*operatorSecret/)

  const alertConstruction =
    billingObservabilityService.match(
      /const alerts = \[([\s\S]*?)\n    \];/
    )?.[1] ?? ""
  const alertCodes = [
    ...alertConstruction.matchAll(/"([A-Z][A-Z0-9_]+)"/g),
  ].map((match) => match[1])
  assert.ok(alertCodes.length > 0, "billing alert codes should be discoverable")
  for (const alertCode of new Set(alertCodes)) {
    assert.match(
      script,
      new RegExp(`"${alertCode}"`),
      `strict smoke should report ${alertCode}`
    )
  }
})

test("beta health script checks secret-safe operations observability in strict mode", () => {
  const script = readFileSync(
    resolve(repoRoot, "scripts/check-beta-health.mjs"),
    "utf8"
  )
  const operationsObservabilityService = readFileSync(
    resolve(
      repoRoot,
      "backend/src/modules/cloud-commercial/operations-observability.service.ts"
    ),
    "utf8"
  )

  assert.match(script, /operations_observability/)
  assert.match(script, /\/api\/v1\/operator\/operations-observability/)
  assert.match(script, /relay\.operations-observability\.v1/)
  assert.match(script, /failedBridgeEvents/)
  assert.match(script, /staleRuntimeDispatches/)
  assert.match(script, /oauthRefreshFailures/)
  assert.match(script, /deviceIdentifiersIncluded/)
  assert.doesNotMatch(script, /console\.log\([^)]*operatorSecret/)

  const alertConstruction =
    operationsObservabilityService.match(
      /const alerts = \[([\s\S]*?)\n    \];/
    )?.[1] ?? ""
  const alertCodes = [
    ...alertConstruction.matchAll(/"([A-Z][A-Z0-9_]+)"/g),
  ].map((match) => match[1])
  assert.ok(
    alertCodes.length > 0,
    "operations alert codes should be discoverable"
  )
  for (const alertCode of new Set(alertCodes)) {
    assert.match(
      script,
      new RegExp(`"${alertCode}"`),
      `strict smoke should report ${alertCode}`
    )
  }
})
