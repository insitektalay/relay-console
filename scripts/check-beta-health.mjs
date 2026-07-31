#!/usr/bin/env node

import { createRequire } from "node:module"

const argv = process.argv.slice(2)
const strictLaunchHealth =
  argv.includes("--strict") || isTruthy(process.env.CLAWCHAT_BETA_HEALTH_STRICT)
const positionalArgs = argv.filter((arg) => arg !== "--strict")
const backendOrigin = normalizeOrigin(
  process.env.CLAWCHAT_RAILWAY_ORIGIN || positionalArgs[0] || "",
)
const webOrigin = normalizeOrigin(
  process.env.CLAWCHAT_WEB_ORIGIN || positionalArgs[1] || "",
)
const websocketOrigin = normalizeWebsocketOrigin(
  process.env.NEXT_PUBLIC_RAILWAY_WS_BASE_URL ||
    defaultWebsocketOrigin(backendOrigin),
)
const websocketOriginHeader = normalizeOrigin(
  process.env.CLAWCHAT_WS_ORIGIN_HEADER || webOrigin,
)
const smokeEmail = (process.env.CLAWCHAT_BETA_SMOKE_EMAIL || "").trim()
const smokePassword = process.env.CLAWCHAT_BETA_SMOKE_PASSWORD || ""
const smokeWorkspaceId = (
  process.env.CLAWCHAT_BETA_SMOKE_WORKSPACE_ID || ""
).trim()
const operatorSecret = process.env.RELAY_OPERATOR_API_SECRET || ""

if (!backendOrigin) {
  console.error(
    "Set CLAWCHAT_RAILWAY_ORIGIN or pass the Railway backend origin as the first argument.",
  )
  process.exit(2)
}

if (isLoopbackOrigin(backendOrigin)) {
  console.error("Refusing to health-check a loopback backend origin for beta.")
  process.exit(2)
}

if (webOrigin && isLoopbackOrigin(webOrigin)) {
  console.error("Refusing to health-check a loopback web origin for beta.")
  process.exit(2)
}

if (!websocketOrigin) {
  console.error(
    "Set NEXT_PUBLIC_RAILWAY_WS_BASE_URL to the Railway websocket origin.",
  )
  process.exit(2)
}

if (isLoopbackOrigin(websocketOrigin)) {
  console.error("Refusing to health-check a loopback websocket origin for beta.")
  process.exit(2)
}

const checks = []
checks.push(await checkJson("backend_live", new URL("/api/v1/health", backendOrigin)))
if (operatorSecret) {
  const operatorHeaders = {
    "x-relay-operator-secret": operatorSecret,
  }
  checks.push(
    await checkJson(
      "backend_ready",
      new URL("/api/v1/health/ready", backendOrigin),
      operatorHeaders,
    ),
  )
  checks.push(
    await checkJson(
      "production_synthetic",
      new URL("/api/v1/health/synthetic", backendOrigin),
      operatorHeaders,
    ),
  )
} else {
  checks.push(
    skippedCheck(
      "backend_ready",
      "Set RELAY_OPERATOR_API_SECRET to verify protected backend readiness.",
      strictLaunchHealth,
    ),
  )
  checks.push(
    skippedCheck(
      "production_synthetic",
      "Set RELAY_OPERATOR_API_SECRET to verify the protected synthetic journey.",
      strictLaunchHealth,
    ),
  )
}
if (webOrigin) {
  checks.push(await checkHttp("web_root", new URL("/", webOrigin)))
  checks.push(
    await checkJson("web_api_rewrite_live", new URL("/api/v1/health", webOrigin)),
  )
  if (operatorSecret) {
    checks.push(
      await checkJson(
        "web_api_rewrite_ready",
        new URL("/api/v1/health/ready", webOrigin),
        { "x-relay-operator-secret": operatorSecret },
      ),
    )
  } else {
    checks.push(
      skippedCheck(
        "web_api_rewrite_ready",
        "Set RELAY_OPERATOR_API_SECRET to verify protected readiness through the deployed web /api/v1 rewrite.",
        strictLaunchHealth,
      ),
    )
  }
} else {
  checks.push(
    skippedCheck(
      "web_api_rewrite_live",
      "Set CLAWCHAT_WEB_ORIGIN to verify the deployed web /api/v1 rewrite.",
      strictLaunchHealth,
    ),
  )
  checks.push(
    skippedCheck(
      "web_api_rewrite_ready",
      "Set CLAWCHAT_WEB_ORIGIN to verify the deployed web /api/v1 readiness rewrite.",
      strictLaunchHealth,
    ),
  )
}
checks.push(
  await checkAuthenticatedWebsocketSmoke({
    apiOrigin: webOrigin || backendOrigin,
    websocketOrigin,
    webOrigin: websocketOriginHeader,
    email: smokeEmail,
    password: smokePassword,
    workspaceId: smokeWorkspaceId,
    strictLaunchHealth,
  }),
)
checks.push(
  await checkBillingObservability({
    backendOrigin,
    operatorSecret,
    strictLaunchHealth,
  }),
)
checks.push(
  await checkOperationsObservability({
    backendOrigin,
    operatorSecret,
    strictLaunchHealth,
  }),
)

