import { Logger as TypeOrmLogger, LoggerOptions, QueryRunner } from "typeorm";

type DatabaseRuntimeEnv = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "NODE_ENV"
    | "RAILWAY_ENVIRONMENT"
    | "RAILWAY_ENVIRONMENT_ID"
    | "RAILWAY_PROJECT_ID"
    | "RAILWAY_SERVICE_ID"
  >
>;

export function isProductionDatabaseRuntime(env: DatabaseRuntimeEnv) {
  return (
    env.NODE_ENV === "production" ||
    Boolean(
      env.RAILWAY_ENVIRONMENT?.trim() ||
      env.RAILWAY_ENVIRONMENT_ID?.trim() ||
      env.RAILWAY_PROJECT_ID?.trim() ||
      env.RAILWAY_SERVICE_ID?.trim(),
    )
  );
}

export function buildTypeOrmLoggingConfig(env: DatabaseRuntimeEnv): {
  logging: LoggerOptions;
  logger?: TypeOrmLogger;
} {
  if (!isProductionDatabaseRuntime(env)) {
    return { logging: true };
  }

  return {
    logging: ["error", "migration"],
    logger: new RedactedTypeOrmLogger(),
  };
}

export class RedactedTypeOrmLogger implements TypeOrmLogger {
  logQuery(
    _query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    // Intentionally disabled in production to avoid leaking SQL or parameters.
  }

  logQueryError(
    error: string | Error,
    _query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    console.error(
      JSON.stringify({
        event: "typeorm.query.error",
        ...this.describeError(error),
      }),
    );
  }

  logQuerySlow(
    time: number,
    _query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    console.warn(
      JSON.stringify({
        event: "typeorm.query.slow",
        durationMs: time,
      }),
    );
  }

  logSchemaBuild(message: string, _queryRunner?: QueryRunner): void {
    console.log(
      JSON.stringify({
        event: "typeorm.schema",
        message: this.redactSqlLikeMessage(message),
      }),
    );
  }

  logMigration(message: string, _queryRunner?: QueryRunner): void {
    console.log(
      JSON.stringify({
        event: "typeorm.migration",
        message: this.redactSqlLikeMessage(message),
      }),
    );
  }

  log(level: "log" | "info" | "warn", message: unknown): void {
    const payload = JSON.stringify({
      event: "typeorm.log",
      level,
      message: this.redactSqlLikeMessage(String(message)),
    });
    if (level === "warn") {
      console.warn(payload);
      return;
    }
    console.log(payload);
  }

  private describeError(error: string | Error) {
    const record =
      error && typeof error === "object"
        ? (error as unknown as Record<string, unknown>)
        : {};
    const rawMessage = error instanceof Error ? error.message : String(error);

    return {
      name: error instanceof Error ? error.name : "TypeOrmError",
      code:
        typeof record.code === "string" && record.code.trim()
          ? record.code.trim()
          : undefined,
      message: this.redactSqlLikeMessage(rawMessage),
    };
  }

  private redactSqlLikeMessage(message: string) {
    const compact = message.replace(/\s+/g, " ").trim();
    if (!compact) return "";

    if (
      /\b(select|insert|update|delete|with|alter|create|drop)\b/i.test(compact)
    ) {
      return "[redacted sql]";
    }

    return compact.slice(0, 300);
  }
}
