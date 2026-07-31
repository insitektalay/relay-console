import { ClearbitApiAdapter, ClearbitApiError } from "./clearbit-api.adapter";

describe("ClearbitApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins one versioned domain lookup and minimizes company data", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "company-1",
          name: "Clearbit",
          legalName: "APIHub Inc",
          domain: "clearbit.com",
          description: "Company intelligence",
          category: { sector: "Technology", industry: "Software" },
          metrics: { employees: 200, employeesRange: "101-250" },
          tags: ["B2B", "SaaS"],
          site: { phoneNumbers: ["private"], emailAddresses: ["private"] },
          geo: { streetNumber: "private" },
          tech: ["private"],
        }),
        { status: 200 },
      ),
    );
    await expect(
      new ClearbitApiAdapter().read(
        { apiKey: "legacy-api-key" },
        "companies.find",
        { domain: "Clearbit.COM" },
      ),
    ).resolves.toEqual({
      found: true,
      company: {
        id: "company-1",
        name: "Clearbit",
        legalName: "APIHub Inc",
        domain: "clearbit.com",
        description: "Company intelligence",
        category: { sector: "Technology", industry: "Software" },
        metrics: { employees: 200, employeesRange: "101-250" },
        tags: ["B2B", "SaaS"],
      },
    });
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://company.clearbit.com/v2/companies/find?domain=clearbit.com",
      ),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer legacy-api-key",
          "Clearbit-Version": "2022-12-15",
        }),
        redirect: "error",
      }),
    );
  });

  it("blocks broader operations, arbitrary inputs, and URL-shaped domains", () => {
    const adapter = new ClearbitApiAdapter();
    expect(() =>
      adapter.read({ apiKey: "key" }, "people.find", {
        domain: "clearbit.com",
      }),
    ).toThrow(ClearbitApiError);
    expect(() =>
      adapter.read({ apiKey: "key" }, "companies.find", {
        domain: "https://clearbit.com/path",
      }),
    ).toThrow("plain DNS hostname");
    expect(() =>
      adapter.read({ apiKey: "key" }, "companies.find", {
        domain: "clearbit.com",
        webhook: "https://example.test",
      } as never),
    ).toThrow("pinned domain lookup input");
  });
});
