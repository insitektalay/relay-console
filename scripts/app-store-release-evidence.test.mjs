import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  appStoreRepositoryEvidence,
  buildAppStoreReleaseEvidence,
  hashAppStoreJSON,
  validateAppStoreReleaseEvidence,
  validateAppStoreReleaseResults,
} from "./app-store-release-evidence.mjs";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const candidateSHA256 = "c".repeat(64);

function candidate() {
  return {
    releaseId: "relay-console-0.1.0-rc1",
    source: {
      branch: "release/relay-console-1.0.0-rc1",
      commit: "a".repeat(40),
    },
  };
}

function iOSDistribution() {
  return {
    schemaVersion: "relay.ios-distribution-evidence.v1",
    candidate: {
      sourceCommit: "a".repeat(40),
      manifestSHA256: candidateSHA256,
    },
    archive: {
      appBundleSHA256: "6".repeat(64),
      appVersion: "1.0",
      appBuild: "1",
      bundleIdentifier: "com.relayconsole.app",
    },
    signing: { teamIdentifier: "A1B2C3D4E5" },
    appStoreConnect: {
      appId: "app-1",
      buildId: "build-1",
      processingState: "VALID",
      uploadedDate: "2026-07-14T22:00:00.000Z",
    },
  };
}

function billingRelease() {
  const journey = () => ({ status: "passed" });
  return {
    results: {
      apple: {
        purchaseAndEntitlement: journey(),
        renewal: journey(),
        billingRetryAndGrace: journey(),
        cancellationOrRevocation: journey(),
        refund: journey(),
        accountMismatch: journey(),
        restore: journey(),
      },
    },
  };
}

function publicSurfaces() {
  return {
    routes: [
      ["/privacy", "https://relayconsole.work/privacy"],
      ["/support", "https://relayconsole.work/support"],
      ["/terms", "https://relayconsole.work/terms"],
    ].map(([path, finalURL]) => ({ path, finalURL, status: 200 })),
  };
}

function results() {
  const review = (id) => ({
    reviewedAt: "2026-07-14T22:05:00.000Z",
    reviewer: `${id} reviewer`,
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/app-store#${id}`,
  });
  const testFlight = (id) => ({
    status: "passed",
    testedBuildId: "build-1",
    iPhoneCovered: true,
    iPadCovered: true,
    completedAt: "2026-07-14T22:05:00.000Z",
    reviewer: `${id} reviewer`,
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/app-store#${id}`,
  });
  return {
    schemaVersion: "relay.app-store-release-results.v1",
    completedAt: "2026-07-14T22:06:00.000Z",
    app: {
      appId: "app-1",
      buildId: "build-1",
      bundleIdentifier: "com.relayconsole.app",
      teamIdentifier: "A1B2C3D4E5",
      version: "1.0",
      build: "1",
      locale: "en-GB",
    },
    listing: {
      metadataSubmitted: true,
      metadataReviewed: true,
      iPhoneScreenshotsSubmitted: true,
      iPadScreenshotsSubmitted: true,
      screenshotsMatchBuild: true,
      privacyURL: "https://relayconsole.work/privacy",
      supportURL: "https://relayconsole.work/support",
      termsURL: "https://relayconsole.work/terms",
      ageRatingCompleted: true,
      exportComplianceCompleted: true,
      reviewNotesSubmitted: true,
      ...review("listing"),
    },
    privacyDisclosures: {
      submitted: true,
      reviewedAgainstFrozenBinary: true,
      reviewedAgainstFrozenMarketplace: true,
      tracking: false,
      categories: {
        account: true,
        messages: true,
        providerConnections: true,
        diagnostics: true,
        purchases: true,
        deviceData: true,
        telemetry: true,
      },
      ...review("privacy"),
    },
    reviewPath: {
      accountEmailVerified: true,
      writableSubscription: true,
      runtimeBridgeOnline: true,
      agentAvailable: true,
      messageRoundTripPassed: true,
      restorePurchasesPassed: true,
      accountExportPassed: true,
      accountDeletionPassed: true,
      ...review("review-path"),
    },
    deviceAcceptance: {
      iPhonePassed: true,
      iPadPassed: true,
      dynamicTypePassed: true,
      voiceOverPassed: true,
      darkModePassed: true,
      keyboardPassed: true,
      supportedRotationPassed: true,
      poorNetworkPassed: true,
      offlineRuntimePassed: true,
      expiredSubscriptionPassed: true,
      expiredAuthenticationPassed: true,
      ...review("devices"),
    },
    testFlight: {
      internal: testFlight("testflight-internal"),
      external: testFlight("testflight-external"),
    },
    appReview: {
      approvalStatus: "approved",
      submissionId: "submission-1",
      submittedBuildId: "build-1",
      storeState: "PENDING_DEVELOPER_RELEASE",
      rejectionCount: 1,
      resolvedRejectionCount: 1,
      unresolvedRejectionCount: 0,
      reviewedAt: "2026-07-14T22:05:00.000Z",
      verifiedBy: "Release owner",
      evidenceURL: "https://evidence.relayconsole.work/releases/rc1/app-store#app-review",
    },
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      reviewAccountIdentifiersIncluded: false,
      customerContentIncluded: false,
      paymentIdentifiersIncluded: false,
      rawScreenshotsIncluded: false,
    },
  };
}

