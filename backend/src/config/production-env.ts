import { X509Certificate } from "crypto";
import { isManagedCloudLaunchEnabledValue } from "./managed-cloud-launch.policy";
import { buildVerifiedDatabaseTlsOptions } from "../infrastructure/database/production-database-tls";
import { assertBridgeTokenEnvironment } from "../modules/bridge/bridge-token-policy";
import { resolveRelayJwtIssuer } from "../modules/auth/auth-token-policy";

const SECRET_NAME_PATTERN =
  /(SECRET|TOKEN|PASSWORD|PRIVATE|DATABASE|JWT|ENCRYPTION|WEBHOOK|OAUTH|KEY)/i;

const REQUIRED_PRODUCTION_ENV = [
  "CORS_ORIGINS",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_WS_SECRET",
  "JWT_ISSUER",
  "APP_ENCRYPTION_KEY",
  "APP_ENCRYPTION_KEY_VERSION",
  "ATTACHMENT_PROVENANCE_SECRET",
  "ATTACHMENT_SIGNING_SECRET",
  "CONNECTION_DESCRIPTOR_PRIVATE_KEY",
  "CONNECTION_DESCRIPTOR_PUBLIC_KEY",
  "RELAY_OPERATOR_API_SECRET",
  "AUDIT_IDENTIFIER_HASH_SECRET",
  "CLAWCHAT_BETA_INVITE_HASH_SECRET",
  "CLAWCHAT_BETA_INVITE_CODES",
  "CLAWCHAT_BETA_SIGNUP_MODE",
  "CLAWCHAT_MARKETPLACE_BETA_MODE",
  "CLAWCHAT_MARKETPLACE_ALLOWED_APPS",
  "CLAWCHAT_MARKETPLACE_BLOCKED_APPS",
];

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on"]);
const PRODUCTION_ENVIRONMENT_NAMES = new Set([
  "production",
  "prod",
  "live",
  "beta",
]);
const STRIPE_TEST_ENVIRONMENT_NAMES = new Set(["staging", "stage"]);
const INVITE_PLACEHOLDER_PATTERN =
  /^(replace|changeme|change-me|example|placeholder|test|demo)|replace-with|invite-code/i;
const REQUIRED_DISTINCT_SECRETS = [
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_WS_SECRET",
  "APP_ENCRYPTION_KEY",
  "ATTACHMENT_PROVENANCE_SECRET",
  "ATTACHMENT_SIGNING_SECRET",
  "CONNECTION_DESCRIPTOR_PRIVATE_KEY",
  "RELAY_OPERATOR_API_SECRET",
  "AUDIT_IDENTIFIER_HASH_SECRET",
  "CLAWCHAT_BETA_INVITE_HASH_SECRET",
] as const;
const REQUIRED_STRING_SECRETS = [
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_WS_SECRET",
  "ATTACHMENT_PROVENANCE_SECRET",
  "ATTACHMENT_SIGNING_SECRET",
  "CONNECTION_DESCRIPTOR_PRIVATE_KEY",
  "RELAY_OPERATOR_API_SECRET",
  "AUDIT_IDENTIFIER_HASH_SECRET",
  "CLAWCHAT_BETA_INVITE_HASH_SECRET",
] as const;
const SECRET_MIN_BYTES = 32;
const SECRET_PLACEHOLDER_PATTERN =
  /(replace-with|change-in-production|your-super-secret|placeholder|changeme|change-me|clawchat-dev|dev-attachment-provenance|test-secret|demo-secret|jwt-secret|refresh-secret|ws-secret)/i;
