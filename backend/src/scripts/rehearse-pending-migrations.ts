import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { DataSource, DataSourceOptions } from "typeorm";

const PENDING_MIGRATIONS = new Set([
  "AddStripeBilling0520000000000",
  "AddAccountEmailLifecycle0530000000000",
  "AddBridgeDeviceLifecycle0540000000000",
  "BackfillPrelaunchCloudGrace0550000000000",
  "AddBillingProviderStateOrder0560000000000",
  "AddAgentRuntimeReplicas0570000000000",
  "RepairCanonicalAgentRuntimeIdentity0580000000000",
  "ResolveHermesRuntimeCollisions0590000000000",
  "AddRuntimeAuthorityFoundation0600000000000",
  "AddManagedAgentDocuments0610000000000",
  "AddManagedRuntimesAndMigrations0620000000000",
  "AddManagedRuntimeMetering1721750400063",
  "AddBridgeRuntimeModelCatalog1721836800064",
  "AddNativeAgentConnection1722009600065",
  "AddConnectorApprovalContextUniqueness1785173400066",
  "RetireCurrentBackendMarketplaceSources1785179000067",
  "RemoveHermesHostPathAuthority1785182600068",
  "AddVerifiedEmailChangeWorkflow1785182600069",
  "AddBridgeCredentialReplayState1785185000070",
  "AddBillingEventClaimLease1785186000071",
  "StreamRelayAttachmentContent1785187000072",
]);

const host = process.env.MIGRATION_REHEARSAL_HOST || "/tmp";
const port = Number(process.env.MIGRATION_REHEARSAL_PORT || "5432");
const username = process.env.MIGRATION_REHEARSAL_USER || os.userInfo().username;
const password = process.env.MIGRATION_REHEARSAL_PASSWORD;
const adminDatabase =
  process.env.MIGRATION_REHEARSAL_ADMIN_DATABASE || "postgres";
const databaseName = `relay_migration_rehearsal_${process.pid}_${Date.now()}`;

function assertIsolatedHost() {
  const allowed = new Set(["/tmp", "localhost", "127.0.0.1", "::1"]);
  if (!allowed.has(host)) {
    throw new Error(
      "Migration rehearsal refuses a remote PostgreSQL host. Restore a production-like snapshot into an isolated local PostgreSQL instance first.",
    );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      "MIGRATION_REHEARSAL_PORT must be a valid PostgreSQL port.",
    );
  }
}

function options(
  database: string,
  migrations: string[] = [],
): DataSourceOptions {
  return {
    type: "postgres",
    host,
    port,
    username,
    password,
    database,
    migrations,
    migrationsTableName: "migrations",
    synchronize: false,
    logging: false,
    ssl: false,
  };
}

async function expectDatabaseError(
  source: DataSource,
  sql: string,
  expectedCode: "23505" | "23514",
) {
  try {
    await source.query(sql);
  } catch (error) {
    if ((error as { code?: string }).code === expectedCode) return;
    throw error;
  }
  throw new Error(
    `Expected PostgreSQL error ${expectedCode}, but the statement succeeded.`,
  );
}

