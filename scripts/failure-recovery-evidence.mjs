#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  FAILURE_RECOVERY_JOURNEYS,
  verifyFailureRecoveryEvidence,
} from "./failure-recovery-gate.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const SCHEMA_PATH = resolve(
  DEFAULT_ROOT,
  "RelayConsoleSwift/Release/failure-recovery-evidence.schema.json",
);

const EXPECTED_ENVIRONMENTS = {
  railway_unavailable: "staging",
  redis_or_queue_unavailable: "staging",
  database_migration_failure: "staging",
  expired_or_revoked_human_session: "production",
  expired_or_revoked_bridge_credential: "production",
  runtime_incompatible_or_offline: "production",
  oauth_failure_and_recovery: "production",
  duplicate_or_delayed_billing_event: "sandbox",
  client_below_minimum_contract: "production",
  backend_rollback_and_database_restore: "production",
};

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function compileSchema() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(json(SCHEMA_PATH));
}

const schemaValidator = compileSchema();

function formatSchemaErrors() {
  return (schemaValidator.errors ?? []).map((error) => {
    const location = error.instancePath || "$";
    if (error.keyword === "additionalProperties") {
      return `${location}: unsupported field ${error.params.additionalProperty}`;
    }
    return `${location}: ${error.message ?? error.keyword}`;
  });
}

function stableHash(value) {
  const stable = (input) => {
    if (Array.isArray(input)) return input.map(stable);
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.keys(input).sort().map((key) => [key, stable(input[key])]));
    }
    return input;
  };
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function fileSHA256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function failureRecoverySourceEvidence(root = DEFAULT_ROOT) {
  const mapping = verifyFailureRecoveryEvidence({ root });
  if (!mapping.valid) throw new Error(mapping.errors.join(" "));
  const digest = createHash("sha256");
  for (const file of mapping.files) {
    digest.update(file);
    digest.update("\0");
    digest.update(readFileSync(resolve(root, file)));
    digest.update("\0");
  }
  return {
    journeyCount: mapping.journeyCount,
    testFileCount: mapping.files.length,
    sourceEvidenceSHA256: digest.digest("hex"),
    files: mapping.files,
  };
}

