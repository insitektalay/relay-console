import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildLaunchJourneyEvidence,
  hashLaunchJourneyJSON,
  validateLaunchJourneyEvidence,
  validateLaunchJourneyResults,
} from "./launch-journey-evidence.mjs";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const candidateSHA256 = "b".repeat(64);

function candidate() {
  return {
    releaseId: "relay-console-1.0.0-rc1",
    source: {
      branch: "release/relay-console-1.0.0-rc1",
      commit: "a".repeat(40),
    },
    deployments: {
      railwayDeploymentId: "railway-production-1",
      vercelDeploymentId: "1234",
      railwayTopology: { production: { backend: { deployment: { id: "railway-production-1" } } } },
      railwayConfiguration: { status: "ready", identity: { deploymentId: "railway-production-1" } },
    },
    evidence: {
      remote: { sourceCommit: "a".repeat(40), vercel: { githubDeploymentId: 1234 } },
    },
    components: {
      macOS: { version: "0.1.0", build: "1" },
      iOS: { version: "1.0", build: "1" },
    },
    catalog: { connectEligibleSlugs: ["github"] },
  };
}

function macOSDistribution() {
  return { schemaVersion: "relay.macos-distribution-evidence.v1", artifact: { dmgSHA256: "c".repeat(64) } };
}

function iOSDistribution() {
  return { schemaVersion: "relay.ios-distribution-evidence.v1", archive: { appBundleSHA256: "d".repeat(64) } };
}

const relayIds = [
  "notarizedInstall",
  "accountVerification",
  "purchaseAndEntitlement",
  "entitlementRequiredOnMac",
  "userInstalledRuntimes",
  "sameMacHermes",
  "sameMacOpenClaw",
  "remoteBridgeEnrollment",
  "crossClientConvergence",
  "dispatchFromEveryClient",
  "runtimeOfflineState",
  "runtimeReconnectBackfill",
  "messageAndPersistence",
  "liveMarketplaceLifecycle",
  "cancellationExportDeletion",
];

const migrationIds = [
  "customerHostToCustomerHost",
  "interruptionAndRollback",
];

