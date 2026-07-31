import { OsanoApiAdapter, OsanoApiError } from "./osano-api.adapter";

describe("OsanoApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses the fixed Osano host and returns minimized bounded configs", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                configId: "cfg_1",
                name: "Main",
                mode: "production",
                domains: ["private.example"],
                created: "2026-01-01",
                updated: "2026-01-02",
              },
            ],
            next: "cursor",
          }),
          { status: 200 },
        ),
      );
    await expect(
      new OsanoApiAdapter().read(
        { apiKey: "key" },
        { operation: "cookieConsentConfigs.list", limit: 20 },
      ),
    ).resolves.toEqual({
      items: [
        {
          id: "cfg_1",
          name: "Main",
          mode: "production",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-02",
        },
      ],
      next: "cursor",
      limit: 20,
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.osano.com/v1/cookie-consent/configs?limit=20",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        headers: expect.objectContaining({ "x-osano-api-key": "key" }),
      }),
    );
  });
  it("rejects arbitrary operations and oversized pages", async () => {
    const adapter = new OsanoApiAdapter();
    await expect(
      adapter.read({ apiKey: "key" }, { operation: "subjectRights.list" }),
    ).rejects.toBeInstanceOf(OsanoApiError);
    await expect(
      adapter.read(
        { apiKey: "key" },
        { operation: "cookieConsentConfigs.list", limit: 21 },
      ),
    ).rejects.toBeInstanceOf(OsanoApiError);
  });
});
