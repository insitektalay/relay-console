#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const RELEASE_REPOSITORY = "insitektalay/relay-console";
export const REQUIRED_CI_WORKFLOWS = Object.freeze({
  backend: "Backend Beta Readiness",
  web: "Web Beta Readiness",
  apple: "Apple Beta Readiness",
});

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

function ghJson(args, cwd) {
  return JSON.parse(execFileSync("gh", args, { cwd, encoding: "utf8" }));
}

function newest(values, dateKey) {
  return [...values].sort((left, right) => Date.parse(right?.[dateKey] ?? "") - Date.parse(left?.[dateKey] ?? ""));
}

function safeRun(run) {
  if (!run) return null;
  return {
    runId: run.databaseId,
    workflowName: run.workflowName,
    url: run.url,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.headSha,
    headBranch: run.headBranch,
    event: run.event,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

function selectRun(runs, workflowName, sourceCommit, sourceBranch) {
  return newest(
    runs.filter((run) =>
      run.workflowName === workflowName &&
      run.headSha === sourceCommit &&
      run.headBranch === sourceBranch &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      ["push", "workflow_dispatch"].includes(run.event)
    ),
    "updatedAt",
  )[0] ?? null;
}

function selectVercelDeployment(deployments, statusesByDeployment, sourceCommit) {
  const candidates = newest(
    deployments.filter((deployment) =>
      deployment.sha === sourceCommit &&
      deployment.environment === "Production" &&
      deployment.creator?.login === "vercel[bot]"
    ),
    "created_at",
  );
  for (const deployment of candidates) {
    const statuses = newest(statusesByDeployment[String(deployment.id)] ?? [], "updated_at");
    const status = statuses[0];
    if (status?.state !== "success" || status.creator?.login !== "vercel[bot]") continue;
    const deploymentURL = status.environment_url ?? status.target_url;
    if (typeof deploymentURL !== "string" || !deploymentURL.startsWith("https://")) continue;
    return {
      githubDeploymentId: deployment.id,
      sourceCommit: deployment.sha,
      sourceRef: deployment.ref,
      environment: deployment.environment,
      deploymentCreator: deployment.creator.login,
      state: status.state,
      statusCreator: status.creator.login,
      deploymentURL,
      createdAt: deployment.created_at,
      statusUpdatedAt: status.updated_at,
    };
  }
  return null;
}

export function buildReleaseRemoteEvidence({
  sourceCommit,
  sourceBranch,
  runs = [],
  deployments = [],
  statusesByDeployment = {},
  capturedAt = new Date().toISOString(),
}) {
  return {
    schemaVersion: "relay.release-remote-evidence.v1",
    capturedAt,
    repository: RELEASE_REPOSITORY,
    sourceCommit,
    sourceBranch,
    ciRuns: Object.fromEntries(
      Object.entries(REQUIRED_CI_WORKFLOWS).map(([key, workflowName]) => [
        key,
        safeRun(selectRun(runs, workflowName, sourceCommit, sourceBranch)),
      ]),
    ),
    vercel: selectVercelDeployment(deployments, statusesByDeployment, sourceCommit),
  };
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(JSON.parse(readFileSync(resolve(DEFAULT_ROOT, "RelayConsoleSwift/Release/release-remote-evidence.schema.json"), "utf8")));

function schemaErrors(value) {
  if (validateSchema(value)) return [];
  return (validateSchema.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`);
}

export function validateReleaseRemoteEvidence(evidence, { sourceCommit = null, sourceBranch = null } = {}) {
  const errors = schemaErrors(evidence).map((error) => `Schema: ${error}`);
  if (evidence?.repository !== RELEASE_REPOSITORY) errors.push("Remote evidence repository is incorrect.");
  if (sourceCommit && evidence?.sourceCommit !== sourceCommit) errors.push("Remote evidence source commit differs from the release source commit.");
  if (sourceBranch && evidence?.sourceBranch !== sourceBranch) errors.push("Remote evidence source branch differs from the release source branch.");
  for (const [key, workflowName] of Object.entries(REQUIRED_CI_WORKFLOWS)) {
    const run = evidence?.ciRuns?.[key];
    if (!run) {
      errors.push(`${workflowName} has no successful release-commit run.`);
      continue;
    }
    if (run.workflowName !== workflowName) errors.push(`${key} CI evidence names the wrong workflow.`);
    if (run.headSha !== evidence?.sourceCommit) errors.push(`${workflowName} ran against a different source commit.`);
    if (run.headBranch !== evidence?.sourceBranch) errors.push(`${workflowName} ran against a different source branch.`);
    if (run.status !== "completed" || run.conclusion !== "success") errors.push(`${workflowName} is not completed successfully.`);
    if (!run.url?.startsWith(`https://github.com/${RELEASE_REPOSITORY}/actions/runs/`)) errors.push(`${workflowName} URL is not a repository Actions run.`);
  }
  if (!evidence?.vercel) errors.push("No successful Vercel production deployment exists for the release commit.");
  else {
    if (evidence.vercel.sourceCommit !== evidence?.sourceCommit) errors.push("Vercel deployment source commit differs from the release source commit.");
    if (evidence.vercel.environment !== "Production") errors.push("Vercel evidence is not a Production deployment.");
    if (evidence.vercel.deploymentCreator !== "vercel[bot]" || evidence.vercel.statusCreator !== "vercel[bot]") errors.push("Vercel deployment evidence was not authored by Vercel.");
    if (evidence.vercel.state !== "success") errors.push("Vercel production deployment is not successful.");
  }
  return { valid: errors.length === 0, errors };
}

export function captureLiveReleaseRemoteEvidence({ sourceCommit, sourceBranch, cwd = DEFAULT_ROOT }) {
  const runs = ghJson([
    "run", "list", "--repo", RELEASE_REPOSITORY, "--commit", sourceCommit, "--limit", "100", "--json",
    "databaseId,url,status,conclusion,headSha,headBranch,workflowName,event,createdAt,updatedAt",
  ], cwd);
  const deployments = ghJson([
    "api", "-X", "GET", `repos/${RELEASE_REPOSITORY}/deployments`, "-f", `sha=${sourceCommit}`,
    "-f", "environment=Production", "-f", "per_page=100",
  ], cwd);
  const statusesByDeployment = {};
  for (const deployment of deployments.filter((item) => item.creator?.login === "vercel[bot]")) {
    statusesByDeployment[String(deployment.id)] = ghJson([
      "api", "-X", "GET", `repos/${RELEASE_REPOSITORY}/deployments/${deployment.id}/statuses`,
      "-f", "per_page=100",
    ], cwd);
  }
  return buildReleaseRemoteEvidence({ sourceCommit, sourceBranch, runs, deployments, statusesByDeployment });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  let evidence;
  if (options.capture) {
    if (typeof options["source-commit"] !== "string" || typeof options["source-branch"] !== "string") {
      throw new Error("--capture requires --source-commit and --source-branch.");
    }
    evidence = captureLiveReleaseRemoteEvidence({
      sourceCommit: options["source-commit"],
      sourceBranch: options["source-branch"],
      cwd: options.cwd ? resolve(String(options.cwd)) : DEFAULT_ROOT,
    });
  } else if (options.validate) evidence = JSON.parse(readFileSync(resolve(String(options.validate)), "utf8"));
  else throw new Error("Use --capture or --validate <evidence.json>.");

  const result = validateReleaseRemoteEvidence(evidence, {
    sourceCommit: typeof options["source-commit"] === "string" ? options["source-commit"] : null,
    sourceBranch: typeof options["source-branch"] === "string" ? options["source-branch"] : null,
  });
  const payload = `${JSON.stringify(evidence, null, 2)}\n`;
  if (options.output) writeFileSync(resolve(String(options.output)), payload);
  else if (options.capture) process.stdout.write(payload);
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  if (!result.valid) process.exitCode = 1;
  else process.stderr.write("Release remote evidence is valid.\n");
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) main();
