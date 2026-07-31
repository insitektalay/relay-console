import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildRepositoryRecoveryEvidence,
  failureRecoverySourceEvidence,
  validateFailureRecoveryEvidence,
} from "./failure-recovery-evidence.mjs";

const root = resolve(fileURLToPath(import.meta.url), "../..");

function hashJson(value) {
  const stable = (input) => {
    if (Array.isArray(input)) return input.map(stable);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.keys(input).sort().map((key) => [key, stable(input[key])]),
      );
    }
    return input;
  };
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function topology() {
  return {
    production: { backend: { deployment: { id: "railway-production-1" } } },
    staging: { backend: { deployment: { id: "railway-staging-1" } } },
  };
}

function configuration() {
  return { identity: { deploymentId: "railway-production-1" }, status: "ready" };
}

function remoteEvidence() {
  return {
    ciRuns: {
      backend: {
        runId: 101,
        url: "https://github.com/insitektalay/relay-console/actions/runs/101",
      },
    },
  };
}

function context() {
  return {
    releaseId: "relay-console-1.0.0-rc1",
    sourceCommit: "a".repeat(40),
    sourceBranch: "release/relay-console-1.0.0-rc1",
    candidateSHA256: "b".repeat(64),
    topology: topology(),
    configuration: configuration(),
    remoteEvidence: remoteEvidence(),
    repositoryRoot: root,
  };
}

const environments = {
  railway_unavailable: "staging",
  redis_or_queue_unavailable: "staging",
  database_migration_failure: "staging",
  expired_or_revoked_human_session: "production",
  expired_or_revoked_bridge_credential: "production",
  runtime_incompatible_or_offline: "production",
  oauth_failure_and_recovery: "production",
  duplicate_or_delayed_billing_event: "sandbox",
  client_below_minimum_contract: "production",
  backend_rollback_and_database_restore: "production",
};

