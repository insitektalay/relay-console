import {
  SageAccountingApiAdapter,
  SageAccountingApiError,
  type SageAccountingCredentials,
} from "./sage-accounting-api.adapter";

const credentials: SageAccountingCredentials = {
  accessToken: "sage-access-token",
  businessId: "business_123",
  subscriptionKey: "sage-subscription-key",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("SageAccountingApiAdapter", () => {
  it("pins the API origin, exact business, subscription key, page, and limit", async () => {
    const request = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        response([
          {
            id: "CURRENT_ASSETS",
            displayed_as: "Current assets",
            name: "Current Assets",
            links: [{ href: "secret" }],
          },
        ]),
    );
    const adapter = new SageAccountingApiAdapter(request);

    await expect(
      adapter.listLedgerAccountClassifications(credentials, { limit: 7 }),
    ).resolves.toEqual({
      businessId: "business_123",
      classifications: [
        {
          classificationId: "CURRENT_ASSETS",
          name: "Current Assets",
          displayedAs: "Current assets",
        },
      ],
      page: 1,
      nextPageFollowed: false,
    });

    const [url, init] = request.mock.calls[0];
    expect(url).toBe(
      "https://api.accounting.sage.com/v3.1/ledger_account_classifications?page=1&items_per_page=7",
    );
    expect(init).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: {
        Authorization: "Bearer sage-access-token",
        "Ocp-Apim-Subscription-Key": "sage-subscription-key",
        "X-Business": "business_123",
      },
    });
  });

  it("returns only bounded business metadata and enforces the exact binding", async () => {
    const adapter = new SageAccountingApiAdapter(async () =>
      response({
        id: "business_123",
        name: "Example Ltd",
        country: { id: "GB", displayed_as: "United Kingdom" },
        is_demo: false,
        subscription: { active: true, status: "active" },
        address_line_1: "private",
        telephone: "private",
      }),
    );
    await expect(adapter.getBusiness(credentials)).resolves.toEqual({
      business: {
        businessId: "business_123",
        name: "Example Ltd",
        country: { id: "GB", name: "United Kingdom" },
        demo: false,
        subscriptionActive: true,
        subscriptionStatus: "active",
      },
    });

    const mismatch = new SageAccountingApiAdapter(async () =>
      response({ id: "another_business", name: "Wrong" }),
    );
    await expect(mismatch.getBusiness(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });

  it("binds exact classification IDs and rejects invalid IDs and limits", async () => {
    const request = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        response({ id: "CURRENT_ASSETS", displayed_as: "Current assets" }),
    );
    const adapter = new SageAccountingApiAdapter(request);
    await adapter.getLedgerAccountClassification(credentials, {
      classificationId: "CURRENT_ASSETS",
    });
    expect(request.mock.calls[0][0]).toBe(
      "https://api.accounting.sage.com/v3.1/ledger_account_classifications/CURRENT_ASSETS",
    );
    await expect(
      adapter.getLedgerAccountClassification(credentials, {
        classificationId: "../contacts",
      }),
    ).rejects.toBeInstanceOf(SageAccountingApiError);
    await expect(
      adapter.listLedgerAccountClassifications(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("maps provider failures without exposing response bodies", async () => {
    const adapter = new SageAccountingApiAdapter(
      async () => new Response("provider secret details", { status: 403 }),
    );
    await expect(adapter.getBusiness(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
      message: "Sage Accounting API request failed.",
      statusCode: 403,
    });
  });
});
