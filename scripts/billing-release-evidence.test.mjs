import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BILLING_TEST_FILES,
  billingSourceEvidence,
  buildBillingReleaseEvidence,
  buildRepositoryBillingEvidence,
  hashBillingJSON,
  validateBillingReleaseEvidence,
  validateBillingReleaseResults,
} from "./billing-release-evidence.mjs";

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
      railwayTopology: {
        production: { backend: { deployment: { id: "railway-production-1" } } },
      },
      railwayConfiguration: {
        status: "ready",
        configuration: {
          billing: {
            provider: "stripe",
            enabled: true,
            configured: true,
            liveMode: true,
          },
          appleBilling: {
            enabled: true,
            configured: true,
            bundleIdentifierMatches: true,
          },
        },
      },
    },
    evidence: {
      remote: {
        sourceCommit: "a".repeat(40),
        ciRuns: {
          backend: {
            runId: 101,
            url: "https://github.com/insitektalay/relay-console/actions/runs/101",
          },
        },
      },
    },
    components: {
      iOS: { version: "1.0", build: "1", bundleIdentifier: "com.relayconsole.app" },
    },
  };
}

function iOSDistribution() {
  return {
    schemaVersion: "relay.ios-distribution-evidence.v1",
    archive: {
      appBundleSHA256: "d".repeat(64),
      bundleIdentifier: "com.relayconsole.app",
    },
  };
}

