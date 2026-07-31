import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  auditProductionSecrets,
  runProductionSecretAuditCli,
} from "./production-secret-audit.mjs";

const CAPTURED_AT = "2026-07-27T12:00:00.000Z";

function attachLifecycle(
  env,
  {
    capturedAt = CAPTURED_AT,
    rotatedAt = "2026-05-16T12:00:00.000Z",
    reviewedAt = "2026-07-21T12:00:00.000Z",
    nextReviewAt = "2026-10-01T12:00:00.000Z",
  } = {},
) {
  env.RELAY_SECRET_LIFECYCLE_JSON = JSON.stringify({
    schemaVersion: "relay.secret-lifecycle.v1",
    materials: {},
  });
  const names = auditProductionSecrets(env, { capturedAt }).materials.map(
    ({ name }) => name,
  );
  env.RELAY_SECRET_LIFECYCLE_JSON = JSON.stringify({
    schemaVersion: "relay.secret-lifecycle.v1",
    materials: Object.fromEntries(
      names.map((name, index) => [
        name,
        {
          version: `v${index + 1}`,
          lastRotatedAt: rotatedAt,
          lastReviewedAt: reviewedAt,
          nextReviewAt,
        },
      ]),
    ),
  });
  return env;
}

function fixture(options = {}) {
  const pair = generateKeyPairSync("ed25519");
  const secret = (label) => `${label}-${randomBytes(32).toString("base64url")}`;
  const databasePassword = secret("database");
  const redisPassword = secret("redis");
  return attachLifecycle(
    {
      NODE_ENV: "production",
      RAILWAY_PROJECT_ID: "aac9cbd8-55be-428c-84d1-4bcc40f91483",
      RAILWAY_ENVIRONMENT_ID: "825cb83e-5fc4-4236-9d22-fd53578facfc",
      RAILWAY_ENVIRONMENT_NAME: "production",
      RAILWAY_SERVICE_ID: "3c87a016-e9c1-41a4-9b3c-2f755e55840b",
      RAILWAY_SERVICE_NAME: "clawchat",
      RAILWAY_DEPLOYMENT_ID: "d87ce04d-248b-41de-b1f3-ee31f068c435",
      RAILWAY_GIT_COMMIT_SHA: "a".repeat(40),
      JWT_SECRET: secret("access"),
      JWT_REFRESH_SECRET: secret("refresh"),
      JWT_WS_SECRET: secret("websocket"),
      APP_ENCRYPTION_KEY: `base64:${randomBytes(32).toString("base64")}`,
      ATTACHMENT_PROVENANCE_SECRET: secret("provenance"),
      ATTACHMENT_SIGNING_SECRET: secret("attachment"),
      CONNECTION_DESCRIPTOR_PRIVATE_KEY: pair.privateKey
        .export({ format: "der", type: "pkcs8" })
        .toString("base64"),
      CONNECTION_DESCRIPTOR_PUBLIC_KEY: pair.publicKey
        .export({ format: "der", type: "spki" })
        .toString("base64"),
      RELAY_OPERATOR_API_SECRET: secret("operator"),
      AUDIT_IDENTIFIER_HASH_SECRET: secret("audit-identifier"),
      CLAWCHAT_BETA_INVITE_HASH_SECRET: secret("invite-hash"),
      CLAWCHAT_BETA_INVITE_CODES: secret("invite-code"),
      CLAWCHAT_BETA_SIGNUP_MODE: "invite",
      CLAWCHAT_MARKETPLACE_BETA_MODE: "true",
      CLAWCHAT_MARKETPLACE_KILL_SWITCH: "false",
      RELAY_TRANSACTIONAL_EMAIL_ENABLED: "true",
      DATABASE_URL: `postgres://relay:${encodeURIComponent(databasePassword)}@database.example/relay`,
      REDIS_URL: `redis://:${encodeURIComponent(redisPassword)}@redis.example:6379`,
      RESEND_API_KEY: secret("resend"),
      GITHUB_CLIENT_SECRET: secret("github"),
    },
    options,
  );
}

