import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const compact = (value) => value.replace(/\s+/g, " ");

test("runtime ownership contract separates user distributions from Relay state", () => {
  const document = read("docs/RUNTIME_OWNERSHIP_BOUNDARIES.md");
  for (const required of [
    "User-owned runtime distribution",
    "Relay-owned local state",
    "Processes and schedulers",
    "Railway control plane",
    "Recovery rule",
    "must not install, update, reset, or uninstall",
    "A stale PID alone is never authority",
    "source authoritative until destination validation",
  ]) {
    assert.ok(compact(document).includes(required));
  }
});

test("bridge runbook covers the complete supported lifecycle on Railway", () => {
  const document = read("docs/relay-cloud/BRIDGE_OPERATOR_RUNBOOK.md");
  for (const heading of [
    "## Install",
    "## Update",
    "## Rollback",
    "## Credential rotation",
    "## Disconnect and removal",
    "## Failure triage",
  ]) {
    assert.match(document, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(document, /https:\/\/api\.relayconsole\.work/);
  assert.match(document, /\/api\/v1/);
  assert.ok(
    compact(document).includes(
      "Do not point Relay API or websocket traffic at a loopback backend",
    ),
  );
});

test("managed-runtime support runbook covers material operating incidents", () => {
  const document = read(
    "docs/relay-cloud/MANAGED_RUNTIME_SUPPORT_INCIDENT_RUNBOOK.md",
  );
  for (const heading of [
    "## Safe support data",
    "## Provisioning failure",
    "## Offline or degraded runtime",
    "## Storage or spend anomaly",
    "## Credential incident",
    "## Cancellation and deletion",
    "## Tenant-isolation incident",
    "## Exit criteria",
  ]) {
    assert.match(document, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(document, /30-day retention/);
  assert.match(document, /deployed from `backend\/` and verified on Railway/);
});

test("threat model covers every reconciled runtime architecture boundary", () => {
  const document = read("docs/security/RUNTIME_ARCHITECTURE_THREAT_MODEL.md");
  for (const threat of [
    "ownership transfer",
    "Connector v2",
    "Managed document",
    "Migration creates split brain",
    "Remediation deletes unrelated state",
    "Managed runtime crosses tenants",
    "Managed worker secret is exposed",
  ]) {
    assert.match(document, new RegExp(threat, "i"));
  }
  assert.match(document, /## Residual risks/);
  assert.match(document, /## Reassessment triggers/);
});

test("control-plane exception register remains bounded and credential-free", () => {
  const document = read("docs/relay-cloud/CONTROL_PLANE_DATA_BOUNDARY.md");
  assert.match(document, /only general document-byte exception/);
  assert.match(document, /at most 1 MiB per document/);
  assert.match(document, /at most 25 MiB and 2,000 documents per agent exchange/);
  assert.match(document, /must not copy a runtime's `.env`, `auth\.json`/);
  assert.ok(
    compact(document).includes(
      "excluded from ordinary repository selection",
    ),
  );
});

test("managed Railway example requires the correct credential classes", () => {
  const example = read("backend/.env.example");
  assert.match(
    example,
    /Railway GraphQL requires a workspace bearer token[\s\S]*A project token is not accepted/,
  );
  assert.match(example, /RELAY_MANAGED_RAILWAY_TOKEN=replace-with-workspace-bearer-token/);
  assert.match(example, /MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY/);
  assert.match(example, /RUNTIME_MIGRATION_ENCRYPTION_KEY/);
  assert.notStrictEqual(
    example.match(/MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY=(.*)/)?.[1],
    example.match(/RUNTIME_MIGRATION_ENCRYPTION_KEY=(.*)/)?.[1],
  );
});
