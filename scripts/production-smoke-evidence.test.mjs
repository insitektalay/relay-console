import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildProductionSmokeEvidence,
  hashProductionSmokeInput,
  validateProductionSmokeEvidence,
  validateProductionSmokeSchema,
} from "./production-smoke-evidence.mjs";

function topology() {
  return {
    schemaVersion: "relay.railway-release-topology.v1",
    capturedAt: "2026-07-14T22:00:00.000Z",
    project: { id: "project-1", name: "relay-console", workspaceName: "Relay" },
    production: {
      id: "production-1",
      name: "production",
      services: ["Postgres", "Redis", "clawchat"],
      backend: {
        serviceId: "backend-1",
        serviceName: "clawchat",
        sourceRepository: "insitektalay/relay-console",
        sourceBranch: "release/relay-console-1.0.0-rc1",
        checkSuites: true,
        rootDirectory: "/backend",
        deployment: {
          id: "railway-1",
          status: "SUCCESS",
          createdAt: "2026-07-14T22:00:00.000Z",
          sourceCommit: "a".repeat(40),
          sourceBranch: "release/relay-console-1.0.0-rc1",
          sourceRepository: "insitektalay/relay-console",
        },
      },
    },
    staging: {
      id: "staging-1",
      name: "staging",
      services: ["Postgres", "Redis", "clawchat"],
      backend: {
        serviceId: "backend-2",
        serviceName: "clawchat",
        sourceRepository: "insitektalay/relay-console",
        sourceBranch: "codex/shared-marketplace-loop",
        checkSuites: true,
        rootDirectory: "/backend",
        deployment: {
          id: "railway-staging-1",
          status: "SUCCESS",
          createdAt: "2026-07-14T21:59:00.000Z",
          sourceCommit: "9".repeat(40),
          sourceBranch: "codex/shared-marketplace-loop",
          sourceRepository: "insitektalay/relay-console",
        },
      },
    },
  };
}

function configuration() {
  const value = topology();
  return {
    schemaVersion: "relay.railway-release-configuration.v1",
    capturedAt: "2026-07-14T22:03:00.000Z",
    status: "ready",
    identity: {
      projectId: "project-1",
      environmentId: "production-1",
      environmentName: "production",
      serviceId: "backend-1",
      serviceName: "clawchat",
      deploymentId: "railway-1",
      sourceCommit: "a".repeat(40),
      railwayTopologySHA256: hashProductionSmokeInput(value),
      liveTopologyMatched: true,
    },
    configuration: {
      productionSafetyValidatorPassed: true,
      nodeEnvironment: "production",
      databaseConfigured: true,
      redisConfigured: true,
      canonicalOrigins: {
        backend: true,
        websocket: true,
        web: true,
        corsIncludesWeb: true,
      },
      signup: { mode: "invite", configured: true },
      marketplace: { betaGateEnabled: true, cohortConfigured: true },
      billing: {
        provider: "stripe",
        enabled: true,
        configured: true,
        liveMode: true,
      },
      transactionalEmail: {
        provider: "resend",
        enabled: true,
        configured: true,
      },
      appleBilling: {
        enabled: true,
        configured: true,
        bundleIdentifierMatches: true,
      },
      destructiveSeedingDisabled: true,
    },
    privacy: { variableNamesIncluded: false, secretValuesIncluded: false },
  };
}

function remoteEvidence() {
  const ciRun = (runId, workflowName) => ({
    runId,
    workflowName,
    url: `https://github.com/insitektalay/relay-console/actions/runs/${runId}`,
    status: "completed",
    conclusion: "success",
    headSha: "a".repeat(40),
    headBranch: "release/relay-console-1.0.0-rc1",
    event: "push",
    createdAt: "2026-07-14T22:01:00.000Z",
    updatedAt: "2026-07-14T22:07:00.000Z",
  });
  return {
    schemaVersion: "relay.release-remote-evidence.v1",
    capturedAt: "2026-07-14T22:09:00.000Z",
    repository: "insitektalay/relay-console",
    sourceCommit: "a".repeat(40),
    sourceBranch: "release/relay-console-1.0.0-rc1",
    ciRuns: {
      backend: ciRun(101, "Backend Beta Readiness"),
      web: ciRun(102, "Web Beta Readiness"),
      apple: ciRun(103, "Apple Beta Readiness"),
    },
    vercel: {
      githubDeploymentId: 1234,
      sourceCommit: "a".repeat(40),
      sourceRef: "release/relay-console-1.0.0-rc1",
      environment: "Production",
      deploymentCreator: "vercel[bot]",
      state: "success",
      statusCreator: "vercel[bot]",
      deploymentURL: "https://relay-console-release.vercel.app",
      createdAt: "2026-07-14T22:02:00.000Z",
      statusUpdatedAt: "2026-07-14T22:08:00.000Z",
    },
  };
}

