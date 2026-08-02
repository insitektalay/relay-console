#!/usr/bin/env node

import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  X509Certificate,
} from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";
import { checkServerIdentity } from "node:tls";

const { Client } = pg;
const TEMPLATE_FLAG = "RELAY_RAILWAY_TEMPLATE_BOOTSTRAP";
const LIFECYCLE_TABLE = "relay_installation_secret_lifecycle";
const ADVISORY_LOCK_ID = "731944708512036511";
const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);
const MATERIAL_NAMES = Object.freeze(
  [
    "APP_ENCRYPTION_KEY",
    "ATTACHMENT_PROVENANCE_SECRET",
    "ATTACHMENT_SIGNING_SECRET",
    "AUDIT_IDENTIFIER_HASH_SECRET",
    "CLAWCHAT_BETA_INVITE_CODES",
    "CLAWCHAT_BETA_INVITE_HASH_SECRET",
    "CONNECTION_DESCRIPTOR_PRIVATE_KEY",
    "DATABASE_CA_BOOTSTRAP_SECRET",
    "JWT_REFRESH_SECRET",
    "JWT_SECRET",
    "JWT_WS_SECRET",
    "RELAY_OPERATOR_API_SECRET",
    "production_database_password",
    "production_redis_password",
  ].sort(),
);

function required(env, name) {
  const value = env[name]?.trim();
  if (!value)
    throw new Error(`${name} is required for Railway template bootstrap.`);
  return value;
}

export function deriveConnectionDescriptorKeyPair(seedHex) {
  if (!/^[0-9a-f]{64}$/i.test(seedHex)) {
    throw new Error(
      "CONNECTION_DESCRIPTOR_SEED must be exactly 32 random bytes encoded as hex.",
    );
  }
  const privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.from(seedHex, "hex")]),
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey(privateKey);
  return {
    privateKey: privateKey
      .export({ format: "der", type: "pkcs8" })
      .toString("base64"),
    publicKey: publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64"),
  };
}

export function verifyCaBootstrapResponse({ nonce, secretHex, payload }) {
  if (!payload || typeof payload !== "object") {
    throw new Error("PostgreSQL CA bootstrap returned an invalid response.");
  }
  const caBase64 = typeof payload.ca === "string" ? payload.ca : "";
  const receivedMac = typeof payload.hmac === "string" ? payload.hmac : "";
  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(caBase64) ||
    !/^[0-9a-f]{64}$/i.test(receivedMac)
  ) {
    throw new Error("PostgreSQL CA bootstrap response is malformed.");
  }
  const expectedMac = createHmac("sha256", Buffer.from(secretHex, "hex"))
    .update(`${nonce}.${caBase64}`, "utf8")
    .digest();
  const actualMac = Buffer.from(receivedMac, "hex");
  if (
    actualMac.length !== expectedMac.length ||
    !timingSafeEqual(actualMac, expectedMac)
  ) {
    throw new Error("PostgreSQL CA bootstrap authentication failed.");
  }
  const ca = Buffer.from(caBase64, "base64").toString("utf8");
  const certificate = new X509Certificate(ca);
  if (
    !certificate.ca ||
    Date.parse(certificate.validTo) < Date.now() + 24 * 60 * 60 * 1000
  ) {
    throw new Error(
      "PostgreSQL CA bootstrap did not return a currently valid CA certificate.",
    );
  }
  return { ca, caBase64 };
}

