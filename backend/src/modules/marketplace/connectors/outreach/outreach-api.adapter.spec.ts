import { OutreachApiAdapter, OutreachApiError } from "./outreach-api.adapter";

describe("OutreachApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins a bounded JSON API collection and minimizes records", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              type: "account",
              id: 7,
              attributes: {
                name: "Example",
                domain: "example.com",
                industry: "Software",
                ownerEmail: "private@example.com",
                custom1: "sensitive",
              },
            },
          ],
          links: { next: "https://api.outreach.io/api/v2/accounts?page=next" },
        }),
        { status: 200 },
      ),
    );
    const result = await new OutreachApiAdapter().read(
      "oauth-access-token",
      "accounts.list",
    );
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://api.outreach.io/api/v2/accounts?page%5Bsize%5D=25&count=false",
      ),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-access-token",
          Accept: "application/vnd.api+json",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      data: [
        {
          id: 7,
          type: "account",
          attributes: {
            name: "Example",
            domain: "example.com",
            industry: "Software",
          },
        },
      ],
      hasNextPage: true,
    });
  });

  it("blocks arbitrary and mutating operations", () => {
    expect(() =>
      new OutreachApiAdapter().read("token", "prospects.list"),
    ).toThrow(OutreachApiError);
    expect(() =>
      new OutreachApiAdapter().read("token", "sequences.update"),
    ).toThrow("pinned read-only contract");
  });
});
