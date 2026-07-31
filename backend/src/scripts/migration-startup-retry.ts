const TRANSIENT_DATABASE_CODES = new Set([
  "57P01", // PostgreSQL administrator shutdown.
  "57P02", // PostgreSQL crash shutdown.
  "57P03", // PostgreSQL is starting up, shutting down, or in recovery.
  "53300", // Too many connections.
  "53400", // Configuration limit exceeded.
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

type ErrorRecord = {
  code?: unknown;
  cause?: unknown;
  errors?: unknown;
  message?: unknown;
};

export type MigrationStartupRetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maximumDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  onRetry?: (details: {
    attempt: number;
    nextAttempt: number;
    delayMs: number;
    error: unknown;
  }) => void;
};

function errorRecords(error: unknown): ErrorRecord[] {
  const records: ErrorRecord[] = [];
  const pending: unknown[] = [error];
  const visited = new Set<unknown>();

  while (pending.length > 0 && records.length < 12) {
    const candidate = pending.shift();
    if (
      candidate === null ||
      (typeof candidate !== "object" && typeof candidate !== "function") ||
      visited.has(candidate)
    ) {
      continue;
    }

    visited.add(candidate);
    const record = candidate as ErrorRecord;
    records.push(record);
    if (record.cause !== undefined) pending.push(record.cause);
    if (Array.isArray(record.errors)) pending.push(...record.errors);
  }

  return records;
}

export function isTransientMigrationStartupError(error: unknown): boolean {
  return errorRecords(error).some((record) => {
    if (typeof record.code !== "string") return false;
    return (
      record.code.startsWith("08") || TRANSIENT_DATABASE_CODES.has(record.code)
    );
  });
}

export function migrationStartupErrorSummary(error: unknown): string {
  for (const record of errorRecords(error)) {
    const code = typeof record.code === "string" ? record.code : undefined;
    const message =
      typeof record.message === "string" ? record.message : undefined;
    if (code || message) {
      return [code, message].filter(Boolean).join(": ");
    }
  }
  return "Unknown database startup error";
}

export async function runWithMigrationStartupRetry<T>(
  operation: () => Promise<T>,
  options: MigrationStartupRetryOptions = {},
): Promise<T> {
  // The 20-attempt default waits for at most 254 seconds, inside Railway's
  // 300-second deployment health timeout.
  const maxAttempts = options.maxAttempts ?? 20;
  const initialDelayMs = options.initialDelayMs ?? 2_000;
  const maximumDelayMs = options.maximumDelayMs ?? 15_000;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  if (maxAttempts < 1) {
    throw new Error("Migration startup retry requires at least one attempt.");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts || !isTransientMigrationStartupError(error)) {
        throw error;
      }

      const delayMs = Math.min(
        initialDelayMs * 2 ** (attempt - 1),
        maximumDelayMs,
      );
      options.onRetry?.({
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        error,
      });
      await sleep(delayMs);
    }
  }

  throw new Error("Migration startup retry exhausted unexpectedly.");
}
