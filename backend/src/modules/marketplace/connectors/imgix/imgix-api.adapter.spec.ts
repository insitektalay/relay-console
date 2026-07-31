import { IMGIX_CONNECTOR_MANIFEST } from "./imgix.connector";
import { ImgixApiAdapter, ImgixApiError } from "./imgix-api.adapter";

describe("ImgixApiAdapter", () => {
  const credentials = { apiKey: "imgix-management-test-key" };

  afterEach(() => jest.restoreAllMocks());

  it("advertises the complete bounded read and mutation surface", () => {
    expect(IMGIX_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "imgix.read",
      "imgix.manage",
    ]);
    const readSchema = IMGIX_CONNECTOR_MANIFEST.tools[0].inputSchema as any;
    const manageSchema = IMGIX_CONNECTOR_MANIFEST.tools[1].inputSchema as any;
    expect(readSchema.properties.operation.enum).toEqual([
      "list_sources",
      "get_source",
      "list_assets",
      "get_asset",
      "get_upload_session",
      "list_reports",
      "get_report",
    ]);
    expect(manageSchema.properties.operation.enum).toHaveLength(12);
  });

  it("pins reads to the Imgix Management API and injects bearer credentials", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );
    await new ImgixApiAdapter().read(credentials, "list_assets", {
      sourceId: "source_123",
      query: { "page[limit]": 20, "filter[media_kind]": "IMAGE" },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.imgix.com/api/v1/sources/source_123/assets?page%5Blimit%5D=20&filter%5Bmedia_kind%5D=IMAGE",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer imgix-management-test-key",
    );
  });

  it("builds documented publish and purge bodies without accepting arbitrary paths", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ data: { id: "ok" } }), { status: 200 }),
      );
    const adapter = new ImgixApiAdapter();
    await adapter.manage(credentials, "publish_asset", {
      sourceId: "source_123",
      url: "https://assets.example.imgix.net/a.jpg",
    });
    await adapter.manage(credentials, "purge_asset", {
      sourceId: "source_123",
      url: "https://assets.example.imgix.net/a.jpg",
      subImage: true,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.imgix.com/api/v1/publish",
    );
    expect(
      JSON.parse(
        Buffer.from(fetchMock.mock.calls[1][1]?.body as Uint8Array).toString(),
      ),
    ).toEqual({
      data: {
        type: "purges",
        attributes: {
          url: "https://assets.example.imgix.net/a.jpg",
          sub_image: true,
          source_id: "source_123",
        },
      },
    });
  });

  it("rejects secret-bearing source payloads and malformed origin paths", async () => {
    const adapter = new ImgixApiAdapter();
    expect(() =>
      adapter.manage(credentials, "create_source", {
        attributes: { deployment: { s3_secret_key: "nope" } },
      }),
    ).toThrow(ImgixApiError);
    expect(() =>
      adapter.read(credentials, "get_asset", {
        sourceId: "source_123",
        originPath: "../secret",
      }),
    ).toThrow(ImgixApiError);
  });

  it("redacts provider-returned signing material", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            attributes: { secure_url_token: "secret", name: "source" },
          },
        }),
        { status: 200 },
      ),
    );
    const result = (await new ImgixApiAdapter().read(
      credentials,
      "get_source",
      { sourceId: "source_123" },
    )) as any;
    expect(result.data.data.attributes).toEqual({
      secure_url_token: "[redacted]",
      name: "source",
    });
  });
});
