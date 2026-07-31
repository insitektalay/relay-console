import { lookup } from "node:dns/promises";
import {
  MagentoSelfHostedApiAdapter,
  type MagentoSelfHostedCredentials,
} from "./magento-self-hosted-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: MagentoSelfHostedCredentials = {
  commerceBaseUrl: "https://commerce.example.test/shop",
  productSku: "SKU-34",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("MagentoSelfHostedApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("reads one selected SKU stock projection and strips content and pricing", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          products: {
            total_count: 1,
            items: [
              {
                sku: "SKU-34",
                stock_status: "IN_STOCK",
                name: "Private product copy",
                price_range: { minimum_price: { regular_price: 9999 } },
              },
            ],
          },
        },
      }),
    );
    await expect(
      new MagentoSelfHostedApiAdapter().getSelectedProductStock(credentials),
    ).resolves.toEqual({
      product: {
        productSku: "SKU-34",
        stockStatus: "IN_STOCK",
        inStock: true,
        productContentOrPricingIncluded: false,
        customerCartOrOrderDataIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://commerce.example.test/shop/graphql",
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      variables: { sku: "SKU-34" },
    });
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain("stock_status");
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toContain(
      "price_range",
    );
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe("error");
  });

  it.each([
    "http://commerce.example.test",
    "https://user@commerce.example.test",
    "https://commerce.example.test/shop?query=private",
    "https://commerce.example.test/shop#private",
    "https://commerce.example.test/shop/%2Fprivate",
  ])(
    "rejects an unsafe base URL before network access: %s",
    async (commerceBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new MagentoSelfHostedApiAdapter().getSelectedProductStock({
          ...credentials,
          commerceBaseUrl,
        }),
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
      new MagentoSelfHostedApiAdapter().getSelectedProductStock(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe SKUs before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new MagentoSelfHostedApiAdapter().getSelectedProductStock({
        ...credentials,
        productSku: "../orders",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a response for a different SKU", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          products: {
            total_count: 1,
            items: [{ sku: "SKU-35", stock_status: "IN_STOCK" }],
          },
        },
      }),
    );
    await expect(
      new MagentoSelfHostedApiAdapter().getSelectedProductStock(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("maps GraphQL errors without exposing provider details", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() => json({ errors: [{ message: "private" }] }));
    await expect(
      new MagentoSelfHostedApiAdapter().getSelectedProductStock(credentials),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      message: "Magento rejected the selected-product stock query.",
    });
  });
});
