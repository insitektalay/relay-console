#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const BACKEND_REPOSITORY = "insitektalay/relay-console";
const REQUIRED_SERVICES = ["Postgres", "Redis", "clawchat"];

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
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

function railwayJson(args, cwd) {
  return JSON.parse(execFileSync("railway", args, { cwd, encoding: "utf8" }));
}

function environmentNodes(status) {
  return status.environments?.edges?.map(({ node }) => node) ?? [];
}

function serviceNodes(environment) {
  return environment.serviceInstances?.edges?.map(({ node }) => node) ?? [];
}

function fullCommitFromCliMessage(value) {
  if (typeof value !== "string") return null;
  return value.match(/(?:^|[^a-f0-9])([a-f0-9]{40})(?:[^a-f0-9]|$)/i)?.[1]?.toLowerCase() ?? null;
}

function safeDeployment(deployment, backendConfig = null) {
  if (!deployment) return null;
  return {
    id: deployment.id ?? null,
    status: deployment.status ?? null,
    createdAt: deployment.createdAt ?? null,
    sourceCommit:
      deployment.meta?.commitHash ??
      fullCommitFromCliMessage(deployment.meta?.cliMessage),
    sourceBranch:
      deployment.meta?.branch ?? backendConfig?.source?.branch ?? null,
    sourceRepository:
      deployment.meta?.repo ?? backendConfig?.source?.repo ?? null,
  };
}

function safeEnvironment(environment, config) {
  if (!environment) return null;
  const services = serviceNodes(environment);
  const backend = services.find((service) => service.serviceName === "clawchat");
  const backendConfig = backend ? config?.services?.[backend.serviceId] : null;
  return {
    id: environment.id,
    name: environment.name,
    services: services.map((service) => service.serviceName).sort(),
    backend: backend ? {
      serviceId: backend.serviceId,
      serviceName: backend.serviceName,
      sourceRepository: backendConfig?.source?.repo ?? backend.source?.repo ?? null,
      sourceBranch: backendConfig?.source?.branch ?? null,
      checkSuites: backendConfig?.source?.checkSuites ?? null,
      rootDirectory: backendConfig?.source?.rootDirectory ?? null,
      deployment: safeDeployment(backend.latestDeployment, backendConfig),
    } : null,
  };
}

export function buildSafeRailwayTopology({ status, configs, capturedAt = new Date().toISOString() }) {
  const environments = environmentNodes(status);
  const production = environments.find((environment) => environment.name === "production");
  const staging = environments.find((environment) => environment.name === "staging");
  return {
    schemaVersion: "relay.railway-release-topology.v1",
    capturedAt,
    project: {
      id: status.id ?? null,
      name: status.name ?? null,
      workspaceName: status.workspace?.name ?? null,
    },
    production: safeEnvironment(production, configs.production),
    staging: safeEnvironment(staging, configs.staging),
  };
}

function isoTimestamp(value) {
  return typeof value === "string" && value.includes("T") && Number.isFinite(Date.parse(value));
}

function rejectUnknownKeys(value, allowedKeys, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) errors.push(`${label} contains unsupported field ${key}`);
  }
}

function validateEnvironment(environment, label, errors, { releaseCommit = null } = {}) {
  if (!environment) {
    errors.push(`${label} Railway environment is missing`);
    return;
  }
  rejectUnknownKeys(environment, ["id", "name", "services", "backend"], `${label} environment`, errors);
  rejectUnknownKeys(
    environment.backend,
    ["serviceId", "serviceName", "sourceRepository", "sourceBranch", "checkSuites", "rootDirectory", "deployment"],
    `${label} backend`,
    errors,
  );
  rejectUnknownKeys(
    environment.backend?.deployment,
    ["id", "status", "createdAt", "sourceCommit", "sourceBranch", "sourceRepository"],
    `${label} backend deployment`,
    errors,
  );
  if (!environment.id || environment.name !== label) errors.push(`${label} environment identity is invalid`);
  for (const service of REQUIRED_SERVICES) {
    if (!environment.services?.includes(service)) errors.push(`${label} environment is missing ${service}`);
  }
  if (environment.backend?.sourceRepository !== BACKEND_REPOSITORY) errors.push(`${label} backend source repository is incorrect`);
  if (environment.backend?.rootDirectory !== "/backend") errors.push(`${label} backend root directory must be /backend`);
  if (environment.backend?.checkSuites !== true) errors.push(`${label} backend must wait for GitHub check suites`);
  const deployment = environment.backend?.deployment;
  if (!deployment?.id) errors.push(`${label} backend deployment identity is missing`);
  if (deployment?.status !== "SUCCESS") errors.push(`${label} backend deployment must be successful`);
  if (!isoTimestamp(deployment?.createdAt)) errors.push(`${label} backend deployment createdAt must be an ISO timestamp`);
  if (!/^[a-f0-9]{40}$/.test(deployment?.sourceCommit ?? "")) errors.push(`${label} backend deployment must record a full source commit`);
  if (deployment?.sourceBranch !== environment.backend?.sourceBranch) errors.push(`${label} backend deployment branch differs from configured source branch`);
  if (deployment?.sourceRepository !== BACKEND_REPOSITORY) errors.push(`${label} backend deployment source repository is incorrect`);
  if (releaseCommit && label === "production" && deployment?.sourceCommit !== releaseCommit) {
    errors.push("production backend deployment commit differs from the release source commit");
  }
}

