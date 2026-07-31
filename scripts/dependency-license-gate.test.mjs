import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateLicenseInventory,
  legalReviewCategories,
  normalizeLicenseInventory,
  reviewedLicenseMetadataOverrides,
  reviewedLicenseCategories,
} from "./dependency-license-gate.mjs";

test("reviewed permissive and notice-bearing categories pass without claiming legal approval", () => {
  const result = evaluateLicenseInventory({
    MIT: [{ name: "one", versions: ["1.0.0"] }],
    "FSL-1.1-MIT": [{ name: "@sentry/cli", versions: ["2.58.6"] }],
    "(Apache-2.0 AND MIT)": [{ name: "posthog-js", versions: ["1.407.2"] }],
    "(MIT OR CC0-1.0)": [{ name: "type-fest", versions: ["0.7.1"] }],
    "LGPL-3.0-or-later": [{ name: "binary", versions: ["2.0.0"] }],
    "Remix Icon License 1.0": [{ name: "icons", versions: ["4.9.0"] }],
  });

  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.reviewCategoriesPresent, [
    "FSL-1.1-MIT",
    "LGPL-3.0-or-later",
    "Remix Icon License 1.0",
  ]);
  assert.equal(legalReviewCategories.has("MIT"), false);
  assert.equal(reviewedLicenseCategories.has("MIT"), true);
});

test("the two source-reviewed missing-metadata packages receive exact licenses", () => {
  assert.deepEqual(
    normalizeLicenseInventory({
      Unknown: [
        { name: "evernote", versions: ["2.0.5"] },
        { name: "pause", versions: ["0.0.1"] },
      ],
    }),
    {
      "BSD-2-Clause": [{ name: "evernote", versions: ["2.0.5"] }],
      MIT: [{ name: "pause", versions: ["0.0.1"] }],
    },
  );
  assert.deepEqual(
    evaluateLicenseInventory({
      Unknown: [
        { name: "evernote", versions: ["2.0.5"] },
        { name: "pause", versions: ["0.0.1"] },
      ],
    }).issues,
    [],
  );
  assert.equal(reviewedLicenseMetadataOverrides.get("evernote@2.0.5"), "BSD-2-Clause");
  assert.equal(reviewedLicenseMetadataOverrides.get("pause@0.0.1"), "MIT");

  assert.deepEqual(
    evaluateLicenseInventory({
      Unknown: [{ name: "new-package", versions: ["1.0.0"] }],
    }).issues,
    ["unreviewed missing licence metadata: new-package@1.0.0"],
  );
});

test("new licence categories and empty inventories fail closed", () => {
  assert.deepEqual(
    evaluateLicenseInventory({
      "GPL-3.0-only": [{ name: "unexpected", versions: ["1.0.0"] }],
    }).issues,
    ["unreviewed licence category: GPL-3.0-only"],
  );
  assert.deepEqual(evaluateLicenseInventory({}).issues, [
    "licence inventory contains no production packages",
  ]);
  assert.deepEqual(evaluateLicenseInventory(null).issues, [
    "licence inventory is not a JSON object",
  ]);
});