const REQUIRED_STRIPE_BILLING_ENV = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_RELAY_CLOUD_PRICE_ID",
  "RELAY_PUBLIC_WEB_ORIGIN",
] as const;
const REQUIRED_TRANSACTIONAL_EMAIL_ENV = [
  "RESEND_API_KEY",
  "RELAY_EMAIL_FROM",
  "RELAY_PUBLIC_WEB_ORIGIN",
] as const;
const REQUIRED_APPLE_BILLING_ENV = [
  "APPLE_BUNDLE_ID",
  "APPLE_APP_ID",
  "APPLE_RELAY_CLOUD_PRODUCT_ID",
  "APPLE_ROOT_CA_BASE64_JSON",
] as const;
const REQUIRED_MANAGED_CLOUD_ENV = [
  "STRIPE_RELAY_MANAGED_CLOUD_PRICE_ID",
  "RELAY_MANAGED_RAILWAY_TOKEN",
  "RELAY_MANAGED_RAILWAY_PROJECT_ID",
  "RELAY_MANAGED_RAILWAY_ENVIRONMENT_ID",
  "RELAY_MANAGED_HERMES_IMAGE",
  "MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY",
  "RUNTIME_MIGRATION_ENCRYPTION_KEY",
] as const;

function normalizedEnvValue(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function isTruthyEnvValue(value?: string) {
  return TRUE_VALUES.has(normalizedEnvValue(value));
}

function parseOrigins(value: string) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLoopbackOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
    );
  } catch {
    return false;
  }
}

