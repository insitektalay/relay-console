import { PCloudApiAdapter, PCloudApiError } from "./pcloud-api.adapter";

describe("PCloudApiAdapter", () => {
  const adapter = new PCloudApiAdapter();

  afterEach(() => jest.restoreAllMocks());

  it("accepts only the two documented regional API authorities", () => {
    expect(adapter.normalizeApiOrigin("https://api.pcloud.com")).toBe(
      "https://api.pcloud.com",
    );
    expect(adapter.normalizeApiOrigin("https://eapi.pcloud.com")).toBe(
      "https://eapi.pcloud.com",
    );
    expect(() =>
      adapter.normalizeApiOrigin("https://api.pcloud.com.evil.test"),
    ).toThrow(PCloudApiError);
  });

  it("keeps reads on the bound regional host and redacts token-shaped output", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ result: 0, metadata: [], access_token: "leak" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    const result = await adapter.read(
      "secret",
      "https://eapi.pcloud.com",
      "listfolder",
      { parameters: { folderid: 0 } },
    );
    expect(fetchMock.mock.calls[0][0].toString()).toContain(
      "https://eapi.pcloud.com/listfolder?folderid=0",
    );
    expect((result as Record<string, unknown>).access_token).toBe("[REDACTED]");
  });

  it("rejects undocumented and credential-shaped parameters", async () => {
    expect(() =>
      adapter.read("secret", "https://api.pcloud.com", "listfolder", {
        parameters: { destination: "https://evil.test" },
      }),
    ).toThrow(PCloudApiError);
    expect(() =>
      adapter.read("secret", "https://api.pcloud.com", "listfolder", {
        parameters: { access_token: "leak" },
      }),
    ).toThrow(PCloudApiError);
  });

  it("requires approval-class operations to use the write tool", async () => {
    expect(() =>
      adapter.read("secret", "https://api.pcloud.com", "deletefile", {
        parameters: { fileid: 1 },
      }),
    ).toThrow(PCloudApiError);
  });

  it("treats non-zero pCloud results as safe provider errors", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ result: 2003, error: "Access denied." }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    await expect(
      adapter.read("secret", "https://api.pcloud.com", "userinfo", {}),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
  });
});
