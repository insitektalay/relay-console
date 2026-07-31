import {
  RespondentApiAdapter,
  RespondentApiError,
} from "./respondent-api.adapter";

describe("RespondentApiAdapter", () => {
  const credentials = {
    clientId: "partner-client",
    clientSecret: "partner-secret",
  };
  afterEach(() => jest.restoreAllMocks());

  it("uses both partner headers and minimizes a bounded skill search", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          page: 2,
          pageSize: 5,
          totalResults: 900,
          results: [
            {
              id: "skill_1",
              name: "TypeScript",
              slug: "typescript",
              type: "certification",
              validated: true,
              count: 42,
              privateField: "omit",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new RespondentApiAdapter().read(
      credentials,
      "skills.list",
      { page: 2, limit: 5, query: "type" },
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toEqual(
      new URL(
        "https://api.respondent.io/v1/skills?page=2&pageSize=5&includeCount=false&query=type",
      ),
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-api-key": "partner-client",
          "x-api-secret": "partner-secret",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      page: 2,
      pageSize: 5,
      results: [
        {
          id: "skill_1",
          name: "TypeScript",
          slug: "typescript",
          type: "certification",
          validated: true,
        },
      ],
    });
  });

  it("blocks participant APIs and industry search parameters", async () => {
    expect(() =>
      new RespondentApiAdapter().read(credentials, "profiles.get", {}),
    ).toThrow(RespondentApiError);
    expect(() =>
      new RespondentApiAdapter().read(credentials, "industries.list", {
        query: "software",
      }),
    ).toThrow("query is not supported");
  });
});
