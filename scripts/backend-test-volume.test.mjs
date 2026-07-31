import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBackendTestVolumeReport,
  classifyBackendSpec,
  countTestDeclarations,
} from "./backend-test-volume.mjs";

test("counts direct, focused and table-driven test declarations", () => {
  const source = `
    test("direct", () => {});
    it.skip("skipped", () => {});
    test.each([[1], [2]])("table", () => {});
    describe("not a test", () => {});
  `;
  assert.equal(countTestDeclarations("fixture.spec.ts", source), 3);
});

test("keeps core-risk and Marketplace provider volume in separate buckets", () => {
  const coreRisk = new Set(["modules/auth/auth.service.spec.ts"]);
  assert.equal(
    classifyBackendSpec("modules/auth/auth.service.spec.ts", coreRisk),
    "core-risk",
  );
  assert.equal(
    classifyBackendSpec(
      "modules/marketplace/connectors/github/github.connector.spec.ts",
      coreRisk,
    ),
    "marketplace-provider",
  );
  assert.equal(
    classifyBackendSpec(
      "modules/marketplace/marketplace.service.spec.ts",
      coreRisk,
    ),
    "marketplace-core",
  );
});

test("reports every backend spec and a non-empty core-risk lane", () => {
  const report = buildBackendTestVolumeReport();
  assert.ok(report.total.files > 0);
  assert.ok(report.total.tests > 0);
  assert.ok(report.buckets["core-risk"].files > 0);
  assert.ok(report.buckets["core-risk"].tests > 0);
  assert.ok(report.buckets["marketplace-provider"].tests > 0);
});
