import {
  RewardfulApiAdapter,
  RewardfulApiError,
} from "./rewardful-api.adapter";

describe("RewardfulApiAdapter", () => {
  const credentials = { apiSecret: "customer-api-secret" };
  afterEach(() => jest.restoreAllMocks());

  it("uses Basic auth on a pinned bounded collection read", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pagination: { current_page: 2, limit: 5 },
          data: [
            {
              id: "39e68c88-d84a-4510-b3b4-43c75016a080",
              amount: 3000,
              currency: "USD",
              state: "due",
              sale: { customer: { email: "private@example.com" } },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new RewardfulApiAdapter().read(
      credentials,
      "commissions.list",
      { page: 2, limit: 5, state: "due" },
    );
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://api.getrewardful.com/v1/commissions?page=2&limit=5&state=due",
      ),
    );
    expect(String(url)).not.toContain("customer-api-secret");
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("customer-api-secret:").toString("base64")}`,
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      pagination: { current_page: 2, limit: 5 },
      data: [
        {
          id: "39e68c88-d84a-4510-b3b4-43c75016a080",
          amount: 3000,
          currency: "USD",
          state: "due",
        },
      ],
    });
  });

  it("removes affiliate identity and payment fields from summaries", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pagination: { current_page: 1 },
          data: [
            {
              id: "d0ed8392-8880-4f39-8715-60230f9eceab",
              first_name: "Private",
              last_name: "Person",
              email: "private@example.com",
              paypal_email: "pay@example.com",
              state: "active",
              visitors: 10,
              campaign: {
                id: "c3482343-8680-40c5-af9a-9efa119713b5",
                name: "Partners",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    await expect(
      new RewardfulApiAdapter().read(credentials, "affiliates.list", {}),
    ).resolves.toEqual({
      pagination: { current_page: 1 },
      data: [
        {
          id: "d0ed8392-8880-4f39-8715-60230f9eceab",
          state: "active",
          visitors: 10,
          campaign: {
            id: "c3482343-8680-40c5-af9a-9efa119713b5",
            name: "Partners",
          },
        },
      ],
    });
  });

  it("blocks arbitrary operations, unsafe filters, and oversized pages", () => {
    const adapter = new RewardfulApiAdapter();
    expect(() => adapter.read(credentials, "raw.request", {})).toThrow(
      RewardfulApiError,
    );
    expect(() =>
      adapter.read(credentials, "affiliates.list", {
        email: "private@example.com",
      } as never),
    ).toThrow("pinned operation inputs");
    expect(() =>
      adapter.read(credentials, "commissions.list", { limit: 26 }),
    ).toThrow("integer from 1 to 25");
  });
});
