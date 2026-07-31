import { ZohoBooksApiAdapter } from "./zoho-books-api.adapter";

const credentials = {
  accessToken: "fixture-access-token",
  apiOrigin: "https://www.zohoapis.eu",
  organizationId: "123456789",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("ZohoBooksApiAdapter", () => {
  it("pins the regional organizations endpoint, exact organization, and returned fields", async () => {
    const request = jest.fn(async () =>
      json({
        organizations: [
          {
            organization_id: credentials.organizationId,
            name: "Relay Books",
            is_default_org: true,
            plan_name: "Professional",
            language_code: "en",
            fiscal_year_start_month: "January",
            time_zone: "Europe/London",
            is_org_active: true,
            currency_code: "GBP",
            price_precision: 2,
            email: "private@example.com",
            address: "private",
            tax_group_enabled: true,
          },
        ],
      }),
    );
    const result = await new ZohoBooksApiAdapter(request).getOrganization(
      credentials,
    );
    expect(request).toHaveBeenCalledWith(
      "https://www.zohoapis.eu/books/v3/organizations",
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: `Zoho-oauthtoken ${credentials.accessToken}`,
        }),
      }),
    );
    expect(result.organization).toMatchObject({
      organizationId: credentials.organizationId,
      name: "Relay Books",
      currencyCode: "GBP",
    });
    expect(result.organization).not.toHaveProperty("email");
    expect(result.organization).not.toHaveProperty("address");
    expect(result.nextPageFollowed).toBe(false);
  });
  it("rejects invalid regions and organization bindings before network access", async () => {
    const request = jest.fn();
    const adapter = new ZohoBooksApiAdapter(request);
    await expect(
      adapter.getOrganization({
        ...credentials,
        apiOrigin: "https://evil.example",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.getOrganization({ ...credentials, organizationId: "../org" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });
  it("fails closed on organization mismatch and redacts provider errors", async () => {
    await expect(
      new ZohoBooksApiAdapter(async () =>
        json({ organizations: [{ organization_id: "999" }] }),
      ).getOrganization(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      new ZohoBooksApiAdapter(async () =>
        json({ detail: credentials.accessToken }, 403),
      ).getOrganization(credentials),
    ).rejects.toMatchObject({
      code: "insufficient_scope",
      message: "Zoho Books API request failed.",
    });
  });
});
