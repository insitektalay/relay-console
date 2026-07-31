import { CANTO_CONNECTOR_MANIFEST } from "./canto.connector";
import { CantoApiAdapter, CantoApiError } from "./canto-api.adapter";

describe("CantoApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("publishes Safe and Dangerous read and mutation tools", () => {
    expect(CANTO_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "canto.read",
      "canto.manage",
    ]);
    expect(
      CANTO_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["canto_manage"]);
    expect(
      CANTO_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions,
    ).toEqual([]);
  });
  it("pins requests to the stored Canto account and redacts signed URLs", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "asset", downloadUrl: "secret" }), {
          status: 200,
        }),
      );
    const result = await new CantoApiAdapter().request(
      "token",
      "https://acme.canto.com",
      { method: "GET", path: "/api/v1/search", query: { limit: 1 } },
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "acme.canto.com",
        pathname: "/api/v1/search",
      }),
      expect.objectContaining({ redirect: "error" }),
    );
    expect((result.data as any).downloadUrl).toBe("[redacted]");
  });
  it("rejects alternate origins and credential-bearing input", async () => {
    const adapter = new CantoApiAdapter();
    await expect(
      adapter.request("token", "https://acme.canto.com", {
        method: "GET",
        path: "https://evil.invalid/api/v1/user",
      }),
    ).rejects.toBeInstanceOf(CantoApiError);
    await expect(
      adapter.request("token", "https://acme.canto.com", {
        method: "POST",
        path: "/api/v1/keyword",
        json: { accessToken: "leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
