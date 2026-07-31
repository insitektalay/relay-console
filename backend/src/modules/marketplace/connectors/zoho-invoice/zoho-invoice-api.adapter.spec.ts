import { ZohoInvoiceApiAdapter } from "./zoho-invoice-api.adapter";
const credentials = {
  accessToken: "fixture-access-token",
  apiOrigin: "https://www.zohoapis.eu",
  organizationId: "123456789",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
describe("ZohoInvoiceApiAdapter", () => {
  it("pins the regional organizations endpoint, exact organization, and returned fields", async () => {
    const request = jest.fn(async () =>
      json({
        organizations: [
          {
            organization_id: credentials.organizationId,
            name: "Relay Invoice",
            is_default_org: true,
            plan_name: "Free",
            language_code: "en",
            fiscal_year_start_month: 0,
            time_zone: "Europe/London",
            is_org_active: true,
            currency_code: "GBP",
            price_precision: 2,
            contact_name: "private",
            email: "private@example.com",
            tax_group_enabled: true,
          },
        ],
      }),
    );
    const result = await new ZohoInvoiceApiAdapter(request).getOrganization(
      credentials,
    );
    expect(request).toHaveBeenCalledWith(
      "https://www.zohoapis.eu/invoice/v3/organizations",
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
      name: "Relay Invoice",
      currencyCode: "GBP",
    });
    expect(result.organization).not.toHaveProperty("email");
    expect(result.organization).not.toHaveProperty("contact_name");
    expect(result.nextPageFollowed).toBe(false);
  });
  it("rejects invalid regions and organization bindings before network access", async () => {
    const request = jest.fn();
    const adapter = new ZohoInvoiceApiAdapter(request);
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
  it("fails closed on mismatch and redacts provider errors", async () => {
    await expect(
      new ZohoInvoiceApiAdapter(async () =>
        json({ organizations: [{ organization_id: "999" }] }),
      ).getOrganization(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      new ZohoInvoiceApiAdapter(async () =>
        json({ detail: credentials.accessToken }, 403),
      ).getOrganization(credentials),
    ).rejects.toMatchObject({
      code: "insufficient_scope",
      message: "Zoho Invoice API request failed.",
    });
  });
});
