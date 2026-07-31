import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  buildSafeProductionSecretProviderEvidence,
  validateProductionSecretProviderEvidence,
} from "./production-secret-provider-gate.mjs";

const SOURCE_COMMIT = "a".repeat(40);
const CAPTURED_AT = "2026-07-27T12:00:00.000Z";
const DEPLOYMENT_ID = "d87ce04d-248b-41de-b1f3-ee31f068c435";

function topology(overrides = {}) {
  return {
    schemaVersion: "relay.railway-release-topology.v1",
    capturedAt: "2026-07-27T11:59:30.000Z",
    project: {
      id: "aac9cbd8-55be-428c-84d1-4bcc40f91483",
      name: "pure-youthfulness",
    },
    production: {
      id: "825cb83e-5fc4-4236-9d22-fd53578facfc",
      backend: {
        serviceId: "3c87a016-e9c1-41a4-9b3c-2f755e55840b",
        serviceName: "clawchat",
        deployment: {
          id: DEPLOYMENT_ID,
          sourceCommit: SOURCE_COMMIT,
        },
      },
    },
    ...overrides,
  };
}

function attestation(overrides = {}) {
  return {
    schemaVersion: "relay.production-secret-audit.v2",
    capturedAt: "2026-07-27T11:59:00.000Z",
    status: "passed",
    identity: {
      provider: "railway",
      projectId: "aac9cbd8-55be-428c-84d1-4bcc40f91483",
      environmentId: "825cb83e-5fc4-4236-9d22-fd53578facfc",
      environmentName: "production",
      serviceId: "3c87a016-e9c1-41a4-9b3c-2f755e55840b",
      serviceName: "clawchat",
      deploymentId: DEPLOYMENT_ID,
      sourceCommit: SOURCE_COMMIT,
    },
    features: {
      transactionalEmail: true,
      stripeBilling: false,
      appleBilling: false,
      managedCloud: false,
      marketplaceBetaGate: true,
      marketplaceKillSwitch: false,
      signupMode: "invite",
    },
    coverage: {
      coreSecretCount: 11,
      materialCount: 1,
      serviceSecretCount: 0,
      oauthSecretCount: 0,
      webhookSecretCount: 0,
      databaseCredentialChecked: true,
      redisCredentialChecked: true,
      cookieSigningUsesJwtSecrets: true,
      csrfUsesPerSessionRandomUuid: true,
      publicSecretVariableCount: 0,
      distinctMaterialChecked: true,
      lifecycleRegistryChecked: true,
      deploymentIdentityChecked: true,
      connectionDescriptorKeyPairVerified: true,
    },
    materials: [
      {
        name: "JWT_SECRET",
        classification: "application",
        minimumBytesPolicy: 32,
        present: true,
        strengthPolicyPassed: true,
        distinctMaterialPassed: true,
        lifecycleTracked: true,
      },
    ],
    lifecycle: {
      schemaVersion: "relay.secret-lifecycle.v1",
      materials: [
        {
          name: "JWT_SECRET",
          version: "v1",
          lastRotatedAt: "2026-05-16T12:00:00.000Z",
          lastReviewedAt: "2026-07-21T12:00:00.000Z",
          nextReviewAt: "2026-10-01T12:00:00.000Z",
        },
      ],
    },
    privacy: {
      secretValuesIncluded: false,
      secretFingerprintsIncluded: false,
      credentialLengthsIncluded: false,
      providerVariableValuesRetrieved: false,
    },
    ...overrides,
  };
}

function vercelEnvironmentResponse(extra = []) {
  return {
    envs: [
      {
        id: "env_railway_origin",
        key: "CLAWCHAT_RAILWAY_ORIGIN",
        type: "sensitive",
        target: ["production"],
        createdAt: 1785060000000,
        updatedAt: 1785060000000,
        gitBranch: null,
        customEnvironmentIds: [],
      },
      {
        id: "env_railway_ws",
        key: "NEXT_PUBLIC_RAILWAY_WS_BASE_URL",
        type: "sensitive",
        target: ["production"],
        createdAt: 1785060000000,
        updatedAt: 1785060000000,
        gitBranch: null,
        customEnvironmentIds: [],
      },
      ...extra,
    ],
  };
}