export function validateRailwayReleaseTopology(topology, { releaseBranch = null, releaseCommit = null } = {}) {
  const errors = [];
  rejectUnknownKeys(topology, ["schemaVersion", "capturedAt", "project", "production", "staging"], "topology", errors);
  rejectUnknownKeys(topology?.project, ["id", "name", "workspaceName"], "project", errors);
  if (topology?.schemaVersion !== "relay.railway-release-topology.v1") errors.push("unsupported Railway topology schema");
  if (!isoTimestamp(topology?.capturedAt)) errors.push("topology capturedAt must be an ISO timestamp");
  if (!topology?.project?.id || !topology?.project?.name) errors.push("Railway project identity is missing");
  validateEnvironment(topology?.production, "production", errors, { releaseCommit });
  validateEnvironment(topology?.staging, "staging", errors);
  if (topology?.production?.id && topology.production.id === topology?.staging?.id) errors.push("staging and production environment IDs must differ");

  const productionBranch = topology?.production?.backend?.sourceBranch;
  if (releaseBranch) {
    if (productionBranch !== releaseBranch) errors.push(`production backend must track ${releaseBranch}`);
  } else if (typeof productionBranch !== "string" || !productionBranch.startsWith("release/")) {
    errors.push("production backend must track a reviewed release/** branch");
  }
  const stagingBranch = topology?.staging?.backend?.sourceBranch;
  if (stagingBranch !== "codex/shared-marketplace-loop" && !(typeof stagingBranch === "string" && stagingBranch.startsWith("staging/"))) {
    errors.push("staging backend must track codex/shared-marketplace-loop or a staging/** branch");
  }
  if (productionBranch === stagingBranch && productionBranch) errors.push("staging and production must not track the same source branch");
  return { valid: errors.length === 0, errors };
}

export function captureLiveRailwayTopology({ cwd = process.cwd() } = {}) {
  const status = railwayJson(["status", "--json"], cwd);
  const environments = environmentNodes(status);
  const configs = {};
  for (const name of ["production", "staging"]) {
    if (environments.some((environment) => environment.name === name)) {
      configs[name] = railwayJson(["environment", "config", "--json", "--environment", name], cwd);
    }
  }
  return buildSafeRailwayTopology({ status, configs });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  let topology;
  if (options.capture) topology = captureLiveRailwayTopology({ cwd: options.cwd ? resolve(String(options.cwd)) : process.cwd() });
  else if (options.validate) topology = JSON.parse(readFileSync(resolve(String(options.validate)), "utf8"));
  else throw new Error("Use --capture or --validate <snapshot.json>.");

  const result = validateRailwayReleaseTopology(topology, {
    releaseBranch: typeof options["release-branch"] === "string" ? options["release-branch"] : null,
    releaseCommit: typeof options["release-commit"] === "string" ? options["release-commit"] : null,
  });
  const payload = `${JSON.stringify(topology, null, 2)}\n`;
  if (options.output) writeFileSync(resolve(String(options.output)), payload);
  else if (options.capture) process.stdout.write(payload);
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  if (!result.valid) process.exitCode = 1;
  else process.stderr.write("Railway release topology is valid.\n");
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) main();
