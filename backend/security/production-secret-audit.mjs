#!/usr/bin/env node

import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIRECTORY = dirname(SCRIPT_PATH);
const POLICY_PATH = resolve(SCRIPT_DIRECTORY, "production-secret-policy.json");
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SECRET_BYTES = 32;
const MIN_PROVIDER_SECRET_BYTES = 16;
const PLACEHOLDER_PATTERN =
  /(replace|change.?me|change.?in.?production|placeholder|example|your.?super.?secret|test.?secret|demo.?secret|clawchat.?dev|jwt.?secret|refresh.?secret|ws.?secret)/i;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SECRET_SHAPED_NAME =
  /(?:SECRET(?:_KEY)?|PASSWORD|PRIVATE_KEY|ENCRYPTION_KEY|MASTER_KEY|API_KEY|ACCESS_KEY|TOKEN)S?$/i;
const HIGH_STRENGTH_SECRET_NAME =
  /(?:PASSWORD|PRIVATE_KEY|ENCRYPTION_KEY|MASTER_KEY)S?$/i;

export const PRODUCTION_SECRET_POLICY = Object.freeze(
  JSON.parse(readFileSync(POLICY_PATH, "utf8")),
);

const CORE_STRING_SECRETS = Object.freeze([
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_WS_SECRET",
  "ATTACHMENT_PROVENANCE_SECRET",
  "ATTACHMENT_SIGNING_SECRET",
  "CONNECTION_DESCRIPTOR_PRIVATE_KEY",
  "RELAY_OPERATOR_API_SECRET",
  "AUDIT_IDENTIFIER_HASH_SECRET",
  "CLAWCHAT_BETA_INVITE_HASH_SECRET",
]);

const CORE_REQUIRED = Object.freeze([
  ...CORE_STRING_SECRETS,
  "APP_ENCRYPTION_KEY",
  "CONNECTION_DESCRIPTOR_PUBLIC_KEY",
]);

const NON_SECRET_SUFFIX_EXCEPTIONS = new Set([
  "APP_ENCRYPTION_KEY_VERSION",
  "CONNECTION_DESCRIPTOR_PUBLIC_KEY",
]);

