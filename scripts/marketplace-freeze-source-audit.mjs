#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const POLICY_VERSION = "relay.marketplace-freeze-path-policy.v1";

const AUTOMATIC_PATHS = [
  /^packages\/marketplace-catalog\//,
  /^backend\/src\/modules\/marketplace\//,
  /^RelayConsoleSwift\/Sources\/RelayConsoleCore\/(?:ApplicationsService|Marketplace[^/]*)\.swift$/,
  /^RelayConsoleSwift\/Tests\/RelayConsoleApplicationsBetaTests\//,
  /^ios\/ClawChat\/Features\/Marketplace\//,
  /^ios\/ClawChat\/Infrastructure\/Network\/Marketplace[^/]*\.swift$/,
  /^ios\/MARKETPLACE[^/]*\.md$/,
  /^web\/(?:app|components|lib|security)\/[^/]*marketplace[^/]*(?:\/|$)/i,
  /^web\/components\/marketplace\//,
  /^web\/lib\/marketplace[^/]*\.[^/]+$/,
  /^docs\/marketplace\//,
  /^RelayConsoleSwift\/agent-loops\/agent-loop-marketplace-shared-convergence\//,
];

const REVIEW_REQUIRED_PATHS = [
  /^RelayConsoleSwift\/Sources\/RelayConsoleApp\/(?:AppViewModel|Views)\.swift$/,
  /^packages\/contracts\/src\/index\.ts$/,
  /^backend\/scripts\/generate-[a-z0-9-]+-operation-registry\.py$/,
  /^scripts\/generate-[a-z0-9-]+-registry\.mjs$/,
];

function runGit(repo, args, options = {}) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  }).trim();
}

