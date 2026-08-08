import {
  CRAFT_MANAGE_OPERATIONS,
  CRAFT_READ_OPERATIONS,
  CraftApiAdapter,
  CraftApiError,
} from "./craft-api.adapter";
import { CRAFT_CONNECTOR_MANIFEST } from "./craft.connector";
import { MarketplaceConnectorRegistry } from "../connector-registry";

const credentials = {
  apiUrl: "https://connect.craft.do/links/example_connection_123/api/v1",
};

const legacyCredentials = {
  apiUrl: "https://connect.craft.do/link/example_connection_123/api/v1",
};

describe("Craft connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses hosted MCP OAuth and retains the encrypted legacy API surface", () => {
    expect(new MarketplaceConnectorRegistry().get("craft")).toBe(
      CRAFT_CONNECTOR_MANIFEST,
    );
    expect(CRAFT_CONNECTOR_MANIFEST.auth.type).toBe(
      "oauth2_authorization_code",
    );
    expect(CRAFT_CONNECTOR_MANIFEST.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://mcp.craft.do/my/auth/authorize",
        tokenUrl: "https://mcp.craft.do/my/auth/token",
        userInfoUrl: "https://mcp.craft.do/my/mcp",
        pkce: true,
        supportsRefresh: true,
      }),
    );
    expect(CRAFT_CONNECTOR_MANIFEST.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "CRAFT_API_URL",
          secret: true,
          storedIn: "encrypted_secret",
        }),
      ]),
    );
    expect(CRAFT_READ_OPERATIONS).toHaveLength(9);
    expect(CRAFT_MANAGE_OPERATIONS).toHaveLength(16);
    expect(CRAFT_CONNECTOR_MANIFEST.auth.credentialSchema[0]).toEqual(
      expect.objectContaining({
        requiredForAuthTypes: ["customer_scoped_api_url", "api_key"],
      }),
    );
    expect(
      CRAFT_CONNECTOR_MANIFEST.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("pins the secret authority and validates it with one bounded folder read", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: "unsorted" }] }), {
        status: 200,
      }),
    );
    const result = await new CraftApiAdapter().health(credentials);
    expect(result).toMatchObject({ folderCount: 1, providerRequestCount: 1 });
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe(
      `${credentials.apiUrl}/folders`,
    );
    expect(JSON.stringify(result)).not.toContain("example_connection_123");
  });

  it("retains the documented singular connection URL for backward compatibility", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      );
    await expect(
      new CraftApiAdapter().health(legacyCredentials),
    ).resolves.toMatchObject({ providerRequestCount: 1 });
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe(
      `${legacyCredentials.apiUrl}/folders`,
    );
  });

  it("maps exact read and manage operations without exposing a raw path", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{ id: "doc-1" }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{ id: "task-1" }] }), {
          status: 200,
        }),
      );
    const adapter = new CraftApiAdapter();
    await adapter.callRead(credentials, {
      operation: "search_documents",
      query: { include: "planning" },
    });
    await adapter.callManage(credentials, {
      operation: "add_tasks",
      body: { tasks: [{ markdown: "Review", location: { type: "inbox" } }] },
    });
    expect(fetchMock.mock.calls.map((call) => call[0].toString())).toEqual([
      `${credentials.apiUrl}/documents/search?include=planning`,
      `${credentials.apiUrl}/tasks`,
    ]);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("POST");
  });

  it("rejects untrusted authorities and malformed connection paths", async () => {
    const adapter = new CraftApiAdapter();
    const invalidUrls = [
      "https://example.com/links/example_connection_123/api/v1",
      "http://connect.craft.do/links/example_connection_123/api/v1",
      "https://user:password@connect.craft.do/links/example_connection_123/api/v1",
      "https://connect.craft.do:444/links/example_connection_123/api/v1",
      "https://connect.craft.do/links/example_connection_123/api/v1?query=1",
      "https://connect.craft.do/links/example_connection_123/api/v1#fragment",
      "https://connect.craft.do/links/short/api/v1",
      `https://connect.craft.do/links/${"a".repeat(201)}/api/v1`,
      "https://connect.craft.do/links/example_connection_123/api/v2",
      "https://connect.craft.do/other/example_connection_123/api/v1",
    ];
    for (const apiUrl of invalidUrls) {
      await expect(adapter.health({ apiUrl })).rejects.toMatchObject<
        Partial<CraftApiError>
      >({ code: "provider_validation_error" });
    }
  });

  it("rejects cross-policy operations and credential fields", async () => {
    const adapter = new CraftApiAdapter();
    expect(() =>
      adapter.callRead(credentials, { operation: "delete_documents" }),
    ).toThrow("Craft operation is not supported by this Relay action.");
    await expect(
      adapter.callManage(credentials, {
        operation: "add_tasks",
        body: { apiUrl: "must-not-pass" },
      }),
    ).rejects.toMatchObject<Partial<CraftApiError>>({ code: "policy_blocked" });
  });
});