test("passes a strong production secret posture without returning values", () => {
  const env = fixture();
  const result = auditProductionSecrets(env, {
    capturedAt: CAPTURED_AT,
  });

  assert.equal(result.status, "passed");
  assert.equal(result.schemaVersion, "relay.production-secret-audit.v2");
  assert.deepEqual(result.failures, []);
  assert.equal(
    result.identity.deploymentId,
    "d87ce04d-248b-41de-b1f3-ee31f068c435",
  );
  assert.equal(result.coverage.databaseCredentialChecked, true);
  assert.equal(result.coverage.redisCredentialChecked, true);
  assert.equal(result.coverage.connectionDescriptorKeyPairVerified, true);
  assert.equal(result.coverage.lifecycleRegistryChecked, true);
  assert.equal(
    result.materials.every(
      (material) =>
        material.strengthPolicyPassed &&
        material.distinctMaterialPassed &&
        material.lifecycleTracked,
    ),
    true,
  );
  assert.deepEqual(result.names.oauthSecrets, ["GITHUB_CLIENT_SECRET"]);
  const serialized = JSON.stringify(result);
  const secretValues = Object.entries(env)
    .filter(
      ([name]) =>
        name !== "RELAY_SECRET_LIFECYCLE_JSON" &&
        /(SECRET|PASSWORD|PRIVATE_KEY|ENCRYPTION_KEY|DATABASE_URL|REDIS_URL|INVITE_CODES)/.test(
          name,
        ),
    )
    .map(([, value]) => value);
  for (const value of secretValues) {
    if (typeof value === "string" && value.length >= 16) {
      assert.equal(serialized.includes(value), false);
    }
  }
});

test("accepts a different valid self-hosted Railway topology", () => {
  const env = fixture();
  env.RAILWAY_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
  env.RAILWAY_ENVIRONMENT_ID = "22222222-2222-4222-8222-222222222222";
  env.RAILWAY_SERVICE_ID = "33333333-3333-4333-8333-333333333333";
  env.RAILWAY_SERVICE_NAME = "relay-console-self-hosted";
  env.RAILWAY_DEPLOYMENT_ID = "44444444-4444-4444-8444-444444444444";

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });

  assert.equal(result.status, "passed");
  assert.deepEqual(result.failures, []);
  assert.equal(result.identity.projectId, env.RAILWAY_PROJECT_ID);
  assert.equal(result.identity.serviceId, env.RAILWAY_SERVICE_ID);
});

test("audits generic encryption keys, master keys, and provider tokens", () => {
  const env = fixture();
  env.RUNTIME_MIGRATION_ENCRYPTION_KEY = `migration-${randomBytes(32).toString("base64url")}`;
  env.MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY = `runtime-master-${randomBytes(32).toString("base64url")}`;
  env.RELAY_MANAGED_RAILWAY_TOKEN = `railway-${randomBytes(24).toString("base64url")}`;
  attachLifecycle(env);

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });

  assert.equal(result.status, "passed");
  assert.deepEqual(
    result.names.serviceSecrets.filter((name) =>
      [
        "MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY",
        "RELAY_MANAGED_RAILWAY_TOKEN",
        "RUNTIME_MIGRATION_ENCRYPTION_KEY",
      ].includes(name),
    ),
    [
      "MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY",
      "RELAY_MANAGED_RAILWAY_TOKEN",
      "RUNTIME_MIGRATION_ENCRYPTION_KEY",
    ],
  );
  assert.equal(
    result.materials.find(
      ({ name }) => name === "RUNTIME_MIGRATION_ENCRYPTION_KEY",
    )?.minimumBytesPolicy,
    32,
  );
  assert.equal(
    result.materials.find(
      ({ name }) => name === "MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY",
    )?.minimumBytesPolicy,
    32,
  );
  assert.equal(
    result.materials.find(({ name }) => name === "RELAY_MANAGED_RAILWAY_TOKEN")
      ?.minimumBytesPolicy,
    16,
  );

  env.RUNTIME_MIGRATION_ENCRYPTION_KEY = "weak";
  const weak = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });
  assert.equal(weak.status, "failed");
  assert.match(
    weak.failures.join("\n"),
    /RUNTIME_MIGRATION_ENCRYPTION_KEY does not meet the issued-secret strength policy/,
  );
});

