import { OneTrustApiAdapter, OneTrustApiError } from "./onetrust-api.adapter";
const credentials = {
  tenantHost: "trial.onetrust.com",
  clientId: "client-id",
  clientSecret: "client-secret",
  domainId: "12345678-1234-1234-1234-123456789abc",
  scanId: "87654321-4321-4321-4321-cba987654321",
};
describe("OneTrustApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("exchanges credentials server-side and strips private branding content", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "derived-token", expires_in: 3600 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "PUBLISHED",
            templateId: "tpl_1",
            templateName: "Standard",
            defaultLanguage: "en",
            publishedAt: "2026-07-01T00:00:00Z",
            customHtml: "private html",
            customCss: "private css",
            vendors: [{ name: "private" }],
          }),
          { status: 200 },
        ),
      );
    const result = await new OneTrustApiAdapter().getDomainBrandingSummary(
      credentials,
    );
    expect(result.domain).toEqual({
      id: credentials.domainId,
      brandingAttributesAvailable: true,
      privateBrandingContentIncluded: false,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://trial.onetrust.com/api/access/v1/oauth/token",
    );
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      `/api/cmp/v1/domains/${credentials.domainId}/branding-attributes`,
    );
    expect(
      (fetchMock.mock.calls[1][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer derived-token");
    expect(JSON.stringify(result)).not.toMatch(
      /private html|private css|vendors/i,
    );
  });

  it("returns only aggregate counts for the exact selected scan", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "derived-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            totalCookies: 12,
            tags: { count: 4, items: [{ url: "private" }] },
            totalForms: 2,
            otherCount: 1,
            cookies: [{ name: "private-cookie" }],
          }),
          { status: 200 },
        ),
      );
    const result = await new OneTrustApiAdapter().getScanSummary(credentials);
    expect(result.scan).toMatchObject({
      domainId: credentials.domainId,
      scanId: credentials.scanId,
      status: "COMPLETED",
      cookieCount: 12,
      tagCount: 4,
      formCount: 2,
      otherCount: 1,
      detailedFindingsIncluded: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/private-cookie|private/i);
  });
  it("rejects a non-OneTrust tenant before a provider call", async () => {
    await expect(
      new OneTrustApiAdapter().getScanSummary({
        ...credentials,
        tenantHost: "attacker.example",
      }),
    ).rejects.toMatchObject<Partial<OneTrustApiError>>({
      code: "provider_validation_error",
    });
  });
});
