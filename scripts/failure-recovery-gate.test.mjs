import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAILURE_RECOVERY_JOURNEYS,
  verifyFailureRecoveryEvidence,
} from "./failure-recovery-gate.mjs";

test("maps every required failure/recovery checklist journey", () => {
  assert.deepEqual(
    FAILURE_RECOVERY_JOURNEYS.map(({ id }) => id),
    [
      "railway_unavailable",
      "redis_or_queue_unavailable",
      "database_migration_failure",
      "expired_or_revoked_human_session",
      "expired_or_revoked_bridge_credential",
      "runtime_incompatible_or_offline",
      "oauth_failure_and_recovery",
      "duplicate_or_delayed_billing_event",
      "client_below_minimum_contract",
      "backend_rollback_and_database_restore",
    ],
  );
});

test("finds every named test marker in the release worktree", () => {
  const result = verifyFailureRecoveryEvidence();
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(result.journeyCount, 10);
  assert.ok(result.files.length >= 10);
});

test("fails closed when mapped evidence disappears", () => {
  const result = verifyFailureRecoveryEvidence({
    read: () => "unrelated test source",
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /evidence marker is missing/);
});