export function assertProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!shouldAssertProductionEnvironment(env)) {
    return;
  }

  const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !env[key]?.trim());
  const hasDatabaseConfig =
    Boolean(env.DATABASE_URL?.trim()) ||
    Boolean(
      env.DATABASE_HOST?.trim() &&
      env.DATABASE_NAME?.trim() &&
      env.DATABASE_USER?.trim() &&
      env.DATABASE_PASSWORD?.trim(),
    );
  const hasRedisConfig =
    Boolean(env.REDIS_URL?.trim() || env.REDIS_PUBLIC_URL?.trim()) ||
    Boolean(env.REDIS_HOST?.trim() && env.REDIS_PASSWORD?.trim());
  const publicSecrets = Object.keys(env).filter(
    (key) => key.startsWith("NEXT_PUBLIC_") && SECRET_NAME_PATTERN.test(key),
  );
  const origins = parseOrigins(env.CORS_ORIGINS ?? "");
  const invalidOrigins = origins.filter(isLoopbackOrigin);
  const signupMode = String(env.CLAWCHAT_BETA_SIGNUP_MODE ?? "")
    .trim()
    .toLowerCase();
  const unsafeInviteCodes = findUnsafeBetaInviteCodes(
    env.CLAWCHAT_BETA_INVITE_CODES,
  );
  const unsafeSecrets = findUnsafeProductionSecrets(env);
  const duplicateSecrets = findDuplicateProductionSecrets(env);
  const seedOnStart = isTruthyEnvValue(env.SEED_ON_START);
  const billingEnabled = isTruthyEnvValue(env.RELAY_BILLING_ENABLED);
  const railwayEnvironmentName = normalizedEnvValue(
    env.RAILWAY_ENVIRONMENT_NAME ?? env.RAILWAY_ENVIRONMENT,
  );
  const stripeTestModeAllowed = STRIPE_TEST_ENVIRONMENT_NAMES.has(
    railwayEnvironmentName,
  );
  const transactionalEmailEnabled = isTruthyEnvValue(
    env.RELAY_TRANSACTIONAL_EMAIL_ENABLED,
  );
  const appleBillingEnabled = isTruthyEnvValue(env.RELAY_APPLE_BILLING_ENABLED);
  const managedCloudLaunchFlag = env.RELAY_MANAGED_CLOUD_ENABLED?.trim();
  const managedCloudEnabled = isManagedCloudLaunchEnabledValue(
    managedCloudLaunchFlag,
  );
  const invalidRetention = [
    ["RELAY_AUTH_AUDIT_RETENTION_DAYS", 30],
    ["RELAY_AUDIT_RETENTION_DAYS", 90],
    ["RELAY_RUNTIME_DISPATCH_PAYLOAD_RETENTION_DAYS", 7],
    ["RELAY_RUNTIME_DISPATCH_RETENTION_DAYS", 30],
    ["RELAY_SYNC_CHANGE_RETENTION_DAYS", 30],
  ].flatMap(([key, maximum]) => {
    const raw = env[String(key)]?.trim();
    if (!raw) return [];
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 && value <= Number(maximum)
      ? []
      : [
          `${key} must be an integer from 1 through ${maximum} days; operational retention cannot be increased beyond the storage/privacy limit.`,
        ];
  });

  const failures = [
    ...(env.NODE_ENV === "production"
      ? []
      : [
          "Production-like deployment must set NODE_ENV=production so production-only auth, CORS, cookie, database, docs, and logging guards cannot be skipped.",
        ]),
    ...missing.map((key) => `Missing required production env var: ${key}`),
    ...publicSecrets.map(
      (key) => `Secret-shaped env var must not be public: ${key}`,
    ),
    ...invalidOrigins.map(
      (origin) => `Production CORS origin must not be loopback: ${origin}`,
    ),
    ...unsafeSecrets,
    ...invalidRetention,
    ...duplicateSecrets.map(
      (keys) => `Production secrets must be distinct: ${keys.join(", ")}.`,
    ),
    ...(seedOnStart
      ? [
          "Production-like deployment must not enable destructive demo seeding: set SEED_ON_START=false or remove it.",
        ]
      : []),
    ...(managedCloudLaunchFlag &&
    !["true", "false"].includes(managedCloudLaunchFlag)
      ? [
          "RELAY_MANAGED_CLOUD_ENABLED must be exactly true or false; any other value is rejected fail-closed.",
        ]
      : []),
  ];

  try {
    buildVerifiedDatabaseTlsOptions(env);
  } catch (error) {
    failures.push(
      error instanceof Error
        ? error.message
        : "Production database TLS configuration is invalid.",
    );
  }
  try {
    assertBridgeTokenEnvironment(env);
  } catch (error) {
    failures.push(
      error instanceof Error
        ? error.message
        : "Bridge token lifetime configuration is invalid.",
    );
  }
  try {
    resolveRelayJwtIssuer(env.JWT_ISSUER);
  } catch (error) {
    failures.push(
      error instanceof Error
        ? error.message
        : "JWT issuer configuration is invalid.",
    );
  }

  if (signupMode !== "invite") {
    failures.push(
      "Production beta signup mode must stay invite-only: CLAWCHAT_BETA_SIGNUP_MODE=invite.",
    );
  }

  if (unsafeInviteCodes.length) {
    failures.push(
      "Production beta invite codes must be private high-entropy seed codes, not short values or placeholders.",
    );
  }

  if (!origins.length) {
    failures.push(
      "CORS_ORIGINS must include the deployed beta web origin in production.",
    );
  }

  if (!hasDatabaseConfig) {
    failures.push(
      "Production database config must use DATABASE_URL or DATABASE_HOST/DATABASE_NAME/DATABASE_USER/DATABASE_PASSWORD.",
    );
  }

  if (!hasRedisConfig) {
    failures.push(
      "Production Redis config must use REDIS_URL/REDIS_PUBLIC_URL or REDIS_HOST/REDIS_PASSWORD.",
    );
  }

  if (billingEnabled) {
    const missingBillingEnv = REQUIRED_STRIPE_BILLING_ENV.filter(
      (key) => !env[key]?.trim(),
    );
    failures.push(
      ...missingBillingEnv.map(
        (key) => `Missing required production billing env var: ${key}`,
      ),
    );

    if (
      env.STRIPE_SECRET_KEY?.trim() &&
      !env.STRIPE_SECRET_KEY.trim().startsWith("sk_live_") &&
      !(
        stripeTestModeAllowed &&
        env.STRIPE_SECRET_KEY.trim().startsWith("sk_test_")
      )
    ) {
      failures.push(
        "Production Relay billing must use a live Stripe secret key; only the Railway staging environment may use a Stripe test key.",
      );
    }
    if (
      env.STRIPE_WEBHOOK_SECRET?.trim() &&
      !env.STRIPE_WEBHOOK_SECRET.trim().startsWith("whsec_")
    ) {
      failures.push("Stripe webhook secret must start with whsec_.");
    }
    if (
      env.STRIPE_RELAY_CLOUD_PRICE_ID?.trim() &&
      !env.STRIPE_RELAY_CLOUD_PRICE_ID.trim().startsWith("price_")
    ) {
      failures.push("Relay Cloud Stripe price ID must start with price_.");
    }

    try {
      const webOrigin = new URL(env.RELAY_PUBLIC_WEB_ORIGIN ?? "");
      if (
        webOrigin.protocol !== "https:" ||
        webOrigin.username ||
        webOrigin.password ||
        webOrigin.pathname !== "/" ||
        webOrigin.search ||
        webOrigin.hash ||
        isLoopbackOrigin(webOrigin.origin)
      ) {
        failures.push(
          "RELAY_PUBLIC_WEB_ORIGIN must be a public HTTPS origin with no path, query, or credentials.",
        );
      }
    } catch {
      if (env.RELAY_PUBLIC_WEB_ORIGIN?.trim()) {
        failures.push("RELAY_PUBLIC_WEB_ORIGIN must be a valid HTTPS origin.");
      }
    }
  }

  if (appleBillingEnabled) {
    const missingAppleEnv = REQUIRED_APPLE_BILLING_ENV.filter(
      (key) => !env[key]?.trim(),
    );
    failures.push(
      ...missingAppleEnv.map(
        (key) => `Missing required production Apple billing env var: ${key}`,
      ),
    );
    if (
      env.APPLE_APP_ID?.trim() &&
      !/^\d{6,20}$/.test(env.APPLE_APP_ID.trim())
    ) {
      failures.push(
        "APPLE_APP_ID must be the numeric App Store app identifier.",
      );
    }
    if (
      env.APPLE_BUNDLE_ID?.trim() &&
      !/^[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)+$/.test(env.APPLE_BUNDLE_ID.trim())
    ) {
      failures.push(
        "APPLE_BUNDLE_ID must be a valid reverse-DNS bundle identifier.",
      );
    }
    if (
      env.APPLE_RELAY_CLOUD_PRODUCT_ID?.trim() &&
      !/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)+$/.test(
        env.APPLE_RELAY_CLOUD_PRODUCT_ID.trim(),
      )
    ) {
      failures.push(
        "APPLE_RELAY_CLOUD_PRODUCT_ID must be a valid App Store product identifier.",
      );
    }
    if (env.APPLE_ROOT_CA_BASE64_JSON?.trim()) {
      try {
        const roots = JSON.parse(env.APPLE_ROOT_CA_BASE64_JSON) as unknown;
        if (!Array.isArray(roots) || !roots.length) throw new Error("empty");
        for (const encoded of roots) {
          if (typeof encoded !== "string" || !encoded.trim())
            throw new Error("invalid");
          const certificate = Buffer.from(encoded, "base64");
          if (!certificate.length) throw new Error("invalid");
          new X509Certificate(certificate);
        }
      } catch {
        failures.push(
          "APPLE_ROOT_CA_BASE64_JSON must be a JSON array of valid base64 DER Apple root certificates.",
        );
      }
    }
  }

  if (managedCloudEnabled) {
    const missingManagedCloudEnv = REQUIRED_MANAGED_CLOUD_ENV.filter(
      (key) => !env[key]?.trim(),
    );
    failures.push(
      ...missingManagedCloudEnv.map(
        (key) => `Missing required managed Relay Cloud env var: ${key}`,
      ),
    );
    if (
      env.MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY?.trim() ===
      env.RUNTIME_MIGRATION_ENCRYPTION_KEY?.trim()
    ) {
      failures.push(
        "Managed runtime credential and migration encryption keys must be distinct.",
      );
    }
    if (
      env.STRIPE_RELAY_MANAGED_CLOUD_PRICE_ID?.trim() &&
      !env.STRIPE_RELAY_MANAGED_CLOUD_PRICE_ID.trim().startsWith("price_")
    ) {
      failures.push(
        "Managed Relay Cloud Stripe price ID must start with price_.",
      );
    }
    try {
      const image = env.RELAY_MANAGED_HERMES_IMAGE?.trim() ?? "";
      if (!image || /\s/.test(image) || image.includes("localhost")) {
        failures.push(
          "RELAY_MANAGED_HERMES_IMAGE must name a deployable non-loopback container image.",
        );
      }
    } catch {
      failures.push("RELAY_MANAGED_HERMES_IMAGE is invalid.");
    }
  }

  if (transactionalEmailEnabled) {
    failures.push(
      ...REQUIRED_TRANSACTIONAL_EMAIL_ENV.filter(
        (key) => !env[key]?.trim(),
      ).map(
        (key) =>
          `Missing required production transactional email env var: ${key}`,
      ),
    );
    if (
      env.RELAY_EMAIL_FROM?.trim() &&
      !/^.+<[^<>\s]+@[^<>\s]+>$|^[^<>\s]+@[^<>\s]+$/.test(
        env.RELAY_EMAIL_FROM.trim(),
      )
    ) {
      failures.push("RELAY_EMAIL_FROM must contain a valid sender address.");
    }
    if (
      env.RESEND_API_KEY?.trim() &&
      !env.RESEND_API_KEY.trim().startsWith("re_")
    ) {
      failures.push("Resend API key must start with re_.");
    }
    try {
      const emailWebOrigin = new URL(env.RELAY_PUBLIC_WEB_ORIGIN ?? "");
      if (
        emailWebOrigin.protocol !== "https:" ||
        emailWebOrigin.username ||
        emailWebOrigin.password ||
        emailWebOrigin.pathname !== "/" ||
        emailWebOrigin.search ||
        emailWebOrigin.hash ||
        isLoopbackOrigin(emailWebOrigin.origin)
      ) {
        failures.push(
          "Transactional email links require RELAY_PUBLIC_WEB_ORIGIN to be a public HTTPS origin.",
        );
      }
    } catch {
      if (env.RELAY_PUBLIC_WEB_ORIGIN?.trim()) {
        failures.push(
          "Transactional email links require a valid RELAY_PUBLIC_WEB_ORIGIN.",
        );
      }
    }
  }

  if (failures.length) {
    throw new Error(
      `Production environment is not beta-safe:\n${failures.join("\n")}`,
    );
  }
}

