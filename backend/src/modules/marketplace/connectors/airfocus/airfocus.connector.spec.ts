import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  AirfocusApiAdapter,
  AirfocusApiError,
  type AirfocusCredentials,
} from "./airfocus-api.adapter";

describe("Airfocus connector", () => {
  const credentials: AirfocusCredentials = {
    apiToken: "airfocus-secret-token",
    region: "eu",
  };
  afterEach(() => jest.restoreAllMocks());

  it("registers seven approval-gated fixed Airfocus tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("airfocus")?.tools).toHaveLength(7);
    expect(
      registry.get("airfocus")?.approvalProfiles[0].approvalRequiredActions,
    ).toHaveLength(7);
  });

  it("pins bounded workspace reads to the EU origin and Bearer token", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Roadmap",
              description: "hidden",
              _embedded: {
                currentPermission: "write",
                permissions: { secret: "full" },
              },
            },
          ],
          totalItems: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await new AirfocusApiAdapter().listWorkspaces(credentials, {
      keyword: "road",
      limit: 2,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://app.airfocus.com/api/workspaces/search?offset=0&limit=2",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${credentials.apiToken}`,
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      archived: false,
      filter: { type: "name:contain", text: "road" },
    });
    expect(result.rows[0]).not.toHaveProperty("description");
    expect(result.rows[0]).not.toHaveProperty("permissions");
  });

  it("uses only the documented US origin when selected", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          name: "US",
        }),
        { status: 200 },
      ),
    );
    await new AirfocusApiAdapter().getWorkspace(
      { ...credentials, region: "us" },
      { workspaceId: "11111111-1111-4111-8111-111111111111" },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://app.us.airfocus.com/api/workspaces/11111111-1111-4111-8111-111111111111",
    );
  });

  it("creates only a minimal unarchived item", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "22222222-2222-4222-8222-222222222222",
          workspaceId: "11111111-1111-4111-8111-111111111111",
          name: "New item",
          archived: false,
        }),
        { status: 200 },
      ),
    );
    await new AirfocusApiAdapter().createItem(credentials, {
      workspaceId: "11111111-1111-4111-8111-111111111111",
      name: "New item",
      description: "ignored",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "New item",
      archived: false,
    });
  });

  it("allowlists collision-checked item updates", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "22222222-2222-4222-8222-222222222222",
            workspaceId: "11111111-1111-4111-8111-111111111111",
            name: "Old",
            archived: false,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "22222222-2222-4222-8222-222222222222",
            workspaceId: "11111111-1111-4111-8111-111111111111",
            name: "New",
            archived: true,
          }),
          { status: 200 },
        ),
      );
    await new AirfocusApiAdapter().updateItem(credentials, {
      workspaceId: "11111111-1111-4111-8111-111111111111",
      itemId: "22222222-2222-4222-8222-222222222222",
      expectedName: "Old",
      name: "New",
      archived: true,
      fields: { hidden: true },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual([
      { op: "replace", path: "/name", value: "New" },
      { op: "replace", path: "/archived", value: true },
    ]);
  });

  it("rejects arbitrary regions, identifiers and stale deletion names", async () => {
    const adapter = new AirfocusApiAdapter();
    await expect(
      adapter.getItem(
        { ...credentials, region: "other" },
        { workspaceId: "bad", itemId: "bad" },
      ),
    ).rejects.toBeInstanceOf(AirfocusApiError);
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "22222222-2222-4222-8222-222222222222",
          workspaceId: "11111111-1111-4111-8111-111111111111",
          name: "Current",
        }),
        { status: 200 },
      ),
    );
    await expect(
      adapter.deleteItem(credentials, {
        workspaceId: "11111111-1111-4111-8111-111111111111",
        itemId: "22222222-2222-4222-8222-222222222222",
        expectedName: "Stale",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("returns secret-safe provider errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: credentials.apiToken }), {
        status: 401,
      }),
    );
    const promise = new AirfocusApiAdapter().listWorkspaces(credentials, {});
    await expect(promise).rejects.toThrow(
      "Airfocus rejected the personal access token.",
    );
    await expect(promise).rejects.not.toThrow(credentials.apiToken);
  });
});
