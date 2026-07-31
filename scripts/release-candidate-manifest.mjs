#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { validateRailwayReleaseTopology } from "./railway-release-topology.mjs";
import { validateRailwayReleaseConfiguration } from "./railway-release-configuration.mjs";
import { validateReleaseRemoteEvidence } from "./release-remote-evidence.mjs";
import { validatePublicLaunchSurfaces } from "./public-launch-surface-gate.mjs";
import { validateProductionSmokeEvidence } from "./production-smoke-evidence.mjs";
import { validateFailureRecoveryEvidence } from "./failure-recovery-evidence.mjs";
import { validateBillingReleaseEvidence } from "./billing-release-evidence.mjs";
import { validateLaunchGovernanceEvidence } from "./launch-governance-evidence.mjs";
import { validateAppStoreReleaseEvidence } from "./app-store-release-evidence.mjs";
import { validateMacOSPublicationEvidence } from "./macos-publication-evidence.mjs";
import { validateLaunchJourneyEvidence } from "./launch-journey-evidence.mjs";
import { validateProductionChecklistEvidence } from "./production-launch-checklist-evidence.mjs";
import { validateMarketplaceAcceptanceRepository } from "./marketplace-provider-acceptance.mjs";
import {
  validateMarketplaceFreezeSourceAudit,
  verifyMarketplaceFreezeSourceAuditRepository,
} from "./marketplace-freeze-source-audit.mjs";
import {
  validateIOSDistributionEvidence,
  validateMacOSDistributionEvidence,
} from "./apple-distribution-evidence.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const RELEASE_SCHEMA_ROOT = resolve(DEFAULT_ROOT, "RelayConsoleSwift/Release");
const FINAL_ACCEPTANCE_GATES = [
  "bridgeHosts",
  "billing",
  "marketplace",
  "railwayOperations",
  "macOSDistribution",
  "iOSDistribution",
  "accountLifecycle",
  "publicSurfaces",
  "humanGoNoGo",
];
const RAILWAY_OPERATION_CONTROLS = [
  "stagingProductionSeparated",
  "deploymentsUseBackendRoot",
  "migrationsRunOnStartup",
  "strongSecretsReviewed",
  "automatedBackupsEnabled",
  "monitoringActive",
  "allRequiredSignalsMonitored",
  "alertRecipientConfigured",
  "testAlertReceived",
  "spendAlertsConfigured",
  "capacityLimitsConfigured",
  "statusPageOperational",
  "incidentOwnerAssigned",
  "backupRestoreDrillPassed",
  "backendRollbackDrillPassed",
  "marketplaceKillSwitchDrillPassed",
];
const RAILWAY_OPERATION_EVIDENCE_URLS = [
  "environmentSeparation",
  "secretReview",
  "backups",
  "monitoringAndAlert",
  "costControls",
  "statusAndIncident",
  "productionDrills",
];
const RAILWAY_OPERATION_RELEASE_EVIDENCE = [
  "railwayTopologySHA256",
  "railwayConfigurationSHA256",
  "publicSurfacesSHA256",
  "productionSmokeSHA256",
  "failureRecoverySHA256",
];
const EVIDENCE_PRIVACY_FIELDS = [
  "credentialsIncluded",
  "secretValuesIncluded",
  "customerContentIncluded",
  "customerIdentifiersIncluded",
  "rawCommandOutputIncluded",
];

function args(argv) {
  const output = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) output[key] = true;
    else {
      output[key] = next;
      index += 1;
    }
  }
  return output;
}

function runGit(repo, command) {
  return execFileSync("git", ["-C", repo, ...command], { encoding: "utf8" }).trim();
}

export function gitIdentity(repo) {
  return {
    path: repo,
    branch: runGit(repo, ["branch", "--show-current"]),
    commit: runGit(repo, ["rev-parse", "HEAD"]),
    clean: runGit(repo, ["status", "--porcelain", "--untracked-files=all"]) === "",
  };
}

function gitCommandSucceeds(repo, command) {
  try {
    execFileSync("git", ["-C", repo, ...command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function validateReleaseCheckout(manifest, repositoryRoot) {
  const errors = [];
  let source;
  try {
    source = gitIdentity(repositoryRoot);
  } catch (error) {
    return [`Release checkout identity could not be read: ${error.message}`];
  }
  if (source.commit !== manifest.source?.commit) {
    errors.push("Release checkout HEAD differs from the manifest source commit.");
  }
  if (source.branch !== manifest.source?.branch) {
    errors.push("Release checkout branch differs from the manifest source branch.");
  }
  if (!source.clean) errors.push("Release checkout is dirty at validation time.");

  const freezeRevision = manifest.catalog?.sourceRevision;
  if (!/^[a-f0-9]{40}$/.test(freezeRevision ?? "")) {
    errors.push("Marketplace freeze source revision is not a full Git commit.");
  } else if (!gitCommandSucceeds(repositoryRoot, ["cat-file", "-e", `${freezeRevision}^{commit}`])) {
    errors.push("Marketplace freeze source revision does not exist in the release checkout.");
  } else if (!gitCommandSucceeds(repositoryRoot, ["merge-base", "--is-ancestor", freezeRevision, manifest.source.commit])) {
    errors.push("Marketplace freeze source revision is not an ancestor of the release source commit.");
  }
  if (manifest.catalog?.freezeSourceAudit) {
    errors.push(...verifyMarketplaceFreezeSourceAuditRepository(
      manifest.catalog.freezeSourceAudit,
      repositoryRoot,
      manifest.source?.commit,
    ));
  }
  return errors;
}

function gitTagsAtHead(repo) {
  return runGit(repo, ["tag", "--points-at", "HEAD"])
    .split(/\r?\n/)
    .filter(Boolean);
}

function gitTagType(repo, tag) {
  if (!tag) return null;
  try {
    return runGit(repo, ["cat-file", "-t", `refs/tags/${tag}`]);
  } catch {
    return null;
  }
}

function bridgeStableGatePassed(bridgeRoot, status) {
  if (!["candidate", "final"].includes(status)) return false;
  try {
    execFileSync(
      process.execPath,
      [resolve(bridgeRoot, "scripts/bridge-release-gate.mjs"), "--stable"],
      { cwd: bridgeRoot, encoding: "utf8", stdio: "pipe" },
    );
    return true;
  } catch {
    return false;
  }
}

export function bridgeReleaseEvidence({ bridgeRoot, status, releaseTag }) {
  const tagsAtHead = gitTagsAtHead(bridgeRoot);
  const releaseTagAtHead = Boolean(
    releaseTag && tagsAtHead.includes(releaseTag),
  );
  return {
    releaseTagAtHead,
    releaseTagAnnotated:
      releaseTagAtHead && gitTagType(bridgeRoot, releaseTag) === "tag",
    stableGatePassed: bridgeStableGatePassed(bridgeRoot, status),
  };
}

function fileSHA256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function checkedBridgeEvidencePath(bridgeRoot, recordId, artifactPath) {
  if (typeof artifactPath !== "string" || !artifactPath.trim() ||
      isAbsolute(artifactPath) || artifactPath.split(/[\\/]+/).includes("..")) {
    throw new Error(`${recordId}: bridge evidence path is unsafe`);
  }
  const absolute = resolve(bridgeRoot, artifactPath);
  if (!existsSync(absolute)) {
    throw new Error(`${recordId}: bridge evidence file is missing: ${artifactPath}`);
  }
  const realRoot = realpathSync(bridgeRoot);
  const realEvidence = realpathSync(absolute);
  if (relative(realRoot, realEvidence).startsWith("..") || !statSync(realEvidence).isFile()) {
    throw new Error(`${recordId}: bridge evidence escapes the repository or is not a file`);
  }
  return realEvidence;
}

export function bridgeAcceptanceEvidence({ bridgeRoot, release, verifyGate = false }) {
  if (verifyGate) {
    try {
      execFileSync(
        process.execPath,
        [resolve(bridgeRoot, "scripts/bridge-acceptance-gate.mjs")],
        { cwd: bridgeRoot, encoding: "utf8", stdio: "pipe" },
      );
    } catch (error) {
      throw new Error(`Bridge declared-status acceptance gate failed: ${error.message}`);
    }
  }
  const recordsDirectory = resolve(bridgeRoot, "acceptance", "records", release);
  const recordFiles = existsSync(recordsDirectory)
    ? readdirSync(recordsDirectory)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => resolve(recordsDirectory, name))
    : [];
  const records = recordFiles.map((recordFile) => {
    const record = json(recordFile);
    const evidenceFiles = (record.evidence ?? []).map((artifact) =>
      checkedBridgeEvidencePath(bridgeRoot, record.recordId, artifact.path),
    );
    const journeyValues = Object.values(record.journeys ?? {});
    return {
      recordId: record.recordId,
      release: record.release,
      pluginId: record.pluginId,
      pluginVersion: record.pluginVersion,
      harness: record.harness,
      scope: {
        kind: record.scope?.kind,
        hostOS: record.scope?.hostOS ?? null,
        runtimeLocation: record.scope?.runtimeLocation,
      },
      executedAt: record.executedAt,
      operator: record.operator,
      reviewedBy: record.reviewedBy,
      independentReview: Boolean(
        record.operator && record.reviewedBy && record.operator !== record.reviewedBy,
      ),
      backendDeploymentId: record.environment?.backendDeploymentId,
      runtimeInstalledBeforeBridge:
        record.environment?.runtimeInstalledBeforeRelayBridge,
      relayInstalledRuntime: record.environment?.relayInstalledRuntime,
      cleanHost: record.environment?.cleanHost ?? null,
      clients: record.clients ?? null,
      journeyCount: journeyValues.length,
      allJourneysPassed:
        journeyValues.length > 0 && journeyValues.every((result) => result === "passed"),
      evidenceArtifactCount: evidenceFiles.length,
      evidenceArtifactsSHA256: hashFiles(bridgeRoot, evidenceFiles),
      recordSHA256: fileSHA256(recordFile),
      noSecrets: (record.evidence ?? []).length > 0 &&
        record.evidence.every((artifact) =>
          artifact.redacted === true && artifact.containsSecrets === false
        ),
      _files: [recordFile, ...evidenceFiles],
    };
  });
  const matrixFiles = [...new Set(records.flatMap((record) => record._files))];
  const summaries = records.map(({ _files, ...record }) => record);
  const deploymentIds = [...new Set(
    summaries.map((record) => record.backendDeploymentId).filter(Boolean),
  )];
  const executedTimes = summaries
    .map((record) => Date.parse(record.executedAt))
    .filter(Number.isFinite);
  const latestExecutedAt = executedTimes.length > 0
    ? new Date(Math.max(...executedTimes)).toISOString()
    : null;
  return {
    recordCount: summaries.length,
    matrixSHA256: hashFiles(bridgeRoot, matrixFiles),
    backendDeploymentId: deploymentIds.length === 1 ? deploymentIds[0] : null,
    latestExecutedAt,
    records: summaries,
  };
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    })
    .sort();
}

export function hashFiles(root, files) {
  const digest = createHash("sha256");
  for (const file of [...files].sort()) {
    const name = relative(root, file).replaceAll("\\", "/");
    digest.update(name);
    digest.update("\0");
    digest.update(readFileSync(file));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function compileReleaseCandidateSchema() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "final-release-acceptance.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "railway-release-topology.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "railway-release-configuration.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "release-remote-evidence.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "public-launch-surfaces.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "production-smoke-evidence.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "failure-recovery-evidence.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "billing-release-results.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "billing-release-evidence.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "launch-governance-results.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "launch-governance-evidence.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "app-store-release-results.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "app-store-release-evidence.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "macos-update-manifest.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "macos-publication-results.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "macos-publication-evidence.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "launch-journey-results.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "launch-journey-evidence.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "production-launch-checklist-evidence.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "marketplace-freeze-source-audit.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "macos-distribution-evidence.schema.json")));
  ajv.addSchema(json(join(RELEASE_SCHEMA_ROOT, "ios-distribution-evidence.schema.json")));
  return ajv.compile(json(join(RELEASE_SCHEMA_ROOT, "release-candidate-manifest.schema.json")));
}