const ok = checks.every((check) => check.ok)
console.log(
  JSON.stringify(
    {
      ok,
      checkedAt: new Date().toISOString(),
      checks,
    },
    null,
    2,
  ),
)
process.exit(ok ? 0 : 1)

function normalizeOrigin(value) {
  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed) return ""
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "https:") return ""
    return url.origin
  } catch {
    return ""
  }
}

function normalizeWebsocketOrigin(value) {
  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed) return ""
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "wss:") return ""
    return url.origin
  } catch {
    return ""
  }
}

function defaultWebsocketOrigin(origin) {
  if (!origin) return ""
  const url = new URL(origin)
  url.protocol = "wss:"
  return url.origin
}

function isLoopbackOrigin(origin) {
  const hostname = new URL(origin).hostname.toLowerCase()
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  )
}

function isTruthy(value) {
  return ["1", "true", "yes", "y", "on"].includes(
    String(value || "").trim().toLowerCase(),
  )
}

function skippedCheck(name, reason, required = false) {
  return {
    name,
    ok: !required,
    skipped: true,
    reason,
    ...(required
      ? {
          required: true,
          error: "required_check_skipped",
        }
      : {}),
  }
}

async function checkJson(name, url, headers = {}) {
  const result = await checkHttp(name, url, true, headers)
  if (!result.ok) return result
  try {
    const body = result.body ? JSON.parse(result.body) : null
    return {
      ...result,
      ok: result.ok && body?.ok === true,
      body: undefined,
      serviceOk: body?.ok === true,
      status: body?.status ?? null,
      service: body?.service ?? null,
    }
  } catch {
    return {
      ...result,
      ok: false,
      body: undefined,
      error: "invalid_json",
    }
  }
}

