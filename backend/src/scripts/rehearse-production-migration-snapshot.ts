import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { existsSync } from "fs";
import * as os from "os";
import * as path from "path";
import { Client } from "pg";
import { DataSource } from "typeorm";
import { buildVerifiedDatabaseTlsOptions } from "../infrastructure/database/production-database-tls";

const EXPECTED_PENDING = [
  "AddManagedRuntimeMetering1721750400063",
  "MinimizeAuthAuditData1785187000073",
  "QuarantineUnsafeArtifactUrls1785187000074",
  "InvalidateLegacyJwtSessions1785270000075",
];
const localHost = process.env.MIGRATION_REHEARSAL_HOST || "/tmp";
const localPort = Number(process.env.MIGRATION_REHEARSAL_PORT || "5432");
const localUser = process.env.MIGRATION_REHEARSAL_USER || os.userInfo().username;
const localPassword = process.env.MIGRATION_REHEARSAL_PASSWORD;
const localAdminDatabase =
  process.env.MIGRATION_REHEARSAL_ADMIN_DATABASE || "postgres";
const databaseName = `relay_production_schema_rehearsal_${process.pid}_${Date.now()}`;
const productionURL =
  process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
let currentStage = "startup";

function assertBoundaries() {
  if (!productionURL) {
    throw new Error(
      "PRODUCTION_DATABASE_URL or DATABASE_PUBLIC_URL is required.",
    );
  }
  const production = new URL(productionURL);
  if (
    ["localhost", "127.0.0.1", "::1"].includes(production.hostname) ||
    production.hostname.endsWith(".railway.internal")
  ) {
    throw new Error(
      "The production snapshot source must use Railway's public read-only connection path.",
    );
  }
  if (!["/tmp", "localhost", "127.0.0.1", "::1"].includes(localHost)) {
    throw new Error(
      "The rehearsal destination must be an isolated local PostgreSQL server.",
    );
  }
  if (!Number.isInteger(localPort) || localPort < 1 || localPort > 65535) {
    throw new Error("MIGRATION_REHEARSAL_PORT must be a valid PostgreSQL port.");
  }
}

function localConfig(database: string) {
  return {
    host: localHost,
    port: localPort,
    user: localUser,
    password: localPassword,
    database,
  };
}

function pgDumpExecutable() {
  const candidates = [
    "/opt/homebrew/opt/postgresql@18/bin/pg_dump",
    "/usr/local/opt/postgresql@18/bin/pg_dump",
    "pg_dump",
  ];
  return candidates.find((candidate) =>
    candidate === "pg_dump" || existsSync(candidate),
  ) as string;
}

