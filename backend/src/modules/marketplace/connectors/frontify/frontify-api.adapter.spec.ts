import { FRONTIFY_CONNECTOR_MANIFEST } from "./frontify.connector";
import { FrontifyApiAdapter, FrontifyApiError } from "./frontify-api.adapter";

describe("FrontifyApiAdapter", () => {
  it("publishes query and mutation tools with dangerous-mode write access", () => {
    expect(FRONTIFY_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "frontify.query",
      "frontify.mutate",
    ]);
    expect(
      FRONTIFY_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions,
    ).toEqual([]);
  });

  it("pins GraphQL requests to the stored account and redacts signed URLs", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              asset: { id: "a1", downloadUrl: "https://signed.example/secret" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const result = await new FrontifyApiAdapter().query(
      "token",
      "https://brand.frontify.com",
      {
        document: 'query Asset { asset(id: "a1") { id downloadUrl } }',
        operationName: "Asset",
      },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://brand.frontify.com/graphql",
    );
    expect(result).toEqual({
      data: { asset: { id: "a1", downloadUrl: "[redacted]" } },
    });
    fetchMock.mockRestore();
  });

  it("separates query and mutation surfaces and rejects untrusted domains", async () => {
    const adapter = new FrontifyApiAdapter();
    await expect(
      adapter.query("token", "https://brand.frontify.com", {
        document: "mutation Delete { deleteAsset(input: {}) { id } }",
      }),
    ).rejects.toBeInstanceOf(FrontifyApiError);
    await expect(
      adapter.query("token", "https://example.com", {
        document: "{ currentUser { id } }",
      }),
    ).rejects.toBeInstanceOf(FrontifyApiError);
  });
});
