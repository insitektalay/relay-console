import { lookup } from "node:dns/promises";
import {
  PrestaShopSelfHostedApiAdapter,
  type PrestaShopSelfHostedCredentials,
} from "./prestashop-self-hosted-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: PrestaShopSelfHostedCredentials = {
  shopBaseUrl: "https://shop.example.test/prestashop",
  webserviceKey: "A".repeat(32),
  productId: "34",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("PrestaShopSelfHostedApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("reads one projected product availability response", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        products: [
          {
            id: 34,
            active: "1",
            available_for_order: 1,
            name: "Private product copy",
            price: "99.00",
          },
        ],
      }),
    );
    await expect(
      new PrestaShopSelfHostedApiAdapter().getSelectedProductAvailability(
        credentials,
      ),
    ).resolves.toEqual({
      product: {
        productId: "34",
        active: true,
        availableForOrder: true,
        productContentOrPricingIncluded: false,
        customerCartOrOrderDataIncluded: false,
      },
    });
    const url = new URL(fetchMock.mock.calls[0][0].toString());
    expect(url.origin + url.pathname).toBe(
      "https://shop.example.test/prestashop/api/products",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      "filter[id]": "[34]",
      display: "[id,active,available_for_order]",
      output_format: "JSON",
    });
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${"A".repeat(32)}:`).toString("base64")}`,
    });
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe("error");
  });

  it.each([
    "http://shop.example.test",
    "https://user@shop.example.test",
    "https://shop.example.test/prestashop?api=private",
    "https://shop.example.test/prestashop#private",
    "https://shop.example.test/prestashop/%2Fprivate",
  ])(
    "rejects an unsafe shop base URL before network access: %s",
    async (shopBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new PrestaShopSelfHostedApiAdapter().getSelectedProductAvailability({
          ...credentials,
          shopBaseUrl,
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
      new PrestaShopSelfHostedApiAdapter().getSelectedProductAvailability(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid keys and unsafe product IDs before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new PrestaShopSelfHostedApiAdapter().getSelectedProductAvailability({
        ...credentials,
        webserviceKey: "short",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new PrestaShopSelfHostedApiAdapter().getSelectedProductAvailability({
        ...credentials,
        productId: "../orders",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a response for a different product", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({ products: [{ id: 35, active: 1, available_for_order: 1 }] }),
      );
    await expect(
      new PrestaShopSelfHostedApiAdapter().getSelectedProductAvailability(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
