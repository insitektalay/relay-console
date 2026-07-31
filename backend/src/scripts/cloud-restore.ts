import { createDecipheriv, createHash, scryptSync } from "crypto";
import { createReadStream, createWriteStream } from "fs";
import {
  chmod,
  copyFile,
  lstat,
  mkdtemp,
  open,
  rm,
  stat,
  writeFile,
} from "fs/promises";
import { tmpdir } from "os";
import { isAbsolute, join } from "path";
import { pipeline } from "stream/promises";
import { spawn } from "child_process";
import { buildVerifiedLibpqConnection } from "../infrastructure/database/production-database-tls";

async function command(
  command: string,
  args: string[],
  environment?: NodeJS.ProcessEnv,
) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env: environment,
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command}_EXIT_${code}`)),
    );
  });
}

async function commandOutput(commandName: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(commandName, args, {
      stdio: ["ignore", "pipe", "ignore"],
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks).toString("utf8"))
        : reject(new Error(`${commandName}_EXIT_${code}`)),
    );
  });
}

async function assertIsolatedTargetEmpty(databaseUrl: string) {
  const count = Number(
    (
      await commandOutput("psql", [
        databaseUrl,
        "--tuples-only",
        "--no-align",
        "--command",
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
      ])
    ).trim(),
  );
  if (!Number.isInteger(count) || count !== 0) {
    throw new Error("ISOLATED_RESTORE_TARGET_MUST_BE_EMPTY");
  }
}

function assertRestoreTarget(
  environment: NodeJS.ProcessEnv,
  databaseUrl: string,
  confirmation: string,
) {
  const targetKind = environment.RESTORE_TARGET_KIND;
  if (targetKind === "isolated") {
    const parsed = new URL(databaseUrl);
    if (
      !new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(parsed.hostname)
    ) {
      throw new Error("ISOLATED_RESTORE_REQUIRES_LOOPBACK_DATABASE");
    }
    return;
  }
  if (
    targetKind !== "confirmed-production" ||
    environment.RESTORE_CONFIRM_REPLACE_EXISTING !== `REPLACE_${confirmation}`
  ) {
    throw new Error(
      "RESTORE_TARGET_KIND_AND_REPLACEMENT_CONFIRMATION_REQUIRED",
    );
  }
}

export async function runCloudRestore(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const databaseUrl = environment.RESTORE_DATABASE_URL;
  const passphrase = environment.BACKUP_ENCRYPTION_PASSPHRASE;
  const downloadUrl = environment.BACKUP_DOWNLOAD_URL;
  const inputPath = environment.BACKUP_INPUT_PATH;
  const expectedSha256 = environment.BACKUP_EXPECTED_SHA256?.toLowerCase();
  const confirmation = environment.RESTORE_CONFIRM_DEPLOYMENT_ID;
  if (
    !databaseUrl ||
    !passphrase ||
    (!downloadUrl && !inputPath) ||
    !confirmation ||
    confirmation !== environment.CLAWCHAT_DEPLOYMENT_ID
  )
    throw new Error(
      "Restore requires a target database, passphrase, backup source, and exact deployment ID confirmation",
    );
  if (Boolean(downloadUrl) === Boolean(inputPath))
    throw new Error(
      "Set exactly one of BACKUP_DOWNLOAD_URL or BACKUP_INPUT_PATH",
    );
  if (inputPath && !isAbsolute(inputPath))
    throw new Error("BACKUP_INPUT_PATH must be absolute");
  if (inputPath && !/^[a-f0-9]{64}$/.test(expectedSha256 ?? ""))
    throw new Error(
      "BACKUP_EXPECTED_SHA256 is required for a local encrypted export",
    );
  assertRestoreTarget(environment, databaseUrl, confirmation);
  if (environment.RESTORE_TARGET_KIND === "isolated") {
    await assertIsolatedTargetEmpty(databaseUrl);
  }
  const directory = await mkdtemp(join(tmpdir(), "relay-restore-"));
  try {
    const encrypted = join(directory, "database.dump.relayenc");
    const dump = join(directory, "database.dump");
    let restoreDatabase = databaseUrl;
    let restoreEnvironment: NodeJS.ProcessEnv | undefined;
    if (environment.RESTORE_TARGET_KIND === "confirmed-production") {
      const caFile = join(directory, "database-root-ca.pem");
      const verified = await buildVerifiedLibpqConnection(
        environment,
        databaseUrl,
        caFile,
      );
      await writeFile(caFile, verified.ca, { mode: 0o600, flag: "wx" });
      restoreDatabase = verified.environment.PGDATABASE as string;
      restoreEnvironment = verified.environment;
    }
    if (downloadUrl) {
      const response = await fetch(downloadUrl);
      if (!response.ok)
        throw new Error(`BACKUP_DOWNLOAD_HTTP_${response.status}`);
      await writeFile(encrypted, Buffer.from(await response.arrayBuffer()), {
        mode: 0o600,
      });
    } else if (inputPath) {
      const source = await lstat(inputPath);
      if (!source.isFile() || source.isSymbolicLink())
        throw new Error("BACKUP_INPUT_PATH must be a regular file");
      await copyFile(inputPath, encrypted);
      await chmod(encrypted, 0o600);
    }
    const backupHash = createHash("sha256");
    for await (const chunk of createReadStream(encrypted))
      backupHash.update(chunk);
    const actualSha256 = backupHash.digest("hex");
    if (expectedSha256 && actualSha256 !== expectedSha256)
      throw new Error("BACKUP_SHA256_MISMATCH");
    const handle = await open(encrypted, "r");
    const size = (await stat(encrypted)).size;
    const header = Buffer.alloc(40);
    const tag = Buffer.alloc(16);
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, tag.length, size - tag.length);
    await handle.close();
    if (header.subarray(0, 12).toString() !== "RELAYBACKUP1")
      throw new Error("BACKUP_FORMAT_INVALID");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      scryptSync(passphrase, header.subarray(12, 28), 32),
      header.subarray(28, 40),
    );
    decipher.setAuthTag(tag);
    await pipeline(
      createReadStream(encrypted, { start: 40, end: size - 17 }),
      decipher,
      createWriteStream(dump, { mode: 0o600 }),
    );
    await command(
      "pg_restore",
      [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
        "--single-transaction",
        "--exit-on-error",
        "--dbname",
        restoreDatabase,
        dump,
      ],
      restoreEnvironment,
    );
    return {
      status: "restored" as const,
      restoredAt: new Date().toISOString(),
      deploymentId: confirmation,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runCloudRestore()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error("Cloud restore failed", error);
      process.exit(1);
    });
}
