import { ASSET_BANK_CONNECTOR_MANIFEST } from "./asset-bank.connector";
import {
  AssetBankApiAdapter,
  AssetBankApiError,
} from "./asset-bank-api.adapter";

describe("AssetBankApiAdapter", () => {
  it("publishes read and mutation tools with dangerous-mode write access", () => {
    expect(
      ASSET_BANK_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["asset-bank.read", "asset-bank.manage"]);
    expect(
      ASSET_BANK_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions,
    ).toEqual([]);
  });

  it("pins requests to the stored site context and redacts content URLs", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: 1, contentUrl: "https://signed.example/file" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const result = await new AssetBankApiAdapter().request(
      "token",
      "https://example.assetbank.app/assetbank-example",
      { method: "GET", path: "/rest/assets/1", query: { include: "metadata" } },
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "https://example.assetbank.app/assetbank-example/rest/assets/1?include=metadata",
    );
    expect(result.data).toEqual({ id: 1, contentUrl: "[redacted]" });
    fetchMock.mockRestore();
  });

  it("blocks undocumented routes, signed URLs, and untrusted sites", async () => {
    const adapter = new AssetBankApiAdapter();
    await expect(
      adapter.request(
        "token",
        "https://example.assetbank.app/assetbank-example",
        { method: "POST", path: "/rest/sign-url", json: { url: "x" } },
      ),
    ).rejects.toBeInstanceOf(AssetBankApiError);
    await expect(
      adapter.request("token", "https://example.com/site", {
        method: "GET",
        path: "/rest/assets/1",
      }),
    ).rejects.toBeInstanceOf(AssetBankApiError);
    await expect(
      adapter.request(
        "token",
        "https://example.assetbank.app/assetbank-example",
        { method: "GET", path: "/rest/admin" },
      ),
    ).rejects.toBeInstanceOf(AssetBankApiError);
  });
});
