#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { validateRailwayReleaseTopology } from "./railway-release-topology.mjs";
import { validateRailwayReleaseConfiguration } from "./railway-release-configuration.mjs";
import { validateReleaseRemoteEvidence } from "./release-remote-evidence.mjs";
import { validatePublicLaunchSurfaces } from "./public-launch-surface-gate.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const SCHEMA_PATH = resolve(
  DEFAULT_ROOT,
  "RelayConsoleSwift/Release/production-smoke-evidence.schema.json",
);
const HEALTH_SCRIPT = resolve(DEFAULT_ROOT, "scripts/check-beta-health.mjs");
export const CANONICAL_ORIGINS = Object.freeze({
  backend: "https://api.relayconsole.work",
  web: "https://relayconsole.work",
  websocket: "wss://api.relayconsole.work",
});
export const REQUIRED_SMOKE_CHECKS = Object.freeze([
  "backend_live",
  "backend_ready",
  "production_synthetic",
  "web_root",
  "web_api_rewrite_live",
  "web_api_rewrite_ready",
  "authenticated_websocket_smoke",
  "billing_observability",
  "operations_observability",
]);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const schemaValidator = ajv.compile(
  JSON.parse(readFileSync(SCHEMA_PATH, "utf8")),
);

function json(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJson(value[key])]),
    );
  }
  return value;
}

export function hashProductionSmokeInput(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableJson(value)))
    .digest("hex");
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--"))
      throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function statusCode(value) {
  return Number.isSafeInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}

function stringOrNull(value) {
  return typeof value === "string" && value ? value : null;
}

function checkIndex(rawSmoke) {
  const checks = Array.isArray(rawSmoke?.checks) ? rawSmoke.checks : [];
  return new Map(
    REQUIRED_SMOKE_CHECKS.map((name) => [
      name,
      checks.filter((check) => check?.name === name),
    ]),
  );
}

function one(index, name) {
  return index.get(name)?.length === 1 ? index.get(name)[0] : null;
}

function basicCheck(check) {
  return {
    passed: check?.ok === true,
    statusCode: statusCode(check?.statusCode),
    latencyMs: safeInteger(check?.latencyMs),
  };
}

function healthCheck(check) {
  return {
    ...basicCheck(check),
    serviceOk: check?.serviceOk === true,
    serviceStatus: stringOrNull(check?.status),
    service: stringOrNull(check?.service),
  };
}

function websocketCheck(check) {
  const steps = Array.isArray(check?.steps) ? check.steps : [];
  const step = (name) => steps.find((value) => value?.name === name);
  const workspaceSource = ["env", "discovered"].includes(check?.workspaceSource)
    ? check.workspaceSource
    : null;
  return {
    passed: check?.ok === true,
    latencyMs: safeInteger(check?.latencyMs),
    loginPassed: step("login")?.ok === true,
    workspaceLookupPassed:
      workspaceSource === "env" || step("workspace_list")?.ok === true,
    workspaceSource,
    ticketPassed: step("ws_ticket")?.ok === true,
    socketAuthenticated:
      step("websocket_connect")?.ok === true &&
      step("websocket_connect")?.event === "authenticated",
  };
}

function allowedAlerts(values, allowed) {
  return Array.isArray(values)
    ? [...new Set(values.filter((value) => allowed.has(value)))].sort()
    : [];
}

function billingCheck(check) {
  return {
    ...basicCheck(check),
    snapshotStatus: ["healthy", "attention", "invalid_contract"].includes(
      check?.snapshotStatus,
    )
      ? check.snapshotStatus
      : null,
    alerts: allowedAlerts(
      check?.alerts,
      new Set([
        "BILLING_EVENT_FAILURES",
        "BILLING_EVENT_STUCK",
        "PAYMENT_ATTENTION_REQUIRED",
        "ENTITLEMENT_MISMATCHES",
        "MIGRATION_GRACE_EXPIRING",
        "MIGRATION_GRACE_EXPIRED",
      ]),
    ),
    activePaidSubscriptions: safeInteger(check?.activePaidSubscriptions),
    failedBillingEvents: safeInteger(check?.failedBillingEvents),
    staleBillingEvents: safeInteger(check?.staleBillingEvents),
    entitlementMismatches: safeInteger(check?.entitlementMismatches),
    privacySafe: check?.privacySafe === true,
  };
}