export async function fetchAuthenticatedDatabaseCa(
  env,
  fetchImplementation = fetch,
) {
  const endpoint = new URL(required(env, "DATABASE_CA_BOOTSTRAP_URL"));
  if (
    endpoint.protocol !== "http:" ||
    !endpoint.hostname.endsWith(".railway.internal")
  ) {
    throw new Error(
      "DATABASE_CA_BOOTSTRAP_URL must use Railway private networking over http.",
    );
  }
  const secretHex = required(env, "DATABASE_CA_BOOTSTRAP_SECRET");
  if (!/^[0-9a-f]{64}$/i.test(secretHex)) {
    throw new Error(
      "DATABASE_CA_BOOTSTRAP_SECRET must be 32 random bytes encoded as hex.",
    );
  }
  const nonce = randomBytes(32).toString("hex");
  const response = await fetchImplementation(endpoint, {
    headers: { "x-relay-nonce": nonce },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(
      `PostgreSQL CA bootstrap failed with HTTP ${response.status}.`,
    );
  return verifyCaBootstrapResponse({
    nonce,
    secretHex,
    payload: await response.json(),
  });
}

async function retry(operation, label, attempts = 60) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delayMs = Math.min(1000 * attempt, 5000);
      console.warn(
        `${label} is not ready (attempt ${attempt}); retrying in ${delayMs}ms.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function lifecycleRegistry(createdAt) {
  const reviewedAt = new Date(createdAt);
  const nextReviewAt = new Date(
    reviewedAt.getTime() + 60 * 24 * 60 * 60 * 1000,
  );
  const entry = {
    version: "v1",
    lastRotatedAt: reviewedAt.toISOString(),
    lastReviewedAt: reviewedAt.toISOString(),
    nextReviewAt: nextReviewAt.toISOString(),
  };
  return {
    schemaVersion: "relay.secret-lifecycle.v1",
    materials: Object.fromEntries(MATERIAL_NAMES.map((name) => [name, entry])),
  };
}

export async function loadOrCreateLifecycleRegistry(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${LIFECYCLE_TABLE} (
      id smallint PRIMARY KEY CHECK (id = 1),
      "registry" jsonb NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query(
    `INSERT INTO ${LIFECYCLE_TABLE} (id, "registry")
     VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(lifecycleRegistry(new Date()))],
  );
  const { rows } = await client.query(
    `SELECT "registry" FROM ${LIFECYCLE_TABLE} WHERE id = 1`,
  );
  if (!rows[0]?.registry)
    throw new Error("The persisted secret lifecycle registry is missing.");
  return rows[0].registry;
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} ${args.join(" ")} exited with ${signal ?? code}.`,
          ),
        );
    });
  });
}

function startApplication(env) {
  const child = spawn(process.execPath, ["dist/main.js"], {
    env,
    stdio: "inherit",
  });
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.once("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
  child.once("error", (error) => {
    console.error("Railway application process failed", error);
    process.exitCode = 1;
  });
}

export async function runTemplateBootstrap(env = process.env) {
  const { ca, caBase64 } = await retry(
    () => fetchAuthenticatedDatabaseCa(env),
    "PostgreSQL CA bootstrap",
  );
  const pair = deriveConnectionDescriptorKeyPair(
    required(env, "CONNECTION_DESCRIPTOR_SEED"),
  );
  const runtimeEnv = {
    ...env,
    DATABASE_CA_CERT_BASE64: caBase64,
    DATABASE_TLS_SERVER_NAME: "localhost",
    CONNECTION_DESCRIPTOR_PRIVATE_KEY: pair.privateKey,
    CONNECTION_DESCRIPTOR_PUBLIC_KEY: pair.publicKey,
  };
  delete runtimeEnv.CONNECTION_DESCRIPTOR_SEED;

  const client = await retry(async () => {
    const candidate = new Client({
      connectionString: required(runtimeEnv, "DATABASE_URL"),
      connectionTimeoutMillis: 10_000,
      ssl: {
        ca,
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
        checkServerIdentity: (_hostname, certificate) =>
          checkServerIdentity("localhost", certificate),
      },
    });
    try {
      await candidate.connect();
      return candidate;
    } catch (error) {
      await candidate.end().catch(() => undefined);
      throw error;
    }
  }, "Verified PostgreSQL connection");
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_ID]);
    runtimeEnv.RELAY_SECRET_LIFECYCLE_JSON = JSON.stringify(
      await loadOrCreateLifecycleRegistry(client),
    );
    await run(
      process.execPath,
      ["security/production-secret-audit.mjs"],
      runtimeEnv,
    );
    await run(process.execPath, ["dist/scripts/run-migrations.js"], runtimeEnv);
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
    } finally {
      await client.end();
    }
  }
  startApplication(runtimeEnv);
}

async function runLegacyStartup(env) {
  await run(process.execPath, ["security/production-secret-audit.mjs"], env);
  await run(process.execPath, ["dist/scripts/run-migrations.js"], env);
  startApplication(env);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const action =
    process.env[TEMPLATE_FLAG] === "true"
      ? runTemplateBootstrap
      : runLegacyStartup;
  action(process.env).catch((error) => {
    console.error("Railway startup failed", error);
    process.exitCode = 1;
  });
}
