import { SlabGraphqlAdapter, SlabGraphqlError } from "./slab-graphql.adapter";

describe("SlabGraphqlAdapter", () => {
  const api = new SlabGraphqlAdapter();

  afterEach(() => jest.restoreAllMocks());

  it("pins requests to Slab GraphQL and attaches the token server-side", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { currentUser: { __typename: "CurrentUser" } },
          }),
          { status: 200 },
        ),
      );
    await api.health({ apiToken: "slab_secret" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.slab.com/graphql");
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("slab_secret");
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toContain(
      "slab_secret",
    );
  });

  it("separates query and mutation surfaces", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { post: { id: "post_1" } } }), {
          status: 200,
        }),
      );
    await api.query(
      { apiToken: "token" },
      {
        document: "query ReadPost($id: ID!) { post(id: $id) { id } }",
        variables: { id: "post_1" },
        operationName: "ReadPost",
      },
    );
    await expect(
      api.query(
        { apiToken: "token" },
        {
          document:
            'mutation DeletePost { postDelete(id: "post_1") { __typename } }',
        },
      ),
    ).rejects.toMatchObject<Partial<SlabGraphqlError>>({
      code: "policy_blocked",
    });
    await expect(
      api.mutate(
        { apiToken: "token" },
        { document: 'query ReadPost { post(id: "post_1") { id } }' },
      ),
    ).rejects.toMatchObject<Partial<SlabGraphqlError>>({
      code: "policy_blocked",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts shorthand queries and reusable fragments", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ data: { __typename: "RootQueryType" } }), {
        status: 200,
      }),
    );
    await api.query({ apiToken: "token" }, { document: "{ __typename }" });
    await api.query(
      { apiToken: "token" },
      {
        document:
          "fragment PostIdentity on Post { id } query ReadPost { post(id: \"post_1\") { ...PostIdentity } }",
        operationName: "ReadPost",
      },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects introspection, subscriptions, multiple operations, and credential variables", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      api.query(
        { apiToken: "token" },
        { document: "query Schema { __schema { types { name } } }" },
      ),
    ).rejects.toMatchObject<Partial<SlabGraphqlError>>({
      code: "policy_blocked",
    });
    await expect(
      api.query(
        { apiToken: "token" },
        { document: "subscription Events { event { id } }" },
      ),
    ).rejects.toMatchObject<Partial<SlabGraphqlError>>({
      code: "policy_blocked",
    });
    await expect(
      api.query(
        { apiToken: "token" },
        { document: "query A { __typename } query B { __typename }" },
      ),
    ).rejects.toMatchObject<Partial<SlabGraphqlError>>({
      code: "policy_blocked",
    });
    await expect(
      api.query(
        { apiToken: "token" },
        {
          document: "query P($input: Input) { post(input: $input) { id } }",
          variables: { apiToken: "leak" },
        },
      ),
    ).rejects.toMatchObject<Partial<SlabGraphqlError>>({
      code: "policy_blocked",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps GraphQL auth errors and redacts credential-like response fields", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            errors: [
              { message: "UNAUTHORIZED", extensions: { code: "UNAUTHORIZED" } },
            ],
          }),
          { status: 200 },
        ),
      );
    await expect(api.health({ apiToken: "bad" })).rejects.toMatchObject<
      Partial<SlabGraphqlError>
    >({ code: "credential_missing" });

    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { create: { id: "1", token: "leak" } } }),
          { status: 200 },
        ),
      );
    await expect(
      api.mutate(
        { apiToken: "good" },
        { document: "mutation Create { createPost { id token } }" },
      ),
    ).resolves.toEqual({ data: { create: { id: "1", token: "[redacted]" } } });
  });
});
