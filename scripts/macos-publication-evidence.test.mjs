import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  UPDATE_MANIFEST_URL,
  buildMacOSPublicationEvidence,
  hashMacOSPublicationJSON,
  validateMacOSPublicationEvidence,
  validateMacOSPublicationResults,
} from "./macos-publication-evidence.mjs";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const candidateSHA256 = "c".repeat(64);
const currentBytes = Buffer.from("signed current Relay Console DMG");
const previousBytes = Buffer.from("signed previous Relay Console DMG");
const sha = (value) => createHash("sha256").update(value).digest("hex");

function candidate() {
  return {
    releaseId: "relay-console-0.1.0-rc1",
    source: {
      branch: "release/relay-console-0.1.0-rc1",
      commit: "a".repeat(40),
    },
    deployments: { vercelDeploymentId: "1234" },
  };
}

function macOSDistribution() {
  return {
    schemaVersion: "relay.macos-distribution-evidence.v1",
    releaseId: "relay-console-0.1.0-rc1",
    capturedAt: "2026-07-14T22:00:00.000Z",
    candidate: {
      sourceCommit: "a".repeat(40),
      manifestSHA256: candidateSHA256,
    },
    artifact: {
      fileName: "RelayConsole-0.1.0.dmg",
      dmgSHA256: sha(currentBytes),
      dmgSizeBytes: currentBytes.length,
      appVersion: "0.1.0",
      appBuild: "1",
      architectures: ["arm64"],
    },
  };
}

function publicSurfaces() {
  const paths = [
    "/", "/privacy", "/terms", "/acceptable-use", "/support", "/security",
    "/subprocessors", "/data-deletion", "/third-party-notices", "/status",
    "/known-issues", "/release-notes", "/download", "/updates",
  ];
  return {
    schemaVersion: "relay.public-launch-surfaces.v5",
    routes: paths.map((path, index) => ({
      path,
      finalURL: `https://relayconsole.work${path}`,
      status: 200,
      bodySha256: String((index % 9) + 1).repeat(64),
    })),
  };
}

function updateManifest({ previous = null } = {}) {
  return {
    schemaVersion: "relay.macos-update-manifest.v1",
    channel: "public-beta",
    generatedAt: "2026-07-14T22:06:00.000Z",
    manualUpdate: false,
    updateMechanism: "sparkle-2",
    appcastURL: "https://insitektalay.github.io/clawchat/appcast.xml",
    current: {
      version: "0.1.0",
      build: "1",
      fileName: "RelayConsole-0.1.0.dmg",
      url: "https://relayconsole.work/downloads/RelayConsole-0.1.0.dmg",
      checksumURL: "https://relayconsole.work/downloads/RelayConsole-0.1.0.dmg.sha256",
      sha256: sha(currentBytes),
      sizeBytes: currentBytes.length,
      publishedAt: "2026-07-14T22:05:00.000Z",
      architectures: ["arm64"],
      signatureMode: "developer-id-hardened-runtime",
      notarizationStatus: "accepted-stapled",
      distributionEvidenceSHA256: hashMacOSPublicationJSON(macOSDistribution()),
      sparkleArchiveURL: "https://github.com/insitektalay/clawchat/releases/download/macos-v0.1.0-b1/RelayConsole-0.1.0-b1.zip",
      sparkleEdSignature: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
    },
    previous,
    previousDMGMinimumRetentionDays: 30,
    downloadPageURL: "https://relayconsole.work/download",
    releaseNotesURL: "https://relayconsole.work/release-notes",
    supportURL: "https://relayconsole.work/support",
    rollbackPolicyURL: "https://relayconsole.work/updates",
  };
}

function previousArtifact() {
  const distribution = previousDistribution();
  return {
    version: "0.0.9",
    build: "9",
    fileName: "RelayConsole-0.0.9.dmg",
    url: "https://relayconsole.work/downloads/RelayConsole-0.0.9.dmg",
    checksumURL: "https://relayconsole.work/downloads/RelayConsole-0.0.9.dmg.sha256",
    sha256: sha(previousBytes),
    sizeBytes: previousBytes.length,
    publishedAt: "2026-06-01T12:00:00.000Z",
    architectures: ["arm64"],
    signatureMode: "developer-id-hardened-runtime",
    notarizationStatus: "accepted-stapled",
    retainedUntil: "2026-08-14T22:05:00.000Z",
    distributionEvidenceSHA256: hashMacOSPublicationJSON(distribution),
    sparkleArchiveURL: "https://github.com/insitektalay/clawchat/releases/download/macos-v0.0.9-b9/RelayConsole-0.0.9-b9.zip",
    sparkleEdSignature: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
  };
}