async function checkHttp(name, url, retainBody = false, headers = {}) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers,
      signal: controller.signal,
    })
    const body = await response.text()
    return {
      name,
      url: redactUrl(url),
      ok: response.ok,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      body: retainBody ? body.slice(0, 2_000) : undefined,
    }
  } catch (error) {
    const requestError = describeRequestError(error)
    return {
      name,
      url: redactUrl(url),
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: requestError.name,
      errorCode: requestError.code,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function checkBillingObservability({
  backendOrigin,
  operatorSecret,
  strictLaunchHealth,
}) {
  if (!operatorSecret) {
    return skippedCheck(
      "billing_observability",
      "Set RELAY_OPERATOR_API_SECRET to verify billing and entitlement monitoring.",
      strictLaunchHealth,
    )
  }

  const name = "billing_observability"
  const url = new URL(
    "/api/v1/operator/billing-observability",
    backendOrigin,
  )
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "application/json",
        "x-relay-operator-secret": operatorSecret,
      },
      signal: controller.signal,
    })
    const text = await response.text()
    let snapshot = null
    try {
      snapshot = JSON.parse(text)?.data ?? null
    } catch {
      return {
        name,
        url: redactUrl(url),
        ok: false,
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
        error: "invalid_json",
      }
    }

    const privacy = snapshot?.privacy
    const privacySafe =
      privacy?.workspaceIdsIncluded === false &&
      privacy?.customerIdentifiersIncluded === false &&
      privacy?.providerSubscriptionIdentifiersIncluded === false &&
      privacy?.emailsIncluded === false &&
      privacy?.payloadHashesIncluded === false &&
      privacy?.customerContentIncluded === false &&
      privacy?.secretValuesIncluded === false
    const allowedAlerts = new Set([
      "BILLING_EVENT_FAILURES",
      "BILLING_EVENT_STUCK",
      "PAYMENT_ATTENTION_REQUIRED",
      "ENTITLEMENT_MISMATCHES",
      "MIGRATION_GRACE_EXPIRING",
      "MIGRATION_GRACE_EXPIRED",
    ])
    const alerts = Array.isArray(snapshot?.alerts)
      ? snapshot.alerts.filter((value) => allowedAlerts.has(value))
      : []
    const contractValid =
      snapshot?.schemaVersion === "relay.billing-observability.v1" &&
      ["healthy", "attention"].includes(snapshot?.status) &&
      Array.isArray(snapshot?.alerts)

    return {
      name,
      url: redactUrl(url),
      ok:
        response.ok &&
        contractValid &&
        privacySafe &&
        snapshot.status === "healthy" &&
        alerts.length === 0,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      snapshotStatus: contractValid ? snapshot.status : "invalid_contract",
      alerts,
      activePaidSubscriptions: safeCount(
        snapshot?.revenue?.activePaidSubscriptions,
      ),
      failedBillingEvents: safeCount(
        snapshot?.billingEvents?.failedInWindow,
      ),
      staleBillingEvents: safeCount(
        snapshot?.billingEvents?.staleProcessing,
      ),
      entitlementMismatches: safeCount(
        snapshot?.entitlementConsistency?.mismatchCount,
      ),
      privacySafe,
    }
  } catch (error) {
    const requestError = describeRequestError(error)
    return {
      name,
      url: redactUrl(url),
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: requestError.name,
      errorCode: requestError.code,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function checkOperationsObservability({
  backendOrigin,
  operatorSecret,
  strictLaunchHealth,
}) {
  if (!operatorSecret) {
    return skippedCheck(
      "operations_observability",
      "Set RELAY_OPERATOR_API_SECRET to verify bridge, runtime, and Marketplace OAuth monitoring.",
      strictLaunchHealth,
    )
  }

  const name = "operations_observability"
  const url = new URL(
    "/api/v1/operator/operations-observability",
    backendOrigin,
  )
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "application/json",
        "x-relay-operator-secret": operatorSecret,
      },
      signal: controller.signal,
    })
    const text = await response.text()
    let snapshot = null
    try {
      snapshot = JSON.parse(text)?.data ?? null
    } catch {
      return {
        name,
        url: redactUrl(url),
        ok: false,
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
        error: "invalid_json",
      }
    }

    const privacy = snapshot?.privacy
    const privacySafe =
      privacy?.workspaceIdsIncluded === false &&
      privacy?.customerIdentifiersIncluded === false &&
      privacy?.deviceIdentifiersIncluded === false &&
      privacy?.providerConnectionIdentifiersIncluded === false &&
      privacy?.eventPayloadsIncluded === false &&
      privacy?.errorMessagesIncluded === false &&
      privacy?.customerContentIncluded === false &&
      privacy?.secretValuesIncluded === false
    const allowedAlerts = new Set([
      "BRIDGE_EVENT_FAILURES",
      "BRIDGE_EVENTS_STUCK",
      "RUNTIME_DISPATCHES_STUCK",
      "OAUTH_REFRESH_FAILURES",
    ])
    const alerts = Array.isArray(snapshot?.alerts)
      ? snapshot.alerts.filter((value) => allowedAlerts.has(value))
      : []
    const contractValid =
      snapshot?.schemaVersion === "relay.operations-observability.v1" &&
      ["healthy", "attention"].includes(snapshot?.status) &&
      Array.isArray(snapshot?.alerts)

    return {
      name,
      url: redactUrl(url),
      ok:
        response.ok &&
        contractValid &&
        privacySafe &&
        snapshot.status === "healthy" &&
        alerts.length === 0,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      snapshotStatus: contractValid ? snapshot.status : "invalid_contract",
      alerts,
      activeBridgeDevices: safeCount(snapshot?.bridge?.devices?.activeCount),
      recentBridgeDevices: safeCount(snapshot?.bridge?.devices?.recentCount),
      failedBridgeEvents: safeCount(snapshot?.bridge?.events?.failedInWindowCount),
      staleBridgeEvents: safeCount(snapshot?.bridge?.events?.stalePendingCount),
      staleRuntimeDispatches: safeCount(snapshot?.runtimes?.dispatches?.staleActiveCount),
      oauthRefreshFailures: safeCount(snapshot?.marketplace?.oauth?.refreshFailedInWindowCount),
      privacySafe,
    }
  } catch (error) {
    const requestError = describeRequestError(error)
    return {
      name,
      url: redactUrl(url),
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: requestError.name,
      errorCode: requestError.code,
    }
  } finally {
    clearTimeout(timer)
  }
}

