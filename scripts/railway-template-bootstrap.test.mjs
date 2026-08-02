import assert from "node:assert/strict";
import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  deriveConnectionDescriptorKeyPair,
  loadOrCreateLifecycleRegistry,
  verifyCaBootstrapResponse,
} from "../backend/security/railway-template-bootstrap.mjs";
import { auditProductionSecrets } from "../backend/security/production-secret-audit.mjs";

const productionEnvSource = await readFile(
  new URL("../backend/src/config/production-env.spec.ts", import.meta.url),
  "utf8",
);
const caPem = productionEnvSource.match(
  /const testDatabaseCa = `([\s\S]+?-----END CERTIFICATE-----)`/,
)?.[1];
assert.ok(caPem, "production TLS test CA fixture must exist");

test("authenticates the private PostgreSQL CA response and rejects substitution", () => {
  const nonce = "ab".repeat(32);
  const secretHex = "19".repeat(32);
  const ca = Buffer.from(caPem).toString("base64");
  const hmac = createHmac("sha256", Buffer.from(secretHex, "hex"))
    .update(`${nonce}.${ca}`)
    .digest("hex");

  assert.equal(
    verifyCaBootstrapResponse({ nonce, secretHex, payload: { ca, hmac } }).ca,
    caPem,
  );
  assert.throws(
    () =>
      verifyCaBootstrapResponse({
        nonce,
        secretHex,
        payload: { ca: Buffer.from(`${caPem}\n`).toString("base64"), hmac },
      }),
    /authentication failed/,
  );
});

test("derives one stable matching Ed25519 descriptor keypair", () => {
  const first = deriveConnectionDescriptorKeyPair("42".repeat(32));
  const second = deriveConnectionDescriptorKeyPair("42".repeat(32));
  assert.deepEqual(first, second);
  const privateKey = createPrivateKey({
    key: Buffer.from(first.privateKey, "base64"),
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey({
    key: Buffer.from(first.publicKey, "base64"),
    format: "der",
    type: "spki",
  });
  const message = Buffer.from("relay-template-bootstrap");
  assert.equal(
    verify(null, message, publicKey, sign(null, message, privateKey)),
    true,
  );
  assert.throws(
    () => deriveConnectionDescriptorKeyPair("short"),
    /32 random bytes/,
  );
});

test("persists the lifecycle registry once and reuses it on later replicas", async () => {
  let persisted;
  const client = {
    async query(sql, parameters = []) {
      if (sql.includes("INSERT INTO")) persisted ??= JSON.parse(parameters[0]);
      if (sql.includes('SELECT "registry"'))
        return { rows: [{ registry: persisted }] };
      return { rows: [] };
    },
  };
  const first = await loadOrCreateLifecycleRegistry(client);
  const second = await loadOrCreateLifecycleRegistry(client);
  assert.deepEqual(second, first);
  assert.equal(first.schemaVersion, "relay.secret-lifecycle.v1");
  assert.ok(first.materials.DATABASE_CA_BOOTSTRAP_SECRET);
  assert.ok(first.materials.production_database_password);
});

test("the bootstrapped material set passes the unchanged production secret audit", async () => {
  let persisted;
  const client = {
    async query(sql, parameters = []) {
      if (sql.includes("INSERT INTO")) persisted ??= JSON.parse(parameters[0]);
      if (sql.includes('SELECT "registry"'))
        return { rows: [{ registry: persisted }] };
      return { rows: [] };
    },
  };
  const pair = deriveConnectionDescriptorKeyPair("73".repeat(32));
  const registry = await loadOrCreateLifecycleRegistry(client);
  const unique = (label) => `${label}-${"0123456789abcdef".repeat(3)}`;
  const result = auditProductionSecrets(
    {
      JWT_SECRET: unique("jwt-access"),
      JWT_REFRESH_SECRET: unique("jwt-refresh"),
      JWT_WS_SECRET: unique("jwt-websocket"),
      APP_ENCRYPTION_KEY: `utf8:0123456789abcdefghijklmnopqrstuv`,
      APP_ENCRYPTION_KEY_VERSION: "v1",
      ATTACHMENT_PROVENANCE_SECRET: unique("attachment-provenance"),
      ATTACHMENT_SIGNING_SECRET: unique("attachment-signing"),
      CONNECTION_DESCRIPTOR_PRIVATE_KEY: pair.privateKey,
      CONNECTION_DESCRIPTOR_PUBLIC_KEY: pair.publicKey,
      RELAY_OPERATOR_API_SECRET: unique("operator-api"),
      AUDIT_IDENTIFIER_HASH_SECRET: unique("audit-hash"),
      CLAWCHAT_BETA_INVITE_HASH_SECRET: unique("invite-hash"),
      CLAWCHAT_BETA_INVITE_CODES: unique("initial-invite"),
      DATABASE_CA_BOOTSTRAP_SECRET: "0123456789abcdef".repeat(4),
      DATABASE_URL: `postgresql://postgres:${unique("database-password")}@postgres.invalid:5432/railway`,
      REDIS_URL: `redis://default:${unique("redis-password")}@redis.invalid:6379`,
      RELAY_SECRET_LIFECYCLE_JSON: JSON.stringify(registry),
      CLAWCHAT_BETA_SIGNUP_MODE: "invite",
    },
    { requireDeploymentIdentity: false },
  );
  assert.deepEqual(result.failures, []);
  assert.equal(result.status, "passed");
});