test("the current Railway material inventory requires exactly 23 lifecycle records", () => {
  const env = fixture();
  const issued = (label) => `${label}-${randomBytes(32).toString("base64url")}`;
  Object.assign(env, {
    ANY_DO_CLIENT_SECRET: issued("any-do"),
    CLAWCHAT_BETA_SMOKE_PASSWORD: issued("smoke-password"),
    OPENCLAW_BRIDGE_SECRET: issued("openclaw"),
    OPENROUTER_API_KEY: issued("openrouter"),
    REMEMBER_THE_MILK_CLIENT_SECRET: issued("rtm"),
    RUNTIME_MIGRATION_ENCRYPTION_KEY: issued("migration"),
    SCRIBE_CLIENT_SECRET: issued("scribe"),
    SLACK_CLIENT_SECRET: issued("slack"),
  });
  attachLifecycle(env);

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });
  const expectedNames = [
    "ANY_DO_CLIENT_SECRET",
    "APP_ENCRYPTION_KEY",
    "ATTACHMENT_PROVENANCE_SECRET",
    "ATTACHMENT_SIGNING_SECRET",
    "AUDIT_IDENTIFIER_HASH_SECRET",
    "CLAWCHAT_BETA_INVITE_CODES",
    "CLAWCHAT_BETA_INVITE_HASH_SECRET",
    "CLAWCHAT_BETA_SMOKE_PASSWORD",
    "CONNECTION_DESCRIPTOR_PRIVATE_KEY",
    "GITHUB_CLIENT_SECRET",
    "JWT_REFRESH_SECRET",
    "JWT_SECRET",
    "JWT_WS_SECRET",
    "OPENCLAW_BRIDGE_SECRET",
    "OPENROUTER_API_KEY",
    "RELAY_OPERATOR_API_SECRET",
    "REMEMBER_THE_MILK_CLIENT_SECRET",
    "RESEND_API_KEY",
    "RUNTIME_MIGRATION_ENCRYPTION_KEY",
    "SCRIBE_CLIENT_SECRET",
    "SLACK_CLIENT_SECRET",
    "production_database_password",
    "production_redis_password",
  ].sort();

  assert.equal(result.status, "passed");
  assert.deepEqual(
    result.lifecycle.materials.map(({ name }) => name),
    expectedNames,
  );
  assert.equal(result.coverage.materialCount, 23);
});

test("detects encoded root-key and individual invite-code reuse", () => {
  const env = fixture();
  const encodedApplicationKey = env.APP_ENCRYPTION_KEY.slice("base64:".length);
  env.RUNTIME_MIGRATION_ENCRYPTION_KEY = encodedApplicationKey;
  env.CLAWCHAT_BETA_INVITE_CODES = `${env.JWT_SECRET},${randomBytes(32).toString("base64url")}`;
  attachLifecycle(env);

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });

  assert.equal(result.status, "failed");
  assert.match(
    result.failures.join("\n"),
    /APP_ENCRYPTION_KEY.*RUNTIME_MIGRATION_ENCRYPTION_KEY/,
  );
  assert.match(
    result.failures.join("\n"),
    /CLAWCHAT_BETA_INVITE_CODES.*JWT_SECRET/,
  );
  assert.equal(result.privacy.secretFingerprintsIncluded, false);
});

test("rejects duplicate invite seed codes", () => {
  const env = fixture();
  const code = randomBytes(32).toString("base64url");
  env.CLAWCHAT_BETA_INVITE_CODES = `${code},${code}`;
  attachLifecycle(env);

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });

  assert.equal(result.status, "failed");
  assert.match(
    result.failures.join("\n"),
    /Production invite seed codes do not meet the strength policy/,
  );
});