function operationsCheck(check) {
  return {
    ...basicCheck(check),
    snapshotStatus: ["healthy", "attention", "invalid_contract"].includes(
      check?.snapshotStatus,
    )
      ? check.snapshotStatus
      : null,
    alerts: allowedAlerts(
      check?.alerts,
      new Set([
        "BRIDGE_EVENT_FAILURES",
        "BRIDGE_EVENTS_STUCK",
        "RUNTIME_DISPATCHES_STUCK",
        "OAUTH_REFRESH_FAILURES",
      ]),
    ),
    activeBridgeDevices: safeInteger(check?.activeBridgeDevices),
    recentBridgeDevices: safeInteger(check?.recentBridgeDevices),
    failedBridgeEvents: safeInteger(check?.failedBridgeEvents),
    staleBridgeEvents: safeInteger(check?.staleBridgeEvents),
    staleRuntimeDispatches: safeInteger(check?.staleRuntimeDispatches),
    oauthRefreshFailures: safeInteger(check?.oauthRefreshFailures),
    privacySafe: check?.privacySafe === true,
  };
}

function prerequisiteErrors(
  { topology, configuration, remoteEvidence, publicSurfaces },
  referenceTime = null,
) {
  const errors = [];
  const sourceCommit = remoteEvidence?.sourceCommit ?? null;
  const sourceBranch = remoteEvidence?.sourceBranch ?? null;
  const topologyResult = validateRailwayReleaseTopology(topology, {
    releaseBranch: sourceBranch,
    releaseCommit: sourceCommit,
  });
  errors.push(
    ...topologyResult.errors.map((error) => `Railway topology: ${error}`),
  );
  const configurationResult = validateRailwayReleaseConfiguration(
    configuration,
    {
      topology,
      releaseCommit: sourceCommit,
    },
  );
  errors.push(
    ...configurationResult.errors.map(
      (error) => `Railway configuration: ${error}`,
    ),
  );
  const remoteResult = validateReleaseRemoteEvidence(remoteEvidence, {
    sourceCommit,
    sourceBranch,
  });
  errors.push(
    ...remoteResult.errors.map((error) => `Remote evidence: ${error}`),
  );
  const publicResult = validatePublicLaunchSurfaces(publicSurfaces, {
    remoteEvidence,
  });
  errors.push(
    ...publicResult.errors.map((error) => `Public surfaces: ${error}`),
  );
  const reference = Date.parse(referenceTime ?? "");
  if (!Number.isFinite(reference)) {
    errors.push("Production smoke reference time is invalid.");
  } else {
    for (const [label, capturedAt] of [
      ["Railway topology", topology?.capturedAt],
      ["Railway configuration", configuration?.capturedAt],
      ["Remote evidence", remoteEvidence?.capturedAt],
      ["Public surfaces", publicSurfaces?.capturedAt],
    ]) {
      const captured = Date.parse(capturedAt ?? "");
      const age = reference - captured;
      if (!Number.isFinite(age) || age < -300_000 || age > 86_400_000) {
        errors.push(
          `${label} must be captured within 24 hours before the production smoke.`,
        );
      }
    }
  }
  return errors;
}

function releaseBinding({
  topology,
  configuration,
  remoteEvidence,
  publicSurfaces,
}) {
  return {
    repository: remoteEvidence.repository,
    sourceCommit: remoteEvidence.sourceCommit,
    sourceBranch: remoteEvidence.sourceBranch,
    railwayProjectId: topology.project.id,
    railwayEnvironmentId: topology.production.id,
    railwayServiceId: topology.production.backend.serviceId,
    railwayDeploymentId: topology.production.backend.deployment.id,
    vercelGithubDeploymentId: remoteEvidence.vercel.githubDeploymentId,
    vercelDeploymentId: publicSurfaces.releaseIdentity.document.deploymentId,
    vercelDeploymentURL: publicSurfaces.releaseIdentity.document.deploymentURL,
    railwayTopologySHA256: hashProductionSmokeInput(topology),
    railwayConfigurationSHA256: hashProductionSmokeInput(configuration),
    remoteEvidenceSHA256: hashProductionSmokeInput(remoteEvidence),
    publicSurfacesSHA256: hashProductionSmokeInput(publicSurfaces),
  };
}

