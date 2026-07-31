#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { captureLiveRailwayTopology } from "./railway-release-topology.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");
const SCHEMA_PATH = resolve(
  DEFAULT_ROOT,
  "RelayConsoleSwift/Release/railway-release-configuration.schema.json",
);
const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on"]);
const CANONICAL_BACKEND_ORIGIN = "https://api.relayconsole.work";
const CANONICAL_WEBSOCKET_ORIGIN = "wss://api.relayconsole.work";
const CANONICAL_WEB_ORIGIN = "https://relayconsole.work";

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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

export function hashRailwayConfiguration(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableJson(value)))
    .digest("hex");
}

function compileSchema() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(json(SCHEMA_PATH));
}

const schemaValidator = compileSchema();

function formatSchemaError(error) {
  const location = error.instancePath || "$";
  if (error.keyword === "additionalProperties") {
    return `${location}: unsupported field ${error.params.additionalProperty}`;
  }
  return `${location}: ${error.message ?? error.keyword}`;
}

export function validateRailwayConfigurationSchema(evidence) {
  if (schemaValidator(evidence)) return [];
  return (schemaValidator.errors ?? []).map(formatSchemaError);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function truthy(value) {
  return TRUE_VALUES.has(text(value).toLowerCase());
}

function hasAll(variables, keys) {
  return keys.every((key) => Boolean(text(variables[key])));
}

function hasDatabase(variables) {
  return (
    Boolean(text(variables.DATABASE_URL)) ||
    hasAll(variables, [
      "DATABASE_HOST",
      "DATABASE_NAME",
      "DATABASE_USER",
      "DATABASE_PASSWORD",
    ])
  );
}

function hasRedis(variables) {
  return (
    Boolean(text(variables.REDIS_URL) || text(variables.REDIS_PUBLIC_URL)) ||
    hasAll(variables, ["REDIS_HOST", "REDIS_PASSWORD"])
  );
}

function corsIncludesCanonicalWeb(value) {
  return text(value)
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .includes(CANONICAL_WEB_ORIGIN);
}

function normalizedSignupMode(value) {
  const mode = text(value).toLowerCase();
  return ["invite", "public"].includes(mode) ? mode : "unconfigured";
}

function boundIdentity(topology) {
  return {
    projectId: topology?.project?.id ?? null,
    environmentId: topology?.production?.id ?? null,
    serviceId: topology?.production?.backend?.serviceId ?? null,
    deploymentId: topology?.production?.backend?.deployment?.id ?? null,
    sourceCommit:
      topology?.production?.backend?.deployment?.sourceCommit ?? null,
  };
}

function sameBoundIdentity(left, right) {
  return JSON.stringify(boundIdentity(left)) === JSON.stringify(boundIdentity(right));
}

export function buildSafeRailwayConfigurationEvidence({
  variables,
  topology,
  productionSafetyValidatorPassed,
  liveTopologyMatched = true,
  capturedAt = new Date().toISOString(),
}) {
  const billingEnabled = truthy(variables.RELAY_BILLING_ENABLED);
  const billingConfigured = hasAll(variables, [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_RELAY_CLOUD_PRICE_ID",
    "RELAY_PUBLIC_WEB_ORIGIN",
  ]);
  const billingLiveMode =
    text(variables.STRIPE_SECRET_KEY).startsWith("sk_live_") &&
    text(variables.STRIPE_WEBHOOK_SECRET).startsWith("whsec_") &&
    text(variables.STRIPE_RELAY_CLOUD_PRICE_ID).startsWith("price_");
  const emailEnabled = truthy(variables.RELAY_TRANSACTIONAL_EMAIL_ENABLED);
  const emailConfigured =
    hasAll(variables, ["RESEND_API_KEY", "RELAY_EMAIL_FROM"]) &&
    text(variables.RESEND_API_KEY).startsWith("re_") &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(variables.RELAY_EMAIL_FROM));
  const appleEnabled = truthy(variables.RELAY_APPLE_BILLING_ENABLED);
  const appleConfigured = hasAll(variables, [
    "APPLE_BUNDLE_ID",
    "APPLE_APP_ID",
    "APPLE_RELAY_CLOUD_PRODUCT_ID",
    "APPLE_ROOT_CA_BASE64_JSON",
  ]);
  const canonicalOrigins = {
    backend:
      text(variables.RELAY_PUBLIC_BACKEND_ORIGIN) === CANONICAL_BACKEND_ORIGIN &&
      text(variables.CLAWCHAT_RAILWAY_ORIGIN) === CANONICAL_BACKEND_ORIGIN,
    websocket:
      text(variables.RELAY_PUBLIC_WEBSOCKET_ORIGIN) ===
      CANONICAL_WEBSOCKET_ORIGIN,
    web: text(variables.RELAY_PUBLIC_WEB_ORIGIN) === CANONICAL_WEB_ORIGIN,
    corsIncludesWeb: corsIncludesCanonicalWeb(variables.CORS_ORIGINS),
  };
  const signupMode = normalizedSignupMode(variables.CLAWCHAT_BETA_SIGNUP_MODE);
  const configuration = {
    productionSafetyValidatorPassed:
      productionSafetyValidatorPassed === true,
    nodeEnvironment: text(variables.NODE_ENV).toLowerCase(),
    databaseConfigured: hasDatabase(variables),
    redisConfigured: hasRedis(variables),
    canonicalOrigins,
    signup: {
      mode: signupMode,
      configured: signupMode !== "unconfigured",
    },
    marketplace: {
      betaGateEnabled: truthy(variables.CLAWCHAT_MARKETPLACE_BETA_MODE),
      cohortConfigured: hasAll(variables, [
        "CLAWCHAT_MARKETPLACE_ALLOWED_APPS",
        "CLAWCHAT_MARKETPLACE_BLOCKED_APPS",
      ]),
    },
    billing: {
      provider: "stripe",
      enabled: billingEnabled,
      configured: billingConfigured,
      liveMode: billingLiveMode,
    },
    transactionalEmail: {
      provider: "resend",
      enabled: emailEnabled,
      configured: emailConfigured,
    },
    appleBilling: {
      enabled: appleEnabled,
      configured: appleConfigured,
      bundleIdentifierMatches:
        text(variables.APPLE_BUNDLE_ID) === "com.relayconsole.app",
    },
    destructiveSeedingDisabled: !truthy(variables.SEED_ON_START),
  };
  const ready =
    liveTopologyMatched === true &&
    configuration.productionSafetyValidatorPassed &&
    configuration.nodeEnvironment === "production" &&
    configuration.databaseConfigured &&
    configuration.redisConfigured &&
    Object.values(configuration.canonicalOrigins).every(Boolean) &&
    configuration.signup.configured &&
    configuration.marketplace.betaGateEnabled &&
    configuration.marketplace.cohortConfigured &&
    configuration.billing.enabled &&
    configuration.billing.configured &&
    configuration.billing.liveMode &&
    configuration.transactionalEmail.enabled &&
    configuration.transactionalEmail.configured &&
    configuration.appleBilling.enabled &&
    configuration.appleBilling.configured &&
    configuration.appleBilling.bundleIdentifierMatches &&
    configuration.destructiveSeedingDisabled;

  return {
    schemaVersion: "relay.railway-release-configuration.v1",
    capturedAt,
    status: ready ? "ready" : "incomplete",
    identity: {
      projectId: topology?.project?.id ?? "",
      environmentId: topology?.production?.id ?? "",
      environmentName: "production",
      serviceId: topology?.production?.backend?.serviceId ?? "",
      serviceName: topology?.production?.backend?.serviceName ?? "",
      deploymentId: topology?.production?.backend?.deployment?.id ?? "",
      sourceCommit:
        topology?.production?.backend?.deployment?.sourceCommit ?? "",
      railwayTopologySHA256: hashRailwayConfiguration(topology),
      liveTopologyMatched: liveTopologyMatched === true,
    },
    configuration,
    privacy: {
      variableNamesIncluded: false,
      secretValuesIncluded: false,
    },
  };
}