function previousDistribution() {
  return {
    schemaVersion: "relay.macos-distribution-evidence.v1",
    releaseId: "relay-console-0.0.9",
    capturedAt: "2026-06-01T11:00:00.000Z",
    candidate: {
      sourceCommit: "b".repeat(40),
      manifestSHA256: "d".repeat(64),
    },
    artifact: {
      fileName: "RelayConsole-0.0.9.dmg",
      dmgSHA256: sha(previousBytes),
      dmgSizeBytes: previousBytes.length,
      appVersion: "0.0.9",
      appBuild: "9",
      bundleIdentifier: "com.relayconsole.app",
      minimumOS: "14.0",
      architectures: ["arm64"],
      mainExecutableSHA256: "1".repeat(64),
      bridgeExecutableSHA256: "2".repeat(64),
    },
    signing: {
      mode: "developer-id-hardened-runtime",
      authority: "Developer ID Application: Relay Console Ltd (A1B2C3D4E5)",
      teamIdentifier: "A1B2C3D4E5",
      appCDHash: "3".repeat(40),
      timestamped: true,
      hardenedRuntime: true,
      nestedExecutablesVerified: true,
      appVerified: true,
      dmgVerified: true,
    },
    notarization: {
      appSubmissionId: "123e4567-e89b-42d3-a456-426614174010",
      appStatus: "Accepted",
      appSubmissionSHA256: "4".repeat(64),
      dmgSubmissionId: "123e4567-e89b-42d3-a456-426614174011",
      dmgStatus: "Accepted",
      dmgSubmissionSHA256: "5".repeat(64),
      appStapleValidated: true,
      dmgStapleValidated: true,
    },
    gatekeeper: {
      appAccepted: true,
      dmgAccepted: true,
      quarantinedMountSignatureVerified: true,
      quarantinedMountGatekeeperAccepted: true,
    },
  };
}

function results({ firstPublicRelease = true } = {}) {
  const review = (id) => ({
    reviewedAt: "2026-07-14T22:07:00.000Z",
    reviewer: `${id} reviewer`,
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/macos#${id}`,
  });
  return {
    schemaVersion: "relay.macos-publication-results.v1",
    completedAt: "2026-07-14T22:08:00.000Z",
    releaseHistory: { firstPublicRelease },
    publicationReview: {
      downloadPageMatchesArtifact: true,
      releaseNotesMatchArtifact: true,
      supportPathUsable: true,
      updateManifestReviewed: true,
      ...review("publication"),
    },
    cleanMachine: {
      supportedMacPassed: true,
      developmentToolsAbsent: true,
      independentHermesPassed: true,
      independentOpenClawPassed: true,
      ...review("clean-machine"),
    },
    lifecycle: {
      databaseMigrationPassed: true,
      exportPassed: true,
      resetPassed: true,
      updatePassed: true,
      rollbackPassed: true,
      keychainContinuityPassed: true,
      uninstallBoundaryPassed: true,
      ...review("lifecycle"),
    },
    policy: {
      manualSignedUpdates: true,
      rollbackPolicyPublished: true,
      minimumPreviousDMGRetentionDays: 30,
      ...review("policy"),
    },
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawScreenshotsIncluded: false,
      rawMachineInventoryIncluded: false,
    },
  };
}