test("fails weak, duplicate, public, and mismatched secret material", () => {
  const env = fixture();
  env.JWT_SECRET = "short";
  env.JWT_REFRESH_SECRET = env.JWT_WS_SECRET;
  env.DATABASE_URL = "postgres://relay:password@database.example/relay";
  env.NEXT_PUBLIC_OAUTH_SECRET = "should-never-be-public";
  env.CONNECTION_DESCRIPTOR_PUBLIC_KEY = generateKeyPairSync("ed25519")
    .publicKey.export({ format: "der", type: "spki" })
    .toString("base64");

  const result = auditProductionSecrets(env);

  assert.equal(result.status, "failed");
  assert.match(result.failures.join("\n"), /JWT_SECRET/);
  assert.match(result.failures.join("\n"), /database password/);
  assert.match(result.failures.join("\n"), /NEXT_PUBLIC_OAUTH_SECRET/);
  assert.match(result.failures.join("\n"), /reused/);
  assert.match(result.failures.join("\n"), /matching Ed25519 pair/);
  assert.equal(
    JSON.stringify(result).includes("should-never-be-public"),
    false,
  );
});

test("fails missing, stale, future, malformed, and extra lifecycle records", () => {
  const env = fixture();
  const registry = JSON.parse(env.RELAY_SECRET_LIFECYCLE_JSON);
  delete registry.materials.JWT_SECRET;
  registry.materials.JWT_REFRESH_SECRET.lastReviewedAt =
    "2025-01-01T00:00:00.000Z";
  registry.materials.JWT_WS_SECRET.lastRotatedAt = "2027-01-01T00:00:00.000Z";
  registry.materials.APP_ENCRYPTION_KEY.nextReviewAt =
    "2026-07-27T12:30:00.000Z";
  registry.materials.ATTACHMENT_SIGNING_SECRET.version = "../../bad";
  registry.materials.RETIRED_SECRET = {
    version: "v1",
    lastRotatedAt: "2026-05-16T12:00:00.000Z",
    lastReviewedAt: "2026-07-21T12:00:00.000Z",
    nextReviewAt: "2026-10-01T12:00:00.000Z",
  };
  env.RELAY_SECRET_LIFECYCLE_JSON = JSON.stringify(registry);

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });

  assert.equal(result.status, "failed");
  assert.match(result.failures.join("\n"), /JWT_SECRET has no lifecycle/);
  assert.match(result.failures.join("\n"), /JWT_REFRESH_SECRET.*stale/);
  assert.match(result.failures.join("\n"), /JWT_WS_SECRET.*future/);
  assert.match(
    result.failures.join("\n"),
    /APP_ENCRYPTION_KEY.*due or too close/,
  );
  assert.match(
    result.failures.join("\n"),
    /ATTACHMENT_SIGNING_SECRET lifecycle version is invalid/,
  );
  assert.match(
    result.failures.join("\n"),
    /RETIRED_SECRET.*stale or unsupported/,
  );
});

test("fails a malformed Railway deployment identity", () => {
  const env = fixture();
  env.RAILWAY_ENVIRONMENT_ID = "wrong-environment";
  env.RAILWAY_DEPLOYMENT_ID = "not-a-deployment";
  env.RAILWAY_GIT_COMMIT_SHA = "short";

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });

  assert.equal(result.status, "failed");
  assert.match(result.failures.join("\n"), /environmentId/);
  assert.match(result.failures.join("\n"), /deploymentId/);
  assert.match(result.failures.join("\n"), /release commit/);
});

test("rejects a deployment identifier with only allowed punctuation", () => {
  const env = fixture();
  env.RAILWAY_DEPLOYMENT_ID = "-".repeat(36);

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });

  assert.equal(result.status, "failed");
  assert.match(
    result.failures.join("\n"),
    /Railway deploymentId is missing or invalid/,
  );
});

test("fails a missing release commit for deployment validation", () => {
  const env = fixture();
  delete env.RAILWAY_GIT_COMMIT_SHA;
  delete env.RELAY_RELEASE_COMMIT;

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });

  assert.equal(result.status, "failed");
  assert.match(
    result.failures.join("\n"),
    /Railway release commit is missing or malformed/,
  );
});

test("rejects invalid lifecycle JSON without reflecting its contents", () => {
  const env = fixture();
  const marker = "do-not-reflect-this-lifecycle-value";
  env.RELAY_SECRET_LIFECYCLE_JSON = `{${marker}`;

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });
  const serialized = JSON.stringify(result);

  assert.equal(result.status, "failed");
  assert.match(result.failures.join("\n"), /must be valid JSON/);
  assert.equal(serialized.includes(marker), false);
});

