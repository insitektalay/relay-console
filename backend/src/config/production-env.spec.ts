import {
  assertDestructiveSeedAllowed,
  assertProductionEnvironment,
  shouldAssertProductionEnvironment,
} from "./production-env";

const strongEncryptionKey = Buffer.from(
  "0123456789abcdef0123456789abcdef",
  "utf8",
).toString("base64");
const testDatabaseCa = `-----BEGIN CERTIFICATE-----
MIIC6DCCAdCgAwIBAgIJAIR6j0OOLwLXMA0GCSqGSIb3DQEBCwUAMCExHzAdBgNV
BAMMFkNsYXdDaGF0IE0wNiBUZXN0IFJvb3QwHhcNMjYwNzI3MjAxNTIzWhcNMzYw
NzI0MjAxNTIzWjAhMR8wHQYDVQQDDBZDbGF3Q2hhdCBNMDYgVGVzdCBSb290MIIB
IjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwY1fi6fueWsO6IzQMYCvJolY
6c2d3ygzP1WuniJP/kCCGXZMITfNKZbgcDh5xYMSukDEl3OMI6RzlZxgEkMBvc3k
Rz3ROs1i7s7y3q1HF70U2wzd2sEvk+vTEuH/y+5uteNRDyYI0H9+cWXc7vgRLXuY
PGEes939nY+13gSYjxy9o5kRlGS39r2ok2Kqp0eiGYQD8OsRBxxHl89prb/o/a1a
ENDiqXtLXzc3TfTMeMos+gQc9HtRvQSYpxewzIDixzKv07LhpFybtR6lH+EOavun
5UpvnxGQKydkMuF76fGF59AdhwlsLp7ffHlLlRjV3n8txQdixMVWIaEHE/z7UQID
AQABoyMwITAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG
9w0BAQsFAAOCAQEATxUWewVBDugTM5+rocWGllvMDcunz/KPy5K2OPufp+1b53N5
G1DOb8/zy1Z9elzF3I7AvO+7NfCVYnFOZFSX/d52CV6JBl1MQp2x6M7zV5GRErow
F98AULVw7n5T11BJZDjzD/Ouj1x256U12dU38likS2BB8VQMECm2JqViORQLfiC3
FXvsjWpzV+DP1JbSk24hhbLGwytQxA/jruxrND/JIK0YJCQ2GbN7WupZUYx2Ac9S
GSEkAN3x4/I7CYLarDfc8O5d2M7mtM4HlNDP7VJazy9OcoqJVyPNPOt0su6q3EX5
jz3bUL4XpbWAvQ+PpxGgT7tZnOyFOTV5GyDliA==
-----END CERTIFICATE-----`;

const validProductionEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  CORS_ORIGINS: "https://beta.clawchat.example",
  DATABASE_URL: "postgres://user:password@example.invalid:5432/clawchat",
  DATABASE_CA_CERT_BASE64: Buffer.from(testDatabaseCa).toString("base64"),
  DATABASE_TLS_SERVER_NAME: "localhost",
  REDIS_URL: "redis://:password@example.invalid:6379",
  JWT_SECRET: "jwt-access-production-secret-2026-alpha",
  JWT_REFRESH_SECRET: "jwt-refresh-production-secret-2026-bravo",
  JWT_WS_SECRET: "jwt-websocket-production-secret-2026-charlie",
  JWT_ISSUER: "https://relay-owner.up.railway.app/api/v1",
  APP_ENCRYPTION_KEY: `base64:${strongEncryptionKey}`,
  APP_ENCRYPTION_KEY_VERSION: "v1",
  ATTACHMENT_PROVENANCE_SECRET:
    "attachment-provenance-production-secret-2026-delta",
  ATTACHMENT_SIGNING_SECRET: "attachment-download-signing-secret-2026-hotel",
  CONNECTION_DESCRIPTOR_PRIVATE_KEY:
    "ed25519-private-key-production-material-2026-echo",
  CONNECTION_DESCRIPTOR_PUBLIC_KEY:
    "ed25519-public-key-production-material-2026-foxtrot",
  RELAY_OPERATOR_API_SECRET: "relay-operator-production-secret-2026-golf",
  AUDIT_IDENTIFIER_HASH_SECRET:
    "audit-identifier-production-secret-2026-juliet",
  CLAWCHAT_BETA_INVITE_HASH_SECRET:
    "beta-invite-hash-production-secret-2026-india",
  CLAWCHAT_BETA_INVITE_CODES: "private-beta-code",
  CLAWCHAT_BETA_SIGNUP_MODE: "invite",
  CLAWCHAT_MARKETPLACE_BETA_MODE: "true",
  CLAWCHAT_MARKETPLACE_ALLOWED_APPS: "github,linear,notion",
  CLAWCHAT_MARKETPLACE_BLOCKED_APPS: "x,linkedin,stripe",
};

