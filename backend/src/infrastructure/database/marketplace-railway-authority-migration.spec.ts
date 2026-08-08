import { RequireRailwayMarketplaceAuthority1786110000000 } from "../../migrations/081_require_railway_marketplace_authority";

describe("Railway-only Marketplace authority migration", () => {
  it("requires reconnection and removes Swift from the database constraint", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await new RequireRailwayMarketplaceAuthority1786110000000().up({
      query,
    } as any);

    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain(`"executionAuthority" = 'railway'`);
    expect(sql).toContain(`WHERE "executionAuthority" = 'swift'`);
    expect(sql).toContain("RAILWAY_RECONNECT_REQUIRED");
    expect(sql).toContain("'credentialsMigrated', false");
    expect(sql).toContain(`CHECK ("executionAuthority" = 'railway')`);
  });
});
