#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { validatePublicLaunchSurfaces } from "./public-launch-surface-gate.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const RELEASE_ROOT = resolve(DEFAULT_ROOT, "RelayConsoleSwift/Release");
const REQUIRED_DOCUMENT_PATHS = [
  "/",
  "/acceptable-use",
  "/data-deletion",
  "/privacy",
  "/security",
  "/subprocessors",
  "/support",
  "/terms",
  "/third-party-notices",
];
const APPROVAL_IDS = [
  "legalPolicyReview",
  "acceptableUseApproval",
  "supportApproval",
  "productClaimsApproval",
  "dataHandlingApproval",
  "thirdPartyNoticesApproval",
];

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function compileSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const results = json(resolve(RELEASE_ROOT, "launch-governance-results.schema.json"));
  ajv.addSchema(results);
  return {
    results: ajv.getSchema(results.$id),
    evidence: ajv.compile(json(resolve(RELEASE_ROOT, "launch-governance-evidence.schema.json"))),
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

export function hashGovernanceJSON(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function fileSHA256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function safeEvidenceURL(value) {
  if (typeof value !== "string" || /[<>]|replace|placeholder/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username && !url.password && !url.search &&
      !["example.com", "example.test", "localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function namedHuman(value) {
  return typeof value === "string" && value.trim().length > 1 &&
    !/[<>]|replace|placeholder/i.test(value);
}

export function validateLaunchGovernanceResults(results) {
  const errors = [];
  if (!validators.results(results)) errors.push(...schemaErrors(validators.results));
  const completedAt = Date.parse(results?.completedAt ?? "");
  if (!Number.isFinite(completedAt)) {
    errors.push("Governance results completedAt must be an ISO timestamp.");
  }
  const evidenceURLs = [];
  for (const id of APPROVAL_IDS) {
    const approval = results?.approvals?.[id];
    if (!namedHuman(approval?.reviewer)) errors.push(`${id} needs a named human reviewer.`);
    if (!namedHuman(approval?.reviewerRole)) errors.push(`${id} needs the reviewer's role or qualification.`);
    if (!safeEvidenceURL(approval?.evidenceURL)) {
      errors.push(`${id} needs a non-placeholder HTTPS evidence URL.`);
    } else {
      evidenceURLs.push(approval.evidenceURL);
    }
    const reviewedAt = Date.parse(approval?.reviewedAt ?? "");
    if (
      !Number.isFinite(reviewedAt) ||
      (Number.isFinite(completedAt) && (
        reviewedAt > completedAt + 300_000 || completedAt - reviewedAt > 604_800_000
      ))
    ) {
      errors.push(`${id} must be reviewed within seven days before completion.`);
    }
  }
  if (new Set(evidenceURLs).size !== evidenceURLs.length) {
    errors.push("Each governance approval needs its own evidence URL or document anchor.");
  }
  if (!namedHuman(results?.support?.accountableOwner)) {
    errors.push("Support needs a named accountable owner.");
  }
  return { valid: errors.length === 0, errors };
}

function publicDocumentMap(publicSurfaces) {
  return new Map(
    (publicSurfaces?.routes ?? []).map((route) => [route.path, route.bodySha256]),
  );
}

export function validateLaunchGovernanceEvidence(evidence, context) {
  const errors = [];
  if (!validators.evidence(evidence)) errors.push(...schemaErrors(validators.evidence));
  errors.push(...validateLaunchGovernanceResults(evidence?.results).errors);

  if (evidence?.releaseId !== context.releaseId) errors.push("Governance evidence releaseId differs from the release manifest.");
  if (evidence?.candidate?.sourceCommit !== context.sourceCommit) errors.push("Governance evidence source commit differs from the release manifest.");
  if (context.candidateSHA256 && evidence?.candidate?.manifestSHA256 !== context.candidateSHA256) {
    errors.push("Governance evidence candidate SHA-256 differs from the authorized candidate.");
  }
  if (evidence?.releaseBinding?.sourceBranch !== context.sourceBranch) errors.push("Governance evidence source branch differs from the release manifest.");
  if (evidence?.releaseBinding?.vercelDeploymentId !== context.vercelDeploymentId) errors.push("Governance evidence Vercel deployment differs from the release manifest.");
  if (evidence?.releaseBinding?.publicSurfacesSHA256 !== hashGovernanceJSON(context.publicSurfaces)) {
    errors.push("Governance evidence public-surface SHA-256 differs.");
  }
  if (evidence?.releaseBinding?.billingReleaseSHA256 !== hashGovernanceJSON(context.billingRelease)) {
    errors.push("Governance evidence billing SHA-256 differs.");
  }

  const publicResult = validatePublicLaunchSurfaces(context.publicSurfaces, {
    remoteEvidence: context.remoteEvidence,
  });
  for (const error of publicResult.errors) errors.push(`Public surfaces: ${error}`);

  const documents = evidence?.documents ?? [];
  const documentPaths = documents.map((document) => document.path).sort();
  if (JSON.stringify(documentPaths) !== JSON.stringify(REQUIRED_DOCUMENT_PATHS)) {
    errors.push("Governance evidence must bind the exact product and policy document set.");
  }
  const publicDocuments = publicDocumentMap(context.publicSurfaces);
  for (const document of documents) {
    if (document.bodySHA256 !== publicDocuments.get(document.path)) {
      errors.push(`${document.path} governance hash differs from the deployed public page.`);
    }
  }

  const support = evidence?.results?.support;
  const supportRoute = context.publicSurfaces?.routes?.find((route) => route.path === "/support");
  if (!(context.publicSurfaces?.advertisedAddresses ?? []).includes(support?.address)) {
    errors.push("The approved support address is not published on the release surfaces.");
  }
  if (supportRoute?.supportHoursPublished !== true || supportRoute?.responseTargetPublished !== true) {
    errors.push("The deployed support page lacks the approved hours or response target.");
  }
  const supportDomain = support?.address?.split("@")[1];
  const routedDomain = context.publicSurfaces?.mailDomains?.find((entry) =>
    entry.domain === supportDomain && entry.error === null && entry.exchanges?.length > 0
  );
  if (!routedDomain) errors.push("The approved support address has no verified mail route.");

  const pricing = context.billingRelease?.results?.pricing;
  const productClaims = evidence?.results?.productClaims;
  if (
    pricing?.relay?.monthlyPriceUSD !==
    productClaims?.relayMonthlyPriceUSD
  ) {
    errors.push("Approved Relay price differs from billing evidence.");
  }
  if (
    pricing?.relay?.webPriceTaxDisclosure !==
    productClaims?.relayTaxDisclosure
  ) {
    errors.push("Approved Relay tax wording differs from billing evidence.");
  }
  if (context.billingRelease?.results?.taxAndMerchant?.launchCountriesReviewed !== true) {
    errors.push("Governance evidence requires completed launch-country tax and merchant review.");
  }
  const governanceCountries = [...(evidence?.results?.launchCountries ?? [])].sort();
  const billingCountries = [
    ...(context.billingRelease?.results?.taxAndMerchant?.launchCountries ?? []),
  ].sort();
  if (JSON.stringify(governanceCountries) !== JSON.stringify(billingCountries)) {
    errors.push("Governance launch countries differ from billing tax and merchant review.");
  }

  const capturedAt = Date.parse(evidence?.capturedAt ?? "");
  const completedAt = Date.parse(evidence?.results?.completedAt ?? "");
  if (!Number.isFinite(capturedAt)) errors.push("Governance evidence capturedAt must be an ISO timestamp.");
  if (
    !Number.isFinite(completedAt) ||
    (Number.isFinite(capturedAt) && (
      completedAt > capturedAt + 300_000 || capturedAt - completedAt > 604_800_000
    ))
  ) {
    errors.push("Governance review must finish within seven days before capture.");
  }
  return { valid: errors.length === 0, errors };
}

function contextFromCandidate(candidate, candidateSHA256, publicSurfaces, billingRelease) {
  return {
    releaseId: candidate.releaseId,
    sourceCommit: candidate.source?.commit,
    sourceBranch: candidate.source?.branch,
    candidateSHA256,
    vercelDeploymentId: candidate.deployments?.vercelDeploymentId,
    remoteEvidence: candidate.evidence?.remote,
    publicSurfaces,
    billingRelease,
  };
}

export function buildLaunchGovernanceEvidence({
  candidate,
  candidateSHA256,
  publicSurfaces,
  billingRelease,
  results,
  capturedAt = new Date().toISOString(),
}) {
  const publicDocuments = publicDocumentMap(publicSurfaces);
  const evidence = {
    schemaVersion: "relay.launch-governance-evidence.v1",
    releaseId: candidate.releaseId,
    capturedAt,
    candidate: {
      sourceCommit: candidate.source.commit,
      manifestSHA256: candidateSHA256,
    },
    releaseBinding: {
      sourceBranch: candidate.source.branch,
      vercelDeploymentId: candidate.deployments.vercelDeploymentId,
      publicSurfacesSHA256: hashGovernanceJSON(publicSurfaces),
      billingReleaseSHA256: hashGovernanceJSON(billingRelease),
    },
    documents: REQUIRED_DOCUMENT_PATHS.map((path) => ({
      path,
      bodySHA256: publicDocuments.get(path),
    })),
    results,
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawDocumentBodiesIncluded: false,
      rawReviewMaterialIncluded: false,
    },
  };
  const validation = validateLaunchGovernanceEvidence(
    evidence,
    contextFromCandidate(candidate, candidateSHA256, publicSurfaces, billingRelease),
  );
  if (!validation.valid) {
    throw new Error(`Launch governance validation failed: ${validation.errors.join(" ")}`);
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
  if (options.capture !== true) throw new Error("Governance evidence capture requires --capture.");
  const candidatePath = requiredPath(options, "candidate");
  const publicSurfacesPath = requiredPath(options, "public-surfaces");
  const billingPath = requiredPath(options, "billing-evidence");
  const resultsPath = requiredPath(options, "results");
  const outputPath = requiredPath(options, "output");
  const candidate = json(candidatePath);
  if (candidate.status !== "candidate") throw new Error("Governance evidence requires a candidate manifest.");
  const { validateReleaseCandidate } = await import("./release-candidate-manifest.mjs");
  const candidateResult = validateReleaseCandidate(candidate, "candidate", {
    repositoryRoot: DEFAULT_ROOT,
  });
  if (!candidateResult.valid) {
    throw new Error(`Candidate validation failed: ${candidateResult.errors.join(" ")}`);
  }
  const evidence = buildLaunchGovernanceEvidence({
    candidate,
    candidateSHA256: fileSHA256(candidatePath),
    publicSurfaces: json(publicSurfacesPath),
    billingRelease: json(billingPath),
    results: json(resultsPath),
  });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`Launch governance evidence written to ${outputPath}.\n`);
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  capture(parseArgs(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
