import { XeroApiAdapter, XeroApiError } from "./xero-api.adapter";
const credentials = {
  accessToken: "xero-access",
  tenantId: "6e91a9e7-f5b2-45db-afe9-60bca7dc3075",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
describe("XeroApiAdapter", () => {
  it("pins requests to one organisation and redacts private invoice fields", async () => {
    const request = jest.fn(async () =>
      response({
        Invoices: [
          {
            InvoiceID: "243216c5-369e-4056-ac67-05388f86dc81",
            InvoiceNumber: "INV-1",
            Total: 120,
            Contact: {
              ContactID: "3138017f-8ddc-420e-a159-e7e1cf9e643d",
              Name: "Private",
            },
            LineItems: [{ Description: "Private" }],
            Reference: "private",
          },
        ],
      }),
    );
    const result = await new XeroApiAdapter(request).listInvoices(credentials, {
      limit: 5,
      status: "AUTHORISED",
    });
    expect(
      (request.mock.calls as unknown as Array<[string, RequestInit]>)[0][0],
    ).toBe(
      "https://api.xero.com/api.xro/2.0/Invoices?page=1&pageSize=5&order=UpdatedDateUTC+DESC&summaryOnly=true&Statuses=AUTHORISED",
    );
    expect(
      (request.mock.calls as unknown as Array<[string, RequestInit]>)[0][1]
        .headers,
    ).toMatchObject({
      Authorization: "Bearer xero-access",
      "xero-tenant-id": credentials.tenantId,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("LineItems");
    expect(result.invoices[0]).toMatchObject({
      InvoiceNumber: "INV-1",
      Total: 120,
      ContactID: "3138017f-8ddc-420e-a159-e7e1cf9e643d",
    });
  });
  it("rejects invalid tenant, invoice and bounds", async () => {
    const api = new XeroApiAdapter(
      jest.fn(async () => response({ Invoices: [] })),
    );
    await expect(
      api.getOrganisation({ ...credentials, tenantId: "bad" }),
    ).rejects.toMatchObject({ code: "xero_tenant_binding_invalid" });
    await expect(
      api.getInvoice(credentials, { invoiceId: "../Contacts" }),
    ).rejects.toMatchObject({ code: "xero_invoice_id_invalid" });
    await expect(
      api.listInvoices(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "xero_input_invalid" });
  });
  it.each([
    [401, "xero_token_invalid"],
    [403, "xero_permission_denied"],
    [429, "xero_rate_limited"],
  ])("maps %s without returning provider messages", async (status, code) => {
    const api = new XeroApiAdapter(
      jest.fn(async () =>
        response(
          {
            Message: "private@example.com",
            Type: "Validation",
            ErrorNumber: 10,
          },
          status,
        ),
      ),
    );
    const error = (await api
      .getOrganisation(credentials)
      .catch((value) => value)) as unknown as XeroApiError;
    expect(error).toMatchObject({ code, statusCode: status });
    expect(JSON.stringify(error.details)).not.toContain("private@example.com");
  });
});