function context(overrides = {}) {
  const sourceCandidate = candidate();
  return {
    releaseId: sourceCandidate.releaseId,
    sourceCommit: sourceCandidate.source.commit,
    sourceBranch: sourceCandidate.source.branch,
    candidateSHA256,
    iOSDistribution: iOSDistribution(),
    billingRelease: billingRelease(),
    publicSurfaces: publicSurfaces(),
    repositoryRoot: root,
    ...overrides,
  };
}

function evidence() {
  return buildAppStoreReleaseEvidence({
    candidate: candidate(),
    candidateSHA256,
    iOSDistribution: iOSDistribution(),
    billingRelease: billingRelease(),
    publicSurfaces: publicSurfaces(),
    results: results(),
    repositoryRoot: root,
    capturedAt: "2026-07-14T22:07:00.000Z",
  });
}

test("accepts listing, privacy, device, TestFlight, and App Review outcomes for one build", () => {
  const value = evidence();
  assert.deepEqual(validateAppStoreReleaseEvidence(value, context()), {
    valid: true,
    errors: [],
  });
  assert.deepEqual(value.repository, appStoreRepositoryEvidence(root));
  assert.equal(value.releaseBinding.iOSDistributionSHA256, hashAppStoreJSON(iOSDistribution()));
});

test("rejects candidate, build, billing, public-route, and repository substitutions", () => {
  const value = evidence();
  value.candidate.manifestSHA256 = "d".repeat(64);
  value.results.app.buildId = "different-build";
  value.releaseBinding.billingReleaseSHA256 = "e".repeat(64);
  value.repository.metadataSHA256 = "f".repeat(64);
  const billing = billingRelease();
  billing.results.apple.restore.status = "failed";
  const surfaces = publicSurfaces();
  surfaces.routes.find((route) => route.path === "/support").status = 404;
  const validation = validateAppStoreReleaseEvidence(value, context({
    billingRelease: billing,
    publicSurfaces: surfaces,
  }));
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(validation.errors.join("\n"), /build id differs/);
  assert.match(validation.errors.join("\n"), /billing SHA-256 differs/);
  assert.match(validation.errors.join("\n"), /seven Apple sandbox billing journeys/);
  assert.match(validation.errors.join("\n"), /support page/);
  assert.match(validation.errors.join("\n"), /metadataSHA256 differs/);
});

test("rejects mixed TestFlight builds and unresolved App Review rejections", () => {
  const value = results();
  value.testFlight.internal.testedBuildId = "older-build";
  value.appReview.submittedBuildId = "other-build";
  value.appReview.resolvedRejectionCount = 0;
  const validation = validateAppStoreReleaseResults(value);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /Internal TestFlight tested a different build/);
  assert.match(validation.errors.join("\n"), /App Review used a different build/);
  assert.match(validation.errors.join("\n"), /Every App Review rejection/);
});

test("rejects placeholder, shared, stale, or private-data-bearing records", () => {
  const value = evidence();
  value.results.listing.reviewer = "replace-with-reviewer";
  value.results.listing.evidenceURL = "https://example.test/listing";
  value.results.privacyDisclosures.evidenceURL = value.results.reviewPath.evidenceURL;
  value.results.deviceAcceptance.reviewedAt = "2026-01-01T00:00:00.000Z";
  value.results.privacy.credentialsIncluded = true;
  const validation = validateAppStoreReleaseEvidence(value, context());
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /named human reviewer/);
  assert.match(validation.errors.join("\n"), /non-placeholder HTTPS/);
  assert.match(validation.errors.join("\n"), /own evidence URL/);
  assert.match(validation.errors.join("\n"), /within 90 days/);
  assert.match(validation.errors.join("\n"), /credentialsIncluded/);
});

test("the operator template cannot pass as completed App Store evidence", () => {
  const template = JSON.parse(readFileSync(
    resolve(root, "RelayConsoleSwift/Release/app-store-release-results.template.json"),
    "utf8",
  ));
  const validation = validateAppStoreReleaseResults(template);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /schemaVersion|constant|format|named human/);
});
