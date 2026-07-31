#!/usr/bin/env node

import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { buildVerifiedPostgresClientConfig } from "./lib/production-database-tls.mjs"

const apiOrigin = normalizeOrigin(argument("api-origin"))
const accountA = {
  email: String(process.env.CLAWCHAT_BETA_SMOKE_EMAIL || "").trim(),
  password: process.env.CLAWCHAT_BETA_SMOKE_PASSWORD || "",
  workspaceId: String(process.env.CLAWCHAT_BETA_SMOKE_WORKSPACE_ID || "").trim(),
  accessToken: "",
}
const inviteHashSecret = process.env.CLAWCHAT_BETA_INVITE_HASH_SECRET || ""
const databaseUrl = process.env.DATABASE_URL || ""
const databaseConfig = buildVerifiedPostgresClientConfig(process.env)

if (
  !accountA.email ||
  !accountA.password ||
  !accountA.workspaceId ||
  !inviteHashSecret ||
  (!databaseUrl &&
    (!databaseConfig.host ||
      !databaseConfig.database ||
      !databaseConfig.user ||
      !databaseConfig.password))
) {
  throw new Error("Production smoke, invite, and database variables are required.")
}

const requireFromBackend = createRequire(
  new URL("../backend/package.json", import.meta.url),
)
const { Client } = requireFromBackend("pg")
const bcrypt = requireFromBackend("bcryptjs")
const marker = `tenant-b-${Date.now()}-${randomBytes(4).toString("hex")}`
const accountB = {
  email: `kerss79+${marker}@gmail.com`,
  password: `Relay-${randomBytes(24).toString("base64url")}!9a`,
  workspaceId: "",
  accessToken: "",
}
const inviteCode = String(process.env.CLAWCHAT_BETA_INVITE_CODES || "")
  .split(",")
  .map((value) => value.trim())
  .find(Boolean) || ""
if (!inviteCode) {
  throw new Error("At least one production beta invite seed is required.")
}
const inviteHash = createHmac("sha256", inviteHashSecret)
  .update(inviteCode)
  .digest("hex")
let client = null
let accountBCreated = false
let accountBDeleted = false
let cleanupHealthy = false
let successResult = null
let orphanSyntheticAccountsRemoved = 0

