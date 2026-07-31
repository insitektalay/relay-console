import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const backendPackage = require("../backend/package.json");
const lintConfig = require("../backend/.eslintrc.cjs");

test("backend lint checks do not rewrite source", () => {
  assert.ok(backendPackage.scripts.lint);
  assert.doesNotMatch(backendPackage.scripts.lint, /--fix(?:\s|$)/);
  assert.match(backendPackage.scripts["lint:fix"], /--fix(?:\s|$)/);
});

test("backend correctness lint catches duplicate and unreachable flow", () => {
  assert.equal(lintConfig.rules["no-dupe-else-if"], "error");
  assert.equal(lintConfig.rules["no-duplicate-case"], "error");
  assert.equal(lintConfig.rules["no-unreachable"], "error");
  assert.equal(lintConfig.rules["no-unreachable-loop"], "error");
});