const releaseCandidateSchemaValidator = compileReleaseCandidateSchema();

function formatSchemaError(error) {
  const location = error.instancePath || "$";
  if (error.keyword === "additionalProperties") {
    return `${location}: unsupported field ${error.params.additionalProperty}`;
  }
  return `${location}: ${error.message ?? error.keyword}`;
}

export function validateReleaseCandidateSchema(manifest) {
  if (releaseCandidateSchemaValidator(manifest)) return [];
  return (releaseCandidateSchemaValidator.errors ?? []).map(formatSchemaError);
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJson(value[key])]),
    );
  }
  return value;
}

export function hashJson(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableJson(value)))
    .digest("hex");
}

function uniqueMatches(text, pattern) {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[1]))].sort();
}

function requiredOption(options, name, fallback = null) {
  const value = options[name] ?? fallback;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function exactKeys(value, allowedKeys, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) errors.push(`${label} contains unsupported field ${key}.`);
  }
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

function namedHuman(value) {
  return typeof value === "string" &&
    Boolean(value.trim()) &&
    !/[<>]/.test(value) &&
    !/^(?:pending|tbd)$/i.test(value.trim());
}

export function validateFinalAcceptance(acceptance, manifest) {
  const errors = [];
  const commit = /^[a-f0-9]{40}$/;
  const evidenceURLs = [];
  exactKeys(
    acceptance,
    ["schemaVersion", "releaseId", "sourceCommit", "railwayDeploymentId", "vercelDeploymentId", "completedAt", "gates"],
    "Final acceptance",
    errors,
  );
  if (acceptance?.schemaVersion !== "relay.final-release-acceptance.v1") errors.push("Final acceptance schemaVersion is unsupported.");
  if (acceptance?.releaseId !== manifest.releaseId) errors.push("Final acceptance releaseId differs from the release manifest.");
  if (!commit.test(acceptance?.sourceCommit ?? "") || acceptance.sourceCommit !== manifest.source?.commit) {
    errors.push("Final acceptance source commit differs from the release manifest.");
  }
  if (!acceptance?.railwayDeploymentId || acceptance.railwayDeploymentId !== manifest.deployments?.railwayDeploymentId) {
    errors.push("Final acceptance Railway deployment differs from the release manifest.");
  }
  if (!acceptance?.vercelDeploymentId || acceptance.vercelDeploymentId !== manifest.deployments?.vercelDeploymentId) {
    errors.push("Final acceptance Vercel deployment differs from the release manifest.");
  }

  const completedAt = Date.parse(acceptance?.completedAt ?? "");
  const manifestCreatedAt = Date.parse(manifest.createdAt ?? "");
  if (!Number.isFinite(completedAt)) errors.push("Final acceptance completedAt must be an ISO timestamp.");
  else if (!Number.isFinite(manifestCreatedAt) || completedAt > manifestCreatedAt + 300_000 || manifestCreatedAt - completedAt > 604_800_000) {
    errors.push("Final acceptance must be completed within seven days before the release manifest.");
  }

  exactKeys(acceptance?.gates, FINAL_ACCEPTANCE_GATES, "Final acceptance gates", errors);
  for (const gateName of FINAL_ACCEPTANCE_GATES) {
    const gate = acceptance?.gates?.[gateName];
    const isRailwayOperations = gateName === "railwayOperations";
    exactKeys(
      gate,
      isRailwayOperations
        ? [
            "passed", "verifiedAt", "reviewer", "reviewerRole", "controls",
            "releaseEvidence", "evidenceURLs", "privacy",
          ]
        : gateName === "humanGoNoGo"
        ? ["passed", "verifiedAt", "reviewer", "evidenceURL", "residualRiskAccepted"]
        : ["passed", "verifiedAt", "reviewer", "evidenceURL"],
      `Final acceptance gate ${gateName}`,
      errors,
    );
    if (gate?.passed !== true) errors.push(`Final acceptance gate ${gateName} has not passed.`);
    if (!namedHuman(gate?.reviewer)) errors.push(`Final acceptance gate ${gateName} needs a named human reviewer.`);
    if (isRailwayOperations) {
      if (!namedHuman(gate?.reviewerRole)) {
        errors.push("Final acceptance Railway operations needs the reviewer's accountable role.");
      }
      exactKeys(gate?.controls, RAILWAY_OPERATION_CONTROLS, "Final acceptance Railway operations controls", errors);
      for (const control of RAILWAY_OPERATION_CONTROLS) {
        if (gate?.controls?.[control] !== true) {
          errors.push(`Final acceptance Railway operations control ${control} has not passed.`);
        }
      }
      exactKeys(
        gate?.releaseEvidence,
        RAILWAY_OPERATION_RELEASE_EVIDENCE,
        "Final acceptance Railway operations release evidence",
        errors,
      );
      const expectedReleaseEvidence = {
        railwayTopologySHA256: manifest.deployments?.railwayTopologySHA256,
        railwayConfigurationSHA256: manifest.deployments?.railwayConfigurationSHA256,
        publicSurfacesSHA256: manifest.evidence?.publicSurfacesSHA256,
        productionSmokeSHA256: manifest.evidence?.productionSmokeSHA256,
        failureRecoverySHA256: manifest.evidence?.failureRecoverySHA256,
      };
      for (const field of RAILWAY_OPERATION_RELEASE_EVIDENCE) {
        if (gate?.releaseEvidence?.[field] !== expectedReleaseEvidence[field]) {
          errors.push(`Final acceptance Railway operations ${field} differs from the release manifest.`);
        }
      }
      exactKeys(
        gate?.evidenceURLs,
        RAILWAY_OPERATION_EVIDENCE_URLS,
        "Final acceptance Railway operations evidence URLs",
        errors,
      );
      for (const evidenceName of RAILWAY_OPERATION_EVIDENCE_URLS) {
        const url = gate?.evidenceURLs?.[evidenceName];
        if (!safeEvidenceURL(url)) {
          errors.push(`Final acceptance Railway operations ${evidenceName} needs a non-placeholder HTTPS evidence URL.`);
        } else {
          evidenceURLs.push(url);
        }
      }
      exactKeys(
        gate?.privacy,
        EVIDENCE_PRIVACY_FIELDS,
        "Final acceptance Railway operations privacy",
        errors,
      );
      for (const field of EVIDENCE_PRIVACY_FIELDS) {
        if (gate?.privacy?.[field] !== false) {
          errors.push(`Final acceptance Railway operations privacy field ${field} must be false.`);
        }
      }
    } else if (!safeEvidenceURL(gate?.evidenceURL)) {
      errors.push(`Final acceptance gate ${gateName} needs a non-placeholder HTTPS evidence URL.`);
    } else {
      evidenceURLs.push(gate.evidenceURL);
    }
    const verifiedAt = Date.parse(gate?.verifiedAt ?? "");
    if (
      !Number.isFinite(verifiedAt) ||
      (Number.isFinite(completedAt) && (
        verifiedAt > completedAt + 300_000 ||
        completedAt - verifiedAt > 604_800_000
      ))
    ) {
      errors.push(`Final acceptance gate ${gateName} has an invalid verification time.`);
    }
  }
  if (new Set(evidenceURLs).size !== evidenceURLs.length) {
    errors.push("Every final acceptance gate and Railway operations control group needs its own evidence URL or document anchor.");
  }
  if (acceptance?.gates?.humanGoNoGo?.residualRiskAccepted !== true) {
    errors.push("Final human go/no-go must explicitly accept residual risk.");
  }
  if (acceptance?.gates?.humanGoNoGo?.reviewer !== manifest.evidence?.goNoGoOwner) {
    errors.push("Final human go/no-go reviewer differs from the named release owner.");
  }
  return { valid: errors.length === 0, errors };
}