test("local non-deployment validation can explicitly omit identity only", () => {
  const env = fixture();
  delete env.RAILWAY_PROJECT_ID;
  delete env.RAILWAY_ENVIRONMENT_ID;
  delete env.RAILWAY_SERVICE_ID;
  delete env.RAILWAY_SERVICE_NAME;
  delete env.RAILWAY_DEPLOYMENT_ID;
  delete env.RAILWAY_GIT_COMMIT_SHA;

  const result = auditProductionSecrets(env, {
    capturedAt: CAPTURED_AT,
    requireDeploymentIdentity: false,
  });

  assert.equal(result.status, "passed");
  assert.equal(result.coverage.deploymentIdentityChecked, false);
});

test("audits retained invite and versioned encryption material without double-counting the active key", () => {
  const env = fixture();
  const previousInvite = `previous-${randomBytes(32).toString("base64url")}`;
  const oldEncryption = randomBytes(32);
  const activeEncryption = env.APP_ENCRYPTION_KEY.slice("base64:".length);
  env.CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS = previousInvite;
  env.APP_ENCRYPTION_KEY_VERSION = "v2";
  env.APP_ENCRYPTION_KEYS =
    `v1:base64:${oldEncryption.toString("base64")},` +
    `v2:base64:${activeEncryption}`;
  attachLifecycle(env);

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });
  const names = result.materials.map(({ name }) => name);

  assert.equal(result.status, "passed");
  assert.equal(names.includes("APP_ENCRYPTION_KEYS[v1]"), true);
  assert.equal(names.includes("APP_ENCRYPTION_KEYS[v2]"), false);
  assert.equal(
    names.includes("CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS[0]"),
    true,
  );
});

test("fails malformed, weak, duplicate, or active-mismatched retained material", () => {
  const env = fixture();
  env.CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS = env.JWT_SECRET;
  env.APP_ENCRYPTION_KEY_VERSION = "v2";
  env.APP_ENCRYPTION_KEYS =
    `v1:base64:${randomBytes(8).toString("base64")},` +
    `v2:base64:${randomBytes(32).toString("base64")}`;
  attachLifecycle(env);

  const result = auditProductionSecrets(env, { capturedAt: CAPTURED_AT });

  assert.equal(result.status, "failed");
  assert.match(result.failures.join("\n"), /Secret material is reused/);
  assert.match(result.failures.join("\n"), /APP_ENCRYPTION_KEYS\[v1\]/);
  assert.match(
    result.failures.join("\n"),
    /differs from the active encryption key/,
  );
});

test("the CLI never reflects a rejected secret or lifecycle payload", () => {
  const marker = `private-marker-${randomBytes(24).toString("base64url")}`;
  const env = fixture();
  env.JWT_SECRET = marker;
  env.RELAY_SECRET_LIFECYCLE_JSON = `{${marker}`;
  let stdout = "";
  let stderr = "";

  const exitCode = runProductionSecretAuditCli({
    env,
    stdout: { write: (value) => (stdout += value) },
    stderr: { write: (value) => (stderr += value) },
  });

  assert.equal(exitCode, 1);
  assert.equal(`${stdout}${stderr}`.includes(marker), false);
  assert.match(stdout, /"status": "failed"/);
});

test("Railway startup and CI execute the audit before migrations", () => {
  const root = resolve(import.meta.dirname, "..");
  const backendPackage = JSON.parse(
    readFileSync(resolve(root, "backend/package.json"), "utf8"),
  );
  const dockerfile = readFileSync(resolve(root, "backend/Dockerfile"), "utf8");
  const workflow = readFileSync(
    resolve(root, ".github/workflows/backend-beta-readiness.yml"),
    "utf8",
  );
  const start = backendPackage.scripts["railway:start:prod"];

  assert.match(
    start,
    /^pnpm run security:audit:production && node dist\/scripts\/run-migrations\.js && node dist\/main$/,
  );
  assert.match(
    backendPackage.scripts["security:audit:production"],
    /^node security\/production-secret-audit\.mjs$/,
  );
  assert.match(
    dockerfile,
    /COPY --chown=node:node --from=base \/app\/security \.\/security/,
  );
  assert.match(workflow, /pnpm run test:production-secret-audit/);
  assert.match(workflow, /pnpm run test:production-secret-provider/);
});
