import { FreshBooksApiAdapter } from "./freshbooks-api.adapter";

const credentials = {
  accessToken: "secret-access",
  businessId: "240340",
  accountId: "ABC123",
  role: "owner",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("FreshBooksApiAdapter", () => {
  it("binds identity and invoice reads to the exact account and redacts private fields", async () => {
    const urls: URL[] = [];
    const adapter = new FreshBooksApiAdapter(async (raw) => {
      const url = new URL(raw);
      urls.push(url);
      if (url.pathname.endsWith("/users/me"))
        return response({
          response: {
            profile: { first_name: "Private", email: "private@example.com" },
            business_memberships: [
              {
                role: "owner",
                business: {
                  id: 240340,
                  account_id: "ABC123",
                  name: "Example Books",
                  active: true,
                  address: { street: "Private" },
                },
              },
            ],
          },
        });
      if (url.pathname.endsWith("/invoices/invoices"))
        return response({
          response: {
            result: {
              invoices: [
                {
                  id: 7,
                  invoice_number: "0007",
                  amount: { amount: "100.00", code: "GBP" },
                  paid: { amount: "25.00" },
                  outstanding: { amount: "75.00" },
                  display_status: "sent",
                  fname: "Private",
                  email: "private@example.com",
                  address: "Private",
                  notes: "Private",
                  terms: "Private",
                  lines: [{ description: "Private" }],
                },
              ],
            },
          },
        });
      return response({
        response: {
          result: {
            invoice: {
              id: 7,
              amount: { amount: "100.00", code: "GBP" },
              organization: "Private",
              payment_details: "Private",
            },
          },
        },
      });
    });
    expect(await adapter.getConnectedBusiness(credentials)).toEqual({
      businessMembership: {
        businessId: 240340,
        accountId: "ABC123",
        businessName: "Example Books",
        role: "owner",
        active: true,
      },
    });
    const list = await adapter.listInvoices(credentials, { page: 2, limit: 1 });
    expect(urls[1].pathname).toBe(
      "/accounting/account/ABC123/invoices/invoices",
    );
    expect(urls[1].searchParams.get("per_page")).toBe("1");
    expect(JSON.stringify(list)).not.toMatch(
      /Private|email|address|notes|terms|lines/i,
    );
    expect(
      JSON.stringify(await adapter.getInvoice(credentials, { invoiceId: "7" })),
    ).not.toMatch(/Private|organization|payment_details/i);
  });
  it("rejects invalid account and invoice bindings before network access", async () => {
    const request = jest.fn();
    const adapter = new FreshBooksApiAdapter(request);
    await expect(
      adapter.listInvoices({ ...credentials, accountId: "bad/account" }, {}),
    ).rejects.toMatchObject({ code: "freshbooks_business_binding_invalid" });
    await expect(
      adapter.getInvoice(credentials, { invoiceId: "../7" }),
    ).rejects.toMatchObject({ code: "freshbooks_invoice_id_invalid" });
    expect(request).not.toHaveBeenCalled();
  });
  it("maps provider errors without exposing response bodies or tokens", async () => {
    const adapter = new FreshBooksApiAdapter(async () =>
      response({ error: "secret provider body" }, 401),
    );
    await expect(adapter.listInvoices(credentials, {})).rejects.toMatchObject({
      code: "freshbooks_token_invalid",
      statusCode: 401,
    });
    await expect(
      adapter.listInvoices(credentials, {}),
    ).rejects.not.toMatchObject({
      details: expect.objectContaining({ providerError: expect.anything() }),
    });
  });
});
