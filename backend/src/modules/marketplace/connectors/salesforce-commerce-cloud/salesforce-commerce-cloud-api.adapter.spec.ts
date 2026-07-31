import {
  SalesforceCommerceCloudApiAdapter,
  SalesforceCommerceCloudApiError,
} from "./salesforce-commerce-cloud-api.adapter";

const credentials = {
  shortCode: "kv7kzm78",
  organizationId: "f_ecom_test",
  siteId: "RefArch",
  clientId: "12345678-1234-4234-8234-123456789abc",
  clientSecret: "client-secret",
  productId: "product-1",
  categoryId: "category-1",
};
const jwt = (scopes: string[]) =>
  `header.${Buffer.from(JSON.stringify({ scp: scopes })).toString("base64url")}.signature`;

describe("SalesforceCommerceCloudApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("binds a private guest token and product read to the selected site", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: jwt([
              "sfcc.shopper-products",
              "sfcc.shopper-categories",
            ]),
            token_type: "Bearer",
            expires_in: 1800,
            refresh_token: "private",
            usid: "private",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "product-1",
            name: "Trail Shoe",
            brand: "Acme",
            online: true,
            searchable: true,
            price: 99,
            images: [{ link: "private" }],
            longDescription: "private",
          }),
          { status: 200 },
        ),
      );
    const result =
      await new SalesforceCommerceCloudApiAdapter().getProductSummary(
        credentials,
      );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://kv7kzm78.api.commercecloud.salesforce.com/shopper/auth/v1/organizations/f_ecom_test/oauth2/token?grant_type=client_credentials&channel_id=RefArch",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toMatch(/^Basic /);
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://kv7kzm78.api.commercecloud.salesforce.com/product/shopper-products/v1/organizations/f_ecom_test/products/product-1?siteId=RefArch",
    );
    expect(result.product).toEqual({
      id: "product-1",
      name: "Trail Shoe",
      brand: "Acme",
      online: true,
      searchable: true,
      privateCommerceDataIncluded: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/price|images|description/i);
  });
  it("reuses the token and strips category response details", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: jwt([
              "sfcc.shopper-categories",
              "sfcc.shopper-products",
            ]),
            token_type: "Bearer",
            expires_in: 1800,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "product-1" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "category-1",
            name: "Shoes",
            online: true,
            parentCategoryId: "root",
            categories: [{ id: "private" }],
            pageDescription: "private",
          }),
          { status: 200 },
        ),
      );
    const adapter = new SalesforceCommerceCloudApiAdapter();
    await adapter.getProductSummary(credentials);
    const result = await adapter.getCategorySummary(credentials);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.category).toEqual({
      id: "category-1",
      name: "Shoes",
      online: true,
      parentCategoryId: "root",
      privateCommerceDataIncluded: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/categories|description/i);
  });
  it("rejects a SLAS token with any broader scope", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: jwt([
              "sfcc.shopper-products",
              "sfcc.shopper-categories",
              "sfcc.shopper-baskets-orders.rw",
            ]),
            token_type: "Bearer",
          }),
          { status: 200 },
        ),
      );
    await expect(
      new SalesforceCommerceCloudApiAdapter().getProductSummary(credentials),
    ).rejects.toMatchObject<Partial<SalesforceCommerceCloudApiError>>({
      code: "insufficient_scope",
    });
  });
});
