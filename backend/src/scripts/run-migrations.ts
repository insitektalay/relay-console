import dataSource from "../infrastructure/database/data-source";
import { assertProductionEnvironment } from "../config/production-env";
import { bootstrapFreshDatabase } from "../infrastructure/database/fresh-database-bootstrap";
import {
  migrationStartupErrorSummary,
  runWithMigrationStartupRetry,
} from "./migration-startup-retry";

const STORAGE_COMPACTION_TABLES = [
  "agents",
  "threads",
  "runtime_dispatches",
  "audit_logs",
  "relay_workspace_changes",
  "relay_sync_objects",
  "managed_agent_documents",
  "marketplace_generated_packs",
] as const;

async function runRequestedStorageMaintenance() {
  const [requestTable] = await dataSource.query(
    `SELECT to_regclass('public.relay_storage_maintenance_requests') AS relation`,
  );
  if (!requestTable?.relation) return;
  const [request] = await dataSource.query(
    `SELECT id
     FROM relay_storage_maintenance_requests
     WHERE id = 'bound-operational-storage-v1'
       AND "completedAt" IS NULL`,
  );
  if (!request) return;

  console.log("Compacting bounded operational storage");
  for (const table of STORAGE_COMPACTION_TABLES) {
    await dataSource.query(`VACUUM (FULL, ANALYZE) "${table}"`);
  }
  await dataSource.query(
    `UPDATE relay_storage_maintenance_requests
     SET "completedAt" = now()
     WHERE id = 'bound-operational-storage-v1'`,
  );
  console.log("Operational storage compaction completed");
}

async function runMigrations() {
  assertProductionEnvironment();

  await runWithMigrationStartupRetry(
    async () => {
      await dataSource.initialize();

      try {
        const bootstrapped = await bootstrapFreshDatabase(dataSource);
        if (bootstrapped.length > 0) {
          console.log(
            `Fresh database bootstrap ran ${bootstrapped.length} migration${bootstrapped.length === 1 ? "" : "s"} in filename order`,
          );
        }
        const migrations = await dataSource.runMigrations();
        if (migrations.length === 0) {
          console.log("No migrations are pending");
        } else {
          console.log(
            `Ran ${migrations.length} migration${migrations.length === 1 ? "" : "s"}`,
          );
        }

        await runRequestedStorageMaintenance();
      } finally {
        if (dataSource.isInitialized) {
          await dataSource.destroy();
        }
      }
    },
    {
      onRetry: ({ attempt, nextAttempt, delayMs, error }) => {
        console.warn(
          `Database is temporarily unavailable during migration startup (attempt ${attempt}); retrying attempt ${nextAttempt} in ${delayMs}ms: ${migrationStartupErrorSummary(error)}`,
        );
      },
    },
  );
}

runMigrations().catch((error) => {
  console.error("Migration startup failed", error);
  process.exit(1);
});
