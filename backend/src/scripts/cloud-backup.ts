import { createCipheriv, createHash, randomBytes, scryptSync } from "crypto";
import { constants, createReadStream, createWriteStream } from "fs";
import {
  chmod,
  copyFile,
  mkdtemp,
  readFile,
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

export async function runCloudBackup(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const databaseUrl = environment.DATABASE_URL;
  const passphrase = environment.BACKUP_ENCRYPTION_PASSPHRASE;
  const uploadUrl = environment.BACKUP_UPLOAD_URL;
  const outputPath = environment.BACKUP_OUTPUT_PATH;
  if (!databaseUrl || !passphrase || (!uploadUrl && !outputPath)) {
    throw new Error(
      "DATABASE_URL, BACKUP_ENCRYPTION_PASSPHRASE, and exactly one backup destination are required",
    );
  }
  if (Boolean(uploadUrl) === Boolean(outputPath)) {
    throw new Error(
      "Set exactly one of BACKUP_UPLOAD_URL or BACKUP_OUTPUT_PATH",
    );
  }
  if (outputPath && !isAbsolute(outputPath)) {
    throw new Error("BACKUP_OUTPUT_PATH must be absolute");
  }
  const directory = await mkdtemp(join(tmpdir(), "relay-backup-"));
  try {
    const dump = join(directory, "database.dump");
    const encrypted = join(directory, "database.dump.relayenc");
    const caFile = join(directory, "database-root-ca.pem");
    await writeFile(dump, Buffer.alloc(0), { mode: 0o600, flag: "wx" });
    const database = await buildVerifiedLibpqConnection(
      environment,
      databaseUrl,
      caFile,
    );
    await writeFile(caFile, database.ca, { mode: 0o600, flag: "wx" });
    await command("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--file",
      dump,
    ], database.environment);
    await chmod(dump, 0o600);
    const salt = randomBytes(16);
    const nonce = randomBytes(12);
    const key = scryptSync(passphrase, salt, 32);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    await writeFile(
      encrypted,
      Buffer.concat([Buffer.from("RELAYBACKUP1"), salt, nonce]),
      { mode: 0o600 },
    );
    await pipeline(
      createReadStream(dump),
      cipher,
      createWriteStream(encrypted, { flags: "a", mode: 0o600 }),
    );
    await writeFile(encrypted, cipher.getAuthTag(), { flag: "a" });
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(encrypted)) hash.update(chunk);
    const sha256 = hash.digest("hex");
    if (uploadUrl) {
      const body = await readFile(encrypted);
      const response = await fetch(uploadUrl, {
        method: "PUT",
        body,
        headers: { "content-type": "application/octet-stream" },
      });
      if (!response.ok)
        throw new Error(`BACKUP_UPLOAD_HTTP_${response.status}`);
    } else if (outputPath) {
      await copyFile(encrypted, outputPath, constants.COPYFILE_EXCL);
      await chmod(outputPath, 0o600);
    }
    const size = (await stat(encrypted)).size;
    return {
      status: "completed" as const,
      encrypted: true,
      backupId: sha256,
      sha256,
      destination: uploadUrl ? ("upload" as const) : ("local_export" as const),
      sizeBytes: size,
      completedAt: new Date().toISOString(),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  runCloudBackup()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error("Cloud backup failed", error);
      process.exit(1);
    });
}
