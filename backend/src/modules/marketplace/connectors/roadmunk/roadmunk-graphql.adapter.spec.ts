import {
  RoadmunkGraphqlAdapter,
  RoadmunkGraphqlError,
} from "./roadmunk-graphql.adapter";

describe("RoadmunkGraphqlAdapter", () => {
  const api = new RoadmunkGraphqlAdapter();

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["na", "https://app-gateway.roadmunk.com/"],
    ["eu", "https://eu-gateway.roadmunk.com/"],
    ["apac", "https://apac-gateway.roadmunk.com/"],
  ] as const)("pins %s requests to its official gateway", async (region, origin) => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { account: { id: "account_1" } } }), {
          status: 200,
        }),
      );
    await api.health({ apiToken: "roadmunk_secret", region });
    expect(fetchMock.mock.calls[0][0]).toBe(origin);
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer roadmunk_secret");
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toContain(
      "roadmunk_secret",
    );
  });

  it("separates query and mutation surfaces", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { roadmaps: [] } }), { status: 200 }),
      );
    await api.query(
      { apiToken: "token", region: "na" },
      { document: "query ReadRoadmaps { roadmaps { id } }" },
    );
    await expect(
      api.query(
        { apiToken: "token", region: "na" },
        { document: "mutation DeleteRoadmap { deleteRoadmap(id: \"1\") { id } }" },
      ),
    ).rejects.toMatchObject<Partial<RoadmunkGraphqlError>>({ code: "policy_blocked" });
    await expect(
      api.mutate(
        { apiToken: "token", region: "na" },
        { document: "query ReadRoadmaps { roadmaps { id } }" },
      ),
    ).rejects.toMatchObject<Partial<RoadmunkGraphqlError>>({ code: "policy_blocked" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid regions, introspection, subscriptions, multiple operations, and credential variables", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      api.query(
        { apiToken: "token", region: "invalid" as "na" },
        { document: "query Account { account { id } }" },
      ),
    ).rejects.toMatchObject<Partial<RoadmunkGraphqlError>>({ code: "provider_validation_error" });
    await expect(
      api.query(
        { apiToken: "token", region: "eu" },
        { document: "query Schema { __schema { types { name } } }" },
      ),
    ).rejects.toMatchObject<Partial<RoadmunkGraphqlError>>({ code: "policy_blocked" });
    await expect(
      api.query(
        { apiToken: "token", region: "eu" },
        { document: "subscription Events { event { id } }" },
      ),
    ).rejects.toMatchObject<Partial<RoadmunkGraphqlError>>({ code: "policy_blocked" });
    await expect(
      api.query(
        { apiToken: "token", region: "eu" },
        { document: "query A { account { id } } query B { account { id } }" },
      ),
    ).rejects.toMatchObject<Partial<RoadmunkGraphqlError>>({ code: "policy_blocked" });
    await expect(
      api.query(
        { apiToken: "token", region: "eu" },
        {
          document: "query Roadmap($input: Input) { roadmap(input: $input) { id } }",
          variables: { apiToken: "leak" },
        },
      ),
    ).rejects.toMatchObject<Partial<RoadmunkGraphqlError>>({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps GraphQL auth errors and redacts credential-like response fields", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ errors: [{ message: "Unauthorized", extensions: { code: "UNAUTHENTICATED" } }] }),
        { status: 200 },
      ),
    );
    await expect(
      api.health({ apiToken: "bad", region: "apac" }),
    ).rejects.toMatchObject<Partial<RoadmunkGraphqlError>>({ code: "credential_missing" });

    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { createRoadmap: { id: "1", token: "leak" } } }), {
        status: 200,
      }),
    );
    await expect(
      api.mutate(
        { apiToken: "good", region: "apac" },
        { document: "mutation Create { createRoadmap { id token } }" },
      ),
    ).resolves.toEqual({ data: { createRoadmap: { id: "1", token: "[redacted]" } } });
  });
});