export function assertDestructiveSeedAllowed(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!shouldAssertProductionEnvironment(env)) {
    return;
  }

  throw new Error(
    "Refusing to run the destructive demo seed in a production-like environment. Seed data clears application tables and is not beta-safe.",
  );
}

export function shouldAssertProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.NODE_ENV === "production") {
    return true;
  }

  const railwayEnvironmentName = normalizedEnvValue(
    env.RAILWAY_ENVIRONMENT_NAME ?? env.RAILWAY_ENVIRONMENT,
  );
  const deploymentEnvironment = normalizedEnvValue(
    env.CLAWCHAT_DEPLOYMENT_ENV ?? env.CLAWCHAT_ENVIRONMENT ?? env.APP_ENV,
  );

  if (
    PRODUCTION_ENVIRONMENT_NAMES.has(railwayEnvironmentName) ||
    PRODUCTION_ENVIRONMENT_NAMES.has(deploymentEnvironment)
  ) {
    return true;
  }

  return Boolean(
    env.RAILWAY_PUBLIC_DOMAIN?.trim() &&
    (env.RAILWAY_SERVICE_ID?.trim() || env.RAILWAY_DEPLOYMENT_ID?.trim()),
  );
}

export function parseBetaInviteCodes(value?: string) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean),
  );
}

