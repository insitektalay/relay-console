import { TermlyApiAdapter, TermlyApiError } from "./termly-api.adapter";

const credentials = {
  publicKey: "public_test",
  privateKey: "private_test",
  accountId: "acct_123",
  websiteId: "web_456",
};

describe("TermlyApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("signs one exact website query and strips keys, contacts, snippets, and visitor data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                id: "web_456",
                name: "Example",
                url: "https://example.com",
                scan_period: "weekly",
                cookie_count: 12,
                unclassified_cookie_count: 2,
                consent_count: 99,
                report: { created_at: "2026-07-01T00:00:00Z" },
                api_key: "wordpress-secret",
                company: { email: "private@example.com" },
                code_snippet: { banner: "secret-script" },
                visitors: [{ uuid: "private-uuid" }],
              },
            ],
            errors: [],
            paging: {},
          }),
          { status: 200 },
        ),
      );
    const result = await new TermlyApiAdapter().getWebsiteSummary(credentials);
    expect(result.website).toEqual({
      id: "web_456",
      name: "Example",
      url: "https://example.com",
      scanPeriod: "weekly",
      cookieCount: 12,
      unclassifiedCookieCount: 2,
      consentCount: 99,
      lastReportAt: "2026-07-01T00:00:00Z",
    });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://api.termly.io/v1/websites");
    expect(decodeURIComponent(url.searchParams.get("query")!)).toBe(
      JSON.stringify([{ account_id: "acct_123", ids: ["web_456"] }]),
    );
    expect((init.headers as Record<string, string>).Authorization).toMatch(
      /^TermlyV1, PublicKey=public_test, Signature=[a-f0-9]{64}$/,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /secret|private@example|uuid|code_snippet|api_key/i,
    );
  });

  it("rejects an unbounded website identifier before a provider call", async () => {
    await expect(
      new TermlyApiAdapter().getBannerSummary({
        ...credentials,
        websiteId: "*",
      }),
    ).rejects.toMatchObject<Partial<TermlyApiError>>({
      code: "provider_validation_error",
    });
  });
});
