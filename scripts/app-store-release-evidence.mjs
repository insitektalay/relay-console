#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const RELEASE_ROOT = resolve(DEFAULT_ROOT, "RelayConsoleSwift/Release");
const SOURCE_PATHS = {
  metadata: "ios/AppStore/app-store-metadata.en-GB.json",
  privacyDisclosures: "ios/AppStore/app-privacy-disclosures.json",
  privacyManifest: "ios/ClawChat/App/PrivacyInfo.xcprivacy",
  reviewPath: "ios/APP_STORE_REVIEW_PATH.md",
};
const REVIEW_SECTIONS = [
  ["listing", "reviewer", "reviewedAt"],
  ["privacyDisclosures", "reviewer", "reviewedAt"],
  ["reviewPath", "reviewer", "reviewedAt"],
  ["deviceAcceptance", "reviewer", "reviewedAt"],
  ["testFlight.internal", "reviewer", "completedAt"],
  ["testFlight.external", "reviewer", "completedAt"],
  ["appReview", "verifiedBy", "reviewedAt"],
];

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function compileSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const results = json(resolve(RELEASE_ROOT, "app-store-release-results.schema.json"));
  ajv.addSchema(results);
  return {
    results: ajv.getSchema(results.$id),
    evidence: ajv.compile(json(resolve(RELEASE_ROOT, "app-store-release-evidence.schema.json"))),
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

export function hashAppStoreJSON(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function fileSHA256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function atPath(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
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

function nonPlaceholderValue(value) {
  return typeof value === "string" && value.trim().length > 0 &&
    !/[<>]|replace|placeholder/i.test(value);
}

export function appStoreRepositoryEvidence(repositoryRoot = DEFAULT_ROOT) {
  return {
    metadataSHA256: fileSHA256(resolve(repositoryRoot, SOURCE_PATHS.metadata)),
    privacyDisclosuresSHA256: fileSHA256(resolve(repositoryRoot, SOURCE_PATHS.privacyDisclosures)),
    privacyManifestSHA256: fileSHA256(resolve(repositoryRoot, SOURCE_PATHS.privacyManifest)),
    reviewPathSHA256: fileSHA256(resolve(repositoryRoot, SOURCE_PATHS.reviewPath)),
  };
}

function repositoryContractErrors(repositoryRoot) {
  const errors = [];
  const metadata = json(resolve(repositoryRoot, SOURCE_PATHS.metadata));
  const privacy = json(resolve(repositoryRoot, SOURCE_PATHS.privacyDisclosures));
  if (metadata.name !== "Relay Console") errors.push("App Store metadata name differs from Relay Console.");
  if (metadata.locale !== "en-GB") errors.push("App Store metadata locale differs from en-GB.");
  if (metadata.urls?.privacyPolicy !== "https://relayconsole.work/privacy") errors.push("App Store privacy URL differs.");
  if (metadata.urls?.support !== "https://relayconsole.work/support") errors.push("App Store support URL differs.");
  if (metadata.urls?.terms !== "https://relayconsole.work/terms") errors.push("App Store terms URL differs.");
  if (metadata.subscription?.productId !== "com.relayconsole.cloud.monthly") errors.push("App Store subscription product differs.");
  if (metadata.subscription?.usReferencePrice !== "$9.99") errors.push("App Store reference price differs from $9.99.");
  if (privacy.tracking !== false) errors.push("App Store privacy source must declare no tracking.");
  const collectedTypes = new Set((privacy.dataTypes ?? []).map((entry) => entry.type));
  for (const type of [
    "Name",
    "Email Address",
    "Emails or Text Messages",
    "Other User Content",
    "User ID",
    "Purchase History",
    "Product Interaction",
    "Crash Data",
    "Performance Data",
    "Other Diagnostic Data",
  ]) {
    if (!collectedTypes.has(type)) errors.push(`App Store privacy source lacks ${type}.`);
  }
  return errors;
}

export function validateAppStoreReleaseResults(results) {
  const errors = [];
  if (!validators.results(results)) errors.push(...schemaErrors(validators.results));
  const completedAt = Date.parse(results?.completedAt ?? "");
  if (!Number.isFinite(completedAt)) {
    errors.push("App Store results completedAt must be an ISO timestamp.");
  }
  const evidenceURLs = [];
  for (const [path, reviewerField, timeField] of REVIEW_SECTIONS) {
    const section = atPath(results, path);
    if (!namedHuman(section?.[reviewerField])) {
      errors.push(`${path} needs a named human ${reviewerField}.`);
    }
    if (!safeEvidenceURL(section?.evidenceURL)) {
      errors.push(`${path} needs a non-placeholder HTTPS evidence URL.`);
    } else {
      evidenceURLs.push(section.evidenceURL);
    }
    const reviewedAt = Date.parse(section?.[timeField] ?? "");
    if (
      !Number.isFinite(reviewedAt) ||
      (Number.isFinite(completedAt) && (
        reviewedAt > completedAt + 300_000 || completedAt - reviewedAt > 7_776_000_000
      ))
    ) {
      errors.push(`${path} must be completed within 90 days before the results record.`);
    }
  }
  if (new Set(evidenceURLs).size !== evidenceURLs.length) {
    errors.push("Each App Store gate needs its own evidence URL or document anchor.");
  }
  const buildId = results?.app?.buildId;
  if (results?.testFlight?.internal?.testedBuildId !== buildId) {
    errors.push("Internal TestFlight tested a different build.");
  }
  if (results?.testFlight?.external?.testedBuildId !== buildId) {
    errors.push("External TestFlight tested a different build.");
  }
  if (results?.appReview?.submittedBuildId !== buildId) {
    errors.push("App Review used a different build.");
  }
  if (results?.appReview?.resolvedRejectionCount !== results?.appReview?.rejectionCount) {
    errors.push("Every App Review rejection must have a recorded resolution.");
  }
  if (!namedHuman(results?.appReview?.storeState)) {
    errors.push("App Review needs the non-placeholder App Store state.");
  }
  for (const [label, value] of [
    ["App Store app id", results?.app?.appId],
    ["App Store build id", results?.app?.buildId],
    ["App Store version", results?.app?.version],
    ["App Store build number", results?.app?.build],
    ["App Review submission id", results?.appReview?.submissionId],
  ]) {
    if (!nonPlaceholderValue(value)) errors.push(`${label} must not be a placeholder.`);
  }
  return { valid: errors.length === 0, errors };
}

function publicRoute(publicSurfaces, path) {
  return (publicSurfaces?.routes ?? []).find((route) => route.path === path);
}

function appleBillingPassed(billingRelease) {
  const journeys =
    billingRelease?.results?.relayApple ??
    billingRelease?.results?.relayConnectApple ??
    billingRelease?.results?.apple;
  return journeys && Object.keys(journeys).length === 7 &&
    Object.values(journeys).every((journey) => journey?.status === "passed");
}

export function validateAppStoreReleaseEvidence(evidence, context) {
  const errors = [];
  if (!validators.evidence(evidence)) errors.push(...schemaErrors(validators.evidence));
  errors.push(...validateAppStoreReleaseResults(evidence?.results).errors);
  const capturedAt = Date.parse(evidence?.capturedAt ?? "");
  const completedAt = Date.parse(evidence?.results?.completedAt ?? "");
  const completionAge = capturedAt - completedAt;
  if (
    !Number.isFinite(completionAge) || completionAge < -300_000 ||
    completionAge > 86_400_000
  ) {
    errors.push("App Store results must be completed within 24 hours before evidence capture.");
  }

  if (evidence?.releaseId !== context.releaseId) errors.push("App Store evidence releaseId differs from the release manifest.");
  if (evidence?.candidate?.sourceCommit !== context.sourceCommit) errors.push("App Store evidence source commit differs from the release manifest.");
  if (context.candidateSHA256 && evidence?.candidate?.manifestSHA256 !== context.candidateSHA256) {
    errors.push("App Store evidence candidate SHA-256 differs from the authorized candidate.");
  }
  if (evidence?.releaseBinding?.sourceBranch !== context.sourceBranch) errors.push("App Store evidence source branch differs from the release manifest.");
  if (evidence?.releaseBinding?.iOSDistributionSHA256 !== hashAppStoreJSON(context.iOSDistribution)) {
    errors.push("App Store evidence iOS distribution SHA-256 differs.");
  }
  if (evidence?.releaseBinding?.billingReleaseSHA256 !== hashAppStoreJSON(context.billingRelease)) {
    errors.push("App Store evidence billing SHA-256 differs.");
  }
  if (evidence?.releaseBinding?.publicSurfacesSHA256 !== hashAppStoreJSON(context.publicSurfaces)) {
    errors.push("App Store evidence public-surface SHA-256 differs.");
  }

  const distribution = context.iOSDistribution;
  const resultApp = evidence?.results?.app;
  const exactIdentity = [
    [resultApp?.appId, distribution?.appStoreConnect?.appId, "App Store app id"],
    [resultApp?.buildId, distribution?.appStoreConnect?.buildId, "App Store build id"],
    [resultApp?.bundleIdentifier, distribution?.archive?.bundleIdentifier, "App Store bundle identifier"],
    [resultApp?.teamIdentifier, distribution?.signing?.teamIdentifier, "App Store team identifier"],
    [resultApp?.version, distribution?.archive?.appVersion, "App Store version"],
    [resultApp?.build, distribution?.archive?.appBuild, "App Store build number"],
  ];
  for (const [actual, expected, label] of exactIdentity) {
    if (!expected || actual !== expected) errors.push(`${label} differs from the signed processed build.`);
  }
  if (evidence?.results?.appReview?.submittedBuildId !== distribution?.appStoreConnect?.buildId) {
    errors.push("App Review submission differs from the processed App Store Connect build.");
  }
  const uploadedAt = Date.parse(distribution?.appStoreConnect?.uploadedDate ?? "");
  const internalAt = Date.parse(evidence?.results?.testFlight?.internal?.completedAt ?? "");
  const externalAt = Date.parse(evidence?.results?.testFlight?.external?.completedAt ?? "");
  const appReviewAt = Date.parse(evidence?.results?.appReview?.reviewedAt ?? "");
  if (!Number.isFinite(uploadedAt)) {
    errors.push("Processed App Store Connect build needs an upload timestamp.");
  } else {
    for (const [label, value] of [
      ["Listing review", evidence?.results?.listing?.reviewedAt],
      ["Privacy disclosure review", evidence?.results?.privacyDisclosures?.reviewedAt],
      ["Review-path acceptance", evidence?.results?.reviewPath?.reviewedAt],
      ["Device acceptance", evidence?.results?.deviceAcceptance?.reviewedAt],
    ]) {
      const timestamp = Date.parse(value ?? "");
      if (!Number.isFinite(timestamp) || timestamp < uploadedAt - 300_000) {
        errors.push(`${label} must cover the processed build after upload.`);
      }
    }
    if (!Number.isFinite(internalAt) || internalAt < uploadedAt - 300_000) {
      errors.push("Internal TestFlight must complete after the processed build upload.");
    }
    if (!Number.isFinite(externalAt) || externalAt < internalAt) {
      errors.push("External TestFlight must complete after internal TestFlight.");
    }
    if (!Number.isFinite(appReviewAt) || appReviewAt < externalAt) {
      errors.push("App Review approval must follow external TestFlight acceptance.");
    }
  }
  if (!appleBillingPassed(context.billingRelease)) {
    errors.push("All seven Apple sandbox billing journeys must pass before App Store approval evidence can close.");
  }
  for (const [path, expectedURL] of [
    ["/privacy", "https://relayconsole.work/privacy"],
    ["/support", "https://relayconsole.work/support"],
    ["/terms", "https://relayconsole.work/terms"],
  ]) {
    const route = publicRoute(context.publicSurfaces, path);
    if (route?.status !== 200 || route?.finalURL !== expectedURL) {
      errors.push(`App Store ${path} page is not the exact published HTTP 200 route.`);
    }
  }

  const repositoryRoot = context.repositoryRoot ?? DEFAULT_ROOT;
  try {
    const expectedRepository = appStoreRepositoryEvidence(repositoryRoot);
    for (const [key, expected] of Object.entries(expectedRepository)) {
      if (evidence?.repository?.[key] !== expected) {
        errors.push(`App Store repository ${key} differs from the release source.`);
      }
    }
    errors.push(...repositoryContractErrors(repositoryRoot));
  } catch (error) {
    errors.push(`App Store repository evidence could not be read: ${error.message}`);
  }

  return { valid: errors.length === 0, errors };
}

export function buildAppStoreReleaseEvidence({
  candidate,
  candidateSHA256,
  iOSDistribution,
  billingRelease,
  publicSurfaces,
  results,
  repositoryRoot = DEFAULT_ROOT,
  capturedAt = new Date().toISOString(),
}) {
  return {
    schemaVersion: "relay.app-store-release-evidence.v1",
    releaseId: candidate.releaseId,
    capturedAt,
    candidate: {
      sourceCommit: candidate.source.commit,
      manifestSHA256: candidateSHA256,
    },
    releaseBinding: {
      sourceBranch: candidate.source.branch,
      iOSDistributionSHA256: hashAppStoreJSON(iOSDistribution),
      billingReleaseSHA256: hashAppStoreJSON(billingRelease),
      publicSurfacesSHA256: hashAppStoreJSON(publicSurfaces),
    },
    repository: appStoreRepositoryEvidence(repositoryRoot),
    results,
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      reviewAccountIdentifiersIncluded: false,
      customerContentIncluded: false,
      paymentIdentifiersIncluded: false,
      rawScreenshotsIncluded: false,
      rawAppStoreConnectResponseIncluded: false,
    },
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) throw new Error(`Unexpected argument: ${value}`);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`${value} needs a value.`);
    options[value.slice(2)] = next;
    index += 1;
  }
  return options;
}

