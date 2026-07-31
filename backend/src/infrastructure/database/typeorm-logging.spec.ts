import {
  buildTypeOrmLoggingConfig,
  isProductionDatabaseRuntime,
  RedactedTypeOrmLogger,
} from "./typeorm-logging";

describe("TypeORM production logging", () => {
  let errorSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps verbose query logging available outside production", () => {
    expect(buildTypeOrmLoggingConfig({ NODE_ENV: "development" })).toEqual({
      logging: true,
    });
  });

  it("uses redacted error and migration logging in production", () => {
    const config = buildTypeOrmLoggingConfig({ NODE_ENV: "production" });

    expect(config.logging).toEqual(["error", "migration"]);
    expect(config.logger).toBeInstanceOf(RedactedTypeOrmLogger);
  });

  it("treats Railway runtime markers as production even when NODE_ENV is wrong", () => {
    expect(
      isProductionDatabaseRuntime({
        NODE_ENV: "development",
        RAILWAY_SERVICE_ID: "service_123",
      }),
    ).toBe(true);
  });

  it("does not log SQL text or parameters for failed production queries", () => {
    const config = buildTypeOrmLoggingConfig({ NODE_ENV: "production" });
    const logger = config.logger as RedactedTypeOrmLogger;

    logger.logQueryError(
      Object.assign(new Error("duplicate key while INSERT INTO users"), {
        code: "23505",
      }),
      "INSERT INTO users(email, password_hash) VALUES ($1, $2)",
      ["person@example.com", "secret-password-hash"],
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = String(errorSpy.mock.calls[0][0]);
    expect(output).toContain("typeorm.query.error");
    expect(output).toContain("23505");
    expect(output).not.toContain("INSERT INTO");
    expect(output).not.toContain("person@example.com");
    expect(output).not.toContain("secret-password-hash");
  });

  it("preserves migration observability without query logging", () => {
    const logger = new RedactedTypeOrmLogger();

    logger.logQuery("SELECT * FROM users", ["person@example.com"]);
    logger.logMigration(
      "Migration AddBetaInvites1710000000000 has been executed",
    );

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0][0])).toContain("typeorm.migration");
    expect(String(logSpy.mock.calls[0][0])).toContain("AddBetaInvites");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
