import { QueryRunner } from "typeorm";
import { assertHistoricalDestructiveMigrationSafe } from "./destructive-migration-guard";

function createQueryRunner(
  counts: Record<string, number>,
  missingTables = new Set<string>(),
) {
  return {
    hasTable: jest.fn(
      async (tableName: string) => !missingTables.has(tableName),
    ),
    query: jest.fn(async (sql: string) => {
      const tableName = sql.match(/FROM "([^"]+)"/)?.[1] ?? "";
      return [{ count: String(counts[tableName] ?? 0) }];
    }),
  } as unknown as QueryRunner & {
    hasTable: jest.Mock;
    query: jest.Mock;
  };
}

describe("assertHistoricalDestructiveMigrationSafe", () => {
  it("does not inspect tables outside production-like environments", async () => {
    const queryRunner = createQueryRunner({ agents: 5 });

    await expect(
      assertHistoricalDestructiveMigrationSafe(
        queryRunner,
        "WipeSeedData1774174000000",
        ["agents"],
        {
          NODE_ENV: "development",
        },
      ),
    ).resolves.toBeUndefined();

    expect(queryRunner.hasTable).not.toHaveBeenCalled();
    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it("allows a pending historical destructive migration when target tables are empty", async () => {
    const queryRunner = createQueryRunner({ agents: 0, threads: 0 });

    await expect(
      assertHistoricalDestructiveMigrationSafe(
        queryRunner,
        "WipeSeedData1774174000000",
        ["agents", "threads"],
        { NODE_ENV: "production" },
      ),
    ).resolves.toBeUndefined();

    expect(queryRunner.query).toHaveBeenCalledTimes(2);
  });

  it("ignores missing tables during greenfield database bootstrap", async () => {
    const queryRunner = createQueryRunner({ agents: 0 }, new Set(["threads"]));

    await expect(
      assertHistoricalDestructiveMigrationSafe(
        queryRunner,
        "WipeSeedData1774174000000",
        ["agents", "threads"],
        { NODE_ENV: "production" },
      ),
    ).resolves.toBeUndefined();

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
  });

  it("fails closed when production-like pending destructive migrations would touch data", async () => {
    const queryRunner = createQueryRunner({ agents: 3, threads: 2 });

    await expect(
      assertHistoricalDestructiveMigrationSafe(
        queryRunner,
        "WipeSeedData1774174000000",
        ["agents", "threads"],
        { NODE_ENV: "production" },
      ),
    ).rejects.toThrow(/non-empty tables: agents=3, threads=2/);
  });
});
