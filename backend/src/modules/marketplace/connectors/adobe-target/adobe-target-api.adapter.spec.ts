import {
  AdobeTargetApiAdapter,
  AdobeTargetApiError,
} from "./adobe-target-api.adapter";

const credentials = {
  tenant: "relay-tenant",
  clientId: "client-id",
  clientSecret: "client-secret",
  scopes: "openid,AdobeID,target_sdk",
};

describe("AdobeTargetApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses Adobe server-to-server OAuth and a bounded tenant activity read", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "access-token", expires_in: 86399 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total: 1,
            activities: [
              {
                id: 42,
                name: "Homepage experiment",
                type: "ab",
                state: "approved",
                priority: 5,
                modifiedAt: "2026-01-02T00:00:00Z",
                workspace: "1234567",
                experiences: [{ private: "not returned" }],
              },
            ],
          }),
          { status: 200 },
        ),
      );
    await expect(
      new AdobeTargetApiAdapter().read(credentials, {
        operation: "activities.list",
        offset: 0,
        limit: 20,
      }),
    ).resolves.toEqual({
      activities: [
        {
          id: "42",
          name: "Homepage experiment",
          type: "ab",
          state: "approved",
          priority: 5,
          startsAt: null,
          endsAt: null,
          createdAt: null,
          modifiedAt: "2026-01-02T00:00:00Z",
          workspace: "1234567",
        },
      ],
      offset: 0,
      limit: 20,
      total: 1,
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://ims-na1.adobelogin.com/ims/token/v3",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
    expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
      "https://mc.adobe.io/relay-tenant/target/activities/?limit=20&offset=0",
    );
    expect(fetchSpy.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/vnd.adobe.target.v3+json",
          Authorization: "Bearer access-token",
          "x-api-key": "client-id",
        }),
      }),
    );
  });

  it("rejects tenant URLs, arbitrary operations, and oversized pages", async () => {
    const adapter = new AdobeTargetApiAdapter();
    await expect(
      adapter.read(
        { ...credentials, tenant: "https://mc.adobe.io/tenant" },
        { operation: "activities.list" },
      ),
    ).rejects.toBeInstanceOf(AdobeTargetApiError);
    await expect(
      adapter.read(credentials, { operation: "activities.update" }),
    ).rejects.toBeInstanceOf(AdobeTargetApiError);
    await expect(
      adapter.read(credentials, { operation: "activities.list", limit: 21 }),
    ).rejects.toBeInstanceOf(AdobeTargetApiError);
  });
});