function requiredPath(options, key) {
  const value = options[key];
  if (!value) throw new Error(`--${key} is required.`);
  return resolve(value);
}

async function capture(options) {
  const candidatePath = requiredPath(options, "candidate");
  const iOSDistributionPath = requiredPath(options, "ios-distribution");
  const billingPath = requiredPath(options, "billing-evidence");
  const publicSurfacesPath = requiredPath(options, "public-surfaces");
  const resultsPath = requiredPath(options, "results");
  const outputPath = requiredPath(options, "output");
  const candidate = json(candidatePath);
  if (candidate.status !== "candidate") throw new Error("App Store evidence requires a candidate manifest.");
  const { validateReleaseCandidate } = await import("./release-candidate-manifest.mjs");
  const candidateResult = validateReleaseCandidate(candidate, "candidate", {
    repositoryRoot: DEFAULT_ROOT,
  });
  if (!candidateResult.valid) {
    throw new Error(`Candidate validation failed: ${candidateResult.errors.join(" ")}`);
  }
  const iOSDistribution = json(iOSDistributionPath);
  const billingRelease = json(billingPath);
  const publicSurfaces = json(publicSurfacesPath);
  const evidence = buildAppStoreReleaseEvidence({
    candidate,
    candidateSHA256: fileSHA256(candidatePath),
    iOSDistribution,
    billingRelease,
    publicSurfaces,
    results: json(resultsPath),
  });
  const validation = validateAppStoreReleaseEvidence(evidence, {
    releaseId: candidate.releaseId,
    sourceCommit: candidate.source.commit,
    sourceBranch: candidate.source.branch,
    candidateSHA256: fileSHA256(candidatePath),
    iOSDistribution,
    billingRelease,
    publicSurfaces,
    repositoryRoot: DEFAULT_ROOT,
  });
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`App Store release evidence written to ${outputPath}.\n`);
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  capture(parseArgs(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
