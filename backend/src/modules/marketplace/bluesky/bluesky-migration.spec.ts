import { AddMarketplaceOAuthProviderSession0500000000000 } from "../../../migrations/050_add_marketplace_oauth_provider_session";

describe("Bluesky OAuth provider-session migration", () => {
  it("adds and removes only encrypted provider-session envelope columns", async () => {
    const statements: string[] = [];
    const runner = {
      query: jest.fn(async (sql: string) => {
        statements.push(sql.replace(/\s+/g, " ").trim());
      }),
    };
    const migration = new AddMarketplaceOAuthProviderSession0500000000000();
    await migration.up(runner as never);
    await migration.down(runner as never);
    expect(statements[0]).toContain('ADD COLUMN IF NOT EXISTS "providerSessionCiphertext" TEXT');
    expect(statements[0]).toContain('"providerSessionIv" VARCHAR(128)');
    expect(statements[0]).toContain('"providerSessionAuthTag" VARCHAR(128)');
    expect(statements[0]).toContain('"providerSessionKeyVersion" VARCHAR(32)');
    expect(statements[0]).not.toMatch(/accessToken|refreshToken|privateJwk|codeVerifier/);
    expect(statements[1]).toContain('DROP COLUMN IF EXISTS "providerSessionCiphertext"');
  });
});
