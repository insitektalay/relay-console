import { RetireSupersededBridgePairings1786172400082 } from "../../migrations/082_retire_superseded_bridge_pairings";

describe("superseded bridge pairings migration", () => {
  it("keeps the newest active runtime pairing and revokes older duplicates", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new RetireSupersededBridgePairings1786172400082();

    await migration.up({ query } as any);

    expect(migration.name).toBe(
      "RetireSupersededBridgePairings1786172400082",
    );
    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0][0];
    expect(sql).toContain(
      'PARTITION BY "workspaceId", label, "runtimeType", "hostType"',
    );
    expect(sql).toContain('WHERE status = \'active\'');
    expect(sql).toContain('"runtimeType" IS NOT NULL');
    expect(sql).toContain('"hostType" IS NOT NULL');
    expect(sql).toContain('"lastSeenAt" DESC NULLS LAST');
    expect(sql).toContain("pairing_rank > 1");
    expect(sql).toContain("status = 'revoked'");
    expect(sql).toContain('"revokedAt" = COALESCE');
  });

  it("does not restore superseded credentials during rollback", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new RetireSupersededBridgePairings1786172400082();

    await migration.down({ query } as any);

    expect(query).not.toHaveBeenCalled();
  });
});
