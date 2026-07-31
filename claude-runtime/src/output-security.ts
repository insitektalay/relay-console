import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_CLI_OUTPUT_BYTES = 1024 * 1024;
export const MAX_PERSISTED_OUTPUT_BYTES = 256 * 1024;
export const MAX_ERROR_DETAIL_BYTES = 8 * 1024;

const REDACTIONS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [REDACTED]"],
  [
    /(["']?(?:deviceToken|accessToken|refreshToken|api[_-]?key|secret|password)["']?\s*[:=]\s*["']?)[^\s"',}]+/gi,
    "$1[REDACTED]",
  ],
  [/\b(?:sk|rk|pk)_[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_KEY]"],
  [
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    "[REDACTED_JWT]",
  ],
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    "[REDACTED_PRIVATE_KEY]",
  ],
];

export function redactSensitiveText(value: string): string {
  return REDACTIONS.reduce(
    (current, [pattern, replacement]) =>
      current.replace(pattern, replacement),
    value,
  );
}

export function boundedRedactedText(value: string, maxBytes: number): string {
  const redacted = redactSensitiveText(value);
  const bytes = Buffer.from(redacted, "utf8");
  if (bytes.length <= maxBytes) {
    return redacted;
  }
  return `${bytes.subarray(0, maxBytes).toString("utf8")}\n[OUTPUT TRUNCATED]`;
}

export function redactUnknown<T>(value: T): T {
  if (typeof value === "string") {
    return redactSensitiveText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactUnknown(entry)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        redactUnknown(entry),
      ]),
    ) as T;
  }
  return value;
}

export async function writeProtectedOutput(
  outputPath: string,
  value: string,
): Promise<void> {
  await ensureProtectedOutputDirectory(path.dirname(outputPath));
  await writeProtectedFile(
    outputPath,
    boundedRedactedText(value, MAX_PERSISTED_OUTPUT_BYTES),
  );
}

export async function ensureProtectedOutputDirectory(
  directoryPath: string,
): Promise<void> {
  await fs.mkdir(directoryPath, { mode: 0o700 }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    },
  );
  const stat = await fs.lstat(directoryPath);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error("Refusing an unsafe output directory");
  }
  await fs.chmod(directoryPath, 0o700);
}

export async function writeProtectedFile(
  outputPath: string,
  value: string,
): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${randomUUID()}.tmp`,
  );
  const handle = await fs.open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(value, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temporaryPath, outputPath);
    await fs.chmod(outputPath, 0o600);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function rotateProtectedLogs(
  logsRoot: string,
  options: {
    now?: number;
    maxAgeMs?: number;
    maxFiles?: number;
    maxTotalBytes?: number;
  } = {},
): Promise<void> {
  const now = options.now ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? 14 * 24 * 60 * 60 * 1000;
  const maxFiles = options.maxFiles ?? 300;
  const maxTotalBytes = options.maxTotalBytes ?? 64 * 1024 * 1024;
  const files: Array<{ path: string; mtimeMs: number; size: number }> = [];
  for (const dateEntry of await fs.readdir(logsRoot, { withFileTypes: true })) {
    if (
      !dateEntry.isDirectory() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dateEntry.name)
    ) {
      continue;
    }
    const dateDirectory = path.join(logsRoot, dateEntry.name);
    for (const entry of await fs.readdir(dateDirectory, {
      withFileTypes: true,
    })) {
      if (
        !entry.isFile() ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.(?:stdout\.log|stderr\.log|meta\.json)$/.test(
          entry.name,
        )
      ) {
        continue;
      }
      const filePath = path.join(dateDirectory, entry.name);
      const stat = await fs.lstat(filePath);
      if (stat.isFile()) {
        files.push({ path: filePath, mtimeMs: stat.mtimeMs, size: stat.size });
      }
    }
  }

  files.sort((left, right) => right.mtimeMs - left.mtimeMs);
  let retainedFiles = 0;
  let retainedBytes = 0;
  for (const file of files) {
    const keep =
      now - file.mtimeMs <= maxAgeMs &&
      retainedFiles < maxFiles &&
      retainedBytes + file.size <= maxTotalBytes;
    if (keep) {
      retainedFiles += 1;
      retainedBytes += file.size;
    } else {
      await fs.rm(file.path, { force: true });
    }
  }
}

export class BoundedOutputCapture {
  private readonly chunks: Buffer[] = [];
  private bytes = 0;
  private exceeded = false;

  append(chunk: Buffer): boolean {
    this.bytes += chunk.length;
    if (this.bytes > MAX_CLI_OUTPUT_BYTES) {
      this.exceeded = true;
    }
    if (!this.exceeded) {
      this.chunks.push(Buffer.from(chunk));
    }
    return !this.exceeded;
  }

  didExceedLimit(): boolean {
    return this.exceeded;
  }

  text(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}
