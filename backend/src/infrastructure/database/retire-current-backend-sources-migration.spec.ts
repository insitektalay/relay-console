import type { QueryRunner } from "typeorm";
import { RetireCurrentBackendMarketplaceSources1785179000067 } from "../../migrations/067_retire_current_backend_marketplace_sources";

describe("retire current backend marketplace sources migration", () => {
  it("blocks unsafe apps and scrubs every persisted Railway path surface", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new RetireCurrentBackendMarketplaceSources1785179000067();

    await migration.up({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("= 'current_backend'");
    expect(sql).toContain('"filePath" = NULL');
    expect(sql).toContain("\"generatedPack\" = '{}'::jsonb");
    expect(sql).toContain("\"publicationStatus\" = 'blocked'");
    expect(sql).toContain(
      "\"repoPath\" = 'migration-required://paired-runtime-host'",
    );
    expect(sql).toContain(
      "\"agentOperableStatus\" = 'source_host_migration_required'",
    );
    expect(sql).toContain("'retired_current_backend'");
    expect(sql).toContain("- 'runtimeProfile'");
    expect(sql).toContain("- 'openApiSpecPath'");
  });

  it("does not restore the vulnerable source type on rollback", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new RetireCurrentBackendMarketplaceSources1785179000067();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query).not.toHaveBeenCalled();
  });
});