function fetchFor(document, { badChecksum = false } = {}) {
  return async (url) => {
    if (url === UPDATE_MANIFEST_URL) {
      return new Response(JSON.stringify(document), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    for (const [artifact, bytes] of [
      [document.current, currentBytes],
      [document.previous, previousBytes],
    ]) {
      if (!artifact) continue;
      if (url === artifact.url) {
        return new Response(bytes, {
          status: 200,
          headers: { "content-type": "application/x-apple-diskimage" },
        });
      }
      if (url === artifact.checksumURL) {
        const checksum = badChecksum ? "0".repeat(64) : artifact.sha256;
        return new Response(`${checksum}  ${artifact.fileName}\n`, {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

function context(overrides = {}) {
  const source = candidate();
  return {
    releaseId: source.releaseId,
    sourceCommit: source.source.commit,
    sourceBranch: source.source.branch,
    candidateSHA256,
    vercelDeploymentId: source.deployments.vercelDeploymentId,
    macOSDistribution: macOSDistribution(),
    publicSurfaces: publicSurfaces(),
    ...overrides,
  };
}

async function evidence({ previous = null, firstPublicRelease = true, badChecksum = false } = {}) {
  const document = updateManifest({ previous });
  return buildMacOSPublicationEvidence({
    candidate: candidate(),
    candidateSHA256,
    macOSDistribution: macOSDistribution(),
    publicSurfaces: publicSurfaces(),
    results: results({ firstPublicRelease }),
    previousDistribution: previous ? previousDistribution() : null,
    fetchImpl: fetchFor(document, { badChecksum }),
    capturedAt: "2026-07-14T22:10:00.000Z",
  });
}

test("accepts exact current DMG, checksum, pages, clean-Mac journeys, and first-release policy", async () => {
  const value = await evidence();
  assert.deepEqual(validateMacOSPublicationEvidence(value, context()), {
    valid: true,
    errors: [],
  });
  assert.equal(value.releaseBinding.macOSDistributionSHA256, hashMacOSPublicationJSON(macOSDistribution()));
  assert.equal(value.previousDownload, null);
  assert.equal(value.previousDistribution, null);
});

test("accepts and verifies a retained previous public DMG", async () => {
  const value = await evidence({
    previous: previousArtifact(),
    firstPublicRelease: false,
  });
  assert.deepEqual(validateMacOSPublicationEvidence(value, context()), {
    valid: true,
    errors: [],
  });
  assert.equal(value.previousDownload.sha256, sha(previousBytes));
});

test("rejects candidate, deployment, artifact, page, and public-byte substitutions", async () => {
  const value = await evidence({ badChecksum: true });
  value.candidate.manifestSHA256 = "d".repeat(64);
  value.releaseBinding.vercelDeploymentId = "different";
  value.download.sha256 = "e".repeat(64);
  value.pages.find((page) => page.path === "/download").bodySHA256 = "f".repeat(64);
  const validation = validateMacOSPublicationEvidence(value, context());
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(validation.errors.join("\n"), /Vercel deployment differs/);
  assert.match(validation.errors.join("\n"), /Current download SHA-256 differs/);
  assert.match(validation.errors.join("\n"), /download page hash differs/);
  assert.match(validation.errors.join("\n"), /Current checksum advertised SHA-256 differs/);
});

test("rejects missing previous release, short retention, and mixed first-release evidence", async () => {
  const first = await evidence();
  first.results.releaseHistory.firstPublicRelease = false;
  let validation = validateMacOSPublicationEvidence(first, context());
  assert.match(validation.errors.join("\n"), /needs the previous supported artifact/);

  const previous = previousArtifact();
  previous.retainedUntil = "2026-07-20T00:00:00.000Z";
  const later = await evidence({ previous, firstPublicRelease: false });
  later.results.releaseHistory.firstPublicRelease = true;
  validation = validateMacOSPublicationEvidence(later, context());
  assert.match(validation.errors.join("\n"), /must not claim a previous public artifact/);
  assert.match(validation.errors.join("\n"), /retention is shorter/);
});

test("rejects placeholder, shared, stale, or private-data-bearing reviews", async () => {
  const value = await evidence();
  value.results.publicationReview.reviewer = "replace-with-reviewer";
  value.results.publicationReview.evidenceURL = "https://example.test/publication";
  value.results.cleanMachine.evidenceURL = value.results.lifecycle.evidenceURL;
  value.results.policy.reviewedAt = "2026-01-01T00:00:00.000Z";
  value.results.privacy.rawMachineInventoryIncluded = true;
  const validation = validateMacOSPublicationEvidence(value, context());
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /named human reviewer/);
  assert.match(validation.errors.join("\n"), /non-placeholder HTTPS/);
  assert.match(validation.errors.join("\n"), /own evidence URL/);
  assert.match(validation.errors.join("\n"), /within 90 days/);
  assert.match(validation.errors.join("\n"), /rawMachineInventoryIncluded/);
});

test("the pending operator template cannot pass as completed macOS publication evidence", () => {
  const template = JSON.parse(readFileSync(
    resolve(root, "RelayConsoleSwift/Release/macos-publication-results.template.json"),
    "utf8",
  ));
  const validation = validateMacOSPublicationResults(template);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /schemaVersion|constant|format|named human/);
});