describe("assertProductionEnvironment", () => {
  it("accepts the beta-safe production feature flag posture", () => {
    expect(() => assertProductionEnvironment(validProductionEnv)).not.toThrow();
  });

  it("requires a canonical public self-hosted JWT issuer in production", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        JWT_ISSUER: undefined,
      }),
    ).toThrow(/JWT_ISSUER/);
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        JWT_ISSUER: "https://another-owner.up.railway.app/api/v1",
      }),
    ).not.toThrow();
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        JWT_ISSUER: "https://localhost/api/v1",
      }),
    ).toThrow(/canonical public HTTPS/);
  });

  it("does not require production env vars for local non-production runtimes", () => {
    expect(shouldAssertProductionEnvironment({ NODE_ENV: "development" })).toBe(
      false,
    );
    expect(() =>
      assertProductionEnvironment({ NODE_ENV: "development" }),
    ).not.toThrow();
  });

  it("runs fail-closed checks for Railway production even when NODE_ENV is mis-set", () => {
    expect(
      shouldAssertProductionEnvironment({
        NODE_ENV: "development",
        RAILWAY_ENVIRONMENT_NAME: "production",
      }),
    ).toBe(true);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        NODE_ENV: "development",
        RAILWAY_ENVIRONMENT_NAME: "production",
      }),
    ).toThrow(/NODE_ENV=production/);
  });

  it("runs fail-closed checks for public Railway services even when NODE_ENV is mis-set", () => {
    expect(
      shouldAssertProductionEnvironment({
        NODE_ENV: "test",
        RAILWAY_PUBLIC_DOMAIN: "example.up.railway.app",
        RAILWAY_SERVICE_ID: "service-id",
      }),
    ).toBe(true);

    expect(() =>
      assertProductionEnvironment({
        NODE_ENV: "test",
        RAILWAY_PUBLIC_DOMAIN: "example.up.railway.app",
        RAILWAY_SERVICE_ID: "service-id",
      }),
    ).toThrow(/Production-like deployment/);
  });

  it("rejects open production signup during public beta", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        CLAWCHAT_BETA_SIGNUP_MODE: "open",
      }),
    ).toThrow(/invite-only/);
  });

  it("allows production to expose the complete canonical marketplace catalog", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        CLAWCHAT_MARKETPLACE_BETA_MODE: "false",
      }),
    ).not.toThrow();
  });

  it("rejects short or placeholder invite seed codes in production", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        CLAWCHAT_BETA_INVITE_CODES: "short,replace-with-private-code",
      }),
    ).toThrow(/invite codes/);
  });

  it("requires a dedicated attachment provenance secret in production", () => {
    const { ATTACHMENT_PROVENANCE_SECRET, ...env } = validProductionEnv;
    expect(ATTACHMENT_PROVENANCE_SECRET).toBeDefined();

    expect(() => assertProductionEnvironment(env)).toThrow(
      /ATTACHMENT_PROVENANCE_SECRET/,
    );
  });

  it("requires pinned, identity-verified production database TLS", () => {
    const { DATABASE_CA_CERT_BASE64, ...withoutCa } = validProductionEnv;
    expect(DATABASE_CA_CERT_BASE64).toBeDefined();
    expect(() => assertProductionEnvironment(withoutCa)).toThrow(
      /DATABASE_CA_CERT_BASE64/,
    );

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        DATABASE_TLS_SERVER_NAME: "wrong name",
      }),
    ).toThrow(/DATABASE_TLS_SERVER_NAME/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        DATABASE_URL:
          "postgres://user:password@example.invalid/clawchat?sslmode=no-verify",
      }),
    ).toThrow(/must not contain SSL query parameters/);
  });

  it("rejects long-lived or ambiguous bridge token lifetimes", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        BRIDGE_ACCESS_EXPIRES_IN: "30d",
      }),
    ).toThrow(/BRIDGE_ACCESS_EXPIRES_IN/);
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        BRIDGE_WS_EXPIRES_IN: "12h",
      }),
    ).toThrow(/BRIDGE_WS_EXPIRES_IN/);
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        BRIDGE_ACCESS_EXPIRED_GRACE_IN: "30d",
      }),
    ).toThrow(/BRIDGE_ACCESS_EXPIRED_GRACE_IN/);
  });

  it("requires a dedicated attachment download-signing secret in production", () => {
    const { ATTACHMENT_SIGNING_SECRET, ...env } = validProductionEnv;
    expect(ATTACHMENT_SIGNING_SECRET).toBeDefined();

    expect(() => assertProductionEnvironment(env)).toThrow(
      /ATTACHMENT_SIGNING_SECRET/,
    );
  });

  it("requires a dedicated invite-hash secret in production", () => {
    const { CLAWCHAT_BETA_INVITE_HASH_SECRET, ...env } = validProductionEnv;
    expect(CLAWCHAT_BETA_INVITE_HASH_SECRET).toBeDefined();

    expect(() => assertProductionEnvironment(env)).toThrow(
      /CLAWCHAT_BETA_INVITE_HASH_SECRET/,
    );
  });

  it("requires a dedicated audit-identifier secret and bounded retention", () => {
    const { AUDIT_IDENTIFIER_HASH_SECRET, ...withoutAuditSecret } =
      validProductionEnv;
    expect(AUDIT_IDENTIFIER_HASH_SECRET).toBeDefined();
    expect(() => assertProductionEnvironment(withoutAuditSecret)).toThrow(
      /AUDIT_IDENTIFIER_HASH_SECRET/,
    );

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_AUTH_AUDIT_RETENTION_DAYS: "31",
      }),
    ).toThrow(/RELAY_AUTH_AUDIT_RETENTION_DAYS/);
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_AUDIT_RETENTION_DAYS: "91",
      }),
    ).toThrow(/RELAY_AUDIT_RETENTION_DAYS/);
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_RUNTIME_DISPATCH_PAYLOAD_RETENTION_DAYS: "8",
      }),
    ).toThrow(/RELAY_RUNTIME_DISPATCH_PAYLOAD_RETENTION_DAYS/);
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_RUNTIME_DISPATCH_RETENTION_DAYS: "31",
      }),
    ).toThrow(/RELAY_RUNTIME_DISPATCH_RETENTION_DAYS/);
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_SYNC_CHANGE_RETENTION_DAYS: "31",
      }),
    ).toThrow(/RELAY_SYNC_CHANGE_RETENTION_DAYS/);
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_AUTH_AUDIT_RETENTION_DAYS: "14",
        RELAY_AUDIT_RETENTION_DAYS: "60",
      }),
    ).not.toThrow();
  });

  it("rejects weak or placeholder production secrets", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        JWT_SECRET: "your-super-secret-jwt-key-change-in-production",
        ATTACHMENT_PROVENANCE_SECRET: "short",
      }),
    ).toThrow(/JWT_SECRET|ATTACHMENT_PROVENANCE_SECRET/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS: "short",
      }),
    ).toThrow(/CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS\[0\]/);
  });

  it("rejects invalid or placeholder application encryption keys", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        APP_ENCRYPTION_KEY: "base64:replace-with-base64-encoded-32-byte-key",
      }),
    ).toThrow(/APP_ENCRYPTION_KEY/);
  });

  it("rejects reused production auth, encryption, and provenance secrets", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        JWT_REFRESH_SECRET: validProductionEnv.JWT_SECRET,
      }),
    ).toThrow(/JWT_REFRESH_SECRET, JWT_SECRET/);

    const reusedEncryptionSecret = "0123456789abcdef0123456789abcdef";
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        JWT_SECRET: reusedEncryptionSecret,
        APP_ENCRYPTION_KEY: `utf8:${reusedEncryptionSecret}`,
      }),
    ).toThrow(/APP_ENCRYPTION_KEY, JWT_SECRET/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        ATTACHMENT_SIGNING_SECRET: validProductionEnv.JWT_SECRET,
      }),
    ).toThrow(/ATTACHMENT_SIGNING_SECRET, JWT_SECRET/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        CLAWCHAT_BETA_INVITE_HASH_SECRET: validProductionEnv.JWT_SECRET,
      }),
    ).toThrow(/CLAWCHAT_BETA_INVITE_HASH_SECRET, JWT_SECRET/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS:
          validProductionEnv.CLAWCHAT_BETA_INVITE_HASH_SECRET,
      }),
    ).toThrow(
      /CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS\[0\].*CLAWCHAT_BETA_INVITE_HASH_SECRET/,
    );
  });

  it("rejects destructive startup seeding in production-like environments", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        SEED_ON_START: "true",
      }),
    ).toThrow(/SEED_ON_START=false/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RAILWAY_ENVIRONMENT_NAME: "beta",
        SEED_ON_START: "1",
      }),
    ).toThrow(/SEED_ON_START=false/);
  });

  it("requires complete live Stripe configuration when Relay billing is enabled", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_BILLING_ENABLED: "true",
      }),
    ).toThrow(/STRIPE_SECRET_KEY/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_BILLING_ENABLED: "true",
        STRIPE_SECRET_KEY: "sk_test_not_live",
        STRIPE_WEBHOOK_SECRET: "whsec_production",
        STRIPE_RELAY_CLOUD_PRICE_ID: "price_relay_cloud_monthly",
        RELAY_PUBLIC_WEB_ORIGIN: "https://relayconsole.work",
      }),
    ).toThrow(/live Stripe secret key/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_BILLING_ENABLED: "true",
        STRIPE_SECRET_KEY: "sk_live_relay_console_production",
        STRIPE_WEBHOOK_SECRET: "whsec_production",
        STRIPE_RELAY_CLOUD_PRICE_ID: "price_relay_cloud_monthly",
        RELAY_PUBLIC_WEB_ORIGIN: "https://relayconsole.work",
      }),
    ).not.toThrow();

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RAILWAY_ENVIRONMENT_NAME: "staging",
        RELAY_BILLING_ENABLED: "true",
        STRIPE_SECRET_KEY: "sk_test_relay_console_staging",
        STRIPE_WEBHOOK_SECRET: "whsec_staging",
        STRIPE_RELAY_CLOUD_PRICE_ID: "price_relay_cloud_monthly_test",
        RELAY_PUBLIC_WEB_ORIGIN: "https://relayconsole.work",
      }),
    ).not.toThrow();
  });

  it("requires a provider, sender, and public origin when transactional email is enabled", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_TRANSACTIONAL_EMAIL_ENABLED: "true",
      }),
    ).toThrow(/RESEND_API_KEY/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_TRANSACTIONAL_EMAIL_ENABLED: "true",
        RESEND_API_KEY: "re_live_production",
        RELAY_EMAIL_FROM: "Relay Console <account@relayconsole.work>",
        RELAY_PUBLIC_WEB_ORIGIN: "https://relayconsole.work",
      }),
    ).not.toThrow();
  });

  it("requires isolated provider and encryption configuration for managed Relay Cloud", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_MANAGED_CLOUD_ENABLED: "1",
      }),
    ).toThrow(/must be exactly true or false/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_MANAGED_CLOUD_ENABLED: "true",
        STRIPE_RELAY_MANAGED_CLOUD_PRICE_ID: "price_managed_cloud_monthly",
      }),
    ).toThrow(/RELAY_MANAGED_RAILWAY_TOKEN/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_MANAGED_CLOUD_ENABLED: "true",
        STRIPE_RELAY_MANAGED_CLOUD_PRICE_ID: "price_managed_cloud_monthly",
        RELAY_MANAGED_RAILWAY_TOKEN: "managed-railway-token-value",
        RELAY_MANAGED_RAILWAY_PROJECT_ID: "project-id",
        RELAY_MANAGED_RAILWAY_ENVIRONMENT_ID: "environment-id",
        RELAY_MANAGED_HERMES_IMAGE: "ghcr.io/relayconsole/hermes:release",
        MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY:
          "managed-runtime-key-aaaaaaaaaaaaaaaa",
        RUNTIME_MIGRATION_ENCRYPTION_KEY: "migration-key-bbbbbbbbbbbbbbbbbbbbb",
      }),
    ).not.toThrow();
  });

  it("requires complete Apple server billing configuration when App Store billing is enabled", () => {
    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_APPLE_BILLING_ENABLED: "true",
      }),
    ).toThrow(/APPLE_BUNDLE_ID/);

    expect(() =>
      assertProductionEnvironment({
        ...validProductionEnv,
        RELAY_APPLE_BILLING_ENABLED: "true",
        APPLE_BUNDLE_ID: "not a bundle id",
        APPLE_APP_ID: "not-numeric",
        APPLE_RELAY_CLOUD_PRODUCT_ID: "invalid product id",
        APPLE_ROOT_CA_BASE64_JSON: '["not-a-certificate"]',
      }),
    ).toThrow(
      /APPLE_APP_ID.*APPLE_BUNDLE_ID.*APPLE_RELAY_CLOUD_PRODUCT_ID.*APPLE_ROOT_CA_BASE64_JSON/s,
    );
  });

  it("blocks direct destructive seed execution in production-like environments", () => {
    expect(() =>
      assertDestructiveSeedAllowed({ NODE_ENV: "development" }),
    ).not.toThrow();
    expect(() => assertDestructiveSeedAllowed(validProductionEnv)).toThrow(
      /destructive demo seed/,
    );
  });
});