function drill(id) {
  const environment = environments[id];
  return {
    status: "passed",
    environment,
    deploymentId: environment === "staging"
      ? "railway-staging-1"
      : "railway-production-1",
    verifiedAt: "2026-07-15T05:45:00.000Z",
    reviewer: "Release operator",
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/${id}`,
    recoveryConfirmed: true,
    customerImpact: environment === "staging" || id === "backend_rollback_and_database_restore"
      ? "none"
      : "synthetic-only",
    secretValuesIncluded: false,
    customerContentIncluded: false,
  };
}

function evidence() {
  const source = failureRecoverySourceEvidence(root);
  const drills = Object.fromEntries(
    Object.keys(environments).map((id) => [id, drill(id)]),
  );
  return {
    schemaVersion: "relay.failure-recovery-evidence.v1",
    releaseId: "relay-console-1.0.0-rc1",
    capturedAt: "2026-07-15T06:00:00.000Z",
    drillsCompletedAt: "2026-07-15T05:50:00.000Z",
    candidate: {
      sourceCommit: "a".repeat(40),
      manifestSHA256: "b".repeat(64),
    },
    releaseBinding: {
      sourceBranch: "release/relay-console-1.0.0-rc1",
      productionDeploymentId: "railway-production-1",
      stagingDeploymentId: "railway-staging-1",
      railwayTopologySHA256: hashJson(topology()),
      railwayConfigurationSHA256: hashJson(configuration()),
      remoteEvidenceSHA256: hashJson(remoteEvidence()),
    },
    repository: {
      executedAt: "2026-07-15T05:55:00.000Z",
      status: "passed",
      journeyCount: source.journeyCount,
      testFileCount: source.testFileCount,
      testSuiteCount: source.testFileCount,
      passedTestSuiteCount: source.testFileCount,
      testCount: 390,
      passedTestCount: 390,
      sourceEvidenceSHA256: source.sourceEvidenceSHA256,
      backendCIRunId: 101,
      backendCIRunURL: "https://github.com/insitektalay/relay-console/actions/runs/101",
    },
    drills,
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
}

test("accepts a release-bound repository run and all ten reviewed recovery drills", () => {
  assert.deepEqual(validateFailureRecoveryEvidence(evidence(), context()), {
    valid: true,
    errors: [],
  });
});

test("rejects substituted deployments, stale drills, and placeholder evidence", () => {
  const record = evidence();
  record.drills.railway_unavailable.environment = "production";
  record.drills.redis_or_queue_unavailable.deploymentId = "other-deployment";
  record.drills.database_migration_failure.evidenceURL = "https://example.test/evidence";
  record.drills.expired_or_revoked_human_session.reviewer = "<human-reviewer>";
  record.drills.runtime_incompatible_or_offline.verifiedAt = "2026-07-01T00:00:00.000Z";
  const result = validateFailureRecoveryEvidence(record, context());
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /must run in staging/);
  assert.match(result.errors.join("\n"), /wrong deployment/);
  assert.match(result.errors.join("\n"), /non-placeholder HTTPS evidence URL/);
  assert.match(result.errors.join("\n"), /named human reviewer/);
  assert.match(result.errors.join("\n"), /within seven days/);
});

test("rejects stale or tampered repository evidence and release bindings", () => {
  const record = evidence();
  record.repository.executedAt = "2026-07-13T00:00:00.000Z";
  record.repository.sourceEvidenceSHA256 = "0".repeat(64);
  record.repository.backendCIRunId = 999;
  record.releaseBinding.railwayTopologySHA256 = "1".repeat(64);
  record.candidate.manifestSHA256 = "2".repeat(64);
  const result = validateFailureRecoveryEvidence(record, context());
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(result.errors.join("\n"), /topology SHA-256 differs/);
  assert.match(result.errors.join("\n"), /backend CI identity differs/);
  assert.match(result.errors.join("\n"), /source evidence SHA-256 differs/);
  assert.match(result.errors.join("\n"), /within 24 hours/);
});

test("strict schema rejects secret fields and the pending operator template", () => {
  const record = evidence();
  record.repository.rawOutput = "must-not-pass";
  assert.match(
    validateFailureRecoveryEvidence(record, context()).errors.join("\n"),
    /unsupported field rawOutput/,
  );

  const template = JSON.parse(readFileSync(resolve(
    root,
    "RelayConsoleSwift/Release/failure-recovery-drills.template.json",
  ), "utf8"));
  const pending = evidence();
  pending.drillsCompletedAt = template.completedAt;
  pending.drills = template.drills;
  const result = validateFailureRecoveryEvidence(pending, context());
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /must be equal to constant|ISO timestamp/);
});

test("repository capture records exact passing counts and validated backend CI identity", () => {
  const record = buildRepositoryRecoveryEvidence({
    root,
    now: () => new Date("2026-07-15T05:55:00.000Z"),
    runJest: (_root, files) => ({
      success: true,
      testSuiteCount: files.length,
      passedTestSuiteCount: files.length,
      testCount: 390,
      passedTestCount: 390,
    }),
    remoteEvidence: remoteEvidence(),
  });
  assert.equal(record.status, "passed");
  assert.equal(record.testFileCount, 20);
  assert.equal(record.testSuiteCount, 20);
  assert.equal(record.testCount, 390);
  assert.equal(record.backendCIRunId, 101);
  assert.match(record.sourceEvidenceSHA256, /^[a-f0-9]{64}$/);
});

test("repository capture fails closed on partial tests or missing backend CI", () => {
  const partial = {
    success: true,
    testSuiteCount: 20,
    passedTestSuiteCount: 19,
    testCount: 390,
    passedTestCount: 389,
  };
  assert.throws(
    () => buildRepositoryRecoveryEvidence({
      root,
      runJest: () => partial,
      remoteEvidence: remoteEvidence(),
    }),
    /incomplete or failed/,
  );
  assert.throws(
    () => buildRepositoryRecoveryEvidence({
      root,
      runJest: (_root, files) => ({
        success: true,
        testSuiteCount: files.length,
        passedTestSuiteCount: files.length,
        testCount: 390,
        passedTestCount: 390,
      }),
      remoteEvidence: {},
    }),
    /Validated backend CI evidence is required/,
  );
});
