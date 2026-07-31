import { ConfluenceApiAdapter } from "./confluence-api.adapter";
import { CONFLUENCE_CONNECTOR_MANIFEST } from "./confluence.connector";

describe("ConfluenceApiAdapter", () => {
  const api = new ConfluenceApiAdapter();
  afterEach(() => jest.restoreAllMocks());
  it("publishes one-click OAuth with complete Safe and Dangerous policy", () => {
    expect(CONFLUENCE_CONNECTOR_MANIFEST.auth.type).toBe(
      "oauth2_authorization_code",
    );
    expect(
      CONFLUENCE_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["confluence_write", "confluence_admin"]);
    expect(
      CONFLUENCE_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (item) => item.id,
      ),
    ).toEqual(["confluence_read", "confluence_write", "confluence_admin"]);
    expect(
      CONFLUENCE_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions,
    ).toEqual([]);
    expect(
      CONFLUENCE_CONNECTOR_MANIFEST.approvalProfiles[1].blockedActions.map(
        (item) => item.id,
      ),
    ).toEqual([
      "confluence_secret_exposure",
      "confluence_other_site",
      "confluence_unsupported_api",
      "confluence_unbounded_transfer",
    ]);
  });
  it("routes bounded reads through the bound cloud ID", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );
    await expect(
      api.listSpaces("token", "cloud-123", { limit: 25 }),
    ).resolves.toEqual({ results: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.atlassian.com/ex/confluence/cloud-123/wiki/api/v2/spaces?limit=25",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer token",
    );
  });
  it("rejects cross-product, traversal, and credential-bearing requests", async () => {
    await expect(
      api.request("token", "cloud-123", {
        method: "GET",
        path: "/jira/api/3/issues",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      api.request("token", "cloud-123", {
        method: "GET",
        path: "/wiki/api/v2/../spaces",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      api.request("token", "cloud-123", {
        method: "POST",
        path: "/wiki/api/v2/pages",
        json: { accessToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
  it("maps throttling to a provider-safe error", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: "slow", access_token: "secret" }),
          { status: 429 },
        ),
      );
    await expect(api.listPages("token", "cloud-123", {})).rejects.toMatchObject(
      { code: "provider_rate_limited", statusCode: 429 },
    );
  });
});