function safeCount(value) {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : 0
}

async function checkAuthenticatedWebsocketSmoke({
  apiOrigin,
  websocketOrigin,
  webOrigin,
  email,
  password,
  workspaceId,
  strictLaunchHealth,
}) {
  if (!email || !password) {
    return skippedCheck(
      "authenticated_websocket_smoke",
      "Set CLAWCHAT_BETA_SMOKE_EMAIL and CLAWCHAT_BETA_SMOKE_PASSWORD to enable authenticated websocket smoke.",
      strictLaunchHealth,
    )
  }

  const startedAt = Date.now()
  const cookieJar = new Map()
  const steps = []
  const apiBase = new URL("/api/v1", apiOrigin)

  const csrf = await fetchJsonWithCookies(
    new URL("./auth/csrf", `${apiBase}/`),
    { method: "GET", headers: { accept: "application/json" } },
    cookieJar,
  )
  const loginCsrfToken =
    csrf.body?.data?.csrfToken ??
    csrf.body?.csrfToken ??
    cookieJar.get("clawchat_web_csrf") ??
    ""
  steps.push(summarizeHttpStep("csrf", csrf))
  if (!csrf.ok || !loginCsrfToken) {
    return websocketSmokeResult(false, startedAt, apiBase, websocketOrigin, steps)
  }

  const login = await fetchJsonWithCookies(
    new URL("./auth/web/login", `${apiBase}/`),
    {
      method: "POST",
      headers: {
        ...jsonHeaders(),
        ...cookieHeaders(cookieJar),
        "x-csrf-token": loginCsrfToken,
      },
      body: JSON.stringify({ email, password }),
    },
    cookieJar,
  )
  steps.push(summarizeHttpStep("login", login))
  if (!login.ok) {
    return websocketSmokeResult(false, startedAt, apiBase, websocketOrigin, steps)
  }

  let selectedWorkspaceId = workspaceId
  let workspaceSource = selectedWorkspaceId ? "env" : "discovered"
  if (!selectedWorkspaceId) {
    const workspaces = await fetchJsonWithCookies(
      new URL("./workspaces", `${apiBase}/`),
      {
        method: "GET",
        headers: cookieHeaders(cookieJar),
      },
      cookieJar,
    )
    const workspaceCount = Array.isArray(workspaces.body?.data)
      ? workspaces.body.data.length
      : 0
    steps.push({
      ...summarizeHttpStep("workspace_list", workspaces),
      workspaceCount,
    })
    selectedWorkspaceId =
      typeof workspaces.body?.data?.[0]?.id === "string"
        ? workspaces.body.data[0].id
        : ""
    if (!workspaces.ok || !selectedWorkspaceId) {
      return websocketSmokeResult(
        false,
        startedAt,
        apiBase,
        websocketOrigin,
        steps,
        "no_workspace_available",
      )
    }
  }

  const csrfToken =
    typeof (login.body?.data?.csrfToken ?? login.body?.csrfToken) === "string"
      ? (login.body?.data?.csrfToken ?? login.body?.csrfToken)
      : cookieJar.get("clawchat_web_csrf") || ""
  const ticket = await fetchJsonWithCookies(
    new URL("./auth/ws-ticket", `${apiBase}/`),
    {
      method: "POST",
      headers: {
        ...jsonHeaders(),
        ...cookieHeaders(cookieJar),
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      body: JSON.stringify({ workspaceId: selectedWorkspaceId }),
    },
    cookieJar,
  )
  steps.push(summarizeHttpStep("ws_ticket", ticket))
  const websocketTicket = ticket.body?.data?.ticket ?? ticket.body?.ticket
  if (!ticket.ok || typeof websocketTicket !== "string") {
    return websocketSmokeResult(false, startedAt, apiBase, websocketOrigin, steps)
  }

  const socketStep = await checkWebsocketTicket({
    websocketOrigin,
    webOrigin,
    ticket: websocketTicket,
  })
  steps.push(socketStep)

  return websocketSmokeResult(
    socketStep.ok,
    startedAt,
    apiBase,
    websocketOrigin,
    steps,
    socketStep.ok ? undefined : socketStep.error,
    { workspaceSource },
  )
}

async function checkWebsocketTicket({ websocketOrigin, webOrigin, ticket }) {
  const WebSocketClient = loadWebSocketClient()
  if (!WebSocketClient) {
    return {
      name: "websocket_connect",
      ok: false,
      error: "websocket_client_unavailable",
    }
  }

  const url = new URL(websocketOrigin)
  url.searchParams.set("ticket", ticket)

  return await new Promise((resolve) => {
    let settled = false
    const socket = new WebSocketClient(url.toString(), {
      headers: webOrigin ? { Origin: webOrigin } : undefined,
    })
    const timer = setTimeout(() => {
      finish({
        name: "websocket_connect",
        ok: false,
        error: "timeout_waiting_for_authenticated_event",
      })
    }, 10_000)

    function finish(result) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        socket.close()
      } catch {
        // Ignore close races while converting the socket state into a check.
      }
      resolve(result)
    }

    socket.on("message", (data) => {
      try {
        const payload = JSON.parse(String(data))
        if (payload?.type === "authenticated") {
          finish({
            name: "websocket_connect",
            ok: true,
            event: "authenticated",
          })
        } else if (payload?.type === "auth_error") {
          finish({
            name: "websocket_connect",
            ok: false,
            event: "auth_error",
          })
        }
      } catch {
        finish({
          name: "websocket_connect",
          ok: false,
          error: "invalid_websocket_json",
        })
      }
    })
    socket.on("close", (code, reason) => {
      finish({
        name: "websocket_connect",
        ok: false,
        closeCode: code,
        closeReasonPresent: String(reason ?? "").length > 0,
      })
    })
    socket.on("error", (error) => {
      finish({
        name: "websocket_connect",
        ok: false,
        error: error instanceof Error ? error.name : "websocket_error",
      })
    })
  })
}

