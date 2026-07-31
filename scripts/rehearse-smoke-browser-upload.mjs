#!/usr/bin/env node

import { createHash } from "node:crypto"
import { createRequire } from "node:module"

const apiOrigin = normalizeOrigin(argument("api-origin"))
const websocketOrigin = normalizeWebsocketOrigin(argument("websocket-origin"))
const email = String(process.env.CLAWCHAT_BETA_SMOKE_EMAIL || "").trim()
const password = process.env.CLAWCHAT_BETA_SMOKE_PASSWORD || ""
const workspaceId = String(process.env.CLAWCHAT_BETA_SMOKE_WORKSPACE_ID || "").trim()
const operatorSecret = process.env.RELAY_OPERATOR_API_SECRET || ""

if (!email || !password || !workspaceId || !operatorSecret) {
  throw new Error("Production smoke account and operator variables are required.")
}

const WebSocketClient = loadWebSocketClient()
let accessToken = ""
let deviceId = ""
let agentId = ""
let createdThreadId = ""
let socket = null
let successResult = null
let bridgeRevoked = false
let entitlementReturnedToReadOnly = false

try {
  await setSmokeEntitlement("active")

  const login = await request("/api/v1/auth/login", {
    method: "POST",
    body: {
      email,
      password,
      deviceName: "Release browser-upload rehearsal",
      platform: "macOS",
    },
  })
  if (!login.ok) throw new Error(`Smoke login failed with HTTP ${login.status}.`)
  accessToken = unwrap(login.body)?.accessToken
  if (!accessToken) throw new Error("Smoke login did not return an access token.")

  const externalAgentId = `release-smoke-${Date.now()}`
  const createdAgent = await request("/api/v1/agents", {
    method: "POST",
    accessToken,
    body: {
      name: "Release runtime rehearsal",
      workspaceId,
      role: "Release verification",
      source: "openclaw",
      externalId: externalAgentId,
      description: `External ID: ${externalAgentId}`,
    },
  })
  agentId = unwrap(createdAgent.body)?.id || ""
  if (!createdAgent.ok || !agentId) {
    throw new Error(`Synthetic agent creation failed with HTTP ${createdAgent.status}.`)
  }

  const capabilities = [
    "clawchat.bridge.rotating_credentials.v1",
    "clawchat.runtime.openclaw",
    "clawchat.attachments.local_media",
  ]
  const metadata = {
    deviceLabel: "Release browser-upload rehearsal",
    pluginVersion: "2026.7.12-rc.1",
    openCoreVersion: "v2026.6.11",
    runtimeType: "openclaw",
    hostType: "macos-launchd",
    apiContractVersion: "v2",
    websocketContractVersion: "bridge.v1",
    capabilities,
  }

  const incompatibleEnrollment = await request(
    `/api/v1/bridge/workspaces/${encodeURIComponent(workspaceId)}/enrollments`,
    {
      method: "POST",
      accessToken,
      body: { deviceLabel: "Release incompatible-runtime rehearsal", expiresInMinutes: 5 },
    },
  )
  const incompatibleCode = unwrap(incompatibleEnrollment.body)?.code
  if (!incompatibleEnrollment.ok || !incompatibleCode) {
    throw new Error(`Incompatible bridge enrollment failed with HTTP ${incompatibleEnrollment.status}.`)
  }
  const incompatible = await request("/api/v1/bridge/enroll", {
    method: "POST",
    body: { code: incompatibleCode, ...metadata, pluginVersion: "0.0.1" },
  })
  if (incompatible.status !== 426) {
    throw new Error(`Incompatible runtime returned HTTP ${incompatible.status}, expected 426.`)
  }

  const enrollment = await request(
    `/api/v1/bridge/workspaces/${encodeURIComponent(workspaceId)}/enrollments`,
    {
      method: "POST",
      accessToken,
      body: { deviceLabel: metadata.deviceLabel, expiresInMinutes: 5 },
    },
  )
  const enrollmentCode = unwrap(enrollment.body)?.code
  if (!enrollment.ok || !enrollmentCode) {
    throw new Error(`Bridge enrollment failed with HTTP ${enrollment.status}.`)
  }

  const redeemed = await request("/api/v1/bridge/enroll", {
    method: "POST",
    body: { code: enrollmentCode, ...metadata },
  })
  const redemption = unwrap(redeemed.body)
  deviceId = redemption?.device?.id || ""
  const devicePublicId = redemption?.credentials?.devicePublicId || ""
  const deviceToken = redemption?.credentials?.deviceToken || ""
  if (!redeemed.ok || !deviceId || !devicePublicId || !deviceToken) {
    throw new Error(`Bridge redemption failed with HTTP ${redeemed.status}.`)
  }
  await waitForIntegrationStatus("offline")

  const bridgeAuth = await request("/api/v1/bridge/device/auth", {
    method: "POST",
    body: { devicePublicId, deviceToken, ...metadata },
  })
  const authenticated = unwrap(bridgeAuth.body)
  const wsToken = authenticated?.tokens?.wsToken
  const rotatedDeviceToken = authenticated?.credentials?.deviceToken
  if (
    !bridgeAuth.ok ||
    !wsToken ||
    !rotatedDeviceToken ||
    authenticated?.tokens?.accessExpiresIn !== 900 ||
    authenticated?.tokens?.wsExpiresIn !== 300
  ) {
    throw new Error(`Bridge authentication failed with HTTP ${bridgeAuth.status}.`)
  }

  const bridge = await connectSyntheticAttachmentBridge({
    WebSocketClient,
    websocketOrigin,
    wsToken,
    workspaceId,
    deviceId,
    capabilities,
    externalAgentId,
  })
  socket = bridge.socket
  await waitForIntegrationStatus("connected")

  socket.close(4000, "release-runtime-offline-drill")
  await waitForIntegrationStatus("offline")
  const reconnectedBridge = await connectSyntheticAttachmentBridge({
    WebSocketClient,
    websocketOrigin,
    wsToken,
    workspaceId,
    deviceId,
    capabilities,
    externalAgentId,
  })
  socket = reconnectedBridge.socket
  await waitForIntegrationStatus("connected")

  const listed = await request(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/threads?page=1&pageSize=1`,
    { method: "GET", accessToken },
  )
  const listedPayload = unwrap(listed.body)
  const threads = Array.isArray(listedPayload?.data)
    ? listedPayload.data
    : Array.isArray(listedPayload)
      ? listedPayload
      : []
  let threadId = threads[0]?.id || ""
  if (!threadId) {
    const created = await request(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/threads`,
      {
        method: "POST",
        accessToken,
        body: { title: "Release attachment rehearsal", type: "direct" },
      },
    )
    threadId = unwrap(created.body)?.id || ""
    createdThreadId = threadId
    if (!created.ok || !threadId) {
      throw new Error(`Smoke thread creation failed with HTTP ${created.status}.`)
    }
  }

  const content = Buffer.from("Relay Console production attachment rehearsal\n")
  const init = await request("/api/v1/bridge/attachments/openclaw/init", {
    method: "POST",
    accessToken,
    body: {
      threadId,
      filename: "relay-release-smoke.txt",
      mimeType: "text/plain",
      sizeBytes: content.length,
      kind: "document",
      totalChunks: 1,
    },
  })
  const attachmentId = unwrap(init.body)?.attachmentId || ""
  if (!init.ok || !attachmentId) {
    throw new Error(`Attachment initialization failed with HTTP ${init.status}.`)
  }

  const chunk = await request("/api/v1/bridge/attachments/openclaw/chunk", {
    method: "POST",
    accessToken,
    body: {
      threadId,
      attachmentId,
      chunkIndex: 0,
      totalChunks: 1,
      offsetBytes: 0,
      chunkBase64: content.toString("base64"),
    },
  })
  if (!chunk.ok) throw new Error(`Attachment chunk failed with HTTP ${chunk.status}.`)

  const completed = await request(
    "/api/v1/bridge/attachments/openclaw/complete",
    {
      method: "POST",
      accessToken,
      body: { threadId, attachmentId },
    },
  )
  const attachment = unwrap(completed.body)
  if (
    !completed.ok ||
    attachment?.status !== "uploaded" ||
    attachment?.storage !== "openclaw_local" ||
    typeof attachment?.provenanceToken !== "string" ||
    !attachment.provenanceToken
  ) {
    throw new Error(`Attachment completion failed with HTTP ${completed.status}.`)
  }

  successResult = {
    ok: true,
    apiOrigin,
    syntheticBridgeAuthenticated: true,
    attachmentBridgeSubscribed: true,
    uploadInitialized: true,
    chunkTransferred: true,
    uploadCompleted: true,
    provenanceTokenIssued: true,
    incompatibleRuntimeRejected: true,
    offlineStateReported: true,
    runtimeReconnected: true,
  }
} finally {
  try {
    socket?.close(1000, "release-rehearsal-complete")
  } catch {}
  if (createdThreadId && accessToken) {
    await request(`/api/v1/threads/${encodeURIComponent(createdThreadId)}/archive`, {
      method: "POST",
      accessToken,
    }).catch(() => null)
  }
  if (deviceId && accessToken) {
    const revoked = await request(`/api/v1/bridge/devices/${encodeURIComponent(deviceId)}/revoke`, {
      method: "POST",
      accessToken,
    }).catch(() => null)
    bridgeRevoked = Boolean(revoked?.ok)
  }
  if (agentId && accessToken) {
    await request(`/api/v1/agents/${encodeURIComponent(agentId)}`, {
      method: "DELETE",
      accessToken,
    }).catch(() => null)
  }
  await setSmokeEntitlement("cancelled")
    .then(() => { entitlementReturnedToReadOnly = true })
    .catch(() => null)
}

