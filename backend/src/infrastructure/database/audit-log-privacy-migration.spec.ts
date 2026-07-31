import { MinimizeAuthAuditData1785187000073 } from "../../migrations/073_minimize_auth_audit_data";

describe("auth audit privacy migration", () => {
  it("irreversibly clears legacy identifiers and constrains retained fields", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new MinimizeAuthAuditData1785187000073();

    await migration.up({ query } as any);

    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(migration.name).toBe("MinimizeAuthAuditData1785187000073");
    expect(sql).toContain(`WHEN "actorType" = 'anonymous' THEN NULL`);
    expect(sql).toContain(`"ipAddress" = NULL`);
    expect(sql).toContain(`'reason'`);
    expect(sql).toContain(`regexp_replace`);
    expect(sql).toContain(`"userAgent" TYPE varchar(160)`);
    expect(sql).toContain(`raw IP addresses are prohibited`);
    expect(sql).not.toMatch(/create_hmac|AUDIT_IDENTIFIER_HASH_SECRET/i);
  });

  it("does not attempt to restore discarded personal data on rollback", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new MinimizeAuthAuditData1785187000073();

    await migration.down({ query } as any);

    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain(`ALTER COLUMN "userAgent" TYPE varchar`);
    expect(sql).not.toMatch(/UPDATE|INSERT|actorId.*=/i);
  });
});