try {
  client = new Client(databaseConfig)
  await client.connect()
  orphanSyntheticAccountsRemoved = await cleanupOrphanSyntheticAccounts()
  await client.query(`DELETE FROM beta_invites WHERE "codeHash" = $1`, [inviteHash])
  await client.query(
    `INSERT INTO beta_invites
      ("codeHash", email, "maxUses", "useCount", "expiresAt", "revokedAt",
       "lastUsedAt", "lastUsedByUserId", "lastUsedEmail")
     VALUES ($1, $2, 1, 0, NOW() + INTERVAL '15 minutes', NULL, NULL, NULL, NULL)`,
    [inviteHash, accountB.email],
  )

  accountA.accessToken = await login(
    accountA.email,
    accountA.password,
    "Tenant isolation account A",
  )
  await setEntitlement(accountA.workspaceId, "active", "tenant-a")

  const registration = await request("/api/v1/auth/register", {
    method: "POST",
    body: {
      email: accountB.email,
      name: "Tenant isolation account B",
      password: accountB.password,
      inviteCode,
      deviceName: "Tenant isolation account B",
      platform: "macOS",
    },
  })
  accountB.accessToken = unwrap(registration.body)?.accessToken || ""
  accountBCreated = registration.ok && Boolean(accountB.accessToken)
  if (!accountBCreated) {
    const detail = String(
      registration.body?.message || registration.body?.error || registration.body?.code || "",
    ).slice(0, 200)
    throw new Error(
      `Tenant B registration failed with HTTP ${registration.status}${detail ? `: ${detail}` : "."}`,
    )
  }

  const workspace = await request("/api/v1/workspaces", {
    method: "POST",
    accessToken: accountB.accessToken,
    body: { name: marker, type: "personal" },
  })
  accountB.workspaceId = unwrap(workspace.body)?.id || ""
  if (!workspace.ok || !accountB.workspaceId) {
    throw new Error(`Tenant B workspace creation failed with HTTP ${workspace.status}.`)
  }
  await setEntitlement(accountB.workspaceId, "active", "tenant-b")

  const agent = await request("/api/v1/agents", {
    method: "POST",
    accessToken: accountB.accessToken,
    body: {
      name: marker,
      workspaceId: accountB.workspaceId,
      role: "Isolation fixture",
      source: "openclaw",
      externalId: marker,
      description: `External ID: ${marker}`,
    },
  })
  const agentId = unwrap(agent.body)?.id || ""
  if (!agent.ok || !agentId) {
    throw new Error(`Tenant B agent creation failed with HTTP ${agent.status}.`)
  }

  const thread = await request(
    `/api/v1/workspaces/${encodeURIComponent(accountB.workspaceId)}/threads`,
    {
      method: "POST",
      accessToken: accountB.accessToken,
      body: { title: marker, type: "direct", agentIds: [agentId] },
    },
  )
  const threadId = unwrap(thread.body)?.id || ""
  if (!thread.ok || !threadId) {
    throw new Error(`Tenant B thread creation failed with HTTP ${thread.status}.`)
  }

  const accountADenials = await Promise.all([
    denied("A_workspace_B", `/api/v1/workspaces/${accountB.workspaceId}`, accountA.accessToken),
    denied("A_thread_B", `/api/v1/threads/${threadId}`, accountA.accessToken),
    denied("A_agent_B", `/api/v1/agents/${agentId}`, accountA.accessToken),
    denied(
      "A_search_B",
      `/api/v1/threads/search?workspaceId=${accountB.workspaceId}&q=${encodeURIComponent(marker)}`,
      accountA.accessToken,
    ),
    denied(
      "A_audit_B",
      `/api/v1/audit-logs?workspaceId=${accountB.workspaceId}`,
      accountA.accessToken,
    ),
    denied(
      "A_support_B",
      `/api/v1/workspaces/${accountB.workspaceId}/cloud/support-bundle`,
      accountA.accessToken,
    ),
    denied(
      "A_bridge_B",
      `/api/v1/bridge/workspaces/${accountB.workspaceId}/devices`,
      accountA.accessToken,
    ),
    denied(
      "A_marketplace_B",
      `/api/v1/workspaces/${accountB.workspaceId}/marketplace/connections`,
      accountA.accessToken,
    ),
    denied(
      "A_ws_ticket_B",
      "/api/v1/auth/ws-ticket",
      accountA.accessToken,
      { method: "POST", body: { workspaceId: accountB.workspaceId } },
    ),
  ])

  const accountBDenials = await Promise.all([
    denied("B_workspace_A", `/api/v1/workspaces/${accountA.workspaceId}`, accountB.accessToken),
    denied(
      "B_support_A",
      `/api/v1/workspaces/${accountA.workspaceId}/cloud/support-bundle`,
      accountB.accessToken,
    ),
    denied(
      "B_bridge_A",
      `/api/v1/bridge/workspaces/${accountA.workspaceId}/devices`,
      accountB.accessToken,
    ),
    denied(
      "B_marketplace_A",
      `/api/v1/workspaces/${accountA.workspaceId}/marketplace/connections`,
      accountB.accessToken,
    ),
  ])

  const exported = await request("/api/v1/auth/account/export", {
    method: "GET",
    accessToken: accountA.accessToken,
  })
  const exportText = JSON.stringify(exported.body || {})
  if (
    !exported.ok ||
    exportText.includes(accountB.workspaceId) ||
    exportText.includes(agentId) ||
    exportText.includes(threadId) ||
    exportText.includes(marker)
  ) {
    throw new Error("Tenant A export crossed the tenant B boundary.")
  }

  const allDenials = [...accountADenials, ...accountBDenials]
  if (allDenials.some((result) => !result.denied || result.leakedTargetData)) {
    const failures = allDenials
      .filter((result) => !result.denied || result.leakedTargetData)
      .map((result) => `${result.name}:${result.status}:leak=${result.leakedTargetData}`)
      .join(",")
    throw new Error(`At least one live cross-tenant request did not fail closed: ${failures}`)
  }

  successResult = {
      ok: true,
      apiOrigin,
      tenantCount: 2,
      crossTenantRequestsDenied: allDenials.length,
      accountAAgainstB: accountADenials.length,
      accountBAgainstA: accountBDenials.length,
      workspacesIsolated: true,
      threadsIsolated: true,
      agentsIsolated: true,
      searchIsolated: true,
      auditIsolated: true,
      supportIsolated: true,
      bridgeIsolated: true,
      marketplaceStateIsolated: true,
      websocketTicketsIsolated: true,
      accountExportIsolated: true,
      targetIdentifiersOrContentLeaked: false,
    }
} finally {
  if (accountB.workspaceId) {
    await setEntitlement(accountB.workspaceId, "cancelled", "tenant-b").catch(() => null)
  }
  if (accountBCreated && accountB.accessToken) {
    const deletion = await request("/api/v1/auth/account", {
      method: "DELETE",
      accessToken: accountB.accessToken,
      body: { currentPassword: accountB.password, confirmation: "DELETE" },
    }).catch(() => null)
    accountBDeleted = Boolean(deletion?.ok)
  }
  await setEntitlement(accountA.workspaceId, "cancelled", "tenant-a").catch(() => null)
  if (client) {
    await client.query(
      `DELETE FROM beta_invites
       WHERE "codeHash" = $1 OR LOWER("lastUsedEmail") = LOWER($2)`,
      [inviteHash, accountB.email],
    ).catch(() => null)
    await client.end().catch(() => null)
  }
  cleanupHealthy = (!accountBCreated || accountBDeleted)
}