function componentVersion(root, path) {
  return json(join(root, path)).version;
}

function iosComponent(root) {
  const project = readFileSync(join(root, "ios/project.yml"), "utf8");
  return {
    version: project.match(/CFBundleShortVersionString:\s*["']?([^"'\s]+)/)?.[1] ?? null,
    build: project.match(/CFBundleVersion:\s*["']?([^"'\s]+)/)?.[1] ?? null,
    bundleIdentifier: project.match(/PRODUCT_BUNDLE_IDENTIFIER:\s*([^\s]+)/)?.[1] ?? null,
    minimumOS: project.match(/iOS:\s*["']?([^"'\s]+)/)?.[1] ?? null,
  };
}

function migrationSnapshot(root) {
  const files = walk(join(root, "backend/src/migrations"))
    .filter((path) => path.endsWith(".ts"));
  const numbers = files
    .map((path) => Number.parseInt(basename(path).match(/^(\d+)_/)?.[1] ?? "", 10))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  return {
    firstMigration: String(numbers.at(0) ?? "").padStart(3, "0"),
    lastMigration: String(numbers.at(-1) ?? "").padStart(3, "0"),
    migrationCount: files.length,
    migrationSourceSHA256: hashFiles(root, files),
  };
}

function catalogSnapshot(root) {
  const releaseManifestPath = join(
    root,
    "packages/marketplace-catalog/release/marketplace-release-manifest.json",
  );
  const releaseManifest = json(releaseManifestPath);
  const backendReleaseManifestPath = join(
    root,
    "backend/src/modules/marketplace/marketplace-release-manifest.json",
  );
  const macReleaseManifestPath = join(
    root,
    "RelayConsoleSwift/Sources/RelayConsoleCore/Resources/marketplace-release-manifest.json",
  );
  const providerManifests = walk(join(root, "packages/marketplace-catalog/providers"))
    .filter((path) => path.endsWith("/manifest.json"));
  const swiftCatalogPath = join(
    root,
    "RelayConsoleSwift/Sources/RelayConsoleCore/ApplicationsService.swift",
  );
  const backendCatalogPath = join(
    root,
    "backend/src/modules/marketplace/catalog/marketplace-catalog.ts",
  );
  const registryPath = join(
    root,
    "backend/src/modules/marketplace/connectors/connector-registry.ts",
  );
  const acceptanceFiles = releaseManifest.providers
    .filter((provider) => provider.liveVerified)
    .map((provider) => provider.acceptance?.recordPath)
    .filter((path) =>
      typeof path === "string" &&
      /^packages\/marketplace-catalog\/release\/acceptance\/[a-z0-9-]+\.json$/.test(path)
    )
    .map((path) => resolve(root, path))
    .filter((path) => existsSync(path));
  const sourceFiles = [
    releaseManifestPath,
    backendReleaseManifestPath,
    macReleaseManifestPath,
    join(root, "packages/marketplace-catalog/schema/marketplace-release-manifest.schema.json"),
    join(root, "packages/marketplace-catalog/schema/marketplace-provider-acceptance.schema.json"),
    swiftCatalogPath,
    backendCatalogPath,
    registryPath,
    ...providerManifests,
    ...walk(join(root, "backend/src/modules/marketplace/connectors"))
      .filter((path) => path.endsWith(".ts")),
    ...acceptanceFiles,
  ];
  return {
    releaseManifestSchemaVersion: releaseManifest.schemaVersion,
    releaseManifestVersion: releaseManifest.manifestVersion,
    releaseChannel: releaseManifest.releaseChannel,
    freezeStatus: releaseManifest.freeze.status,
    frozenAt: releaseManifest.freeze.frozenAt,
    sourceRevision: releaseManifest.freeze.sourceRevision,
    releaseManifestParity:
      hashJson(releaseManifest) === hashJson(json(backendReleaseManifestPath)) &&
      hashJson(releaseManifest) === hashJson(json(macReleaseManifestPath)),
    reviewedProviderCount: releaseManifest.providers.length,
    connectEligibleSlugs: releaseManifest.providers
      .filter((provider) => provider.connectEligible)
      .map((provider) => provider.slug)
      .sort(),
    providerManifestCount: providerManifests.length,
    swiftSlugCount: uniqueMatches(
      readFileSync(swiftCatalogPath, "utf8"),
      /\bslug:\s*"([a-z0-9-]+)"/g,
    ).length,
    backendSlugCount: uniqueMatches(
      readFileSync(backendCatalogPath, "utf8"),
      /\bapp\(\s*"([a-z0-9-]+)"/g,
    ).length,
    connectorCount: uniqueMatches(
      readFileSync(registryPath, "utf8"),
      /\[([A-Z0-9_]+)_CONNECTOR_MANIFEST\.slug/g,
    ).length,
    sourceSHA256: hashFiles(root, sourceFiles),
  };
}

export function frozenRepositorySnapshot(root) {
  const mac = json(join(
    root,
    "RelayConsoleSwift/Sources/RelayConsoleCore/Resources/relay-console-release.json",
  ));
  return {
    components: {
      backend: { version: componentVersion(root, "backend/package.json") },
      web: { version: componentVersion(root, "web/package.json") },
      website: { version: componentVersion(root, "Relay Console landing page/package.json") },
      macOS: {
        version: mac.version,
        build: mac.build,
        bundleIdentifier: mac.bundleIdentifier,
        minimumOS: mac.minimumMacOSVersion,
        architectures: ["arm64"],
      },
      iOS: iosComponent(root),
    },
    database: migrationSnapshot(root),
    catalog: catalogSnapshot(root),
  };
}

export function validateFrozenRepositoryComponents(manifest, repositoryRoot) {
  let expected;
  try {
    expected = frozenRepositorySnapshot(repositoryRoot);
  } catch (error) {
    return [`Frozen repository components could not be read: ${error.message}`];
  }
  const errors = [];
  const compare = (actual, wanted, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      errors.push(`${label} differs from the release checkout.`);
    }
  };
  compare(manifest.components, expected.components, "Frozen component versions");
  compare(manifest.database, expected.database, "Frozen database migration set");
  for (const [field, value] of Object.entries(expected.catalog)) {
    compare(manifest.catalog?.[field], value, `Frozen Marketplace catalog ${field}`);
  }
  return errors;
}

export function validateReleaseCandidate(manifest, requiredStatus = "draft", { repositoryRoot = null } = {}) {
  const errors = [];
  const warnings = [];
  const rank = { draft: 0, candidate: 1, final: 2 };
  const manifestRank = rank[manifest.status] ?? -1;
  const sha = /^[a-f0-9]{64}$/;
  const commit = /^[a-f0-9]{40}$/;
  const add = (condition, message, minimumStatus = "draft") => {
    if (condition) return;
    if (manifestRank < rank[minimumStatus]) warnings.push(message);
    else errors.push(message);
  };

  errors.push(
    ...validateReleaseCandidateSchema(manifest).map((error) => `Schema: ${error}`),
  );

  add(manifest.schemaVersion === "relay.release-candidate.v1", "Unsupported schemaVersion.");
  add(["draft", "candidate", "final"].includes(manifest.status), "status must be draft, candidate, or final.");
  add(manifestRank >= (rank[requiredStatus] ?? 0), `Manifest status must be at least ${requiredStatus}.`);
  const createdAt = Date.parse(manifest.createdAt ?? "");
  add(Number.isFinite(createdAt), "createdAt must be an ISO timestamp.");
  add(commit.test(manifest.source?.commit ?? ""), "The source commit must be a full Git SHA.");
  add(/^release\/.+/.test(manifest.source?.branch ?? ""), "A release candidate must come from a release/** branch.", "candidate");
  add(commit.test(manifest.bridge?.commit ?? ""), "The bridge commit must be a full Git SHA.");
  add(manifest.source?.clean === true, "The product source tree is dirty.", "candidate");
  add(manifest.bridge?.clean === true, "The bridge source tree is dirty.", "candidate");
  add(Boolean(manifest.releaseId), "releaseId is required.");
  add(Boolean(manifest.components?.backend?.version), "Backend version is required.");
  add(Boolean(manifest.components?.web?.version), "Web version is required.");
  add(Boolean(manifest.components?.macOS?.version && manifest.components?.macOS?.build), "macOS version and build are required.");
  add(Boolean(manifest.components?.iOS?.version && manifest.components?.iOS?.build), "iOS version and build are required.");
  add(manifest.components?.iOS?.bundleIdentifier === "com.relayconsole.app", "iOS must use the Relay Console bundle identifier com.relayconsole.app.");
  add(sha.test(manifest.database?.migrationSourceSHA256 ?? ""), "Migration source SHA-256 is invalid.");
  add(sha.test(manifest.catalog?.sourceSHA256 ?? ""), "Catalog source SHA-256 is invalid.");
  add(manifest.catalog?.releaseManifestParity === true, "Marketplace release-manifest snapshots differ.", "candidate");
  add(sha.test(manifest.bridge?.compatibilityManifestSHA256 ?? ""), "Bridge compatibility SHA-256 is invalid.");
  add(sha.test(manifest.bridge?.backendCompatibilityManifestSHA256 ?? ""), "Backend bridge compatibility SHA-256 is invalid.");
  add(manifest.bridge?.compatibilityParity === true, "Backend and bridge compatibility manifests differ.", "candidate");
  add(manifest.bridge?.releaseStatus === "stable", "A release candidate requires a stable bridge compatibility manifest.", "candidate");
  add(/^v\d+\.\d+\.\d+$/.test(manifest.bridge?.release ?? ""), "A release candidate requires a non-prerelease bridge version.", "candidate");
  add(manifest.bridge?.releaseTag === manifest.bridge?.release, "The bridge release tag must exactly match the compatibility manifest release.", "candidate");
  add(manifest.bridge?.releaseTagAtHead === true, "The exact bridge release tag must point at the recorded bridge commit.", "candidate");
  add(manifest.bridge?.releaseTagAnnotated === true, "The exact bridge release tag must be annotated.", "candidate");
  add(manifest.bridge?.stableGatePassed === true, "The bridge repository stable release gate has not passed.", "candidate");
  const bridgePlugins = manifest.bridge?.plugins ?? [];
  const expectedBridgePluginIds = ["hermes-agent-bridge", "openclaw-bridge"];
  const bridgePluginIds = bridgePlugins.map((plugin) => plugin.id).sort();
  add(
    JSON.stringify(bridgePluginIds) === JSON.stringify(expectedBridgePluginIds),
    "The bridge manifest must bind one Hermes plugin and one OpenClaw plugin.",
  );
  for (const plugin of bridgePlugins) {
    add(
      JSON.stringify([...(plugin.candidateHostOS ?? [])].sort()) ===
        JSON.stringify(["linux-systemd", "macos-launchd"]),
      `${plugin.id ?? "unknown bridge plugin"} must advertise the macOS and Linux release hosts.`,
    );
  }
  const bridgeAcceptance = manifest.bridge?.acceptance;
  const bridgeRecords = bridgeAcceptance?.records ?? [];
  add(
    bridgeAcceptance?.recordCount === bridgeRecords.length,
    "Bridge acceptance recordCount differs from the embedded record summaries.",
  );
  add(
    sha.test(bridgeAcceptance?.matrixSHA256 ?? ""),
    "Bridge acceptance matrix SHA-256 is invalid.",
  );
  const bridgeRecordIds = bridgeRecords.map((record) => record.recordId);
  add(
    new Set(bridgeRecordIds).size === bridgeRecordIds.length,
    "Bridge acceptance record IDs must be unique.",
  );
  const bridgeExecutionTimes = [];
  for (const record of bridgeRecords) {
    const plugin = bridgePlugins.find((candidate) => candidate.id === record.pluginId);
    add(Boolean(plugin), `${record.recordId}: plugin is missing from the bridge release.`);
    add(record.release === manifest.bridge?.release, `${record.recordId}: release differs from the bridge release.`);
    add(record.pluginVersion === plugin?.version, `${record.recordId}: plugin version differs from the bridge release.`);
    add(record.harness?.version === plugin?.supportedHarness?.version, `${record.recordId}: harness version differs from the bridge release.`);
    add(record.harness?.commit === plugin?.supportedHarness?.commit, `${record.recordId}: harness commit differs from the bridge release.`);
    add(record.independentReview === true && record.operator !== record.reviewedBy, `${record.recordId}: independent review is missing.`);
    add(record.runtimeInstalledBeforeBridge === true, `${record.recordId}: the user runtime did not pre-exist the Relay bridge.`);
    add(record.relayInstalledRuntime === false, `${record.recordId}: Relay installed the user runtime during acceptance.`);
    add(record.allJourneysPassed === true, `${record.recordId}: one or more acceptance journeys failed.`);
    add(record.noSecrets === true, `${record.recordId}: redaction and secret review did not pass.`);
    add(record.evidenceArtifactCount > 0, `${record.recordId}: no evidence artifacts are bound.`);
    add(sha.test(record.evidenceArtifactsSHA256 ?? ""), `${record.recordId}: evidence SHA-256 is invalid.`);
    add(sha.test(record.recordSHA256 ?? ""), `${record.recordId}: record SHA-256 is invalid.`);
    add(
      record.backendDeploymentId === manifest.deployments?.railwayDeploymentId,
      `${record.recordId}: backend deployment differs from the release Railway deployment.`,
      "candidate",
    );
    const executedAt = Date.parse(record.executedAt ?? "");
    if (Number.isFinite(executedAt)) bridgeExecutionTimes.push(executedAt);
    add(
      Number.isFinite(executedAt) && Number.isFinite(createdAt) &&
        executedAt <= createdAt + 300_000 && executedAt >= createdAt - 7 * 24 * 60 * 60 * 1000,
      `${record.recordId}: acceptance must run within seven days before candidate creation.`,
      "candidate",
    );

    if (record.scope?.kind === "clean-host") {
      const expectedLocation = record.scope.hostOS === "macos-launchd"
        ? "same-mac"
        : record.scope.hostOS === "linux-systemd" ? "linux-vps" : null;
      add(record.scope.runtimeLocation === expectedLocation, `${record.recordId}: clean-host runtime location is invalid.`);
      add(record.cleanHost === true, `${record.recordId}: clean-host evidence must declare a clean host.`);
      add(record.clients === null, `${record.recordId}: clean-host evidence must not bind client versions.`);
      add(record.journeyCount === 13, `${record.recordId}: clean-host evidence must bind 13 journeys.`);
    } else if (record.scope?.kind === "cross-client") {
      add(record.scope.hostOS === null, `${record.recordId}: cross-client evidence must not claim one host OS.`);
      add(record.scope.runtimeLocation === "second-computer", `${record.recordId}: cross-client evidence must use a second computer.`);
      add(record.cleanHost === null, `${record.recordId}: cross-client evidence must not claim a clean host.`);
      add(record.journeyCount === 11, `${record.recordId}: cross-client evidence must bind 11 journeys.`);
      const expectedClients = {
        macos: `${manifest.components?.macOS?.version}/${manifest.components?.macOS?.build}`,
        web: String(manifest.deployments?.vercelDeploymentId ?? ""),
        iphone: `${manifest.components?.iOS?.version}/${manifest.components?.iOS?.build}`,
        ipad: `${manifest.components?.iOS?.version}/${manifest.components?.iOS?.build}`,
      };
      add(
        Object.entries(expectedClients).every(([client, version]) =>
          record.clients?.[client] === version
        ) && Object.keys(record.clients ?? {}).length === Object.keys(expectedClients).length,
        `${record.recordId}: client versions differ from the release candidate.`,
        "candidate",
      );
    }
  }
  const expectedBridgeScopes = bridgePlugins.flatMap((plugin) => [
    [plugin.id, "clean-host", "macos-launchd", "same-mac"],
    [plugin.id, "clean-host", "linux-systemd", "linux-vps"],
    [plugin.id, "cross-client", null, "second-computer"],
  ]);
  const bridgeMatrixComplete = bridgeRecords.length === expectedBridgeScopes.length &&
    expectedBridgeScopes.every(([pluginId, kind, hostOS, runtimeLocation]) =>
      bridgeRecords.filter((record) =>
        record.pluginId === pluginId &&
        record.scope?.kind === kind &&
        record.scope?.hostOS === hostOS &&
        record.scope?.runtimeLocation === runtimeLocation
      ).length === 1
    );
  add(
    bridgeMatrixComplete,
    "A release candidate requires the exact six-record bridge matrix for the same Mac, a second computer, and a Linux VPS.",
    "candidate",
  );
  const bridgeDeploymentIds = [...new Set(bridgeRecords.map((record) => record.backendDeploymentId))];
  add(
    bridgeRecords.length === 0
      ? bridgeAcceptance?.backendDeploymentId === null
      : bridgeDeploymentIds.length === 1 && bridgeAcceptance?.backendDeploymentId === bridgeDeploymentIds[0],
    "Bridge acceptance does not bind one backend deployment.",
  );
  add(
    bridgeRecords.length === 0
      ? bridgeAcceptance?.latestExecutedAt === null
      : bridgeExecutionTimes.length === bridgeRecords.length &&
        Date.parse(bridgeAcceptance?.latestExecutedAt ?? "") === Math.max(...bridgeExecutionTimes),
    "Bridge acceptance latestExecutedAt differs from its records.",
  );
  add(
    bridgeAcceptance?.backendDeploymentId === manifest.deployments?.railwayDeploymentId,
    "Bridge acceptance backend differs from the release Railway deployment.",
    "candidate",
  );
  add(
    manifest.bridge?.supportedBackend?.version === manifest.components?.backend?.version,
    "Bridge supported-backend version differs from the release backend version.",
  );
  add(
    manifest.bridge?.supportedBackend?.origin === "https://api.relayconsole.work",
    "Bridge supported-backend origin must be the canonical Relay backend.",
  );
  add(
    commit.test(manifest.bridge?.supportedBackend?.commit ?? ""),
    "A release candidate must pin the bridge to a full backend compatibility commit.",
    "candidate",
  );
  add(manifest.catalog?.freezeStatus === "frozen", "A release candidate needs a frozen Marketplace manifest.", "candidate");
  add(commit.test(manifest.catalog?.sourceRevision ?? ""), "A release candidate needs a full Marketplace freeze source revision.", "candidate");
  const freezeSourceAudit = manifest.catalog?.freezeSourceAudit;
  add(Boolean(freezeSourceAudit), "A release candidate needs an approved Marketplace freeze source audit.", "candidate");
  add(
    freezeSourceAudit === null
      ? manifest.catalog?.freezeSourceAuditSHA256 === null
      : hashJson(freezeSourceAudit) === manifest.catalog?.freezeSourceAuditSHA256,
    "Marketplace freeze source-audit SHA-256 differs.",
  );
  if (freezeSourceAudit) {
    for (const error of validateMarketplaceFreezeSourceAudit(freezeSourceAudit).errors) {
      add(false, `Marketplace freeze source audit: ${error}`, "candidate");
    }
    add(
      freezeSourceAudit.source?.revision === manifest.catalog?.sourceRevision,
      "Marketplace freeze source audit differs from the release-manifest source revision.",
      "candidate",
    );
    add(
      freezeSourceAudit.providers?.manifestCount === manifest.catalog?.providerManifestCount,
      "Marketplace freeze source audit provider count differs from the candidate catalog.",
      "candidate",
    );
  }
  const catalogFrozenAt = Date.parse(manifest.catalog?.frozenAt ?? "");
  add(Number.isFinite(catalogFrozenAt), "A release candidate needs a valid Marketplace frozenAt timestamp.", "candidate");
  add(
    Number.isFinite(catalogFrozenAt) && Number.isFinite(createdAt) && catalogFrozenAt <= createdAt + 300_000,
    "Marketplace frozenAt cannot be later than the release manifest.",
    "candidate",
  );
  const freezeAuditCapturedAt = Date.parse(freezeSourceAudit?.capturedAt ?? "");
  if (freezeSourceAudit) {
    add(
      Number.isFinite(freezeAuditCapturedAt) && Number.isFinite(catalogFrozenAt) &&
        freezeAuditCapturedAt <= catalogFrozenAt + 300_000,
      "Marketplace freeze source audit must be captured before the catalog freeze.",
      "candidate",
    );
  }
  add((manifest.catalog?.connectEligibleSlugs?.length ?? 0) > 0, "A release candidate needs at least one live-verified Marketplace provider.", "candidate");
  add(
    manifest.catalog?.providerAcceptanceCount === manifest.catalog?.connectEligibleSlugs?.length,
    "Every live-verified Marketplace provider needs a valid staging acceptance record.",
    "candidate",
  );
  add(
    sha.test(manifest.catalog?.providerAcceptanceSHA256 ?? ""),
    "Marketplace provider-acceptance SHA-256 is invalid.",
  );
  add(Boolean(manifest.deployments?.railwayDeploymentId), "Railway deployment id is required for a release candidate.", "candidate");
  add(Boolean(manifest.deployments?.vercelDeploymentId), "Vercel deployment id is required for a release candidate.", "candidate");
  const railwayTopology = manifest.deployments?.railwayTopology;
  add(Boolean(railwayTopology), "A fresh Railway staging/production topology snapshot is required.", "candidate");
  if (railwayTopology) {
    const topology = validateRailwayReleaseTopology(railwayTopology, {
      releaseBranch: manifest.source?.branch ?? null,
      releaseCommit: manifest.source?.commit ?? null,
    });
    for (const error of topology.errors) add(false, `Railway topology: ${error}`, "candidate");
    add(
      hashJson(railwayTopology) === manifest.deployments?.railwayTopologySHA256,
      "Railway topology snapshot SHA-256 differs.",
      "candidate",
    );
    const topologyCapturedAt = Date.parse(railwayTopology.capturedAt ?? "");
    const topologyAge = createdAt - topologyCapturedAt;
    add(
      Number.isFinite(topologyAge) && topologyAge >= -300_000 && topologyAge <= 86_400_000,
      "Railway topology snapshot must be captured within 24 hours before the release manifest.",
      "candidate",
    );
    add(
      manifest.deployments?.railwayDeploymentId === railwayTopology.production?.backend?.deployment?.id,
      "Railway deployment id differs from the successful production deployment in the topology snapshot.",
      "candidate",
    );
  }
  const railwayConfiguration = manifest.deployments?.railwayConfiguration;
  add(
    Boolean(railwayConfiguration),
    "Fresh release-bound Railway production configuration evidence is required.",
    "candidate",
  );
  if (railwayConfiguration) {
    const configuration = validateRailwayReleaseConfiguration(
      railwayConfiguration,
      {
        topology: railwayTopology,
        releaseCommit: manifest.source?.commit ?? null,
      },
    );
    for (const error of configuration.errors) {
      add(false, `Railway configuration: ${error}`, "candidate");
    }
    add(
      hashJson(railwayConfiguration) ===
        manifest.deployments?.railwayConfigurationSHA256,
      "Railway configuration evidence SHA-256 differs.",
      "candidate",
    );
    const configurationCapturedAt = Date.parse(
      railwayConfiguration.capturedAt ?? "",
    );
    const configurationAge = createdAt - configurationCapturedAt;
    add(
      Number.isFinite(configurationAge) &&
        configurationAge >= -300_000 &&
        configurationAge <= 86_400_000,
      "Railway configuration evidence must be captured within 24 hours before the release manifest.",
      "candidate",
    );
    add(
      manifest.deployments?.railwayDeploymentId ===
        railwayConfiguration.identity?.deploymentId,
      "Railway deployment id differs from the production configuration evidence.",
      "candidate",
    );
  }
  const macOSDistribution = manifest.artifacts?.macOSDistribution;
  add(Boolean(macOSDistribution), "Machine-validated Developer ID, notarization, stapling, and Gatekeeper evidence is required for macOS.", "final");
  if (macOSDistribution) {
    const macOSResult = validateMacOSDistributionEvidence(macOSDistribution, {
      releaseId: manifest.releaseId,
      sourceCommit: manifest.source?.commit,
      candidateSHA256: macOSDistribution.candidate?.manifestSHA256,
      candidateCreatedAt: null,
      macOS: manifest.components?.macOS,
    });
    for (const error of macOSResult.errors) add(false, `macOS distribution: ${error}`, "final");
    add(
      hashJson(macOSDistribution) === manifest.artifacts?.macOSDistributionSHA256,
      "macOS distribution evidence SHA-256 differs.",
      "final",
    );
  }
  const iOSDistribution = manifest.artifacts?.iOSDistribution;
  add(Boolean(iOSDistribution), "A release-bound signed archive and exact App Store Connect build record are required for iOS.", "final");
  if (iOSDistribution) {
    const iOSResult = validateIOSDistributionEvidence(iOSDistribution, {
      releaseId: manifest.releaseId,
      sourceCommit: manifest.source?.commit,
      candidateSHA256: iOSDistribution.candidate?.manifestSHA256,
      candidateCreatedAt: null,
      iOS: manifest.components?.iOS,
    });
    for (const error of iOSResult.errors) add(false, `iOS distribution: ${error}`, "final");
    add(
      hashJson(iOSDistribution) === manifest.artifacts?.iOSDistributionSHA256,
      "iOS distribution evidence SHA-256 differs.",
      "final",
    );
  }
  if (macOSDistribution && iOSDistribution) {
    add(
      macOSDistribution.candidate?.manifestSHA256 === iOSDistribution.candidate?.manifestSHA256,
      "macOS and iOS artifacts were not authorized by the same candidate manifest.",
      "final",
    );
  }
  const remoteEvidence = manifest.evidence?.remote;
  add(Boolean(remoteEvidence), "Fresh release-bound CI and Vercel evidence is required.", "candidate");
  if (remoteEvidence) {
    const remote = validateReleaseRemoteEvidence(remoteEvidence, {
      sourceCommit: manifest.source?.commit ?? null,
      sourceBranch: manifest.source?.branch ?? null,
    });
    for (const error of remote.errors) add(false, `Remote evidence: ${error}`, "candidate");
    add(
      hashJson(remoteEvidence) === manifest.evidence?.remoteSHA256,
      "Release remote-evidence SHA-256 differs.",
      "candidate",
    );
    const remoteCapturedAt = Date.parse(remoteEvidence.capturedAt ?? "");
    const remoteAge = createdAt - remoteCapturedAt;
    add(
      Number.isFinite(remoteAge) && remoteAge >= -300_000 && remoteAge <= 86_400_000,
      "Release remote evidence must be captured within 24 hours before the release manifest.",
      "candidate",
    );
    add(
      manifest.deployments?.vercelDeploymentId === String(remoteEvidence.vercel?.githubDeploymentId ?? ""),
      "Vercel deployment id differs from the successful Vercel-authored production deployment evidence.",
      "candidate",
    );
  }
  const publicSurfaces = manifest.evidence?.publicSurfaces;
  add(Boolean(publicSurfaces), "Fresh public surfaces bound to the exact Vercel release are required.", "final");
  if (publicSurfaces) {
    const publicResult = validatePublicLaunchSurfaces(publicSurfaces, {
      remoteEvidence,
    });
    for (const error of publicResult.errors) add(false, `Public surfaces: ${error}`, "final");
    add(
      hashJson(publicSurfaces) === manifest.evidence?.publicSurfacesSHA256,
      "Public surfaces evidence SHA-256 differs.",
      "final",
    );
    const publicCapturedAt = Date.parse(publicSurfaces.capturedAt ?? "");
    const publicAge = createdAt - publicCapturedAt;
    add(
      Number.isFinite(publicAge) && publicAge >= -300_000 && publicAge <= 86_400_000,
      "Public surfaces evidence must be captured within 24 hours before the final manifest.",
      "final",
    );
  }
  const macOSPublication = manifest.evidence?.macOSPublication;
  add(Boolean(macOSPublication), "Release-bound macOS download, checksum, update-manifest, clean-machine, lifecycle, and rollback evidence is required.", "final");
  if (macOSPublication) {
    const authorizedCandidateSHA256 =
      macOSDistribution?.candidate?.manifestSHA256 ??
      iOSDistribution?.candidate?.manifestSHA256 ??
      null;
    const publicationResult = validateMacOSPublicationEvidence(macOSPublication, {
      releaseId: manifest.releaseId,
      sourceCommit: manifest.source?.commit,
      sourceBranch: manifest.source?.branch,
      candidateSHA256: authorizedCandidateSHA256,
      vercelDeploymentId: manifest.deployments?.vercelDeploymentId,
      macOSDistribution,
      publicSurfaces,
      remoteEvidence,
    });
    for (const error of publicationResult.errors) {
      add(false, `macOS publication: ${error}`, "final");
    }
    add(
      hashJson(macOSPublication) === manifest.evidence?.macOSPublicationSHA256,
      "macOS publication evidence SHA-256 differs.",
      "final",
    );
    const publicationCapturedAt = Date.parse(macOSPublication.capturedAt ?? "");
    const publicationAge = createdAt - publicationCapturedAt;
    add(
      Number.isFinite(publicationAge) && publicationAge >= -300_000 && publicationAge <= 86_400_000,
      "macOS publication evidence must be captured within 24 hours before the final manifest.",
      "final",
    );
  }
  const productionSmoke = manifest.evidence?.productionSmoke;
  add(Boolean(productionSmoke), "Fresh passing production smoke evidence is required.", "final");
  if (productionSmoke) {
    const smokeResult = validateProductionSmokeEvidence(productionSmoke, {
      topology: railwayTopology,
      configuration: railwayConfiguration,
      remoteEvidence,
      publicSurfaces,
    });
    for (const error of smokeResult.errors) add(false, `Production smoke: ${error}`, "final");
    add(
      hashJson(productionSmoke) === manifest.evidence?.productionSmokeSHA256,
      "Production smoke evidence SHA-256 differs.",
      "final",
    );
    const smokeCapturedAt = Date.parse(productionSmoke.capturedAt ?? "");
    const smokeAge = createdAt - smokeCapturedAt;
    add(
      Number.isFinite(smokeAge) && smokeAge >= -300_000 && smokeAge <= 3_600_000,
      "Production smoke evidence must be captured within one hour before the final manifest.",
      "final",
    );
  }
  const failureRecovery = manifest.evidence?.failureRecovery;
  add(Boolean(failureRecovery), "Release-bound failure and recovery evidence is required.", "final");
  if (failureRecovery) {
    const authorizedCandidateSHA256 =
      macOSDistribution?.candidate?.manifestSHA256 ??
      iOSDistribution?.candidate?.manifestSHA256 ??
      null;
    const recoveryResult = validateFailureRecoveryEvidence(failureRecovery, {
      releaseId: manifest.releaseId,
      sourceCommit: manifest.source?.commit,
      sourceBranch: manifest.source?.branch,
      candidateSHA256: authorizedCandidateSHA256,
      topology: railwayTopology,
      configuration: railwayConfiguration,
      remoteEvidence,
      repositoryRoot: repositoryRoot ?? DEFAULT_ROOT,
    });
    for (const error of recoveryResult.errors) {
      add(false, `Failure recovery: ${error}`, "final");
    }
    add(
      hashJson(failureRecovery) === manifest.evidence?.failureRecoverySHA256,
      "Failure and recovery evidence SHA-256 differs.",
      "final",
    );
    const recoveryCapturedAt = Date.parse(failureRecovery.capturedAt ?? "");
    const recoveryAge = createdAt - recoveryCapturedAt;
    add(
      Number.isFinite(recoveryAge) && recoveryAge >= -300_000 && recoveryAge <= 86_400_000,
      "Failure and recovery evidence must be captured within 24 hours before the final manifest.",
      "final",
    );
  }
  const billingRelease = manifest.evidence?.billingRelease;
  add(Boolean(billingRelease), "Release-bound Stripe and Apple billing evidence is required.", "final");
  if (billingRelease) {
    const authorizedCandidateSHA256 =
      iOSDistribution?.candidate?.manifestSHA256 ??
      macOSDistribution?.candidate?.manifestSHA256 ??
      null;
    const billingResult = validateBillingReleaseEvidence(billingRelease, {
      releaseId: manifest.releaseId,
      sourceCommit: manifest.source?.commit,
      sourceBranch: manifest.source?.branch,
      candidateSHA256: authorizedCandidateSHA256,
      railwayDeploymentId: manifest.deployments?.railwayDeploymentId,
      vercelDeploymentId: manifest.deployments?.vercelDeploymentId,
      topology: railwayTopology,
      configuration: railwayConfiguration,
      remoteEvidence,
      iOSDistribution,
      components: manifest.components,
      repositoryRoot: repositoryRoot ?? DEFAULT_ROOT,
    });
    for (const error of billingResult.errors) {
      add(false, "Billing release: " + error, "final");
    }
    add(
      hashJson(billingRelease) === manifest.evidence?.billingReleaseSHA256,
      "Billing release evidence SHA-256 differs.",
      "final",
    );
    const billingCapturedAt = Date.parse(billingRelease.capturedAt ?? "");
    const billingAge = createdAt - billingCapturedAt;
    add(
      Number.isFinite(billingAge) && billingAge >= -300_000 && billingAge <= 86_400_000,
      "Billing release evidence must be captured within 24 hours before the final manifest.",
      "final",
    );
  }
  const launchGovernance = manifest.evidence?.launchGovernance;
  add(Boolean(launchGovernance), "Release-bound legal, policy, product-claim, and support approval is required.", "final");
  if (launchGovernance) {
    const authorizedCandidateSHA256 =
      iOSDistribution?.candidate?.manifestSHA256 ??
      macOSDistribution?.candidate?.manifestSHA256 ??
      null;
    const governanceResult = validateLaunchGovernanceEvidence(launchGovernance, {
      releaseId: manifest.releaseId,
      sourceCommit: manifest.source?.commit,
      sourceBranch: manifest.source?.branch,
      candidateSHA256: authorizedCandidateSHA256,
      vercelDeploymentId: manifest.deployments?.vercelDeploymentId,
      remoteEvidence,
      publicSurfaces,
      billingRelease,
    });
    for (const error of governanceResult.errors) {
      add(false, `Launch governance: ${error}`, "final");
    }
    add(
      hashJson(launchGovernance) === manifest.evidence?.launchGovernanceSHA256,
      "Launch governance evidence SHA-256 differs.",
      "final",
    );
    const governanceCapturedAt = Date.parse(launchGovernance.capturedAt ?? "");
    const governanceAge = createdAt - governanceCapturedAt;
    add(
      Number.isFinite(governanceAge) && governanceAge >= -300_000 && governanceAge <= 86_400_000,
      "Launch governance evidence must be captured within 24 hours before the final manifest.",
      "final",
    );
  }
  const appStoreRelease = manifest.evidence?.appStoreRelease;
  add(Boolean(appStoreRelease), "Release-bound App Store listing, privacy, TestFlight, device, review-path, and App Review evidence is required.", "final");
  if (appStoreRelease) {
    const authorizedCandidateSHA256 =
      iOSDistribution?.candidate?.manifestSHA256 ??
      macOSDistribution?.candidate?.manifestSHA256 ??
      null;
    const appStoreResult = validateAppStoreReleaseEvidence(appStoreRelease, {
      releaseId: manifest.releaseId,
      sourceCommit: manifest.source?.commit,
      sourceBranch: manifest.source?.branch,
      candidateSHA256: authorizedCandidateSHA256,
      iOSDistribution,
      billingRelease,
      publicSurfaces,
      repositoryRoot: repositoryRoot ?? DEFAULT_ROOT,
    });
    for (const error of appStoreResult.errors) {
      add(false, `App Store release: ${error}`, "final");
    }
    add(
      hashJson(appStoreRelease) === manifest.evidence?.appStoreReleaseSHA256,
      "App Store release evidence SHA-256 differs.",
      "final",
    );
    const appStoreCapturedAt = Date.parse(appStoreRelease.capturedAt ?? "");
    const appStoreAge = createdAt - appStoreCapturedAt;
    add(
      Number.isFinite(appStoreAge) && appStoreAge >= -300_000 && appStoreAge <= 86_400_000,
      "App Store release evidence must be captured within 24 hours before the final manifest.",
      "final",
    );
  }
  const launchJourneys = manifest.evidence?.launchJourneys;
  add(Boolean(launchJourneys), "Release-bound one-product Relay journey evidence is required.", "final");
  if (launchJourneys) {
    const authorizedCandidateSHA256 =
      macOSDistribution?.candidate?.manifestSHA256 ??
      iOSDistribution?.candidate?.manifestSHA256 ??
      null;
    const journeyResult = validateLaunchJourneyEvidence(launchJourneys, {
      releaseId: manifest.releaseId,
      sourceCommit: manifest.source?.commit,
      sourceBranch: manifest.source?.branch,
      candidateSHA256: authorizedCandidateSHA256,
      railwayDeploymentId: manifest.deployments?.railwayDeploymentId,
      vercelDeploymentId: manifest.deployments?.vercelDeploymentId,
      topology: railwayTopology,
      configuration: railwayConfiguration,
      remoteEvidence,
      macOSDistribution,
      iOSDistribution,
      components: manifest.components,
      connectEligibleSlugs: manifest.catalog?.connectEligibleSlugs,
    });
    for (const error of journeyResult.errors) {
      add(false, `Launch journeys: ${error}`, "final");
    }
    add(
      hashJson(launchJourneys) === manifest.evidence?.launchJourneysSHA256,
      "Launch journey evidence SHA-256 differs.",
      "final",
    );
    const journeyCapturedAt = Date.parse(launchJourneys.capturedAt ?? "");
    const journeyAge = createdAt - journeyCapturedAt;
    add(
      Number.isFinite(journeyAge) && journeyAge >= -300_000 && journeyAge <= 86_400_000,
      "Launch journey evidence must be captured within 24 hours before the final manifest.",
      "final",
    );
  }
  const productionChecklist = manifest.evidence?.productionChecklist;
  add(Boolean(productionChecklist), "Release-bound proof that the production checklist has zero open items is required.", "final");
  if (productionChecklist) {
    const authorizedCandidateSHA256 =
      macOSDistribution?.candidate?.manifestSHA256 ??
      iOSDistribution?.candidate?.manifestSHA256 ??
      null;
    const checklistResult = validateProductionChecklistEvidence(productionChecklist, {
      releaseId: manifest.releaseId,
      sourceBranch: manifest.source?.branch,
      sourceCommit: manifest.source?.commit,
      candidateSHA256: authorizedCandidateSHA256,
      repositoryRoot,
    });
    for (const error of checklistResult.errors) {
      add(false, `Production checklist: ${error}`, "final");
    }
    add(
      hashJson(productionChecklist) === manifest.evidence?.productionChecklistSHA256,
      "Production checklist evidence SHA-256 differs.",
      "final",
    );
    const checklistCapturedAt = Date.parse(productionChecklist.capturedAt ?? "");
    const checklistAge = createdAt - checklistCapturedAt;
    add(
      Number.isFinite(checklistAge) && checklistAge >= -300_000 && checklistAge <= 86_400_000,
      "Production checklist evidence must be captured within 24 hours before the final manifest.",
      "final",
    );
  }
  add(Boolean(manifest.evidence?.goNoGoOwner), "A named human go/no-go owner is required.", "candidate");
  const finalAcceptance = manifest.evidence?.finalAcceptance;
  add(Boolean(finalAcceptance), "A release-bound final acceptance record is required.", "final");
  if (finalAcceptance) {
    const acceptance = validateFinalAcceptance(finalAcceptance, manifest);
    for (const error of acceptance.errors) add(false, error, "final");
    add(
      hashJson(finalAcceptance) === manifest.evidence?.finalAcceptanceSHA256,
      "Final acceptance SHA-256 differs.",
      "final",
    );
  }
  if (repositoryRoot && manifestRank >= rank.candidate) {
    try {
      const releaseManifest = json(resolve(
        repositoryRoot,
        "packages/marketplace-catalog/release/marketplace-release-manifest.json",
      ));
      const acceptance = validateMarketplaceAcceptanceRepository({
        root: repositoryRoot,
        releaseManifest,
        topology: railwayTopology,
      });
      for (const error of acceptance.errors) {
        add(false, `Marketplace provider acceptance: ${error}`, "candidate");
      }
      add(
        manifest.catalog?.providerAcceptanceCount === acceptance.acceptedSlugs.length,
        "Marketplace provider-acceptance count differs from the candidate checkout.",
        "candidate",
      );
      add(
        manifest.catalog?.providerAcceptanceSHA256 === acceptance.acceptanceSHA256,
        "Marketplace provider-acceptance SHA-256 differs from the candidate checkout.",
        "candidate",
      );
    } catch (error) {
      add(false, `Marketplace provider acceptance could not be read: ${error.message}`, "candidate");
    }
    for (const error of validateReleaseCheckout(manifest, repositoryRoot)) {
      add(false, error, "candidate");
    }
    for (const error of validateFrozenRepositoryComponents(manifest, repositoryRoot)) {
      add(false, error, "candidate");
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function buildReleaseCandidate(options = {}) {
  const root = resolve(options.root ?? DEFAULT_ROOT);
  const bridgeRoot = resolve(options["bridge-repo"] ?? join(root, "../clawchat-bridge-plugins"));
  const status = ["candidate", "final"].includes(options.status) ? options.status : "draft";
  const source = gitIdentity(root);
  const bridgeSource = gitIdentity(bridgeRoot);
  const bridgeReleaseTag = requiredOption(options, "bridge-tag");
  const bridgeEvidence = bridgeReleaseEvidence({
    bridgeRoot,
    status,
    releaseTag: bridgeReleaseTag,
  });
  const mac = json(join(root, "RelayConsoleSwift/Sources/RelayConsoleCore/Resources/relay-console-release.json"));
  const iOSProject = readFileSync(join(root, "ios/project.yml"), "utf8");
  const iOSVersion = iOSProject.match(/CFBundleShortVersionString:\s*["']?([^"'\s]+)/)?.[1] ?? null;
  const iOSBuild = iOSProject.match(/CFBundleVersion:\s*["']?([^"'\s]+)/)?.[1] ?? null;
  const iOSBundle = iOSProject.match(/PRODUCT_BUNDLE_IDENTIFIER:\s*([^\s]+)/)?.[1] ?? null;
  const iOSMinimum = iOSProject.match(/iOS:\s*["']?([^"'\s]+)/)?.[1] ?? null;

  const migrationFiles = walk(join(root, "backend/src/migrations")).filter((path) => path.endsWith(".ts"));
  const migrationNumbers = migrationFiles
    .map((path) => Number.parseInt(basename(path).match(/^(\d+)_/)?.[1] ?? "", 10))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  const releaseManifestPath = join(root, "packages/marketplace-catalog/release/marketplace-release-manifest.json");
  const releaseManifest = json(releaseManifestPath);
  const freezeSourceAuditPath = requiredOption(options, "marketplace-freeze-source-audit");
  const freezeSourceAudit = freezeSourceAuditPath
    ? json(resolve(freezeSourceAuditPath))
    : null;
  const backendReleaseManifestPath = join(root, "backend/src/modules/marketplace/marketplace-release-manifest.json");
  const macReleaseManifestPath = join(root, "RelayConsoleSwift/Sources/RelayConsoleCore/Resources/marketplace-release-manifest.json");
  const releaseManifestParity =
    hashJson(releaseManifest) === hashJson(json(backendReleaseManifestPath))
    && hashJson(releaseManifest) === hashJson(json(macReleaseManifestPath));
  const providerManifests = walk(join(root, "packages/marketplace-catalog/providers")).filter((path) => path.endsWith("/manifest.json"));
  const swiftCatalogPath = join(root, "RelayConsoleSwift/Sources/RelayConsoleCore/ApplicationsService.swift");
  const backendCatalogPath = join(root, "backend/src/modules/marketplace/catalog/marketplace-catalog.ts");
  const registryPath = join(root, "backend/src/modules/marketplace/connectors/connector-registry.ts");
  const catalogFiles = [
    releaseManifestPath,
    backendReleaseManifestPath,
    macReleaseManifestPath,
    join(root, "packages/marketplace-catalog/schema/marketplace-release-manifest.schema.json"),
    join(root, "packages/marketplace-catalog/schema/marketplace-provider-acceptance.schema.json"),
    swiftCatalogPath,
    backendCatalogPath,
    registryPath,
    ...providerManifests,
    ...walk(join(root, "backend/src/modules/marketplace/connectors")).filter((path) => path.endsWith(".ts")),
  ];
  const swiftSlugs = uniqueMatches(readFileSync(swiftCatalogPath, "utf8"), /\bslug:\s*"([a-z0-9-]+)"/g);
  const backendSlugs = uniqueMatches(readFileSync(backendCatalogPath, "utf8"), /\bapp\(\s*"([a-z0-9-]+)"/g);
  const connectorSlugs = uniqueMatches(readFileSync(registryPath, "utf8"), /\[([A-Z0-9_]+)_CONNECTOR_MANIFEST\.slug/g);
  const bridgeCompatibility = join(bridgeRoot, "compatibility-manifest.json");
  const backendBridgeCompatibility = join(
    root,
    "backend/src/modules/bridge/bridge-compatibility-manifest.json",
  );
  const bridgeCompatibilityDocument = json(bridgeCompatibility);
  const backendBridgeCompatibilityDocument = json(backendBridgeCompatibility);
  const bridgeAcceptance = bridgeAcceptanceEvidence({
    bridgeRoot,
    release: bridgeCompatibilityDocument.release,
    verifyGate: true,
  });
  const bridgeCompatibilitySHA256 = hashJson(bridgeCompatibilityDocument);
  const backendBridgeCompatibilitySHA256 = hashJson(
    backendBridgeCompatibilityDocument,
  );
  const railwayTopologyPath = requiredOption(options, "railway-topology-snapshot");
  const railwayTopology = railwayTopologyPath
    ? json(resolve(railwayTopologyPath))
    : null;
  const marketplaceAcceptance = validateMarketplaceAcceptanceRepository({
    root,
    releaseManifest,
    topology: railwayTopology,
  });
  const acceptanceFiles = releaseManifest.providers
    .filter((provider) => provider.liveVerified)
    .map((provider) => provider.acceptance?.recordPath)
    .filter((path) => typeof path === "string" && /^packages\/marketplace-catalog\/release\/acceptance\/[a-z0-9-]+\.json$/.test(path))
    .map((path) => resolve(root, path))
    .filter((path) => existsSync(path));
  catalogFiles.push(...acceptanceFiles);
  const railwayConfigurationPath = requiredOption(
    options,
    "railway-configuration",
  );
  const railwayConfiguration = railwayConfigurationPath
    ? json(resolve(railwayConfigurationPath))
    : null;
  const remoteEvidencePath = requiredOption(options, "remote-evidence");
  const remoteEvidence = remoteEvidencePath
    ? json(resolve(remoteEvidencePath))
    : null;
  const publicSurfacesPath = requiredOption(options, "public-surfaces");
  const publicSurfaces = publicSurfacesPath
    ? json(resolve(publicSurfacesPath))
    : null;
  const macOSPublicationPath = requiredOption(options, "macos-publication-evidence");
  const macOSPublication = macOSPublicationPath
    ? json(resolve(macOSPublicationPath))
    : null;
  const productionSmokePath = requiredOption(options, "production-smoke");
  const productionSmoke = productionSmokePath
    ? json(resolve(productionSmokePath))
    : null;
  const failureRecoveryPath = requiredOption(options, "failure-recovery-evidence");
  const failureRecovery = failureRecoveryPath
    ? json(resolve(failureRecoveryPath))
    : null;
  const billingReleasePath = requiredOption(options, "billing-evidence");
  const billingRelease = billingReleasePath
    ? json(resolve(billingReleasePath))
    : null;
  const launchGovernancePath = requiredOption(options, "launch-governance-evidence");
  const launchGovernance = launchGovernancePath
    ? json(resolve(launchGovernancePath))
    : null;
  const appStoreReleasePath = requiredOption(options, "app-store-evidence");
  const appStoreRelease = appStoreReleasePath
    ? json(resolve(appStoreReleasePath))
    : null;
  const launchJourneysPath = requiredOption(options, "launch-journey-evidence");
  const launchJourneys = launchJourneysPath
    ? json(resolve(launchJourneysPath))
    : null;
  const productionChecklistPath = requiredOption(options, "production-checklist-evidence");
  const productionChecklist = productionChecklistPath
    ? json(resolve(productionChecklistPath))
    : null;
  const finalAcceptancePath = requiredOption(options, "final-acceptance");
  const finalAcceptance = finalAcceptancePath
    ? json(resolve(finalAcceptancePath))
    : null;
  const macOSDistributionPath = requiredOption(options, "macos-distribution-evidence");
  const macOSDistribution = macOSDistributionPath
    ? json(resolve(macOSDistributionPath))
    : null;
  const iOSDistributionPath = requiredOption(options, "ios-distribution-evidence");
  const iOSDistribution = iOSDistributionPath
    ? json(resolve(iOSDistributionPath))
    : null;

  return {
    schemaVersion: "relay.release-candidate.v1",
    status,
    releaseId: requiredOption(options, "release-id", `relay-console-${mac.version}-rc`),
    createdAt: new Date().toISOString(),
    source: { branch: source.branch, commit: source.commit, clean: source.clean },
    components: {
      backend: { version: componentVersion(root, "backend/package.json") },
      web: { version: componentVersion(root, "web/package.json") },
      website: { version: componentVersion(root, "Relay Console landing page/package.json") },
      macOS: {
        version: mac.version,
        build: mac.build,
        bundleIdentifier: mac.bundleIdentifier,
        minimumOS: mac.minimumMacOSVersion,
        architectures: ["arm64"],
      },
      iOS: { version: iOSVersion, build: iOSBuild, bundleIdentifier: iOSBundle, minimumOS: iOSMinimum },
    },
    contracts: {
      api: "v1",
      runtime: "bridge.v1",
      marketplace: "swift-marketplace.v1",
      deploymentManifest: "relay.deployment-manifest.v1",
      releaseManifest: "relay.release-manifest.v1",
    },
    database: {
      firstMigration: String(migrationNumbers.at(0) ?? "").padStart(3, "0"),
      lastMigration: String(migrationNumbers.at(-1) ?? "").padStart(3, "0"),
      migrationCount: migrationFiles.length,
      migrationSourceSHA256: hashFiles(root, migrationFiles),
    },
    catalog: {
      releaseManifestSchemaVersion: releaseManifest.schemaVersion,
      releaseManifestVersion: releaseManifest.manifestVersion,
      releaseChannel: releaseManifest.releaseChannel,
      freezeStatus: releaseManifest.freeze.status,
      frozenAt: releaseManifest.freeze.frozenAt,
      sourceRevision: releaseManifest.freeze.sourceRevision,
      freezeSourceAudit,
      freezeSourceAuditSHA256: freezeSourceAudit ? hashJson(freezeSourceAudit) : null,
      releaseManifestParity,
      reviewedProviderCount: releaseManifest.providers.length,
      connectEligibleSlugs: releaseManifest.providers
        .filter((provider) => provider.connectEligible)
        .map((provider) => provider.slug)
        .sort(),
      providerManifestCount: providerManifests.length,
      providerAcceptanceCount: marketplaceAcceptance.acceptedSlugs.length,
      providerAcceptanceSHA256: marketplaceAcceptance.acceptanceSHA256,
      swiftSlugCount: swiftSlugs.length,
      backendSlugCount: backendSlugs.length,
      connectorCount: connectorSlugs.length,
      sourceSHA256: hashFiles(root, catalogFiles),
    },
    bridge: {
      branch: bridgeSource.branch,
      commit: bridgeSource.commit,
      clean: bridgeSource.clean,
      release: bridgeCompatibilityDocument.release,
      releaseStatus: bridgeCompatibilityDocument.releaseStatus,
      releaseTag: bridgeReleaseTag,
      ...bridgeEvidence,
      supportedBackend: bridgeCompatibilityDocument.supportedBackend,
      plugins: bridgeCompatibilityDocument.plugins
        .map((plugin) => ({
          id: plugin.id,
          version: plugin.version,
          supportedHarness: plugin.supportedHarness,
          candidateHostOS: [...plugin.candidateHostOS].sort(),
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      acceptance: bridgeAcceptance,
      compatibilityManifestSHA256: bridgeCompatibilitySHA256,
      backendCompatibilityManifestSHA256:
        backendBridgeCompatibilitySHA256,
      compatibilityParity:
        bridgeCompatibilitySHA256 === backendBridgeCompatibilitySHA256,
    },
    deployments: {
      railwayDeploymentId: railwayTopology?.production?.backend?.deployment?.id ?? null,
      vercelDeploymentId: remoteEvidence?.vercel?.githubDeploymentId
        ? String(remoteEvidence.vercel.githubDeploymentId)
        : null,
      railwayTopology,
      railwayTopologySHA256: railwayTopology ? hashJson(railwayTopology) : null,
      railwayConfiguration,
      railwayConfigurationSHA256: railwayConfiguration
        ? hashJson(railwayConfiguration)
        : null,
    },
    artifacts: {
      macOSDistribution,
      macOSDistributionSHA256: macOSDistribution ? hashJson(macOSDistribution) : null,
      iOSDistribution,
      iOSDistributionSHA256: iOSDistribution ? hashJson(iOSDistribution) : null,
    },
    evidence: {
      remote: remoteEvidence,
      remoteSHA256: remoteEvidence ? hashJson(remoteEvidence) : null,
      publicSurfaces,
      publicSurfacesSHA256: publicSurfaces ? hashJson(publicSurfaces) : null,
      macOSPublication,
      macOSPublicationSHA256: macOSPublication ? hashJson(macOSPublication) : null,
      productionSmoke,
      productionSmokeSHA256: productionSmoke ? hashJson(productionSmoke) : null,
      failureRecovery,
      failureRecoverySHA256: failureRecovery ? hashJson(failureRecovery) : null,
      billingRelease,
      billingReleaseSHA256: billingRelease ? hashJson(billingRelease) : null,
      launchGovernance,
      launchGovernanceSHA256: launchGovernance ? hashJson(launchGovernance) : null,
      appStoreRelease,
      appStoreReleaseSHA256: appStoreRelease ? hashJson(appStoreRelease) : null,
      launchJourneys,
      launchJourneysSHA256: launchJourneys ? hashJson(launchJourneys) : null,
      productionChecklist,
      productionChecklistSHA256: productionChecklist ? hashJson(productionChecklist) : null,
      goNoGoOwner: requiredOption(options, "go-no-go-owner"),
      finalAcceptance,
      finalAcceptanceSHA256: finalAcceptance ? hashJson(finalAcceptance) : null,
    },
  };
}

function main() {
  const options = args(process.argv.slice(2));
  if (options.validate) {
    const manifest = json(resolve(String(options.validate)));
    const result = validateReleaseCandidate(
      manifest,
      String(options.require ?? "draft"),
      { repositoryRoot: options.root ? resolve(String(options.root)) : DEFAULT_ROOT },
    );
    for (const warning of result.warnings) process.stderr.write(`WARNING: ${warning}\n`);
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    if (!result.valid) process.exitCode = 1;
    else process.stdout.write(`Release manifest valid (${manifest.status}).\n`);
    return;
  }
  const manifest = buildReleaseCandidate(options);
  const result = validateReleaseCandidate(manifest, "draft", {
    repositoryRoot: DEFAULT_ROOT,
  });
  const payload = `${JSON.stringify(manifest, null, 2)}\n`;
  if (options.output) writeFileSync(resolve(String(options.output)), payload);
  else process.stdout.write(payload);
  for (const warning of result.warnings) process.stderr.write(`WARNING: ${warning}\n`);
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  if (!result.valid) process.exitCode = 1;
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) main();
