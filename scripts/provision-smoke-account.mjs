#!/usr/bin/env node

import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { buildVerifiedPostgresClientConfig } from "./lib/production-database-tls.mjs"
import { spawnSync } from "node:child_process"

const options = parseArgs(process.argv.slice(2))
const environment = required(options, "environment")
const apiOrigin = normalizeOrigin(required(options, "api-origin"))
const emailDomain = options["email-domain"] || "gmail.com"
const emailLocal = options["email-local"] || "kerss79"
let inviteCodes = String(process.env.CLAWCHAT_BETA_INVITE_CODES || "")
  .split(/[\s,]+/)
  .map((value) => value.trim())
  .filter(Boolean)

if (!inviteCodes.length) {
  throw new Error("No CLAWCHAT_BETA_INVITE_CODES are available in the selected Railway environment.")
}

const suffix = `${environment}-${Date.now()}-${randomBytes(3).toString("hex")}`
const email = `${emailLocal}+relay-smoke-${suffix}@${emailDomain}`
const password = `Relay-${randomBytes(24).toString("base64url")}!9a`
const databaseUrl = process.env.DATABASE_URL || ""
const inviteHashSecret = process.env.CLAWCHAT_BETA_INVITE_HASH_SECRET || ""

if (databaseUrl && inviteHashSecret) {
  const syntheticInvite = `relay-smoke-${randomBytes(24).toString("base64url")}`
  const inviteHash = createHmac("sha256", inviteHashSecret)
    .update(syntheticInvite)
    .digest("hex")
  const requireFromBackend = createRequire(new URL("../backend/package.json", import.meta.url))
  const { Client } = requireFromBackend("pg")
  const client = new Client(buildVerifiedPostgresClientConfig(process.env))
  await client.connect()
  try {
    await client.query(
      `INSERT INTO beta_invites
        ("codeHash", email, "maxUses", "useCount", "expiresAt", "revokedAt",
         "lastUsedAt", "lastUsedByUserId", "lastUsedEmail")
       VALUES ($1, $2, 1, 0, NOW() + INTERVAL '20 minutes', NULL, NULL, NULL, NULL)`,
      [inviteHash, email],
    )
  } finally {
    await client.end()
  }
  inviteCodes = [syntheticInvite, ...inviteCodes]
}

let registration = null
for (const inviteCode of inviteCodes) {
  const attempt = await jsonRequest(new URL("/api/v1/auth/register", apiOrigin), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      name: `Relay ${environment} smoke`,
      password,
      inviteCode,
      deviceName: "Railway release smoke",
      platform: "macOS",
    }),
  })
  if (attempt.ok) {
    registration = attempt
    break
  }
  if (![400, 409].includes(attempt.status)) {
    throw new Error(`Smoke registration failed with HTTP ${attempt.status}.`)
  }
}

if (!registration) {
  throw new Error("Every configured beta invite code was unavailable.")
}

const accessToken = registration.body?.data?.accessToken ?? registration.body?.accessToken
if (typeof accessToken !== "string" || !accessToken) {
  throw new Error("Smoke registration did not return an access token.")
}

const workspace = await jsonRequest(new URL("/api/v1/workspaces", apiOrigin), {
  method: "POST",
  headers: {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ name: `Relay ${environment} smoke`, type: "personal" }),
})
if (!workspace.ok) {
  throw new Error(`Smoke workspace creation failed with HTTP ${workspace.status}.`)
}

const workspaceId = workspace.body?.data?.id ?? workspace.body?.id
if (typeof workspaceId !== "string" || !workspaceId) {
  throw new Error("Smoke workspace creation did not return a workspace id.")
}

if (databaseUrl) {
  const requireFromBackend = createRequire(new URL("../backend/package.json", import.meta.url))
  const { Client } = requireFromBackend("pg")
  const client = new Client(buildVerifiedPostgresClientConfig(process.env))
  await client.connect()
  try {
    await client.query(
      `INSERT INTO relay_commercial_subscriptions
        (id, "workspaceId", plan, status, provider, "providerCustomerId",
         "providerSubscriptionId", limits, features, "currentPeriodEndsAt",
         "cancelAtPeriodEnd", "createdAt", "updatedAt")
       VALUES ($1, $2, 'relay_cloud_monthly', 'active', 'stripe',
         $3, $4, '{}'::jsonb, '{}'::jsonb, NOW() + INTERVAL '10 years', false,
         NOW(), NOW())
       ON CONFLICT ("workspaceId") DO UPDATE SET
         status = 'active', provider = 'stripe',
         "currentPeriodEndsAt" = NOW() + INTERVAL '10 years',
         "readOnlyAt" = NULL, "cancelledAt" = NULL,
         "cancelAtPeriodEnd" = false, "updatedAt" = NOW()`,
      [
        randomUUID(),
        workspaceId,
        `synthetic-monitor-${environment}-customer`,
        `synthetic-monitor-${environment}-subscription`,
      ],
    )
  } finally {
    await client.end()
  }
}

for (const [name, value] of [
  ["CLAWCHAT_BETA_SMOKE_EMAIL", email],
  ["CLAWCHAT_BETA_SMOKE_PASSWORD", password],
  ["CLAWCHAT_BETA_SMOKE_WORKSPACE_ID", workspaceId],
]) {
  const result = spawnSync(
    "railway",
    [
      "variable",
      "set",
      "--environment",
      environment,
      "--service",
      options.service || "clawchat",
      "--skip-deploys",
      "--stdin",
      name,
    ],
    { input: value, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  )
  if (result.status !== 0) {
    throw new Error(`Could not persist ${name} in Railway.`)
  }
}

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    environment,
    apiOrigin,
    workspaceCreated: true,
    activeSyntheticEntitlement: Boolean(databaseUrl),
    railwaySmokeVariablesPersisted: true,
  }, null, 2)}\n`,
)

function parseArgs(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith("--") || !value) throw new Error(`Invalid argument: ${key || "<missing>"}`)
    parsed[key.slice(2)] = value
  }
  return parsed
}

function required(values, name) {
  const value = values[name]
  if (!value) throw new Error(`--${name} is required.`)
  return value
}

function normalizeOrigin(value) {
  const url = new URL(value)
  if (url.protocol !== "https:") throw new Error("--api-origin must use HTTPS.")
  return url.origin
}

async function jsonRequest(url, init) {
  const response = await fetch(url, { ...init, redirect: "manual" })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // The status code is sufficient for the deliberately secret-safe error.
  }
  return { ok: response.ok, status: response.status, body }
}