function publicSurfaces() {
  const routes = [
    "/",
    "/privacy",
    "/terms",
    "/acceptable-use",
    "/support",
    "/security",
    "/subprocessors",
    "/data-deletion",
    "/third-party-notices",
    "/status",
    "/known-issues",
    "/release-notes",
    "/download",
    "/updates",
  ];
  return {
    schemaVersion: "relay.public-launch-surfaces.v5",
    capturedAt: "2026-07-14T22:09:30.000Z",
    baseURL: "https://relayconsole.work",
    releaseBinding: {
      repository: "insitektalay/relay-console",
      sourceCommit: "a".repeat(40),
      sourceBranch: "release/relay-console-1.0.0-rc1",
      githubDeploymentId: 1234,
      deploymentURL: "https://relay-console-release.vercel.app",
    },
    releaseIdentity: {
      path: "/release-identity.json",
      finalURL: "https://relayconsole.work/release-identity.json",
      status: 200,
      contentType: "application/json; charset=utf-8",
      bodySha256: "1".repeat(64),
      document: {
        schemaVersion: "relay.web-release-identity.v1",
        repository: "insitektalay/relay-console",
        sourceCommit: "a".repeat(40),
        sourceBranch: "release/relay-console-1.0.0-rc1",
        environment: "production",
        deploymentId: "dpl_Release123",
        deploymentURL: "https://relay-console-release.vercel.app",
      },
      error: null,
    },
    routes: routes.map((path) => ({
      path,
      finalURL: `https://relayconsole.work${path}`,
      status: 200,
      contentType: "text/html; charset=utf-8",
      bodySha256: "2".repeat(64),
      placeholderHits: [],
      supportHoursPublished: path === "/support",
      responseTargetPublished: path === "/support",
      error: null,
    })),
    advertisedAddresses: ["hello@relayconsole.work"],
    mailDomains: [
      {
        domain: "relayconsole.work",
        exchanges: ["mail.relayconsole.work"],
        error: null,
      },
    ],
  };
}

function rawSmoke() {
  const health = (name, serviceStatus = "ok") => ({
    name,
    ok: true,
    statusCode: 200,
    latencyMs: 10,
    serviceOk: true,
    status: serviceStatus,
    service: "clawchat-backend",
  });
  return {
    ok: true,
    checkedAt: "2026-07-14T22:10:00.000Z",
    checks: [
      health("backend_live"),
      health("backend_ready", "ready"),
      health("production_synthetic", "healthy"),
      { name: "web_root", ok: true, statusCode: 200, latencyMs: 12 },
      health("web_api_rewrite_live"),
      health("web_api_rewrite_ready", "ready"),
      {
        name: "authenticated_websocket_smoke",
        ok: true,
        latencyMs: 25,
        workspaceSource: "discovered",
        steps: [
          { name: "login", ok: true, statusCode: 200, latencyMs: 5 },
          {
            name: "workspace_list",
            ok: true,
            statusCode: 200,
            latencyMs: 4,
            workspaceCount: 1,
          },
          { name: "ws_ticket", ok: true, statusCode: 201, latencyMs: 4 },
          { name: "websocket_connect", ok: true, event: "authenticated" },
        ],
      },
      {
        name: "billing_observability",
        ok: true,
        statusCode: 200,
        latencyMs: 8,
        snapshotStatus: "healthy",
        alerts: [],
        activePaidSubscriptions: 3,
        failedBillingEvents: 0,
        staleBillingEvents: 0,
        entitlementMismatches: 0,
        privacySafe: true,
      },
      {
        name: "operations_observability",
        ok: true,
        statusCode: 200,
        latencyMs: 9,
        snapshotStatus: "healthy",
        alerts: [],
        activeBridgeDevices: 2,
        recentBridgeDevices: 2,
        failedBridgeEvents: 0,
        staleBridgeEvents: 0,
        staleRuntimeDispatches: 0,
        oauthRefreshFailures: 0,
        privacySafe: true,
      },
    ],
  };
}

