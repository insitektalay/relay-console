#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  loadCanonicalMarketplaceReleaseManifest,
  validateMarketplaceReleaseManifest,
} from "./marketplace-release-manifest.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const ACCEPTANCE_ROOT = "packages/marketplace-catalog/release/acceptance";
const SCHEMA_PATH = resolve(
  DEFAULT_ROOT,
  "packages/marketplace-catalog/schema/marketplace-provider-acceptance.schema.json",
);

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function compileSchema() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(json(SCHEMA_PATH));
}

const schemaValidator = compileSchema();

function schemaErrors() {
  return (schemaValidator.errors ?? []).map((error) => {
    const location = error.instancePath || "$";
    if (error.keyword === "additionalProperties") {
      return `${location}: unsupported field ${error.params.additionalProperty}`;
    }
    return `${location}: ${error.message ?? error.keyword}`;
  });
}

function safeURL(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !["example.test", "localhost", "127.0.0.1"].includes(url.hostname) &&
      !value.includes("<") && !value.includes(">");
  } catch {
    return false;
  }
}

function safeRecordPath(root, value) {
  if (typeof value !== "string") return null;
  const expectedRoot = resolve(root, ACCEPTANCE_ROOT);
  const path = resolve(root, value);
  if (!path.startsWith(`${expectedRoot}${sep}`)) return null;
  if (!/^packages\/marketplace-catalog\/release\/acceptance\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(value)) return null;
  return path;
}

export function validateMarketplaceProviderAcceptance(record, context) {
  const errors = [];
  if (!schemaValidator(record)) errors.push(...schemaErrors());
  if (record?.manifestVersion !== context.manifestVersion) errors.push("Provider acceptance manifest version differs.");
  if (record?.providerSlug !== context.providerSlug) errors.push("Provider acceptance slug differs.");
  const capturedAt = Date.parse(record?.capturedAt ?? "");
  const frozenAt = Date.parse(context.frozenAt ?? "");
  if (!Number.isFinite(capturedAt)) errors.push("Provider acceptance capturedAt must be an ISO timestamp.");
  if (
    !Number.isFinite(frozenAt) ||
    !Number.isFinite(capturedAt) ||
    capturedAt > frozenAt + 300_000 ||
    frozenAt - capturedAt > 604_800_000
  ) {
    errors.push("Provider acceptance must be captured within seven days before Marketplace freeze.");
  }

  const docsReviewedAt = Date.parse(`${record?.provider?.officialDocsReviewedAt ?? ""}T00:00:00.000Z`);
  if (
    !Number.isFinite(docsReviewedAt) ||
    (Number.isFinite(capturedAt) && (
      docsReviewedAt > capturedAt + 86_400_000 ||
      capturedAt - docsReviewedAt > 2_678_400_000
    ))
  ) {
    errors.push("Official provider documentation must be reviewed within 31 days before acceptance.");
  }
  if (!safeURL(record?.provider?.officialDocsURL)) errors.push("Provider acceptance needs a non-placeholder official documentation URL.");

  const evidenceURLs = [];
  for (const [id, journey] of Object.entries(record?.journeys ?? {})) {
    if (!safeURL(journey?.evidenceURL)) {
      errors.push(`${id} needs a non-placeholder HTTPS evidence URL.`);
    } else {
      evidenceURLs.push(journey.evidenceURL);
    }
    if (typeof journey?.reviewer !== "string" || !journey.reviewer.trim() || /[<>]/.test(journey.reviewer)) {
      errors.push(`${id} needs a named human reviewer.`);
    }
    const verifiedAt = Date.parse(journey?.verifiedAt ?? "");
    if (
      !Number.isFinite(verifiedAt) ||
      (Number.isFinite(capturedAt) && (
        verifiedAt > capturedAt + 300_000 ||
        capturedAt - verifiedAt > 604_800_000
      ))
    ) {
      errors.push(`${id} must be verified within seven days before acceptance capture.`);
    }
  }
  if (new Set(evidenceURLs).size !== evidenceURLs.length) {
    errors.push("Each provider journey needs its own evidence URL or document anchor.");
  }

  const staging = context.topology?.staging?.backend?.deployment;
  if (context.topology) {
    if (record?.releaseBinding?.stagingDeploymentId !== staging?.id) errors.push("Provider acceptance staging deployment differs from Railway topology.");
    if (record?.releaseBinding?.providerSourceCommit !== staging?.sourceCommit) errors.push("Provider acceptance source commit differs from the staging deployment.");
    if (record?.releaseBinding?.stagingSourceBranch !== staging?.sourceBranch) errors.push("Provider acceptance source branch differs from the staging deployment.");
  }
  return { valid: errors.length === 0, errors };
}

export function validateMarketplaceAcceptanceRepository({
  root = DEFAULT_ROOT,
  releaseManifest,
  topology = null,
} = {}) {
  const errors = [];
  const acceptedSlugs = [];
  const files = [];
  const manifestResult = validateMarketplaceReleaseManifest(releaseManifest);
  if (!manifestResult.valid) {
    return {
      valid: false,
      errors: manifestResult.errors.map((error) => `Release manifest: ${error}`),
      acceptedSlugs,
      files,
      acceptanceSHA256: sha256(""),
    };
  }
  for (const provider of releaseManifest.providers.filter((item) => item.liveVerified)) {
    const reference = provider.acceptance;
    const path = safeRecordPath(root, reference?.recordPath);
    if (!path) {
      errors.push(`${provider.slug}: acceptance record path is missing or unsafe.`);
      continue;
    }
    let bytes;
    let record;
    try {
      bytes = readFileSync(path);
      record = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      errors.push(`${provider.slug}: acceptance record cannot be read (${error.message}).`);
      continue;
    }
    if (sha256(bytes) !== reference.recordSHA256) {
      errors.push(`${provider.slug}: acceptance record SHA-256 differs.`);
      continue;
    }
    const result = validateMarketplaceProviderAcceptance(record, {
      manifestVersion: releaseManifest.manifestVersion,
      providerSlug: provider.slug,
      frozenAt: releaseManifest.freeze.frozenAt,
      topology,
    });
    if (!result.valid) {
      errors.push(...result.errors.map((error) => `${provider.slug}: ${error}`));
      continue;
    }
    acceptedSlugs.push(provider.slug);
    files.push(reference.recordPath);
  }
  const fingerprint = releaseManifest.providers
    .filter((provider) => provider.liveVerified)
    .map((provider) => `${provider.slug}:${provider.acceptance?.recordSHA256 ?? "missing"}`)
    .sort()
    .join("\n");
  return {
    valid: errors.length === 0,
    errors,
    acceptedSlugs: acceptedSlugs.sort(),
    files: files.sort(),
    acceptanceSHA256: sha256(fingerprint),
  };
}

function main() {
  const manifest = loadCanonicalMarketplaceReleaseManifest();
  const result = validateMarketplaceAcceptanceRepository({
    releaseManifest: manifest,
  });
  process.stdout.write(`${JSON.stringify({
    manifestVersion: manifest.manifestVersion,
    liveVerifiedCount: manifest.providers.filter((provider) => provider.liveVerified).length,
    acceptedCount: result.acceptedSlugs.length,
    acceptanceSHA256: result.acceptanceSHA256,
  }, null, 2)}\n`);
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  if (!result.valid) process.exitCode = 1;
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) main();