if (successResult) {
  if (!bridgeRevoked || !entitlementReturnedToReadOnly) {
    throw new Error("Release rehearsal cleanup did not complete.")
  }
  process.stdout.write(
    `${JSON.stringify({
      ...successResult,
      temporaryBridgeRevokedAfterRun: bridgeRevoked,
      temporaryEntitlementReturnedToReadOnly: entitlementReturnedToReadOnly,
    }, null, 2)}\n`,
  )
}

async function connectSyntheticAttachmentBridge(input) {
  const sessions = new Map()
  const socket = new input.WebSocketClient(input.websocketOrigin, {
    headers: { Origin: "https://relayconsole.work" },
  })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Bridge websocket timed out.")), 15_000)
    const fail = (error) => {
      clearTimeout(timer)
      reject(error instanceof Error ? error : new Error("Bridge websocket failed."))
    }
    socket.on("open", () => {
      socket.send(JSON.stringify({
        type: "authenticate",
        token: input.wsToken,
        capabilities: input.capabilities,
      }))
    })
    socket.on("error", fail)
    socket.on("message", (raw) => {
      let message
      try {
        message = JSON.parse(String(raw))
      } catch {
        return
      }
      if (message.type === "auth_error") {
        fail(new Error("Bridge websocket authentication failed."))
        return
      }
      if (message.type === "authenticated") {
        socket.send(JSON.stringify({
          type: "register_bridge_agent",
          externalAgentId: input.externalAgentId,
          capabilities: input.capabilities,
        }))
        socket.send(JSON.stringify({
          type: "subscribe_bridge_control",
          workspaceId: input.workspaceId,
          capabilities: input.capabilities,
        }))
        return
      }
      if (message.type === "subscribed_bridge_control") {
        clearTimeout(timer)
        resolve()
        return
      }
      if (!String(message.type || "").startsWith("clawchat.attachment.upload.")) return
      const data = message.data || {}
      const requestId = data.requestId
      if (message.type.endsWith(".init")) {
        sessions.set(data.attachmentId, data)
        send(`${message.type}.result`, {
          requestId,
          attachmentId: data.attachmentId,
        })
      } else if (message.type.endsWith(".chunk")) {
        send(`${message.type}.result`, {
          requestId,
          attachmentId: data.attachmentId,
          chunkIndex: data.chunkIndex,
          receivedBytes: Buffer.byteLength(data.chunkBase64 || "", "base64"),
        })
      } else if (message.type.endsWith(".complete")) {
        const session = sessions.get(data.attachmentId) || {}
        send(`${message.type}.result`, {
          requestId,
          id: data.attachmentId,
          bridgeDeviceId: input.deviceId,
          filename: session.filename || "relay-release-smoke.txt",
          mimeType: session.mimeType || "text/plain",
          sizeBytes: session.sizeBytes || 0,
          sha256: createHash("sha256").update("Relay Console production attachment rehearsal\n").digest("hex"),
          kind: session.kind || "document",
          localMediaRef: `attachments/${data.attachmentId}/relay-release-smoke.txt`,
          createdAt: new Date().toISOString(),
        })
      }
    })
    function send(type, data) {
      socket.send(JSON.stringify({ type, data }))
    }
  })
  return { socket }
}

