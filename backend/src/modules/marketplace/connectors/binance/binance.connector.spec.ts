import { BinanceApiAdapter, binanceSignature } from "./binance-api.adapter";
import { BINANCE_CONNECTOR_MANIFEST } from "./binance.connector";

describe("Binance connector", () => {
  const credentials = { apiKey: "public-key", apiSecret: "secret-key" };

  afterEach(() => jest.restoreAllMocks());

  it("matches the documented HMAC SHA256 construction", () => {
    expect(
      binanceSignature(
        "symbol=LTCBTC&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559",
        "NhqPtmdSJYdKjVHjA7PZj4Mge3R5YNiP1e3UZjInClVN65XAbvqqM6A7H5fATj0j",
      ),
    ).toBe("c8db56825ae71d6d79447849e617115f4a920fa2acdcab2b053c4b2838bd6b71");
  });

  it("publishes the complete bounded V1 under both policies", () => {
    expect(BINANCE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "binance.market.read",
      "binance.account.read",
      "binance.order.place",
      "binance.order.cancel",
    ]);
    expect(
      BINANCE_CONNECTOR_MANIFEST.approvalProfiles
        .find((profile) => profile.id === "binance_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual([
      "binance_account_read",
      "binance_order_place",
      "binance_order_cancel",
    ]);
    expect(
      BINANCE_CONNECTOR_MANIFEST.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.allowedActions,
    ).toHaveLength(4);
  });

  it("pins public reads to Binance and bounds order-book depth", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ lastUpdateId: 1, bids: [], asks: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await new BinanceApiAdapter().market({
      kind: "order_book",
      symbol: "BTCUSDT",
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin).toBe("https://api.binance.com");
    expect(url.pathname).toBe("/api/v3/depth");
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("signs a typed order without exposing the secret", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ symbol: "BTCUSDT", orderId: 42 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await new BinanceApiAdapter().placeOrder(credentials, {
      symbol: "BTCUSDT",
      side: "buy",
      orderType: "limit",
      quantity: "0.01",
      price: "30000",
    });
    const [request, init] = fetchMock.mock.calls[0];
    const url = new URL(String(request));
    expect(url.origin).toBe("https://api.binance.com");
    expect(url.pathname).toBe("/api/v3/order");
    expect(url.searchParams.get("signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(String(request)).not.toContain(credentials.apiSecret);
    expect((init?.headers as Record<string, string>)["X-MBX-APIKEY"]).toBe(
      "public-key",
    );
    expect(url.searchParams.get("type")).toBe("LIMIT");
    expect(url.searchParams.get("timeInForce")).toBe("GTC");
  });

  it("rejects malformed orders before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new BinanceApiAdapter().placeOrder(credentials, {
        symbol: "BTCUSDT",
        side: "buy",
        orderType: "limit",
        quantity: "1",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
