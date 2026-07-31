import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";

import {
  captureMarketplaceFreezeSourceAudit,
  classifyMarketplaceFreezePath,
  validateMarketplaceFreezeSourceAudit,
  verifyMarketplaceFreezeSourceAuditRepository,
} from "./marketplace-freeze-source-audit.mjs";

const temporaryRoots = [];

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
}

function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function commitAll(repo, message) {
  git(repo, "add", ".");
  git(repo, "commit", "-m", message);
  return git(repo, "rev-parse", "HEAD");
}

function repository({ path = "backend/src/modules/marketplace/example.ts" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "relay-marketplace-freeze-"));
  temporaryRoots.push(root);
  git(root, "init", "-b", "main");
  git(root, "config", "user.email", "release.test@relayconsole.work");
  git(root, "config", "user.name", "Relay Release Test");
  git(root, "remote", "add", "origin", "https://github.com/insitektalay/relay-console.git");
  write(root, "packages/marketplace-catalog/providers/example/manifest.json", "{\"slug\":\"example\"}\n");
  write(root, "README.md", "base\n");
  const divergenceBase = commitAll(root, "base");
  git(root, "branch", "marketplace", divergenceBase);
  write(root, "release.txt", "launch readiness\n");
  const releaseBase = commitAll(root, "release base");
  const source = `${root}-marketplace-worktree`;
  temporaryRoots.push(source);
  git(root, "worktree", "add", source, "marketplace");
  write(source, path, "marketplace change\n");
  const sourceRevision = commitAll(source, "marketplace change");
  return { root, source, divergenceBase, releaseBase, sourceRevision };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("classifies Marketplace-owned, cross-surface, and prohibited paths", () => {
  assert.equal(classifyMarketplaceFreezePath("packages/marketplace-catalog/providers/github/manifest.json"), "automatic");
  assert.equal(classifyMarketplaceFreezePath("web/components/marketplace/marketplace-screen.tsx"), "automatic");
  assert.equal(classifyMarketplaceFreezePath("packages/contracts/src/index.ts"), "reviewRequired");
  assert.equal(classifyMarketplaceFreezePath("backend/src/modules/auth/auth.service.ts"), "prohibited");
});

test("captures a clean Marketplace-only source without human cross-surface approval", () => {
  const fixture = repository();
  const audit = captureMarketplaceFreezeSourceAudit({
    sourceRepo: fixture.source,
    releaseRepo: fixture.root,
  });
  assert.equal(audit.source.revision, fixture.sourceRevision);
  assert.equal(audit.releaseBase.revision, fixture.releaseBase);
  assert.equal(audit.divergenceBaseRevision, fixture.divergenceBase);
  assert.equal(audit.changes.prohibited.count, 0);
  assert.equal(audit.changes.reviewRequired.count, 0);
  assert.equal(audit.review.status, "not-required");
  assert.deepEqual(validateMarketplaceFreezeSourceAudit(audit), { valid: true, errors: [] });
});

test("requires named human approval for a known cross-surface Marketplace path", () => {
  const fixture = repository({ path: "packages/contracts/src/index.ts" });
  const pending = captureMarketplaceFreezeSourceAudit({
    sourceRepo: fixture.source,
    releaseRepo: fixture.root,
  });
  assert.equal(pending.review.status, "pending");
  assert.match(validateMarketplaceFreezeSourceAudit(pending).errors.join("\n"), /explicit human approval/);

  const approved = captureMarketplaceFreezeSourceAudit({
    sourceRepo: fixture.source,
    releaseRepo: fixture.root,
    approveReviewRequired: true,
    reviewer: "Alex Kerss",
    reviewerRole: "Release owner",
    rationale: "Reviewed the shared Marketplace contract additions for the selected catalog batch.",
  });
  assert.deepEqual(validateMarketplaceFreezeSourceAudit(approved), { valid: true, errors: [] });
});

test("refuses source changes outside the bounded Marketplace import surface", () => {
  const fixture = repository({ path: "backend/src/modules/auth/auth.service.ts" });
  assert.throws(
    () => captureMarketplaceFreezeSourceAudit({ sourceRepo: fixture.source, releaseRepo: fixture.root }),
    /prohibited paths[\s\S]*auth\.service\.ts/,
  );
});

test("refuses a dirty Marketplace source checkout", () => {
  const fixture = repository();
  write(fixture.source, "uncommitted.txt", "still running\n");
  assert.throws(
    () => captureMarketplaceFreezeSourceAudit({ sourceRepo: fixture.source, releaseRepo: fixture.root }),
    /source checkout is dirty/,
  );
});

test("recomputes the selected source history and requires both parents in the release", () => {
  const fixture = repository();
  const audit = captureMarketplaceFreezeSourceAudit({ sourceRepo: fixture.source, releaseRepo: fixture.root });
  assert.match(
    verifyMarketplaceFreezeSourceAuditRepository(audit, fixture.root, fixture.releaseBase).join("\n"),
    /source revision is not an ancestor/,
  );
  git(fixture.root, "merge", "--no-ff", "marketplace", "-m", "merge marketplace freeze");
  const releaseRevision = git(fixture.root, "rev-parse", "HEAD");
  assert.deepEqual(verifyMarketplaceFreezeSourceAuditRepository(audit, fixture.root, releaseRevision), []);

  const tampered = structuredClone(audit);
  tampered.changes.total.sha256 = "f".repeat(64);
  assert.match(
    verifyMarketplaceFreezeSourceAuditRepository(tampered, fixture.root, releaseRevision).join("\n"),
    /total path evidence differs/,
  );
});
