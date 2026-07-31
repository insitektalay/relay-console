import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { auditProductionSecrets } from "../backend/security/production-secret-audit.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const setupFiles = [
  "SELF_HOSTING.md",
  "docs/RUNTIME_SETUP.md",
  "docs/openclaw-bridge-beta-preview.md",
  "claude-runtime/README.md",
  "backend/railway.variables.example",
];

test("public setup docs contain no maintainer infrastructure or local paths", () => {
  const content = setupFiles.map((file) => read(file)).join("\n");
  assert.doesNotMatch(content, /\/Users\/|\\Users\\|api\.relayconsole\.work/);
  assert.doesNotMatch(
    content,
    /aac9cbd8-55be-428c-84d1-4bcc40f91483|825cb83e-5fc4-4236-9d22-fd53578facfc|3c87a016-e9c1-41a4-9b3c-2f755e55840b/,
  );
});

test("self-host template covers the production environment contract", () => {
  const source = read("backend/src/config/production-env.ts");
  const requiredBlock = source.match(
    /const REQUIRED_PRODUCTION_ENV = \[([\s\S]*?)\n\];/,
  );
  assert.ok(requiredBlock, "production required-variable list was not found");
  const requiredNames = [
    ...requiredBlock[1].matchAll(/"([A-Z0-9_]+)"/g),
  ].map((match) => match[1]);
  const template = read("backend/railway.variables.example");
  const generator = read("scripts/generate-self-host-railway-env.mjs");

  for (const name of requiredNames) {
    assert.match(template, new RegExp(`^${name}=`, "m"), `${name} template`);
    assert.match(generator, new RegExp(`\\b${name}:`), `${name} generator`);
  }
  for (const name of [
    "DATABASE_URL",
    "DATABASE_CA_CERT_BASE64",
    "DATABASE_TLS_SERVER_NAME",
    "REDIS_URL",
    "RELAY_SECRET_LIFECYCLE_JSON",
  ]) {
    assert.match(template, new RegExp(`^${name}=`, "m"), `${name} template`);
    assert.match(generator, new RegExp(`\\b${name}:`), `${name} generator`);
  }
});

test("runtime guide matches the checked-in bridge compatibility contract", () => {
  const guide = read("docs/RUNTIME_SETUP.md");
  const manifest = JSON.parse(
    read("backend/src/modules/bridge/bridge-compatibility-manifest.json"),
  );
  const hermes = manifest.plugins.find((plugin) => plugin.id === "hermes-agent-bridge");
  const openclaw = manifest.plugins.find((plugin) => plugin.id === "openclaw-bridge");
  assert.ok(hermes);
  assert.ok(openclaw);
  assert.match(guide, new RegExp(hermes.supportedHarness.version.replaceAll(".", "\\.")));
  assert.match(guide, new RegExp(openclaw.supportedHarness.version.replaceAll(".", "\\.")));
  assert.match(guide, /f04043b7d9209fce797da336bccc9dddd0dfde4b/);
  assert.match(guide, /Settings >\s*Integrations > Runtime pairing/);
  assert.match(guide, /Settings > Integrations > Existing agents/);
  assert.match(guide, /Relay Console connected/);
});

test("relative setup-document links resolve inside the public repository", () => {
  for (const file of setupFiles.filter((name) => name.endsWith(".md"))) {
    const content = read(file);
    for (const match of content.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)#]+)(?:#[^)]+)?\)/g)) {
      const target = path.resolve(path.dirname(path.join(root, file)), match[1]);
      assert.doesNotThrow(() => statSync(target), `${file} links to missing ${match[1]}`);
    }
  }
});

test("Railway generator writes a complete owner-only variable file", () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), "relay-public-setup-"));
  try {
    const productionSpec = read("backend/src/config/production-env.spec.ts");
    const pem = productionSpec.match(
      /const testDatabaseCa = `(-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----)`;/,
    );
    assert.ok(pem, "test CA fixture was not found");
    const caPath = path.join(temp, "root.crt");
    const outputPath = path.join(temp, ".env.railway.generated");
    writeFileSync(caPath, `${pem[1]}\n`, "utf8");

    execFileSync(
      process.execPath,
      [
        path.join(root, "scripts/generate-self-host-railway-env.mjs"),
        "--backend-origin",
        "https://owner-backend.up.railway.app",
        "--web-origin",
        "https://owner-web.example",
        "--database-ca",
        caPath,
        "--output",
        outputPath,
      ],
      { stdio: "pipe" },
    );

    assert.equal(statSync(outputPath).mode & 0o777, 0o600);
    const generated = readFileSync(outputPath, "utf8");
    assert.match(generated, /^DATABASE_URL=\$\{\{Postgres\.DATABASE_URL\}\}$/m);
    assert.match(generated, /^REDIS_URL=\$\{\{Redis\.REDIS_URL\}\}$/m);
    assert.match(generated, /^DATABASE_TLS_SERVER_NAME=localhost$/m);
    assert.doesNotMatch(generated, /GENERATE_|YOUR-BACKEND|YOUR-WEB/);

    const lifecycleLine = generated
      .split("\n")
      .find((line) => line.startsWith("RELAY_SECRET_LIFECYCLE_JSON="));
    assert.ok(lifecycleLine);
    const lifecycle = JSON.parse(lifecycleLine.slice(lifecycleLine.indexOf("=") + 1));
    assert.equal(lifecycle.schemaVersion, "relay.secret-lifecycle.v1");
    assert.ok(lifecycle.materials.production_database_password);
    assert.ok(lifecycle.materials.production_redis_password);

    const generatedEnv = Object.fromEntries(
      generated
        .trim()
        .split("\n")
        .map((line) => {
          const separator = line.indexOf("=");
          return [line.slice(0, separator), line.slice(separator + 1)];
        }),
    );
    generatedEnv.DATABASE_URL =
      "postgresql://relay:" +
      "database-password-with-high-diversity-7QvL9mX2pR4s" +
      "@postgres.railway.internal:5432/railway";
    generatedEnv.REDIS_URL =
      "redis://default:" +
      "redis-password-with-high-diversity-3NzK8wT6cP5y" +
      "@redis.railway.internal:6379";
    Object.assign(generatedEnv, {
      RAILWAY_PROJECT_ID: "11111111-1111-4111-8111-111111111111",
      RAILWAY_ENVIRONMENT_ID: "22222222-2222-4222-8222-222222222222",
      RAILWAY_ENVIRONMENT_NAME: "production",
      RAILWAY_SERVICE_ID: "33333333-3333-4333-8333-333333333333",
      RAILWAY_SERVICE_NAME: "backend",
      RAILWAY_DEPLOYMENT_ID: "44444444-4444-4444-8444-444444444444",
      RAILWAY_PUBLIC_DOMAIN: "owner-backend.up.railway.app",
      RAILWAY_GIT_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567",
    });
    const audit = auditProductionSecrets(generatedEnv);
    assert.equal(audit.status, "passed", audit.failures.join("\n"));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
