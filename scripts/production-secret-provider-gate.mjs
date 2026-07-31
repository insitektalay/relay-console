#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { PRODUCTION_SECRET_POLICY } from "../backend/security/production-secret-audit.mjs";
import { captureLiveRailwayTopology } from "./railway-release-topology.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const SCHEMA_PATH = resolve(
  DEFAULT_ROOT,
  "RelayConsoleSwift/Release/production-secret-provider-evidence.schema.json",
);
const EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ATTESTATION_MAX_SKEW_MS = 15 * 60 * 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FORBIDDEN_PROVIDER_FIELD =
  /^(?:value|values|secret|secrets|token|tokens|password|passwords|privateKey|private_key|credential|credentials)$/i;
const SECRET_SHAPED_NAME =
  /(?:SECRET|TOKEN|PASSWORD|PRIVATE|ENCRYPTION|WEBHOOK|OAUTH|API_KEY|ACCESS_KEY)/i;

function json(path) {
  return JSON.parse(readFileSync(resolve(String(path)), "utf8"));
}

function iso(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return null;
}

function timestamp(value) {
  const normalized = iso(value);
  return normalized ? Date.parse(normalized) : Number.NaN;
}

function rejectValueBearingFields(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectValueBearingFields(item, `${path}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_PROVIDER_FIELD.test(key)) {
      throw new Error(`Provider metadata contains forbidden field at ${path}.${key}.`);
    }
    rejectValueBearingFields(nested, `${path}.${key}`);
  }
}

function railwayIdentityFromTopology(topology) {
  const backend = topology?.production?.backend;
  return {
    projectId: topology?.project?.id ?? "",
    environmentId: topology?.production?.id ?? "",
    serviceId: backend?.serviceId ?? "",
    deploymentId: backend?.deployment?.id ?? "",
    sourceCommit: backend?.deployment?.sourceCommit ?? "",
  };
}

function sameRailwayDeployment(left, right) {
  return (
    JSON.stringify(railwayIdentityFromTopology(left)) ===
    JSON.stringify(railwayIdentityFromTopology(right))
  );
}

function normalizeVercelVariable(record) {
  const targets = Array.isArray(record?.target)
    ? [...new Set(record.target.filter((item) => typeof item === "string"))].sort()
    : [];
  return {
    id: typeof record?.id === "string" ? record.id : "",
    key: typeof record?.key === "string" ? record.key : "",
    type: typeof record?.type === "string" ? record.type : "",
    targets,
    createdAt: iso(record?.createdAt),
    updatedAt: iso(record?.updatedAt ?? record?.createdAt),
    gitBranch:
      typeof record?.gitBranch === "string" && record.gitBranch
        ? record.gitBranch
        : null,
    customEnvironmentIds: Array.isArray(record?.customEnvironmentIds)
      ? record.customEnvironmentIds
          .filter((item) => typeof item === "string")
          .sort()
      : [],
  };
}

function normalizeVercelDeployment(deployment) {
  return {
    id:
      typeof deployment?.uid === "string"
        ? deployment.uid
        : typeof deployment?.id === "string"
          ? deployment.id
          : "",
    projectId:
      typeof deployment?.projectId === "string"
        ? deployment.projectId
        : typeof deployment?.project?.id === "string"
          ? deployment.project.id
          : "",
    state:
      typeof deployment?.readyState === "string"
        ? deployment.readyState
        : typeof deployment?.state === "string"
          ? deployment.state
          : "",
    target: typeof deployment?.target === "string" ? deployment.target : "",
    sourceCommit:
      typeof deployment?.meta?.githubCommitSha === "string"
        ? deployment.meta.githubCommitSha.toLowerCase()
        : typeof deployment?.sourceCommit === "string"
          ? deployment.sourceCommit.toLowerCase()
          : "",
    createdAt: iso(deployment?.createdAt),
    url:
      typeof deployment?.url === "string" && deployment.url
        ? `https://${deployment.url.replace(/^https?:\/\//, "")}`
        : null,
  };
}

function safeRailwayAttestation(attestation) {
  return {
    schemaVersion: attestation?.schemaVersion ?? null,
    capturedAt: attestation?.capturedAt ?? null,
    status: attestation?.status ?? null,
    identity: attestation?.identity ?? null,
    features: attestation?.features ?? null,
    coverage: attestation?.coverage ?? null,
    materials: Array.isArray(attestation?.materials)
      ? attestation.materials
      : [],
    lifecycle: attestation?.lifecycle ?? null,
    privacy: attestation?.privacy ?? null,
  };
}

