import { AhaApiAdapter, AhaApiError } from "./aha-api.adapter";
import { AHA_CONNECTOR_MANIFEST } from "./aha.connector";

describe("AhaApiAdapter", () => {
  const api = new AhaApiAdapter();
  afterEach(() => jest.restoreAllMocks());

  it("publishes Relay-owned OAuth with complete Safe and Dangerous policy", () => {
    expect(AHA_CONNECTOR_MANIFEST.auth.type).toBe("oauth2_authorization_code");
    expect(AHA_CONNECTOR_MANIFEST.auth.oauth?.pkce).toBe(false);
    expect(AHA_CONNECTOR_MANIFEST.auth.oauth?.supportsRefresh).toBe(false);
    expect(
      AHA_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["aha_manage"]);
    expect(
      AHA_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (item) => item.id,
      ),
    ).toEqual(["aha_read", "aha_manage"]);
  });

  it("routes bounded reads to the OAuth-bound account REST v1 origin", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ features: [] }), { status: 200 }),
      );
    await expect(
      api.read("token", "acme-roadmaps", {
        path: "/api/v1/features",
        query: { page: 2, fields: ["id", "name"] },
      }),
    ).resolves.toEqual({ features: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://acme-roadmaps.aha.io/api/v1/features?page=2&fields=id&fields=name",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer token",
    );
  });

  it("rejects another account, other versions, traversal, queries, and secrets", async () => {
    await expect(
      api.read("token", "acme.aha.io", { path: "/api/v1/features" }),
    ).rejects.toBeInstanceOf(AhaApiError);
    await expect(
      api.read("token", "acme", { path: "/api/v2/features" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      api.read("token", "acme", { path: "/api/v1/features/../ideas" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      api.read("token", "acme", { path: "/api/v1/features?page=2" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      api.manage("token", "acme", {
        method: "POST",
        path: "/api/v1/features",
        json: { accessToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("maps throttling to a provider-safe error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "slow down" }), {
        status: 429,
      }),
    );
    await expect(
      api.read("token", "acme", { path: "/api/v1/features" }),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
      message: "slow down",
    });
  });
});
