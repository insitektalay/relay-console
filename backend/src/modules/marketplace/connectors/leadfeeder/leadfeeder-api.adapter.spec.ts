import {
  LeadfeederApiAdapter,
  LeadfeederApiError,
} from "./leadfeeder-api.adapter";

describe("LeadfeederApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the unfiltered account list and removes credit details", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              type: "account",
              id: "123456",
              attributes: {
                name: "Account 1",
                credits: { available: 1000, used: 200, remaining: 800 },
              },
            },
          ],
          meta: { request_id: "private-request-id" },
        }),
        { status: 200 },
      ),
    );
    await expect(
      new LeadfeederApiAdapter().read(
        { apiKey: "customer-api-key" },
        "accounts.list",
      ),
    ).resolves.toEqual({
      accounts: [{ id: "123456", type: "account", name: "Account 1" }],
      truncated: false,
    });
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(new URL("https://api.leadfeeder.com/v1/accounts"));
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "X-Api-Key": "customer-api-key",
        }),
        redirect: "error",
      }),
    );
  });

  it("blocks every broader operation before making a request", () => {
    expect(() =>
      new LeadfeederApiAdapter().read({ apiKey: "key" }, "companies.search"),
    ).toThrow(LeadfeederApiError);
  });
});
