import {
  GOOGLE_MERCHANT_CENTER_FIXED_REPORT_BODY,
  GoogleMerchantCenterApiAdapter,
  GoogleMerchantCenterApiError,
} from "./google-merchant-center-api.adapter";
import {
  GOOGLE_MERCHANT_CENTER_CONNECTOR_MANIFEST,
  GOOGLE_MERCHANT_CENTER_SCOPES,
} from "./google-merchant-center.connector";

describe("Google Merchant Center connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses exact content scope and exposes only four stable-v1 reads", () => {
    expect(GOOGLE_MERCHANT_CENTER_SCOPES).toEqual([
      "https://www.googleapis.com/auth/content",
    ]);
    expect(
      GOOGLE_MERCHANT_CENTER_CONNECTOR_MANIFEST.tools.map((tool) => [
        tool.functionName,
        tool.action,
        tool.approvalRequired,
      ]),
    ).toEqual([
      ["google_merchant_center_accounts_list", "read", false],
      ["google_merchant_center_products_list", "read", false],
      ["google_merchant_center_product_get", "read", false],
      ["google_merchant_center_product_issues_summary", "read", false],
    ]);
  });
  it("lists at most fifty products and excludes custom attributes", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          products: Array.from({ length: 55 }, (_, i) => ({
            name: `accounts/123/products/en~GB~sku-${i}`,
            offerId: `sku-${i}`,
            productAttributes: {
              title: `Product ${i}`,
              price: { amountMicros: "79000000", currencyCode: "GBP" },
              customValue: "excluded",
            },
            productStatus: {
              destinationStatuses: [
                {
                  reportingContext: "SHOPPING_ADS",
                  approvedCountries: ["GB"],
                },
              ],
              itemLevelIssues: [],
            },
            customAttributes: [{ name: "secret" }],
          })),
          nextPageToken: "excluded",
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleMerchantCenterApiAdapter().listProducts(
      "token",
      { accountName: "accounts/123" },
    );
    expect(result).toMatchObject({
      resultCount: 50,
      truncated: true,
      nextPageFollowed: false,
    });
    expect(result.products[0]).toMatchObject({
      price: { amountMicros: "79000000", currencyCode: "GBP" },
      customAttributesReturned: false,
    });
    expect(result.products).toHaveLength(50);
    expect(JSON.stringify(result)).not.toContain("customValue");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it("pins the exact fixed report body and returns bounded issue semantics", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              productView: {
                id: "sku-1",
                title: "Blue jacket",
                aggregatedReportingContextStatus: "NOT_ELIGIBLE_OR_DISAPPROVED",
                itemIssues: [
                  {
                    type: { code: "missing_shipping" },
                    aggregatedSeverity: "ERROR",
                    resolution: "MERCHANT_ACTION",
                    description: "Add shipping",
                    documentation: "https://support.google.com/merchants/",
                  },
                ],
              },
            },
          ],
          nextPageToken: "not-followed",
        }),
        { status: 200 },
      ),
    );
    const result =
      await new GoogleMerchantCenterApiAdapter().reviewProductIssues("token", {
        accountName: "accounts/123",
      });
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe(
      "https://merchantapi.googleapis.com/reports/v1/accounts/123/reports:search",
    );
    expect(JSON.parse(String(request.body))).toEqual(
      GOOGLE_MERCHANT_CENTER_FIXED_REPORT_BODY,
    );
    expect(result).toMatchObject({
      queryMode: "fixed_product_issues_v1",
      nextPageFollowed: false,
      rows: [
        {
          offerId: "sku-1",
          itemIssues: [{ code: "missing_shipping", severity: "ERROR" }],
        },
      ],
      arbitraryQueryEnabled: false,
      v1BetaEnabled: false,
      contentApiEnabled: false,
    });
  });
  it("reads one product only under the bound account", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "accounts/123/products/ZW5-VVN-c2t1LzEyMw",
          offerId: "sku/123",
          productAttributes: { title: "Encoded product" },
          productStatus: {},
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleMerchantCenterApiAdapter().getProduct(
      "token",
      {
        accountName: "accounts/123",
        productName: "accounts/123/products/ZW5-VVN-c2t1LzEyMw",
      },
    );
    expect(result).toMatchObject({
      product: { offerId: "sku/123", title: "Encoded product" },
      stableV1Only: true,
      explicitAccountOnly: true,
    });
  });
  it("rejects cross-account and query-shaped product resources before provider access", async () => {
    const fetch = jest.spyOn(global, "fetch");
    await expect(
      new GoogleMerchantCenterApiAdapter().getProduct("token", {
        accountName: "accounts/123",
        productName: "accounts/456/products/en~GB~sku?fields=all",
      }),
    ).rejects.toBeInstanceOf(GoogleMerchantCenterApiError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
