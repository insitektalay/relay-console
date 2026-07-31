import { FreeAgentApiAdapter } from "./freeagent-api.adapter";

const credentials = { accessToken: "secret-access", companyId: "42" };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("FreeAgentApiAdapter", () => {
  it("binds the company, fixes invoice queries, and redacts private fields", async () => {
    const urls: string[] = [];
    const adapter = new FreeAgentApiAdapter(async (url) => {
      urls.push(url);
      if (url.endsWith("/company"))
        return response({
          company: {
            id: 42,
            name: "Relay Books Ltd",
            type: "UkLimitedCompany",
            currency: "GBP",
            subdomain: "private",
            sales_tax_registration_number: "private",
          },
        });
      const invoice = {
        url: "https://api.freeagent.com/v2/invoices/101",
        status: "Open",
        reference: "INV-101",
        total_value: "960.00",
        contact: "https://api.freeagent.com/v2/contacts/22",
        invoice_items: [{ description: "private" }],
        comments: "private",
        bank_account: "private",
      };
      return url.includes("/invoices?")
        ? response({ invoices: [invoice] })
        : response({ invoice });
    });
    expect(await adapter.getConnectedCompany(credentials)).toEqual({
      company: {
        companyId: 42,
        name: "Relay Books Ltd",
        type: "UkLimitedCompany",
        currency: "GBP",
      },
    });
    const listed = await adapter.listInvoices(credentials, {
      page: 2,
      view: "open_or_overdue",
    });
    expect(urls[1]).toContain("page=2");
    expect(urls[1]).toContain("sort=-updated_at");
    expect(urls[1]).toContain("view=open_or_overdue");
    expect(JSON.stringify(listed)).not.toMatch(/private|contact|invoice_items|comments|bank/i);
    expect(
      JSON.stringify(await adapter.getInvoice(credentials, { invoiceId: "101" })),
    ).not.toMatch(/private|contact|invoice_items|comments|bank/i);
  });

  it("rejects invalid bindings, views, and invoice IDs before network access", async () => {
    const request = jest.fn();
    const adapter = new FreeAgentApiAdapter(request);
    await expect(
      adapter.listInvoices({ ...credentials, companyId: "../company" }, {}),
    ).rejects.toMatchObject({ code: "freeagent_company_binding_invalid" });
    await expect(
      adapter.listInvoices(credentials, { view: "all&contact=private" }),
    ).rejects.toMatchObject({ code: "freeagent_invoice_view_invalid" });
    await expect(
      adapter.getInvoice(credentials, { invoiceId: "../invoice" }),
    ).rejects.toMatchObject({ code: "freeagent_invoice_id_invalid" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps safe provider errors without exposing body or tokens", async () => {
    const adapter = new FreeAgentApiAdapter(async () =>
      response({ error: "secret-access provider detail" }, 403),
    );
    await expect(adapter.listInvoices(credentials, {})).rejects.toMatchObject({
      code: "freeagent_permission_denied",
      statusCode: 403,
      details: { retryAfter: null },
    });
    await expect(adapter.listInvoices(credentials, {})).rejects.not.toMatchObject({
      details: expect.objectContaining({ providerMessage: expect.anything() }),
    });
  });
});
