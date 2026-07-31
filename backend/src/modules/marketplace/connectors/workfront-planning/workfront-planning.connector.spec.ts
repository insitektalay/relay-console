import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  WorkfrontPlanningApiAdapter,
  WorkfrontPlanningApiError,
  type WorkfrontPlanningCredentials,
} from "./workfront-planning-api.adapter";

describe("Workfront Planning connector", () => {
  const credentials: WorkfrontPlanningCredentials = {
    clientId: "synthetic-client-id",
    clientSecret: "synthetic-client-secret",
    imsOrgId: "synthetic@AdobeOrg",
    scope: "openid,workfront.planning",
    customerHostname: "relay-synthetic.my.workfront.com",
  };

  afterEach(() => jest.restoreAllMocks());

  function tokenResponse() {
    return new Response(
      JSON.stringify({
        access_token: "synthetic-access-token",
        token_type: "bearer",
        expires_in: 3600,
      }),
      { status: 200 },
    );
  }

  it("registers four fixed approval-gated read tools", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("workfront-planning")?.tools).toHaveLength(4);
    expect(
      registry.get("workfront-planning")?.approvalProfiles[0]
        .approvalRequiredActions,
    ).toHaveLength(4);
  });

  it("mints a server token and pins bounded reads to the selected tenant", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [
              {
                id: "Ws123",
                name: "Campaign planning",
                description: "private",
                createdBy: { id: "private", name: "Private Person" },
              },
            ],
            cursor: { hasMore: false },
          }),
          { status: 200 },
        ),
      );
    const result = await new WorkfrontPlanningApiAdapter().listWorkspaces(
      credentials,
      { limit: 2 },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://ims-na1.adobelogin.com/ims/token/v3",
    );
    const tokenBody = new URLSearchParams(
      String(fetchMock.mock.calls[0][1]?.body),
    );
    expect(tokenBody.get("grant_type")).toBe("client_credentials");
    expect(tokenBody.get("client_secret")).toBe(credentials.clientSecret);
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://relay-synthetic.my.workfront.com/maestro/api/v2/workspaces?limit=2",
    );
    const headers = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer synthetic-access-token");
    expect(headers["x-api-key"]).toBe(credentials.clientId);
    expect(headers["x-gw-ims-org-id"]).toBe(credentials.imsOrgId);
    expect(result.rows[0]).toMatchObject({
      id: "Ws123",
      name: "Campaign planning",
    });
    expect(result.rows[0]).not.toHaveProperty("description");
    expect(result.rows[0]).not.toHaveProperty("createdBy");
  });

  it("bounds and redacts record-type lists", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [
              {
                id: "Rt123",
                name: "Campaign",
                workspaceId: "Ws123",
                description: "private",
                createdBy: { id: "private", name: "Private Person" },
              },
            ],
            cursor: { hasMore: true, nextCursor: "private-cursor" },
          }),
          { status: 200 },
        ),
      );
    const result = await new WorkfrontPlanningApiAdapter().listRecordTypes(
      credentials,
      { workspaceId: "Ws123", limit: 1 },
    );
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "/maestro/api/v2/workspaces/Ws123/record-types?limit=1",
    );
    expect(result.truncated).toBe(true);
    expect(result.rows[0]).toEqual({
      id: "Rt123",
      name: "Campaign",
      workspaceId: "Ws123",
      createdAt: null,
      updatedAt: null,
    });
  });

  it("rejects arbitrary origins before making a request", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new WorkfrontPlanningApiAdapter().listWorkspaces(
        { ...credentials, customerHostname: "attacker.example.com" },
        {},
      ),
    ).rejects.toBeInstanceOf(WorkfrontPlanningApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns secret-safe IMS errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error_description: credentials.clientSecret }), {
        status: 401,
      }),
    );
    const promise = new WorkfrontPlanningApiAdapter().listWorkspaces(
      credentials,
      {},
    );
    await expect(promise).rejects.toThrow(
      "Adobe IMS rejected the server-to-server credential.",
    );
    await expect(promise).rejects.not.toThrow(credentials.clientSecret);
  });
});