function vercelDeployment(overrides = {}) {
  return {
    uid: "dpl_ProductionRelease123",
    projectId: "prj_kzsErngw49SZSmFCYwrgjmNGFgH1",
    readyState: "READY",
    target: "production",
    createdAt: 1785146400000,
    url: "clawchat-web-production.vercel.app",
    meta: { githubCommitSha: SOURCE_COMMIT },
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildSafeProductionSecretProviderEvidence({
    railwayAttestation: attestation(),
    railwayTopologyBefore: topology(),
    railwayTopologyAfter: topology(),
    vercelEnvironmentResponse: vercelEnvironmentResponse(),
    vercelDeployment: vercelDeployment(),
    sourceCommit: SOURCE_COMMIT,
    capturedAt: CAPTURED_AT,
    ...overrides,
  });
}

test("builds strict value-free evidence bound to exact Railway and Vercel deployments", () => {
  const evidence = build();
  const result = validateProductionSecretProviderEvidence(evidence, {
    sourceCommit: SOURCE_COMMIT,
    now: CAPTURED_AT,
  });

  assert.equal(evidence.status, "passed");
  assert.deepEqual(result, { valid: true, errors: [] });
  assert.deepEqual(
    evidence.vercel.variables.map(({ key }) => key),
    ["CLAWCHAT_RAILWAY_ORIGIN", "NEXT_PUBLIC_RAILWAY_WS_BASE_URL"],
  );
  assert.equal(evidence.railway.identity.deploymentId, DEPLOYMENT_ID);
  assert.equal(JSON.stringify(evidence).includes("actual-secret-material"), false);
});

test("refuses provider metadata that contains a value-bearing field", () => {
  const response = vercelEnvironmentResponse();
  response.envs[0].value = "actual-secret-material";

  assert.throws(
    () => build({ vercelEnvironmentResponse: response }),
    /forbidden field/,
  );
});

test("fails an unstable or release-mismatched Railway deployment", () => {
  const changed = topology();
  changed.production.backend.deployment.id =
    "11111111-2222-3333-4444-555555555555";
  const evidence = build({ railwayTopologyAfter: changed });
  const result = validateProductionSecretProviderEvidence(evidence, {
    sourceCommit: SOURCE_COMMIT,
    now: CAPTURED_AT,
  });

  assert.equal(evidence.status, "failed");
  assert.match(result.errors.join("\n"), /changed during evidence capture/);
  assert.match(result.errors.join("\n"), /attestation deploymentId/);
});

test("rejects a malformed Railway deployment identifier in stored evidence", () => {
  const evidence = build();
  evidence.railway.identity.deploymentId = "-".repeat(36);
  evidence.railway.attestation.identity.deploymentId = "-".repeat(36);
  const result = validateProductionSecretProviderEvidence(evidence, {
    sourceCommit: SOURCE_COMMIT,
    now: CAPTURED_AT,
  });

  assert.equal(result.valid, false);
  assert.match(
    result.errors.join("\n"),
    /deployment identity is missing or invalid|schema validation failed/i,
  );
});

test("fails incomplete strength, separation, lifecycle, or privacy attestation", () => {
  const unsafe = attestation();
  unsafe.materials[0].strengthPolicyPassed = false;
  unsafe.materials[0].distinctMaterialPassed = false;
  unsafe.materials[0].lifecycleTracked = false;
  unsafe.privacy.secretFingerprintsIncluded = true;
  const evidence = build({ railwayAttestation: unsafe });
  const result = validateProductionSecretProviderEvidence(evidence, {
    now: CAPTURED_AT,
  });

  assert.equal(evidence.status, "failed");
  assert.match(result.errors.join("\n"), /strength, separation, or lifecycle/);
  assert.match(result.errors.join("\n"), /privacy contract/);
});

test("fails forbidden, non-sensitive, branch-scoped, and post-deployment Vercel variables", () => {
  const unsafe = vercelEnvironmentResponse([
    {
      id: "env_retired",
      key: "MISSION_CONTROL_ADMIN_SECRET",
      type: "plain",
      target: ["production", "preview"],
      createdAt: 1785060000000,
      updatedAt: 1785232800000,
      gitBranch: "main",
      customEnvironmentIds: ["env_custom"],
    },
  ]);
  const evidence = build({ vercelEnvironmentResponse: unsafe });
  const result = validateProductionSecretProviderEvidence(evidence, {
    now: CAPTURED_AT,
  });

  assert.equal(evidence.status, "failed");
  assert.match(result.errors.join("\n"), /not approved/);
  assert.match(result.errors.join("\n"), /forbidden/);
  assert.match(result.errors.join("\n"), /unsafe scope or storage/);
  assert.match(result.errors.join("\n"), /not bound to the deployment/);
});

test("fails missing required Vercel metadata or the wrong deployment commit", () => {
  const response = vercelEnvironmentResponse();
  response.envs.pop();
  const evidence = build({
    vercelEnvironmentResponse: response,
    vercelDeployment: vercelDeployment({
      meta: { githubCommitSha: "b".repeat(40) },
    }),
  });
  const result = validateProductionSecretProviderEvidence(evidence, {
    sourceCommit: SOURCE_COMMIT,
    now: CAPTURED_AT,
  });

  assert.equal(evidence.status, "failed");
  assert.match(
    result.errors.join("\n"),
    /NEXT_PUBLIC_RAILWAY_WS_BASE_URL is missing/,
  );
  assert.match(result.errors.join("\n"), /exact ready production release/);
});

test("fails stale evidence and strict-schema additions", () => {
  const evidence = build();
  evidence.unreviewed = true;
  const result = validateProductionSecretProviderEvidence(evidence, {
    now: "2026-07-30T12:00:00.000Z",
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /additional properties/);
  assert.match(result.errors.join("\n"), /stale or future-dated/);
});

test("fails attestation freshness and source-commit substitution", () => {
  const stale = attestation({
    capturedAt: "2026-07-26T11:00:00.000Z",
  });
  const evidence = build({ railwayAttestation: stale });
  const result = validateProductionSecretProviderEvidence(evidence, {
    sourceCommit: "b".repeat(40),
    now: CAPTURED_AT,
  });

  assert.equal(evidence.status, "failed");
  assert.match(result.errors.join("\n"), /not fresh/);
  assert.match(result.errors.join("\n"), /differs from the release commit/);
});

test("independently rechecks lifecycle coverage and timestamps in stored evidence", () => {
  const unsafe = attestation();
  unsafe.coverage.materialCount = 2;
  unsafe.lifecycle.materials[0].lastReviewedAt =
    "2025-01-01T00:00:00.000Z";
  unsafe.lifecycle.materials.push({
    ...unsafe.lifecycle.materials[0],
    name: "JWT_REFRESH_SECRET",
  });
  const evidence = build({ railwayAttestation: unsafe });
  const result = validateProductionSecretProviderEvidence(evidence, {
    now: CAPTURED_AT,
  });

  assert.equal(evidence.status, "failed");
  assert.match(result.errors.join("\n"), /does not exactly cover/);
  assert.match(result.errors.join("\n"), /invalid or stale/);
});

test("live capture uses runtime SSH and metadata-only Vercel access, never Railway variable export", () => {
  const source = readFileSync(
    resolve(import.meta.dirname, "production-secret-provider-gate.mjs"),
    "utf8",
  );

  assert.match(source, /"ssh"/);
  assert.match(source, /decrypt=false/);
  assert.match(source, /authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(source, /railway["'],\s*\[\s*["']variables|variable list/);
  assert.doesNotMatch(source, /process\.stdout\.write\([^)]*vercelToken/);
});