function loadWebSocketClient() {
  try {
    const requireFromBackend = createRequire(
      new URL("../backend/package.json", import.meta.url),
    )
    const wsModule = requireFromBackend("ws")
    return wsModule.WebSocket || wsModule.default || wsModule
  } catch {
    return null
  }
}

async function fetchJsonWithCookies(url, options, cookieJar) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, {
      ...options,
      redirect: "manual",
      signal: controller.signal,
    })
    storeResponseCookies(response.headers, cookieJar)
    const text = await response.text()
    let body = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      return {
        ok: false,
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
        error: "invalid_json",
      }
    }
    return {
      ok: response.ok,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      body,
    }
  } catch (error) {
    const requestError = describeRequestError(error)
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: requestError.name,
      errorCode: requestError.code,
    }
  } finally {
    clearTimeout(timer)
  }
}

function jsonHeaders() {
  return {
    "content-type": "application/json",
    accept: "application/json",
  }
}

function cookieHeaders(cookieJar) {
  const cookie = [...cookieJar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
  return cookie ? { cookie } : {}
}

function storeResponseCookies(headers, cookieJar) {
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : splitSetCookieHeader(headers.get("set-cookie"))
  for (const cookie of setCookies) {
    const [pair] = cookie.split(";")
    const separator = pair.indexOf("=")
    if (separator <= 0) continue
    cookieJar.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
}

function splitSetCookieHeader(value) {
  if (!value) return []
  const cookies = []
  let start = 0
  let inExpires = false
  for (let index = 0; index < value.length; index += 1) {
    const slice = value.slice(index, index + 8).toLowerCase()
    if (slice === "expires=") {
      inExpires = true
    }
    const char = value[index]
    if (inExpires && char === ";") {
      inExpires = false
    }
    if (!inExpires && char === ",") {
      cookies.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  cookies.push(value.slice(start).trim())
  return cookies.filter(Boolean)
}

function summarizeHttpStep(name, result) {
  return {
    name,
    ok: result.ok,
    statusCode: result.statusCode ?? null,
    latencyMs: result.latencyMs,
    error: result.error ?? undefined,
  }
}

function websocketSmokeResult(
  ok,
  startedAt,
  apiBase,
  websocketOrigin,
  steps,
  error,
  details = {},
) {
  return {
    name: "authenticated_websocket_smoke",
    ok,
    url: redactUrl(new URL(websocketOrigin)),
    apiBase: redactUrl(new URL(apiBase)),
    latencyMs: Date.now() - startedAt,
    steps,
    error,
    ...details,
  }
}

function describeRequestError(error) {
  if (!(error instanceof Error)) {
    return { name: "request_failed", code: undefined }
  }
  const cause = error.cause
  return {
    name: error.name,
    code:
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      typeof cause.code === "string"
        ? cause.code
        : undefined,
  }
}

function redactUrl(url) {
  const copy = new URL(url.toString())
  copy.username = ""
  copy.password = ""
  copy.search = ""
  return copy.toString()
}