async function seedProductionLikeRows(source: DataSource) {
  await source.query(`
    INSERT INTO users (id, email, name, "passwordHash", "createdAt", "updatedAt") VALUES
      ('00000000-0000-4000-8000-000000000001', 'existing-one@example.test', 'Existing One', 'not-a-real-password-hash', '2026-01-02T03:04:05Z', '2026-01-02T03:04:05Z'),
      ('00000000-0000-4000-8000-000000000002', 'existing-two@example.test', 'Existing Two', 'not-a-real-password-hash', '2026-02-03T04:05:06Z', '2026-02-03T04:05:06Z'),
      ('00000000-0000-4000-8000-000000000003', 'existing-three@example.test', 'Existing Three', 'not-a-real-password-hash', '2026-03-04T05:06:07Z', '2026-03-04T05:06:07Z');

    INSERT INTO workspaces (id, name, type, "ownerId", "createdAt", "updatedAt") VALUES
      ('10000000-0000-4000-8000-000000000001', 'Existing Workspace One', 'personal', '00000000-0000-4000-8000-000000000001', '2026-01-02T03:04:05Z', '2026-01-02T03:04:05Z'),
      ('10000000-0000-4000-8000-000000000002', 'Existing Workspace Two', 'personal', '00000000-0000-4000-8000-000000000002', '2026-02-03T04:05:06Z', '2026-02-03T04:05:06Z'),
      ('10000000-0000-4000-8000-000000000003', 'Existing Workspace Three', 'personal', '00000000-0000-4000-8000-000000000003', '2026-03-04T05:06:07Z', '2026-03-04T05:06:07Z');

    INSERT INTO relay_commercial_subscriptions (
      id, "workspaceId", plan, status, "providerCustomerId", "providerSubscriptionId",
      limits, features, "createdAt", "updatedAt"
    ) VALUES
      ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'relay_cloud_monthly', 'active', 'cus_existing_1', 'sub_existing_1', '{"storageBytes":1073741824}', '{"cloudControlPlane":true}', '2026-03-04T05:06:07Z', '2026-03-04T05:06:07Z'),
      ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'relay_cloud_monthly', 'grace', 'cus_existing_2', 'sub_existing_2', '{"storageBytes":1073741824}', '{"cloudControlPlane":true}', '2026-04-05T06:07:08Z', '2026-04-05T06:07:08Z');

    INSERT INTO bridge_devices (
      id, "workspaceId", "createdByUserId", label, "devicePublicId",
      "credentialHash", status, capabilities, "openCoreVersion",
      "pluginVersion", "lastSeenAt", "revokedAt", "createdAt", "updatedAt"
    ) VALUES (
      '30000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      'Existing bridge', 'bdev_existing', repeat('f', 64), 'active', '[]',
      'legacy-runtime', 'legacy-plugin', '2026-05-06T07:08:09Z', NULL,
      '2026-05-06T07:08:09Z', '2026-05-06T07:08:09Z'
    );

    INSERT INTO relay_sync_attachments (
      id, "workspaceId", "attachmentId", "sourceInstallationId",
      "sourceAttachmentId", "fileName", "contentType", "byteSize", sha256,
      status, availability, "storageKey", content, provenance
    ) VALUES (
      '70000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'att_legacy_migration', 'installation-legacy', 'source-legacy',
      'legacy.txt', 'text/plain',
      octet_length(convert_to('legacy attachment bytes', 'UTF8')),
      encode(digest('legacy attachment bytes', 'sha256'), 'hex'),
      'available', 'cloud', 'postgres:legacy',
      convert_to('legacy attachment bytes', 'UTF8'),
      '{"fixture":"pending-migration"}'
    );
  `);
}

