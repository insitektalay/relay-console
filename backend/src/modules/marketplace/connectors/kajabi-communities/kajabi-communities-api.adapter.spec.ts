import {
  KajabiCommunitiesApiAdapter,
  type KajabiCommunitiesCredentials,
} from "./kajabi-communities-api.adapter";

const credentials: KajabiCommunitiesCredentials = {
  clientId: "kajabi-user-key-id",
  clientSecret: "kajabi-user-key-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/vnd.api+json" },
  });

describe("KajabiCommunitiesApiAdapter", () => {
  it("exchanges only customer-owned client credentials at Kajabi's fixed origin", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new KajabiCommunitiesApiAdapter(async (url, init) => {
      requests.push({ url, init });
      if (url.endsWith("/v1/oauth/token"))
        return json({ access_token: "short-lived-token", expires_in: 3600 });
      return json({
        data: {
          id: "user-123",
          type: "users",
          attributes: { name: "Community Owner", email: "owner@example.com" },
        },
      });
    });

    await expect(adapter.health(credentials)).resolves.toEqual({
      tokenValid: true,
      user: {
        id: "user-123",
        name: "Community Owner",
        email: "owner@example.com",
      },
    });
    expect(requests.map(({ url }) => url)).toEqual([
      "https://api.kajabi.com/v1/oauth/token",
      "https://api.kajabi.com/v1/me",
    ]);
    const tokenBody = new URLSearchParams(String(requests[0].init.body));
    expect(tokenBody.get("grant_type")).toBe("client_credentials");
    expect(tokenBody.get("client_id")).toBe(credentials.clientId);
    expect(tokenBody.get("client_secret")).toBe(credentials.clientSecret);
  });

  it("returns bounded product types and excludes provider URLs", async () => {
    const requests: string[] = [];
    const adapter = new KajabiCommunitiesApiAdapter(async (url) => {
      requests.push(url);
      if (url.endsWith("/v1/oauth/token"))
        return json({ access_token: "token", expires_in: 3600 });
      return json({
        data: [
          {
            id: "product-1",
            type: "products",
            attributes: {
              title: "Member Community",
              description: "Private member space",
              status: "ready",
              publish_status: "published",
              product_type_name: "Community",
              product_type_id: 7,
              members_aggregate_count: 42,
              url: "https://private.example/member-community",
              thumbnail_url: "https://private.example/image.jpg",
            },
            relationships: { site: { data: { id: "site-1", type: "sites" } } },
          },
        ],
        meta: { current_page: 1, total_pages: 1, total_count: 1 },
      });
    });

    const result = await adapter.listProducts(credentials, {
      siteId: "site-1",
      maxResults: 10,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: "product-1",
        productTypeName: "Community",
        memberCount: 42,
        siteId: "site-1",
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("private.example");
    const url = new URL(requests[1]);
    expect(url.origin).toBe("https://api.kajabi.com");
    expect(url.searchParams.get("filter[site_id]")).toBe("site-1");
    expect(url.searchParams.get("page[size]")).toBe("10");
  });

  it("limits contact reads to sparse identity fields and exact site", async () => {
    const requests: string[] = [];
    const adapter = new KajabiCommunitiesApiAdapter(async (url) => {
      requests.push(url);
      if (url.endsWith("/v1/oauth/token"))
        return json({ access_token: "token", expires_in: 3600 });
      return json({
        data: [
          {
            id: "contact-1",
            attributes: {
              name: "Member",
              email: "member@example.com",
              phone_number: "private-phone",
              address_line_1: "private-address",
              custom_1: "private-custom",
            },
            relationships: { site: { data: { id: "site-1" } } },
          },
        ],
      });
    });

    const result = await adapter.listContacts(credentials, {
      siteId: "site-1",
      search: "member@example.com",
      offerId: "offer-1",
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: "contact-1",
        email: "member@example.com",
        siteId: "site-1",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private-");
    const url = new URL(requests[1]);
    expect(url.searchParams.get("fields[contacts]")).toBe(
      "name,email,created_at,updated_at",
    );
    expect(url.searchParams.get("filter[has_offer_id]")).toBe("offer-1");
  });

  it("grants one offer without sending a welcome email", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new KajabiCommunitiesApiAdapter(async (url, init) => {
      requests.push({ url, init });
      if (url.endsWith("/v1/oauth/token"))
        return json({ access_token: "token", expires_in: 3600 });
      return new Response(null, { status: 204 });
    });

    await expect(
      adapter.grantOffer(credentials, {
        contactId: "contact-1",
        offerId: "offer-1",
      }),
    ).resolves.toEqual({
      contactId: "contact-1",
      offerId: "offer-1",
      granted: true,
      welcomeEmailSent: false,
    });
    expect(requests[1].url).toBe(
      "https://api.kajabi.com/v1/contacts/contact-1/relationships/offers",
    );
    expect(requests[1].init.method).toBe("POST");
    expect(JSON.parse(String(requests[1].init.body))).toEqual({
      data: [{ type: "offers", id: "offer-1" }],
      meta: { send_customer_welcome_email: false },
    });
  });

  it("rejects unbounded identifiers before calling Kajabi", async () => {
    const request = jest.fn();
    const adapter = new KajabiCommunitiesApiAdapter(request);
    await expect(
      adapter.getProduct(credentials, { productId: "../oauth/token" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });
});