const RESERVED_NON_MATERIAL_NAMES = new Set([
  PRODUCTION_SECRET_POLICY.lifecycle.registryVariable,
  "APP_ENCRYPTION_KEYS",
  "CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS",
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function truthy(value) {
  return new Set(["1", "true", "yes", "y", "on"]).has(
    text(value).toLowerCase(),
  );
}

function highDiversity(value) {
  return new Set(Buffer.from(value, "utf8")).size >= 8;
}

function validStringSecret(value, minimum = MIN_SECRET_BYTES) {
  return (
    Buffer.byteLength(value, "utf8") >= minimum &&
    highDiversity(value) &&
    !PLACEHOLDER_PATTERN.test(value)
  );
}

function decodeStrictBase64(value) {
  const normalized = text(value);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return null;
  if (normalized.length % 4 === 1) return null;
  const result = Buffer.from(normalized, "base64");
  const unpadded = (candidate) => candidate.replace(/=+$/, "");
  return unpadded(result.toString("base64")) === unpadded(normalized)
    ? result
    : null;
}

function decodeEncryptionKey(value) {
  const normalized = text(value);
  if (!normalized) return null;
  if (normalized.startsWith("base64:")) {
    return decodeStrictBase64(normalized.slice("base64:".length));
  }
  if (normalized.startsWith("utf8:")) {
    return Buffer.from(normalized.slice("utf8:".length), "utf8");
  }
  const base64 = decodeStrictBase64(normalized);
  if (base64?.length === 32) return base64;
  return Buffer.from(normalized, "utf8");
}

function passwordFromUrl(value) {
  try {
    return decodeURIComponent(new URL(text(value)).password);
  } catch {
    return "";
  }
}

function ed25519PairValid(privateValue, publicValue) {
  try {
    const privateKey = createPrivateKey({
      key: Buffer.from(privateValue, "base64"),
      format: "der",
      type: "pkcs8",
    });
    const publicKey = createPublicKey({
      key: Buffer.from(publicValue, "base64"),
      format: "der",
      type: "spki",
    });
    if (
      privateKey.asymmetricKeyType !== "ed25519" ||
      publicKey.asymmetricKeyType !== "ed25519"
    ) {
      return false;
    }
    const message = Buffer.from("relay-production-secret-audit");
    return verify(null, message, publicKey, sign(null, message, privateKey));
  } catch {
    return false;
  }
}

function inviteCodes(value) {
  return text(value)
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
}

function inviteCodesValid(codes) {
  return (
    codes.length > 0 &&
    new Set(codes).size === codes.length &&
    codes.every(
      (code) =>
        Buffer.byteLength(code, "utf8") >= 16 &&
        highDiversity(code) &&
        !PLACEHOLDER_PATTERN.test(code),
    )
  );
}

function previousInviteSecrets(value) {
  return text(value)
    .split(",")
    .map((secret) => secret.trim())
    .filter(Boolean);
}

function versionedEncryptionKeys(value) {
  const entries = [];
  const seen = new Set();
  for (const rawEntry of text(value).split(",")) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const separator = entry.indexOf(":");
    const version = separator > 0 ? entry.slice(0, separator).trim() : "";
    const encoded = separator > 0 ? entry.slice(separator + 1).trim() : "";
    if (!VERSION_PATTERN.test(version) || !encoded || seen.has(version)) {
      return null;
    }
    seen.add(version);
    entries.push({ version, encoded, material: decodeEncryptionKey(encoded) });
  }
  return entries;
}

function enabledFeatureSummary(env) {
  return {
    transactionalEmail: truthy(env.RELAY_TRANSACTIONAL_EMAIL_ENABLED),
    stripeBilling: truthy(env.RELAY_BILLING_ENABLED),
    appleBilling: truthy(env.RELAY_APPLE_BILLING_ENABLED),
    managedCloud: truthy(env.RELAY_MANAGED_CLOUD_ENABLED),
    marketplaceBetaGate: truthy(env.CLAWCHAT_MARKETPLACE_BETA_MODE),
    marketplaceKillSwitch: truthy(env.CLAWCHAT_MARKETPLACE_KILL_SWITCH),
    signupMode: text(env.CLAWCHAT_BETA_SIGNUP_MODE).toLowerCase(),
  };
}

function productionIdentity(env) {
  return {
    provider: "railway",
    projectId: text(env.RAILWAY_PROJECT_ID),
    environmentId: text(env.RAILWAY_ENVIRONMENT_ID),
    environmentName: text(
      env.RAILWAY_ENVIRONMENT_NAME ?? env.RAILWAY_ENVIRONMENT,
    ).toLowerCase(),
    serviceId: text(env.RAILWAY_SERVICE_ID),
    serviceName: text(env.RAILWAY_SERVICE_NAME),
    deploymentId: text(env.RAILWAY_DEPLOYMENT_ID),
    sourceCommit: (
      text(env.RAILWAY_GIT_COMMIT_SHA) || text(env.RELAY_RELEASE_COMMIT)
    ).toLowerCase(),
  };
}

function validateProductionIdentity(identity, failures) {
  for (const key of [
    "projectId",
    "environmentId",
    "serviceId",
    "deploymentId",
  ]) {
    if (!UUID_PATTERN.test(identity[key])) {
      failures.push(`Railway ${key} is missing or invalid.`);
    }
  }
  if (
    !new Set(["production", "prod", "live", "beta"]).has(
      identity.environmentName,
    )
  ) {
    failures.push("Railway environmentName is not production-like.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(identity.serviceName)) {
    failures.push("Railway serviceName is missing or invalid.");
  }
  if (!/^[0-9a-f]{40}$/.test(identity.sourceCommit)) {
    failures.push("Railway release commit is missing or malformed.");
  }
}

function safeTimestamp(value) {
  const normalized = text(value);
  const milliseconds = Date.parse(normalized);
  return normalized && Number.isFinite(milliseconds)
    ? { iso: new Date(milliseconds).toISOString(), milliseconds }
    : null;
}

function lifecycleRegistry(env, materialNames, capturedAt, failures) {
  const registryName = PRODUCTION_SECRET_POLICY.lifecycle.registryVariable;
  let registry;
  try {
    registry = JSON.parse(text(env[registryName]));
  } catch {
    failures.push(`${registryName} must be valid JSON.`);
    return { schemaVersion: null, materials: [] };
  }

  if (
    !registry ||
    Array.isArray(registry) ||
    typeof registry !== "object" ||
    registry.schemaVersion !== "relay.secret-lifecycle.v1" ||
    !registry.materials ||
    Array.isArray(registry.materials) ||
    typeof registry.materials !== "object"
  ) {
    failures.push(`${registryName} has an unsupported schema.`);
    return { schemaVersion: null, materials: [] };
  }
  const topLevelKeys = Object.keys(registry).sort();
  if (
    topLevelKeys.length !== 2 ||
    topLevelKeys[0] !== "materials" ||
    topLevelKeys[1] !== "schemaVersion"
  ) {
    failures.push(`${registryName} contains unsupported fields.`);
  }

  const expectedNames = [...materialNames].sort();
  const registeredNames = Object.keys(registry.materials).sort();
  for (const name of expectedNames) {
    if (!Object.hasOwn(registry.materials, name)) {
      failures.push(`${name} has no lifecycle record.`);
    }
  }
  for (const name of registeredNames) {
    if (!materialNames.has(name)) {
      failures.push(`${name} is a stale or unsupported lifecycle record.`);
    }
  }

  const capture = safeTimestamp(capturedAt);
  const maximumReviewAge =
    PRODUCTION_SECRET_POLICY.lifecycle.maximumReviewAgeDays * DAY_MS;
  const maximumRotationAge =
    PRODUCTION_SECRET_POLICY.lifecycle.maximumRotationAgeDays * DAY_MS;
  const minimumReviewLead =
    PRODUCTION_SECRET_POLICY.lifecycle.minimumReviewLeadDays * DAY_MS;

  const materials = expectedNames.flatMap((name) => {
    const entry = registry.materials[name];
    if (!entry || Array.isArray(entry) || typeof entry !== "object") return [];
    const keys = Object.keys(entry).sort();
    const allowed = [
      "lastReviewedAt",
      "lastRotatedAt",
      "nextReviewAt",
      "version",
    ];
    if (
      keys.length !== allowed.length ||
      keys.some((key, index) => key !== allowed[index])
    ) {
      failures.push(`${name} lifecycle record contains unsupported fields.`);
    }
    const version = text(entry.version);
    const rotated = safeTimestamp(entry.lastRotatedAt);
    const reviewed = safeTimestamp(entry.lastReviewedAt);
    const nextReview = safeTimestamp(entry.nextReviewAt);
    if (!VERSION_PATTERN.test(version)) {
      failures.push(`${name} lifecycle version is invalid.`);
    }
    if (!rotated) failures.push(`${name} lastRotatedAt is invalid.`);
    if (!reviewed) failures.push(`${name} lastReviewedAt is invalid.`);
    if (!nextReview) failures.push(`${name} nextReviewAt is invalid.`);
    if (capture && rotated && rotated.milliseconds > capture.milliseconds) {
      failures.push(`${name} lastRotatedAt is in the future.`);
    }
    if (capture && reviewed && reviewed.milliseconds > capture.milliseconds) {
      failures.push(`${name} lastReviewedAt is in the future.`);
    }
    if (rotated && reviewed && reviewed.milliseconds < rotated.milliseconds) {
      failures.push(`${name} was reviewed before its recorded rotation.`);
    }
    if (
      capture &&
      reviewed &&
      capture.milliseconds - reviewed.milliseconds > maximumReviewAge
    ) {
      failures.push(`${name} lifecycle review is stale.`);
    }
    if (
      capture &&
      rotated &&
      capture.milliseconds - rotated.milliseconds > maximumRotationAge
    ) {
      failures.push(`${name} rotation exceeds the maximum age.`);
    }
    if (
      capture &&
      nextReview &&
      nextReview.milliseconds - capture.milliseconds < minimumReviewLead
    ) {
      failures.push(`${name} next lifecycle review is due or too close.`);
    }
    return [
      {
        name,
        version,
        lastRotatedAt: rotated?.iso ?? null,
        lastReviewedAt: reviewed?.iso ?? null,
        nextReviewAt: nextReview?.iso ?? null,
      },
    ];
  });

  return {
    schemaVersion:
      registry.schemaVersion === "relay.secret-lifecycle.v1"
        ? registry.schemaVersion
        : null,
    materials,
  };
}

function materialOutcome(name, classification, minimumBytes, passed) {
  return {
    name,
    classification,
    minimumBytesPolicy: minimumBytes,
    present: true,
    strengthPolicyPassed: passed,
  };
}

export function auditProductionSecrets(
  env,
  {
    capturedAt = new Date().toISOString(),
    requireDeploymentIdentity = true,
  } = {},
) {
  const failures = [];
  const materialValues = new Map();
  const materials = [];
  const register = (
    name,
    value,
    classification,
    minimumBytes,
    strengthPassed,
    reuseAliases = [],
  ) => {
    if (!value) return;
    for (const comparisonValue of new Set([value, ...reuseAliases])) {
      if (!comparisonValue) continue;
      const owners = materialValues.get(comparisonValue) ?? new Set();
      owners.add(name);
      materialValues.set(comparisonValue, owners);
    }
    materials.push(
      materialOutcome(name, classification, minimumBytes, strengthPassed),
    );
  };

  for (const name of CORE_REQUIRED) {
    if (!text(env[name])) failures.push(`${name} is missing.`);
  }

  for (const name of CORE_STRING_SECRETS) {
    const value = text(env[name]);
    if (!value) continue;
    const passed = validStringSecret(value);
    if (!passed) {
      failures.push(`${name} does not meet the production strength policy.`);
    }
    register(name, value, "application", MIN_SECRET_BYTES, passed);
  }

  const encryptionKey = decodeEncryptionKey(env.APP_ENCRYPTION_KEY);
  const encryptionPassed = Boolean(
    encryptionKey &&
    encryptionKey.length === 32 &&
    new Set(encryptionKey).size >= 8 &&
    !PLACEHOLDER_PATTERN.test(text(env.APP_ENCRYPTION_KEY)),
  );
  if (!encryptionPassed) {
    failures.push(
      "APP_ENCRYPTION_KEY is not a high-diversity 32-byte encryption key.",
    );
  } else {
    register(
      "APP_ENCRYPTION_KEY",
      encryptionKey.toString("base64"),
      "encryption",
      32,
      true,
      [text(env.APP_ENCRYPTION_KEY), encryptionKey.toString("base64url")],
    );
  }

  const activeEncryptionVersion = text(env.APP_ENCRYPTION_KEY_VERSION) || "v1";
  const encryptionRing = versionedEncryptionKeys(env.APP_ENCRYPTION_KEYS);
  if (text(env.APP_ENCRYPTION_KEYS) && !encryptionRing) {
    failures.push(
      "APP_ENCRYPTION_KEYS contains an invalid or duplicate versioned entry.",
    );
  }
  for (const entry of encryptionRing ?? []) {
    const passed = Boolean(
      entry.material &&
      entry.material.length === 32 &&
      new Set(entry.material).size >= 8 &&
      !PLACEHOLDER_PATTERN.test(entry.encoded),
    );
    if (!passed) {
      failures.push(
        `APP_ENCRYPTION_KEYS[${entry.version}] does not meet the encryption-key policy.`,
      );
      continue;
    }
    const material = entry.material.toString("base64");
    if (entry.version === activeEncryptionVersion) {
      if (!encryptionKey || material !== encryptionKey.toString("base64")) {
        failures.push(
          `APP_ENCRYPTION_KEYS[${entry.version}] differs from the active encryption key.`,
        );
      }
      continue;
    }
    register(
      `APP_ENCRYPTION_KEYS[${entry.version}]`,
      material,
      "retained-encryption",
      32,
      true,
      [entry.encoded, entry.material.toString("base64url")],
    );
  }

  const pairValid = ed25519PairValid(
    text(env.CONNECTION_DESCRIPTOR_PRIVATE_KEY),
    text(env.CONNECTION_DESCRIPTOR_PUBLIC_KEY),
  );
  if (
    text(env.CONNECTION_DESCRIPTOR_PRIVATE_KEY) &&
    text(env.CONNECTION_DESCRIPTOR_PUBLIC_KEY) &&
    !pairValid
  ) {
    failures.push(
      "CONNECTION_DESCRIPTOR_PRIVATE_KEY and CONNECTION_DESCRIPTOR_PUBLIC_KEY are not a valid matching Ed25519 pair.",
    );
  }

  const databasePassword =
    passwordFromUrl(env.DATABASE_URL) || text(env.DATABASE_PASSWORD);
  const databasePassed = validStringSecret(databasePassword);
  if (!databasePassed) {
    failures.push(
      "The production database password does not meet the strength policy.",
    );
  }
  register(
    "production_database_password",
    databasePassword,
    "provider-database",
    MIN_SECRET_BYTES,
    databasePassed,
  );

  const redisPassword =
    passwordFromUrl(env.REDIS_URL) ||
    passwordFromUrl(env.REDIS_PUBLIC_URL) ||
    text(env.REDIS_PASSWORD);
  const redisPassed = validStringSecret(redisPassword);
  if (!redisPassed) {
    failures.push(
      "The production Redis password does not meet the strength policy.",
    );
  }
  register(
    "production_redis_password",
    redisPassword,
    "provider-cache",
    MIN_SECRET_BYTES,
    redisPassed,
  );

  const inviteCodeValues = inviteCodes(env.CLAWCHAT_BETA_INVITE_CODES);
  const invitePassed = inviteCodesValid(inviteCodeValues);
  if (!invitePassed) {
    failures.push(
      "Production invite seed codes do not meet the strength policy.",
    );
  }
  register(
    "CLAWCHAT_BETA_INVITE_CODES",
    text(env.CLAWCHAT_BETA_INVITE_CODES),
    "invite-seed",
    16,
    invitePassed,
    inviteCodeValues,
  );

  for (const [index, value] of previousInviteSecrets(
    env.CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS,
  ).entries()) {
    const name = `CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS[${index}]`;
    const passed = validStringSecret(value);
    if (!passed) {
      failures.push(`${name} does not meet the production strength policy.`);
    }
    register(name, value, "retained-invite-hash", MIN_SECRET_BYTES, passed);
  }

  const publicSecretNames = Object.keys(env)
    .filter(
      (name) =>
        name.startsWith("NEXT_PUBLIC_") &&
        /(SECRET|TOKEN|PASSWORD|PRIVATE|ENCRYPTION|WEBHOOK|OAUTH|KEY)/i.test(
          name,
        ),
    )
    .sort();
  if (publicSecretNames.length) {
    failures.push(
      `Secret-shaped variables are public: ${publicSecretNames.join(", ")}.`,
    );
  }

  const coreNames = new Set([
    ...CORE_REQUIRED,
    "DATABASE_PASSWORD",
    "REDIS_PASSWORD",
  ]);
  const serviceSecretNames = Object.keys(env)
    .filter(
      (name) =>
        text(env[name]) &&
        SECRET_SHAPED_NAME.test(name) &&
        !NON_SECRET_SUFFIX_EXCEPTIONS.has(name) &&
        !RESERVED_NON_MATERIAL_NAMES.has(name) &&
        !coreNames.has(name) &&
        !name.startsWith("RAILWAY_"),
    )
    .sort();

  for (const name of serviceSecretNames) {
    const value = text(env[name]);
    const minimum =
      name === "OPENCLAW_BRIDGE_SECRET" || HIGH_STRENGTH_SECRET_NAME.test(name)
        ? MIN_SECRET_BYTES
        : MIN_PROVIDER_SECRET_BYTES;
    const passed = validStringSecret(value, minimum);
    if (!passed) {
      failures.push(`${name} does not meet the issued-secret strength policy.`);
    }
    register(name, value, "provider-issued", minimum, passed);
  }

  for (const owners of materialValues.values()) {
    if (owners.size > 1) {
      failures.push(
        `Secret material is reused by: ${[...owners].sort().join(", ")}.`,
      );
    }
  }

  const features = enabledFeatureSummary(env);
  const webhookSecretNames = serviceSecretNames.filter((name) =>
    name.includes("WEBHOOK"),
  );
  if (features.stripeBilling && !text(env.STRIPE_WEBHOOK_SECRET)) {
    failures.push("Stripe billing is enabled without STRIPE_WEBHOOK_SECRET.");
  }
  const oauthSecretNames = serviceSecretNames.filter((name) =>
    /(?:CLIENT_SECRET|OAUTH.*SECRET)/i.test(name),
  );

  const identity = productionIdentity(env);
  if (requireDeploymentIdentity) validateProductionIdentity(identity, failures);

  const materialNames = new Set(materials.map(({ name }) => name));
  const lifecycle = lifecycleRegistry(env, materialNames, capturedAt, failures);
  const lifecycleNames = new Set(lifecycle.materials.map(({ name }) => name));
  const safeMaterials = materials
    .map((material) => ({
      ...material,
      distinctMaterialPassed: !failures.some(
        (failure) =>
          failure.startsWith("Secret material is reused by:") &&
          failure.includes(material.name),
      ),
      lifecycleTracked: lifecycleNames.has(material.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    schemaVersion: "relay.production-secret-audit.v2",
    capturedAt,
    status: failures.length ? "failed" : "passed",
    identity,
    features,
    coverage: {
      coreSecretCount: CORE_REQUIRED.length,
      materialCount: safeMaterials.length,
      serviceSecretCount: serviceSecretNames.length,
      oauthSecretCount: oauthSecretNames.length,
      webhookSecretCount: webhookSecretNames.length,
      databaseCredentialChecked: Boolean(databasePassword),
      redisCredentialChecked: Boolean(redisPassword),
      cookieSigningUsesJwtSecrets: true,
      csrfUsesPerSessionRandomUuid: true,
      publicSecretVariableCount: publicSecretNames.length,
      distinctMaterialChecked: true,
      lifecycleRegistryChecked: true,
      deploymentIdentityChecked: requireDeploymentIdentity,
      connectionDescriptorKeyPairVerified: pairValid,
    },
    materials: safeMaterials,
    lifecycle,
    names: {
      serviceSecrets: serviceSecretNames,
      oauthSecrets: oauthSecretNames,
      webhookSecrets: webhookSecretNames,
    },
    failures,
    privacy: {
      secretValuesIncluded: false,
      secretFingerprintsIncluded: false,
      credentialLengthsIncluded: false,
      providerVariableValuesRetrieved: false,
    },
  };
}

export function runProductionSecretAuditCli({
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  try {
    const result = auditProductionSecrets(env);
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === "passed" ? 0 : 1;
  } catch (error) {
    stderr.write(
      `ERROR: production secret audit failed (${error instanceof Error ? error.name : "unknown_error"}).\n`,
    );
    return 1;
  }
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  process.exitCode = runProductionSecretAuditCli();
}
