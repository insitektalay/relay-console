import { createHash, randomBytes } from "crypto";
import * as fs from "fs";
import { createServer } from "http";
import * as os from "os";
import * as path from "path";
import { AddressInfo } from "net";
import { DataSource, DataSourceOptions } from "typeorm";
import { runCloudBackup } from "./cloud-backup";
import { runCloudRestore } from "./cloud-restore";

const host = process.env.RESTORE_REHEARSAL_HOST || "/tmp";
const port = Number(process.env.RESTORE_REHEARSAL_PORT || "5432");
const username = process.env.RESTORE_REHEARSAL_USER || os.userInfo().username;
const password = process.env.RESTORE_REHEARSAL_PASSWORD;
const adminDatabase =
  process.env.RESTORE_REHEARSAL_ADMIN_DATABASE || "postgres";
const suffix = `${process.pid}_${Date.now()}`;
const sourceDatabase = `relay_restore_source_${suffix}`;
const targetDatabase = `relay_restore_target_${suffix}`;

const ids = {
  userA: "00000000-0000-4000-8000-000000000011",
  userB: "00000000-0000-4000-8000-000000000012",
  workspaceA: "10000000-0000-4000-8000-000000000011",
  workspaceB: "10000000-0000-4000-8000-000000000012",
  agentA: "20000000-0000-4000-8000-000000000011",
  agentB: "20000000-0000-4000-8000-000000000012",
  threadA: "30000000-0000-4000-8000-000000000011",
  threadB: "30000000-0000-4000-8000-000000000012",
  sessionA: "40000000-0000-4000-8000-000000000011",
  sessionB: "40000000-0000-4000-8000-000000000012",
  messageA: "50000000-0000-4000-8000-000000000011",
  messageB: "50000000-0000-4000-8000-000000000012",
  attachmentA: "60000000-0000-4000-8000-000000000011",
  attachmentB: "60000000-0000-4000-8000-000000000012",
  attachmentVersionA: "61000000-0000-4000-8000-000000000011",
  attachmentVersionB: "61000000-0000-4000-8000-000000000012",
  bridgeA: "70000000-0000-4000-8000-000000000011",
  bridgeB: "70000000-0000-4000-8000-000000000012",
  marketplaceA: "80000000-0000-4000-8000-000000000011",
  marketplaceB: "80000000-0000-4000-8000-000000000012",
  subscriptionA: "90000000-0000-4000-8000-000000000011",
  subscriptionB: "90000000-0000-4000-8000-000000000012",
};

const contentMarkers = [
  "restore-drill-message-alpha",
  "restore-drill-message-beta",
  "restore-drill-encrypted-provider-value-alpha",
  "restore-drill-encrypted-provider-value-beta",
  "restore-drill-attachment-alpha",
  "restore-drill-attachment-beta",
];

function assertLocalPostgres() {
  if (!new Set(["/tmp", "localhost", "127.0.0.1", "::1"]).has(host)) {
    throw new Error("Restore rehearsal refuses a remote PostgreSQL host.");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("RESTORE_REHEARSAL_PORT must be a valid PostgreSQL port.");
  }
}

function options(database: string): DataSourceOptions {
  return {
    type: "postgres",
    host,
    port,
    username,
    password,
    database,
    migrationsTableName: "migrations",
    synchronize: false,
    logging: false,
    ssl: false,
  };
}

function databaseUrl(database: string) {
  const encodedUser = encodeURIComponent(username);
  const encodedPassword = password ? `:${encodeURIComponent(password)}` : "";
  return `postgresql://${encodedUser}${encodedPassword}@localhost:${port}/${database}`;
}

