import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const spec = JSON.parse(
  await readFile(new URL("railway/template-spec.json", root), "utf8"),
);
const backendRailway = JSON.parse(
  await readFile(new URL("backend/railway.json", root), "utf8"),
);
const allSources = await Promise.all(
  [
    "backend/security/railway-template-bootstrap.mjs",
    "backend/src/infrastructure/database/production-database-tls.ts",
    "railway/postgres/init-ssl.sh",
    "railway/postgres/relay-serve-ca.sh",
  ].map((path) => readFile(new URL(path, root), "utf8")),
);

test("defines the complete private three-service Railway topology", () => {
  assert.deepEqual(Object.keys(spec.services).sort(), [
    "Postgres",
    "Redis",
    "backend",
  ]);
  assert.equal(spec.dashboardPublishingRequired, true);
  assert.equal(spec.services.backend.rootDirectory, "/backend");
  assert.equal(spec.services.backend.configFilePath, "/backend/railway.json");
  assert.equal(spec.services.backend.publicHttpDomain, true);
  assert.equal(
    spec.services.Postgres.volumeMountPath,
    "/var/lib/postgresql/data",
  );
  assert.equal(spec.services.Postgres.publicNetworking, false);
  assert.equal(spec.services.Redis.publicNetworking, false);
  assert.equal(spec.services.Redis.persistentVolume, true);
});

test("uses private references, generated secrets, startup migrations and health checking", () => {
  const variables = spec.services.backend.variables;
  assert.equal(variables.DATABASE_URL, "${{Postgres.DATABASE_URL}}");
  assert.equal(variables.REDIS_URL, "${{Redis.REDIS_URL}}");
  assert.match(
    variables.DATABASE_CA_BOOTSTRAP_URL,
    /Postgres\.RAILWAY_PRIVATE_DOMAIN/,
  );
  assert.match(variables.JWT_SECRET, /^\$\{\{secret\(/);
  assert.match(variables.CONNECTION_DESCRIPTOR_SEED, /0123456789abcdef/);
  assert.equal(
    backendRailway.deploy.startCommand,
    "pnpm run railway:start:prod",
  );
  assert.equal(backendRailway.deploy.healthcheckPath, "/api/v1/health/live");
  assert.equal(variables.SEED_ON_START, "false");
});

test("keeps verified PostgreSQL TLS and contains no shared or hard-coded secret", () => {
  const joined = allSources.join("\n");
  assert.doesNotMatch(joined, /rejectUnauthorized\s*:\s*false/);
  assert.match(joined, /rejectUnauthorized:\s*true/);
  assert.match(joined, /checkServerIdentity\("localhost"/);
  assert.match(joined, /timingSafeEqual/);
  assert.match(joined, /pg_advisory_lock/);

  const rendered = JSON.stringify(spec);
  assert.doesNotMatch(rendered, /replace-with|changeme|shared-secret/i);
  assert.doesNotMatch(rendered, /https?:\/\/(?:localhost|127\.0\.0\.1)/);
});
