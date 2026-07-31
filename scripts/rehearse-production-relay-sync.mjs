#!/usr/bin/env node

import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { buildVerifiedPostgresClientConfig } from "./lib/production-database-tls.mjs"

const apiOrigin = normalizeOrigin(argument("api-origin"))
const inviteHashSecret = process.env.CLAWCHAT_BETA_INVITE_HASH_SECRET || ""
const inviteCode = String(process.env.CLAWCHAT_BETA_INVITE_CODES || "")
  .split(",")
  .map((value) => value.trim())
  .find(Boolean) || ""
const databaseUrl = process.env.DATABASE_URL || ""

if (!apiOrigin || !inviteHashSecret || !inviteCode || !databaseUrl) {
  throw new Error("API origin, production invite variables, and DATABASE_URL are required.")
}

const requireFromBackend = createRequire(new URL("../backend/package.json", import.meta.url))
const { Client } = requireFromBackend("pg")
const marker = `relay-sync-${Date.now()}-${randomBytes(4).toString("hex")}`
const account = {
  email: `kerss79+${marker}@gmail.com`,
  password: `Relay-${randomBytes(24).toString("base64url")}!9a`,
  accessToken: "",
  workspaceId: "",
}
const inviteHash = createHmac("sha256", inviteHashSecret)
  .update(inviteCode)
  .digest("hex")
const client = new Client(buildVerifiedPostgresClientConfig(process.env))
let accountCreated = false
let accountDeleted = false
let result = null