function gitSucceeds(repo, args) {
  try {
    execFileSync("git", ["-C", repo, ...args], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

export function marketplaceFreezeHash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function namedHuman(value) {
  return typeof value === "string" && value.trim().length > 1 &&
    !/^(?:pending|tbd|none|automation|codex|agent|ai)$/i.test(value.trim()) &&
    !/[<>]/.test(value);
}

function repositorySlug(remote) {
  const value = String(remote ?? "").trim().replace(/\.git$/, "");
  const match = value.match(/(?:github\.com[:/])([^/]+\/[^/]+)$/i);
  if (!match) throw new Error("The source and release repositories need a GitHub origin.");
  return match[1].toLowerCase();
}

function identity(repo) {
  return {
    branch: runGit(repo, ["branch", "--show-current"]),
    revision: runGit(repo, ["rev-parse", "HEAD"]),
    clean: runGit(repo, ["status", "--porcelain", "--untracked-files=all"]) === "",
    repository: repositorySlug(runGit(repo, ["remote", "get-url", "origin"])),
  };
}

export function classifyMarketplaceFreezePath(path) {
  if (AUTOMATIC_PATHS.some((pattern) => pattern.test(path))) return "automatic";
  if (REVIEW_REQUIRED_PATHS.some((pattern) => pattern.test(path))) return "reviewRequired";
  return "prohibited";
}

function changedPaths(repo, baseRevision, sourceRevision) {
  const output = runGit(repo, [
    "diff", "--name-only", "--no-renames", "--diff-filter=ACDMRTUXB",
    `${baseRevision}..${sourceRevision}`,
  ]);
  return output.split(/\r?\n/).filter(Boolean).sort();
}

function providerManifestEvidence(repo, sourceRevision) {
  const output = runGit(repo, [
    "ls-tree", "-r", sourceRevision, "--", "packages/marketplace-catalog/providers",
  ]);
  const manifests = output.split(/\r?\n/).filter((line) =>
    /\tpackages\/marketplace-catalog\/providers\/[^/]+\/manifest\.json$/.test(line)
  ).sort();
  return { count: manifests.length, sha256: marketplaceFreezeHash(manifests) };
}

function pathEvidence(paths) {
  return { count: paths.length, sha256: marketplaceFreezeHash(paths) };
}

function collectRepositoryEvidence({ sourceRepo, sourceRevision, releaseBaseRevision }) {
  for (const [label, revision] of [
    ["source revision", sourceRevision],
    ["release base revision", releaseBaseRevision],
  ]) {
    if (!SHA1.test(revision) || !gitSucceeds(sourceRepo, ["cat-file", "-e", `${revision}^{commit}`])) {
      throw new Error(`The ${label} is not a full reachable Git commit.`);
    }
  }
  const divergenceBaseRevision = runGit(sourceRepo, [
    "merge-base", sourceRevision, releaseBaseRevision,
  ]);
  const paths = changedPaths(sourceRepo, divergenceBaseRevision, sourceRevision);
  const classified = {
    automatic: paths.filter((path) => classifyMarketplaceFreezePath(path) === "automatic"),
    reviewRequired: paths.filter((path) => classifyMarketplaceFreezePath(path) === "reviewRequired"),
    prohibited: paths.filter((path) => classifyMarketplaceFreezePath(path) === "prohibited"),
  };
  return {
    divergenceBaseRevision,
    sourceTreeSHA1: runGit(sourceRepo, ["rev-parse", `${sourceRevision}^{tree}`]),
    changes: {
      total: pathEvidence(paths),
      automatic: pathEvidence(classified.automatic),
      reviewRequired: pathEvidence(classified.reviewRequired),
      prohibited: pathEvidence(classified.prohibited),
    },
    providers: providerManifestEvidence(sourceRepo, sourceRevision),
    prohibitedPaths: classified.prohibited,
  };
}

export function validateMarketplaceFreezeSourceAudit(audit) {
  const errors = [];
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
    return { valid: false, errors: ["Marketplace freeze source audit must be an object."] };
  }
  if (audit.schemaVersion !== "relay.marketplace-freeze-source-audit.v1") errors.push("Marketplace freeze source audit schemaVersion is unsupported.");
  if (audit.policyVersion !== POLICY_VERSION) errors.push("Marketplace freeze source audit path policy is unsupported.");
  if (!Number.isFinite(Date.parse(audit.capturedAt ?? ""))) errors.push("Marketplace freeze source audit capturedAt is invalid.");
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(audit.source?.repository ?? "")) errors.push("Marketplace freeze source repository is invalid.");
  if (!audit.source?.branch || !audit.releaseBase?.branch) errors.push("Marketplace freeze source and release-base branches are required.");
  for (const [label, value] of [
    ["source revision", audit.source?.revision],
    ["source tree", audit.source?.treeSHA1],
    ["release base revision", audit.releaseBase?.revision],
    ["divergence base revision", audit.divergenceBaseRevision],
  ]) if (!SHA1.test(value ?? "")) errors.push(`Marketplace freeze ${label} is invalid.`);
  if (audit.source?.clean !== true || audit.releaseBase?.clean !== true) errors.push("Marketplace freeze capture requires clean source and release-base checkouts.");
  for (const section of ["total", "automatic", "reviewRequired", "prohibited"]) {
    if (!Number.isInteger(audit.changes?.[section]?.count) || audit.changes[section].count < 0) errors.push(`Marketplace freeze ${section} path count is invalid.`);
    if (!SHA256.test(audit.changes?.[section]?.sha256 ?? "")) errors.push(`Marketplace freeze ${section} path digest is invalid.`);
  }
  const classifiedCount = (audit.changes?.automatic?.count ?? 0) +
    (audit.changes?.reviewRequired?.count ?? 0) + (audit.changes?.prohibited?.count ?? 0);
  if (audit.changes?.total?.count !== classifiedCount) errors.push("Marketplace freeze classified path counts do not equal the total.");
  if ((audit.changes?.prohibited?.count ?? 0) !== 0) errors.push("Marketplace freeze contains prohibited cross-product paths.");
  if (!Number.isInteger(audit.providers?.manifestCount) || audit.providers.manifestCount < 1 || !SHA256.test(audit.providers?.manifestSHA256 ?? "")) errors.push("Marketplace freeze provider-manifest evidence is invalid.");
  const needsReview = (audit.changes?.reviewRequired?.count ?? 0) > 0;
  if (needsReview) {
    if (audit.review?.status !== "approved") errors.push("Marketplace freeze cross-surface paths need explicit human approval.");
    if (!namedHuman(audit.review?.reviewer) || !namedHuman(audit.review?.reviewerRole)) errors.push("Marketplace freeze cross-surface approval needs a named human reviewer and role.");
    if (typeof audit.review?.rationale !== "string" || audit.review.rationale.trim().length < 20) errors.push("Marketplace freeze cross-surface approval needs a specific rationale.");
  } else if (audit.review?.status !== "not-required" || audit.review?.reviewer !== null || audit.review?.reviewerRole !== null || audit.review?.rationale !== null) {
    errors.push("Marketplace freeze review must be not-required when there are no cross-surface paths.");
  }
  if (audit.privacy?.localPathsIncluded !== false || audit.privacy?.secretValuesIncluded !== false || audit.privacy?.fileContentsIncluded !== false) errors.push("Marketplace freeze source audit privacy flags must all be false.");
  return { valid: errors.length === 0, errors };
}

export function captureMarketplaceFreezeSourceAudit(options) {
  const sourceRepo = resolve(options.sourceRepo);
  const releaseRepo = resolve(options.releaseRepo);
  const source = identity(sourceRepo);
  const releaseBase = identity(releaseRepo);
  if (!source.clean) throw new Error("The Marketplace source checkout is dirty; commit or remove its work before freeze capture.");
  if (!releaseBase.clean) throw new Error("The release-base checkout is dirty; freeze capture must bind a clean release base.");
  if (source.repository !== releaseBase.repository) throw new Error("Marketplace source and release-base origins differ.");
  const evidence = collectRepositoryEvidence({
    sourceRepo,
    sourceRevision: source.revision,
    releaseBaseRevision: releaseBase.revision,
  });
  if (evidence.prohibitedPaths.length) {
    throw new Error(`Marketplace freeze contains prohibited paths:\n${evidence.prohibitedPaths.join("\n")}`);
  }
  const reviewCount = evidence.changes.reviewRequired.count;
  const approved = options.approveReviewRequired === true;
  const review = reviewCount === 0
    ? { status: "not-required", reviewer: null, reviewerRole: null, rationale: null }
    : {
        status: approved ? "approved" : "pending",
        reviewer: approved ? String(options.reviewer ?? "").trim() : null,
        reviewerRole: approved ? String(options.reviewerRole ?? "").trim() : null,
        rationale: approved ? String(options.rationale ?? "").trim() : null,
      };
  const audit = {
    schemaVersion: "relay.marketplace-freeze-source-audit.v1",
    policyVersion: POLICY_VERSION,
    capturedAt: new Date().toISOString(),
    source: {
      repository: source.repository,
      branch: source.branch,
      revision: source.revision,
      treeSHA1: evidence.sourceTreeSHA1,
      clean: source.clean,
    },
    releaseBase: { branch: releaseBase.branch, revision: releaseBase.revision, clean: releaseBase.clean },
    divergenceBaseRevision: evidence.divergenceBaseRevision,
    changes: evidence.changes,
    providers: {
      manifestCount: evidence.providers.count,
      manifestSHA256: evidence.providers.sha256,
    },
    review,
    privacy: { localPathsIncluded: false, secretValuesIncluded: false, fileContentsIncluded: false },
  };
  const result = validateMarketplaceFreezeSourceAudit(audit);
  if (!result.valid && approved) throw new Error(result.errors.join("\n"));
  return audit;
}

export function verifyMarketplaceFreezeSourceAuditRepository(audit, repositoryRoot, releaseRevision) {
  const errors = [...validateMarketplaceFreezeSourceAudit(audit).errors];
  if (errors.length) return errors;
  try {
    const evidence = collectRepositoryEvidence({
      sourceRepo: repositoryRoot,
      sourceRevision: audit.source.revision,
      releaseBaseRevision: audit.releaseBase.revision,
    });
    if (audit.divergenceBaseRevision !== evidence.divergenceBaseRevision) errors.push("Marketplace freeze divergence base differs from repository history.");
    if (audit.source.treeSHA1 !== evidence.sourceTreeSHA1) errors.push("Marketplace freeze source tree differs from repository history.");
    for (const section of ["total", "automatic", "reviewRequired", "prohibited"]) {
      if (audit.changes[section].count !== evidence.changes[section].count || audit.changes[section].sha256 !== evidence.changes[section].sha256) errors.push(`Marketplace freeze ${section} path evidence differs from repository history.`);
    }
    if (audit.providers.manifestCount !== evidence.providers.count || audit.providers.manifestSHA256 !== evidence.providers.sha256) errors.push("Marketplace freeze provider manifests differ from repository history.");
    for (const [label, revision] of [["source", audit.source.revision], ["release base", audit.releaseBase.revision]]) {
      if (!gitSucceeds(repositoryRoot, ["merge-base", "--is-ancestor", revision, releaseRevision])) errors.push(`Marketplace freeze ${label} revision is not an ancestor of the release commit.`);
    }
  } catch (error) {
    errors.push(`Marketplace freeze repository evidence could not be verified: ${error.message}`);
  }
  return errors;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) throw new Error(`Unexpected argument: ${item}`);
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else { result[key] = next; index += 1; }
  }
  return result;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.capture) throw new Error("Use --capture to create a Marketplace freeze source audit.");
  if (!options["source-repo"] || !options["release-repo"] || !options.output) throw new Error("--source-repo, --release-repo, and --output are required.");
  const audit = captureMarketplaceFreezeSourceAudit({
    sourceRepo: options["source-repo"],
    releaseRepo: options["release-repo"],
    approveReviewRequired: options["approve-review-required"] === true,
    reviewer: options.reviewer,
    reviewerRole: options["reviewer-role"],
    rationale: options.rationale,
  });
  const output = resolve(options.output);
  writeFileSync(output, `${JSON.stringify(audit, null, 2)}\n`);
  const result = validateMarketplaceFreezeSourceAudit(audit);
  if (!result.valid) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Captured approved Marketplace freeze source audit for ${audit.providers.manifestCount} provider manifests and ${audit.changes.total.count} changed paths.`);
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) main();
