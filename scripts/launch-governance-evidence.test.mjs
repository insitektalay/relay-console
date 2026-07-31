import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildLaunchGovernanceEvidence,
  hashGovernanceJSON,
  validateLaunchGovernanceEvidence,
  validateLaunchGovernanceResults,
} from "./launch-governance-evidence.mjs";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const candidateSHA256 = "c".repeat(64);

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
  const paths = [
    "/", "/privacy", "/terms", "/acceptable-use", "/support", "/security",
    "/subprocessors", "/data-deletion", "/third-party-notices", "/status",
    "/known-issues", "/release-notes", "/download", "/updates",
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
    routes: paths.map((path, index) => ({
      path,
      finalURL: `https://relayconsole.work${path}`,
      status: 200,
      contentType: "text/html; charset=utf-8",
      bodySha256: String((index % 9) + 1).repeat(64),
      placeholderHits: [],
      supportHoursPublished: path === "/support",
      responseTargetPublished: path === "/support",
      error: null,
    })),
    advertisedAddresses: ["hello@relayconsole.work"],
    mailDomains: [{
      domain: "relayconsole.work",
      exchanges: ["mail.relayconsole.work"],
      error: null,
    }],
  };
}

function billingRelease() {
  return {
    results: {
      pricing: {
        relay: {
          monthlyPriceUSD: "9.99",
          webPriceTaxDisclosure: "varies-by-region",
        },
      },
      taxAndMerchant: { launchCountriesReviewed: true, launchCountries: ["GB"] },
    },
  };
}

function candidate() {
  return {
    releaseId: "relay-console-0.1.0-rc1",
    source: {
      branch: "release/relay-console-1.0.0-rc1",
      commit: "a".repeat(40),
    },
    deployments: { vercelDeploymentId: "1234" },
    evidence: { remote: remoteEvidence() },
  };
}

function results() {
  const approval = (id) => ({
    approved: true,
    reviewedAt: "2026-07-14T22:05:00.000Z",
    reviewer: `${id} reviewer`,
    reviewerRole: `${id} owner`,
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/governance#${id}`,
  });
  return {
    schemaVersion: "relay.launch-governance-results.v3",
    completedAt: "2026-07-14T22:06:00.000Z",
    launchCountries: ["GB"],
    approvals: {
      legalPolicyReview: {
        ...approval("legal"),
        qualifiedForLaunchCountries: true,
      },
      acceptableUseApproval: approval("acceptable-use"),
      supportApproval: approval("support"),
      productClaimsApproval: approval("product"),
      dataHandlingApproval: approval("data"),
      thirdPartyNoticesApproval: {
        ...approval("third-party-notices"),
        lockedDependencyInventoryReviewed: true,
        requiredLicenseTextsPresent: true,
      },
    },
    support: {
      address: "hello@relayconsole.work",
      hoursPublished: true,
      responseTargetPublished: true,
      mailRoutingVerified: true,
      accountableOwner: "Support owner",
    },
    productClaims: {
      relayMonthlyPriceUSD: "9.99",
      relayTaxDisclosure: "varies-by-region",
      customerOperatedRuntime: true,
      paidEntitlementRequired: true,
      managedRuntimeAvailableAtLaunch: false,
      enterpriseAvailableAtLaunch: false,
    },
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawDocumentBodiesIncluded: false,
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
    vercelDeploymentId: sourceCandidate.deployments.vercelDeploymentId,
    remoteEvidence: sourceCandidate.evidence.remote,
    publicSurfaces: publicSurfaces(),
    billingRelease: billingRelease(),
    ...overrides,
  };
}

function evidence() {
  return buildLaunchGovernanceEvidence({
    candidate: candidate(),
    candidateSHA256,
    publicSurfaces: publicSurfaces(),
    billingRelease: billingRelease(),
    results: results(),
    capturedAt: "2026-07-14T22:07:00.000Z",
  });
}

test("accepts policy, notices, support, and product approvals bound to one deployed release", () => {
  const value = evidence();
  assert.deepEqual(validateLaunchGovernanceEvidence(value, context()), {
    valid: true,
    errors: [],
  });
  assert.equal(value.documents.length, 9);
  assert.equal(value.releaseBinding.publicSurfacesSHA256, hashGovernanceJSON(publicSurfaces()));
});

test("rejects candidate, Vercel, policy-page, and billing substitutions", () => {
  const value = evidence();
  value.candidate.manifestSHA256 = "d".repeat(64);
  value.releaseBinding.vercelDeploymentId = "different";
  value.documents.find((document) => document.path === "/privacy").bodySHA256 = "e".repeat(64);
  value.results.productClaims.relayTaxDisclosure = "includes-tax";
  value.results.launchCountries = ["US"];
  const validation = validateLaunchGovernanceEvidence(value, context());
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(validation.errors.join("\n"), /Vercel deployment differs/);
  assert.match(validation.errors.join("\n"), /privacy governance hash differs/);
  assert.match(validation.errors.join("\n"), /tax wording differs/);
  assert.match(validation.errors.join("\n"), /launch countries differ/);
});

test("rejects placeholder, shared, stale, or anonymous approvals", () => {
  const value = results();
  value.approvals.legalPolicyReview.reviewer = "replace-with-reviewer";
  value.approvals.legalPolicyReview.qualifiedForLaunchCountries = false;
  value.approvals.legalPolicyReview.evidenceURL = "https://example.test/review";
  value.approvals.supportApproval.evidenceURL = value.approvals.acceptableUseApproval.evidenceURL;
  value.approvals.productClaimsApproval.evidenceURL = "https://evidence.relayconsole.work/review?token=secret";
  value.approvals.dataHandlingApproval.reviewedAt = "2026-06-01T00:00:00.000Z";
  value.approvals.thirdPartyNoticesApproval.lockedDependencyInventoryReviewed = false;
  value.support.accountableOwner = "<owner>";
  const validation = validateLaunchGovernanceResults(value);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /named human reviewer/);
  assert.match(validation.errors.join("\n"), /qualifiedForLaunchCountries|constant/);
  assert.match(validation.errors.join("\n"), /non-placeholder HTTPS/);
  assert.match(validation.errors.join("\n"), /own evidence URL/);
  assert.match(validation.errors.join("\n"), /within seven days/);
  assert.match(validation.errors.join("\n"), /lockedDependencyInventoryReviewed|constant/);
  assert.match(validation.errors.join("\n"), /named accountable owner/);
});

test("rejects unsupported fields, privacy leakage, missing root copy, and unrouted support", () => {
  const value = evidence();
  value.secret = "must-not-pass";
  value.privacy.rawReviewMaterialIncluded = true;
  value.documents = value.documents.filter((document) => document.path !== "/");
  const surfaces = publicSurfaces();
  surfaces.mailDomains[0].exchanges = [];
  const validation = validateLaunchGovernanceEvidence(value, context({ publicSurfaces: surfaces }));
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /unsupported field secret/);
  assert.match(validation.errors.join("\n"), /rawReviewMaterialIncluded/);
  assert.match(validation.errors.join("\n"), /exact product and policy document set|must NOT have fewer than 9 items/);
  assert.match(validation.errors.join("\n"), /no verified mail route/);
});

test("the operator template cannot pass as completed evidence", () => {
  const template = JSON.parse(readFileSync(
    resolve(root, "RelayConsoleSwift/Release/launch-governance-results.template.json"),
    "utf8",
  ));
  const validation = validateLaunchGovernanceResults(template);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /schemaVersion|format|non-placeholder|named human/);
});
