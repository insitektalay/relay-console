import { WaveApiAdapter } from "./wave-api.adapter";

const credentials = {
  accessToken: "secret-access",
  businessId: "QnVzaW5lc3M6cmVsYXktZGVtby",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("WaveApiAdapter", () => {
  it("binds all reads to one business, applies page bounds, and redacts private fields", async () => {
    const requests: Array<Record<string, any>> = [];
    const adapter = new WaveApiAdapter(async (_url, init) => {
      const body = JSON.parse(String(init.body));
      requests.push(body);
      if (body.query.includes("RelayWaveBusiness"))
        return response({
          data: {
            business: {
              id: credentials.businessId,
              name: "Relay Studio",
              isPersonal: false,
              address: "Private",
            },
          },
        });
      const invoice = {
        id: "SW52b2ljZTpyZWxheS0x",
        status: "SENT",
        invoiceNumber: "INV-001",
        amountDue: { value: "800.00", currency: { code: "GBP" } },
        customer: { id: "Q3VzdG9tZXI6NTg=", name: "Private" },
        items: [{ description: "Private" }],
        memo: "Private",
        viewUrl: "https://private.example",
      };
      return body.query.includes("RelayWaveInvoices")
        ? response({
            data: {
              business: {
                id: credentials.businessId,
                invoices: {
                  edges: [{ node: invoice }],
                  pageInfo: { currentPage: 2, totalPages: 3, totalCount: 21 },
                },
              },
            },
          })
        : response({
            data: {
              business: { id: credentials.businessId, invoice },
            },
          });
    });
    expect(await adapter.getConnectedBusiness(credentials)).toEqual({
      business: {
        businessId: credentials.businessId,
        name: "Relay Studio",
        isPersonal: false,
      },
    });
    const listed = await adapter.listInvoices(credentials, {
      page: 2,
      limit: 1,
    });
    expect(requests[1].variables).toEqual({
      businessId: credentials.businessId,
      page: 2,
      pageSize: 1,
    });
    expect(JSON.stringify(listed)).not.toMatch(/Private|items|memo|viewUrl/i);
    expect(
      JSON.stringify(
        await adapter.getInvoice(credentials, {
          invoiceId: "SW52b2ljZTpyZWxheS0x",
        }),
      ),
    ).not.toMatch(/Private|items|memo|viewUrl/i);
  });

  it("rejects invalid business and invoice bindings before network access", async () => {
    const request = jest.fn();
    const adapter = new WaveApiAdapter(request);
    await expect(
      adapter.listInvoices({ ...credentials, businessId: "../business" }, {}),
    ).rejects.toMatchObject({ code: "wave_business_binding_invalid" });
    await expect(
      adapter.getInvoice(credentials, { invoiceId: "../invoice" }),
    ).rejects.toMatchObject({ code: "wave_invoice_id_invalid" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps GraphQL errors without exposing provider messages or tokens", async () => {
    const adapter = new WaveApiAdapter(async () =>
      response(
        {
          errors: [
            {
              message: "secret provider detail",
              extensions: { code: "FORBIDDEN", token: "secret-access" },
            },
          ],
        },
        403,
      ),
    );
    await expect(adapter.listInvoices(credentials, {})).rejects.toMatchObject({
      code: "wave_permission_or_subscription_denied",
      statusCode: 403,
      details: { providerCode: "FORBIDDEN" },
    });
    await expect(
      adapter.listInvoices(credentials, {}),
    ).rejects.not.toMatchObject({
      details: expect.objectContaining({ providerMessage: expect.anything() }),
    });
  });
});
