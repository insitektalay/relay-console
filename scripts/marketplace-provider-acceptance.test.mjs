import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  validateMarketplaceAcceptanceRepository,
  validateMarketplaceProviderAcceptance,
} from "./marketplace-provider-acceptance.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const journeyIds = [
  "connect",
  "failureOrDenial",
  "connectionStatus",
  "boundedLiveAction",
  "reconnect",
  "revokeAndDisconnect",
];

function record() {
  return {
    schemaVersion: "relay.marketplace-provider-acceptance.v1",
    manifestVersion: "2026-07-15-rc.1",
    providerSlug: "github",
    capturedAt: "2026-07-15T06:00:00.000Z",
    releaseBinding: {
      providerSourceCommit: "a".repeat(40),
      stagingDeploymentId: "staging-deployment-1",
      stagingSourceBranch: "codex/shared-marketplace-loop",
    },
    provider: {
      connectionType: "oauth",
      officialDocsURL: "https://docs.github.com/en/apps/oauth-apps",
      officialDocsReviewedAt: "2026-07-14",
      dedicatedTestAccount: true,
      leastPrivilege: true,
    },
    boundedAction: {
      actionName: "Create and remove a test issue label",
      reversible: true,
      cleanupConfirmed: true,
    },
    journeys: Object.fromEntries(journeyIds.map((id, index) => [id, {
      status: "passed",
      verifiedAt: "2026-07-15T05:30:00.000Z",
      reviewer: "Marketplace acceptance reviewer",
      evidenceURL: `https://evidence.relayconsole.work/marketplace/github/${index}-${id}`,
      providerImpact: "test-account-only",
      credentialMaterialIncluded: false,
      providerObjectIdentifiersIncluded: false,
      testAccountIdentifiersIncluded: false,
    }])),
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      providerObjectIdentifiersIncluded: false,
      testAccountIdentifiersIncluded: false,
      customerContentIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
}

function topology() {
  return {
    staging: {
      backend: {
        deployment: {
          id: "staging-deployment-1",
          sourceCommit: "a".repeat(40),
          sourceBranch: "codex/shared-marketplace-loop",
        },
      },
    },
  };
}

function manifest(reference) {
  return {
    schemaVersion: "relay.marketplace-release.v1",
    manifestVersion: "2026-07-15-rc.1",
    releaseChannel: "public-beta",
    freeze: {
      status: "frozen",
      frozenAt: "2026-07-15T07:00:00.000Z",
      sourceRevision: "b".repeat(40),
    },
    defaultProvider: {
      state: "coming_later",
      label: "Coming later",
      connectEligible: false,
      liveVerified: false,
      reason: "Acceptance is incomplete.",
    },
    providers: [{
      slug: "github",
      state: "available",
      label: "Available",
      connectEligible: true,
      liveVerified: true,
      reason: "Staging acceptance passed.",
      reviewedAt: "2026-07-15",
      acceptance: reference,
    }],
  };
}

function repositoryFixture() {
  const root = mkdtempSync(resolve(tmpdir(), "relay-provider-acceptance-"));
  const relativePath = "packages/marketplace-catalog/release/acceptance/github.json";
  const path = resolve(root, relativePath);
  mkdirSync(resolve(path, ".."), { recursive: true });
  const payload = `${JSON.stringify(record(), null, 2)}\n`;
  writeFileSync(path, payload);
  return {
    root,
    path,
    releaseManifest: manifest({ recordPath: relativePath, recordSHA256: sha256(payload) }),
  };
}

test("accepts one exact, fresh, secret-free staging record for a live provider", () => {
  const fixture = repositoryFixture();
  try {
    const result = validateMarketplaceAcceptanceRepository({
      root: fixture.root,
      releaseManifest: fixture.releaseManifest,
      topology: topology(),
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.acceptedSlugs, ["github"]);
    assert.equal(result.files.length, 1);
    assert.match(result.acceptanceSHA256, /^[a-f0-9]{64}$/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rejects record hash drift and unsafe or mismatched paths", () => {
  const fixture = repositoryFixture();
  try {
    fixture.releaseManifest.providers[0].acceptance.recordSHA256 = "0".repeat(64);
    let result = validateMarketplaceAcceptanceRepository({
      root: fixture.root,
      releaseManifest: fixture.releaseManifest,
    });
    assert.equal(result.valid, false);
    assert.match(result.errors.join("\n"), /record SHA-256 differs/);

    fixture.releaseManifest.providers[0].acceptance.recordPath = "../github.json";
    result = validateMarketplaceAcceptanceRepository({
      root: fixture.root,
      releaseManifest: fixture.releaseManifest,
    });
    assert.equal(result.valid, false);
    assert.match(result.errors.join("\n"), /recordPath must be|path is missing or unsafe/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rejects stale records and staging deployment substitution", () => {
  const value = record();
  value.capturedAt = "2026-06-01T00:00:00.000Z";
  value.releaseBinding.stagingDeploymentId = "other-deployment";
  value.releaseBinding.providerSourceCommit = "c".repeat(40);
  const result = validateMarketplaceProviderAcceptance(value, {
    manifestVersion: "2026-07-15-rc.1",
    providerSlug: "github",
    frozenAt: "2026-07-15T07:00:00.000Z",
    topology: topology(),
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /within seven days/);
  assert.match(result.errors.join("\n"), /staging deployment differs/);
  assert.match(result.errors.join("\n"), /source commit differs/);
});

test("rejects shared evidence, placeholder review, and stale official documentation", () => {
  const value = record();
  value.provider.officialDocsReviewedAt = "2026-01-01";
  value.journeys.connect.reviewer = "<reviewer>";
  value.journeys.failureOrDenial.evidenceURL = value.journeys.connect.evidenceURL;
  const result = validateMarketplaceProviderAcceptance(value, {
    manifestVersion: "2026-07-15-rc.1",
    providerSlug: "github",
    frozenAt: "2026-07-15T07:00:00.000Z",
    topology: topology(),
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /within 31 days/);
  assert.match(result.errors.join("\n"), /named human reviewer|pattern/);
  assert.match(result.errors.join("\n"), /own evidence URL or document anchor/);
});

test("strict schema rejects retained provider identifiers and secret fields", () => {
  const value = record();
  value.journeys.boundedLiveAction.providerObjectId = "must-not-pass";
  value.privacy.credentialsIncluded = true;
  const result = validateMarketplaceProviderAcceptance(value, {
    manifestVersion: "2026-07-15-rc.1",
    providerSlug: "github",
    frozenAt: "2026-07-15T07:00:00.000Z",
    topology: topology(),
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /unsupported field providerObjectId/);
  assert.match(result.errors.join("\n"), /must be equal to constant/);
});

test("accepts an open fail-closed manifest with no live provider records", () => {
  const releaseManifest = {
    schemaVersion: "relay.marketplace-release.v1",
    manifestVersion: "2026-07-15-draft.1",
    releaseChannel: "public-beta",
    freeze: { status: "open", frozenAt: null, sourceRevision: null },
    defaultProvider: {
      state: "coming_later",
      label: "Coming later",
      connectEligible: false,
      liveVerified: false,
      reason: "Acceptance is incomplete.",
    },
    providers: [],
  };
  const result = validateMarketplaceAcceptanceRepository({ releaseManifest });
  assert.equal(result.valid, true);
  assert.deepEqual(result.acceptedSlugs, []);
});