async function applyAllMigrations(source: DataSource) {
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

async function seedRestoreFixture(source: DataSource) {
  const runner = source.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(
      `
      INSERT INTO users (id, email, name, "passwordHash", "refreshToken", "emailVerifiedAt", "createdAt", "updatedAt") VALUES
        ($1, 'restore-alpha@example.test', 'Restore Alpha', 'restore-password-hash-alpha', 'restore-refresh-hash-alpha', '2026-06-01T10:00:00Z', '2026-06-01T10:00:00Z', '2026-06-01T10:00:00Z'),
        ($2, 'restore-beta@example.test', 'Restore Beta', 'restore-password-hash-beta', 'restore-refresh-hash-beta', '2026-06-02T10:00:00Z', '2026-06-02T10:00:00Z', '2026-06-02T10:00:00Z')
    `,
      [ids.userA, ids.userB],
    );
    await runner.query(
      `
      INSERT INTO workspaces (id, name, type, "ownerId", "createdAt", "updatedAt") VALUES
        ($1, 'Restore Workspace Alpha', 'personal', $3, '2026-06-01T10:00:00Z', '2026-06-01T10:00:00Z'),
        ($2, 'Restore Workspace Beta', 'personal', $4, '2026-06-02T10:00:00Z', '2026-06-02T10:00:00Z')
    `,
      [ids.workspaceA, ids.workspaceB, ids.userA, ids.userB],
    );
    await runner.query(
      `
      INSERT INTO workspace_members ("workspaceId", "userId", role) VALUES
        ($1, $3, 'owner'), ($2, $4, 'owner')
    `,
      [ids.workspaceA, ids.workspaceB, ids.userA, ids.userB],
    );
    await runner.query(
      `
      INSERT INTO agents (id, name, role, status, "workspaceId", capabilities, "createdAt", "updatedAt") VALUES
        ($1, 'Restore Agent Alpha', 'assistant', 'available', $3, '["chat"]', '2026-06-01T10:01:00Z', '2026-06-01T10:01:00Z'),
        ($2, 'Restore Agent Beta', 'assistant', 'available', $4, '["chat"]', '2026-06-02T10:01:00Z', '2026-06-02T10:01:00Z')
    `,
      [ids.agentA, ids.agentB, ids.workspaceA, ids.workspaceB],
    );
    await runner.query(
      `
      INSERT INTO threads (id, title, type, "workspaceId", "participantIds", "agentIds", status, "createdAt", "updatedAt") VALUES
        ($1, 'Restore Thread Alpha', 'direct', $3, '[]', jsonb_build_array($5::text), 'active', '2026-06-01T10:02:00Z', '2026-06-01T10:02:00Z'),
        ($2, 'Restore Thread Beta', 'direct', $4, '[]', jsonb_build_array($6::text), 'active', '2026-06-02T10:02:00Z', '2026-06-02T10:02:00Z')
    `,
      [
        ids.threadA,
        ids.threadB,
        ids.workspaceA,
        ids.workspaceB,
        ids.agentA,
        ids.agentB,
      ],
    );
    await runner.query(
      `
      INSERT INTO thread_sessions (id, "threadId", "sequenceNumber", status, "startedAt", "createdAt", "updatedAt") VALUES
        ($1, $3, 1, 'active', '2026-06-01T10:02:00Z', '2026-06-01T10:02:00Z', '2026-06-01T10:02:00Z'),
        ($2, $4, 1, 'active', '2026-06-02T10:02:00Z', '2026-06-02T10:02:00Z', '2026-06-02T10:02:00Z')
    `,
      [ids.sessionA, ids.sessionB, ids.threadA, ids.threadB],
    );
    await runner.query(
      `
      UPDATE threads SET "activeSessionId" = CASE id WHEN $1 THEN $3::uuid WHEN $2 THEN $4::uuid END
      WHERE id IN ($1, $2)
    `,
      [ids.threadA, ids.threadB, ids.sessionA, ids.sessionB],
    );
    await runner.query(
      `
      INSERT INTO messages (
        id, "threadId", "threadSessionId", "senderId", "senderName", content,
        type, "contentFormat", provenance, metadata, attachments, "isFromUser", "createdAt", "updatedAt"
      ) VALUES
        ($1, $3, $5, $7, 'Restore Alpha', 'restore-drill-message-alpha', 'text', 'markdown', 'user', '{"fixture":"alpha"}', '[]', true, '2026-06-01T10:03:00Z', '2026-06-01T10:03:00Z'),
        ($2, $4, $6, $8, 'Restore Beta', 'restore-drill-message-beta', 'text', 'markdown', 'user', '{"fixture":"beta"}', '[]', true, '2026-06-02T10:03:00Z', '2026-06-02T10:03:00Z')
    `,
      [
        ids.messageA,
        ids.messageB,
        ids.threadA,
        ids.threadB,
        ids.sessionA,
        ids.sessionB,
        ids.userA,
        ids.userB,
      ],
    );
    await runner.query(
      `
      INSERT INTO bridge_devices (
        id, "workspaceId", "createdByUserId", label, "devicePublicId", "credentialHash",
        status, capabilities, "runtimeType", "hostType", "credentialVersion", "lastSeenAt"
      ) VALUES
        ($1, $3, $5, 'Restore Bridge Alpha', 'restore_bridge_alpha', repeat('a', 64), 'active', '["dispatch"]', 'hermes', 'macos-launchd', 2, '2026-06-03T10:00:00Z'),
        ($2, $4, $6, 'Restore Bridge Beta', 'restore_bridge_beta', repeat('b', 64), 'active', '["dispatch"]', 'openclaw', 'linux-systemd', 3, '2026-06-03T11:00:00Z')
    `,
      [
        ids.bridgeA,
        ids.bridgeB,
        ids.workspaceA,
        ids.workspaceB,
        ids.userA,
        ids.userB,
      ],
    );
    await runner.query(
      `
      INSERT INTO marketplace_connections (
        id, "workspaceId", "appSlug", "displayName", "authType", "credentialNames",
        "secretCiphertext", "secretIv", "secretAuthTag", "secretKeyVersion",
        "selectedCapabilities", status, "createdByUserId", "updatedByUserId", "executionAuthority"
      ) VALUES
        ($1, $3, 'restore-alpha', 'Restore Provider Alpha', 'oauth', '["accessToken"]',
         'restore-drill-encrypted-provider-value-alpha', 'restore-iv-alpha', 'restore-tag-alpha', 'v1',
         '["read"]', 'connected', $5, $5, 'railway'),
        ($2, $4, 'restore-beta', 'Restore Provider Beta', 'api_key', '["apiKey"]',
         'restore-drill-encrypted-provider-value-beta', 'restore-iv-beta', 'restore-tag-beta', 'v1',
         '["read"]', 'connected', $6, $6, 'railway')
    `,
      [
        ids.marketplaceA,
        ids.marketplaceB,
        ids.workspaceA,
        ids.workspaceB,
        ids.userA,
        ids.userB,
      ],
    );
    await runner.query(
      `
      INSERT INTO relay_sync_attachments (
        id, "workspaceId", "attachmentId", "sourceInstallationId", "sourceAttachmentId",
        "fileName", "contentType", "byteSize", sha256, status, availability,
        "storageKey", "storageVersion", content, provenance
      ) VALUES
        ($1, $3, 'attachment-alpha', 'install-alpha', 'source-alpha', 'alpha.txt', 'text/plain',
         octet_length(convert_to('restore-drill-attachment-alpha', 'UTF8')),
         encode(digest('restore-drill-attachment-alpha', 'sha256'), 'hex'), 'available', 'cloud',
         'postgres-chunks:' || $1::text, $5, NULL, '{"fixture":"alpha"}'),
        ($2, $4, 'attachment-beta', 'install-beta', 'source-beta', 'beta.txt', 'text/plain',
         octet_length(convert_to('restore-drill-attachment-beta', 'UTF8')),
         encode(digest('restore-drill-attachment-beta', 'sha256'), 'hex'), 'available', 'cloud',
         'postgres-chunks:' || $2::text, $6, NULL, '{"fixture":"beta"}')
    `,
      [
        ids.attachmentA,
        ids.attachmentB,
        ids.workspaceA,
        ids.workspaceB,
        ids.attachmentVersionA,
        ids.attachmentVersionB,
      ],
    );
    await runner.query(
      `
      INSERT INTO relay_sync_attachment_chunks (
        "attachmentRowId", "uploadVersion", "chunkIndex", "byteLength", content
      ) VALUES
        ($1, $3, 0, octet_length(convert_to('restore-drill-attachment-alpha', 'UTF8')),
         convert_to('restore-drill-attachment-alpha', 'UTF8')),
        ($2, $4, 0, octet_length(convert_to('restore-drill-attachment-beta', 'UTF8')),
         convert_to('restore-drill-attachment-beta', 'UTF8'))
    `,
      [
        ids.attachmentA,
        ids.attachmentB,
        ids.attachmentVersionA,
        ids.attachmentVersionB,
      ],
    );
    await runner.query(
      `
      INSERT INTO relay_commercial_subscriptions (
        id, "workspaceId", plan, status, provider, "providerCustomerId",
        "providerSubscriptionId", "currentPeriodEndsAt", limits, features
      ) VALUES
        ($1, $3, 'relay_cloud_monthly', 'active', 'stripe', 'cus_restore_alpha', 'sub_restore_alpha',
         '2027-06-01T10:00:00Z', '{"storageBytes":1073741824}', '{"cloudControlPlane":true}'),
        ($2, $4, 'relay_cloud_monthly', 'active', 'apple', 'apple_restore_beta', 'appstore_restore_beta',
         '2027-06-02T10:00:00Z', '{"storageBytes":1073741824}', '{"cloudControlPlane":true}')
    `,
      [ids.subscriptionA, ids.subscriptionB, ids.workspaceA, ids.workspaceB],
    );
    await runner.query(`
      INSERT INTO relay_billing_events (
        provider, "providerEventId", "eventType", "liveMode", "payloadHash", status, "processedAt"
      ) VALUES
        ('stripe', 'evt_restore_alpha', 'invoice.paid', false, repeat('c', 64), 'processed', '2026-06-03T12:00:00Z'),
        ('apple', 'evt_restore_beta', 'DID_RENEW', false, repeat('d', 64), 'processed', '2026-06-03T12:01:00Z')
    `);
    await runner.query(
      `
      INSERT INTO audit_logs (
        "actorType", "actorId", "workspaceId", "eventType", "resourceType", "resourceId", metadata, "createdAt"
      ) VALUES
        ('user', $3, $1, 'restore.fixture.created', 'workspace', $1::uuid::text, '{"fixture":"alpha"}', '2026-06-03T12:02:00Z'),
        ('user', $4, $2, 'restore.fixture.created', 'workspace', $2::uuid::text, '{"fixture":"beta"}', '2026-06-03T12:03:00Z')
    `,
      [ids.workspaceA, ids.workspaceB, ids.userA, ids.userB],
    );
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}

async function databaseSnapshot(source: DataSource) {
  const snapshot = {
    migrations: await source.query(
      `SELECT timestamp::text, name FROM migrations ORDER BY name`,
    ),
    tables: await source.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `),
    users: await source.query(
      `
      SELECT id, email, name, "passwordHash", "refreshToken", "emailVerifiedAt"
      FROM users WHERE id IN ($1, $2) ORDER BY id
    `,
      [ids.userA, ids.userB],
    ),
    workspaces: await source.query(
      `
      SELECT id, name, type, "ownerId" FROM workspaces WHERE id IN ($1, $2) ORDER BY id
    `,
      [ids.workspaceA, ids.workspaceB],
    ),
    agents: await source.query(
      `
      SELECT id, name, role, status, "workspaceId", capabilities
      FROM agents WHERE id IN ($1, $2) ORDER BY id
    `,
      [ids.agentA, ids.agentB],
    ),
    threads: await source.query(
      `
      SELECT id, title, type, "workspaceId", "agentIds", "activeSessionId"
      FROM threads WHERE id IN ($1, $2) ORDER BY id
    `,
      [ids.threadA, ids.threadB],
    ),
    sessions: await source.query(
      `
      SELECT id, "threadId", "sequenceNumber", status FROM thread_sessions
      WHERE id IN ($1, $2) ORDER BY id
    `,
      [ids.sessionA, ids.sessionB],
    ),
    messages: await source.query(
      `
      SELECT id, "threadId", "threadSessionId", "senderId", content, "contentFormat", provenance, metadata
      FROM messages WHERE id IN ($1, $2) ORDER BY id
    `,
      [ids.messageA, ids.messageB],
    ),
    bridges: await source.query(
      `
      SELECT id, "workspaceId", "devicePublicId", "credentialHash", status,
             "runtimeType", "hostType", "credentialVersion"
      FROM bridge_devices WHERE id IN ($1, $2) ORDER BY id
    `,
      [ids.bridgeA, ids.bridgeB],
    ),
    marketplace: await source.query(
      `
      SELECT id, "workspaceId", "appSlug", "secretCiphertext", "secretIv", "secretAuthTag",
             "secretKeyVersion", status, "executionAuthority"
      FROM marketplace_connections WHERE id IN ($1, $2) ORDER BY id
    `,
      [ids.marketplaceA, ids.marketplaceB],
    ),
    attachments: await source.query(
      `
      SELECT attachment.id, attachment."workspaceId", attachment."attachmentId",
             attachment."fileName", attachment."byteSize"::text, attachment.sha256,
             attachment."storageKey", attachment."storageVersion",
             encode(
               string_agg(chunk.content, ''::bytea ORDER BY chunk."chunkIndex"),
               'hex'
             ) AS content
      FROM relay_sync_attachments attachment
      JOIN relay_sync_attachment_chunks chunk
        ON chunk."attachmentRowId" = attachment.id
        AND chunk."uploadVersion" = attachment."storageVersion"
      WHERE attachment.id IN ($1, $2)
      GROUP BY attachment.id
      ORDER BY attachment.id
    `,
      [ids.attachmentA, ids.attachmentB],
    ),
    subscriptions: await source.query(
      `
      SELECT id, "workspaceId", plan, status, provider, "providerCustomerId",
             "providerSubscriptionId", "currentPeriodEndsAt", limits, features
      FROM relay_commercial_subscriptions WHERE id IN ($1, $2) ORDER BY id
    `,
      [ids.subscriptionA, ids.subscriptionB],
    ),
    billingEvents: await source.query(`
      SELECT provider, "providerEventId", "eventType", "payloadHash", status, "processedAt"
      FROM relay_billing_events WHERE "providerEventId" IN ('evt_restore_alpha', 'evt_restore_beta')
      ORDER BY "providerEventId"
    `),
    auditLogs: await source.query(`
      SELECT "actorType", "actorId", "workspaceId", "eventType", "resourceType", "resourceId", metadata
      FROM audit_logs WHERE "eventType" = 'restore.fixture.created' ORDER BY "workspaceId"
    `),
    syncCounts: await source.query(
      `
      SELECT "workspaceId", COUNT(*)::int AS count
      FROM relay_workspace_changes WHERE "workspaceId" IN ($1, $2)
      GROUP BY "workspaceId" ORDER BY "workspaceId"
    `,
      [ids.workspaceA, ids.workspaceB],
    ),
  };
  const counts = Object.fromEntries(
    Object.entries(snapshot)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, value.length]),
  );
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
  return { snapshot, counts, fingerprint };
}

async function expectPgError(source: DataSource, sql: string, code: string) {
  try {
    await source.query(sql);
  } catch (error) {
    if ((error as { code?: string }).code === code) return;
    throw error;
  }
  throw new Error(
    `Expected PostgreSQL error ${code}, but the statement succeeded.`,
  );
}

async function verifyRestoredConstraints(source: DataSource) {
  await expectPgError(
    source,
    `INSERT INTO relay_billing_events (provider, "providerEventId", "eventType", "payloadHash", status)
     VALUES ('stripe', 'evt_restore_alpha', 'invoice.paid', repeat('e', 64), 'processed')`,
    "23505",
  );
  await expectPgError(
    source,
    `UPDATE bridge_devices SET "runtimeType" = 'unsupported' WHERE id = '${ids.bridgeA}'`,
    "23514",
  );
}

async function startArtifactServer() {
  let artifact: Buffer | null = null;
  const server = createServer((request, response) => {
    if (request.url !== "/backup") {
      response.writeHead(404).end();
      return;
    }
    if (request.method === "PUT") {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => {
        artifact = Buffer.concat(chunks);
        response.writeHead(200).end();
      });
      return;
    }
    if (request.method === "GET" && artifact) {
      response.writeHead(200, { "content-type": "application/octet-stream" });
      response.end(artifact);
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}/backup`,
    artifact: () => artifact,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function dropDatabase(admin: DataSource, database: string) {
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [database],
  );
  await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
}

async function main() {
  assertLocalPostgres();
  const admin = new DataSource(options(adminDatabase));
  let source: DataSource | null = null;
  let target: DataSource | null = null;
  let artifactServer: Awaited<ReturnType<typeof startArtifactServer>> | null =
    null;

  await admin.initialize();
  try {
    await admin.query(`CREATE DATABASE "${sourceDatabase}"`);
    await admin.query(`CREATE DATABASE "${targetDatabase}"`);

    source = new DataSource(options(sourceDatabase));
    await source.initialize();
    const migrationNames = await applyAllMigrations(source);
    await seedRestoreFixture(source);
    const before = await databaseSnapshot(source);

    artifactServer = await startArtifactServer();
    const passphrase = randomBytes(48).toString("hex");
    const backupStartedAt = Date.now();
    const backup = await runCloudBackup({
      DATABASE_URL: databaseUrl(sourceDatabase),
      BACKUP_ENCRYPTION_PASSPHRASE: passphrase,
      BACKUP_UPLOAD_URL: artifactServer.url,
    });
    const backupDurationMs = Date.now() - backupStartedAt;
    const artifact = artifactServer.artifact();
    if (!artifact || artifact.length !== backup.sizeBytes) {
      throw new Error(
        "The uploaded encrypted artifact is missing or truncated.",
      );
    }
    if (artifact.subarray(0, 12).toString() !== "RELAYBACKUP1") {
      throw new Error(
        "The uploaded artifact does not use the Relay encrypted-backup format.",
      );
    }
    if (
      contentMarkers.some((marker) => artifact.includes(Buffer.from(marker)))
    ) {
      throw new Error(
        "A plaintext fixture marker was visible in the encrypted artifact.",
      );
    }

    const restoreEnvironment = {
      RESTORE_DATABASE_URL: databaseUrl(targetDatabase),
      BACKUP_DOWNLOAD_URL: artifactServer.url,
      BACKUP_ENCRYPTION_PASSPHRASE: passphrase,
      RESTORE_CONFIRM_DEPLOYMENT_ID: "isolated-restore-rehearsal",
      CLAWCHAT_DEPLOYMENT_ID: "isolated-restore-rehearsal",
      RESTORE_TARGET_KIND: "isolated",
    };
    let wrongPassphraseRejected = false;
    try {
      await runCloudRestore({
        ...restoreEnvironment,
        BACKUP_ENCRYPTION_PASSPHRASE: randomBytes(48).toString("hex"),
      });
    } catch {
      wrongPassphraseRejected = true;
    }
    if (!wrongPassphraseRejected)
      throw new Error("Wrong backup passphrase was accepted.");

    target = new DataSource(options(targetDatabase));
    await target.initialize();
    const tablesBeforeRestore = await target.query(`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    if (Number(tablesBeforeRestore[0]?.count) !== 0) {
      throw new Error("Failed decryption changed the empty restore target.");
    }
    await target.destroy();
    target = null;

    const restoreStartedAt = Date.now();
    await runCloudRestore(restoreEnvironment);
    const restoreDurationMs = Date.now() - restoreStartedAt;

    target = new DataSource(options(targetDatabase));
    await target.initialize();
    const after = await databaseSnapshot(target);
    if (before.fingerprint !== after.fingerprint) {
      throw new Error(
        "Restored schema/data fingerprint does not match the source database.",
      );
    }
    await verifyRestoredConstraints(target);

    console.log(
      JSON.stringify(
        {
          ok: true,
          database: "isolated-local-ephemeral",
          backup: {
            encrypted: backup.encrypted,
            format: "RELAYBACKUP1",
            sizeBytes: backup.sizeBytes,
            durationMs: backupDurationMs,
            plaintextMarkersVisible: false,
            wrongPassphraseRejected,
          },
          restore: {
            transactional: true,
            durationMs: restoreDurationMs,
            migrationCount: migrationNames.length,
            tableCount: before.counts.tables,
            dataFingerprintMatched: true,
            restoredCounts: {
              users: before.counts.users,
              workspaces: before.counts.workspaces,
              agents: before.counts.agents,
              threads: before.counts.threads,
              sessions: before.counts.sessions,
              messages: before.counts.messages,
              bridges: before.counts.bridges,
              marketplaceConnections: before.counts.marketplace,
              attachments: before.counts.attachments,
              subscriptions: before.counts.subscriptions,
              billingEvents: before.counts.billingEvents,
              auditLogs: before.counts.auditLogs,
            },
          },
          verifiedInvariants: [
            "all_numbered_migrations_restored",
            "two_tenant_content_and_identity_preserved",
            "credential_hashes_and_encrypted_provider_values_preserved",
            "attachment_metadata_and_bytes_preserved",
            "subscription_billing_and_audit_lifecycle_preserved",
            "sync_change_ledger_preserved",
            "wrong_passphrase_fails_before_target_mutation",
            "restored_unique_and_check_constraints_enforced",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    if (source?.isInitialized) await source.destroy();
    if (target?.isInitialized) await target.destroy();
    if (artifactServer) await artifactServer.close();
    await dropDatabase(admin, sourceDatabase);
    await dropDatabase(admin, targetDatabase);
    await admin.destroy();
  }
}

main().catch((error) => {
  console.error(
    "Backup/restore rehearsal failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