function journey(section, id, index) {
  return {
    status: "passed",
    verifiedAt: "2026-07-15T06:00:00.000Z",
    reviewer: "Release acceptance reviewer",
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/${section}/${index}-${id}`,
    customerImpact: "test-account",
    credentialMaterialIncluded: false,
    customerContentIncluded: false,
    testAccountIdentifiersIncluded: false,
  };
}

function results() {
  return {
    schemaVersion: "relay.launch-journey-results.v3",
    completedAt: "2026-07-15T06:05:00.000Z",
    clientMatrix: {
      macOS: {
        appVersion: "0.1.0",
        appBuild: "1",
        deviceModel: "MacBook Air M3",
        architecture: "arm64",
        osVersion: "15.5",
        cleanHost: true,
      },
      web: {
        sourceCommit: "a".repeat(40),
        deploymentId: "1234",
        browser: "Safari 19",
      },
      iPhone: {
        appVersion: "1.0",
        appBuild: "1",
        deviceModel: "iPhone 16",
        osVersion: "19.0",
      },
      iPad: {
        appVersion: "1.0",
        appBuild: "1",
        deviceModel: "iPad Air M3",
        osVersion: "19.0",
      },
    },
    runtimeMatrix: {
      hermes: {
        version: "0.9.0",
        commit: "e".repeat(40),
        hostOS: "macOS 15.5",
        hostArchitecture: "arm64",
        userInstalled: true,
        relayInstalled: false,
      },
      openClaw: {
        version: "1.2.0",
        commit: "f".repeat(40),
        hostOS: "Ubuntu 24.04",
        hostArchitecture: "x86_64",
        userInstalled: true,
        relayInstalled: false,
      },
    },
    marketplace: {
      providerSlug: "github",
      connectionType: "oauth",
      liveActionName: "Create and remove a test issue label",
      dedicatedTestAccount: true,
    },
    billing: {
      stripeMode: "live",
      appleEnvironment: "sandbox",
      plan: "relay_connect_monthly",
      monthlyPriceUSD: "9.99",
      managedRuntimeAvailable: false,
    },
    relay: Object.fromEntries(
      relayIds.map((id, index) => [id, journey("relay", id, index)]),
    ),
    migration: Object.fromEntries(
      migrationIds.map((id, index) => [id, journey("migration", id, index)]),
    ),
  };
}

function context() {
  const release = candidate();
  return {
    releaseId: release.releaseId,
    sourceCommit: release.source.commit,
    sourceBranch: release.source.branch,
    candidateSHA256,
    railwayDeploymentId: release.deployments.railwayDeploymentId,
    vercelDeploymentId: release.deployments.vercelDeploymentId,
    topology: release.deployments.railwayTopology,
    configuration: release.deployments.railwayConfiguration,
    remoteEvidence: release.evidence.remote,
    macOSDistribution: macOSDistribution(),
    iOSDistribution: iOSDistribution(),
    components: release.components,
    connectEligibleSlugs: release.catalog.connectEligibleSlugs,
  };
}

function evidence() {
  return buildLaunchJourneyEvidence({
    candidate: candidate(),
    candidateSHA256,
    macOSDistribution: macOSDistribution(),
    iOSDistribution: iOSDistribution(),
    results: results(),
    capturedAt: "2026-07-15T06:10:00.000Z",
  });
}

test("accepts one paid Relay journey and customer-host migration evidence", () => {
  assert.deepEqual(validateLaunchJourneyResults(results()), { valid: true, errors: [] });
  assert.deepEqual(validateLaunchJourneyEvidence(evidence(), context()), { valid: true, errors: [] });
});

test("rejects substituted release, artifact, client, and Marketplace identities", () => {
  const record = evidence();
  record.candidate.manifestSHA256 = "0".repeat(64);
  record.releaseBinding.railwayDeploymentId = "other-deployment";
  record.artifacts.macOSDistributionSHA256 = "1".repeat(64);
  record.results.clientMatrix.iPad.appBuild = "2";
  record.results.marketplace.providerSlug = "slack";
  const result = validateLaunchJourneyEvidence(record, context());
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(result.errors.join("\n"), /Railway deployment differs/);
  assert.match(result.errors.join("\n"), /macOS distribution SHA-256 differs/);
  assert.match(result.errors.join("\n"), /iPad build differs/);
  assert.match(result.errors.join("\n"), /outside the frozen live-verified cohort/);
});

test("rejects placeholders, stale journeys, and one broad shared evidence link", () => {
  const record = results();
  record.relay.notarizedInstall.reviewer = "<reviewer>";
  record.relay.accountVerification.evidenceURL = "https://example.test/evidence";
  record.relay.userInstalledRuntimes.verifiedAt = "2026-07-01T00:00:00.000Z";
  record.relay.sameMacHermes.evidenceURL =
    record.relay.sameMacOpenClaw.evidenceURL;
  const result = validateLaunchJourneyResults(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /named human reviewer|pattern/);
  assert.match(result.errors.join("\n"), /non-placeholder HTTPS evidence URL/);
  assert.match(result.errors.join("\n"), /within seven days/);
  assert.match(result.errors.join("\n"), /own evidence URL or document anchor/);
});

test("pending template fails closed", () => {
  const template = JSON.parse(readFileSync(resolve(
    root,
    "RelayConsoleSwift/Release/launch-journey-results.template.json",
  ), "utf8"));
  const result = validateLaunchJourneyResults(template);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /must be equal to constant|must match pattern|ISO timestamp/);
});

test("strict schemas reject unlisted fields and retained identifiers", () => {
  const record = evidence();
  record.results.relay.accountVerification.accountEmail = "must-not-pass";
  record.privacy.testAccountIdentifiersIncluded = true;
  const result = validateLaunchJourneyEvidence(record, context());
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /unsupported field accountEmail/);
  assert.match(result.errors.join("\n"), /must be equal to constant/);
});

test("builder fails when a journey is pending", () => {
  const incomplete = results();
  incomplete.relay.dispatchFromEveryClient.status = "pending";
  assert.throws(
    () => buildLaunchJourneyEvidence({
      candidate: candidate(),
      candidateSHA256,
      macOSDistribution: macOSDistribution(),
      iOSDistribution: iOSDistribution(),
      results: incomplete,
      capturedAt: "2026-07-15T06:10:00.000Z",
    }),
    /Launch journey evidence validation failed/,
  );
});

test("stable JSON hashes bind nested client and artifact evidence", () => {
  const first = hashLaunchJourneyJSON(results());
  const changed = results();
  changed.clientMatrix.iPhone.deviceModel = "iPhone 16 Pro";
  assert.notEqual(hashLaunchJourneyJSON(changed), first);
});
