import {
  CloudflareApiAdapter,
  CloudflareApiError,
} from "./cloudflare-api.adapter";

const credentials = {
  accessToken: "secret",
  accountId: "a23e105f4ecef8ad9ca31a8372d0c333",
  zoneId: "023e105f4ecef8ad9ca31a8372d0c353",
};

describe("CloudflareApiAdapter", () => {
  it("filters the first zone page to the exact account and caps results", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify({
            result: [
              {
                id: credentials.zoneId,
                name: "example.com",
                account: { id: credentials.accountId, name: "Example" },
              },
            ],
            result_info: { total_pages: 2 },
          }),
          { status: 200 },
        ),
    );
    const adapter = new CloudflareApiAdapter(requester);

    const result = await adapter.listZones(credentials, { limit: 3 });

    const url = String(requester.mock.calls[0][0]);
    expect(url).toContain("https://api.cloudflare.com/client/v4/zones?");
    expect(url).toContain("account.id=a23e105f4ecef8ad9ca31a8372d0c333");
    expect(url).toContain("page=1");
    expect(url).toContain("per_page=5");
    expect(result).toMatchObject({
      returnedCount: 1,
      more: true,
      automaticPagination: false,
    });
  });

  it("rejects a zone returned from another account", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify({
            result: {
              id: credentials.zoneId,
              account: { id: "b23e105f4ecef8ad9ca31a8372d0c333" },
            },
          }),
          { status: 200 },
        ),
    );
    const adapter = new CloudflareApiAdapter(requester);

    await expect(adapter.getZone(credentials)).rejects.toMatchObject<
      Partial<CloudflareApiError>
    >({
      code: "cloudflare_account_binding_mismatch",
    });
  });

  it("uses the fixed aggregate traffic query and never accepts GraphQL input", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              viewer: {
                zones: [
                  {
                    httpRequestsAdaptiveGroups: [
                      { count: 4, sum: { edgeResponseBytes: 100, visits: 2 } },
                    ],
                  },
                ],
              },
            },
          }),
          { status: 200 },
        ),
    );
    const adapter = new CloudflareApiAdapter(requester);

    const result = await adapter.readZoneTraffic(credentials, { hours: 12 });

    const [, init] = requester.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(requester.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/graphql",
    );
    expect(body.query).toContain("httpRequestsAdaptiveGroups(limit: 1000");
    expect(body.variables.zoneTag).toBe(credentials.zoneId);
    expect(result).toMatchObject({
      requests: 4,
      edgeResponseBytes: 100,
      visits: 2,
      windowHours: 12,
      rawLogsReturned: false,
    });
  });

  it("rejects invalid identifiers before network access", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>();
    const adapter = new CloudflareApiAdapter(requester);

    await expect(
      adapter.getZone({ ...credentials, zoneId: "../../graphql" }),
    ).rejects.toMatchObject<Partial<CloudflareApiError>>({
      code: "cloudflare_zone_id_invalid",
    });
    expect(requester).not.toHaveBeenCalled();
  });
});