function defaultJestRun(root, files) {
  const temp = mkdtempSync(join(tmpdir(), "relay-recovery-jest-"));
  const output = resolve(temp, "result.json");
  try {
    const backendFiles = files.map((path) => path.replace(/^backend\//, ""));
    const result = spawnSync(
      "pnpm",
      [
        "--dir", "backend", "exec", "jest", "--runInBand",
        "--runTestsByPath", ...backendFiles, "--json", "--outputFile", output,
      ],
      { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );
    if (result.status !== 0) throw new Error("The mapped failure-recovery Jest run failed.");
    const report = json(output);
    return {
      success: report.success === true,
      testSuiteCount: report.numTotalTestSuites,
      passedTestSuiteCount: report.numPassedTestSuites,
      testCount: report.numTotalTests,
      passedTestCount: report.numPassedTests,
    };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

export function buildRepositoryRecoveryEvidence({
  root = DEFAULT_ROOT,
  now = () => new Date(),
  runJest = defaultJestRun,
  remoteEvidence,
} = {}) {
  const source = failureRecoverySourceEvidence(root);
  const result = runJest(root, source.files);
  if (
    result.success !== true ||
    result.testSuiteCount !== result.passedTestSuiteCount ||
    result.testCount !== result.passedTestCount
  ) {
    throw new Error("The mapped failure-recovery Jest result is incomplete or failed.");
  }
  const backendRun = remoteEvidence?.ciRuns?.backend;
  if (!Number.isInteger(backendRun?.runId) || !/^https:\/\/github\.com\//.test(backendRun?.url ?? "")) {
    throw new Error("Validated backend CI evidence is required for failure-recovery capture.");
  }
  return {
    executedAt: now().toISOString(),
    status: "passed",
    journeyCount: source.journeyCount,
    testFileCount: source.testFileCount,
    testSuiteCount: result.testSuiteCount,
    passedTestSuiteCount: result.passedTestSuiteCount,
    testCount: result.testCount,
    passedTestCount: result.passedTestCount,
    sourceEvidenceSHA256: source.sourceEvidenceSHA256,
    backendCIRunId: backendRun.runId,
    backendCIRunURL: backendRun.url,
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

export function validateFailureRecoveryEvidence(evidence, context) {
  const errors = [];
  if (!schemaValidator(evidence)) errors.push(...formatSchemaErrors());
  const topology = context.topology;
  const configuration = context.configuration;
  const remoteEvidence = context.remoteEvidence;
  if (evidence?.releaseId !== context.releaseId) errors.push("Failure-recovery releaseId differs from the release manifest.");
  if (evidence?.candidate?.sourceCommit !== context.sourceCommit) errors.push("Failure-recovery source commit differs from the release manifest.");
  if (context.candidateSHA256 && evidence?.candidate?.manifestSHA256 !== context.candidateSHA256) {
    errors.push("Failure-recovery candidate SHA-256 differs from the authorized candidate.");
  }
  if (evidence?.releaseBinding?.sourceBranch !== context.sourceBranch) errors.push("Failure-recovery source branch differs from the release manifest.");
  if (evidence?.releaseBinding?.productionDeploymentId !== topology?.production?.backend?.deployment?.id) errors.push("Failure-recovery production deployment differs from Railway topology.");
  if (evidence?.releaseBinding?.stagingDeploymentId !== topology?.staging?.backend?.deployment?.id) errors.push("Failure-recovery staging deployment differs from Railway topology.");
  if (evidence?.releaseBinding?.railwayTopologySHA256 !== stableHash(topology)) errors.push("Failure-recovery Railway topology SHA-256 differs.");
  if (evidence?.releaseBinding?.railwayConfigurationSHA256 !== stableHash(configuration)) errors.push("Failure-recovery Railway configuration SHA-256 differs.");
  if (evidence?.releaseBinding?.remoteEvidenceSHA256 !== stableHash(remoteEvidence)) errors.push("Failure-recovery remote evidence SHA-256 differs.");

  const backendRun = remoteEvidence?.ciRuns?.backend;
  if (evidence?.repository?.backendCIRunId !== backendRun?.runId || evidence?.repository?.backendCIRunURL !== backendRun?.url) {
    errors.push("Failure-recovery backend CI identity differs from remote evidence.");
  }
  if (evidence?.repository?.testSuiteCount !== evidence?.repository?.passedTestSuiteCount) errors.push("Failure-recovery repository test suites did not all pass.");
  if (evidence?.repository?.testCount !== evidence?.repository?.passedTestCount) errors.push("Failure-recovery repository tests did not all pass.");
  try {
    const source = failureRecoverySourceEvidence(context.repositoryRoot ?? DEFAULT_ROOT);
    if (evidence?.repository?.journeyCount !== source.journeyCount) errors.push("Failure-recovery journey count differs from the source mapping.");
    if (evidence?.repository?.testFileCount !== source.testFileCount) errors.push("Failure-recovery test-file count differs from the source mapping.");
    if (evidence?.repository?.sourceEvidenceSHA256 !== source.sourceEvidenceSHA256) errors.push("Failure-recovery source evidence SHA-256 differs from the checkout.");
  } catch (error) {
    errors.push(`Failure-recovery source mapping failed: ${error.message}`);
  }

  const capturedAt = Date.parse(evidence?.capturedAt ?? "");
  const drillsCompletedAt = Date.parse(evidence?.drillsCompletedAt ?? "");
  const executedAt = Date.parse(evidence?.repository?.executedAt ?? "");
  if (!Number.isFinite(capturedAt)) errors.push("Failure-recovery capturedAt must be an ISO timestamp.");
  if (
    !Number.isFinite(drillsCompletedAt) ||
    (Number.isFinite(capturedAt) && (
      drillsCompletedAt > capturedAt + 300_000 ||
      capturedAt - drillsCompletedAt > 604_800_000
    ))
  ) {
    errors.push("Failure-recovery drills must finish within seven days before capture.");
  }
  if (!Number.isFinite(executedAt) || (Number.isFinite(capturedAt) && (executedAt > capturedAt + 300_000 || capturedAt - executedAt > 86_400_000))) {
    errors.push("Failure-recovery repository tests must run within 24 hours before capture.");
  }

  const productionId = topology?.production?.backend?.deployment?.id;
  const stagingId = topology?.staging?.backend?.deployment?.id;
  for (const { id } of FAILURE_RECOVERY_JOURNEYS) {
    const drill = evidence?.drills?.[id];
    const expectedEnvironment = EXPECTED_ENVIRONMENTS[id];
    if (drill?.environment !== expectedEnvironment) errors.push(`${id} must run in ${expectedEnvironment}.`);
    const expectedDeployment = expectedEnvironment === "staging" ? stagingId : productionId;
    if (drill?.deploymentId !== expectedDeployment) errors.push(`${id} is bound to the wrong deployment.`);
    if (!safeEvidenceURL(drill?.evidenceURL)) errors.push(`${id} needs a non-placeholder HTTPS evidence URL.`);
    if (typeof drill?.reviewer !== "string" || !drill.reviewer.trim() || /[<>]/.test(drill.reviewer)) {
      errors.push(`${id} needs a named human reviewer.`);
    }
    const verifiedAt = Date.parse(drill?.verifiedAt ?? "");
    if (
      !Number.isFinite(verifiedAt) ||
      (Number.isFinite(drillsCompletedAt) && (
        verifiedAt > drillsCompletedAt + 300_000 ||
        drillsCompletedAt - verifiedAt > 604_800_000
      ))
    ) {
      errors.push(`${id} must be verified within seven days before drill completion.`);
    }
  }
  return { valid: errors.length === 0, errors };
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

function exactDrillDocument(document) {
  const allowed = ["schemaVersion", "completedAt", "drills"];
  for (const key of Object.keys(document ?? {})) {
    if (!allowed.includes(key)) throw new Error(`Operational drill document contains unsupported field ${key}.`);
  }
  if (document?.schemaVersion !== "relay.failure-recovery-drills.v1") throw new Error("Operational drill schemaVersion is unsupported.");
  if (!Number.isFinite(Date.parse(document?.completedAt ?? ""))) throw new Error("Operational drill completedAt must be an ISO timestamp.");
  return document;
}

function contextFromCandidate(candidate, candidatePath, repositoryRoot = DEFAULT_ROOT) {
  return {
    releaseId: candidate.releaseId,
    sourceCommit: candidate.source?.commit,
    sourceBranch: candidate.source?.branch,
    candidateSHA256: fileSHA256(candidatePath),
    topology: candidate.deployments?.railwayTopology,
    configuration: candidate.deployments?.railwayConfiguration,
    remoteEvidence: candidate.evidence?.remote,
    repositoryRoot,
  };
}

async function capture(options) {
  const candidatePath = requiredPath(options, "candidate");
  const drillsPath = requiredPath(options, "drills");
  const outputPath = requiredPath(options, "output");
  const candidate = json(candidatePath);
  if (candidate.status !== "candidate") throw new Error("Failure-recovery capture requires a candidate manifest.");
  const { validateReleaseCandidate } = await import("./release-candidate-manifest.mjs");
  const candidateResult = validateReleaseCandidate(candidate, "candidate", { repositoryRoot: DEFAULT_ROOT });
  if (!candidateResult.valid) throw new Error(`Candidate validation failed: ${candidateResult.errors.join(" ")}`);
  const drillDocument = exactDrillDocument(json(drillsPath));
  const repository = buildRepositoryRecoveryEvidence({ remoteEvidence: candidate.evidence.remote });
  const evidence = {
    schemaVersion: "relay.failure-recovery-evidence.v1",
    releaseId: candidate.releaseId,
    capturedAt: new Date().toISOString(),
    drillsCompletedAt: drillDocument.completedAt,
    candidate: {
      sourceCommit: candidate.source.commit,
      manifestSHA256: fileSHA256(candidatePath),
    },
    releaseBinding: {
      sourceBranch: candidate.source.branch,
      productionDeploymentId: candidate.deployments.railwayTopology.production.backend.deployment.id,
      stagingDeploymentId: candidate.deployments.railwayTopology.staging.backend.deployment.id,
      railwayTopologySHA256: stableHash(candidate.deployments.railwayTopology),
      railwayConfigurationSHA256: stableHash(candidate.deployments.railwayConfiguration),
      remoteEvidenceSHA256: stableHash(candidate.evidence.remote),
    },
    repository,
    drills: drillDocument.drills,
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
  const validation = validateFailureRecoveryEvidence(evidence, contextFromCandidate(candidate, candidatePath));
  if (!validation.valid) throw new Error(`Failure-recovery evidence validation failed: ${validation.errors.join(" ")}`);
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${outputPath}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.capture) return capture(options);
  if (options.validate) {
    const candidatePath = requiredPath(options, "candidate");
    const candidate = json(candidatePath);
    if (candidate.status !== "candidate") throw new Error("Failure-recovery validation requires a candidate manifest.");
    const { validateReleaseCandidate } = await import("./release-candidate-manifest.mjs");
    const candidateResult = validateReleaseCandidate(candidate, "candidate", {
      repositoryRoot: DEFAULT_ROOT,
    });
    if (!candidateResult.valid) {
      throw new Error(`Candidate validation failed: ${candidateResult.errors.join(" ")}`);
    }
    const evidence = json(requiredPath(options, "validate"));
    const result = validateFailureRecoveryEvidence(evidence, contextFromCandidate(candidate, candidatePath));
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    if (!result.valid) process.exitCode = 1;
    else process.stdout.write("Failure-recovery evidence valid.\n");
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
