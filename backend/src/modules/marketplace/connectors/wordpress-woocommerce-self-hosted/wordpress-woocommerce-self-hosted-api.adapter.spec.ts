import { lookup } from "node:dns/promises";
import {
  WordPressWooCommerceSelfHostedApiAdapter,
  type WordPressWooCommerceSelfHostedCredentials,
} from "./wordpress-woocommerce-self-hosted-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: WordPressWooCommerceSelfHostedCredentials = {
  storeBaseUrl: "https://shop.example.test/store",
  productId: "34",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("WordPressWooCommerceSelfHostedApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("reads one product availability projection and strips content and pricing", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        id: 34,
        is_purchasable: true,
        is_in_stock: true,
        is_on_sale: false,
        name: "Private product copy",
        description: "Private description",
        prices: { price: "9999" },
        images: [{ src: "https://private.example/image.jpg" }],
        add_to_cart: { url: "?add-to-cart=34" },
      }),
    );
    await expect(
      new WordPressWooCommerceSelfHostedApiAdapter().getSelectedProductAvailability(
        credentials,
      ),
    ).resolves.toEqual({
      product: {
        productId: "34",
        isPurchasable: true,
        isInStock: true,
        isOnSale: false,
        privateStoreDataIncluded: false,
        productContentOrPricingIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://shop.example.test/store/wp-json/wc/store/v1/products/34",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({
      Accept: "application/json",
    });
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe("error");
  });

  it.each([
    "http://shop.example.test",
    "https://user@shop.example.test",
    "https://shop.example.test/store?rest_route=private",
    "https://shop.example.test/store#private",
    "https://shop.example.test/store/%2Fprivate",
  ])(
    "rejects an unsafe store base URL before network access: %s",
    async (storeBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new WordPressWooCommerceSelfHostedApiAdapter().getSelectedProductAvailability(
          { ...credentials, storeBaseUrl },
        ),
      ).rejects.toMatchObject({ code: "policy_blocked" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects private DNS resolution before network access", async () => {
    mockedLookup.mockResolvedValue([
      { address: "192.168.1.10", family: 4 },
    ] as never);
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new WordPressWooCommerceSelfHostedApiAdapter().getSelectedProductAvailability(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe product IDs before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new WordPressWooCommerceSelfHostedApiAdapter().getSelectedProductAvailability(
        { ...credentials, productId: "../orders" },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a response for a different product", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({
          id: 35,
          is_purchasable: true,
          is_in_stock: true,
          is_on_sale: false,
        }),
      );
    await expect(
      new WordPressWooCommerceSelfHostedApiAdapter().getSelectedProductAvailability(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
