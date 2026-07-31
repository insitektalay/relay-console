import { ReadMeApiAdapter, ReadMeApiError } from "./readme-api.adapter";

describe("ReadMeApiAdapter", () => {
  const api = new ReadMeApiAdapter();

  afterEach(() => jest.restoreAllMocks());

  it("uses only api.readme.com v2 with bearer authorization", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { subdomain: "relay" } }), { status: 200 }),
    );
    await api.getProject({ apiKey: "rdme_secret" });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.readme.com/v2/projects/me",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization,
    ).toBe("Bearer rdme_secret");
  });

  it("bounds search pagination to the documented maximum", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await api.search(
      { apiKey: "key" },
      { query: "OAuth", page: 999, perPage: 999 },
    );
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("per_page")).toBe("50");
    expect(url.searchParams.get("page")).toBe("20");
    expect(url.searchParams.get("query")).toBe("OAuth");
  });

  it("encodes bounded image uploads as multipart data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ data: { url: "https://example.com/a.png" } }), { status: 201 }));
    await api.uploadImage(
      { apiKey: "key" },
      {
        filename: "pixel.png",
        mimeType: "image/png",
        fileBase64: Buffer.from("png-bytes").toString("base64"),
        resizeHeight: 100,
      },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.readme.com/v2/images?resize_height=100",
    );
    expect(fetchMock.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
  });

  it("rejects traversal and credential-bearing fields before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      api.request(
        { apiKey: "key" },
        { method: "GET", path: "/v2/branches/../projects/me" },
      ),
    ).rejects.toMatchObject<Partial<ReadMeApiError>>({ code: "provider_validation_error" });
    await expect(
      api.request(
        { apiKey: "key" },
        { method: "POST", path: "/v2/changelogs", json: { apiKey: "leak" } },
      ),
    ).rejects.toMatchObject<Partial<ReadMeApiError>>({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redacts API-key tokens returned by key-management endpoints", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { token: "rdme_leak", label: "CI" } }), {
        status: 200,
      }),
    );
    await expect(
      api.request(
        { apiKey: "key" },
        { method: "GET", path: "/v2/projects/relay/apikeys/key_1" },
      ),
    ).resolves.toEqual({ data: { token: "[redacted]", label: "CI" } });
  });
});
