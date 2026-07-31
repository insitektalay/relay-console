import { HealthieGraphqlAdapter, HealthieGraphqlError } from "./healthie-graphql.adapter";

describe("HealthieGraphqlAdapter", () => {
  const adapter = new HealthieGraphqlAdapter();

  it("rejects mutations sent through the query wrapper before network access", async () => {
    await expect(
      adapter.query(
        { apiKey: "test-key" },
        { document: "mutation ChangePatient { updateClient(input: {}) { messages { message } } }" },
      ),
    ).rejects.toMatchObject<Partial<HealthieGraphqlError>>({ code: "policy_blocked" });
  });

  it("rejects subscriptions and introspection", async () => {
    await expect(
      adapter.query(
        { apiKey: "test-key" },
        { document: "query Schema { __schema { queryType { name } } }" },
      ),
    ).rejects.toMatchObject<Partial<HealthieGraphqlError>>({ code: "policy_blocked" });
  });

  it("rejects credential-shaped GraphQL variables", async () => {
    await expect(
      adapter.query(
        { apiKey: "test-key" },
        {
          document: "query Patient($input: String) { currentUser { id } }",
          variables: { access_token: "blocked" },
        },
      ),
    ).rejects.toMatchObject<Partial<HealthieGraphqlError>>({ code: "policy_blocked" });
  });
});
