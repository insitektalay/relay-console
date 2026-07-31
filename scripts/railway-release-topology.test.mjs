import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSafeRailwayTopology,
  validateRailwayReleaseTopology,
} from "./railway-release-topology.mjs";

function service(id, name, source = null, latestDeployment = null) {
  return { node: { serviceId: id, serviceName: name, source, latestDeployment } };
}

function deployment(id, branch, commit) {
  return {
    id: `${id}-deployment`,
    status: "SUCCESS",
    createdAt: "2026-07-14T21:55:00.000Z",
    meta: {
      branch,
      commitHash: commit,
      repo: "insitektalay/relay-console",
    },
  };
}

function environment(id, name, branch, commit) {
  return {
    node: {
      id,
      name,
      serviceInstances: {
        edges: [
          service(
            `${id}-backend`,
            "clawchat",
            { repo: "insitektalay/relay-console" },
            deployment(id, branch, commit),
          ),
          service(`${id}-postgres`, "Postgres"),
          service(`${id}-redis`, "Redis"),
        ],
      },
    },
  };
}

function config(id, branch, checkSuites = true) {
  return {
    services: {
      [`${id}-backend`]: {
        source: {
          repo: "insitektalay/relay-console",
          branch,
          rootDirectory: "/backend",
          checkSuites,
        },
      },
    },
  };
}

function topology() {
  const productionCommit = "a".repeat(40);
  const stagingCommit = "b".repeat(40);
  return buildSafeRailwayTopology({
    status: {
      id: "project-1",
      name: "relay-console",
      workspace: { name: "Relay" },
      environments: {
        edges: [
          environment("production-1", "production", "release/relay-console-1.0.0-rc1", productionCommit),
          environment("staging-1", "staging", "codex/shared-marketplace-loop", stagingCommit),
        ],
      },
    },
    configs: {
      production: config("production-1", "release/relay-console-1.0.0-rc1"),
      staging: config("staging-1", "codex/shared-marketplace-loop"),
    },
    capturedAt: "2026-07-14T22:00:00.000Z",
  });
}

test("accepts isolated staging and reviewed production release authority", () => {
  const result = validateRailwayReleaseTopology(topology(), {
    releaseBranch: "release/relay-console-1.0.0-rc1",
    releaseCommit: "a".repeat(40),
  });
  assert.deepEqual(result, { valid: true, errors: [] });
});

test("rejects the current one-environment production-from-main topology", () => {
  const candidate = topology();
  candidate.staging = null;
  candidate.production.backend.sourceBranch = "main";
  candidate.production.backend.checkSuites = false;
  const result = validateRailwayReleaseTopology(candidate);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /staging Railway environment is missing/);
  assert.match(result.errors.join("\n"), /wait for GitHub check suites/);
  assert.match(result.errors.join("\n"), /reviewed release\/\*\* branch/);
});

test("rejects shared branches, missing data services, and a wrong backend root", () => {
  const candidate = topology();
  candidate.staging.backend.sourceBranch = candidate.production.backend.sourceBranch;
  candidate.staging.services = ["clawchat"];
  candidate.staging.backend.rootDirectory = "/";
  const result = validateRailwayReleaseTopology(candidate);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /missing Postgres/);
  assert.match(result.errors.join("\n"), /missing Redis/);
  assert.match(result.errors.join("\n"), /root directory/);
  assert.match(result.errors.join("\n"), /must not track the same source branch/);
});

test("safe snapshots retain release identity but exclude domains, variables, and unrelated service metadata", () => {
  const candidate = topology();
  const serialized = JSON.stringify(candidate);
  assert.match(serialized, /deployment/);
  assert.match(serialized, /sourceCommit/);
  assert.doesNotMatch(serialized, /variables|domains|token|secret|commitMessage|commitAuthor|imageDigest/i);
});

test("binds a CLI deployment only when its reviewed message carries one full commit", () => {
  const productionCommit = "c".repeat(40);
  const status = {
    id: "project-1",
    name: "relay-console",
    workspace: { name: "Relay" },
    environments: {
      edges: [
        environment(
          "production-1",
          "production",
          "release/relay-console-1.0.0-rc1",
          productionCommit,
        ),
        environment(
          "staging-1",
          "staging",
          "codex/shared-marketplace-loop",
          "b".repeat(40),
        ),
      ],
    },
  };
  const liveDeployment =
    status.environments.edges[0].node.serviceInstances.edges[0].node
      .latestDeployment;
  liveDeployment.meta = {
    cliMessage: `Relay production ${productionCommit}`,
  };
  const candidate = buildSafeRailwayTopology({
    status,
    configs: {
      production: config(
        "production-1",
        "release/relay-console-1.0.0-rc1",
      ),
      staging: config("staging-1", "codex/shared-marketplace-loop"),
    },
  });

  assert.equal(
    candidate.production.backend.deployment.sourceCommit,
    productionCommit,
  );
  assert.equal(
    candidate.production.backend.deployment.sourceBranch,
    "release/relay-console-1.0.0-rc1",
  );
  assert.equal(
    candidate.production.backend.deployment.sourceRepository,
    "insitektalay/relay-console",
  );
});

test("rejects a failed, unpinned, or wrong-commit production deployment", () => {
  const candidate = topology();
  candidate.production.backend.deployment.status = "FAILED";
  candidate.production.backend.deployment.sourceCommit = null;
  candidate.staging.backend.deployment.sourceBranch = "main";
  const result = validateRailwayReleaseTopology(candidate, {
    releaseBranch: "release/relay-console-1.0.0-rc1",
    releaseCommit: "c".repeat(40),
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /production backend deployment must be successful/);
  assert.match(result.errors.join("\n"), /full source commit/);
  assert.match(result.errors.join("\n"), /production backend deployment commit differs/);
  assert.match(result.errors.join("\n"), /staging backend deployment branch differs/);
});

test("runtime validation rejects unsupported fields in imported snapshots", () => {
  const candidate = topology();
  candidate.production.backend.variables = { SECRET: "must-not-enter-evidence" };
  candidate.production.domains = ["api.example.test"];
  const result = validateRailwayReleaseTopology(candidate);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /production backend contains unsupported field variables/);
  assert.match(result.errors.join("\n"), /production environment contains unsupported field domains/);
});
