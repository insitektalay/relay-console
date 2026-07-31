import { CognismApiAdapter, CognismApiError } from "./cognism-api.adapter";

describe("CognismApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins an exact, first-page account preview and minimizes results", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          totalResults: 1,
          results: [
            {
              id: "account-1",
              name: "Cognism",
              domain: "cognism.com",
              industry: "Software",
              officePhoneNumbers: ["private"],
              technology: ["private"],
              linkedinUrl: "https://linkedin.example/company",
            },
          ],
          lastReturnedKey: "blocked-cursor",
        }),
        { status: 200 },
      ),
    );

    await expect(
      new CognismApiAdapter().read(
        { apiKey: "customer-api-key" },
        "accounts.search",
        { query: "cognism.com", matchType: "domain" },
      ),
    ).resolves.toEqual({
      totalResults: 1,
      results: [
        {
          id: "account-1",
          name: "Cognism",
          domain: "cognism.com",
          industry: "Software",
        },
      ],
      hasMore: false,
    });
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://app.cognism.com/api/search/account/search?indexSize=20&lastReturnedKey=",
      ),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer customer-api-key",
        }),
        redirect: "error",
      }),
    );
    expect(JSON.parse(String(request?.body))).toEqual({
      domains: ["cognism.com"],
      accountSearchOptions: {
        match_exact_account_name: true,
        match_exact_domain: true,
        show_max_events: 0,
      },
    });
  });

  it("blocks broad operations, arbitrary inputs, and non-hostname domains", async () => {
    const adapter = new CognismApiAdapter();
    expect(() =>
      adapter.read({ apiKey: "key" }, "contacts.redeem", {
        query: "Cognism",
      }),
    ).toThrow(CognismApiError);
    expect(() =>
      adapter.read({ apiKey: "key" }, "accounts.search", {
        query: "Cognism",
        cursor: "next",
      } as never),
    ).toThrow("pinned account-preview inputs");
    expect(() =>
      adapter.read({ apiKey: "key" }, "accounts.search", {
        query: "https://cognism.com/path",
        matchType: "domain",
      }),
    ).toThrow("plain DNS hostname");
  });
});
