#!/usr/bin/env node

const apiOrigin = normalizeOrigin(argument("api-origin"))
const email = String(process.env.CLAWCHAT_BETA_SMOKE_EMAIL || "").trim()
const password = process.env.CLAWCHAT_BETA_SMOKE_PASSWORD || ""

if (!email || !password) {
  throw new Error("Railway smoke credentials are required.")
}

const revokedJar = new Map()
const controlJar = new Map()

await login(revokedJar, "Relay release revocation target")
await login(controlJar, "Relay release revocation control")

const sessions = await request("/api/v1/auth/web/sessions", {
  method: "GET",
  jar: controlJar,
})
if (!sessions.ok) {
  throw new Error(`Browser-session listing failed with HTTP ${sessions.status}.`)
}

const sessionRows = unwrap(sessions.body)
if (!Array.isArray(sessionRows)) {
  throw new Error("Browser-session listing returned an invalid response.")
}
const target = sessionRows.find(
  (session) =>
    session?.active === true &&
    session?.userAgent === "Relay release revocation target",
)
if (typeof target?.id !== "string" || !target.id) {
  throw new Error("The revocation target browser session was not found.")
}

const csrfToken = controlJar.get("clawchat_web_csrf") || ""
const revoked = await request(
  `/api/v1/auth/web/sessions/${encodeURIComponent(target.id)}/revoke`,
  {
    method: "POST",
    jar: controlJar,
    csrfToken,
  },
)
if (!revoked.ok) {
  throw new Error(`Browser-session revocation failed with HTTP ${revoked.status}.`)
}

const rejected = await request("/api/v1/auth/session", {
  method: "GET",
  jar: revokedJar,
})
if (rejected.status !== 401) {
  throw new Error(`Revoked browser session returned HTTP ${rejected.status}, expected 401.`)
}

const control = await request("/api/v1/auth/session", {
  method: "GET",
  jar: controlJar,
})
if (!control.ok) {
  throw new Error(`Control browser session returned HTTP ${control.status}.`)
}

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    apiOrigin,
    concurrentSessionsEstablished: true,
    selectedSessionRevoked: true,
    revokedSessionRejected: true,
    controlSessionRemainedActive: true,
  }, null, 2)}\n`,
)

async function login(jar, userAgent) {
  const csrf = await request("/api/v1/auth/csrf", {
    method: "GET",
    jar,
    userAgent,
  })
  const csrfToken =
    unwrap(csrf.body)?.csrfToken || jar.get("clawchat_web_csrf") || ""
  if (!csrf.ok || !csrfToken) {
    throw new Error(`CSRF initialization failed with HTTP ${csrf.status}.`)
  }

  const response = await request("/api/v1/auth/web/login", {
    method: "POST",
    jar,
    userAgent,
    csrfToken,
    body: { email, password },
  })
  if (!response.ok) {
    throw new Error(`Browser login failed with HTTP ${response.status}.`)
  }
}

async function request(
  path,
  { method, jar, userAgent = "Relay release revocation control", csrfToken = "", body },
) {
  const response = await fetch(new URL(path, apiOrigin), {
    method,
    redirect: "manual",
    headers: {
      accept: "application/json",
      "user-agent": userAgent,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...cookieHeaders(jar),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  storeResponseCookies(response.headers, jar)
  const text = await response.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    // Keep response content out of release output.
  }
  return { ok: response.ok, status: response.status, body: parsed }
}

function unwrap(value) {
  return value?.data ?? value
}

function cookieHeaders(jar) {
  const cookie = [...jar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
  return cookie ? { cookie } : {}
}

function storeResponseCookies(headers, jar) {
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : splitSetCookieHeader(headers.get("set-cookie"))
  for (const cookie of setCookies) {
    const [pair] = cookie.split(";")
    const separator = pair.indexOf("=")
    if (separator <= 0) continue
    jar.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
}

function splitSetCookieHeader(value) {
  if (!value) return []
  const cookies = []
  let start = 0
  let inExpires = false
  for (let index = 0; index < value.length; index += 1) {
    if (value.slice(index, index + 8).toLowerCase() === "expires=") {
      inExpires = true
    }
    if (inExpires && value[index] === ";") inExpires = false
    if (!inExpires && value[index] === ",") {
      cookies.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  cookies.push(value.slice(start).trim())
  return cookies.filter(Boolean)
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`)
  const value = index >= 0 ? process.argv[index + 1] : ""
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

function normalizeOrigin(value) {
  const url = new URL(value)
  if (url.protocol !== "https:") throw new Error("The API origin must use HTTPS.")
  return url.origin
}