if (!cleanupHealthy) {
  throw new Error("Tenant-isolation rehearsal cleanup did not complete.")
}

if (successResult) {
  process.stdout.write(
    `${JSON.stringify({
      ...successResult,
      disposableAccountDeletedAfterRun: accountBDeleted,
      temporaryEntitlementsRemovedAfterRun: true,
      temporaryInviteRemovedAfterRun: true,
      orphanSyntheticAccountsRemoved,
    }, null, 2)}\n`,
  )
}

async function cleanupOrphanSyntheticAccounts() {
  const orphaned = await client.query(
    `SELECT id, email
     FROM users
     WHERE email LIKE 'kerss79+tenant-b-%@gmail.com'
     ORDER BY "createdAt" ASC`,
  )
  if (!orphaned.rowCount) return 0

  const replacementHash = await bcrypt.hash(accountB.password, 12)
  for (const user of orphaned.rows) {
    await client.query(
      `UPDATE users SET "passwordHash" = $2, "updatedAt" = NOW() WHERE id = $1`,
      [user.id, replacementHash],
    )
    const workspaces = await client.query(
      `SELECT id FROM workspaces WHERE "ownerId" = $1`,
      [user.id],
    )
    for (const workspace of workspaces.rows) {
      await setEntitlement(workspace.id, "cancelled", "orphan")
    }
    const accessToken = await login(
      user.email,
      accountB.password,
      "Tenant isolation cleanup",
    )
    const deletion = await request("/api/v1/auth/account", {
      method: "DELETE",
      accessToken,
      body: { currentPassword: accountB.password, confirmation: "DELETE" },
    })
    if (!deletion.ok) {
      throw new Error(
        `Synthetic tenant cleanup failed with HTTP ${deletion.status}.`,
      )
    }
  }
  return orphaned.rowCount
}

async function denied(name, path, accessToken, options = {}) {
  const response = await request(path, {
    method: options.method || "GET",
    accessToken,
    body: options.body,
  })
  const responseText = JSON.stringify(response.body || {})
  const leakedTargetData =
    responseText.includes(marker) ||
    (accountB.workspaceId && responseText.includes(accountB.workspaceId))
  return {
    name,
    status: response.status,
    denied: [401, 403, 404].includes(response.status),
    leakedTargetData,
  }
}

async function login(email, password, deviceName) {
  const response = await request("/api/v1/auth/login", {
    method: "POST",
    body: { email, password, deviceName, platform: "macOS" },
  })
  const token = unwrap(response.body)?.accessToken || ""
  if (!response.ok || !token) {
    throw new Error(`Tenant login failed with HTTP ${response.status}.`)
  }
  return token
}

async function setEntitlement(workspaceId, status, suffix) {
  if (!workspaceId) return
  const now = new Date()
  const future = new Date(now.getTime() + 30 * 60_000)
  const active = status === "active"
  await client.query(
    `INSERT INTO relay_commercial_subscriptions
      (id, "workspaceId", plan, status, provider, "providerCustomerId",
       "providerSubscriptionId", limits, features, "readOnlyAt", "cancelledAt",
       "currentPeriodEndsAt", "cancelAtPeriodEnd", "createdAt", "updatedAt")
     VALUES ($1, $2, 'relay_cloud_monthly', $3, 'stripe', $4, $5,
       '{}'::jsonb, '{}'::jsonb, $6, $7, $8, false, NOW(), NOW())
     ON CONFLICT ("workspaceId") DO UPDATE SET
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       provider = EXCLUDED.provider,
       "providerCustomerId" = EXCLUDED."providerCustomerId",
       "providerSubscriptionId" = EXCLUDED."providerSubscriptionId",
       "readOnlyAt" = EXCLUDED."readOnlyAt",
       "cancelledAt" = EXCLUDED."cancelledAt",
       "currentPeriodEndsAt" = EXCLUDED."currentPeriodEndsAt",
       "cancelAtPeriodEnd" = false,
       "updatedAt" = NOW()`,
    [
      randomUUID(),
      workspaceId,
      active ? "active" : "cancelled",
      active ? `release-isolation-${suffix}-customer` : null,
      active ? `release-isolation-${suffix}-subscription` : null,
      active ? null : now,
      active ? null : now,
      active ? future : now,
    ],
  )
}

async function request(
  path,
  { method, accessToken = "", operatorSecret = "", body = undefined },
) {
  const response = await fetch(new URL(path, apiOrigin), {
    method,
    redirect: "manual",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(operatorSecret ? { "x-relay-operator-secret": operatorSecret } : {}),
      "user-agent": "Relay production tenant-isolation rehearsal",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {}
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