export function buildProductionSmokeEvidence({
  rawSmoke,
  topology,
  configuration,
  remoteEvidence,
  publicSurfaces,
}) {
  const prerequisites = prerequisiteErrors(
    { topology, configuration, remoteEvidence, publicSurfaces },
    rawSmoke?.checkedAt,
  );
  if (prerequisites.length) {
    throw new Error(
      `Release evidence prerequisites are invalid: ${prerequisites.join(" ")}`,
    );
  }
  const index = checkIndex(rawSmoke);
  const rawChecks = Array.isArray(rawSmoke?.checks) ? rawSmoke.checks : [];
  const checkSetComplete =
    rawChecks.length === REQUIRED_SMOKE_CHECKS.length &&
    REQUIRED_SMOKE_CHECKS.every((name) => index.get(name)?.length === 1);
  const checks = {
    backendLive: healthCheck(one(index, "backend_live")),
    backendReady: healthCheck(one(index, "backend_ready")),
    productionSynthetic: healthCheck(one(index, "production_synthetic")),
    webRoot: basicCheck(one(index, "web_root")),
    webRewriteLive: healthCheck(one(index, "web_api_rewrite_live")),
    webRewriteReady: healthCheck(one(index, "web_api_rewrite_ready")),
    authenticatedWebsocket: websocketCheck(
      one(index, "authenticated_websocket_smoke"),
    ),
    billingObservability: billingCheck(one(index, "billing_observability")),
    operationsObservability: operationsCheck(
      one(index, "operations_observability"),
    ),
  };
  const healthChecks = [
    checks.backendLive,
    checks.backendReady,
    checks.productionSynthetic,
    checks.webRewriteLive,
    checks.webRewriteReady,
  ];
  const websocketComplete =
    checks.authenticatedWebsocket.loginPassed &&
    checks.authenticatedWebsocket.workspaceLookupPassed &&
    checks.authenticatedWebsocket.workspaceSource !== null &&
    checks.authenticatedWebsocket.ticketPassed &&
    checks.authenticatedWebsocket.socketAuthenticated;
  const observabilityHealthy = [
    checks.billingObservability,
    checks.operationsObservability,
  ].every(
    (check) =>
      check.privacySafe &&
      check.snapshotStatus === "healthy" &&
      check.alerts.length === 0,
  );
  const checksPassed =
    Object.values(checks).every((check) => check.passed === true) &&
    [
      checks.backendLive,
      checks.backendReady,
      checks.productionSynthetic,
      checks.webRoot,
      checks.webRewriteLive,
      checks.webRewriteReady,
      checks.billingObservability,
      checks.operationsObservability,
    ].every((check) => check.statusCode === 200) &&
    healthChecks.every((check) => check.serviceOk === true) &&
    websocketComplete &&
    observabilityHealthy;
  return {
    schemaVersion: "relay.production-smoke-evidence.v1",
    capturedAt: rawSmoke?.checkedAt,
    status:
      rawSmoke?.ok === true && checkSetComplete && checksPassed
        ? "ready"
        : "failed",
    checkSetComplete,
    releaseBinding: releaseBinding({
      topology,
      configuration,
      remoteEvidence,
      publicSurfaces,
    }),
    origins: { ...CANONICAL_ORIGINS },
    checks,
    privacy: {
      credentialsIncluded: false,
      cookiesIncluded: false,
      websocketTicketsIncluded: false,
      operatorSecretIncluded: false,
      workspaceIdentifiersIncluded: false,
      customerIdentifiersIncluded: false,
      responseBodiesIncluded: false,
    },
  };
}

function formatSchemaError(error) {
  const location = error.instancePath || "$";
  if (error.keyword === "additionalProperties") {
    return `${location}: unsupported field ${error.params.additionalProperty}`;
  }
  return `${location}: ${error.message ?? error.keyword}`;
}

export function validateProductionSmokeSchema(evidence) {
  if (schemaValidator(evidence)) return [];
  return (schemaValidator.errors ?? []).map(formatSchemaError);
}

