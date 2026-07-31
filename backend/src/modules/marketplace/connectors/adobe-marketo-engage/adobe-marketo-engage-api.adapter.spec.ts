import {
  AdobeMarketoEngageApiAdapter,
  AdobeMarketoEngageApiError,
} from "./adobe-marketo-engage-api.adapter";

const credentials = {
  instanceOrigin: "https://123-abc-456.mktorest.com",
  clientId: "client-id",
  clientSecret: "client-secret",
};

describe("AdobeMarketoEngageApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses form-post client credentials and a bounded bearer program read", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "access-token", expires_in: 3599 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            moreResult: true,
            result: [
              {
                id: 42,
                name: "Launch",
                type: "Default",
                channel: "Operational",
                status: "on",
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-02T00:00:00Z",
                url: "https://private.example/asset",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    await expect(
      new AdobeMarketoEngageApiAdapter().read(credentials, {
        operation: "programs.list",
        offset: 0,
        maxReturn: 20,
      }),
    ).resolves.toEqual({
      programs: [
        {
          id: "42",
          name: "Launch",
          type: "Default",
          channel: "Operational",
          status: "on",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      ],
      offset: 0,
      maxReturn: 20,
      moreResult: true,
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://123-abc-456.mktorest.com/identity/oauth/token",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
      "/rest/asset/v1/programs.json?offset=0&maxReturn=20",
    );
    expect(fetchSpy.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("rejects arbitrary origins, operations, and oversized pages", async () => {
    const adapter = new AdobeMarketoEngageApiAdapter();
    await expect(
      adapter.read(
        { ...credentials, instanceOrigin: "https://example.com" },
        {
          operation: "programs.list",
        },
      ),
    ).rejects.toBeInstanceOf(AdobeMarketoEngageApiError);
    await expect(
      adapter.read(credentials, { operation: "leads.list" }),
    ).rejects.toBeInstanceOf(AdobeMarketoEngageApiError);
    await expect(
      adapter.read(credentials, { operation: "programs.list", maxReturn: 21 }),
    ).rejects.toBeInstanceOf(AdobeMarketoEngageApiError);
  });
});
