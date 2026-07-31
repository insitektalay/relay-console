import { ZoomInfoApiAdapter, ZoomInfoApiError } from "./zoominfo-api.adapter";

describe("ZoomInfoApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("exchanges client credentials and pins a first-page company search", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-token",
            token_type: "Bearer",
            scope: "api:data:company",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "344589814",
                type: "Company",
                attributes: {
                  name: "ZoomInfo",
                  website: "www.zoominfo.com",
                  city: "Vancouver",
                  logo: "https://private.example/logo",
                  employeeCount: 3500,
                },
              },
            ],
            links: { next: "/gtm/data/v1/companies/search?page[number]=2" },
            meta: { totalResults: 1 },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new ZoomInfoApiAdapter().read(
        { clientId: "client-id", clientSecret: "client-secret" },
        "companies.search",
        { companyName: "ZoomInfo" },
      ),
    ).resolves.toEqual({
      totalResults: 1,
      results: [
        {
          id: "344589814",
          type: "Company",
          attributes: {
            name: "ZoomInfo",
            website: "www.zoominfo.com",
            city: "Vancouver",
          },
        },
      ],
      hasMore: false,
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://api.zoominfo.com/gtm/oauth/v1/token",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
        redirect: "error",
      }),
    );
    const [url, request] = fetchSpy.mock.calls[1]!;
    expect(url).toEqual(
      new URL(
        "https://api.zoominfo.com/gtm/data/v1/companies/search?page[number]=1&page[size]=20&sort=name",
      ),
    );
    expect(JSON.parse(String(request?.body))).toEqual({
      data: {
        type: "CompanySearch",
        attributes: {
          companyName: "ZoomInfo",
          excludeDefunctCompanies: true,
        },
      },
    });
  });

  it("blocks broader operations and arbitrary search inputs", async () => {
    const adapter = new ZoomInfoApiAdapter();
    await expect(
      adapter.read(
        { clientId: "id", clientSecret: "secret" },
        "contacts.search",
        { companyName: "ZoomInfo" },
      ),
    ).rejects.toThrow(ZoomInfoApiError);
    await expect(
      adapter.read(
        { clientId: "id", clientSecret: "secret" },
        "companies.search",
        { companyName: "ZoomInfo", page: 2 } as never,
      ),
    ).rejects.toThrow("pinned company-name search input");
  });
});