export function validateProductionSmokeEvidence(
  evidence,
  { topology, configuration, remoteEvidence, publicSurfaces } = {},
) {
  const errors = validateProductionSmokeSchema(evidence).map(
    (error) => `Schema: ${error}`,
  );
  const prerequisites = prerequisiteErrors(
    { topology, configuration, remoteEvidence, publicSurfaces },
    evidence?.capturedAt,
  );
  errors.push(...prerequisites);
  if (prerequisites.length === 0) {
    const expected = releaseBinding({
      topology,
      configuration,
      remoteEvidence,
      publicSurfaces,
    });
    for (const [key, value] of Object.entries(expected)) {
      if (evidence?.releaseBinding?.[key] !== value) {
        errors.push(`Production smoke release binding ${key} differs.`);
      }
    }
  }
  if (evidence?.status !== "ready")
    errors.push("Production smoke status is not ready.");
  if (evidence?.checkSetComplete !== true)
    errors.push("Production smoke check set is incomplete.");
  for (const [name, check] of Object.entries(evidence?.checks ?? {})) {
    if (check?.passed !== true)
      errors.push(`Production smoke check ${name} failed.`);
  }
  for (const name of [
    "backendLive",
    "backendReady",
    "productionSynthetic",
    "webRoot",
    "webRewriteLive",
    "webRewriteReady",
    "billingObservability",
    "operationsObservability",
  ]) {
    if (evidence?.checks?.[name]?.statusCode !== 200) {
      errors.push(`Production smoke check ${name} did not return HTTP 200.`);
    }
  }
  for (const name of [
    "backendLive",
    "backendReady",
    "productionSynthetic",
    "webRewriteLive",
    "webRewriteReady",
  ]) {
    if (evidence?.checks?.[name]?.serviceOk !== true) {
      errors.push(`Production smoke check ${name} did not report service ok.`);
    }
  }
  if (evidence?.checks?.productionSynthetic?.serviceStatus !== "healthy") {
    errors.push("Production synthetic monitor did not report healthy status.");
  }
  const websocket = evidence?.checks?.authenticatedWebsocket;
  if (
    websocket?.loginPassed !== true ||
    websocket?.workspaceLookupPassed !== true ||
    !["env", "discovered"].includes(websocket?.workspaceSource) ||
    websocket?.ticketPassed !== true ||
    websocket?.socketAuthenticated !== true
  ) {
    errors.push("Authenticated websocket smoke did not complete every step.");
  }
  for (const name of ["billingObservability", "operationsObservability"]) {
    const check = evidence?.checks?.[name];
    if (check?.privacySafe !== true)
      errors.push(`${name} evidence is not privacy-safe.`);
    if ((check?.alerts?.length ?? 0) !== 0)
      errors.push(`${name} has active launch alerts.`);
    if (check?.snapshotStatus !== "healthy")
      errors.push(`${name} snapshot is not healthy.`);
  }
  return { valid: errors.length === 0, errors };
}

export function runStrictProductionSmoke(environment = process.env) {
  const result = spawnSync(process.execPath, [HEALTH_SCRIPT, "--strict"], {
    cwd: DEFAULT_ROOT,
    env: {
      ...environment,
      CLAWCHAT_BETA_HEALTH_STRICT: "true",
      CLAWCHAT_RAILWAY_ORIGIN: CANONICAL_ORIGINS.backend,
      CLAWCHAT_WEB_ORIGIN: CANONICAL_ORIGINS.web,
      NEXT_PUBLIC_RAILWAY_WS_BASE_URL: CANONICAL_ORIGINS.websocket,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 2 * 1024 * 1024,
  });
  let rawSmoke;
  try {
    rawSmoke = JSON.parse(result.stdout);
  } catch {
    throw new Error("Strict production smoke did not return valid JSON.");
  }
  return { rawSmoke, exitStatus: result.status };
}

function requiredArtifactOptions(options) {
  const names = [
    "railway-topology",
    "railway-configuration",
    "remote-evidence",
    "public-surfaces",
  ];
  for (const name of names) {
    if (typeof options[name] !== "string") {
      throw new Error(`--${name} <evidence.json> is required.`);
    }
  }
  return {
    topology: json(options["railway-topology"]),
    configuration: json(options["railway-configuration"]),
    remoteEvidence: json(options["remote-evidence"]),
    publicSurfaces: json(options["public-surfaces"]),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const artifacts = requiredArtifactOptions(options);
  let evidence;
  if (options.capture) {
    const prerequisites = prerequisiteErrors(
      artifacts,
      new Date().toISOString(),
    );
    if (prerequisites.length) {
      throw new Error(
        `Release evidence prerequisites are invalid: ${prerequisites.join(" ")}`,
      );
    }
    const result = runStrictProductionSmoke();
    evidence = buildProductionSmokeEvidence({
      rawSmoke: result.rawSmoke,
      ...artifacts,
    });
  } else if (typeof options.validate === "string") {
    evidence = json(options.validate);
  } else {
    throw new Error(
      "Use --capture or --validate <production-smoke-evidence.json>.",
    );
  }
  const validation = validateProductionSmokeEvidence(evidence, artifacts);
  if (options.capture) {
    const payload = `${JSON.stringify(evidence, null, 2)}\n`;
    if (typeof options.output === "string")
      writeFileSync(resolve(options.output), payload);
    else process.stdout.write(payload);
  }
  for (const error of validation.errors)
    process.stderr.write(`ERROR: ${error}\n`);
  if (!validation.valid) process.exitCode = 1;
  else
    process.stderr.write(
      "Production smoke evidence is valid for the exact release.\n",
    );
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `ERROR: Production smoke capture failed (${error instanceof Error ? error.message : "unknown error"}).\n`,
    );
    process.exitCode = 1;
  }
}