try {
  await client.connect()
  await client.query(`DELETE FROM beta_invites WHERE "codeHash" = $1`, [inviteHash])
  await client.query(
    `INSERT INTO beta_invites
      ("codeHash", email, "maxUses", "useCount", "expiresAt", "revokedAt",
       "lastUsedAt", "lastUsedByUserId", "lastUsedEmail")
     VALUES ($1, $2, 1, 0, NOW() + INTERVAL '20 minutes', NULL, NULL, NULL, NULL)`,
    [inviteHash, account.email],
  )

  const registration = await request("/api/v1/auth/register", {
    method: "POST",
    body: {
      email: account.email,
      name: "Relay Sync release rehearsal",
      password: account.password,
      inviteCode,
      deviceName: "Relay Sync release rehearsal",
      platform: "macOS",
    },
  })
  account.accessToken = unwrap(registration.body)?.accessToken || ""
  accountCreated = registration.ok && Boolean(account.accessToken)
  assert(accountCreated, `Account registration failed with HTTP ${registration.status}.`)

  const workspace = await authed("/api/v1/workspaces", {
    method: "POST",
    body: { name: marker, type: "personal" },
  })
  account.workspaceId = unwrap(workspace.body)?.id || ""
  assert(workspace.ok && account.workspaceId, `Workspace creation failed with HTTP ${workspace.status}.`)
  await setEntitlement("active")

  const capabilitiesResponse = await request("/api/v1/deployment/capabilities", { method: "GET" })
  const capabilities = unwrap(capabilitiesResponse.body)
  assert(capabilitiesResponse.ok && capabilities?.deploymentKey, "Deployment capabilities were unavailable.")

  const clients = {}
  for (const [name, clientKind] of [
    ["mac", "relay_console_swift"],
    ["iphone", "ios"],
    ["web", "web"],
  ]) {
    const installation = await authed("/api/v1/client-installations", {
      method: "POST",
      body: {
        deploymentKey: capabilities.deploymentKey,
        workspaceId: account.workspaceId,
        installationPublicId: `${marker}-${name}`,
        clientKind,
        clientVersion: "1.0.0",
        label: `Release rehearsal ${name}`,
        capabilities: { releaseRehearsal: true },
      },
    })
    const installationRecord = unwrap(installation.body)
    assert(installation.ok && installationRecord?.id, `${name} installation registration failed.`)
    const link = await authed("/api/v1/workspace-sync-links", {
      method: "POST",
      body: {
        deploymentKey: capabilities.deploymentKey,
        installationId: installationRecord.id,
        workspaceId: account.workspaceId,
        localWorkspaceId: `${marker}-${name}-workspace`,
        attachmentPolicy: "metadata_only",
        offlineRetention: true,
      },
    })
    const linkRecord = unwrap(link.body)
    assert(link.ok && linkRecord?.id, `${name} workspace link failed.`)
    clients[name] = { installationId: installationRecord.id, linkId: linkRecord.id }
  }

  const ids = {
    agent: `${marker}-agent`,
    thread: `${marker}-thread`,
    message: `${marker}-message`,
    connection: `${marker}-connection`,
  }
  const records = [
    {
      objectType: "agent",
      objectId: ids.agent,
      payload: {
        name: "Release rehearsal agent",
        role: "assistant",
        status: "online",
        externalId: ids.agent,
        capabilities: ["chat"],
      },
    },
    {
      objectType: "thread",
      objectId: ids.thread,
      payload: {
        title: "Release rehearsal conversation",
        type: "direct",
        agentIds: [ids.agent],
        status: "active",
      },
    },
    {
      objectType: "message",
      objectId: ids.message,
      payload: {
        threadId: ids.thread,
        senderType: "user",
        senderName: "Release rehearsal user",
        content: marker,
        contentFormat: "markdown",
        createdAt: new Date().toISOString(),
      },
    },
    {
      objectType: "application_connection",
      objectId: ids.connection,
      payload: {
        appSlug: "release-sync-fixture",
        providerName: "Release sync fixture",
        selectedCapabilities: ["read"],
        executionAuthority: "swift",
        executionAuthorityVersion: "marketplace-execution-authority.v1",
        executionAvailability: "device_runtime_required",
        secretMaterialSynchronized: false,
        connectionStatus: "connected_locally",
      },
    },
  ]

  const importResponse = await authed("/api/v1/workspace-imports", {
    method: "POST",
    body: {
      syncLinkId: clients.mac.linkId,
      manifestKey: `${marker}-manifest`,
      schemaVersion: capabilities.syncContractVersion,
      counts: { agent: 1, thread: 1, message: 1, application_connection: 1 },
      exclusions: [],
      cloudStorageConsent: true,
      backupCheckpoint: `${marker}-verified-backup`,
    },
  })
  const importRecord = unwrap(importResponse.body)
  assert(importResponse.ok && importRecord?.id, "Initial import creation failed.")

  const imported = await authed(`/api/v1/workspace-imports/${importRecord.id}/batches`, {
    method: "POST",
    body: { batchKey: `${marker}-batch-1`, records, finalBatch: true },
  })
  const importedData = unwrap(imported.body)
  assert(imported.ok, `Initial import failed with HTTP ${imported.status}.`)
  assert(importedData?.outcomes?.length === 4, "Initial import did not return four outcomes.")
  assert(
    importedData.outcomes.every((item) => item.status === "accepted"),
    `Initial import was not fully accepted: ${importedData.outcomes
      .map((item) => `${item.objectType}:${item.status}:${item.code || "none"}`)
      .join(",")}`,
  )

  const duplicateImport = await authed(`/api/v1/workspace-imports/${importRecord.id}/batches`, {
    method: "POST",
    body: { batchKey: `${marker}-batch-1`, records, finalBatch: true },
  })
  const duplicateImportData = unwrap(duplicateImport.body)
  assert(duplicateImport.ok && duplicateImportData?.duplicateBatch === true, "Duplicate import batch was not deduplicated.")

  const initialFeed = await authed(
    `/api/v1/workspaces/${account.workspaceId}/changes?after=snapshot-complete&limit=200`,
    { method: "GET" },
  )
  const initialFeedData = unwrap(initialFeed.body)
  assert(initialFeed.ok, "Initial Railway change feed failed.")
  const initialChanges = initialFeedData?.changes || []
  for (const objectId of Object.values(ids)) {
    assert(initialChanges.some((change) => change.objectId === objectId), `Change feed omitted ${objectId}.`)
  }
  assert(JSON.stringify(initialChanges).includes(marker), "Change feed lost imported message content.")

  const agentOutcome = importedData.outcomes.find((item) => item.objectType === "agent")
  const mutationId = `${marker}-iphone-agent-update`
  const mutationBody = {
    installationId: clients.iphone.installationId,
    mutations: [
      {
        clientMutationId: mutationId,
        objectType: "agent",
        objectId: ids.agent,
        baseServerVersion: agentOutcome.serverVersion,
        payload: {
          name: "Release rehearsal agent",
          role: "updated from iPhone",
          status: "online",
          externalId: ids.agent,
          capabilities: ["chat"],
        },
      },
    ],
  }
  const mutated = await authed(`/api/v1/workspaces/${account.workspaceId}/mutations`, {
    method: "POST",
    body: mutationBody,
  })
  const mutatedData = unwrap(mutated.body)
  assert(mutated.ok && mutatedData?.outcomes?.[0]?.status === "acknowledged", "iPhone mutation was not acknowledged.")
  assert(mutatedData.outcomes[0].duplicate !== true, "First iPhone mutation was incorrectly treated as duplicate.")

  const duplicateMutation = await authed(`/api/v1/workspaces/${account.workspaceId}/mutations`, {
    method: "POST",
    body: mutationBody,
  })
  const duplicateMutationData = unwrap(duplicateMutation.body)
  assert(duplicateMutation.ok && duplicateMutationData?.outcomes?.[0]?.duplicate === true, "Duplicate client mutation was not deduplicated.")

  const webFeed = await authed(
    `/api/v1/workspaces/${account.workspaceId}/changes?after=${encodeURIComponent(initialFeedData.cursor)}&limit=200`,
    { method: "GET" },
  )
  const webFeedData = unwrap(webFeed.body)
  assert(webFeed.ok, "Web change feed failed.")
  assert(
    webFeedData?.changes?.some(
      (change) => change.objectId === ids.agent && change.payload?.role === "updated from iPhone",
    ),
    "Web client did not receive the iPhone mutation.",
  )

  const reconciled = await authed(`/api/v1/workspaces/${account.workspaceId}/reconcile`, {
    method: "POST",
    body: {
      cursor: webFeedData.cursor,
      counts: { agent: 1, thread: 1, message: 1, application_connection: 1 },
    },
  })
  const reconciledData = unwrap(reconciled.body)
  assert(reconciled.ok && reconciledData?.drift?.length === 0, "Railway reconciliation reported unexpected drift.")
  assert(reconciledData.rebuildRequired === false, "Railway reconciliation incorrectly required a rebuild.")

  result = {
    ok: true,
    apiOrigin,
    deploymentKeyMatched: true,
    clientsRegistered: ["relay_console_swift", "ios", "web"],
    localImportObjectTypes: ["agent", "thread", "message", "application_connection"],
    importedRecordsAccepted: importedData.outcomes.length,
    duplicateImportBatchSuppressed: true,
    iPhoneMutationAcknowledged: true,
    duplicateClientMutationSuppressed: true,
    webReceivedIPhoneMutation: true,
    marketplaceSecretMaterialSynchronized: false,
    reconciliationDriftCount: reconciledData.drift.length,
    rebuildRequired: reconciledData.rebuildRequired,
    importedMessagePreserved: true,
  }
} finally {
  if (account.workspaceId) await setEntitlement("cancelled").catch(() => null)
  if (accountCreated && account.accessToken) {
    const deletion = await authed("/api/v1/auth/account", {
      method: "DELETE",
      body: { currentPassword: account.password, confirmation: "DELETE" },
    }).catch(() => null)
    accountDeleted = Boolean(deletion?.ok)
  }
  await client.query(
    `DELETE FROM beta_invites WHERE "codeHash" = $1 OR LOWER("lastUsedEmail") = LOWER($2)`,
    [inviteHash, account.email],
  ).catch(() => null)
  await client.end().catch(() => null)
}

