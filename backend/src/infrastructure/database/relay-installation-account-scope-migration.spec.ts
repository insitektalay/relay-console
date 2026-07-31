import { ScopeRelayInstallationsToAccount1785270600077 } from "../../migrations/077_scope_relay_installations_to_account";

describe("Relay installation account-scope migration", () => {
  it("allows one physical Mac installation identity per Relay account", async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    const migration = new ScopeRelayInstallationsToAccount1785270600077();

    await migration.up({ query } as any);

    expect(migration.name).toBe(
      "ScopeRelayInstallationsToAccount1785270600077",
    );
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain(
      'UNIQUE ("deploymentId", "installationPublicId")',
    );
    expect(query.mock.calls[1][0]).toContain(
      'UNIQUE ("deploymentId", "userId", "installationPublicId")',
    );
  });
});
