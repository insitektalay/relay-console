import { GoogleSearchConsoleApiAdapter, GoogleSearchConsoleApiError } from "./google-search-console-api.adapter";
import { GOOGLE_SEARCH_CONSOLE_CONNECTOR_MANIFEST, GOOGLE_SEARCH_CONSOLE_SCOPES } from "./google-search-console.connector";

describe("Google Search Console connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses only webmasters.readonly and exposes the six retained read wrappers", () => {
    expect(GOOGLE_SEARCH_CONSOLE_SCOPES).toEqual(["https://www.googleapis.com/auth/webmasters.readonly"]);
    expect(GOOGLE_SEARCH_CONSOLE_CONNECTOR_MANIFEST.tools.map((tool) => [tool.functionName, tool.action, tool.approvalRequired])).toEqual([
      ["google_search_console_properties_list", "read", false],
      ["google_search_console_property_get", "read", false],
      ["google_search_console_search_analytics_query", "read", false],
      ["google_search_console_url_inspect", "read", false],
      ["google_search_console_sitemaps_list", "read", false],
      ["google_search_console_sitemap_get", "read", false],
    ]);
  });

  it("runs one bounded Search Analytics query and maps dimension keys", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ rows: [{ keys: ["relay", "GBR"], clicks: 4, impressions: 80, ctr: 0.05, position: 3.2 }], metadata: { excluded: true } }), { status: 200 }));
    const result = await new GoogleSearchConsoleApiAdapter().querySearchAnalytics("token", { siteUrl: "sc-domain:example.com", startDate: "2026-06-01", endDate: "2026-06-28", dimensions: ["query", "country"], rowLimit: 10 });
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/searchAnalytics/query");
    expect(JSON.parse(String(request.body))).toEqual({ startDate: "2026-06-01", endDate: "2026-06-28", dimensions: ["query", "country"], type: "web", aggregationType: "auto", rowLimit: 10, startRow: 0 });
    expect(result).toMatchObject({ semanticReadContract: "google-search-console-search-analytics-v1", automaticPagination: false, rows: [{ dimensions: { query: "relay", country: "GBR" }, clicks: 4 }] });
    expect(JSON.stringify(result)).not.toContain("metadata");
  });

  it("returns only safe indexed URL fields and keeps the URL inside the bound property", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: "Indexed", googleCanonical: "https://docs.example.com/a", crawledAs: "excluded" }, mobileUsabilityResult: { verdict: "PASS", issues: [] }, richResultsResult: { verdict: "NEUTRAL", detectedItems: [{ private: true }] } } }), { status: 200 }));
    const result = await new GoogleSearchConsoleApiAdapter().inspectUrl("token", { siteUrl: "sc-domain:example.com", inspectionUrl: "https://docs.example.com/a", languageCode: "en-GB" });
    expect(result).toMatchObject({ inspection: { verdict: "PASS", coverageState: "Indexed", mobileUsabilityVerdict: "PASS", richResultsVerdict: "NEUTRAL" }, rawProviderToolExposure: false });
    expect(JSON.stringify(result)).not.toContain("crawledAs");
    expect(JSON.stringify(result)).not.toContain("detectedItems");
  });

  it("rejects out-of-property URLs and overlong date ranges before provider access", async () => {
    const fetch = jest.spyOn(global, "fetch");
    await expect(new GoogleSearchConsoleApiAdapter().inspectUrl("token", { siteUrl: "https://example.com/docs/", inspectionUrl: "https://example.com/admin" })).rejects.toBeInstanceOf(GoogleSearchConsoleApiError);
    await expect(new GoogleSearchConsoleApiAdapter().querySearchAnalytics("token", { siteUrl: "sc-domain:example.com", startDate: "2026-05-01", endDate: "2026-06-01" })).rejects.toBeInstanceOf(GoogleSearchConsoleApiError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("caps property and sitemap lists without following pagination", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ siteEntry: Array.from({ length: 30 }, (_, index) => ({ siteUrl: `sc-domain:site${index}.example`, permissionLevel: "siteOwner" })) }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ sitemap: Array.from({ length: 30 }, (_, index) => ({ path: `https://example.com/sitemap-${index}.xml`, type: "sitemap" })) }), { status: 200 }));
    const adapter = new GoogleSearchConsoleApiAdapter();
    const properties = await adapter.listProperties("token", { maxResults: 25 });
    const sitemaps = await adapter.listSitemaps("token", { siteUrl: "https://example.com/", maxResults: 25 });
    expect(properties.properties).toHaveLength(25);
    expect(properties.truncated).toBe(true);
    expect(sitemaps.sitemaps).toHaveLength(25);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
