import { ZohoApiAdapter, ZohoApiError } from "./zoho-api.adapter";

const credentials = {
  accessToken: "secret-token",
  organizationId: "5725767000000020005",
  apiOrigin: "https://www.zohoapis.eu",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("ZohoApiAdapter", () => {
  it("uses only fixed bounded Account and Deal requests", async () => {
    const request = jest
      .fn()
      .mockImplementation(async () =>
        response({ data: [{ id: "1", Account_Name: "Acme" }] }),
      );
    const adapter = new ZohoApiAdapter(request);
    await adapter.listAccounts(credentials, { limit: 5 });
    await adapter.listDeals(credentials, { limit: 3 });
    await adapter.getDeal(credentials, { dealId: "9" });
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[0][0]).toContain("/crm/v8/Accounts?");
    expect(request.mock.calls[0][0]).toContain("per_page=5");
    expect(request.mock.calls[1][0]).toContain("/crm/v8/Deals?");
    expect(request.mock.calls[2][0]).toContain("/crm/v8/Deals/9?");
    expect(request.mock.calls[0][1].headers.Authorization).toBe(
      "Zoho-oauthtoken secret-token",
    );
  });

  it("rejects invalid region, organization, Deal ID, and limit before network access", async () => {
    const request = jest.fn();
    const adapter = new ZohoApiAdapter(request);
    await expect(
      adapter.listAccounts(
        { ...credentials, apiOrigin: "https://evil.example" },
        {},
      ),
    ).rejects.toBeInstanceOf(ZohoApiError);
    await expect(
      adapter.listAccounts({ ...credentials, organizationId: "bad" }, {}),
    ).rejects.toBeInstanceOf(ZohoApiError);
    await expect(
      adapter.getDeal(credentials, { dealId: "../Users" }),
    ).rejects.toBeInstanceOf(ZohoApiError);
    await expect(
      adapter.listDeals(credentials, { limit: 26 }),
    ).rejects.toBeInstanceOf(ZohoApiError);
    expect(request).not.toHaveBeenCalled();
  });

  it("maps provider failures without exposing token or response detail", async () => {
    const adapter = new ZohoApiAdapter(
      jest
        .fn()
        .mockResolvedValue(response({ message: "secret-token private" }, 403)),
    );
    await expect(adapter.listAccounts(credentials, {})).rejects.toMatchObject({
      code: "zoho_permission_denied",
      message: "Zoho CRM API request failed.",
    });
  });
});