export function validateRailwayReleaseConfiguration(
  evidence,
  { topology = null, releaseCommit = null } = {},
) {
  const errors = validateRailwayConfigurationSchema(evidence);
  if (evidence?.status !== "ready") {
    errors.push("Railway production configuration is incomplete.");
  }
  if (evidence?.identity?.liveTopologyMatched !== true) {
    errors.push("Railway configuration capture did not match one stable live deployment.");
  }
  const configuration = evidence?.configuration;
  const requiredCapabilities = [
    [
      configuration?.productionSafetyValidatorPassed === true,
      "backend production safety validator did not pass",
    ],
    [
      configuration?.nodeEnvironment === "production",
      "NODE_ENV is not production",
    ],
    [configuration?.databaseConfigured === true, "database is not configured"],
    [configuration?.redisConfigured === true, "Redis is not configured"],
    [configuration?.canonicalOrigins?.backend === true, "backend origin is not canonical"],
    [configuration?.canonicalOrigins?.websocket === true, "websocket origin is not canonical"],
    [configuration?.canonicalOrigins?.web === true, "web origin is not canonical"],
    [configuration?.canonicalOrigins?.corsIncludesWeb === true, "CORS omits the canonical web origin"],
    [configuration?.signup?.configured === true, "signup mode is not configured"],
    [
      ["invite", "public"].includes(configuration?.signup?.mode),
      "signup mode is unsupported",
    ],
    [configuration?.marketplace?.betaGateEnabled === true, "Marketplace beta gate is disabled"],
    [configuration?.marketplace?.cohortConfigured === true, "Marketplace cohort is not configured"],
    [configuration?.billing?.enabled === true, "Stripe billing is disabled"],
    [configuration?.billing?.configured === true, "Stripe billing is not configured"],
    [configuration?.billing?.liveMode === true, "Stripe billing is not in live mode"],
    [configuration?.transactionalEmail?.enabled === true, "transactional email is disabled"],
    [configuration?.transactionalEmail?.configured === true, "Resend is not configured"],
    [configuration?.appleBilling?.enabled === true, "Apple billing is disabled"],
    [configuration?.appleBilling?.configured === true, "Apple billing is not configured"],
    [
      configuration?.appleBilling?.bundleIdentifierMatches === true,
      "Apple billing bundle identifier differs",
    ],
    [
      configuration?.destructiveSeedingDisabled === true,
      "destructive seeding is enabled",
    ],
  ];
  for (const [passed, message] of requiredCapabilities) {
    if (!passed) errors.push(`Railway production capability failed: ${message}.`);
  }
  if (topology) {
    const expected = boundIdentity(topology);
    if (evidence?.identity?.projectId !== expected.projectId) {
      errors.push("Railway configuration project differs from the topology snapshot.");
    }
    if (evidence?.identity?.environmentId !== expected.environmentId) {
      errors.push("Railway configuration environment differs from the topology snapshot.");
    }
    if (evidence?.identity?.serviceId !== expected.serviceId) {
      errors.push("Railway configuration service differs from the topology snapshot.");
    }
    if (evidence?.identity?.deploymentId !== expected.deploymentId) {
      errors.push("Railway configuration deployment differs from the topology snapshot.");
    }
    if (evidence?.identity?.sourceCommit !== expected.sourceCommit) {
      errors.push("Railway configuration commit differs from the topology snapshot.");
    }
    if (
      evidence?.identity?.railwayTopologySHA256 !==
      hashRailwayConfiguration(topology)
    ) {
      errors.push("Railway configuration topology hash differs.");
    }
  }
  if (releaseCommit && evidence?.identity?.sourceCommit !== releaseCommit) {
    errors.push("Railway configuration does not belong to the release commit.");
  }
  return { valid: errors.length === 0, errors };
}

