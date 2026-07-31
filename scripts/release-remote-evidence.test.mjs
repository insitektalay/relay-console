import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildReleaseRemoteEvidence,
  validateReleaseRemoteEvidence,
} from "./release-remote-evidence.mjs";

const sourceCommit = "a".repeat(40);
const sourceBranch = "release/relay-console-1.0.0-rc1";

function run(databaseId, workflowName, overrides = {}) {
  return {
    databaseId,
    workflowName,
    url: `https://github.com/insitektalay/relay-console/actions/runs/${databaseId}`,
    status: "completed",
    conclusion: "success",
    headSha: sourceCommit,
    headBranch: sourceBranch,
    event: "push",
    createdAt: "2026-07-15T09:00:00.000Z",
    updatedAt: "2026-07-15T09:05:00.000Z",
    ...overrides,
  };
}

function inputs() {
  const deployment = {
    id: 1234,
    sha: sourceCommit,
    ref: sourceBranch,
    environment: "Production",
    creator: { login: "vercel[bot]" },
    created_at: "2026-07-15T09:06:00.000Z",
  };
  return {
    sourceCommit,
    sourceBranch,
    capturedAt: "2026-07-15T09:10:00.000Z",
    runs: [
      run(1, "Backend Beta Readiness"),
      run(2, "Web Beta Readiness"),
      run(3, "Apple Beta Readiness"),
    ],
    deployments: [deployment],
    statusesByDeployment: {
      "1234": [{
        state: "success",
        creator: { login: "vercel[bot]" },
        environment_url: "https://relay-console-release.vercel.app",
        target_url: "https://relay-console-release.vercel.app",
        updated_at: "2026-07-15T09:09:00.000Z",
      }],
    },
  };
}

test("binds three green readiness workflows and Vercel production to one release commit", () => {
  const evidence = buildReleaseRemoteEvidence(inputs());
  assert.deepEqual(validateReleaseRemoteEvidence(evidence, { sourceCommit, sourceBranch }), {
    valid: true,
    errors: [],
  });
  assert.equal(evidence.vercel.githubDeploymentId, 1234);
  assert.equal(evidence.ciRuns.apple.headSha, sourceCommit);
});

test("rejects missing, failed, or wrong-commit remote proof", () => {
  const candidate = inputs();
  candidate.runs = candidate.runs.filter((item) => item.workflowName !== "Apple Beta Readiness");
  candidate.runs.find((item) => item.workflowName === "Web Beta Readiness").conclusion = "failure";
  candidate.deployments[0].sha = "b".repeat(40);
  const evidence = buildReleaseRemoteEvidence(candidate);
  const result = validateReleaseRemoteEvidence(evidence, { sourceCommit, sourceBranch });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Web Beta Readiness has no successful/);
  assert.match(result.errors.join("\n"), /Apple Beta Readiness has no successful/);
  assert.match(result.errors.join("\n"), /No successful Vercel production deployment/);
});

test("selects the newest successful exact-branch workflow run", () => {
  const candidate = inputs();
  candidate.runs.push(run(4, "Backend Beta Readiness", { updatedAt: "2026-07-15T09:08:00.000Z" }));
  candidate.runs.push(run(5, "Backend Beta Readiness", { headBranch: "main", updatedAt: "2026-07-15T09:09:00.000Z" }));
  const evidence = buildReleaseRemoteEvidence(candidate);
  assert.equal(evidence.ciRuns.backend.runId, 4);
});

test("schema and semantic validation reject unsupported or untrusted evidence", () => {
  const evidence = buildReleaseRemoteEvidence(inputs());
  evidence.unexpected = true;
  evidence.ciRuns.backend.url = "https://example.test/actions/runs/1";
  evidence.vercel.statusCreator = "someone";
  const result = validateReleaseRemoteEvidence(evidence, { sourceCommit, sourceBranch });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /additional properties|must NOT have additional properties/);
  assert.match(result.errors.join("\n"), /URL is not a repository Actions run/);
  assert.match(result.errors.join("\n"), /not authored by Vercel/);
});
