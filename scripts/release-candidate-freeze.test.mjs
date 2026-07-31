import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const load = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));

test("the active release control represents the open one-product candidate", () => {
  const freeze = load("RelayConsoleSwift/Release/release-candidate-freeze.json");

  assert.equal(freeze.schemaVersion, "relay.one-product-release-freeze.v2");
  assert.equal(freeze.releaseId, "relay-console-1.0.0");
  assert.equal(freeze.status, "open");
  assert.equal(freeze.promotionEligible, false);

  assert.deepEqual(freeze.product, {
    name: "Relay",
    price: "US$9.99 per month",
    accountRequired: true,
    paidEntitlementRequired: true,
    runtimeOwnership: "customer-operated",
    managedRuntimeOffered: false,
  });

  assert.deepEqual(freeze.source, {
    branch: null,
    commit: null,
    clean: false,
  });

  assert.equal(freeze.supersedes.releaseId, "relay-console-0.1.0-rc1");
  assert.equal(freeze.supersedes.status, "frozen-preview");
  assert.match(freeze.supersedes.reason, /superseded Local, Connect, and managed Cloud/i);
  assert.ok(freeze.requiredBeforeFreeze.length >= 4);
  assert.ok(freeze.promotionBlockers.length >= 5);
  assert.match(
    freeze.promotionBlockers.join("\n"),
    /No exact clean one-product source commit is frozen/,
  );
});
