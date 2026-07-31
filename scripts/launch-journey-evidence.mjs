#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  validateIOSDistributionEvidence,
  validateMacOSDistributionEvidence,
} from "./apple-distribution-evidence.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const RELEASE_ROOT = resolve(DEFAULT_ROOT, "RelayConsoleSwift/Release");
const RESULT_SCHEMA_PATH = resolve(RELEASE_ROOT, "launch-journey-results.schema.json");
const EVIDENCE_SCHEMA_PATH = resolve(RELEASE_ROOT, "launch-journey-evidence.schema.json");

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function compileSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const resultSchema = json(RESULT_SCHEMA_PATH);
  ajv.addSchema(resultSchema);
  return {
    results: ajv.getSchema(resultSchema.$id),
    evidence: ajv.compile(json(EVIDENCE_SCHEMA_PATH)),
  };
}

const validators = compileSchemas();

function schemaErrors(validator) {
  return (validator.errors ?? []).map((error) => {
    const location = error.instancePath || "$";
    if (error.keyword === "additionalProperties") {
      return `${location}: unsupported field ${error.params.additionalProperty}`;
    }
    return `${location}: ${error.message ?? error.keyword}`;
  });
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

export function hashLaunchJourneyJSON(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function fileSHA256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
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

function journeyEntries(results) {
  return [
    ...Object.entries(results?.relay ?? {}).map(([id, value]) => [`relay.${id}`, value]),
    ...Object.entries(results?.migration ?? {}).map(([id, value]) => [`migration.${id}`, value]),
  ];
}

export function validateLaunchJourneyResults(results) {
  const errors = [];
  if (!validators.results(results)) errors.push(...schemaErrors(validators.results));
  const completedAt = Date.parse(results?.completedAt ?? "");
  if (!Number.isFinite(completedAt)) errors.push("Launch journey completedAt must be an ISO timestamp.");
  const evidenceURLs = [];
  for (const [id, journey] of journeyEntries(results)) {
    if (!safeEvidenceURL(journey?.evidenceURL)) {
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
      (Number.isFinite(completedAt) && (
        verifiedAt > completedAt + 300_000 ||
        completedAt - verifiedAt > 604_800_000
      ))
    ) {
      errors.push(`${id} must be verified within seven days before completion.`);
    }
  }
  if (new Set(evidenceURLs).size !== evidenceURLs.length) {
    errors.push("Each launch journey needs its own evidence URL or document anchor.");
  }
  return { valid: errors.length === 0, errors };
}

export function validateLaunchJourneyEvidence(evidence, context) {
  const errors = [];
  if (!validators.evidence(evidence)) errors.push(...schemaErrors(validators.evidence));
  errors.push(...validateLaunchJourneyResults(evidence?.results).errors);

  if (evidence?.releaseId !== context.releaseId) errors.push("Launch journey releaseId differs from the release manifest.");
  if (evidence?.candidate?.sourceCommit !== context.sourceCommit) errors.push("Launch journey source commit differs from the release manifest.");
  if (context.candidateSHA256 && evidence?.candidate?.manifestSHA256 !== context.candidateSHA256) {
    errors.push("Launch journey candidate SHA-256 differs from the authorized candidate.");
  }
  if (evidence?.releaseBinding?.sourceBranch !== context.sourceBranch) errors.push("Launch journey source branch differs from the release manifest.");
  if (evidence?.releaseBinding?.railwayDeploymentId !== context.railwayDeploymentId) errors.push("Launch journey Railway deployment differs from the release manifest.");
  if (evidence?.releaseBinding?.vercelDeploymentId !== context.vercelDeploymentId) errors.push("Launch journey Vercel deployment differs from the release manifest.");
  if (evidence?.releaseBinding?.railwayTopologySHA256 !== hashLaunchJourneyJSON(context.topology)) errors.push("Launch journey Railway topology SHA-256 differs.");
  if (evidence?.releaseBinding?.railwayConfigurationSHA256 !== hashLaunchJourneyJSON(context.configuration)) errors.push("Launch journey Railway configuration SHA-256 differs.");
  if (evidence?.releaseBinding?.remoteEvidenceSHA256 !== hashLaunchJourneyJSON(context.remoteEvidence)) errors.push("Launch journey remote evidence SHA-256 differs.");
  if (evidence?.artifacts?.macOSDistributionSHA256 !== hashLaunchJourneyJSON(context.macOSDistribution)) errors.push("Launch journey macOS distribution SHA-256 differs.");
  if (evidence?.artifacts?.iOSDistributionSHA256 !== hashLaunchJourneyJSON(context.iOSDistribution)) errors.push("Launch journey iOS distribution SHA-256 differs.");

  const results = evidence?.results;
  if (results?.clientMatrix?.macOS?.appVersion !== context.components?.macOS?.version) errors.push("Launch journey macOS version differs from the release manifest.");
  if (results?.clientMatrix?.macOS?.appBuild !== context.components?.macOS?.build) errors.push("Launch journey macOS build differs from the release manifest.");
  for (const client of ["iPhone", "iPad"]) {
    if (results?.clientMatrix?.[client]?.appVersion !== context.components?.iOS?.version) errors.push(`Launch journey ${client} version differs from the release manifest.`);
    if (results?.clientMatrix?.[client]?.appBuild !== context.components?.iOS?.build) errors.push(`Launch journey ${client} build differs from the release manifest.`);
  }
  if (results?.clientMatrix?.web?.sourceCommit !== context.sourceCommit) errors.push("Launch journey web source commit differs from the release manifest.");
  if (results?.clientMatrix?.web?.deploymentId !== context.vercelDeploymentId) errors.push("Launch journey web deployment differs from the release manifest.");
  if (!(context.connectEligibleSlugs ?? []).includes(results?.marketplace?.providerSlug)) {
    errors.push("Launch journey Marketplace provider is outside the frozen live-verified cohort.");
  }

  const capturedAt = Date.parse(evidence?.capturedAt ?? "");
  const completedAt = Date.parse(results?.completedAt ?? "");
  if (!Number.isFinite(capturedAt)) errors.push("Launch journey capturedAt must be an ISO timestamp.");
  if (
    !Number.isFinite(completedAt) ||
    (Number.isFinite(capturedAt) && (
      completedAt > capturedAt + 300_000 ||
      capturedAt - completedAt > 604_800_000
    ))
  ) {
    errors.push("Launch journeys must finish within seven days before capture.");
  }
  return { valid: errors.length === 0, errors };
}

function contextFromCandidate(candidate, candidateSHA256, macOSDistribution, iOSDistribution) {
  return {
    releaseId: candidate.releaseId,
    sourceCommit: candidate.source?.commit,
    sourceBranch: candidate.source?.branch,
    candidateSHA256,
    railwayDeploymentId: candidate.deployments?.railwayDeploymentId,
    vercelDeploymentId: candidate.deployments?.vercelDeploymentId,
    topology: candidate.deployments?.railwayTopology,
    configuration: candidate.deployments?.railwayConfiguration,
    remoteEvidence: candidate.evidence?.remote,
    macOSDistribution,
    iOSDistribution,
    components: candidate.components,
    connectEligibleSlugs: candidate.catalog?.connectEligibleSlugs,
  };
}

export function buildLaunchJourneyEvidence({
  candidate,
  candidateSHA256,
  macOSDistribution,
  iOSDistribution,
  results,
  capturedAt = new Date().toISOString(),
}) {
  const evidence = {
    schemaVersion: "relay.launch-journey-evidence.v1",
    releaseId: candidate.releaseId,
    capturedAt,
    candidate: {
      sourceCommit: candidate.source.commit,
      manifestSHA256: candidateSHA256,
    },
    releaseBinding: {
      sourceBranch: candidate.source.branch,
      railwayDeploymentId: candidate.deployments.railwayDeploymentId,
      vercelDeploymentId: candidate.deployments.vercelDeploymentId,
      railwayTopologySHA256: hashLaunchJourneyJSON(candidate.deployments.railwayTopology),
      railwayConfigurationSHA256: hashLaunchJourneyJSON(candidate.deployments.railwayConfiguration),
      remoteEvidenceSHA256: hashLaunchJourneyJSON(candidate.evidence.remote),
    },
    artifacts: {
      macOSDistributionSHA256: hashLaunchJourneyJSON(macOSDistribution),
      iOSDistributionSHA256: hashLaunchJourneyJSON(iOSDistribution),
    },
    results,
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      testAccountIdentifiersIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
  const validation = validateLaunchJourneyEvidence(
    evidence,
    contextFromCandidate(candidate, candidateSHA256, macOSDistribution, iOSDistribution),
  );
  if (!validation.valid) throw new Error(`Launch journey evidence validation failed: ${validation.errors.join(" ")}`);
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

async function validatedInputs(options) {
  const candidatePath = requiredPath(options, "candidate");
  const macOSPath = requiredPath(options, "macos-distribution-evidence");
  const iOSPath = requiredPath(options, "ios-distribution-evidence");
  const candidate = json(candidatePath);
  if (candidate.status !== "candidate") throw new Error("Launch journey evidence requires a candidate manifest.");
  const { validateReleaseCandidate } = await import("./release-candidate-manifest.mjs");
  const candidateResult = validateReleaseCandidate(candidate, "candidate", { repositoryRoot: DEFAULT_ROOT });
  if (!candidateResult.valid) throw new Error(`Candidate validation failed: ${candidateResult.errors.join(" ")}`);
  const candidateSHA256 = fileSHA256(candidatePath);
  const macOSDistribution = json(macOSPath);
  const iOSDistribution = json(iOSPath);
  const macOSResult = validateMacOSDistributionEvidence(macOSDistribution, {
    releaseId: candidate.releaseId,
    sourceCommit: candidate.source.commit,
    candidateSHA256,
    candidateCreatedAt: candidate.createdAt,
    macOS: candidate.components.macOS,
  });
  const iOSResult = validateIOSDistributionEvidence(iOSDistribution, {
    releaseId: candidate.releaseId,
    sourceCommit: candidate.source.commit,
    candidateSHA256,
    candidateCreatedAt: candidate.createdAt,
    iOS: candidate.components.iOS,
  });
  if (!macOSResult.valid) throw new Error(`macOS distribution validation failed: ${macOSResult.errors.join(" ")}`);
  if (!iOSResult.valid) throw new Error(`iOS distribution validation failed: ${iOSResult.errors.join(" ")}`);
  return { candidate, candidateSHA256, macOSDistribution, iOSDistribution };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputs = await validatedInputs(options);
  if (options.capture) {
    const evidence = buildLaunchJourneyEvidence({
      ...inputs,
      results: json(requiredPath(options, "results")),
    });
    const outputPath = requiredPath(options, "output");
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${outputPath}\n`);
    return;
  }
  if (options.validate) {
    const evidence = json(requiredPath(options, "validate"));
    const result = validateLaunchJourneyEvidence(
      evidence,
      contextFromCandidate(
        inputs.candidate,
        inputs.candidateSHA256,
        inputs.macOSDistribution,
        inputs.iOSDistribution,
      ),
    );
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    if (!result.valid) process.exitCode = 1;
    else process.stdout.write("Launch journey evidence valid.\n");
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
