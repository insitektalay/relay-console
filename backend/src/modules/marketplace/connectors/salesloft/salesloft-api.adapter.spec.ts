import {
  SalesloftApiAdapter,
  SalesloftApiError,
} from "./salesloft-api.adapter";

describe("SalesloftApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the first bounded page and minimizes account records", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 7,
              name: "Example",
              domain: "example.com",
              industry: "Software",
              email_address: "private@example.com",
              custom_fields: { confidential: true },
            },
          ],
          metadata: { current_page: 1, next_page: 2 },
        }),
        { status: 200 },
      ),
    );
    const result = await new SalesloftApiAdapter().read(
      "oauth-access-token",
      "accounts.list",
    );
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://api.salesloft.com/v2/accounts?per_page=25&page=1&include_paging_counts=false",
      ),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-access-token",
          Accept: "application/json",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      data: [
        {
          id: 7,
          name: "Example",
          domain: "example.com",
          industry: "Software",
        },
      ],
      hasNextPage: true,
    });
  });

  it("blocks people, arbitrary filters, and mutating operations", () => {
    expect(() =>
      new SalesloftApiAdapter().read("token", "people.list"),
    ).toThrow(SalesloftApiError);
    expect(() =>
      new SalesloftApiAdapter().read("token", "cadences.update"),
    ).toThrow("pinned read-only contract");
  });
});