function restoreProductionSchema() {
  let schema: Buffer;
  try {
    schema = execFileSync(
      pgDumpExecutable(),
      [
        productionURL as string,
        "--schema-only",
        "--no-owner",
        "--no-privileges",
        "--no-comments",
      ],
      { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
    );
    // PostgreSQL 18 emits this session setting, while the isolated local
    // PostgreSQL 14 rehearsal server does not recognize it. It does not affect
    // schema semantics.
    schema = Buffer.from(
      schema
        .toString("utf8")
        .replace(/^SET transaction_timeout = 0;\r?\n/m, ""),
      "utf8",
    );
  } catch {
    throw new Error(
      "PostgreSQL schema export failed; no production data was copied.",
    );
  }
  try {
    execFileSync(
      "psql",
      [
        "--host",
        localHost,
        "--port",
        String(localPort),
        "--username",
        localUser,
        "--dbname",
        databaseName,
        "--set",
        "ON_ERROR_STOP=1",
      ],
      {
        input: schema,
        env: {
          ...process.env,
          ...(localPassword ? { PGPASSWORD: localPassword } : {}),
        },
        stdio: ["pipe", "ignore", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } catch (error) {
    const detail =
      error &&
      typeof error === "object" &&
      "stderr" in error &&
      Buffer.isBuffer(error.stderr)
        ? error.stderr.toString("utf8").trim().slice(-1_000)
        : "psql returned a non-zero status";
    throw new Error(
      `The production schema could not be restored locally: ${detail}`,
    );
  }
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function schemaFingerprint(client: {
  query: (sql: string) => Promise<
    | Array<Record<string, unknown>>
    | { rowCount: number | null; rows: Array<Record<string, unknown>> }
  >;
}) {
  const resultRows = (
    result:
      | Array<Record<string, unknown>>
      | { rowCount: number | null; rows: Array<Record<string, unknown>> },
  ) => (Array.isArray(result) ? result : result.rows);
  const columns = resultRows(await client.query(`
      SELECT table_name, column_name, data_type, is_nullable,
             COALESCE(column_default, '') AS column_default
      FROM information_schema.columns
      WHERE table_schema='public'
      ORDER BY table_name, ordinal_position
    `));
  const constraints = resultRows(await client.query(`
      SELECT conname, contype
      FROM pg_constraint
      JOIN pg_namespace ON pg_namespace.oid=connamespace
      WHERE pg_namespace.nspname='public'
        AND contype <> 'n'
      ORDER BY conname
    `));
  const indexes = resultRows(await client.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname='public'
      ORDER BY tablename, indexname
    `));
  return {
    columnCount: columns.length,
    columnsSHA256: stableHash(columns),
    constraintCount: constraints.length,
    constraintsSHA256: stableHash(constraints),
    indexCount: indexes.length,
    indexesSHA256: stableHash(indexes),
  };
}

async function main() {
  assertBoundaries();
  const production = new Client({
    connectionString: productionURL,
    ssl: buildVerifiedDatabaseTlsOptions(process.env),
  });
  const admin = new Client(localConfig(localAdminDatabase));
  let local: Client | null = null;
  let source: DataSource | null = null;

  await Promise.all([production.connect(), admin.connect()]);
  try {
    currentStage = "read-production-schema";
    const productionMigrations = await production.query(
      `SELECT id, timestamp::text, name FROM migrations ORDER BY timestamp, name`,
    );
    const productionFingerprint = await schemaFingerprint(production);

    await admin.query(`CREATE DATABASE "${databaseName}"`);
    currentStage = "restore-production-schema";
    restoreProductionSchema();
    local = new Client(localConfig(databaseName));
    await local.connect();

    currentStage = "restore-production-migration-ledger";
    await local.query("TRUNCATE TABLE migrations");
    for (const migration of productionMigrations.rows) {
      await local.query(
        `INSERT INTO migrations (id, timestamp, name) VALUES ($1, $2, $3)`,
        [migration.id, migration.timestamp, migration.name],
      );
    }
    await local.query(`
      SELECT setval(
        pg_get_serial_sequence('migrations', 'id'),
        (SELECT MAX(id) FROM migrations),
        true
      )
    `);
    const restoredFingerprint = await schemaFingerprint(local);
    if (
      JSON.stringify(restoredFingerprint) !==
      JSON.stringify(productionFingerprint)
    ) {
      throw new Error(
        `The isolated schema fingerprint differs from the current production schema: production=${JSON.stringify(
          productionFingerprint,
        )} restored=${JSON.stringify(restoredFingerprint)}`,
      );
    }

    await local.end();
    local = null;
    currentStage = "initialize-migration-runner";
    source = new DataSource({
      type: "postgres",
      host: localHost,
      port: localPort,
      username: localUser,
      password: localPassword,
      database: databaseName,
      migrations: [path.join(__dirname, "../migrations/*{.ts,.js}")],
      migrationsTableName: "migrations",
      synchronize: false,
      logging: false,
      ssl: false,
    });
    await source.initialize();
    currentStage = "apply-pending-migrations";
    const applied = await source.runMigrations({ transaction: "each" });
    const appliedNames = applied.map((migration) => migration.name);
    if (JSON.stringify(appliedNames) !== JSON.stringify(EXPECTED_PENDING)) {
      throw new Error(
        `Expected only ${EXPECTED_PENDING.join(", ")}, got ${appliedNames.join(", ") || "none"}.`,
      );
    }

    const metering = await source.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE column_name IN ('runtimeMinutesUsed', 'lastMeteredAt')
        )::int AS "meteringColumns",
        (
          SELECT COUNT(*)::int
          FROM pg_constraint
          WHERE conname IN (
            'CHK_managed_runtime_minutes_nonnegative',
            'CHK_managed_runtime_storage_nonnegative'
          )
        ) AS "meteringConstraints"
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='managed_runtimes'
    `);
    if (
      metering.length !== 1 ||
      metering[0].meteringColumns !== 2 ||
      metering[0].meteringConstraints !== 2
    ) {
      throw new Error(
        "The production-snapshot migration did not create the expected metering schema.",
      );
    }

    currentStage = "rollback-latest-migration";
    await source.undoLastMigration({ transaction: "each" });
    currentStage = "reapply-latest-migration";
    const reapplied = await source.runMigrations({ transaction: "each" });
    currentStage = "verify-idempotent-startup";
    const idempotent = await source.runMigrations({ transaction: "each" });
    if (
      reapplied.length !== 1 ||
      reapplied[0].name !== EXPECTED_PENDING[EXPECTED_PENDING.length - 1] ||
      idempotent.length !== 0
    ) {
      throw new Error(
        "Rollback, reapply, or idempotent startup verification failed.",
      );
    }
    const finalFingerprint = await schemaFingerprint(source);
    const migrationCount = await source.query(
      `SELECT COUNT(*)::int AS count FROM migrations`,
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          snapshot: "current-production-schema-and-migration-ledger",
          customerRowsCopied: false,
          productionMigrationCount: productionMigrations.rowCount,
          productionFingerprint,
          appliedMigrations: appliedNames,
          rollbackReapplied: reapplied[0].name,
          idempotentStartupMigrationCount: idempotent.length,
          finalMigrationCount: migrationCount[0].count,
          finalFingerprint,
        },
        null,
        2,
      ),
    );
  } finally {
    if (source?.isInitialized) await source.destroy();
    if (local) await local.end();
    await production.end();
    await admin.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname=$1 AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.end();
  }
}

main().catch((error) => {
  console.error(
    `Production schema migration rehearsal failed at ${currentStage}:`,
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