function parseArgs(argv) {
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

function railwayVariables(cwd, serviceName) {
  const output = execFileSync(
    "railway",
    [
      "variables",
      "--json",
      "--environment",
      "production",
      "--service",
      serviceName,
    ],
    { cwd, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  return JSON.parse(output);
}

function runProductionSafetyValidator(variables, root) {
  const backendRoot = resolve(root, "backend");
  const code = [
    'import { readFileSync } from "node:fs";',
    'import { assertProductionEnvironment } from "./src/config/production-env.ts";',
    'const env = JSON.parse(readFileSync(0, "utf8"));',
    "try { assertProductionEnvironment(env); process.exit(0); } catch { process.exit(1); }",
  ].join(" ");
  const result = spawnSync("pnpm", ["exec", "ts-node", "-e", code], {
    cwd: backendRoot,
    input: JSON.stringify(variables),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
  });
  return result.status === 0;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.validate) {
    const evidence = json(resolve(String(options.validate)));
    const topology = options["topology-snapshot"]
      ? json(resolve(String(options["topology-snapshot"])))
      : null;
    const result = validateRailwayReleaseConfiguration(evidence, {
      topology,
      releaseCommit:
        typeof options["release-commit"] === "string"
          ? options["release-commit"]
          : null,
    });
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    if (!result.valid) process.exitCode = 1;
    else process.stdout.write("Railway release configuration is valid.\n");
    return;
  }
  if (!options.capture || !options["topology-snapshot"]) {
    throw new Error(
      "Use --capture --topology-snapshot <snapshot.json> or --validate <evidence.json>.",
    );
  }

  const root = resolve(options.root ?? DEFAULT_ROOT);
  const cwd = resolve(options.cwd ?? resolve(root, "backend"));
  const topology = json(resolve(String(options["topology-snapshot"])));
  const serviceName = topology?.production?.backend?.serviceName;
  if (!serviceName) throw new Error("Topology snapshot has no production backend service.");
  const liveBefore = captureLiveRailwayTopology({ cwd });
  const variables = railwayVariables(cwd, serviceName);
  const productionSafetyValidatorPassed = runProductionSafetyValidator(
    variables,
    root,
  );
  const liveAfter = captureLiveRailwayTopology({ cwd });
  const liveTopologyMatched =
    sameBoundIdentity(topology, liveBefore) &&
    sameBoundIdentity(topology, liveAfter) &&
    sameBoundIdentity(liveBefore, liveAfter);
  const evidence = buildSafeRailwayConfigurationEvidence({
    variables,
    topology,
    productionSafetyValidatorPassed,
    liveTopologyMatched,
  });
  const result = validateRailwayReleaseConfiguration(evidence, {
    topology,
    releaseCommit:
      typeof options["release-commit"] === "string"
        ? options["release-commit"]
        : null,
  });
  const payload = `${JSON.stringify(evidence, null, 2)}\n`;
  if (options.output) writeFileSync(resolve(String(options.output)), payload);
  else process.stdout.write(payload);
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  if (!result.valid) process.exitCode = 1;
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `ERROR: Railway configuration capture failed (${error instanceof Error ? error.name : "unknown_error"}).\n`,
    );
    process.exitCode = 1;
  }
}
