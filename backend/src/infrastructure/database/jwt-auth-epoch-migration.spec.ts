import { InvalidateLegacyJwtSessions1785270000075 } from "../../migrations/075_invalidate_legacy_jwt_sessions";

describe("JWT authentication epoch migration", () => {
  it("revokes every active web/mobile session and clears the legacy refresh slot", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new InvalidateLegacyJwtSessions1785270000075();

    await migration.up({ query } as any);

    expect(migration.name).toBe("InvalidateLegacyJwtSessions1785270000075");
    expect(query).toHaveBeenCalledTimes(3);
    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain('UPDATE "web_sessions"');
    expect(sql).toContain('UPDATE "mobile_sessions"');
    expect(sql).toContain('SET "revokedAt" = NOW()');
    expect(sql).toContain('UPDATE "users"');
    expect(sql).toContain('SET "refreshToken" = NULL');
  });

  it("is forward-only and cannot resurrect invalidated sessions", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new InvalidateLegacyJwtSessions1785270000075();

    await migration.down({ query } as any);

    expect(query).not.toHaveBeenCalled();
  });
});
