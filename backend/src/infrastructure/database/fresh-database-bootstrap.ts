import * as fs from "fs";
import * as path from "path";
import { DataSource, MigrationInterface } from "typeorm";

const BOOTSTRAP_STATE_TABLE = "relay_fresh_migration_bootstrap";
const INSTALLATION_LIFECYCLE_TABLE = "relay_installation_secret_lifecycle";
const BOOTSTRAP_VERSION = 1;

export interface FreshDatabaseState {
  hasBootstrapMarker: boolean;
  hasMigrationsTable: boolean;
  migrationCount: number;
  applicationTableCount: number;
}

interface OrderedMigration {
  fileName: string;
  name: string;
  timestamp: string;
  instance: MigrationInterface;
}

function parseBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function parseCount(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function compareMigrationFileNames(left: string, right: string) {
  const leftPrefix = Number(left.split("_", 1)[0]);
  const rightPrefix = Number(right.split("_", 1)[0]);
  if (leftPrefix !== rightPrefix) return leftPrefix - rightPrefix;
  return left.localeCompare(right);
}

export function shouldRunFreshDatabaseBootstrap(state: FreshDatabaseState) {
  if (state.hasBootstrapMarker) return true;
  if (state.applicationTableCount > 0 || state.migrationCount > 0) return false;
  return !state.hasMigrationsTable || state.migrationCount === 0;
}

export function listOrderedMigrationFileNames(
  migrationDirectory = path.join(__dirname, "../../migrations"),
) {
  const runtimeExtension = path.extname(__filename) === ".ts" ? ".ts" : ".js";
  return fs
    .readdirSync(migrationDirectory)
    .filter((fileName) => /^\d{3}_.+\.(ts|js)$/.test(fileName))
    .filter((fileName) => path.extname(fileName) === runtimeExtension)
    .sort(compareMigrationFileNames);
}

function loadOrderedMigrations(): OrderedMigration[] {
  const migrationDirectory = path.join(__dirname, "../../migrations");
  const migrations = listOrderedMigrationFileNames(migrationDirectory).map(
    (fileName): OrderedMigration => {
      // Runtime-selected .ts/.js modules are internal migration files, not user input.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const moduleExports = require(path.join(migrationDirectory, fileName));
      const migrationClasses = Object.values(moduleExports).filter(
        (value): value is new () => MigrationInterface =>
          typeof value === "function" &&
          typeof (value as { prototype?: { up?: unknown } }).prototype?.up ===
            "function",
      );
      if (migrationClasses.length !== 1) {
        throw new Error(`Expected exactly one migration class in ${fileName}.`);
      }

      const instance = new migrationClasses[0]();
      const name = instance.name || migrationClasses[0].name;
      const timestampMatch = name.match(/(\d{13})$/);
      if (!timestampMatch) {
        throw new Error(`Migration ${name} has no 13-digit timestamp.`);
      }
      return { fileName, name, timestamp: timestampMatch[1], instance };
    },
  );

  const duplicateNames = migrations
    .map(({ name }) => name)
    .filter((name, index, names) => names.indexOf(name) !== index);
  if (duplicateNames.length) {
    throw new Error(
      `Fresh database bootstrap found duplicate migration names: ${[...new Set(duplicateNames)].join(", ")}.`,
    );
  }
  return migrations;
}

async function inspectFreshDatabaseState(
  dataSource: DataSource,
): Promise<FreshDatabaseState> {
  const [row] = (await dataSource.query(`
    SELECT
      to_regclass('public.${BOOTSTRAP_STATE_TABLE}') IS NOT NULL AS "hasBootstrapMarker",
      to_regclass('public.migrations') IS NOT NULL AS "hasMigrationsTable",
      (
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name NOT IN (
            'migrations',
            '${BOOTSTRAP_STATE_TABLE}',
            '${INSTALLATION_LIFECYCLE_TABLE}'
          )
      ) AS "applicationTableCount"
  `)) as Array<Record<string, unknown>>;

  let migrationCount = 0;
  if (parseBoolean(row?.hasMigrationsTable)) {
    const [countRow] = (await dataSource.query(
      `SELECT COUNT(*) AS count FROM migrations`,
    )) as Array<Record<string, unknown>>;
    migrationCount = parseCount(countRow?.count);
  }

  return {
    hasBootstrapMarker: parseBoolean(row?.hasBootstrapMarker),
    hasMigrationsTable: parseBoolean(row?.hasMigrationsTable),
    migrationCount,
    applicationTableCount: parseCount(row?.applicationTableCount),
  };
}

async function ensureBootstrapTables(dataSource: DataSource) {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      timestamp bigint NOT NULL,
      name varchar NOT NULL
    )
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS ${BOOTSTRAP_STATE_TABLE} (
      id smallint PRIMARY KEY CHECK (id = 1),
      version integer NOT NULL,
      "startedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await dataSource.query(
    `
      INSERT INTO ${BOOTSTRAP_STATE_TABLE} (id, version)
      VALUES (1, $1)
      ON CONFLICT (id) DO NOTHING
    `,
    [BOOTSTRAP_VERSION],
  );
  const [marker] = (await dataSource.query(
    `SELECT version FROM ${BOOTSTRAP_STATE_TABLE} WHERE id = 1`,
  )) as Array<{ version?: unknown }>;
  if (Number(marker?.version) !== BOOTSTRAP_VERSION) {
    throw new Error(
      `Unsupported fresh database bootstrap version ${String(marker?.version)}.`,
    );
  }
}

export async function bootstrapFreshDatabase(dataSource: DataSource) {
  const state = await inspectFreshDatabaseState(dataSource);
  if (!shouldRunFreshDatabaseBootstrap(state)) return [];

  await ensureBootstrapTables(dataSource);
  const orderedMigrations = loadOrderedMigrations();
  const appliedRows = (await dataSource.query(
    `SELECT name FROM migrations ORDER BY id ASC`,
  )) as Array<{ name: string }>;
  const appliedNames = new Set(appliedRows.map(({ name }) => name));
  const knownNames = new Set(orderedMigrations.map(({ name }) => name));
  const unexpectedNames = [...appliedNames].filter(
    (name) => !knownNames.has(name),
  );
  if (unexpectedNames.length) {
    throw new Error(
      `Fresh database bootstrap found unknown migration records: ${unexpectedNames.join(", ")}.`,
    );
  }

  const executed: string[] = [];
  for (const migration of orderedMigrations) {
    if (appliedNames.has(migration.name)) continue;

    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await migration.instance.up(runner);
      await runner.query(
        `INSERT INTO migrations (timestamp, name) VALUES ($1, $2)`,
        [migration.timestamp, migration.name],
      );
      await runner.commitTransaction();
      executed.push(migration.name);
      console.log(`Fresh database bootstrap applied ${migration.fileName}`);
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  await dataSource.query(`DROP TABLE ${BOOTSTRAP_STATE_TABLE}`);
  return executed;
}
