import { GeminiApiAdapter, geminiSignature } from "./gemini-api.adapter";
import { GEMINI_CONNECTOR_MANIFEST } from "./gemini.connector";

describe("Gemini connector", () => {
  const credentials = { apiKey: "public-key", apiSecret: "secret-key" };

  afterEach(() => jest.restoreAllMocks());

  it("signs the base64 payload with HMAC SHA384", () => {
    expect(
      geminiSignature("eyJyZXF1ZXN0IjoiL3YxL2JhbGFuY2VzIn0=", "secret-key"),
    ).toBe(
      "d938cbad45a27267cd5dd5d9cd599dc7a7967398167d9a4cea2d03600d05716e7f0b0be42a9945ffb04a8be05b449de0",
    );
  });

  it("publishes the complete bounded V1 under both policies", () => {
    expect(GEMINI_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "gemini.market.read",
      "gemini.account.read",
      "gemini.order.place",
      "gemini.order.cancel",
    ]);
    expect(
      GEMINI_CONNECTOR_MANIFEST.approvalProfiles
        .find((profile) => profile.id === "gemini_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual([
      "gemini_account_read",
      "gemini_order_place",
      "gemini_order_cancel",
    ]);
    expect(
      GEMINI_CONNECTOR_MANIFEST.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.allowedActions,
    ).toHaveLength(4);
  });

  it("pins public reads to Gemini and bounds order-book depth", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ bids: [], asks: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await new GeminiApiAdapter().market({
      kind: "order_book",
      symbol: "BTCUSD",
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin).toBe("https://api.gemini.com");
    expect(url.pathname).toBe("/v1/book/btcusd");
    expect(url.searchParams.get("limit_bids")).toBe("20");
    expect(url.searchParams.get("limit_asks")).toBe("20");
  });

  it("signs a typed limit order without exposing the secret", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ order_id: "42", is_live: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await new GeminiApiAdapter().placeOrder(credentials, {
      symbol: "BTCUSD",
      side: "buy",
      amount: "0.01",
      price: "30000",
      execution: "maker_or_cancel",
      clientOrderId: "relay-order-1",
    });
    const [request, init] = fetchMock.mock.calls[0];
    expect(String(request)).toBe("https://api.gemini.com/v1/order/new");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-GEMINI-APIKEY"]).toBe("public-key");
    expect(headers["X-GEMINI-SIGNATURE"]).toMatch(/^[a-f0-9]{96}$/);
    expect(JSON.stringify(init)).not.toContain(credentials.apiSecret);
    const payload = JSON.parse(
      Buffer.from(headers["X-GEMINI-PAYLOAD"], "base64").toString("utf8"),
    );
    expect(payload).toMatchObject({
      request: "/v1/order/new",
      symbol: "btcusd",
      type: "exchange limit",
      options: ["maker-or-cancel"],
      client_order_id: "relay-order-1",
    });
  });

  it("rejects perpetual symbols before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new GeminiApiAdapter().market({
        kind: "ticker",
        symbol: "BTCGUSDPERP",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
