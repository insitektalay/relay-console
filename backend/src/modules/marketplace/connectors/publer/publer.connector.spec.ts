import { PublerApiAdapter, PublerApiError } from "./publer-api.adapter";
import { PUBLER_CONNECTOR_MANIFEST } from "./publer.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Publer connector", () => {
  const credentials = {
    apiKey: "secret-api-key",
    workspaceId: "61a7c2e4f9e8c3b2d1e0f9a8",
  };

  it("exposes only two approval-gated bounded reads", () => {
    expect(PUBLER_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(PUBLER_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "publer.listWorkspaces",
      "publer.listAccounts",
    ]);
    expect(
      PUBLER_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("validates the exact workspace with fixed origin and Bearer-API", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(
        json([{ id: credentials.workspaceId, name: "Private workspace" }]),
      );
    await expect(
      new PublerApiAdapter(requester).health(credentials),
    ).resolves.toEqual({
      apiOrigin: "https://app.publer.com/api/v1",
      workspaceId: credentials.workspaceId,
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://app.publer.com/api/v1/workspaces",
    );
    expect(requester.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer-API secret-api-key",
    );
    expect(requester.mock.calls[0][1].headers["Publer-Workspace-Id"]).toBe(
      undefined,
    );
  });

  it("lists workspace IDs without owner, member, name, picture, or plan", async () => {
    const requester = jest.fn().mockResolvedValue(
      json([
        {
          id: credentials.workspaceId,
          name: "Private workspace",
          owner: { email: "owner@example.test" },
          members: [{ name: "Private member" }],
          plan: "business",
          picture: "https://example.test/private.png",
        },
      ]),
    );
    const result = await new PublerApiAdapter(requester).listWorkspaces(
      credentials,
    );
    expect(result.workspaces).toEqual([
      { workspaceId: credentials.workspaceId },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /Private|owner|example|business/,
    );
  });

  it("lists bounded account structure without social identity or content", async () => {
    const requester = jest.fn().mockResolvedValue(
      json([
        {
          id: "63c675b54e299e9cf2b667ea",
          provider: "bluesky",
          type: "profile",
          name: "Private account",
          social_id: "private-social-id",
          picture: "https://example.test/avatar.png",
        },
      ]),
    );
    const result = await new PublerApiAdapter(requester).listAccounts(
      credentials,
    );
    expect(result.accounts).toEqual([
      {
        accountId: "63c675b54e299e9cf2b667ea",
        provider: "bluesky",
        type: "profile",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/Private|social|example/);
    expect(requester.mock.calls[0][1].headers["Publer-Workspace-Id"]).toBe(
      credentials.workspaceId,
    );
  });

  it("rejects invalid IDs and cross-workspace access", async () => {
    await expect(
      new PublerApiAdapter(jest.fn()).listAccounts({
        ...credentials,
        workspaceId: "../other",
      }),
    ).rejects.toBeInstanceOf(PublerApiError);
    const crossWorkspace = new PublerApiAdapter(
      jest.fn().mockResolvedValue(json([{ id: "other" }])),
    );
    await expect(crossWorkspace.health(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
    });
  });
});
