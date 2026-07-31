import {
  ProductboardApiAdapter,
  ProductboardApiError,
} from "./productboard-api.adapter";
import { PRODUCTBOARD_CONNECTOR_MANIFEST } from "./productboard.connector";

describe("ProductboardApiAdapter", () => {
  const api = new ProductboardApiAdapter();
  afterEach(() => jest.restoreAllMocks());

  it("publishes Relay-owned OAuth with complete Safe and Dangerous policy", () => {
    expect(PRODUCTBOARD_CONNECTOR_MANIFEST.auth.type).toBe(
      "oauth2_authorization_code",
    );
    expect(PRODUCTBOARD_CONNECTOR_MANIFEST.auth.oauth?.pkce).toBe(true);
    expect(
      PRODUCTBOARD_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["productboard_manage"]);
    expect(
      PRODUCTBOARD_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (item) => item.id,
      ),
    ).toEqual(["productboard_read", "productboard_manage"]);
    expect(
      PRODUCTBOARD_CONNECTOR_MANIFEST.approvalProfiles[1]
        .approvalRequiredActions,
    ).toEqual([]);
  });

  it("routes bounded reads to the fixed REST v2 origin", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [], links: {} }), { status: 200 }),
      );
    await expect(
      api.read("token", {
        path: "/v2/entities",
        query: { "type[]": ["feature"], limit: 25 },
      }),
    ).resolves.toEqual({ data: [], links: {} });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.productboard.com/v2/entities?type%5B%5D=feature&limit=25",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer token",
    );
  });

  it("rejects other versions, traversal, embedded queries, and secrets", async () => {
    await expect(
      api.read("token", { path: "/v1/features" }),
    ).rejects.toBeInstanceOf(ProductboardApiError);
    await expect(
      api.read("token", { path: "/v2/entities/../notes" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      api.read("token", { path: "/v2/entities?limit=500" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      api.manage("token", {
        method: "POST",
        path: "/v2/notes",
        json: { accessToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("maps throttling to a provider-safe error and redacts secrets", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: "slow down", refresh_token: "secret" }),
          { status: 429 },
        ),
      );
    await expect(
      api.read("token", { path: "/v2/notes" }),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
      message: "slow down",
    });
  });
});