function configuredVercelProductionVariables(records) {
  return records
    .map(normalizeVercelVariable)
    .filter((record) => record.targets.includes("production"))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function buildSafeProductionSecretProviderEvidence({
  railwayAttestation,
  railwayTopologyBefore,
  railwayTopologyAfter = railwayTopologyBefore,
  vercelEnvironmentResponse,
  vercelDeployment,
  sourceCommit,
  capturedAt = new Date().toISOString(),
}) {
  rejectValueBearingFields(vercelEnvironmentResponse);
  const environmentRecords = Array.isArray(vercelEnvironmentResponse)
    ? vercelEnvironmentResponse
    : Array.isArray(vercelEnvironmentResponse?.envs)
      ? vercelEnvironmentResponse.envs
      : [];
  const variables = configuredVercelProductionVariables(environmentRecords);
  const deployment = normalizeVercelDeployment(vercelDeployment);
  const stableRailwayDeployment = sameRailwayDeployment(
    railwayTopologyBefore,
    railwayTopologyAfter,
  );
  const evidence = {
    schemaVersion: "relay.production-secret-provider-evidence.v1",
    capturedAt: iso(capturedAt),
    status: "failed",
    sourceCommit: String(sourceCommit ?? "").toLowerCase(),
    railway: {
      stableDeployment: stableRailwayDeployment,
      topologyCapturedAt: iso(railwayTopologyAfter?.capturedAt),
      identity: railwayIdentityFromTopology(railwayTopologyAfter),
      attestation: safeRailwayAttestation(railwayAttestation),
    },
    vercel: {
      identity: {
        teamId: PRODUCTION_SECRET_POLICY.vercel.teamId,
        projectId: PRODUCTION_SECRET_POLICY.vercel.projectId,
        projectName: PRODUCTION_SECRET_POLICY.vercel.projectName,
      },
      deployment,
      variables,
    },
    privacy: {
      providerValuesRetrieved: false,
      providerValuesIncluded: false,
      secretFingerprintsIncluded: false,
      credentialLengthsIncluded: false,
    },
  };
  const provisional = validateProductionSecretProviderEvidence(evidence, {
    now: capturedAt,
    skipStatus: true,
  });
  evidence.status = provisional.valid ? "passed" : "failed";
  return evidence;
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
addFormats(ajv);
const schemaValidator = ajv.compile(json(SCHEMA_PATH));

function schemaErrors(value) {
  if (schemaValidator(value)) return [];
  return (schemaValidator.errors ?? []).map(
    (error) => `${error.instancePath || "$"} ${error.message}`,
  );
}

function exactSet(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every((item, index) => item === expected[index])
  );
}

export function validateProductionSecretProviderEvidence(
  evidence,
  {
    sourceCommit = null,
    now = new Date().toISOString(),
    skipStatus = false,
  } = {},
) {
  const errors = schemaErrors(evidence).map((error) => `Schema: ${error}.`);
  const expectedRailway = PRODUCTION_SECRET_POLICY.railway;
  const expectedVercel = PRODUCTION_SECRET_POLICY.vercel;
  const captureTime = timestamp(evidence?.capturedAt);
  const currentTime = timestamp(now);

  if (!skipStatus && evidence?.status !== "passed") {
    errors.push("Production secret provider evidence did not pass.");
  }
  if (!Number.isFinite(captureTime)) {
    errors.push("Evidence capture time is invalid.");
  } else if (
    Number.isFinite(currentTime) &&
    (captureTime > currentTime + ATTESTATION_MAX_SKEW_MS ||
      currentTime - captureTime > EVIDENCE_MAX_AGE_MS)
  ) {
    errors.push("Production secret provider evidence is stale or future-dated.");
  }
  if (!/^[a-f0-9]{40}$/.test(evidence?.sourceCommit ?? "")) {
    errors.push("Evidence source commit is not a full Git commit.");
  }
  if (sourceCommit && evidence?.sourceCommit !== sourceCommit) {
    errors.push("Evidence source commit differs from the release commit.");
  }

  const railway = evidence?.railway;
  const topologyTime = timestamp(railway?.topologyCapturedAt);
  if (
    !Number.isFinite(topologyTime) ||
    !Number.isFinite(captureTime) ||
    topologyTime > captureTime + ATTESTATION_MAX_SKEW_MS ||
    captureTime - topologyTime > ATTESTATION_MAX_SKEW_MS
  ) {
    errors.push("Railway topology is not fresh for this capture.");
  }
  if (railway?.stableDeployment !== true) {
    errors.push("Railway deployment changed during evidence capture.");
  }
  for (const [key, expected] of Object.entries({
    projectId: expectedRailway.projectId,
    environmentId: expectedRailway.environmentId,
    serviceId: expectedRailway.serviceId,
  })) {
    if (railway?.identity?.[key] !== expected) {
      errors.push(`Railway ${key} differs from production policy.`);
    }
  }
  if (!UUID_PATTERN.test(railway?.identity?.deploymentId ?? "")) {
    errors.push("Railway deployment identity is missing or invalid.");
  }
  if (railway?.identity?.sourceCommit !== evidence?.sourceCommit) {
    errors.push("Railway topology is not bound to the release commit.");
  }

  const attestation = railway?.attestation;
  if (
    attestation?.schemaVersion !== "relay.production-secret-audit.v2" ||
    attestation?.status !== "passed"
  ) {
    errors.push("Railway runtime secret attestation did not pass.");
  }
  for (const [key, expected] of Object.entries({
    projectId: railway?.identity?.projectId,
    environmentId: railway?.identity?.environmentId,
    environmentName: expectedRailway.environmentName,
    serviceId: railway?.identity?.serviceId,
    serviceName: expectedRailway.serviceName,
    deploymentId: railway?.identity?.deploymentId,
    sourceCommit: evidence?.sourceCommit,
  })) {
    if (attestation?.identity?.[key] !== expected) {
      errors.push(`Railway attestation ${key} differs from live topology.`);
    }
  }
  const attestationTime = timestamp(attestation?.capturedAt);
  if (
    !Number.isFinite(attestationTime) ||
    !Number.isFinite(captureTime) ||
    Math.abs(captureTime - attestationTime) > ATTESTATION_MAX_SKEW_MS
  ) {
    errors.push("Railway attestation is not fresh for this capture.");
  }
  if (
    attestation?.privacy?.secretValuesIncluded !== false ||
    attestation?.privacy?.secretFingerprintsIncluded !== false ||
    attestation?.privacy?.credentialLengthsIncluded !== false ||
    attestation?.privacy?.providerVariableValuesRetrieved !== false
  ) {
    errors.push("Railway attestation violates the value-free privacy contract.");
  }
  if (
    attestation?.coverage?.coreSecretCount !== 11 ||
    attestation?.coverage?.databaseCredentialChecked !== true ||
    attestation?.coverage?.redisCredentialChecked !== true ||
    attestation?.coverage?.cookieSigningUsesJwtSecrets !== true ||
    attestation?.coverage?.csrfUsesPerSessionRandomUuid !== true ||
    attestation?.coverage?.publicSecretVariableCount !== 0 ||
    attestation?.coverage?.distinctMaterialChecked !== true ||
    attestation?.coverage?.lifecycleRegistryChecked !== true ||
    attestation?.coverage?.deploymentIdentityChecked !== true ||
    attestation?.coverage?.connectionDescriptorKeyPairVerified !== true
  ) {
    errors.push("Railway attestation coverage is incomplete.");
  }
  if (
    attestation?.features?.signupMode !== "invite" ||
    attestation?.features?.marketplaceBetaGate !== true
  ) {
    errors.push("Railway attestation does not describe the production feature posture.");
  }
  if (
    !Array.isArray(attestation?.materials) ||
    !attestation.materials.length ||
    attestation.materials.some(
      (material) =>
        material?.present !== true ||
        material?.strengthPolicyPassed !== true ||
        material?.distinctMaterialPassed !== true ||
        material?.lifecycleTracked !== true,
    )
  ) {
    errors.push("Railway material strength, separation, or lifecycle is incomplete.");
  }
  const materialNames = (attestation?.materials ?? [])
    .map(({ name }) => name)
    .sort();
  const lifecycleNames = (attestation?.lifecycle?.materials ?? [])
    .map(({ name }) => name)
    .sort();
  if (
    attestation?.lifecycle?.schemaVersion !== "relay.secret-lifecycle.v1" ||
    new Set(materialNames).size !== materialNames.length ||
    new Set(lifecycleNames).size !== lifecycleNames.length ||
    !exactSet(materialNames, lifecycleNames) ||
    attestation?.coverage?.materialCount !== materialNames.length
  ) {
    errors.push("Railway lifecycle registry does not exactly cover audited material.");
  }
  const maximumReviewAge =
    PRODUCTION_SECRET_POLICY.lifecycle.maximumReviewAgeDays * 24 * 60 * 60 * 1000;
  const maximumRotationAge =
    PRODUCTION_SECRET_POLICY.lifecycle.maximumRotationAgeDays *
    24 *
    60 *
    60 *
    1000;
  const minimumReviewLead =
    PRODUCTION_SECRET_POLICY.lifecycle.minimumReviewLeadDays *
    24 *
    60 *
    60 *
    1000;
  for (const material of attestation?.lifecycle?.materials ?? []) {
    const rotated = timestamp(material.lastRotatedAt);
    const reviewed = timestamp(material.lastReviewedAt);
    const nextReview = timestamp(material.nextReviewAt);
    if (
      !Number.isFinite(attestationTime) ||
      !Number.isFinite(rotated) ||
      !Number.isFinite(reviewed) ||
      !Number.isFinite(nextReview) ||
      rotated > reviewed ||
      reviewed > attestationTime ||
      attestationTime - reviewed > maximumReviewAge ||
      attestationTime - rotated > maximumRotationAge ||
      nextReview - attestationTime < minimumReviewLead
    ) {
      errors.push(`Railway lifecycle record ${material.name} is invalid or stale.`);
    }
  }

  const vercel = evidence?.vercel;
  for (const [key, expected] of Object.entries({
    teamId: expectedVercel.teamId,
    projectId: expectedVercel.projectId,
    projectName: expectedVercel.projectName,
  })) {
    if (vercel?.identity?.[key] !== expected) {
      errors.push(`Vercel ${key} differs from production policy.`);
    }
  }
  const deployment = vercel?.deployment;
  if (
    deployment?.projectId !== expectedVercel.projectId ||
    deployment?.state !== "READY" ||
    deployment?.target !== "production" ||
    deployment?.sourceCommit !== evidence?.sourceCommit
  ) {
    errors.push("Vercel deployment is not the exact ready production release.");
  }
  const deploymentTime = timestamp(deployment?.createdAt);
  if (!deployment?.id || !Number.isFinite(deploymentTime)) {
    errors.push("Vercel deployment identity or timestamp is invalid.");
  }
  if (
    Number.isFinite(deploymentTime) &&
    Number.isFinite(captureTime) &&
    deploymentTime > captureTime
  ) {
    errors.push("Vercel deployment is future-dated relative to the capture.");
  }
  try {
    const deploymentURL = new URL(deployment?.url ?? "");
    if (
      deploymentURL.protocol !== "https:" ||
      !deploymentURL.hostname.endsWith(".vercel.app") ||
      deploymentURL.username ||
      deploymentURL.password ||
      deploymentURL.pathname !== "/" ||
      deploymentURL.search ||
      deploymentURL.hash
    ) {
      errors.push("Vercel deployment URL is not an exact HTTPS Vercel origin.");
    }
  } catch {
    errors.push("Vercel deployment URL is invalid.");
  }

  const variables = Array.isArray(vercel?.variables) ? vercel.variables : [];
  const names = variables.map(({ key }) => key).sort();
  const variableIds = variables.map(({ id }) => id);
  if (
    new Set(names).size !== names.length ||
    new Set(variableIds).size !== variableIds.length
  ) {
    errors.push("Vercel production variable metadata contains duplicates.");
  }
  const required = [...expectedVercel.requiredProductionNames].sort();
  const allowed = new Set(expectedVercel.allowedProductionNames);
  const forbidden = new Set(expectedVercel.forbiddenProductionNames);
  for (const name of required) {
    if (!names.includes(name)) {
      errors.push(`Vercel production variable ${name} is missing.`);
    }
  }
  for (const variable of variables) {
    if (!allowed.has(variable.key)) {
      errors.push(`Vercel production variable ${variable.key} is not approved.`);
    }
    if (forbidden.has(variable.key) || SECRET_SHAPED_NAME.test(variable.key)) {
      errors.push(`Vercel production variable ${variable.key} is forbidden.`);
    }
    if (
      variable.type !== "sensitive" ||
      !exactSet(variable.targets, ["production"]) ||
      variable.gitBranch !== null ||
      variable.customEnvironmentIds.length !== 0
    ) {
      errors.push(`Vercel production variable ${variable.key} has unsafe scope or storage.`);
    }
    const created = timestamp(variable.createdAt);
    const updated = timestamp(variable.updatedAt);
    if (
      !Number.isFinite(created) ||
      !Number.isFinite(updated) ||
      updated < created ||
      !Number.isFinite(deploymentTime) ||
      updated > deploymentTime
    ) {
      errors.push(`Vercel production variable ${variable.key} is not bound to the deployment.`);
    }
  }

  if (
    evidence?.privacy?.providerValuesRetrieved !== false ||
    evidence?.privacy?.providerValuesIncluded !== false ||
    evidence?.privacy?.secretFingerprintsIncluded !== false ||
    evidence?.privacy?.credentialLengthsIncluded !== false
  ) {
    errors.push("Provider evidence violates the value-free privacy contract.");
  }
  return { valid: errors.length === 0, errors };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const key = argument.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

async function vercelJson(path, token) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`Vercel metadata request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

function railwayRuntimeAttestation(cwd) {
  const output = execFileSync(
    "railway",
    [
      "ssh",
      "--service",
      PRODUCTION_SECRET_POLICY.railway.serviceName,
      "--environment",
      PRODUCTION_SECRET_POLICY.railway.environmentName,
      "--",
      "node",
      "security/production-secret-audit.mjs",
    ],
    {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return JSON.parse(output);
}

async function captureLive({ root, sourceCommit, vercelToken }) {
  const backendRoot = resolve(root, "backend");
  const topologyBefore = captureLiveRailwayTopology({ cwd: backendRoot });
  const railwayAttestation = railwayRuntimeAttestation(backendRoot);
  const topologyAfter = captureLiveRailwayTopology({ cwd: backendRoot });
  const teamId = encodeURIComponent(PRODUCTION_SECRET_POLICY.vercel.teamId);
  const projectId = encodeURIComponent(PRODUCTION_SECRET_POLICY.vercel.projectId);
  const environmentResponse = await vercelJson(
    `/v10/projects/${projectId}/env?teamId=${teamId}&decrypt=false`,
    vercelToken,
  );
  rejectValueBearingFields(environmentResponse);
  const deploymentsResponse = await vercelJson(
    `/v6/deployments?projectId=${projectId}&teamId=${teamId}&target=production&state=READY&limit=100`,
    vercelToken,
  );
  const deployment = (deploymentsResponse?.deployments ?? [])
    .map(normalizeVercelDeployment)
    .filter(
      (item) =>
        item.projectId === PRODUCTION_SECRET_POLICY.vercel.projectId &&
        item.state === "READY" &&
        item.target === "production" &&
        item.sourceCommit === sourceCommit,
    )
    .sort((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt))[0];
  if (!deployment) {
    throw new Error("No exact-commit ready Vercel production deployment exists.");
  }
  return buildSafeProductionSecretProviderEvidence({
    railwayAttestation,
    railwayTopologyBefore: topologyBefore,
    railwayTopologyAfter: topologyAfter,
    vercelEnvironmentResponse: environmentResponse,
    vercelDeployment: deployment,
    sourceCommit,
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.validate) {
    const evidence = json(options.validate);
    const result = validateProductionSecretProviderEvidence(evidence, {
      sourceCommit:
        typeof options["source-commit"] === "string"
          ? options["source-commit"]
          : null,
    });
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    if (!result.valid) process.exitCode = 1;
    else process.stdout.write("Production secret provider evidence is valid.\n");
    return;
  }
  if (!options.capture || typeof options["source-commit"] !== "string") {
    throw new Error(
      "Use --capture --source-commit <40-hex> or --validate <evidence.json>.",
    );
  }
  if (!/^[a-f0-9]{40}$/.test(options["source-commit"])) {
    throw new Error("--source-commit must be a full lowercase Git commit.");
  }
  const vercelToken = process.env.VERCEL_TOKEN;
  if (!vercelToken) throw new Error("VERCEL_TOKEN is required for live capture.");
  const evidence = await captureLive({
    root: resolve(options.root ?? DEFAULT_ROOT),
    sourceCommit: options["source-commit"],
    vercelToken,
  });
  const result = validateProductionSecretProviderEvidence(evidence, {
    sourceCommit: options["source-commit"],
  });
  const payload = `${JSON.stringify(evidence, null, 2)}\n`;
  if (options.output) writeFileSync(resolve(String(options.output)), payload);
  else process.stdout.write(payload);
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  if (!result.valid) process.exitCode = 1;
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  main().catch((error) => {
    process.stderr.write(
      `ERROR: production secret provider gate failed (${error instanceof Error ? error.name : "unknown_error"}).\n`,
    );
    process.exitCode = 1;
  });
}