function journey(section, id, index) {
  return {
    status: "passed",
    verifiedAt: "2026-07-15T06:00:00.000Z",
    reviewer: "Billing acceptance reviewer",
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/billing/${section}/${index}-${id}`,
    customerImpact: section === "apple" || section === "cross-provider"
      ? "sandbox"
      : section === "monitoring" ? "synthetic-only" : "test-account",
    credentialMaterialIncluded: false,
    customerContentIncluded: false,
    testAccountIdentifiersIncluded: false,
    paymentIdentifiersIncluded: false,
  };
}

function group(section, ids) {
  return Object.fromEntries(ids.map((id, index) => [id, journey(section, id, index)]));
}

function results() {
  return {
    schemaVersion: "relay.billing-release-results.v3",
    completedAt: "2026-07-15T06:05:00.000Z",
    pricing: {
      relay: {
        plan: "relay_connect_monthly",
        monthlyPriceUSD: "9.99",
        billingPeriod: "month",
        stripeLiveProductConfigured: true,
        stripePriceConfigured: true,
        stripeAutomaticTaxConfigured: true,
        appleProductConfigured: true,
        appleIAPOffered: true,
        webPriceTaxDisclosure: "varies-by-region",
      },
      verifiedAt: "2026-07-15T06:00:00.000Z",
      reviewer: "Commercial release reviewer",
      evidenceURL: "https://evidence.relayconsole.work/releases/rc1/billing/pricing",
    },
    taxAndMerchant: {
      launchCountriesReviewed: true,
      launchCountries: ["GB"],
      taxVATReviewed: true,
      merchantObligationsReviewed: true,
      reviewedAt: "2026-07-15T06:00:00.000Z",
      reviewer: "Qualified tax reviewer",
      evidenceURL: "https://evidence.relayconsole.work/releases/rc1/billing/tax",
    },
    relayStripe: group("relay-stripe", [
      "checkoutAndEntitlement", "renewal", "failedPaymentAndGrace",
      "cancellation", "refund", "dispute", "recovery",
    ]),
    relayApple: group("apple", [
      "purchaseAndEntitlement", "renewal", "billingRetryAndGrace",
      "cancellationOrRevocation", "refund", "accountMismatch", "restore",
    ]),
    crossProvider: group("cross-provider", [
      "duplicateSubscriptionPrevention", "entitlementConvergence",
    ]),
    monitoring: group("monitoring", [
      "revenue", "churn", "failedPayment", "entitlementMismatch",
      "managedRuntimeDisabled", "alertAcknowledgement",
    ]),
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerIdentifiersIncluded: false,
      paymentIdentifiersIncluded: false,
      providerObjectIdentifiersIncluded: false,
      customerContentIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
}

function repository() {
  const source = billingSourceEvidence(root);
  return {
    executedAt: "2026-07-15T06:04:00.000Z",
    status: "passed",
    testFileCount: source.testFileCount,
    testSuiteCount: 6,
    passedTestSuiteCount: 6,
    testCount: 80,
    passedTestCount: 80,
    sourceEvidenceSHA256: source.sourceEvidenceSHA256,
    backendCIRunId: 101,
    backendCIRunURL: "https://github.com/insitektalay/relay-console/actions/runs/101",
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
    iOSDistribution: iOSDistribution(),
    components: release.components,
    repositoryRoot: root,
  };
}

function evidence() {
  return buildBillingReleaseEvidence({
    candidate: candidate(),
    candidateSHA256,
    iOSDistribution: iOSDistribution(),
    repository: repository(),
    results: results(),
    repositoryRoot: root,
    capturedAt: "2026-07-15T06:10:00.000Z",
  });
}

test("accepts one Relay subscription billing record bound to one release", () => {
  assert.deepEqual(validateBillingReleaseResults(results()), { valid: true, errors: [] });
  assert.deepEqual(validateBillingReleaseEvidence(evidence(), context()), { valid: true, errors: [] });
});

test("rejects candidate, deployment, configuration, and iOS substitutions", () => {
  const record = evidence();
  record.candidate.manifestSHA256 = "0".repeat(64);
  record.releaseBinding.railwayDeploymentId = "other-deployment";
  record.releaseBinding.railwayConfigurationSHA256 = "1".repeat(64);
  record.artifacts.iOSDistributionSHA256 = "2".repeat(64);
  const result = validateBillingReleaseEvidence(record, context());
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(result.errors.join("\n"), /Railway deployment differs/);
  assert.match(result.errors.join("\n"), /configuration SHA-256 differs/);
  assert.match(result.errors.join("\n"), /iOS distribution SHA-256 differs/);
});

test("rejects placeholders, stale checks, and a shared broad evidence link", () => {
  const record = results();
  record.pricing.reviewer = "<reviewer>";
  record.taxAndMerchant.evidenceURL = "https://example.test/tax";
  record.relayStripe.renewal.verifiedAt = "2026-07-01T00:00:00.000Z";
  record.relayApple.renewal.evidenceURL =
    record.relayApple.purchaseAndEntitlement.evidenceURL;
  const result = validateBillingReleaseResults(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /named human reviewer|pattern/);
  assert.match(result.errors.join("\n"), /non-placeholder HTTPS evidence URL/);
  assert.match(result.errors.join("\n"), /within seven days/);
  assert.match(result.errors.join("\n"), /own evidence URL or document anchor/);
});

test("pending operator template fails closed", () => {
  const template = JSON.parse(readFileSync(resolve(
    root,
    "RelayConsoleSwift/Release/billing-release-results.template.json",
  ), "utf8"));
  const result = validateBillingReleaseResults(template);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /must be equal to constant|must match format|named human reviewer/);
});

test("strict schemas reject retained payment identifiers and unsupported fields", () => {
  const record = evidence();
  record.results.relayStripe.checkoutAndEntitlement.paymentCustomerId =
    "must-not-pass";
  record.privacy.paymentIdentifiersIncluded = true;
  const result = validateBillingReleaseEvidence(record, context());
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /unsupported field paymentCustomerId/);
  assert.match(result.errors.join("\n"), /must be equal to constant/);
});

test("repository evidence binds the mapped billing source and backend CI run", () => {
  assert.equal(BILLING_TEST_FILES.length, 6);
  const record = buildRepositoryBillingEvidence({
    root,
    now: () => new Date("2026-07-15T06:04:00.000Z"),
    remoteEvidence: candidate().evidence.remote,
    runJest: () => ({
      success: true,
      testSuiteCount: 6,
      passedTestSuiteCount: 6,
      testCount: 80,
      passedTestCount: 80,
    }),
  });
  assert.equal(record.testFileCount, 6);
  assert.equal(record.sourceEvidenceSHA256, billingSourceEvidence(root).sourceEvidenceSHA256);
  assert.equal(record.backendCIRunId, 101);
  assert.throws(
    () => buildRepositoryBillingEvidence({
      root,
      remoteEvidence: candidate().evidence.remote,
      runJest: () => ({
        success: true,
        testSuiteCount: 6,
        passedTestSuiteCount: 5,
        testCount: 80,
        passedTestCount: 79,
      }),
    }),
    /incomplete or failed/,
  );
});

test("stable billing hashes bind nested journey evidence", () => {
  const first = hashBillingJSON(results());
  const changed = results();
  changed.monitoring.revenue.reviewer = "Another billing reviewer";
  assert.notEqual(hashBillingJSON(changed), first);
});
