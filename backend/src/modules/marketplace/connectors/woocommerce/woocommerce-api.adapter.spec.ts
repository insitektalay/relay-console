import { lookup } from "node:dns/promises";
import {
  WooCommerceApiAdapter,
  WooCommerceApiError,
} from "./woocommerce-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

describe("WooCommerceApiAdapter", () => {
  const api = new WooCommerceApiAdapter();
  const credentials = {
    storeOrigin: "https://shop.example.com",
    consumerKey: "ck_test",
    consumerSecret: "cs_test",
  };
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "203.0.113.10", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("pins requests to one HTTPS store, REST v3, Basic auth, and no redirects", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ environment: { version: "10.8" } }), {
          status: 200,
        }),
      );
    await api.health(credentials);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://shop.example.com/wp-json/wc/v3/system_status",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("ck_test:cs_test").toString("base64")}`,
    );
    expect(init?.redirect).toBe("error");
  });

  it.each([
    "http://shop.example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://shop.example.com/path",
    "https://user@shop.example.com",
  ])("rejects an unsafe store origin: %s", (storeOrigin) => {
    expect(() =>
      api.prepareProductChange(
        { ...credentials, storeOrigin },
        { operation: "create", name: "Draft" },
      ),
    ).toThrow(WooCommerceApiError);
  });

  it("rejects a store that resolves to any private address before fetch", async () => {
    mockedLookup.mockResolvedValue([
      { address: "10.0.0.2", family: 4 },
    ] as never);
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(api.health(credentials)).rejects.toMatchObject({
      code: "policy_blocked",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds product pagination and returns WordPress totals", async () => {
    const headers = new Headers({ "X-WP-Total": "42", "X-WP-TotalPages": "2" });
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ id: 1, name: "One" }]), {
          status: 200,
          headers,
        }),
      );
    await expect(
      api.listProducts(credentials, { page: 2, maxResults: 25 }),
    ).resolves.toEqual(
      expect.objectContaining({
        pagination: { page: 2, total: 42, totalPages: 2 },
      }),
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "page=2&per_page=25&orderby=modified&order=desc",
    );
  });

  it("prepares and hashes a draft without calling WooCommerce", () => {
    const fetchMock = jest.spyOn(global, "fetch");
    expect(
      api.prepareProductChange(credentials, {
        operation: "create",
        name: "Relay launch",
        categoryIds: [7],
      }),
    ).toEqual(
      expect.objectContaining({
        operation: "create",
        name: "Relay launch",
        providerSideEffect: false,
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forces new products to draft status", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: 1, name: "Draft", status: "draft" }),
          { status: 200 },
        ),
      );
    await api.createDraftProduct(credentials, { name: "Draft" });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: "Draft",
      status: "draft",
    });
  });

  it("requires exact draft state and modification time before publication", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 1,
            status: "draft",
            date_modified_gmt: "2026-07-16T22:00:00",
          }),
          { status: 200 },
        ),
      );
    await expect(
      api.publishProduct(credentials, {
        productId: 1,
        expectedDateModifiedGMT: "2026-07-16T21:59:00",
      }),
    ).rejects.toMatchObject({ code: "approval_mismatch" });
  });

  it("maps provider failures to bounded safe errors without returning credentials", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "woocommerce_rest_cannot_view",
            message: "Sorry, you cannot list resources.",
            consumer_key: "ck_leak",
          }),
          { status: 401 },
        ),
      );
    await expect(api.health(credentials)).rejects.toMatchObject({
      code: "credential_missing",
      message: "Sorry, you cannot list resources.",
    });
  });
});
