import { ShopifyApiAdapter, ShopifyApiError } from "./shopify-api.adapter";

describe("ShopifyApiAdapter", () => {
  const api = new ShopifyApiAdapter();
  const credentials = { shopDomain: "relay-demo.myshopify.com", accessToken: "shopify-token" };
  afterEach(() => jest.restoreAllMocks());

  it("pins GraphQL to the exact shop, stable API version, access-token header, and no redirects", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { shop: { id: "gid://shopify/Shop/1" } } }), { status: 200 }));
    await api.getShop(credentials);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://relay-demo.myshopify.com/admin/api/2026-07/graphql.json");
    expect((init?.headers as Record<string, string>)["X-Shopify-Access-Token"]).toBe("shopify-token");
    expect(init?.redirect).toBe("error");
  });

  it.each(["Relay-Demo.myshopify.com", "relay-demo.myshopify.com.evil.example", "https://relay-demo.myshopify.com", "127.0.0.1", "relay-demo.shopify.com"])("rejects a non-exact Shopify shop boundary: %s", (shopDomain) => {
    expect(() => api.prepareProductChange({ ...credentials, shopDomain }, { operation: "create", title: "Draft" })).toThrow(ShopifyApiError);
  });

  it("bounds product pagination and returns the provider cursor", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { products: { nodes: [], pageInfo: { hasNextPage: true, endCursor: "next" } } } }), { status: 200 }));
    await expect(api.listProducts(credentials, { maxResults: 25, after: "cursor" })).resolves.toEqual({ nodes: [], pageInfo: { hasNextPage: true, endCursor: "next" } });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).variables).toEqual({ first: 25, after: "cursor" });
  });

  it("prepares and hashes a draft without calling Shopify", () => {
    const fetchMock = jest.spyOn(global, "fetch");
    expect(api.prepareProductChange(credentials, { operation: "create", title: "Relay launch", tags: ["relay"] })).toEqual(expect.objectContaining({ operation: "create", title: "Relay launch", providerSideEffect: false, payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forces product creation to DRAFT", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { productCreate: { product: { id: "gid://shopify/Product/1", status: "DRAFT" }, userErrors: [] } } }), { status: 200 }));
    await api.createDraftProduct(credentials, { title: "Draft" });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).variables.product).toEqual({ title: "Draft", status: "DRAFT" });
  });

  it("requires exact DRAFT state and updatedAt before an update", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { product: { id: "gid://shopify/Product/1", status: "DRAFT", updatedAt: "2026-07-16T12:00:00.000Z" } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { productUpdate: { product: { id: "gid://shopify/Product/1" }, userErrors: [] } } }), { status: 200 }));
    await api.updateDraftProduct(credentials, { productId: "gid://shopify/Product/1", expectedUpdatedAt: "2026-07-16T12:00:00.000Z", title: "Updated" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects stale publication and only targets one explicit publication", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { product: { id: "gid://shopify/Product/1", status: "ACTIVE", updatedAt: "2026-07-16T12:01:00.000Z" } } }), { status: 200 }));
    await expect(api.publishProduct(credentials, { productId: "gid://shopify/Product/1", publicationId: "gid://shopify/Publication/2", expectedUpdatedAt: "2026-07-16T12:00:00.000Z" })).rejects.toMatchObject({ code: "approval_mismatch" });
  });

  it("maps provider and GraphQL failures to bounded safe errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: "Access denied" }] }), { status: 200 }));
    await expect(api.getShop(credentials)).rejects.toMatchObject({ code: "graph_error", message: "Access denied" });
  });
});
