import {
  QuickBooksApiAdapter,
  QuickBooksApiError,
} from "./quickbooks-api.adapter";

const credentials = {
  accessToken: "access-token",
  realmId: "123456789",
  environment: "sandbox" as const,
};
const productionCredentials = {
  ...credentials,
  environment: "production" as const,
};

describe("QuickBooksApiAdapter", () => {
  it("binds reads to the exact sandbox realm and redacts invoice private data", async () => {
    const request = jest.fn(
      async (url: string) =>
        new Response(
          JSON.stringify({
            QueryResponse: {
              Invoice: [
                {
                  Id: "42",
                  SyncToken: "1",
                  DocNumber: "1001",
                  TxnDate: "2026-07-01",
                  DueDate: "2026-07-31",
                  CurrencyRef: { value: "GBP", name: "Pound Sterling" },
                  TotalAmt: 120,
                  Balance: 20,
                  EmailStatus: "EmailSent",
                  PrintStatus: "NotSet",
                  MetaData: { LastUpdatedTime: "2026-07-02T00:00:00Z" },
                  BillEmail: { Address: "private@example.com" },
                  BillAddr: { Line1: "Private address" },
                  Line: [{ Description: "Private line item" }],
                  PrivateNote: "private",
                  CustomerMemo: { value: "private" },
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const adapter = new QuickBooksApiAdapter(request);
    const result = await adapter.listInvoices(credentials, { limit: 1 });
    expect(request).toHaveBeenCalledTimes(1);
    const url = new URL(request.mock.calls[0][0]);
    expect(url.origin).toBe("https://sandbox-quickbooks.api.intuit.com");
    expect(url.pathname).toBe("/v3/company/123456789/query");
    expect(url.searchParams.get("minorversion")).toBe("75");
    expect(url.searchParams.get("query")).toContain("MAXRESULTS 1");
    expect(result.invoices).toEqual([
      {
        Id: "42",
        SyncToken: "1",
        DocNumber: "1001",
        TxnDate: "2026-07-01",
        DueDate: "2026-07-31",
        CurrencyCode: "GBP",
        TotalAmt: 120,
        Balance: 20,
        EmailStatus: "EmailSent",
        PrintStatus: "NotSet",
        LastUpdatedTime: "2026-07-02T00:00:00Z",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("Private line item");
  });

  it("rejects invalid realm, invoice ID, and unbounded pagination", async () => {
    const adapter = new QuickBooksApiAdapter();
    await expect(
      adapter.getCompanyInfo({ ...credentials, realmId: "../other" }),
    ).rejects.toMatchObject({ code: "quickbooks_realm_binding_invalid" });
    await expect(
      adapter.getInvoice(credentials, { invoiceId: "../42" }),
    ).rejects.toMatchObject({ code: "quickbooks_invoice_id_invalid" });
    await expect(
      adapter.listInvoices(credentials, { limit: 26 }),
    ).rejects.toBeInstanceOf(QuickBooksApiError);
  });

  it("maps provider errors without returning private fault detail", async () => {
    const adapter = new QuickBooksApiAdapter(
      async () =>
        new Response(
          JSON.stringify({
            Fault: {
              Error: [
                {
                  code: "3200",
                  Message: "private message",
                  Detail: "private detail",
                },
              ],
            },
          }),
          { status: 401, headers: { intuit_tid: "tid-1" } },
        ),
    );
    await expect(adapter.getCompanyInfo(credentials)).rejects.toMatchObject({
      code: "quickbooks_token_invalid",
      statusCode: 401,
      details: {
        providerError: [{ code: "3200", element: null }],
        intuitTid: "tid-1",
      },
    });
  });

  it("uses the fixed production Workforce query and redacts payroll private data", async () => {
    const request = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            data: {
              payrollEmployeeCompensations: {
                edges: Array.from({ length: 11 }, (_, index) => ({
                  node: {
                    id: String(index + 1),
                    active: true,
                    employee: {
                      firstName: "Private",
                      taxIdentifier: "private-ssn",
                    },
                    grossPay: 1000,
                    employerCompensation: {
                      id: `pay-${index + 1}`,
                      name: "Regular pay",
                      amount: 1000,
                      type: {
                        key: "REGULAR_PAY",
                        description: "Regular hourly pay",
                        value: "Hourly",
                      },
                    },
                  },
                })),
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const adapter = new QuickBooksApiAdapter(request);
    const result = await adapter.listPayrollCompensations(
      productionCredentials,
      { employeeId: "42", activeOnly: true, countryCode: "GB" },
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe("https://qb.api.intuit.com/graphql");
    const init = request.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer access-token",
      "Content-Type": "application/json",
      intuit_country: "GB",
    });
    const posted = JSON.parse(String(init.body));
    expect(posted.query).toContain(
      "payrollEmployeeCompensations(filter: $filter)",
    );
    expect(posted.variables).toEqual({
      filter: { employeeId: "42", active: true },
    });
    expect(result.compensations).toHaveLength(10);
    expect(result.compensations[0]).toEqual({
      id: "1",
      active: true,
      employerCompensation: {
        id: "pay-1",
        name: "Regular pay",
        type: {
          key: "REGULAR_PAY",
          description: "Regular hourly pay",
          value: "Hourly",
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("private-ssn");
    expect(JSON.stringify(result)).not.toContain("grossPay");
    expect(JSON.stringify(result)).not.toContain("amount");
  });

  it("rejects sandbox payroll, invalid employee IDs, and invalid countries before fetch", async () => {
    const request = jest.fn();
    const adapter = new QuickBooksApiAdapter(request);
    await expect(
      adapter.listPayrollCompensations(credentials, { employeeId: "42" }),
    ).rejects.toMatchObject({
      code: "quickbooks_payroll_production_required",
    });
    await expect(
      adapter.listPayrollCompensations(productionCredentials, {
        employeeId: "../42",
      }),
    ).rejects.toMatchObject({ code: "quickbooks_employee_id_invalid" });
    await expect(
      adapter.listPayrollCompensations(productionCredentials, {
        employeeId: "42",
        countryCode: "gb",
      }),
    ).rejects.toMatchObject({ code: "quickbooks_country_code_invalid" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps HTTP-200 Workforce GraphQL errors without leaking messages", async () => {
    const adapter = new QuickBooksApiAdapter(
      async () =>
        new Response(
          JSON.stringify({
            errors: [
              {
                message: "private provider detail",
                extensions: { code: "FORBIDDEN", private: "secret" },
              },
            ],
          }),
          { status: 200, headers: { intuit_tid: "tid-payroll" } },
        ),
    );
    await expect(
      adapter.listPayrollCompensations(productionCredentials, {
        employeeId: "42",
      }),
    ).rejects.toMatchObject({
      code: "quickbooks_graphql_error",
      statusCode: 200,
      details: {
        providerError: [{ code: "FORBIDDEN" }],
        intuitTid: "tid-payroll",
      },
    });
  });

  it("reads one exact sandbox payment charge and redacts instrument data", async () => {
    const request = jest.fn(async (_url: string, _init: RequestInit) =>
      new Response(
        JSON.stringify({
          id: "EAQX3720TN5J",
          created: "2026-07-17T18:48:25Z",
          status: "CAPTURED",
          amount: "10.55",
          currency: "USD",
          capture: true,
          authCode: "private-auth-code",
          token: "private-token",
          card: {
            number: "xxxxxxxxxxxx1111",
            name: "Private Customer",
            address: { streetAddress: "Private address" },
          },
          context: { deviceInfo: { ipAddress: "192.0.2.1" } },
          refunds: [{ id: "private-refund" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const adapter = new QuickBooksApiAdapter(request);
    const result = await adapter.getPaymentCharge(credentials, {
      chargeId: "EAQX3720TN5J",
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe(
      "https://sandbox.api.intuit.com/quickbooks/v4/payments/charges/EAQX3720TN5J",
    );
    expect(request.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
    });
    expect(result).toEqual({
      realmId: "123456789",
      charge: {
        id: "EAQX3720TN5J",
        created: "2026-07-17T18:48:25Z",
        status: "CAPTURED",
        amount: "10.55",
        currency: "USD",
        capture: true,
      },
    });
    const encoded = JSON.stringify(result);
    expect(encoded).not.toContain("private-auth-code");
    expect(encoded).not.toContain("private-token");
    expect(encoded).not.toContain("Private Customer");
    expect(encoded).not.toContain("Private address");
    expect(encoded).not.toContain("192.0.2.1");
    expect(encoded).not.toContain("private-refund");
  });

  it("rejects unsafe payment charge IDs before fetch", async () => {
    const request = jest.fn();
    const adapter = new QuickBooksApiAdapter(request);
    await expect(
      adapter.getPaymentCharge(credentials, { chargeId: "../charge" }),
    ).rejects.toMatchObject({
      code: "quickbooks_payment_charge_id_invalid",
    });
    expect(request).not.toHaveBeenCalled();
  });
});
