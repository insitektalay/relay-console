import {
  AskNicelyApiAdapter,
  AskNicelyApiError,
} from "./asknicely-api.adapter";

describe("AskNicelyApiAdapter", () => {
  const credentials = { subdomain: "customer", apiKey: "customer-key" };
  afterEach(() => jest.restoreAllMocks());

  it("pins the tenant host and bounds response pages", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 1 }],
            pages: 1,
            pagenumber: 2,
            pagesize: 5,
          }),
          { status: 200 },
        ),
      );
    const result = await new AskNicelyApiAdapter().read(
      credentials,
      "responses.list",
      { page: 2, limit: 5, since: 0 },
    );
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL("https://customer.asknice.ly/api/v1/responses/desc/5/2/0/json"),
    );
    expect(String(url)).not.toContain("customer-key");
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "X-apikey": "customer-key" }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      success: undefined,
      responses: [{ id: 1 }],
      page: 2,
      pageSize: 5,
      totalPages: 1,
    });
  });

  it("blocks arbitrary operations, tenant injection, and oversized lists", async () => {
    const adapter = new AskNicelyApiAdapter();
    expect(() => adapter.read(credentials, "raw.request", {})).toThrow(
      AskNicelyApiError,
    );
    await expect(
      adapter.read(
        { ...credentials, subdomain: "evil.example.com" },
        "nps.get",
        {},
      ),
    ).rejects.toThrow("tenant subdomain");
    expect(() =>
      adapter.read(credentials, "responses.list", { limit: 26 }),
    ).toThrow("integer from 1 to 25");
  });
});
