import { QueryRunner } from "typeorm";
import { shouldAssertProductionEnvironment } from "../../config/production-env";

export const HISTORICAL_DESTRUCTIVE_MIGRATION_TABLES = [
  "manager_relationships",
  "budget_usage",
  "coaching_notes",
  "reviews",
  "performance_metrics",
  "handover_notes",
  "availability_states",
  "shift_rules",
  "schedules",
  "work_logs",
  "alerts",
  "run_events",
  "runs",
  "tasks",
  "approvals",
  "incidents",
  "thread_read_states",
  "messages",
  "threads",
  "team_memory_items",
  "bridge_events",
  "report_snapshots",
  "agents",
  "teams",
  "departments",
  "companies",
] as const;

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function parseCount(rows: unknown) {
  const [row] = Array.isArray(rows) ? rows : [];
  if (!row || typeof row !== "object") return 0;

  const record = row as Record<string, unknown>;
  const rawCount = record.count ?? record.COUNT ?? Object.values(record)[0];
  const count =
    typeof rawCount === "bigint" ? Number(rawCount) : Number(rawCount ?? 0);

  return Number.isFinite(count) && count > 0 ? count : 0;
}

export async function assertHistoricalDestructiveMigrationSafe(
  queryRunner: QueryRunner,
  migrationName: string,
  tableNames: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!shouldAssertProductionEnvironment(env)) {
    return;
  }

  const nonEmptyTables: Array<{ tableName: string; rowCount: number }> = [];

  for (const tableName of tableNames) {
    const tableExists = await queryRunner.hasTable(tableName);
    if (!tableExists) continue;

    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`,
    );
    const rowCount = parseCount(rows);
    if (rowCount > 0) {
      nonEmptyTables.push({ tableName, rowCount });
    }
  }

  if (!nonEmptyTables.length) {
    return;
  }

  const tableSummary = nonEmptyTables
    .map(({ tableName, rowCount }) => `${tableName}=${rowCount}`)
    .join(", ");

  throw new Error(
    `Historical destructive migration ${migrationName} is pending in a production-like environment and would touch non-empty tables: ${tableSummary}. Verify Railway migration history and baseline the migration before launch; see backend/src/migrations/README.md.`,
  );
}
