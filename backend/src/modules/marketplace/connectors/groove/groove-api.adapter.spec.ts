import { GrooveApiAdapter } from "./groove-api.adapter";
import { GROOVE_CONNECTOR_MANIFEST } from "./groove.connector";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Groove connector", () => {
  const credentials = {
    apiToken: "groove-api-token",
    accountId: "account-123",
  };

  it("matches the current customer-token GraphQL manifest", () => {
    expect(GROOVE_CONNECTOR_MANIFEST.auth).toMatchObject({ type: "api_key" });
    expect(GROOVE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "groove.getAccount",
      "groove.listChannels",
      "groove.graphql",
    ]);
    expect(
      GROOVE_CONNECTOR_MANIFEST.approvalProfiles
        .find((profile) => profile.id === "groove_safe")
        ?.approvalRequiredActions.map((item) => item.id),
    ).toEqual(["groove_full_api"]);
  });

  it("verifies the fixed endpoint and exact account binding", async () => {
    const requester = jest.fn().mockResolvedValue(
      response({
        data: {
          ping: "pong",
          account: { id: "account-123", subdomain: "relay", state: "active" },
        },
      }),
    );
    const adapter = new GrooveApiAdapter(requester);

    await expect(adapter.health(credentials)).resolves.toEqual({
      id: "account-123",
      subdomain: "relay",
      state: "active",
      ping: "pong",
    });
    expect(requester).toHaveBeenCalledWith(
      "https://api.groovehq.com/v2/graphql",
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer groove-api-token",
        }),
      }),
    );
  });

  it("rejects a changed token-bound account identity", async () => {
    const adapter = new GrooveApiAdapter(
      jest
        .fn()
        .mockResolvedValue(
          response({ data: { account: { id: "different-account" } } }),
        ),
    );

    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
      statusCode: 403,
    });
  });

  it("lists bounded channels and preserves the account boundary", async () => {
    const requester = jest.fn().mockResolvedValue(
      response({
        data: {
          account: { id: "account-123" },
          channels: {
            nodes: [
              {
                __typename: "EmailChannel",
                id: "channel-1",
                name: "Support",
                conversationCount: 42,
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
    );
    const adapter = new GrooveApiAdapter(requester);

    await expect(
      adapter.listChannels(credentials, { limit: 10 }),
    ).resolves.toEqual({
      channels: [
        {
          type: "EmailChannel",
          id: "channel-1",
          name: "Support",
          conversationCount: 42,
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    });
    expect(JSON.parse(String(requester.mock.calls[0][1].body))).toMatchObject({
      variables: { first: 10 },
    });
  });

  it("requires exact-account verification before a full GraphQL operation", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          data: {
            ping: "pong",
            account: { id: "account-123", subdomain: "relay", state: "active" },
          },
        }),
      )
      .mockResolvedValueOnce(
        response({ data: { conversations: { nodes: [] } } }),
      );
    const adapter = new GrooveApiAdapter(requester);

    await expect(
      adapter.graphql(credentials, {
        query:
          "query RelayConversations { conversations(first: 1) { nodes { id } } }",
        variables: {},
      }),
    ).resolves.toEqual({ data: { conversations: { nodes: [] } } });
    expect(requester).toHaveBeenCalledTimes(2);
  });

  it("rejects credential-bearing GraphQL variables", async () => {
    const adapter = new GrooveApiAdapter(jest.fn());

    await expect(
      adapter.graphql(credentials, {
        query: "query RelayAccount { account { id } }",
        variables: { apiToken: "do-not-forward" },
      }),
    ).rejects.toMatchObject({
      code: "policy_blocked",
      statusCode: 403,
    });
  });
});