async function applyHistoricalBaseline(source: DataSource) {
  await source.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      timestamp bigint NOT NULL,
      name varchar NOT NULL
    )
  `);

  const migrationDirectory = path.join(__dirname, "../migrations");
  const files = fs
    .readdirSync(migrationDirectory)
    .filter((file) => /^\d{3}_.+\.(ts|js)$/.test(file))
    .filter(
      (file) =>
        !file.startsWith("052_") &&
        !file.startsWith("053_") &&
        !file.startsWith("054_") &&
        !file.startsWith("055_") &&
        !file.startsWith("056_") &&
        !file.startsWith("057_") &&
        !file.startsWith("058_") &&
        !file.startsWith("059_") &&
        !file.startsWith("060_") &&
        !file.startsWith("061_") &&
        !file.startsWith("062_") &&
        !file.startsWith("063_") &&
        !file.startsWith("064_") &&
        !file.startsWith("065_") &&
        !file.startsWith("066_") &&
        !file.startsWith("067_") &&
        !file.startsWith("068_") &&
        !file.startsWith("069_") &&
        !file.startsWith("070_") &&
        !file.startsWith("071_") &&
        !file.startsWith("072_"),
    )
    .sort((left, right) => left.localeCompare(right));
  const applied: string[] = [];

  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const moduleExports = require(path.join(migrationDirectory, file));
    const migrationClasses = Object.values(moduleExports).filter(
      (
        value,
      ): value is new () => {
        name: string;
        up: (runner: any) => Promise<void>;
      } =>
        typeof value === "function" &&
        typeof (value as any).prototype?.up === "function",
    );
    if (migrationClasses.length !== 1) {
      throw new Error(`Expected exactly one migration class in ${file}.`);
    }
    const migration = new migrationClasses[0]();
    if (PENDING_MIGRATIONS.has(migration.name)) {
      throw new Error(
        `Pending migration ${migration.name} leaked into the historical baseline.`,
      );
    }
    const timestampMatch = migration.name.match(/(\d{13})$/);
    if (!timestampMatch)
      throw new Error(`Migration ${migration.name} has no 13-digit timestamp.`);

    const runner = source.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await migration.up(runner);
      await runner.query(
        `INSERT INTO migrations (timestamp, name) VALUES ($1, $2)`,
        [timestampMatch[1], migration.name],
      );
      await runner.commitTransaction();
      applied.push(migration.name);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  return applied;
}

async function verifyPendingMigrationResult(source: DataSource) {
  const users = await source.query(`
    SELECT id, email, "createdAt", "emailVerifiedAt"
    FROM users
    WHERE id IN (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003'
    )
    ORDER BY id ASC
  `);
  if (users.length !== 3 || users.some((user) => !user.emailVerifiedAt)) {
    throw new Error(
      "Existing users were not preserved and backfilled as verified.",
    );
  }
  for (const user of users) {
    if (
      new Date(user.createdAt).getTime() !==
      new Date(user.emailVerifiedAt).getTime()
    ) {
      throw new Error(
        `Existing user ${user.id} did not retain createdAt as emailVerifiedAt.`,
      );
    }
  }

  const subscriptions = await source.query(`
    SELECT id, "workspaceId", plan, status, provider, "providerCustomerId",
           "providerSubscriptionId", "currentPeriodEndsAt", "providerStateAt",
           "cancelAtPeriodEnd", limits, features
    FROM relay_commercial_subscriptions
    WHERE id IN ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')
    ORDER BY id ASC
  `);
  if (subscriptions.length !== 2)
    throw new Error("Existing subscription rows were lost.");
  if (
    subscriptions.some(
      (row) => row.provider !== "stripe" || row.cancelAtPeriodEnd !== false,
    )
  ) {
    throw new Error(
      "Existing subscriptions did not receive safe Stripe defaults.",
    );
  }
  if (subscriptions.some((row) => row.providerStateAt !== null)) {
    throw new Error(
      "Existing subscriptions received an invented provider-state timestamp.",
    );
  }
  if (
    subscriptions[0].providerCustomerId !== "cus_existing_1" ||
    subscriptions[1].status !== "grace"
  ) {
    throw new Error(
      "Existing subscription identity or lifecycle state changed.",
    );
  }
  await source.query(`
    UPDATE relay_commercial_subscriptions
    SET "providerStateAt" = '2026-07-14T22:00:00Z'
    WHERE id = '20000000-0000-4000-8000-000000000001'
  `);
  const providerState = await source.query(`
    SELECT "providerStateAt"
    FROM relay_commercial_subscriptions
    WHERE id = '20000000-0000-4000-8000-000000000001'
  `);
  if (
    providerState.length !== 1 ||
    new Date(providerState[0].providerStateAt).toISOString() !==
      "2026-07-14T22:00:00.000Z"
  ) {
    throw new Error("Provider event ordering timestamp did not persist.");
  }

  const migrationGrace = await source.query(`
    SELECT "workspaceId", plan, status, provider, "providerCustomerId",
           "providerSubscriptionId", "graceEndsAt", "readOnlyAt"
    FROM relay_commercial_subscriptions
    WHERE "workspaceId" = '10000000-0000-4000-8000-000000000003'
  `);
  if (
    migrationGrace.length !== 1 ||
    migrationGrace[0].plan !== "relay_cloud_migration_grace" ||
    migrationGrace[0].status !== "grace" ||
    migrationGrace[0].provider !== "relay_migration" ||
    migrationGrace[0].providerCustomerId !== null ||
    migrationGrace[0].providerSubscriptionId !== null
  ) {
    throw new Error(
      "A missing pre-launch entitlement did not receive only migration grace.",
    );
  }
  const graceEndsAt = new Date(migrationGrace[0].graceEndsAt).getTime();
  const readOnlyAt = new Date(migrationGrace[0].readOnlyAt).getTime();
  const remainingGraceMs = graceEndsAt - Date.now();
  if (
    !Number.isFinite(graceEndsAt) ||
    graceEndsAt !== readOnlyAt ||
    remainingGraceMs <= 0 ||
    remainingGraceMs > 7 * 86_400_000
  ) {
    throw new Error(
      "Migration grace is not bounded to the seven-day read-only deadline.",
    );
  }

  const bridgeDevices = await source.query(`
    SELECT id, label, "runtimeType", "hostType", "credentialVersion",
           "credentialRotatedAt", "lastSeenAt"
    FROM bridge_devices
    WHERE id = '30000000-0000-4000-8000-000000000001'
  `);
  if (
    bridgeDevices.length !== 1 ||
    bridgeDevices[0].label !== "Existing bridge" ||
    bridgeDevices[0].runtimeType !== null ||
    bridgeDevices[0].hostType !== null ||
    bridgeDevices[0].credentialVersion !== 1 ||
    bridgeDevices[0].credentialRotatedAt !== null
  ) {
    throw new Error(
      "Existing bridge devices were not preserved with safe lifecycle defaults.",
    );
  }

  const migratedAttachment = await source.query(`
    SELECT
      attachment.id,
      attachment."storageKey",
      attachment."storageVersion",
      attachment.content,
      string_agg(chunk.content, ''::bytea ORDER BY chunk."chunkIndex") AS restored,
      sum(chunk."byteLength")::integer AS "storedBytes"
    FROM relay_sync_attachments attachment
    LEFT JOIN relay_sync_attachment_chunks chunk
      ON chunk."attachmentRowId" = attachment.id
      AND chunk."uploadVersion" = attachment."storageVersion"
    WHERE attachment.id = '70000000-0000-4000-8000-000000000001'
    GROUP BY attachment.id
  `);
  if (
    migratedAttachment.length !== 1 ||
    migratedAttachment[0].storageKey !==
      "postgres-chunks:70000000-0000-4000-8000-000000000001" ||
    !migratedAttachment[0].storageVersion ||
    migratedAttachment[0].content !== null ||
    !Buffer.isBuffer(migratedAttachment[0].restored) ||
    migratedAttachment[0].restored.toString("utf8") !==
      "legacy attachment bytes" ||
    migratedAttachment[0].storedBytes !==
      Buffer.byteLength("legacy attachment bytes")
  ) {
    throw new Error(
      `Legacy attachment content was not losslessly chunk-migrated: ${JSON.stringify(
        migratedAttachment[0] ?? null,
      )}`,
    );
  }
  await expectDatabaseError(
    source,
    `
      UPDATE relay_sync_attachments
      SET status = 'uploading'
      WHERE id = '70000000-0000-4000-8000-000000000001'
    `,
    "23514",
  );
  await expectDatabaseError(
    source,
    `
      INSERT INTO relay_sync_attachment_chunks (
        "attachmentRowId", "uploadVersion", "chunkIndex", "byteLength", content
      ) VALUES (
        '70000000-0000-4000-8000-000000000001',
        '70000000-0000-4000-8000-000000000002',
        0, 65537, decode(repeat('00', 65537), 'hex')
      )
    `,
    "23514",
  );

  const replicaTables = await source.query(`
    SELECT
      to_regclass('public.agent_runtime_replicas') IS NOT NULL AS "hasRuntimeReplicas",
      to_regclass('public.agent_document_replicas') IS NOT NULL AS "hasDocumentReplicas"
  `);
  if (
    replicaTables.length !== 1 ||
    !replicaTables[0].hasRuntimeReplicas ||
    !replicaTables[0].hasDocumentReplicas
  ) {
    throw new Error("Agent runtime replica tables were not created.");
  }

  const runtimeAuthoritySchema = await source.query(`
    SELECT
      to_regclass('public.runtime_hosts') IS NOT NULL AS "hasRuntimeHosts",
      to_regclass('public.runtime_observations') IS NOT NULL AS "hasRuntimeObservations",
      to_regclass('public.agent_identity_suppressions') IS NOT NULL AS "hasSuppressions",
      to_regclass('public.managed_agent_documents') IS NOT NULL AS "hasManagedDocuments",
      to_regclass('public.runtime_document_manifests') IS NOT NULL AS "hasDocumentManifests",
      to_regclass('public.managed_runtimes') IS NOT NULL AS "hasManagedRuntimes",
      to_regclass('public.runtime_migrations') IS NOT NULL AS "hasRuntimeMigrations",
      to_regclass('public.relay_remediation_operations') IS NOT NULL AS "hasRemediationOperations"
  `);
  if (
    runtimeAuthoritySchema.length !== 1 ||
    Object.values(runtimeAuthoritySchema[0]).some((value) => value !== true)
  ) {
    throw new Error(
      "Runtime authority, document, managed runtime, migration, or remediation tables are incomplete.",
    );
  }
  const authorityColumns = await source.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND (
        (table_name='runtime_bindings' AND column_name IN ('runtimeHostId','runtimeExternalAgentId','assignmentEpoch','ownershipState','previousRuntimeHostId'))
        OR (table_name='runtime_dispatches' AND column_name IN ('runtimeHostId','assignmentEpoch'))
        OR (table_name='relay_execution_owner_leases' AND column_name IN ('runtimeHostId','assignmentEpoch'))
        OR (table_name='agents' AND column_name IN ('lifecycleStatus','retiredAt','deletionEligibleAt'))
      )
  `);
  if (authorityColumns.length !== 12) {
    throw new Error(
      `Runtime authority column rehearsal expected 12 columns and found ${authorityColumns.length}.`,
    );
  }
  const managedConstraints = await source.query(`
    SELECT conname FROM pg_constraint
    WHERE conname IN (
      'CHK_managed_runtimes_hermes_only',
      'CHK_runtime_migrations_same_harness',
      'CHK_runtime_migrations_distinct_hosts',
      'CHK_managed_runtime_minutes_nonnegative',
      'CHK_managed_runtime_storage_nonnegative'
    )
  `);
  if (managedConstraints.length !== 5) {
    throw new Error(
      "Managed runtime and same-harness migration constraints are incomplete.",
    );
  }
  const managedMeteringColumns = await source.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='managed_runtimes'
      AND column_name IN ('runtimeMinutesUsed', 'lastMeteredAt')
    ORDER BY column_name
  `);
  if (
    managedMeteringColumns.length !== 2 ||
    managedMeteringColumns.find(
      (column) =>
        column.column_name === "runtimeMinutesUsed" &&
        column.data_type === "numeric" &&
        column.is_nullable === "NO" &&
        String(column.column_default).includes("0"),
    ) === undefined ||
    managedMeteringColumns.find(
      (column) =>
        column.column_name === "lastMeteredAt" &&
        column.data_type === "timestamp with time zone" &&
        column.is_nullable === "YES",
    ) === undefined
  ) {
    throw new Error(
      `Managed-runtime metering columns are incomplete: ${JSON.stringify(
        managedMeteringColumns,
      )}`,
    );
  }
  const nativeAgentSchema = await source.query(`
    SELECT
      to_regclass('public.runtime_provisioning_targets') IS NOT NULL AS "hasTargets",
      (
        SELECT count(*)::integer
        FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name='runtime_observations'
          AND column_name IN (
            'connectionState', 'origin', 'displayMetadata',
            'capabilitySnapshot', 'compatibilityStatus',
            'compatibilityReason', 'inventoryGeneration', 'firstSeenAt',
            'lastScannedAt', 'connectedAt', 'disconnectedAt',
            'documentConsentVersion'
          )
      ) = 12 AS "hasObservationColumns",
      (
        SELECT count(*)::integer
        FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name='agent_provisioning_jobs'
          AND column_name IN (
            'runtimeType', 'runtimeHostId', 'targetResolutionSource',
            'idempotencyKey', 'dispatchedAt', 'acknowledgedAt',
            'nativeCreatedAt', 'failedAt', 'errorCode'
          )
      ) = 9 AS "hasProvisioningColumns",
      (
        SELECT count(*)::integer
        FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name='bridge_devices'
          AND column_name IN (
            'runtimeModelCatalog', 'runtimeModelCatalogObservedAt'
          )
      ) = 2 AS "hasRuntimeModelCatalog"
  `);
  if (
    nativeAgentSchema.length !== 1 ||
    Object.values(nativeAgentSchema[0]).some((value) => value !== true)
  ) {
    throw new Error(
      `Native-agent connection or runtime-model schema is incomplete: ${JSON.stringify(
        nativeAgentSchema[0] ?? null,
      )}`,
    );
  }
  const requiredIndexes = [
    "IDX_agent_identity_suppressions_active",
    "IDX_agent_identity_suppressions_lookup",
    "IDX_agents_workspace_lifecycle",
    "IDX_managed_agent_documents_state",
    "IDX_managed_runtimes_workspace_status",
    "IDX_runtime_bindings_host_state",
    "IDX_runtime_hosts_workspace_kind",
    "IDX_runtime_hosts_workspace_status",
    "IDX_runtime_migrations_agent_status",
    "IDX_runtime_observations_agent",
    "IDX_runtime_observations_status",
    "UQ_agent_identity_suppressions_all_hosts",
    "UQ_agent_identity_suppressions_specific_host",
    "UQ_managed_agent_documents_legacy_object",
    "UQ_managed_runtimes_host",
    "UQ_runtime_hosts_bridge_device",
    "UQ_runtime_hosts_managed_runtime",
    "UQ_runtime_hosts_workspace_installation",
  ];
  const indexes = await source.query(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname='public' AND indexname = ANY($1::text[])
    `,
    [requiredIndexes],
  );
  if (indexes.length !== requiredIndexes.length) {
    const found = new Set(indexes.map((row) => row.indexname));
    throw new Error(
      `Runtime index rehearsal is incomplete: ${requiredIndexes
        .filter((name) => !found.has(name))
        .join(", ")}`,
    );
  }

  await source.query(`
    INSERT INTO managed_runtimes (
      id, "workspaceId", "runtimeType", status, "ownershipType",
      "storageUsedBytes", "runtimeMinutesUsed"
    ) VALUES (
      '60000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'hermes', 'provisioning', 'relay_managed', 0, 0
    )
  `);
  await expectDatabaseError(
    source,
    `UPDATE managed_runtimes
     SET "runtimeMinutesUsed" = -1
     WHERE id = '60000000-0000-4000-8000-000000000001'`,
    "23514",
  );
  await expectDatabaseError(
    source,
    `UPDATE managed_runtimes
     SET "storageUsedBytes" = -1
     WHERE id = '60000000-0000-4000-8000-000000000001'`,
    "23514",
  );

  await source.query(`
    INSERT INTO relay_billing_events (
      provider, "providerEventId", "eventType", "liveMode", "payloadHash", status
    ) VALUES ('stripe', 'evt_rehearsal_1', 'invoice.paid', false, repeat('a', 64), 'processed');

    INSERT INTO account_action_tokens (
      "userId", purpose, "tokenHash", "expiresAt"
    ) VALUES (
      '00000000-0000-4000-8000-000000000001',
      'password_reset',
      repeat('b', 64),
      now() + interval '30 minutes'
    );
  `);

  await expectDatabaseError(
    source,
    `INSERT INTO relay_billing_events (provider, "providerEventId", "eventType", "payloadHash", status)
     VALUES ('stripe', 'evt_rehearsal_1', 'invoice.paid', repeat('c', 64), 'processed')`,
    "23505",
  );
  await expectDatabaseError(
    source,
    `UPDATE bridge_devices SET "runtimeType" = 'unsupported' WHERE id = '30000000-0000-4000-8000-000000000001'`,
    "23514",
  );
  await expectDatabaseError(
    source,
    `UPDATE bridge_devices SET "hostType" = 'windows-service' WHERE id = '30000000-0000-4000-8000-000000000001'`,
    "23514",
  );
  await expectDatabaseError(
    source,
    `INSERT INTO relay_billing_events (provider, "providerEventId", "eventType", "payloadHash", status)
     VALUES ('stripe', 'evt_rehearsal_bad', 'invoice.paid', repeat('d', 64), 'unsafe')`,
    "23514",
  );
  await expectDatabaseError(
    source,
    `INSERT INTO relay_billing_events (
       provider, "providerEventId", "eventType", "payloadHash", status
     ) VALUES (
       'stripe', 'evt_rehearsal_unclaimed', 'invoice.paid',
       repeat('e', 64), 'processing'
     )`,
    "23514",
  );
  await expectDatabaseError(
    source,
    `UPDATE relay_commercial_subscriptions
     SET "providerCustomerId" = 'cus_existing_1'
     WHERE id = '20000000-0000-4000-8000-000000000002'`,
    "23505",
  );
  await expectDatabaseError(
    source,
    `INSERT INTO account_action_tokens ("userId", purpose, "tokenHash", "expiresAt")
     VALUES ('00000000-0000-4000-8000-000000000001', 'unsupported', repeat('e', 64), now())`,
    "23514",
  );
  await expectDatabaseError(
    source,
    `INSERT INTO account_action_tokens ("userId", purpose, "tokenHash", "expiresAt")
     VALUES ('00000000-0000-4000-8000-000000000001', 'password_reset', repeat('b', 64), now())`,
    "23505",
  );

  const migrationRows = await source.query(
    `
    SELECT name FROM migrations
    WHERE name = ANY($1::text[])
    ORDER BY name ASC
  `,
    [Array.from(PENDING_MIGRATIONS)],
  );
  if (migrationRows.length !== PENDING_MIGRATIONS.size) {
    throw new Error(
      "The pending migration ledger is incomplete after rehearsal.",
    );
  }

  return {
    preservedUsers: users.length,
    preservedSubscriptions: subscriptions.length,
    backfilledMigrationGrace: migrationGrace.length,
    pendingMigrations: migrationRows.map((row) => row.name),
    verifiedConstraints: [
      "billing_provider_event_unique",
      "billing_event_status_check",
      "subscription_provider_customer_unique",
      "account_action_purpose_check",
      "account_action_token_hash_unique",
      "bridge_runtime_type_check",
      "bridge_host_type_check",
      "migration_grace_bounded",
      "billing_provider_state_order_timestamp",
      "agent_runtime_replica_tables",
      "runtime_authority_tables_and_epoch_columns",
      "managed_document_tables",
      "managed_runtime_hermes_only_check",
      "managed_runtime_metering_columns",
      "native_agent_connection_schema",
      "bridge_runtime_model_catalog",
      "managed_runtime_metering_nonnegative_checks",
      "same_harness_migration_checks",
      "remediation_operation_ledger",
      "runtime_authority_indexes",
    ],
  };
}

