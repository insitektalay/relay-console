#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(SCRIPT_PATH, "../..");

export const FAILURE_RECOVERY_JOURNEYS = [
  {
    id: "railway_unavailable",
    evidence: [
      ["backend/src/modules/health/health.service.spec.ts", "reports degraded readiness on database failure"],
      ["backend/src/modules/health/health.controller.spec.ts", "HTTP 503 when a dependency is unavailable"],
    ],
  },
  {
    id: "redis_or_queue_unavailable",
    evidence: [
      ["backend/src/modules/health/health.service.spec.ts", "degraded readiness on Redis failure"],
      ["backend/src/modules/health/health.service.spec.ts", "degraded readiness on Bull queue failure"],
    ],
  },
  {
    id: "database_migration_failure",
    evidence: [
      ["backend/src/infrastructure/database/destructive-migration-guard.spec.ts", "fails closed when production-like pending destructive migrations would touch data"],
      ["backend/src/config/migration-startup.spec.ts", "guards historical destructive migrations"],
    ],
  },
  {
    id: "expired_or_revoked_human_session",
    evidence: [
      ["backend/src/modules/auth/strategies/jwt.strategy.spec.ts", "rejects browser web sessions that do not match the active-session predicate"],
      ["backend/src/modules/auth/strategies/jwt.strategy.spec.ts", "rejects a bearer access token for a revoked mobile session immediately"],
      ["backend/src/modules/auth/auth.controller.spec.ts", "does not rotate tokens when refresh JWT verification fails"],
      ["backend/src/modules/auth/auth.service.spec.ts", "revokes a browser session when concurrent refresh rotation loses compare-and-swap"],
      ["backend/src/modules/auth/auth.service.spec.ts", "revokes a mobile session when concurrent refresh rotation loses compare-and-swap"],
      ["backend/src/gateways/events.gateway.spec.ts", "binds an active mobile session to its socket and disconnects it on revocation"],
    ],
  },
  {
    id: "expired_or_revoked_bridge_credential",
    evidence: [
      ["backend/src/modules/bridge/bridge.service.spec.ts", "revokes a bridge device and disconnects its established socket"],
      ["backend/src/gateways/events.gateway.spec.ts", "disconnects only the established socket for a revoked bridge device"],
      ["backend/src/modules/bridge/bridge.service.spec.ts", "rejects revoked bridge devices on reconnect"],
      ["backend/src/modules/bridge/bridge.service.spec.ts", "rejects access tokens from a previous credential generation"],
      ["backend/src/modules/bridge/bridge.service.spec.ts", "rejects bridge access tokens expired beyond the configured grace window"],
    ],
  },
  {
    id: "runtime_incompatible_or_offline",
    evidence: [
      ["backend/src/modules/bridge/bridge-compatibility-policy.spec.ts", "rejects an incompatible tuple"],
      ["backend/src/modules/bridge/bridge.service.spec.ts", "reports offline when setup exists but no bridge runtime is online"],
      ["backend/src/modules/runtime/runtime-dispatch-reconciler.service.spec.ts", "fails expired pending dispatches through the coordinator"],
    ],
  },
  {
    id: "oauth_failure_and_recovery",
    evidence: [
      ["backend/src/modules/marketplace/connectors/connector-standard.spec.ts", "rejects mismatched, consumed, and expired OAuth state before token exchange"],
      ["backend/src/modules/marketplace/connectors/connector-standard.spec.ts", "destroys denied OAuth state and audits no provider secrets"],
      ["backend/src/modules/marketplace/connector-oauth-callback.controller.spec.ts", "never reflects the provider description"],
      ["backend/src/modules/marketplace/x-marketplace.service.spec.ts", "marks a failed refresh with a sanitized reconnect state"],
      ["backend/src/modules/marketplace/bluesky/bluesky-oauth.service.spec.ts", "provider revocation is unavailable"],
    ],
  },
  {
    id: "duplicate_or_delayed_billing_event",
    evidence: [
      ["backend/src/modules/cloud-commercial/stripe-billing.service.spec.ts", "deduplicates events"],
      ["backend/src/modules/cloud-commercial/apple-billing.service.spec.ts", "ignores a delayed notification older than the applied provider state"],
    ],
  },
  {
    id: "client_below_minimum_contract",
    evidence: [
      ["backend/src/modules/cloud-commercial/cloud-commercial.service.spec.ts", "blocks unsafe writes for incompatible clients"],
    ],
  },
  {
    id: "backend_rollback_and_database_restore",
    evidence: [
      ["backend/src/scripts/cloud-backup-restore-safety.spec.ts", "requires a second explicit replacement confirmation for a production target"],
      ["backend/src/scripts/cloud-backup-restore-safety.spec.ts", "keeps the restore transactional"],
      ["backend/src/modules/security/beta-support-runbook-regression.spec.ts", "marketplace removal containment and rollback"],
    ],
  },
];

export function verifyFailureRecoveryEvidence({
  root = DEFAULT_ROOT,
  read = (path) => readFileSync(path, "utf8"),
} = {}) {
  const errors = [];
  const files = new Set();
  for (const journey of FAILURE_RECOVERY_JOURNEYS) {
    if (!journey.evidence.length) errors.push(`${journey.id} has no evidence`);
    for (const [relativePath, marker] of journey.evidence) {
      files.add(relativePath);
      let source = "";
      try {
        source = read(resolve(root, relativePath));
      } catch {
        errors.push(`${journey.id} evidence file is missing: ${relativePath}`);
        continue;
      }
      if (!source.includes(marker)) {
        errors.push(`${journey.id} evidence marker is missing from ${relativePath}: ${marker}`);
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    journeyCount: FAILURE_RECOVERY_JOURNEYS.length,
    files: [...files].sort(),
  };
}

function main() {
  const run = process.argv.slice(2).includes("--run");
  const result = verifyFailureRecoveryEvidence();
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
  if (!result.valid) {
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${JSON.stringify({
    schemaVersion: "relay.failure-recovery-gate.v1",
    journeyCount: result.journeyCount,
    testFileCount: result.files.length,
    execution: run ? "requested" : "not_requested",
  })}\n`);
  if (!run) return;
  const backendFiles = result.files.map((path) => path.replace(/^backend\//, ""));
  execFileSync(
    "pnpm",
    ["--dir", "backend", "exec", "jest", "--runInBand", "--runTestsByPath", ...backendFiles],
    { cwd: DEFAULT_ROOT, stdio: "inherit" },
  );
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) main();