export function findUnsafeBetaInviteCodes(value?: string) {
  return [...parseBetaInviteCodes(value)].filter(
    (code) => code.length < 16 || INVITE_PLACEHOLDER_PATTERN.test(code),
  );
}

export function findUnsafeProductionSecrets(env: NodeJS.ProcessEnv) {
  const failures: string[] = [];

  for (const key of REQUIRED_STRING_SECRETS) {
    const value = env[key]?.trim();
    if (!value) continue;
    failures.push(...validateStringSecret(key, value));
  }

  for (const [index, value] of parseSecretList(
    env.CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS,
  ).entries()) {
    failures.push(
      ...validateStringSecret(
        `CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS[${index}]`,
        value,
      ),
    );
  }

  const encryptionKey = env.APP_ENCRYPTION_KEY?.trim();
  if (encryptionKey) {
    if (SECRET_PLACEHOLDER_PATTERN.test(encryptionKey)) {
      failures.push(
        "APP_ENCRYPTION_KEY must be a private 32-byte key, not a placeholder.",
      );
    }
    const material = parseEncryptionKeyMaterial(encryptionKey);
    if (!material) {
      failures.push(
        "APP_ENCRYPTION_KEY must decode to exactly 32 bytes using base64:, utf8:, base64, or raw utf8 encoding.",
      );
    } else if (hasLowDiversity(material)) {
      failures.push(
        "APP_ENCRYPTION_KEY must be high-entropy and must not use repeated or low-diversity bytes.",
      );
    }
  }

  return failures;
}