async function main() {
  assertIsolatedHost();
  const admin = new DataSource(options(adminDatabase));
  let baseline: DataSource | null = null;
  let pending: DataSource | null = null;

  await admin.initialize();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);

    baseline = new DataSource(options(databaseName));
    await baseline.initialize();
    const baselineRuns = await applyHistoricalBaseline(baseline);
    await seedProductionLikeRows(baseline);
    await baseline.destroy();
    baseline = null;

    pending = new DataSource(
      options(databaseName, [
        path.join(__dirname, "../migrations/052_add_stripe_billing{.ts,.js}"),
        path.join(
          __dirname,
          "../migrations/053_add_account_email_lifecycle{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/054_add_bridge_device_lifecycle{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/055_backfill_prelaunch_cloud_grace{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/056_add_billing_provider_state_order{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/057_add_agent_runtime_replicas{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/058_repair_canonical_agent_runtime_identity{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/059_resolve_hermes_runtime_collisions{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/060_add_runtime_authority_foundation{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/061_add_managed_agent_documents{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/062_add_managed_runtimes_and_migrations{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/063_add_managed_runtime_metering{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/064_add_bridge_runtime_model_catalog{.ts,.js}",
        ),
        path.join(
          __dirname,
          "../migrations/065_add_native_agent_connection{.ts,.js}",
        ),
      ]),
    );
    await pending.initialize();
    const pendingRuns = await pending.runMigrations({ transaction: "each" });
    if (
      pendingRuns
        .map((migration) => migration.name)
        .sort()
        .join(",") !== Array.from(PENDING_MIGRATIONS).sort().join(",")
    ) {
      throw new Error(
        `Unexpected pending migration run set: ${pendingRuns.map((migration) => migration.name).join(", ")}`,
      );
    }
    const verification = await verifyPendingMigrationResult(pending);
    await pending.undoLastMigration({ transaction: "each" });
    const afterRollback = await pending.query(`
      SELECT
        to_regclass('public.runtime_provisioning_targets') IS NULL AS "targetTableRemoved",
        NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public'
            AND table_name='runtime_observations'
            AND column_name='connectionState'
        ) AS "observationColumnsRemoved",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public'
            AND table_name='bridge_devices'
            AND column_name='runtimeModelCatalog'
        ) AS "modelCatalogPreserved",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public'
            AND table_name='managed_runtimes'
            AND column_name='runtimeMinutesUsed'
        ) AS "meteringPreserved"
    `);
    if (
      afterRollback.length !== 1 ||
      !afterRollback[0].targetTableRemoved ||
      !afterRollback[0].observationColumnsRemoved ||
      !afterRollback[0].modelCatalogPreserved ||
      !afterRollback[0].meteringPreserved
    ) {
      throw new Error(
        `The native-agent migration rollback was not isolated from earlier runtime migrations: ${JSON.stringify(
          afterRollback[0] ?? null,
        )}`,
      );
    }
    const reapplied = await pending.runMigrations({ transaction: "each" });
    if (
      reapplied.length !== 1 ||
      reapplied[0].name !== "AddNativeAgentConnection1722009600065"
    ) {
      throw new Error(
        "The rolled-back native-agent migration did not reapply exactly.",
      );
    }
    const rerun = await pending.runMigrations({ transaction: "each" });
    if (rerun.length !== 0)
      throw new Error(
        "Pending migrations were not idempotent in the TypeORM ledger.",
      );

    console.log(
      JSON.stringify(
        {
          ok: true,
          database: "isolated-local-ephemeral",
          baselineMigrationCount: baselineRuns.length,
          pendingMigrationCount: pendingRuns.length,
          rolledBackAndReapplied: reapplied[0].name,
          idempotentRerunCount: rerun.length,
          ...verification,
        },
        null,
        2,
      ),
    );
  } finally {
    if (baseline?.isInitialized) await baseline.destroy();
    if (pending?.isInitialized) await pending.destroy();
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.destroy();
  }
}

main().catch((error) => {
  console.error(
    "Pending migration rehearsal failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
