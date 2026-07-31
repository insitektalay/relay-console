#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const CHECKLIST_PATH =
  "docs/production-launch-current/PRODUCTION_LAUNCH_CHECKLIST.md";
const MINIMUM_ITEM_COUNT = 256;
const EXPECTED_SECTION_COUNT = 18;
const SCHEMA_PATH = resolve(
  DEFAULT_ROOT,
  "RelayConsoleSwift/Release/production-launch-checklist-evidence.schema.json",
);

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fileSHA256(path) {
  return sha256(readFileSync(path));
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

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseChecklist(source) {
  const sections = [];
  const items = [];
  let currentItem = null;
  for (const line of source.split(/\r?\n/)) {
    const section = line.match(/^## (\d+)\. (.+)$/);
    if (section) {
      sections.push({ number: Number(section[1]), title: normalizeText(section[2]) });
      currentItem = null;
      continue;
    }
    const item = line.match(/^- \[([x ])\] (.+)$/);
    if (item) {
      currentItem = { completed: item[1] === "x", text: item[2] };
      items.push(currentItem);
      continue;
    }
    if (currentItem && /^  \S/.test(line)) {
      currentItem.text += ` ${line.trim()}`;
      continue;
    }
    currentItem = null;
  }
  for (const item of items) item.text = normalizeText(item.text);
  return { sections, items };
}

export function checklistSourceEvidence(root = DEFAULT_ROOT) {
  const path = resolve(root, CHECKLIST_PATH);
  const source = readFileSync(path, "utf8");
  const { sections, items } = parseChecklist(source);
  const errors = [];
  if (sections.length !== EXPECTED_SECTION_COUNT) {
    errors.push(`The production checklist must contain ${EXPECTED_SECTION_COUNT} numbered sections.`);
  }
  if (!sections.every((section, index) => section.number === index + 1)) {
    errors.push("The production checklist section numbers must run from 1 through 18 in order.");
  }
  if (items.length < MINIMUM_ITEM_COUNT) {
    errors.push(`The production checklist cannot contain fewer than ${MINIMUM_ITEM_COUNT} items.`);
  }
  if (new Set(items.map((item) => item.text)).size !== items.length) {
    errors.push("The production checklist contains duplicate item text.");
  }
  if (errors.length) throw new Error(errors.join(" "));
  const completedItemCount = items.filter((item) => item.completed).length;
  const openItemCount = items.length - completedItemCount;
  return {
    path: CHECKLIST_PATH,
    status: openItemCount === 0 ? "complete" : "incomplete",
    fileSHA256: sha256(source),
    itemSetSHA256: sha256(items.map((item) => item.text).join("\n")),
    sectionSetSHA256: sha256(sections.map((section) => `${section.number}. ${section.title}`).join("\n")),
    sectionCount: sections.length,
    totalItemCount: items.length,
    completedItemCount,
    openItemCount,
  };
}

function safeEvidenceURL(value) {
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

export function validateProductionChecklistEvidence(evidence, context) {
  const errors = [];
  if (!schemaValidator(evidence)) errors.push(...schemaErrors());
  if (evidence?.releaseId !== context.releaseId) errors.push("Checklist releaseId differs from the release manifest.");
  if (evidence?.candidate?.sourceBranch !== context.sourceBranch) errors.push("Checklist source branch differs from the release manifest.");
  if (evidence?.candidate?.sourceCommit !== context.sourceCommit) errors.push("Checklist source commit differs from the release manifest.");
  if (context.candidateSHA256 && evidence?.candidate?.manifestSHA256 !== context.candidateSHA256) {
    errors.push("Checklist candidate SHA-256 differs from the authorized candidate.");
  }
  if (
    evidence?.checklist?.openItemCount !== 0 ||
    evidence?.checklist?.completedItemCount !== evidence?.checklist?.totalItemCount
  ) {
    errors.push("The production checklist evidence is not complete.");
  }
  if (context.repositoryRoot) {
    try {
      const current = checklistSourceEvidence(context.repositoryRoot);
      for (const field of [
        "path", "status", "fileSHA256", "itemSetSHA256", "sectionSetSHA256",
        "sectionCount", "totalItemCount", "completedItemCount", "openItemCount",
      ]) {
        if (evidence?.checklist?.[field] !== current[field]) {
          errors.push(`Checklist ${field} differs from the candidate checkout.`);
        }
      }
      if (current.openItemCount !== 0 || current.completedItemCount !== current.totalItemCount) {
        errors.push(`The production checklist still has ${current.openItemCount} open items.`);
      }
    } catch (error) {
      errors.push(`Production checklist validation failed: ${error.message}`);
    }
  }
  if (typeof evidence?.review?.reviewer !== "string" || !evidence.review.reviewer.trim() || /[<>]/.test(evidence.review.reviewer)) {
    errors.push("Checklist completion needs a named human reviewer.");
  }
  if (!safeEvidenceURL(evidence?.review?.evidenceURL)) {
    errors.push("Checklist completion needs a non-placeholder HTTPS evidence URL.");
  }
  const capturedAt = Date.parse(evidence?.capturedAt ?? "");
  const reviewedAt = Date.parse(evidence?.review?.reviewedAt ?? "");
  if (!Number.isFinite(capturedAt)) errors.push("Checklist capturedAt must be an ISO timestamp.");
  if (
    !Number.isFinite(reviewedAt) ||
    (Number.isFinite(capturedAt) && (
      reviewedAt > capturedAt + 300_000 ||
      capturedAt - reviewedAt > 86_400_000
    ))
  ) {
    errors.push("A human must review checklist completion within 24 hours before capture.");
  }
  return { valid: errors.length === 0, errors };
}

export function buildProductionChecklistEvidence({
  candidate,
  candidateSHA256,
  reviewer,
  evidenceURL,
  reviewedAt,
  capturedAt = new Date().toISOString(),
  repositoryRoot = DEFAULT_ROOT,
}) {
  const checklist = checklistSourceEvidence(repositoryRoot);
  if (checklist.openItemCount !== 0) {
    throw new Error(`The production checklist still has ${checklist.openItemCount} open items.`);
  }
  const evidence = {
    schemaVersion: "relay.production-launch-checklist-evidence.v3",
    releaseId: candidate.releaseId,
    capturedAt,
    candidate: {
      sourceBranch: candidate.source.branch,
      sourceCommit: candidate.source.commit,
      manifestSHA256: candidateSHA256,
    },
    checklist,
    review: { reviewedAt, reviewer, evidenceURL },
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
  const result = validateProductionChecklistEvidence(evidence, {
    releaseId: candidate.releaseId,
    sourceBranch: candidate.source.branch,
    sourceCommit: candidate.source.commit,
    candidateSHA256,
    repositoryRoot,
  });
  if (!result.valid) throw new Error(`Checklist evidence validation failed: ${result.errors.join(" ")}`);
  return evidence;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function requiredPath(options, name) {
  const value = options[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`--${name} is required.`);
  return resolve(value);
}

function requiredValue(options, name) {
  const value = options[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`--${name} is required.`);
  return value.trim();
}

function contextFromCandidate(candidate, candidatePath) {
  return {
    releaseId: candidate.releaseId,
    sourceBranch: candidate.source?.branch,
    sourceCommit: candidate.source?.commit,
    candidateSHA256: fileSHA256(candidatePath),
    repositoryRoot: DEFAULT_ROOT,
  };
}

async function validatedCandidate(options) {
  const candidatePath = requiredPath(options, "candidate");
  const candidate = json(candidatePath);
  if (candidate.status !== "candidate") throw new Error("Checklist evidence requires a candidate manifest.");
  const { validateReleaseCandidate } = await import("./release-candidate-manifest.mjs");
  const result = validateReleaseCandidate(candidate, "candidate", { repositoryRoot: DEFAULT_ROOT });
  if (!result.valid) throw new Error(`Candidate validation failed: ${result.errors.join(" ")}`);
  return { candidatePath, candidate };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { candidatePath, candidate } = await validatedCandidate(options);
  if (options.capture) {
    const evidence = buildProductionChecklistEvidence({
      candidate,
      candidateSHA256: fileSHA256(candidatePath),
      reviewer: requiredValue(options, "reviewer"),
      evidenceURL: requiredValue(options, "evidence-url"),
      reviewedAt: requiredValue(options, "reviewed-at"),
    });
    const outputPath = requiredPath(options, "output");
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${outputPath}\n`);
    return;
  }
  if (options.validate) {
    const result = validateProductionChecklistEvidence(
      json(requiredPath(options, "validate")),
      contextFromCandidate(candidate, candidatePath),
    );
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    if (!result.valid) process.exitCode = 1;
    else process.stdout.write("Production checklist evidence valid.\n");
    return;
  }
  throw new Error("Use --capture or --validate.");
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
