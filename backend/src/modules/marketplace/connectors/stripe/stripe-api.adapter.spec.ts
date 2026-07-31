import { StripeApiAdapter, StripeApiError } from "./stripe-api.adapter";

const credentials = {
  accessToken: "stripe-access-token",
  accountId: "acct_Relay123",
  livemode: false,
};

function response(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("StripeApiAdapter", () => {
  it("pins balance reads to Stripe and returns only bounded balance fields", async () => {
    const request = jest.fn(async () =>
      response({
        livemode: false,
        available: [
          { amount: 1200, currency: "gbp", source_types: { card: 1200 } },
        ],
        pending: [{ amount: 300, currency: "gbp" }],
        secret_material: "never-return",
      }),
    );
    const result = await new StripeApiAdapter(request).getBalance(credentials);
    expect(request).toHaveBeenCalledWith(
      "https://api.stripe.com/v1/balance",
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
    const init = (
      request.mock.calls as unknown as Array<[string, RequestInit]>
    )[0][1];
    expect(init.headers).toMatchObject({
      Authorization: "Bearer stripe-access-token",
      "Stripe-Version": "2026-06-24.dahlia",
    });
    expect(result).toEqual({
      accountId: "acct_Relay123",
      livemode: false,
      available: [{ amount: 1200, currency: "gbp" }],
      pending: [{ amount: 300, currency: "gbp" }],
    });
    expect(JSON.stringify(result)).not.toContain("secret_material");
  });

  it("bounds and redacts PaymentIntent list results", async () => {
    const request = jest.fn(async () =>
      response({
        has_more: true,
        data: [
          {
            id: "pi_Relay123",
            status: "succeeded",
            amount: 2500,
            amount_capturable: 0,
            amount_received: 2500,
            currency: "usd",
            capture_method: "automatic",
            confirmation_method: "automatic",
            created: 1_700_000_000,
            livemode: false,
            latest_charge: "ch_Relay123",
            client_secret: "pi_secret_do_not_return",
            receipt_email: "private@example.com",
            shipping: { name: "Private" },
            payment_method_options: { card: {} },
          },
        ],
      }),
    );
    const result = await new StripeApiAdapter(request).listPaymentIntents(
      credentials,
      {
        limit: 5,
        startingAfter: "pi_Previous1",
        createdGte: 10,
        createdLte: 20,
      },
    );
    expect(
      (request.mock.calls as unknown as Array<[string, RequestInit]>)[0][0],
    ).toBe(
      "https://api.stripe.com/v1/payment_intents?limit=5&starting_after=pi_Previous1&created%5Bgte%5D=10&created%5Blte%5D=20",
    );
    expect(result.paymentIntents[0]).toMatchObject({
      id: "pi_Relay123",
      status: "succeeded",
      amount: 2500,
      currency: "usd",
    });
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "client_secret",
      "pi_secret_do_not_return",
      "private@example.com",
      "shipping",
      "payment_method_options",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it("uses the exact PaymentIntent path and rejects invalid bindings and inputs", async () => {
    const request = jest.fn(async () =>
      response({ id: "pi_Exact1", status: "processing" }),
    );
    await new StripeApiAdapter(request).getPaymentIntent(credentials, {
      paymentIntentId: "pi_Exact1",
    });
    expect(
      (request.mock.calls as unknown as Array<[string, RequestInit]>)[0][0],
    ).toBe("https://api.stripe.com/v1/payment_intents/pi_Exact1");
    await expect(
      new StripeApiAdapter(request).getBalance({
        ...credentials,
        accountId: "bad",
      }),
    ).rejects.toMatchObject({ code: "stripe_account_binding_invalid" });
    await expect(
      new StripeApiAdapter(request).getPaymentIntent(credentials, {
        paymentIntentId: "../customers",
      }),
    ).rejects.toMatchObject({ code: "stripe_payment_intent_id_invalid" });
    await expect(
      new StripeApiAdapter(request).listPaymentIntents(credentials, {
        limit: 26,
      }),
    ).rejects.toMatchObject({ code: "stripe_input_invalid" });
    await expect(
      new StripeApiAdapter(request).listPaymentIntents(credentials, {
        createdGte: 20,
        createdLte: 10,
      }),
    ).rejects.toMatchObject({ code: "stripe_created_range_invalid" });
  });

  it.each([
    [401, "stripe_token_invalid"],
    [403, "stripe_permission_denied"],
    [429, "stripe_rate_limited"],
  ])(
    "maps provider status %s without exposing raw private errors",
    async (status, code) => {
      const request = jest.fn(async () =>
        response(
          {
            error: {
              type: "invalid_request_error",
              code: "safe_code",
              message: "contains pi_secret_private and private@example.com",
              payment_intent: { client_secret: "pi_secret_private" },
            },
          },
          status,
          { "retry-after": "2" },
        ),
      );
      const error = (await new StripeApiAdapter(request)
        .getBalance(credentials)
        .catch((value) => value)) as StripeApiError;
      expect(error).toMatchObject({ code, statusCode: status });
      expect(JSON.stringify(error.details)).not.toContain("pi_secret_private");
      expect(JSON.stringify(error.details)).not.toContain(
        "private@example.com",
      );
    },
  );
});
