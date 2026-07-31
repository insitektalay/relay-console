import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildProductionChecklistEvidence,
  checklistSourceEvidence,
  validateProductionChecklistEvidence,
} from "./production-launch-checklist-evidence.mjs";

const repositoryRoot = resolve(fileURLToPath(import.meta.url), "../..");
const candidateSHA256 = "b".repeat(64);

function candidate() {
  return {
    releaseId: "relay-console-1.0.0-rc1",
    source: {
      branch: "release/relay-console-1.0.0-rc1",
      commit: "a".repeat(40),
    },
  };
}

function fixtureRoot({ itemCount = 256, openItems = 0 } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), "relay-launch-checklist-"));
  const directory = resolve(root, "docs/production-launch-current");
  mkdirSync(directory, { recursive: true });
  const lines = ["# Production launch checklist", ""];
  let item = 0;
  for (let section = 1; section <= 18; section += 1) {
    lines.push(`## ${section}. Section ${section}`, "");
    const remainingSections = 19 - section;
    const target =
      section === 18
        ? itemCount
        : Math.min(
            itemCount,
            Math.floor((itemCount * section) / remainingSections),
          );
    while (item < target) {
      const state = item < openItems ? " " : "x";
      lines.push(
        `- [${state}] Requirement ${String(item + 1).padStart(3, "0")}.`,
      );
      item += 1;
    }
    lines.push("");
  }
  while (item < itemCount) {
    const state = item < openItems ? " " : "x";
    lines.push(
      `- [${state}] Requirement ${String(item + 1).padStart(3, "0")}.`,
    );
    item += 1;
  }
  writeFileSync(
    resolve(directory, "PRODUCTION_LAUNCH_CHECKLIST.md"),
    `${lines.join("\n")}\n`,
  );
  return root;
}

function context(root) {
  const release = candidate();
  return {
    releaseId: release.releaseId,
    sourceBranch: release.source.branch,
    sourceCommit: release.source.commit,
    candidateSHA256,
    repositoryRoot: root,
  };
}

function completeEvidence(root) {
  return buildProductionChecklistEvidence({
    candidate: candidate(),
    candidateSHA256,
    reviewer: "Release checklist reviewer",
    evidenceURL:
      "https://evidence.relayconsole.work/releases/rc1/checklist-review",
    reviewedAt: "2026-07-15T06:00:00.000Z",
    capturedAt: "2026-07-15T06:10:00.000Z",
    repositoryRoot: root,
  });
}

test("accepts all 256 canonical checklist items only when each item is complete", () => {
  const root = fixtureRoot();
  try {
    const source = checklistSourceEvidence(root);
    assert.equal(source.sectionCount, 18);
    assert.equal(source.totalItemCount, 256);
    assert.equal(source.completedItemCount, 256);
    assert.equal(source.openItemCount, 0);
    assert.deepEqual(
      validateProductionChecklistEvidence(
        completeEvidence(root),
        context(root),
      ),
      { valid: true, errors: [] },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reports the current launch-readiness checklist without changing it", () => {
  const source = checklistSourceEvidence(repositoryRoot);
  assert.equal(source.sectionCount, 18);
  assert.equal(source.totalItemCount, 256);
  assert.equal(source.completedItemCount, 163);
  assert.equal(source.openItemCount, 93);
  assert.equal(source.status, "incomplete");
});

test("refuses a shortened checklist and an incomplete checklist", () => {
  const shortened = fixtureRoot({ itemCount: 255 });
  const incomplete = fixtureRoot({ openItems: 1 });
  try {
    assert.throws(
      () => checklistSourceEvidence(shortened),
      /cannot contain fewer than 256 items/,
    );
    assert.throws(() => completeEvidence(incomplete), /still has 1 open items/);
  } finally {
    rmSync(shortened, { recursive: true, force: true });
    rmSync(incomplete, { recursive: true, force: true });
  }
});

test("rejects a substituted candidate or changed checklist hash", () => {
  const root = fixtureRoot();
  try {
    const evidence = completeEvidence(root);
    evidence.candidate.manifestSHA256 = "0".repeat(64);
    evidence.checklist.itemSetSHA256 = "1".repeat(64);
    const result = validateProductionChecklistEvidence(evidence, context(root));
    assert.equal(result.valid, false);
    assert.match(result.errors.join("\n"), /candidate SHA-256 differs/);
    assert.match(result.errors.join("\n"), /itemSetSHA256 differs/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects placeholder review, insecure evidence, and stale review", () => {
  const root = fixtureRoot();
  try {
    const evidence = completeEvidence(root);
    evidence.review.reviewer = "<reviewer>";
    evidence.review.evidenceURL = "https://example.test/evidence";
    evidence.review.reviewedAt = "2026-07-13T00:00:00.000Z";
    const result = validateProductionChecklistEvidence(evidence, context(root));
    assert.equal(result.valid, false);
    assert.match(result.errors.join("\n"), /named human reviewer|pattern/);
    assert.match(
      result.errors.join("\n"),
      /non-placeholder HTTPS evidence URL/,
    );
    assert.match(result.errors.join("\n"), /within 24 hours/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("strict schema rejects unlisted fields and privacy leakage", () => {
  const root = fixtureRoot();
  try {
    const evidence = completeEvidence(root);
    evidence.checklist.waivedItemCount = 1;
    evidence.privacy.customerIdentifiersIncluded = true;
    const result = validateProductionChecklistEvidence(evidence, context(root));
    assert.equal(result.valid, false);
    assert.match(result.errors.join("\n"), /unsupported field waivedItemCount/);
    assert.match(result.errors.join("\n"), /must be equal to constant/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
