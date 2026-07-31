import {
  PayPalApiAdapter,
  PayPalApiError,
  type PayPalCredentials,
} from "./paypal-api.adapter";

const credentials: PayPalCredentials = {
  clientId: "merchant-client-id",
  clientSecret: "merchant-secret",
  environment: "sandbox",
};
const json = (body: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

describe("PayPalApiAdapter", () => {
  it("exchanges customer-owned credentials only at the selected fixed origin", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new PayPalApiAdapter(async (url, init) => {
      requests.push({ url, init });
      return json({
        access_token: "short-lived-token",
        expires_in: 3600,
        scope: "https://uri.paypal.com/services/reporting/search/read",
      });
    });

    await expect(adapter.health(credentials)).resolves.toEqual({
      environment: "sandbox",
      tokenValid: true,
      grantedScopes: [
        "https://uri.paypal.com/services/reporting/search/read",
      ],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    );
    expect(requests[0].init.body).toBe("grant_type=client_credentials");
    expect(
      new Headers(requests[0].init.headers).get("authorization"),
    ).toMatch(/^Basic /);
  });

  it("lists bounded transactions while removing payer, address, note and cart data", async () => {
    const requests: string[] = [];
    const adapter = new PayPalApiAdapter(async (url) => {
      requests.push(url);
      if (url.endsWith("/v1/oauth2/token"))
        return json({ access_token: "token", expires_in: 3600, scope: "read" });
      return json({
        page: 1,
        total_items: 1,
        total_pages: 1,
        start_date: "2026-07-01T00:00:00Z",
        end_date: "2026-07-02T00:00:00Z",
        transaction_details: [
          {
            transaction_info: {
              transaction_id: "12345678901234567",
              paypal_reference_id: "98765432109876543",
              paypal_reference_id_type: "TXN",
              transaction_event_code: "T0006",
              transaction_status: "S",
              transaction_initiation_date: "2026-07-01T12:00:00Z",
              transaction_updated_date: "2026-07-01T12:01:00Z",
              transaction_amount: { currency_code: "GBP", value: "10.00" },
              fee_amount: { currency_code: "GBP", value: "-0.59" },
              transaction_note: "private note",
            },
            payer_info: { email_address: "private@example.com" },
            shipping_info: { address: { line1: "private" } },
            cart_info: { item_details: [{ item_name: "private" }] },
          },
        ],
      });
    });

    const result = await adapter.listTransactions(credentials, {
      startDate: "2026-07-01T00:00:00Z",
      endDate: "2026-07-02T00:00:00Z",
      maxResults: 10,
      status: "S",
      currency: "GBP",
    });
    expect(result.transactions).toEqual([
      expect.objectContaining({
        transactionId: "12345678901234567",
        status: "S",
        amount: { currencyCode: "GBP", value: "10.00" },
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("private");
    const apiUrl = new URL(requests[1]);
    expect(apiUrl.origin).toBe("https://api-m.sandbox.paypal.com");
    expect(apiUrl.searchParams.get("fields")).toBe("transaction_info");
    expect(apiUrl.searchParams.get("page_size")).toBe("10");
  });

  it("redacts payer and shipping data from exact order reads", async () => {
    const adapter = new PayPalApiAdapter(async (url) => {
      if (url.endsWith("/v1/oauth2/token"))
        return json({ access_token: "token", expires_in: 3600 });
      return json({
        id: "5O190127TN364715T",
        status: "COMPLETED",
        intent: "CAPTURE",
        payer: { email_address: "private@example.com" },
        purchase_units: [
          {
            reference_id: "default",
            amount: { currency_code: "USD", value: "12.00" },
            shipping: { address: { address_line_1: "private" } },
            payments: {
              captures: [
                {
                  id: "3C679366HH908993F",
                  status: "COMPLETED",
                  amount: { currency_code: "USD", value: "12.00" },
                },
              ],
            },
          },
        ],
      });
    });

    const result = await adapter.getOrder(credentials, {
      orderId: "5O190127TN364715T",
    });
    expect(result.order.status).toBe("COMPLETED");
    expect(result.order.purchaseUnits[0].captureStatuses[0]).toEqual(
      expect.objectContaining({ id: "3C679366HH908993F", status: "COMPLETED" }),
    );
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects transaction ranges over thirty-one days before calling PayPal", async () => {
    const request = jest.fn();
    const adapter = new PayPalApiAdapter(request);
    await expect(
      adapter.listTransactions(credentials, {
        startDate: "2026-01-01T00:00:00Z",
        endDate: "2026-02-02T00:00:00Z",
      }),
    ).rejects.toMatchObject<Partial<PayPalApiError>>({
      code: "provider_validation_error",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps PayPal authorization failures without returning provider messages", async () => {
    const adapter = new PayPalApiAdapter(async () =>
      json(
        {
          name: "NOT_AUTHORIZED",
          message: "sensitive provider explanation",
          details: [{ issue: "PERMISSION_DENIED" }],
        },
        403,
      ),
    );
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
      statusCode: 403,
      message: "PayPal API request failed.",
      details: {
        providerError: {
          name: "NOT_AUTHORIZED",
          issue: "PERMISSION_DENIED",
        },
      },
    });
  });
});
