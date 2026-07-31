import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMarketplaceProviderRequirements,
  classifyProviderRequirements,
  loadMarketplaceProviderRequirements,
  validateMarketplaceProviderRequirements,
} from "./marketplace-provider-requirements.mjs";
import { loadCanonicalMarketplaceReleaseManifest } from "./marketplace-release-manifest.mjs";

function provider(overrides = {}) {
  return {
    providerSetup: {
      status: "customer_action_required",
      blocker: null,
      nextAction: "A customer creates a dedicated API key.",
    },
    evidence: [{
      url: "https://provider.example/docs",
      supports: "The provider documents API authentication.",
    }],
    ...overrides,
  };
}

test("classifies explicit provider requirements without treating unknowns as approval", () => {
  const result = classifyProviderRequirements(provider({
    providerSetup: {
      status: "review_pending",
      blocker: "Provider review and an enterprise paid plan are required.",
      nextAction: "A workspace admin completes approval and verifies the documented rate limit.",
    },
  }));
  assert.equal(result.providerReview.status, "required_or_pending");
  assert.equal(result.quota.status, "documented_or_provider_specific");
  assert.equal(result.paidPlan.status, "required_or_plan_gated");
  assert.equal(result.customerAdmin.status, "required_or_owner_controlled");
  assert.equal(result.providerReview.acceptanceRequired, true);
});

test("records explicit absence narrowly and leaves undocumented requirements gated", () => {
  const result = classifyProviderRequirements(provider({
    providerSetup: {
      status: "not_required",
      blocker: null,
      nextAction: "No provider review is required. The API is available on the free plan.",
    },
  }));
  assert.equal(result.providerReview.status, "explicitly_not_required");
  assert.equal(result.providerReview.acceptanceRequired, false);
  assert.equal(result.paidPlan.status, "explicitly_not_required");
  assert.equal(result.quota.status, "not_identified_verify_before_live");
  assert.equal(result.quota.acceptanceRequired, true);
  assert.equal(result.customerAdmin.status, "not_identified_verify_before_live");
});

test("covers the exact frozen 406-provider cohort with four requirement records each", () => {
  const releaseManifest = loadCanonicalMarketplaceReleaseManifest();
  const register = buildMarketplaceProviderRequirements(releaseManifest);
  assert.equal(register.providers.length, 406);
  assert.equal(register.summary.cohortCount, 406);
  assert.equal(register.summary.liveVerifiedCount, 0);
  assert.equal(
    register.providers.every((entry) =>
      entry.liveAcceptanceDisposition === "required_before_live_verified" &&
      Object.keys(entry.requirements).sort().join(",") ===
        "customerAdmin,paidPlan,providerReview,quota"),
    true,
  );
  assert.deepEqual(
    validateMarketplaceProviderRequirements(register, releaseManifest),
    { valid: true, errors: [] },
  );
});

test("canonical generated register is current and remains fail closed", () => {
  const releaseManifest = loadCanonicalMarketplaceReleaseManifest();
  const register = loadMarketplaceProviderRequirements();
  assert.deepEqual(
    validateMarketplaceProviderRequirements(register, releaseManifest),
    { valid: true, errors: [] },
  );
  assert.equal(register.providers.every(({ liveVerified }) => liveVerified === false), true);
  assert.equal(register.policy.unknownIsNotApproval, true);
  assert.equal(register.policy.liveAcceptanceRequired, true);
  assert.equal(Object.values(register.privacy).every((value) => value === false), true);
});
