#!/usr/bin/env node

import { randomBytes } from "node:crypto"

const apiOrigin = normalizeOrigin(argument("api-origin"))
const email = String(process.env.CLAWCHAT_BETA_SMOKE_EMAIL || "").trim()
const password = process.env.CLAWCHAT_BETA_SMOKE_PASSWORD || ""
const workspaceId = String(process.env.CLAWCHAT_BETA_SMOKE_WORKSPACE_ID || "").trim()

if (!email || !password || !workspaceId) {
  throw new Error("Railway smoke account and workspace variables are required.")
}

const login = await request("/api/v1/auth/login", {
  method: "POST",
  body: {
    email,
    password,
    deviceName: "Release bridge-revocation rehearsal",
    platform: "macOS",
  },
})
if (!login.ok) throw new Error(`Smoke login failed with HTTP ${login.status}.`)
const accessToken = unwrap(login.body)?.accessToken
if (typeof accessToken !== "string" || !accessToken) {
  throw new Error("Smoke login did not return an access token.")
}

const enrollment = await request(
  `/api/v1/bridge/workspaces/${encodeURIComponent(workspaceId)}/enrollments`,
  {
    method: "POST",
    accessToken,
    body: { deviceLabel: "Release revocation rehearsal", expiresInMinutes: 5 },
  },
)
if (!enrollment.ok) {
  throw new Error(`Bridge enrollment creation failed with HTTP ${enrollment.status}.`)
}
const enrollmentCode = unwrap(enrollment.body)?.code
if (typeof enrollmentCode !== "string" || !enrollmentCode) {
  throw new Error("Bridge enrollment did not return a one-time code.")
}

const metadata = {
  deviceLabel: "Release revocation rehearsal",
  pluginVersion: "0.2.0-rc.1",
  openCoreVersion: "v2026.7.7.2",
  runtimeType: "hermes",
  hostType: "macos-launchd",
  apiContractVersion: "v2",
  websocketContractVersion: "bridge.v1",
  capabilities: [
    "clawchat.bridge.rotating_credentials.v1",
    "clawchat.runtime.hermes",
  ],
}
const redeemed = await request("/api/v1/bridge/enroll", {
  method: "POST",
  body: { code: enrollmentCode, ...metadata },
})
if (!redeemed.ok) {
  throw new Error(`Bridge enrollment redemption failed with HTTP ${redeemed.status}.`)
}
const redemption = unwrap(redeemed.body)
const deviceId = redemption?.device?.id
const devicePublicId = redemption?.credentials?.devicePublicId
const deviceToken = redemption?.credentials?.deviceToken
if (![deviceId, devicePublicId, deviceToken].every((value) => typeof value === "string" && value)) {
  throw new Error("Bridge enrollment redemption returned incomplete credentials.")
}

const authenticated = await request("/api/v1/bridge/device/auth", {
  method: "POST",
  body: { devicePublicId, deviceToken, ...metadata },
})
if (!authenticated.ok) {
  throw new Error(`Fresh bridge credential failed with HTTP ${authenticated.status}.`)
}
const authResult = unwrap(authenticated.body)
const rotatedDeviceToken = authResult?.credentials?.deviceToken
if (
  typeof rotatedDeviceToken !== "string" ||
  !rotatedDeviceToken ||
  authResult?.tokens?.accessExpiresIn !== 900 ||
  authResult?.tokens?.wsExpiresIn !== 300
) {
  throw new Error("Bridge authentication did not return bounded rotated credentials.")
}

const invalid = await request("/api/v1/bridge/device/auth", {
  method: "POST",
  body: {
    devicePublicId,
    deviceToken: randomBytes(32).toString("base64url"),
    ...metadata,
  },
})
if (invalid.status !== 401) {
  throw new Error(`Invalid bridge credential returned HTTP ${invalid.status}, expected 401.`)
}

const revoked = await request(
  `/api/v1/bridge/devices/${encodeURIComponent(deviceId)}/revoke`,
  { method: "POST", accessToken },
)
if (!revoked.ok) {
  throw new Error(`Bridge credential revocation failed with HTTP ${revoked.status}.`)
}

const rejected = await request("/api/v1/bridge/device/auth", {
  method: "POST",
  body: { devicePublicId, deviceToken: rotatedDeviceToken, ...metadata },
})
if (rejected.status !== 401) {
  throw new Error(`Revoked bridge credential returned HTTP ${rejected.status}, expected 401.`)
}

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    apiOrigin,
    oneTimeEnrollmentRedeemed: true,
    freshCredentialAuthenticated: true,
    invalidCredentialRejected: true,
    credentialRevoked: true,
    revokedCredentialRejected: true,
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
      "user-agent": "Relay release bridge-revocation rehearsal",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
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