async function waitForIntegrationStatus(expectedStatus) {
  let lastStatus = "unavailable"
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await request(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/integrations/openclaw/status`,
      { method: "GET", accessToken },
    )
    lastStatus = unwrap(response.body)?.status || "unavailable"
    if (response.ok && lastStatus === expectedStatus) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(
    `Runtime integration reported ${lastStatus}, expected ${expectedStatus}.`,
  )
}

async function setSmokeEntitlement(status) {
  const now = new Date()
  const future = new Date(now.getTime() + 30 * 60_000)
  const response = await request("/api/v1/operator/subscriptions", {
    method: "POST",
    operatorSecret,
    body: status === "active"
      ? {
          workspaceId,
          plan: "relay_cloud_monthly",
          status: "active",
          provider: "stripe",
          providerCustomerId: "release-smoke-customer",
          providerSubscriptionId: "release-smoke-subscription",
          currentPeriodEndsAt: future.toISOString(),
          readOnlyAt: null,
          cancelledAt: null,
          cancelAtPeriodEnd: false,
        }
      : {
          workspaceId,
          plan: "relay_cloud_monthly",
          status: "cancelled",
          provider: "stripe",
          providerCustomerId: null,
          providerSubscriptionId: null,
          currentPeriodEndsAt: now.toISOString(),
          readOnlyAt: now.toISOString(),
          cancelledAt: now.toISOString(),
          cancelAtPeriodEnd: false,
        },
  })
  if (!response.ok) {
    throw new Error(`Smoke entitlement update failed with HTTP ${response.status}.`)
  }
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
      "user-agent": "Relay release browser-upload rehearsal",
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

function loadWebSocketClient() {
  const requireFromBackend = createRequire(
    new URL("../backend/package.json", import.meta.url),
  )
  const wsModule = requireFromBackend("ws")
  return wsModule.WebSocket || wsModule.default || wsModule
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

function normalizeWebsocketOrigin(value) {
  const url = new URL(value)
  if (url.protocol !== "wss:") throw new Error("The websocket origin must use WSS.")
  return url.origin
}
