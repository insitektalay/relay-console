import { KrakenApiAdapter, krakenSignature } from "./kraken-api.adapter";
import { KRAKEN_CONNECTOR_MANIFEST } from "./kraken.connector";

describe("Kraken connector", () => {
  // Kraken publishes this inert key solely as a signature test vector.
  const documentedTestSecret = [
    "kQH5HW/8p1uGOVjbgWA7FunAmGO8lsSU",
    "XNsu3eow76sz84Q18fWxnyRzBHCd3pd5",
    "nE9qa99HAZtuZuj6F1huXg==",
  ].join("");
  const credentials = {
    apiKey: "public-key",
    apiSecret: documentedTestSecret,
  };

  afterEach(() => jest.restoreAllMocks());

  it("matches Kraken's official Spot REST signing vector", () => {
    const nonce = "1616492376594";
    const payload =
      "nonce=1616492376594&ordertype=limit&pair=XBTUSD&price=37500&type=buy&volume=1.25";
    expect(
      krakenSignature(
        "/0/private/AddOrder",
        nonce,
        payload,
        credentials.apiSecret,
      ),
    ).toBe(
      "4/dpxb3iT4tp/ZCVEwSnEsLxx0bqyhLpdfOpc6fn7OR8+UClSV5n9E6aSS8MPtnRfp32bAb0nmbRn6H8ndwLUQ==",
    );
  });

  it("publishes the complete bounded V1 under both policies", () => {
    expect(KRAKEN_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "kraken.market.read",
      "kraken.account.read",
      "kraken.order.place",
      "kraken.order.cancel",
    ]);
    expect(
      KRAKEN_CONNECTOR_MANIFEST.approvalProfiles
        .find((profile) => profile.id === "kraken_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual([
      "kraken_account_read",
      "kraken_order_place",
      "kraken_order_cancel",
    ]);
    expect(
      KRAKEN_CONNECTOR_MANIFEST.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.allowedActions,
    ).toHaveLength(4);
  });

  it("pins public market reads to Kraken and bounds order-book depth", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: [],
          result: { XXBTZUSD: { bids: [], asks: [] } },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    await new KrakenApiAdapter().market({
      kind: "order_book",
      pair: "XBT/USD",
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin).toBe("https://api.kraken.com");
    expect(url.pathname).toBe("/0/public/Depth");
    expect(url.searchParams.get("count")).toBe("25");
  });

  it("signs a typed order without exposing the private key", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: [], result: { txid: ["ABC-123"] } }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    await new KrakenApiAdapter().placeOrder(credentials, {
      pair: "XBTUSD",
      side: "buy",
      orderType: "limit",
      volume: "0.01",
      price: "30000",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.kraken.com/0/private/AddOrder");
    expect((init?.headers as Record<string, string>)["API-Key"]).toBe(
      "public-key",
    );
    expect((init?.headers as Record<string, string>)["API-Sign"]).toMatch(
      /^[A-Za-z0-9+/]+=*$/,
    );
    expect(String(init?.body)).not.toContain(credentials.apiSecret);
    expect(String(init?.body)).toContain("ordertype=limit");
  });

  it("rejects malformed orders before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new KrakenApiAdapter().placeOrder(credentials, {
        pair: "XBTUSD",
        side: "buy",
        orderType: "limit",
        volume: "1",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
