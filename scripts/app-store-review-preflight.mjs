#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REVIEW_API_ORIGIN = "https://api.relayconsole.work/api/v1";

export class ReviewPreflightError extends Error {}

const asArray = (value) => Array.isArray(value) ? value : [];
const unwrap = (value) => value && typeof value === "object" && "data" in value ? value.data : value;
const fingerprint = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 12);

function requiredEnvironment(env) {
  const required = ["RELAY_REVIEW_EMAIL", "RELAY_REVIEW_PASSWORD"];
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new ReviewPreflightError(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function selectWorkspace(workspaces, requestedId) {
  if (requestedId) {
    const selected = workspaces.find((workspace) => workspace.id === requestedId);
    if (!selected) throw new ReviewPreflightError("RELAY_REVIEW_WORKSPACE_ID is not accessible to the review account.");
    return selected;
  }
  if (workspaces.length !== 1) {
    throw new ReviewPreflightError("Set RELAY_REVIEW_WORKSPACE_ID when the review account can access more or fewer than one workspace.");
  }
  return workspaces[0];
}

function extractPage(value) {
  const unwrapped = unwrap(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (unwrapped && Array.isArray(unwrapped.data)) return unwrapped.data;
  return [];
}

function assertReviewState({ me, entitlement, devices, agents }) {
  if (!me?.emailVerifiedAt) throw new ReviewPreflightError("The App Review account email is not verified.");
  if (entitlement?.mode !== "read_write") {
    throw new ReviewPreflightError(`The App Review workspace is not writable (status: ${entitlement?.status ?? "unknown"}).`);
  }
  const onlineCompatible = devices.filter((device) =>
    device.status === "active" &&
    device.health === "online" &&
    device.compatibility?.compatible === true,
  );
  if (onlineCompatible.length === 0) {
    throw new ReviewPreflightError("The App Review workspace has no active, online, compatible runtime bridge.");
  }
  if (agents.length === 0) throw new ReviewPreflightError("The App Review workspace has no agent.");
  return onlineCompatible;
}

function createClient(fetchImpl, accessToken) {
  return async (path, options = {}) => {
    const response = await fetchImpl(`${REVIEW_API_ORIGIN}/${path}`, {
      method: options.method ?? "GET",
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
    if (!response.ok) {
      throw new ReviewPreflightError(`${options.method ?? "GET"} ${path} returned HTTP ${response.status}.`);
    }
    return unwrap(await response.json());
  };
}

async function exerciseMessageRoundTrip({ client, env, log }) {
  const threadId = env.RELAY_REVIEW_THREAD_ID?.trim();
  if (!threadId) throw new ReviewPreflightError("--exercise-message requires RELAY_REVIEW_THREAD_ID.");

  const before = extractPage(await client(`threads/${encodeURIComponent(threadId)}/messages/latest?limit=30`));
  const beforeIds = new Set(before.map((message) => message.id));
  const marker = `Relay App Review acceptance ${randomUUID()}`;
  const sent = await client(`threads/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    body: {
      content: marker,
      type: "text",
      runtimeApprovalMode: "ask_for_approval",
      runtimeDispatchConfirmed: false,
    },
  });
  if (!sent?.id) throw new ReviewPreflightError("The review message was accepted without a message identifier.");
  log("Message accepted; waiting for a new agent response.");

  const configuredTimeout = Number(env.RELAY_REVIEW_REPLY_TIMEOUT_MS ?? 180_000);
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(Math.max(configuredTimeout, 10_000), 300_000)
    : 180_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const latest = extractPage(await client(`threads/${encodeURIComponent(threadId)}/messages/latest?limit=30`));
    const reply = latest.find((message) =>
      !beforeIds.has(message.id) && message.id !== sent.id && message.isFromUser !== true,
    );
    if (reply) return { sentMessage: fingerprint(sent.id), replyMessage: fingerprint(reply.id) };
    await new Promise((resolveWait) => setTimeout(resolveWait, 5_000));
  }
  throw new ReviewPreflightError("No new agent response arrived before the review timeout.");
}

export async function runReviewPreflight({
  env = process.env,
  args = process.argv.slice(2),
  fetchImpl = globalThis.fetch,
  log = (message) => process.stdout.write(`${message}\n`),
} = {}) {
  requiredEnvironment(env);
  if (typeof fetchImpl !== "function") throw new ReviewPreflightError("A Fetch API implementation is required.");
  const unsupported = args.filter((arg) => arg !== "--exercise-message");
  if (unsupported.length > 0) throw new ReviewPreflightError(`Unsupported arguments: ${unsupported.join(", ")}`);

  const unauthenticated = createClient(fetchImpl, null);
  const login = await unauthenticated("auth/login", {
    method: "POST",
    body: { email: env.RELAY_REVIEW_EMAIL.trim(), password: env.RELAY_REVIEW_PASSWORD },
  });
  if (!login?.accessToken) throw new ReviewPreflightError("Login succeeded without an access token.");
  const client = createClient(fetchImpl, login.accessToken);

  try {
    const me = await client("auth/me");
    const workspaces = extractPage(await client("workspaces"));
    const workspace = selectWorkspace(workspaces, env.RELAY_REVIEW_WORKSPACE_ID?.trim());
    const workspaceId = workspace.id;
    const [signedEntitlement, devicesValue, agentsValue, catalog] = await Promise.all([
      client(`workspaces/${encodeURIComponent(workspaceId)}/billing/status`),
      client(`bridge/workspaces/${encodeURIComponent(workspaceId)}/devices`),
      client(`workspaces/${encodeURIComponent(workspaceId)}/agents?page=1&pageSize=100`),
      client(`workspaces/${encodeURIComponent(workspaceId)}/marketplace/catalog`),
    ]);
    const entitlement = signedEntitlement?.payload;
    const devices = extractPage(devicesValue);
    const agents = extractPage(agentsValue);
    const onlineCompatible = assertReviewState({ me, entitlement, devices, agents });
    const releaseManifest = catalog?.releaseManifest ?? {};
    const catalogApps = asArray(catalog?.apps);
    const report = {
      schemaVersion: "relay.app-review-preflight.v1",
      apiOrigin: REVIEW_API_ORIGIN,
      account: { verified: true },
      workspace: { fingerprint: fingerprint(workspaceId) },
      entitlement: {
        status: entitlement.status,
        mode: entitlement.mode,
        provider: entitlement.provider ?? null,
      },
      runtime: {
        totalDevices: devices.length,
        onlineCompatibleDevices: onlineCompatible.length,
        agents: agents.length,
      },
      marketplace: {
        manifestVersion: releaseManifest.manifestVersion ?? null,
        freezeStatus: releaseManifest.freezeStatus ?? releaseManifest.freeze?.status ?? null,
        visibleApps: catalogApps.length,
        connectEligibleApps: catalogApps.filter((app) => app.release?.connectEligible === true).length,
      },
      messageRoundTrip: null,
    };
    if (args.includes("--exercise-message")) {
      report.messageRoundTrip = await exerciseMessageRoundTrip({ client, env, log });
    }
    log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    try {
      await client("auth/logout", { method: "POST" });
    } catch {
      log("Warning: the temporary review preflight session could not be revoked.");
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReviewPreflight().catch((error) => {
    const message = error instanceof ReviewPreflightError ? error.message : "Unexpected review preflight failure.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
