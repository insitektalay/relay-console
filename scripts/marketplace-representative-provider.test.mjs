import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const json = (path) => JSON.parse(read(path));

test("FRED is the release-bound representative journey without overstating verification", () => {
  const release = json(
    "packages/marketplace-catalog/release/marketplace-release-manifest.json",
  );
  const provider = json("packages/marketplace-catalog/providers/fred/manifest.json");
  const journey = json(
    "RelayConsoleSwift/Release/launch-journey-results.template.json",
  );
  const decision = read(
    "docs/relay-cloud/MARKETPLACE_REPRESENTATIVE_PROVIDER.md",
  );
  const row = release.providers.find(({ slug }) => slug === "fred");

  assert.ok(row, "FRED must remain in the frozen release manifest");
  assert.equal(row.state, "customer_credential_required");
  assert.equal(row.label, "Beta — customer credentials required");
  assert.equal(row.connectEligible, true);
  assert.equal(row.liveVerified, false);
  assert.equal(provider.authentication.relayOwned, false);
  assert.equal(provider.authentication.model, "api_key");
  assert.ok(
    provider.actions.allowed.some(({ id }) => id === "fred_series_search"),
  );
  assert.equal(journey.marketplace.providerSlug, "fred");
  assert.equal(journey.marketplace.liveActionName, "fred_series_search");
  assert.match(decision, /Status: selected; live acceptance pending/);
  assert.match(decision, /Beta — customer credentials required/);
  assert.match(decision, /liveVerified: false/);
});

test("release labels are derived from verification state without unsupported claims", () => {
  const release = json(
    "packages/marketplace-catalog/release/marketplace-release-manifest.json",
  );

  for (const provider of release.providers) {
    if (provider.liveVerified) {
      assert.equal(provider.state, "live_verified");
      assert.equal(provider.label, "Live verified");
      assert.equal(provider.connectEligible, true);
      assert.ok(provider.acceptance?.recordPath);
      assert.ok(provider.acceptance?.recordSHA256);
      continue;
    }

    if (provider.connectEligible) {
      assert.equal(provider.state, "customer_credential_required");
      assert.equal(provider.label, "Beta — customer credentials required");
      assert.equal(provider.acceptance ?? null, null);
      continue;
    }

    assert.equal(provider.state, "unavailable");
    assert.equal(provider.label, "Unavailable");
  }
});