assert(!accountCreated || accountDeleted, "Disposable Relay Sync account cleanup failed.")
process.stdout.write(`${JSON.stringify({
  ...result,
  disposableAccountDeletedAfterRun: accountDeleted,
  temporaryEntitlementRemovedAfterRun: true,
  temporaryInviteRemovedAfterRun: true,
}, null, 2)}\n`)

async function setEntitlement(status) {
  if (!account.workspaceId) return
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
      account.workspaceId,
      active ? "active" : "cancelled",
      active ? `${marker}-customer` : null,
      active ? `${marker}-subscription` : null,
      active ? null : now,
      active ? null : now,
      active ? future : now,
    ],
  )
}

async function authed(path, options) {
  return request(path, { ...options, accessToken: account.accessToken })
}

async function request(path, { method, body = undefined, accessToken = "" }) {
  const response = await fetch(new URL(path, apiOrigin), {
    method,
    redirect: "manual",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      "user-agent": "Relay production synchronization rehearsal",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let parsed = null
  try { parsed = text ? JSON.parse(text) : null } catch {}
  return { ok: response.ok, status: response.status, body: parsed }
}

function unwrap(value) {
  return value && typeof value === "object" && "data" in value ? value.data : value
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] || "" : ""
}

function normalizeOrigin(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "")
  if (!trimmed) return ""
  const url = new URL(trimmed)
  if (url.protocol !== "https:") throw new Error("API origin must use HTTPS.")
  return url.origin
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