function artifacts() {
  return {
    topology: topology(),
    configuration: configuration(),
    remoteEvidence: remoteEvidence(),
    publicSurfaces: publicSurfaces(),
  };
}

test("builds strict release-bound production smoke evidence", () => {
  const inputs = artifacts();
  const evidence = buildProductionSmokeEvidence({
    rawSmoke: rawSmoke(),
    ...inputs,
  });
  assert.deepEqual(validateProductionSmokeSchema(evidence), []);
  assert.deepEqual(validateProductionSmokeEvidence(evidence, inputs), {
    valid: true,
    errors: [],
  });
  assert.equal(evidence.status, "ready");
  assert.equal(
    evidence.checks.authenticatedWebsocket.socketAuthenticated,
    true,
  );
  assert.equal(evidence.checks.productionSynthetic.serviceStatus, "healthy");
  assert.equal(evidence.releaseBinding.railwayDeploymentId, "railway-1");
  assert.equal(evidence.releaseBinding.vercelDeploymentId, "dpl_Release123");
});

test("drops credentials, identifiers, response bodies, URLs, and raw errors", () => {
  const raw = rawSmoke();
  raw.secret = "operator-secret-value";
  raw.checks[6].url = "wss://api.relayconsole.work?ticket=secret-ticket";
  raw.checks[6].email = "customer@example.com";
  raw.checks[6].workspaceId = "workspace-secret-id";
  raw.checks[6].body = "customer message content";
  raw.checks[6].error = "raw provider error with secret";
  const evidence = buildProductionSmokeEvidence({
    rawSmoke: raw,
    ...artifacts(),
  });
  const serialized = JSON.stringify(evidence);
  for (const forbidden of [
    "operator-secret-value",
    "secret-ticket",
    "customer@example.com",
    "workspace-secret-id",
    "customer message content",
    "raw provider error",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden));
  }
});

test("fails missing, duplicate, skipped, or unhealthy smoke checks", () => {
  const raw = rawSmoke();
  raw.ok = false;
  raw.checks = raw.checks.filter((check) => check.name !== "web_root");
  raw.checks.push({ ...raw.checks[0] });
  const billing = raw.checks.find(
    (check) => check.name === "billing_observability",
  );
  billing.ok = false;
  billing.snapshotStatus = "attention";
  billing.alerts = ["ENTITLEMENT_MISMATCHES"];
  const evidence = buildProductionSmokeEvidence({
    rawSmoke: raw,
    ...artifacts(),
  });
  const result = validateProductionSmokeEvidence(evidence, artifacts());
  assert.equal(evidence.status, "failed");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /check set is incomplete/);
  assert.match(result.errors.join("\n"), /webRoot failed/);
  assert.match(result.errors.join("\n"), /active launch alerts/);
});

test("rejects unknown fields and release-binding substitution", () => {
  const inputs = artifacts();
  const evidence = buildProductionSmokeEvidence({
    rawSmoke: rawSmoke(),
    ...inputs,
  });
  evidence.secret = "must-not-pass";
  evidence.checks.webRoot.extra = true;
  evidence.releaseBinding.sourceCommit = "b".repeat(40);
  const result = validateProductionSmokeEvidence(evidence, inputs);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /unsupported field secret/);
  assert.match(result.errors.join("\n"), /unsupported field extra/);
  assert.match(result.errors.join("\n"), /sourceCommit differs/);
});

test("refuses invalid release prerequisites before accepting smoke output", () => {
  const inputs = artifacts();
  inputs.configuration.status = "incomplete";
  inputs.publicSurfaces.releaseIdentity.document.sourceCommit = "b".repeat(40);
  assert.throws(
    () => buildProductionSmokeEvidence({ rawSmoke: rawSmoke(), ...inputs }),
    /Release evidence prerequisites are invalid/,
  );
});

test("refuses stale prerequisite evidence", () => {
  const inputs = artifacts();
  inputs.topology.capturedAt = "2026-07-12T20:00:00.000Z";
  assert.throws(
    () => buildProductionSmokeEvidence({ rawSmoke: rawSmoke(), ...inputs }),
    /Railway topology must be captured within 24 hours/,
  );
});
