#!/usr/bin/env node

const apiOrigin = normalizeOrigin(argument("api-origin"))
const email = String(process.env.CLAWCHAT_BETA_SMOKE_EMAIL || "").trim()
const password = process.env.CLAWCHAT_BETA_SMOKE_PASSWORD || ""

if (!email || !password) {
  throw new Error("Railway smoke credentials are required.")
}

const login = await request("/api/v1/auth/login", {
  method: "POST",
  body: { email, password, deviceName: "Release lifecycle rehearsal", platform: "macOS" },
})
if (!login.ok) throw new Error(`Smoke login failed with HTTP ${login.status}.`)
const accessToken = login.body?.data?.accessToken ?? login.body?.accessToken
if (typeof accessToken !== "string" || !accessToken) {
  throw new Error("Smoke login did not return an access token.")
}

const exported = await request("/api/v1/auth/account/export", {
  method: "GET",
  accessToken,
})
if (!exported.ok || !(exported.body?.data ?? exported.body)) {
  throw new Error(`Account export failed with HTTP ${exported.status}.`)
}

const deleted = await request("/api/v1/auth/account", {
  method: "DELETE",
  accessToken,
  body: { currentPassword: password, confirmation: "DELETE" },
})
if (!deleted.ok) throw new Error(`Account deletion failed with HTTP ${deleted.status}.`)

const rejectedLogin = await request("/api/v1/auth/login", {
  method: "POST",
  body: { email, password, deviceName: "Release lifecycle verification", platform: "macOS" },
})
if (rejectedLogin.status !== 401) {
  throw new Error(`Deleted-account login returned HTTP ${rejectedLogin.status}, expected 401.`)
}

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    apiOrigin,
    exportCompleted: true,
    deletionCompleted: true,
    deletedAccountLoginRejected: true,
  }, null, 2)}\n`,
)

async function request(path, { method, accessToken = "", body = undefined }) {
  const response = await fetch(new URL(path, apiOrigin), {
    method,
    redirect: "manual",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    // Status-only failures keep response content out of release output.
  }
  return { ok: response.ok, status: response.status, body: parsed }
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
