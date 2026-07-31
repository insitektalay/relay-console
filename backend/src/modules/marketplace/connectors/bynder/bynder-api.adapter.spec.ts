import { BYNDER_CONNECTOR_MANIFEST } from "./bynder.connector";
import { BynderApiAdapter, BynderApiError } from "./bynder-api.adapter";

describe("BynderApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("publishes read and mutation tools with Safe and Dangerous policy", () => {
    expect(BYNDER_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "bynder.read",
      "bynder.manage",
    ]);
    expect(
      BYNDER_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["bynder_manage"]);
    expect(
      BYNDER_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions,
    ).toEqual([]);
  });
  it("pins requests to the stored portal and redacts signed URLs", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "asset", downloadUrl: "secret" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const result = await new BynderApiAdapter().request(
      "token",
      "https://acme.bynder.com",
      { method: "GET", path: "/api/v4/media/", query: { limit: 1 } },
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "acme.bynder.com",
        pathname: "/api/v4/media/",
      }),
      expect.objectContaining({ redirect: "error" }),
    );
    expect((result.data as any).downloadUrl).toBe("[redacted]");
  });
  it("rejects alternate origins and credential-bearing input", async () => {
    const adapter = new BynderApiAdapter();
    await expect(
      adapter.request("token", "https://acme.bynder.com", {
        method: "GET",
        path: "https://evil.invalid/api/v4/media/",
      }),
    ).rejects.toBeInstanceOf(BynderApiError);
    await expect(
      adapter.request("token", "https://acme.bynder.com", {
        method: "POST",
        path: "/api/v4/media/",
        json: { accessToken: "leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.request("token", "https://attacker.example", {
        method: "GET",
        path: "/api/v4/media/",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
