import { AddBetaAccessWindow1785270600076 } from "../../migrations/076_add_beta_access_window";

describe("beta access migration", () => {
  it("backfills a 60-day access window for accounts that already redeemed an invite", async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new AddBetaAccessWindow1785270600076();

    await migration.up({ query } as any);

    expect(migration.name).toBe("AddBetaAccessWindow1785270600076");
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain(
      'ADD COLUMN "betaAccessEndsAt" timestamptz',
    );
    expect(query.mock.calls[1][0]).toContain(
      '"invite"."lastUsedAt" + INTERVAL \'60 days\'',
    );
    expect(query.mock.calls[1][0]).toContain(
      '"invite"."lastUsedByUserId" = "user"."id"',
    );
  });
});
