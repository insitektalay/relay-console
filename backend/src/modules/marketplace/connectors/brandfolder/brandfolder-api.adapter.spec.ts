import { BRANDFOLDER_CONNECTOR_MANIFEST } from "./brandfolder.connector";
import {
  BRANDFOLDER_OPENAPI_OPERATION_COUNT,
  BRANDFOLDER_ROUTE_METHODS,
  BrandfolderApiAdapter,
  BrandfolderApiError,
} from "./brandfolder-api.adapter";

describe("BrandfolderApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes the complete 73-operation V4 surface under Safe and Dangerous policy", () => {
    expect(BRANDFOLDER_OPENAPI_OPERATION_COUNT).toBe(73);
    expect(
      BRANDFOLDER_ROUTE_METHODS.reduce(
        (count, [, methods]) => count + methods.length,
        0,
      ),
    ).toBe(69);
    expect(
      BRANDFOLDER_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["brandfolder.read", "brandfolder.manage", "brandfolder.upload"]);
    expect(
      BRANDFOLDER_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["brandfolder_manage", "brandfolder_upload"]);
    expect(
      BRANDFOLDER_CONNECTOR_MANIFEST.approvalProfiles[1]
        .approvalRequiredActions,
    ).toEqual([]);
  });

  it("keeps signed storage capabilities inside the bounded upload workflow", async () => {
    const request = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            upload_url:
              "https://storage.googleapis.com/relay-brandfolder/upload?signature=secret",
            object_url:
              "https://storage.googleapis.com/relay-brandfolder/object.png",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "asset-1" } }), {
          status: 201,
        }),
      );
    const result = await new BrandfolderApiAdapter().uploadAsset(
      { apiKey: "customer-key" },
      {
        destinationType: "brandfolder",
        destinationId: "bf-1",
        sectionId: "section-1",
        name: "Logo",
        fileName: "logo.png",
        contentBase64: Buffer.from("png").toString("base64"),
        contentType: "image/png",
      },
    );
    expect(request.mock.calls[1][0]).toEqual(
      expect.objectContaining({ hostname: "storage.googleapis.com" }),
    );
    expect(request.mock.calls[1][1]).not.toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expect.anything() }),
      }),
    );
    expect(request.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        pathname: "/api/v4/brandfolders/bf-1/assets",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("signature=secret");
  });

  it("pins requests to Brandfolder V4, preserves pagination, and redacts upload capabilities", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          meta: { current_page: 1, next_page: 2, total_count: 3 },
          upload_url: "signed-secret",
        }),
        { status: 200 },
      ),
    );
    const result = await new BrandfolderApiAdapter().request(
      { apiKey: "customer-key" },
      { method: "GET", path: "/brandfolders", query: { per: 25 } },
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "brandfolder.com",
        pathname: "/api/v4/brandfolders",
        search: "?per=25",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer customer-key",
        }),
        redirect: "error",
      }),
    );
    expect(result.pagination).toEqual({
      currentPage: 1,
      nextPage: 2,
      totalCount: 3,
    });
    expect((result.data as any).upload_url).toBe("[redacted]");
  });

  it("rejects undocumented method-route pairs and credential-bearing bodies", async () => {
    const adapter = new BrandfolderApiAdapter();
    await expect(
      adapter.request(
        { apiKey: "key" },
        { method: "DELETE", path: "/organizations/example" },
      ),
    ).rejects.toBeInstanceOf(BrandfolderApiError);
    await expect(
      adapter.request(
        { apiKey: "key" },
        {
          method: "POST",
          path: "/webhooks",
          json: { authorization: "leak" },
        },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