function validateStringSecret(key: string, value: string) {
  const failures: string[] = [];
  if (Buffer.byteLength(value, "utf8") < SECRET_MIN_BYTES) {
    failures.push(`${key} must be at least ${SECRET_MIN_BYTES} bytes.`);
  }
  if (SECRET_PLACEHOLDER_PATTERN.test(value)) {
    failures.push(`${key} must be private and must not be a placeholder.`);
  }
  if (hasLowDiversity(Buffer.from(value, "utf8"))) {
    failures.push(
      `${key} must be high-entropy and must not use repeated or low-diversity characters.`,
    );
  }
  return failures;
}

function findDuplicateProductionSecrets(env: NodeJS.ProcessEnv) {
  const fingerprints = new Map<string, Set<string>>();

  for (const key of REQUIRED_DISTINCT_SECRETS) {
    for (const fingerprint of productionSecretFingerprints(key, env[key])) {
      const owners = fingerprints.get(fingerprint) ?? new Set<string>();
      owners.add(key);
      fingerprints.set(fingerprint, owners);
    }
  }

  for (const [index, value] of parseSecretList(
    env.CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS,
  ).entries()) {
    const key = `CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS[${index}]`;
    for (const fingerprint of productionSecretFingerprints(key, value)) {
      const owners = fingerprints.get(fingerprint) ?? new Set<string>();
      owners.add(key);
      fingerprints.set(fingerprint, owners);
    }
  }

  const duplicates = new Map<string, string[]>();
  for (const owners of fingerprints.values()) {
    if (owners.size < 2) continue;
    const keys = [...owners].sort();
    duplicates.set(keys.join("|"), keys);
  }

  return [...duplicates.values()];
}

function parseSecretList(value?: string) {
  return (value ?? "")
    .split(",")
    .map((secret) => secret.trim())
    .filter(Boolean);
}

function productionSecretFingerprints(key: string, value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return [];

  const rawFingerprint = `raw:${trimmed}`;
  if (key === "APP_ENCRYPTION_KEY") {
    const material = parseEncryptionKeyMaterial(trimmed);
    return material
      ? [rawFingerprint, `bytes:${material.toString("base64url")}`]
      : [rawFingerprint];
  }

  return [
    rawFingerprint,
    `bytes:${Buffer.from(trimmed, "utf8").toString("base64url")}`,
  ];
}

function parseEncryptionKeyMaterial(value: string) {
  const normalized = value.trim();
  if (normalized.startsWith("base64:")) {
    return validKeyBuffer(parseBase64Key(normalized.slice("base64:".length)));
  }
  if (normalized.startsWith("utf8:")) {
    return validKeyBuffer(
      Buffer.from(normalized.slice("utf8:".length), "utf8"),
    );
  }

  const base64Key = parseBase64Key(normalized);
  if (base64Key?.length === 32) return base64Key;

  return validKeyBuffer(Buffer.from(normalized, "utf8"));
}

function parseBase64Key(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return null;
  if (normalized.length % 4 === 1) return null;
  const buffer = Buffer.from(normalized, "base64");
  const withoutPadding = (candidate: string) => candidate.replace(/=+$/, "");
  if (
    withoutPadding(buffer.toString("base64")) !== withoutPadding(normalized)
  ) {
    return null;
  }
  return buffer;
}

function validKeyBuffer(buffer: Buffer | null) {
  return buffer?.length === 32 ? buffer : null;
}

function hasLowDiversity(value: Buffer) {
  return new Set(value).size < 8;
}
