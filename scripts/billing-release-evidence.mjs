#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
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

import { validateIOSDistributionEvidence } from "./apple-distribution-evidence.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const RELEASE_ROOT = resolve(DEFAULT_ROOT, "RelayConsoleSwift/Release");
const RESULTS_SCHEMA_PATH = resolve(RELEASE_ROOT, "billing-release-results.schema.json");
const EVIDENCE_SCHEMA_PATH = resolve(RELEASE_ROOT, "billing-release-evidence.schema.json");

export const BILLING_TEST_FILES = [
  "backend/src/modules/cloud-commercial/stripe-billing.service.spec.ts",
  "backend/src/modules/cloud-commercial/apple-billing.service.spec.ts",
  "backend/src/modules/cloud-commercial/billing-observability.service.spec.ts",
  "backend/src/modules/cloud-commercial/entitlement-policy.spec.ts",
  "backend/src/modules/cloud-commercial/entitlement-write.guard.spec.ts",
  "backend/src/modules/cloud-commercial/cloud-commercial.service.spec.ts",
];

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function compileSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const resultsSchema = json(RESULTS_SCHEMA_PATH);
  ajv.addSchema(resultsSchema);
  return {
    results: ajv.getSchema(resultsSchema.$id),
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

export function hashBillingJSON(value) {
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

function resultEvidenceEntries(results) {
  return [
    ["pricing", results?.pricing, results?.pricing?.verifiedAt],
    ["taxAndMerchant", results?.taxAndMerchant, results?.taxAndMerchant?.reviewedAt],
    ...[
      "relayStripe",
      "relayApple",
      "crossProvider",
      "monitoring",
    ].flatMap((section) =>
      Object.entries(results?.[section] ?? {}).map(([id, value]) => [
        `${section}.${id}`,
        value,
        value?.verifiedAt,
      ]),
    ),
  ];
}

export function validateBillingReleaseResults(results) {
  const errors = [];
  if (!validators.results(results)) errors.push(...schemaErrors(validators.results));
  const completedAt = Date.parse(results?.completedAt ?? "");
  if (!Number.isFinite(completedAt)) errors.push("Billing results completedAt must be an ISO timestamp.");
  const evidenceURLs = [];
  for (const [id, entry, timestamp] of resultEvidenceEntries(results)) {
    if (!safeEvidenceURL(entry?.evidenceURL)) {
      errors.push(`${id} needs a non-placeholder HTTPS evidence URL.`);
    } else {
      evidenceURLs.push(entry.evidenceURL);
    }
    if (
      typeof entry?.reviewer !== "string" ||
      !entry.reviewer.trim() ||
      /[<>]/.test(entry.reviewer)
    ) {
      errors.push(`${id} needs a named human reviewer.`);
    }
    const verifiedAt = Date.parse(timestamp ?? "");
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
    errors.push("Each billing decision, journey, and monitoring check needs its own evidence URL or document anchor.");
  }
  return { valid: errors.length === 0, errors };
}

export function billingSourceEvidence(root = DEFAULT_ROOT) {
  const digest = createHash("sha256");
  for (const file of BILLING_TEST_FILES) {
    const path = resolve(root, file);
    if (!existsSync(path)) throw new Error(`Billing source evidence is missing ${file}.`);
    digest.update(file);
    digest.update("\0");
    digest.update(readFileSync(path));
    digest.update("\0");
  }
  return {
    testFileCount: BILLING_TEST_FILES.length,
    sourceEvidenceSHA256: digest.digest("hex"),
    files: [...BILLING_TEST_FILES],
  };
}

function defaultJestRun(root, files) {
  const temp = mkdtempSync(join(tmpdir(), "relay-billing-jest-"));
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
    if (result.status !== 0) throw new Error("The mapped billing Jest run failed.");
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

export function buildRepositoryBillingEvidence({
  root = DEFAULT_ROOT,
  now = () => new Date(),
  runJest = defaultJestRun,
  remoteEvidence,
} = {}) {
  const source = billingSourceEvidence(root);
  const result = runJest(root, source.files);
  if (
    result.success !== true ||
    result.testSuiteCount !== result.passedTestSuiteCount ||
    result.testCount !== result.passedTestCount
  ) {
    throw new Error("The mapped billing Jest result is incomplete or failed.");
  }
  const backendRun = remoteEvidence?.ciRuns?.backend;
  if (!Number.isInteger(backendRun?.runId) || !/^https:\/\/github\.com\//.test(backendRun?.url ?? "")) {
    throw new Error("Validated backend CI evidence is required for billing capture.");
  }
  return {
    executedAt: now().toISOString(),
    status: "passed",
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

export function validateBillingReleaseEvidence(evidence, context) {
  const errors = [];
  if (!validators.evidence(evidence)) errors.push(...schemaErrors(validators.evidence));
  errors.push(...validateBillingReleaseResults(evidence?.results).errors);

  if (evidence?.releaseId !== context.releaseId) errors.push("Billing evidence releaseId differs from the release manifest.");
  if (evidence?.candidate?.sourceCommit !== context.sourceCommit) errors.push("Billing evidence source commit differs from the release manifest.");
  if (context.candidateSHA256 && evidence?.candidate?.manifestSHA256 !== context.candidateSHA256) {
    errors.push("Billing evidence candidate SHA-256 differs from the authorized candidate.");
  }
  if (evidence?.releaseBinding?.sourceBranch !== context.sourceBranch) errors.push("Billing evidence source branch differs from the release manifest.");
  if (evidence?.releaseBinding?.railwayDeploymentId !== context.railwayDeploymentId) errors.push("Billing evidence Railway deployment differs from the release manifest.");
  if (evidence?.releaseBinding?.vercelDeploymentId !== context.vercelDeploymentId) errors.push("Billing evidence Vercel deployment differs from the release manifest.");
  if (evidence?.releaseBinding?.railwayTopologySHA256 !== hashBillingJSON(context.topology)) errors.push("Billing evidence Railway topology SHA-256 differs.");
  if (evidence?.releaseBinding?.railwayConfigurationSHA256 !== hashBillingJSON(context.configuration)) errors.push("Billing evidence Railway configuration SHA-256 differs.");
  if (evidence?.releaseBinding?.remoteEvidenceSHA256 !== hashBillingJSON(context.remoteEvidence)) errors.push("Billing evidence remote evidence SHA-256 differs.");
  if (evidence?.artifacts?.iOSDistributionSHA256 !== hashBillingJSON(context.iOSDistribution)) errors.push("Billing evidence iOS distribution SHA-256 differs.");

  const billing = context.configuration?.configuration?.billing;
  if (
    context.configuration?.status !== "ready" ||
    billing?.provider !== "stripe" ||
    billing?.enabled !== true ||
    billing?.configured !== true ||
    billing?.liveMode !== true
  ) {
    errors.push("Billing evidence requires release-bound live Stripe configuration.");
  }
  const apple = context.configuration?.configuration?.appleBilling;
  if (
    apple?.enabled !== true ||
    apple?.configured !== true ||
    apple?.bundleIdentifierMatches !== true
  ) {
    errors.push("Billing evidence requires release-bound Apple billing configuration.");
  }
  if (
    context.iOSDistribution?.archive?.bundleIdentifier !==
    context.components?.iOS?.bundleIdentifier
  ) {
    errors.push("Billing evidence iOS bundle differs from the release manifest.");
  }

  const backendRun = context.remoteEvidence?.ciRuns?.backend;
  if (
    evidence?.repository?.backendCIRunId !== backendRun?.runId ||
    evidence?.repository?.backendCIRunURL !== backendRun?.url
  ) {
    errors.push("Billing evidence backend CI identity differs from remote evidence.");
  }
  if (evidence?.repository?.testSuiteCount !== evidence?.repository?.passedTestSuiteCount) {
    errors.push("Billing evidence has failed or missing Jest suites.");
  }
  if (evidence?.repository?.testCount !== evidence?.repository?.passedTestCount) {
    errors.push("Billing evidence has failed or missing Jest tests.");
  }
  try {
    const source = billingSourceEvidence(context.repositoryRoot ?? DEFAULT_ROOT);
    if (evidence?.repository?.testFileCount !== source.testFileCount) {
      errors.push("Billing evidence test-file count differs from the release source.");
    }
    if (evidence?.repository?.sourceEvidenceSHA256 !== source.sourceEvidenceSHA256) {
      errors.push("Billing evidence source SHA-256 differs from the release source.");
    }
  } catch (error) {
    errors.push(error.message);
  }

  const capturedAt = Date.parse(evidence?.capturedAt ?? "");
  const completedAt = Date.parse(evidence?.results?.completedAt ?? "");
  const executedAt = Date.parse(evidence?.repository?.executedAt ?? "");
  if (!Number.isFinite(capturedAt)) errors.push("Billing evidence capturedAt must be an ISO timestamp.");
  if (
    !Number.isFinite(completedAt) ||
    (Number.isFinite(capturedAt) && (
      completedAt > capturedAt + 300_000 ||
      capturedAt - completedAt > 604_800_000
    ))
  ) {
    errors.push("Billing journeys must finish within seven days before capture.");
  }
  if (
    !Number.isFinite(executedAt) ||
    (Number.isFinite(capturedAt) && (
      executedAt > capturedAt + 300_000 ||
      capturedAt - executedAt > 86_400_000
    ))
  ) {
    errors.push("Billing repository tests must finish within 24 hours before capture.");
  }
  return { valid: errors.length === 0, errors };
}

function contextFromCandidate(candidate, candidateSHA256, iOSDistribution, repositoryRoot) {
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
    iOSDistribution,
    components: candidate.components,
    repositoryRoot,
  };
}

export function buildBillingReleaseEvidence({
  candidate,
  candidateSHA256,
  iOSDistribution,
  repository,
  results,
  repositoryRoot = DEFAULT_ROOT,
  capturedAt = new Date().toISOString(),
}) {
  const evidence = {
    schemaVersion: "relay.billing-release-evidence.v1",
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
      railwayTopologySHA256: hashBillingJSON(candidate.deployments.railwayTopology),
      railwayConfigurationSHA256: hashBillingJSON(candidate.deployments.railwayConfiguration),
      remoteEvidenceSHA256: hashBillingJSON(candidate.evidence.remote),
    },
    artifacts: {
      iOSDistributionSHA256: hashBillingJSON(iOSDistribution),
    },
    repository,
    results,
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      paymentIdentifiersIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
  const validation = validateBillingReleaseEvidence(
    evidence,
    contextFromCandidate(candidate, candidateSHA256, iOSDistribution, repositoryRoot),
  );
  if (!validation.valid) {
    throw new Error(`Billing release evidence validation failed: ${validation.errors.join(" ")}`);
  }
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

async function capture(options) {
  if (options.capture !== true) throw new Error("Billing evidence capture requires --capture.");
  const candidatePath = requiredPath(options, "candidate");
  const iOSPath = requiredPath(options, "ios-distribution-evidence");
  const resultsPath = requiredPath(options, "results");
  const outputPath = requiredPath(options, "output");
  const candidate = json(candidatePath);
  if (candidate.status !== "candidate") throw new Error("Billing evidence requires a candidate manifest.");
  const { validateReleaseCandidate } = await import("./release-candidate-manifest.mjs");
  const candidateResult = validateReleaseCandidate(candidate, "candidate", {
    repositoryRoot: DEFAULT_ROOT,
  });
  if (!candidateResult.valid) {
    throw new Error(`Candidate validation failed: ${candidateResult.errors.join(" ")}`);
  }
  const candidateSHA256 = fileSHA256(candidatePath);
  const iOSDistribution = json(iOSPath);
  const iOSResult = validateIOSDistributionEvidence(iOSDistribution, {
    releaseId: candidate.releaseId,
    sourceCommit: candidate.source.commit,
    candidateSHA256,
    candidateCreatedAt: candidate.createdAt,
    iOS: candidate.components.iOS,
  });
  if (!iOSResult.valid) {
    throw new Error(`iOS distribution validation failed: ${iOSResult.errors.join(" ")}`);
  }
  const results = json(resultsPath);
  const resultsValidation = validateBillingReleaseResults(results);
  if (!resultsValidation.valid) {
    throw new Error(`Billing results validation failed: ${resultsValidation.errors.join(" ")}`);
  }
  const repository = buildRepositoryBillingEvidence({
    root: DEFAULT_ROOT,
    remoteEvidence: candidate.evidence.remote,
  });
  const evidence = buildBillingReleaseEvidence({
    candidate,
    candidateSHA256,
    iOSDistribution,
    repository,
    results,
    repositoryRoot: DEFAULT_ROOT,
  });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`Billing release evidence written to ${outputPath}.\n`);
}

async function main() {
  try {
    await capture(parseArgs(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) await main();
