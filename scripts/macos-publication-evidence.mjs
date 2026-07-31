#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { validatePublicLaunchSurfaces } from "./public-launch-surface-gate.mjs";
import { validateMacOSDistributionEvidence } from "./apple-distribution-evidence.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const RELEASE_ROOT = resolve(DEFAULT_ROOT, "RelayConsoleSwift/Release");
export const UPDATE_MANIFEST_URL = "https://relayconsole.work/updates/public-beta.json";
const PAGE_PATHS = ["/download", "/release-notes", "/support", "/updates"];
const REVIEW_SECTIONS = ["publicationReview", "cleanMachine", "lifecycle", "policy"];

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function compileSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const updateManifest = json(resolve(RELEASE_ROOT, "macos-update-manifest.schema.json"));
  const results = json(resolve(RELEASE_ROOT, "macos-publication-results.schema.json"));
  ajv.addSchema(json(resolve(RELEASE_ROOT, "macos-distribution-evidence.schema.json")));
  ajv.addSchema(updateManifest);
  ajv.addSchema(results);
  return {
    updateManifest: ajv.getSchema(updateManifest.$id),
    results: ajv.getSchema(results.$id),
    evidence: ajv.compile(json(resolve(RELEASE_ROOT, "macos-publication-evidence.schema.json"))),
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

export function hashMacOSPublicationJSON(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function fileSHA256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function safeEvidenceURL(value) {
  if (typeof value !== "string" || /[<>]|replace|placeholder/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.search && !["example.com", "example.test", "localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function safePublicURL(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "relayconsole.work" &&
      !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function namedHuman(value) {
  return typeof value === "string" && value.trim().length > 1 &&
    !/[<>]|replace|placeholder/i.test(value);
}

export function validateMacOSPublicationResults(results) {
  const errors = [];
  if (!validators.results(results)) errors.push(...schemaErrors(validators.results));
  const completedAt = Date.parse(results?.completedAt ?? "");
  if (!Number.isFinite(completedAt)) errors.push("macOS publication results completedAt must be an ISO timestamp.");
  const evidenceURLs = [];
  for (const sectionName of REVIEW_SECTIONS) {
    const section = results?.[sectionName];
    if (!namedHuman(section?.reviewer)) errors.push(`${sectionName} needs a named human reviewer.`);
    if (!safeEvidenceURL(section?.evidenceURL)) {
      errors.push(`${sectionName} needs a non-placeholder HTTPS evidence URL.`);
    } else {
      evidenceURLs.push(section.evidenceURL);
    }
    const reviewedAt = Date.parse(section?.reviewedAt ?? "");
    if (
      !Number.isFinite(reviewedAt) ||
      (Number.isFinite(completedAt) && (
        reviewedAt > completedAt + 300_000 || completedAt - reviewedAt > 7_776_000_000
      ))
    ) {
      errors.push(`${sectionName} must be reviewed within 90 days before completion.`);
    }
  }
  if (new Set(evidenceURLs).size !== evidenceURLs.length) {
    errors.push("Each macOS publication review needs its own evidence URL or document anchor.");
  }
  return { valid: errors.length === 0, errors };
}

function pageMap(publicSurfaces) {
  return new Map((publicSurfaces?.routes ?? []).map((route) => [route.path, route]));
}

function artifactErrors(actual, expected, label) {
  const errors = [];
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (actual?.[field] !== expectedValue) errors.push(`${label} ${field} differs.`);
  }
  return errors;
}

function validateNetworkRecord(record, artifact, label) {
  const errors = [];
  if (!safePublicURL(record?.url) || record?.finalURL !== record?.url) {
    errors.push(`${label} must use one exact credential-free relayconsole.work URL.`);
  }
  if (record?.sha256 !== artifact?.sha256) errors.push(`${label} SHA-256 differs from the update manifest.`);
  if (record?.sizeBytes !== artifact?.sizeBytes) errors.push(`${label} size differs from the update manifest.`);
  try {
    if (!new URL(record?.url).pathname.endsWith(`/${artifact?.fileName}`)) {
      errors.push(`${label} URL does not end with the artifact file name.`);
    }
  } catch {
    errors.push(`${label} URL is invalid.`);
  }
  return errors;
}

function validateChecksumRecord(record, artifact, label) {
  const errors = [];
  if (!safePublicURL(record?.url) || record?.finalURL !== record?.url) {
    errors.push(`${label} must use one exact credential-free relayconsole.work URL.`);
  }
  if (record?.url !== artifact?.checksumURL) errors.push(`${label} URL differs from the update manifest.`);
  if (record?.advertisedSHA256 !== artifact?.sha256) errors.push(`${label} advertised SHA-256 differs.`);
  if (record?.advertisedFileName !== artifact?.fileName) errors.push(`${label} advertised file name differs.`);
  return errors;
}

export function validateMacOSPublicationEvidence(evidence, context) {
  const errors = [];
  if (!validators.evidence(evidence)) errors.push(...schemaErrors(validators.evidence));
  errors.push(...validateMacOSPublicationResults(evidence?.results).errors);
  const capturedAt = Date.parse(evidence?.capturedAt ?? "");
  const completedAt = Date.parse(evidence?.results?.completedAt ?? "");
  const completionAge = capturedAt - completedAt;
  if (!Number.isFinite(completionAge) || completionAge < -300_000 || completionAge > 86_400_000) {
    errors.push("macOS publication results must be completed within 24 hours before evidence capture.");
  }

  if (evidence?.releaseId !== context.releaseId) errors.push("macOS publication releaseId differs from the release manifest.");
  if (evidence?.candidate?.sourceCommit !== context.sourceCommit) errors.push("macOS publication source commit differs from the release manifest.");
  if (context.candidateSHA256 && evidence?.candidate?.manifestSHA256 !== context.candidateSHA256) {
    errors.push("macOS publication candidate SHA-256 differs from the authorized candidate.");
  }
  if (evidence?.releaseBinding?.sourceBranch !== context.sourceBranch) errors.push("macOS publication source branch differs.");
  if (evidence?.releaseBinding?.vercelDeploymentId !== context.vercelDeploymentId) errors.push("macOS publication Vercel deployment differs.");
  if (evidence?.releaseBinding?.macOSDistributionSHA256 !== hashMacOSPublicationJSON(context.macOSDistribution)) {
    errors.push("macOS publication distribution SHA-256 differs.");
  }
  if (evidence?.releaseBinding?.publicSurfacesSHA256 !== hashMacOSPublicationJSON(context.publicSurfaces)) {
    errors.push("macOS publication public-surface SHA-256 differs.");
  }

  if (context.remoteEvidence) {
    for (const error of validatePublicLaunchSurfaces(context.publicSurfaces, {
      remoteEvidence: context.remoteEvidence,
    }).errors) {
      errors.push(`Public surfaces: ${error}`);
    }
  }
  const routes = pageMap(context.publicSurfaces);
  const pageRecords = new Map((evidence?.pages ?? []).map((page) => [page.path, page.bodySHA256]));
  for (const path of PAGE_PATHS) {
    const route = routes.get(path);
    if (route?.status !== 200 || route?.finalURL !== `https://relayconsole.work${path}`) {
      errors.push(`macOS publication ${path} page is not the exact published HTTP 200 route.`);
    }
    if (pageRecords.get(path) !== route?.bodySha256) errors.push(`macOS publication ${path} page hash differs.`);
  }

  const document = evidence?.updateManifest?.document;
  if (!validators.updateManifest(document)) errors.push(...schemaErrors(validators.updateManifest));
  const distribution = context.macOSDistribution?.artifact;
  errors.push(...artifactErrors(document?.current, {
    version: distribution?.appVersion,
    build: distribution?.appBuild,
    fileName: distribution?.fileName,
    sha256: distribution?.dmgSHA256,
    sizeBytes: distribution?.dmgSizeBytes,
  }, "Current update artifact"));
  if (
    document?.current?.distributionEvidenceSHA256 !==
    hashMacOSPublicationJSON(context.macOSDistribution)
  ) {
    errors.push(
      "Current macOS distribution SHA-256 differs from the update manifest.",
    );
  }
  if (
    JSON.stringify([...(document?.current?.architectures ?? [])].sort()) !==
    JSON.stringify([...(distribution?.architectures ?? [])].sort())
  ) {
    errors.push("Current update artifact architectures differ.");
  }
  if (
    document?.current?.signatureMode !==
      "developer-id-hardened-runtime" ||
    document?.current?.notarizationStatus !== "accepted-stapled"
  ) {
    errors.push(
      "Current update artifact is not Developer ID signed, notarized, and stapled.",
    );
  }
  if (evidence?.updateManifest?.url !== UPDATE_MANIFEST_URL || evidence?.updateManifest?.finalURL !== UPDATE_MANIFEST_URL) {
    errors.push("macOS update manifest must use the canonical URL without a redirect.");
  }
  const distributionCapturedAt = Date.parse(context.macOSDistribution?.capturedAt ?? "");
  const publishedAt = Date.parse(document?.current?.publishedAt ?? "");
  const generatedAt = Date.parse(document?.generatedAt ?? "");
  if (!Number.isFinite(publishedAt) || !Number.isFinite(distributionCapturedAt) || publishedAt < distributionCapturedAt - 300_000) {
    errors.push("Current macOS publication must follow distribution evidence capture.");
  }
  if (!Number.isFinite(generatedAt) || generatedAt < publishedAt - 300_000 || generatedAt > capturedAt + 300_000) {
    errors.push("macOS update manifest timestamp is outside the publication window.");
  }
  errors.push(...validateNetworkRecord(evidence?.download, document?.current, "Current download"));
  errors.push(...validateChecksumRecord(evidence?.checksum, document?.current, "Current checksum"));

  const firstPublicRelease = evidence?.results?.releaseHistory?.firstPublicRelease;
  if (firstPublicRelease === true && document?.previous !== null) {
    errors.push("A first public release must not claim a previous public artifact.");
  }
  if (firstPublicRelease === false && !document?.previous) {
    errors.push("A later public release needs the previous supported artifact.");
  }
  if (document?.previous) {
    errors.push(...validateNetworkRecord(evidence?.previousDownload, document.previous, "Previous download"));
    errors.push(...validateChecksumRecord(evidence?.previousChecksum, document.previous, "Previous checksum"));
    if (document.previous.version === document.current.version && document.previous.build === document.current.build) {
      errors.push("Previous and current macOS artifacts must differ.");
    }
    const previousPublishedAt = Date.parse(document.previous.publishedAt ?? "");
    if (!Number.isFinite(previousPublishedAt) || previousPublishedAt >= publishedAt) {
      errors.push("Previous macOS artifact must predate the current publication.");
    }
    const retainedUntil = Date.parse(document.previous.retainedUntil ?? "");
    const requiredRetention = Number(document?.previousDMGMinimumRetentionDays ?? 0) * 86_400_000;
    if (!Number.isFinite(retainedUntil) || retainedUntil - publishedAt < requiredRetention) {
      errors.push("Previous macOS artifact retention is shorter than the published policy.");
    }
    if (!evidence?.previousDistribution) {
      errors.push("A later public release needs the previous macOS distribution record.");
    } else {
      if (hashMacOSPublicationJSON(evidence.previousDistribution) !== document.previous.distributionEvidenceSHA256) {
        errors.push("Previous macOS distribution SHA-256 differs from the update manifest.");
      }
      const previousArtifact = evidence.previousDistribution.artifact;
      errors.push(...artifactErrors(document.previous, {
        version: previousArtifact?.appVersion,
        build: previousArtifact?.appBuild,
        fileName: previousArtifact?.fileName,
        sha256: previousArtifact?.dmgSHA256,
        sizeBytes: previousArtifact?.dmgSizeBytes,
      }, "Previous update artifact"));
      for (const error of validateMacOSDistributionEvidence(evidence.previousDistribution, {
        releaseId: evidence.previousDistribution.releaseId,
        sourceCommit: evidence.previousDistribution.candidate?.sourceCommit,
        candidateSHA256: evidence.previousDistribution.candidate?.manifestSHA256,
        candidateCreatedAt: null,
        macOS: {
          version: previousArtifact?.appVersion,
          build: previousArtifact?.appBuild,
          bundleIdentifier: previousArtifact?.bundleIdentifier,
          minimumOS: previousArtifact?.minimumOS,
          architectures: previousArtifact?.architectures,
        },
      }).errors) {
        errors.push(`Previous macOS distribution: ${error}`);
      }
    }
  } else if (
    evidence?.previousDownload !== null || evidence?.previousChecksum !== null ||
    evidence?.previousDistribution !== null
  ) {
    errors.push("First-release evidence must not contain previous artifact records.");
  }
  if (evidence?.results?.policy?.minimumPreviousDMGRetentionDays !== document?.previousDMGMinimumRetentionDays) {
    errors.push("Reviewed macOS retention policy differs from the update manifest.");
  }
  return { valid: errors.length === 0, errors };
}

async function responseBytes(response, maximumBytes, retainBytes = true) {
  const hash = createHash("sha256");
  let sizeBytes = 0;
  const chunks = [];
  for await (const chunk of response.body ?? []) {
    const bytes = Buffer.from(chunk);
    sizeBytes += bytes.length;
    if (sizeBytes > maximumBytes) throw new Error("Response exceeded the release evidence size limit.");
    hash.update(bytes);
    if (retainBytes) chunks.push(bytes);
  }
  return {
    bytes: retainBytes ? Buffer.concat(chunks) : null,
    sha256: hash.digest("hex"),
    sizeBytes,
  };
}

async function fetchTextRecord(fetchImpl, url, maximumBytes) {
  const response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  const body = await responseBytes(response, maximumBytes);
  return {
    response,
    text: body.bytes.toString("utf8"),
    bodySHA256: body.sha256,
  };
}

async function fetchDownloadRecord(fetchImpl, artifact) {
  const response = await fetchImpl(artifact.url, {
    redirect: "error",
    signal: AbortSignal.timeout(300_000),
  });
  const body = await responseBytes(
    response,
    Math.max(artifact.sizeBytes + 1_048_576, artifact.sizeBytes * 2),
    false,
  );
  return {
    url: artifact.url,
    finalURL: response.url || artifact.url,
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    sha256: body.sha256,
    sizeBytes: body.sizeBytes,
  };
}

async function fetchChecksumRecord(fetchImpl, artifact) {
  const fetched = await fetchTextRecord(fetchImpl, artifact.checksumURL, 4096);
  const match = fetched.text.match(/^([a-f0-9]{64})  ([^/\r\n]+\.dmg)\r?\n?$/);
  return {
    url: artifact.checksumURL,
    finalURL: fetched.response.url || artifact.checksumURL,
    status: fetched.response.status,
    contentType: fetched.response.headers.get("content-type") ?? "",
    bodySHA256: fetched.bodySHA256,
    advertisedSHA256: match?.[1] ?? "",
    advertisedFileName: match?.[2] ?? "",
  };
}

export async function buildMacOSPublicationEvidence({
  candidate,
  candidateSHA256,
  macOSDistribution,
  publicSurfaces,
  results,
  previousDistribution = null,
  fetchImpl = globalThis.fetch,
  capturedAt = new Date().toISOString(),
}) {
  if (typeof fetchImpl !== "function") throw new Error("A Fetch API implementation is required.");
  const manifestFetch = await fetchTextRecord(fetchImpl, UPDATE_MANIFEST_URL, 1_048_576);
  let updateDocument;
  try {
    updateDocument = JSON.parse(manifestFetch.text);
  } catch {
    throw new Error("The public macOS update manifest is not valid JSON.");
  }
  const currentDownload = await fetchDownloadRecord(fetchImpl, updateDocument.current);
  const currentChecksum = await fetchChecksumRecord(fetchImpl, updateDocument.current);
  const previousDownload = updateDocument.previous
    ? await fetchDownloadRecord(fetchImpl, updateDocument.previous)
    : null;
  const previousChecksum = updateDocument.previous
    ? await fetchChecksumRecord(fetchImpl, updateDocument.previous)
    : null;
  const routes = pageMap(publicSurfaces);
  return {
    schemaVersion: "relay.macos-publication-evidence.v1",
    releaseId: candidate.releaseId,
    capturedAt,
    candidate: {
      sourceCommit: candidate.source.commit,
      manifestSHA256: candidateSHA256,
    },
    releaseBinding: {
      sourceBranch: candidate.source.branch,
      vercelDeploymentId: candidate.deployments.vercelDeploymentId,
      macOSDistributionSHA256: hashMacOSPublicationJSON(macOSDistribution),
      publicSurfacesSHA256: hashMacOSPublicationJSON(publicSurfaces),
    },
    pages: PAGE_PATHS.map((path) => ({ path, bodySHA256: routes.get(path)?.bodySha256 ?? "" })),
    updateManifest: {
      url: UPDATE_MANIFEST_URL,
      finalURL: manifestFetch.response.url || UPDATE_MANIFEST_URL,
      status: manifestFetch.response.status,
      contentType: manifestFetch.response.headers.get("content-type") ?? "",
      bodySHA256: manifestFetch.bodySHA256,
      document: updateDocument,
    },
    download: currentDownload,
    checksum: currentChecksum,
    previousDownload,
    previousChecksum,
    previousDistribution,
    results,
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawScreenshotsIncluded: false,
      rawMachineInventoryIncluded: false,
      artifactBytesIncluded: false,
      rawPageBodiesIncluded: false,
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
  const macOSDistributionPath = requiredPath(options, "macos-distribution");
  const publicSurfacesPath = requiredPath(options, "public-surfaces");
  const resultsPath = requiredPath(options, "results");
  const outputPath = requiredPath(options, "output");
  const candidate = json(candidatePath);
  if (candidate.status !== "candidate") throw new Error("macOS publication evidence requires a candidate manifest.");
  const { validateReleaseCandidate } = await import("./release-candidate-manifest.mjs");
  const candidateResult = validateReleaseCandidate(candidate, "candidate", { repositoryRoot: DEFAULT_ROOT });
  if (!candidateResult.valid) throw new Error(`Candidate validation failed: ${candidateResult.errors.join(" ")}`);
  const macOSDistribution = json(macOSDistributionPath);
  const publicSurfaces = json(publicSurfacesPath);
  const previousDistribution = options["previous-macos-distribution"]
    ? json(resolve(options["previous-macos-distribution"]))
    : null;
  const evidence = await buildMacOSPublicationEvidence({
    candidate,
    candidateSHA256: fileSHA256(candidatePath),
    macOSDistribution,
    publicSurfaces,
    results: json(resultsPath),
    previousDistribution,
  });
  const validation = validateMacOSPublicationEvidence(evidence, {
    releaseId: candidate.releaseId,
    sourceCommit: candidate.source.commit,
    sourceBranch: candidate.source.branch,
    candidateSHA256: fileSHA256(candidatePath),
    vercelDeploymentId: candidate.deployments.vercelDeploymentId,
    macOSDistribution,
    publicSurfaces,
    remoteEvidence: candidate.evidence.remote,
  });
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`macOS publication evidence written to ${outputPath}.\n`);
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  capture(parseArgs(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
