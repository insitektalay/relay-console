import { GoogleVaultApiAdapter } from "./google-vault-api.adapter";
import {
  GOOGLE_VAULT_CONNECTOR_MANIFEST,
  GOOGLE_VAULT_SCOPES,
} from "./google-vault.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Google Vault connector", () => {
  it("uses the exact read-only Vault scope and approval-gates both tools", () => {
    expect(GOOGLE_VAULT_SCOPES).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/ediscovery.readonly",
    ]);
    expect(
      GOOGLE_VAULT_CONNECTOR_MANIFEST.tools.map((tool) => ({
        name: tool.name,
        approvalRequired: tool.approvalRequired,
      })),
    ).toEqual([
      { name: "googleVault.listMatters", approvalRequired: true },
      { name: "googleVault.getMatterOverview", approvalRequired: true },
    ]);
  });

  it("lists one bounded page and never follows Google's page token", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        matters: [
          {
            matterId: "matter_1",
            name: "Case Alpha",
            state: "OPEN",
            createTime: "2026-07-01T00:00:00Z",
            permissions: [{ accountId: "secret-user" }],
          },
        ],
        nextPageToken: "do-not-follow",
      }),
    );
    const result = await new GoogleVaultApiAdapter(requester).listMatters(
      "access-token",
      { state: "OPEN", maxResults: 10 },
    );
    const url = requester.mock.calls[0][0] as URL;
    expect(url.origin + url.pathname).toBe(
      "https://vault.googleapis.com/v1/matters",
    );
    expect(url.searchParams.get("pageSize")).toBe("10");
    expect(url.searchParams.get("view")).toBe("BASIC");
    expect(url.searchParams.get("pageToken")).toBeNull();
    expect(result).toEqual(
      expect.objectContaining({
        matters: [
          expect.objectContaining({
            matterId: "matter_1",
            name: "Case Alpha",
            state: "OPEN",
          }),
        ],
        nextPageTokenPresent: true,
        nextPageFollowed: false,
        providerRequestCount: 1,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("secret-user");
  });

  it("redacts identities, query terms, and export download material", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(
        json({ matterId: "matter_1", name: "Case Alpha", state: "OPEN" }),
      )
      .mockResolvedValueOnce(
        json({
          holds: [
            {
              holdId: "hold_1",
              name: "Preservation",
              corpus: "MAIL",
              accounts: [{ accountId: "secret-user" }],
              query: { terms: "privileged terms" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({
          exports: [
            {
              id: "export_1",
              name: "Production",
              status: "COMPLETED",
              cloudStorageSink: {
                files: [{ bucketName: "secret-bucket", objectName: "file.zip" }],
              },
              requester: { email: "admin@example.com" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({
          savedQueries: [
            {
              savedQueryId: "query_1",
              displayName: "Custodian search",
              query: { terms: "from:person@example.com" },
            },
          ],
        }),
      );
    const result = await new GoogleVaultApiAdapter(
      requester,
    ).getMatterOverview("access-token", {
      matterId: "matter_1",
      maxResultsPerResource: 5,
    });
    expect(requester).toHaveBeenCalledTimes(4);
    expect(result).toEqual(
      expect.objectContaining({
        holds: [
          expect.objectContaining({
            holdId: "hold_1",
            corpus: "MAIL",
          }),
        ],
        exports: [
          expect.objectContaining({
            id: "export_1",
            status: "COMPLETED",
            evidenceFilesReturned: false,
          }),
        ],
        savedQueries: [
          expect.objectContaining({
            savedQueryId: "query_1",
            queryTermsReturned: false,
          }),
        ],
        nextPageFollowed: false,
        providerRequestCount: 4,
      }),
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret-user");
    expect(serialized).not.toContain("privileged terms");
    expect(serialized).not.toContain("secret-bucket");
    expect(serialized).not.toContain("admin@example.com");
    expect(serialized).not.toContain("from:person@example.com");
  });

  it("maps authorization failures without returning Google error bodies", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(json({ error: { message: "sensitive detail" } }, 403));
    await expect(
      new GoogleVaultApiAdapter(requester).listMatters("access-token", {}),
    ).rejects.toMatchObject({
      code: "insufficient_scope",
      statusCode: 403,
      message: "Google Vault rejected the bounded read-only request.",
    });
  });
});
