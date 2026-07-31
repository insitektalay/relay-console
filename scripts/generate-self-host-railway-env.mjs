#!/usr/bin/env node

import { generateKeyPairSync, randomBytes, X509Certificate } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) {
    fail(`missing ${name} <value>`);
  }
  return process.argv[index + 1];
}

function publicHttpsOrigin(raw, label, railwayOnly = false) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`${label} must be a valid URL`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  ) {
    fail(`${label} must be a public HTTPS origin with no path`);
  }
  if (railwayOnly && !url.hostname.endsWith(".up.railway.app")) {
    fail(`${label} must use the Railway service domain ending in .up.railway.app`);
  }
  return url.origin;
}

function secret(bytes = 48) {
  return randomBytes(bytes).toString("base64url");
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

const backendOrigin = publicHttpsOrigin(
  option("--backend-origin"),
  "--backend-origin",
  true,
);
const webOrigin = publicHttpsOrigin(option("--web-origin"), "--web-origin");
const caPath = resolve(option("--database-ca"));
const outputPath = resolve(option("--output"));

let caPem;
try {
  caPem = readFileSync(caPath, "utf8");
} catch {
  fail(`could not read database CA file: ${caPath}`);
}

let certificate;
try {
  certificate = new X509Certificate(caPem);
} catch {
  fail("--database-ca must contain one valid PEM certificate");
}
if (!certificate.ca) {
  fail("--database-ca must contain a CA certificate, not a server certificate");
}
if (Date.parse(certificate.validTo) <= Date.now() + 24 * 60 * 60 * 1000) {
  fail("the database CA certificate expires within 24 hours");
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateDer = privateKey
  .export({ format: "der", type: "pkcs8" })
  .toString("base64");
const publicDer = publicKey
  .export({ format: "der", type: "spki" })
  .toString("base64");

const materialNames = [
  "APP_ENCRYPTION_KEY",
  "ATTACHMENT_PROVENANCE_SECRET",
  "ATTACHMENT_SIGNING_SECRET",
  "AUDIT_IDENTIFIER_HASH_SECRET",
  "CLAWCHAT_BETA_INVITE_CODES",
  "CLAWCHAT_BETA_INVITE_HASH_SECRET",
  "CONNECTION_DESCRIPTOR_PRIVATE_KEY",
  "JWT_REFRESH_SECRET",
  "JWT_SECRET",
  "JWT_WS_SECRET",
  "RELAY_OPERATOR_API_SECRET",
  "production_database_password",
  "production_redis_password",
].sort();
const createdAt = new Date();
const lifecycle = {
  schemaVersion: "relay.secret-lifecycle.v1",
  materials: Object.fromEntries(
    materialNames.map((name) => [
      name,
      {
        version: "v1",
        lastRotatedAt: createdAt.toISOString(),
        lastReviewedAt: createdAt.toISOString(),
        nextReviewAt: addDays(createdAt, 60).toISOString(),
      },
    ]),
  ),
};

const values = {
  NODE_ENV: "production",
  PORT: "3000",
  WS_PORT: "3000",
  API_PREFIX: "api/v1",
  SEED_ON_START: "false",
  CORS_ORIGINS: webOrigin,
  JWT_ISSUER: `${backendOrigin}/api/v1`,
  DATABASE_URL: "${{Postgres.DATABASE_URL}}",
  DATABASE_CA_CERT_BASE64: Buffer.from(caPem, "utf8").toString("base64"),
  DATABASE_TLS_SERVER_NAME: "localhost",
  REDIS_URL: "${{Redis.REDIS_URL}}",
  CLAWCHAT_BETA_SIGNUP_MODE: "invite",
  CLAWCHAT_BETA_INVITE_CODES: secret(24),
  CLAWCHAT_BETA_INVITE_HASH_SECRET: secret(),
  AUDIT_IDENTIFIER_HASH_SECRET: secret(),
  JWT_SECRET: secret(),
  JWT_REFRESH_SECRET: secret(),
  JWT_WS_SECRET: secret(),
  ATTACHMENT_PROVENANCE_SECRET: secret(),
  ATTACHMENT_SIGNING_SECRET: secret(),
  RELAY_OPERATOR_API_SECRET: secret(),
  APP_ENCRYPTION_KEY_VERSION: "v1",
  APP_ENCRYPTION_KEY: `base64:${randomBytes(32).toString("base64")}`,
  CONNECTION_DESCRIPTOR_PRIVATE_KEY: privateDer,
  CONNECTION_DESCRIPTOR_PUBLIC_KEY: publicDer,
  RELAY_SECRET_LIFECYCLE_JSON: JSON.stringify(lifecycle),
  CLAWCHAT_API_DOCS_ENABLED: "false",
  CLAWCHAT_INTERNAL_API_DOCS_ENABLED: "false",
  CLAWCHAT_MARKETPLACE_BETA_MODE: "true",
  CLAWCHAT_MARKETPLACE_ALLOWED_APPS: "github,gitlab,linear,notion",
  CLAWCHAT_MARKETPLACE_BLOCKED_APPS:
    "x,linkedin,stripe,railway,vercel,supabase",
  RELAY_BILLING_ENABLED: "false",
  RELAY_MANAGED_CLOUD_ENABLED: "false",
  RELAY_TRANSACTIONAL_EMAIL_ENABLED: "false",
  RELAY_APPLE_BILLING_ENABLED: "false",
};

const contents =
  Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n") + "\n";

writeFileSync(outputPath, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
chmodSync(outputPath, 0o600);
process.stdout.write(`Wrote owner-only Railway variables to ${outputPath}\n`);
process.stdout.write(
  "Copy the file through Railway's backend Variables Raw Editor, then delete the local file after saving the invite code.\n",
);
