import { ApolloIoApiAdapter, ApolloIoApiError } from "./apollo-io-api.adapter";

describe("ApolloIoApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("runs one bounded OAuth people search and minimizes results", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pagination: { page: 2, per_page: 5 },
          people: [
            {
              id: "person-1",
              first_name: "Ada",
              last_name: "Lovelace",
              title: "Director of Engineering",
              email: "private@example.com",
              phone_numbers: ["555-0100"],
              organization: {
                id: "org-1",
                name: "Example",
                website_url: "https://example.com",
                primary_phone: "555-0200",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new ApolloIoApiAdapter().read(
      "oauth-access-token",
      "people.search",
      { query: "engineering director", page: 2, limit: 5 },
    );
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL("https://api.apollo.io/api/v1/mixed_people/api_search"),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-access-token",
        }),
        redirect: "error",
      }),
    );
    expect(JSON.parse(String(request?.body))).toEqual({
      q_keywords: "engineering director",
      page: 2,
      per_page: 5,
    });
    expect(result).toEqual({
      pagination: { page: 2, per_page: 5 },
      people: [
        {
          id: "person-1",
          first_name: "Ada",
          last_name: "Lovelace",
          title: "Director of Engineering",
          organization: {
            id: "org-1",
            name: "Example",
            website_url: "https://example.com",
          },
        },
      ],
    });
  });

  it("blocks arbitrary operations, unknown inputs, and broad pages", async () => {
    const adapter = new ApolloIoApiAdapter();
    expect(() =>
      adapter.read("token", "contacts.create", { query: "x" }),
    ).toThrow(ApolloIoApiError);
    expect(() =>
      adapter.read("token", "contacts.search", {
        query: "sales",
        email: "private@example.com",
      } as never),
    ).toThrow("pinned search inputs");
    expect(() =>
      adapter.read("token", "people.search", { query: "sales", limit: 26 }),
    ).toThrow("integer from 1 to 25");
  });
});
