import {
  BettermodeApiAdapter,
  type BettermodeCredentials,
} from "./bettermode-api.adapter";

const credentials: BettermodeCredentials = {
  region: "us",
  networkId: "network_123",
  memberId: "member_456",
  accessToken: "bettermode-test-token",
};
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

describe("BettermodeApiAdapter", () => {
  it("binds one fixed regional endpoint, Network, member, and Bearer token", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new BettermodeApiAdapter(async (url, init) => {
      requests.push({ url, init });
      const body = JSON.parse(String(init.body));
      if (body.query.includes("RelayBettermodeNetwork"))
        return json({
          data: {
            network: {
              id: "network_123",
              name: "Customer Community",
              domain: "community.example.com",
              locale: "en-US",
              status: "published",
              billingEmail: "private@example.com",
            },
          },
        });
      return json({
        data: {
          authMember: {
            id: "member_456",
            name: "Relay Operator",
            username: "relay-operator",
            status: "VERIFIED",
            teammate: true,
            role: { id: "role_1", name: "Moderator", scopes: ["private"] },
            email: "private@example.com",
            lastSeenAt: "2026-07-18T00:00:00Z",
          },
        },
      });
    });

    const result = await adapter.health(credentials);
    expect(result.network).toEqual(
      expect.objectContaining({
        id: "network_123",
        name: "Customer Community",
      }),
    );
    expect(result.actor).toEqual(
      expect.objectContaining({ id: "member_456", username: "relay-operator" }),
    );
    expect(requests.map(({ url }) => url)).toEqual([
      "https://api.bettermode.com/",
      "https://api.bettermode.com/",
    ]);
    expect(
      requests.map(({ init }) =>
        new Headers(init.headers).get("authorization"),
      ),
    ).toEqual(["Bearer bettermode-test-token", "Bearer bettermode-test-token"]);
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("rejects Network or member drift", async () => {
    const adapter = new BettermodeApiAdapter(async (_url, init) => {
      const query = JSON.parse(String(init.body)).query;
      return query.includes("RelayBettermodeNetwork")
        ? json({ data: { network: { id: "different_network" } } })
        : json({ data: { authMember: { id: "different_member" } } });
    });

    await expect(adapter.getNetwork(credentials)).rejects.toMatchObject({
      code: "policy_blocked",
    });
    await expect(adapter.getCurrentMember(credentials)).rejects.toMatchObject({
      code: "policy_blocked",
    });
  });

  it("uses bounded offsets and reduces Spaces and members", async () => {
    const requests: JsonObject[] = [];
    const adapter = new BettermodeApiAdapter(async (_url, init) => {
      const body = JSON.parse(String(init.body)) as JsonObject;
      requests.push(body);
      if (String(body.query).includes("RelayBettermodeSpaces"))
        return json({
          data: {
            spaces: {
              nodes: [
                {
                  id: "space_1",
                  name: "General",
                  slug: "general",
                  type: "Discussion",
                  membersCount: 40,
                  postsCount: 12,
                  description: "private Space description",
                  url: "https://private.example/space",
                },
              ],
              totalCount: 6,
            },
          },
        });
      return json({
        data: {
          members: {
            nodes: [
              {
                id: "member_1",
                name: "Member One",
                username: "member-one",
                status: "VERIFIED",
                score: 10,
                role: { id: "role_2", name: "Member" },
                email: "private@example.com",
                fields: [{ value: "private" }],
              },
            ],
            totalCount: 1,
          },
        },
      });
    });

    const spaces = await adapter.listSpaces(credentials, {
      page: 2,
      maxResults: 3,
    });
    const members = await adapter.listMembers(credentials, { maxResults: 5 });
    expect(spaces).toEqual(
      expect.objectContaining({ page: 2, limit: 3, hasNextPage: false }),
    );
    expect(spaces.items[0]).toEqual(
      expect.objectContaining({ id: "space_1", memberCount: 40 }),
    );
    expect(members.items[0]).toEqual(
      expect.objectContaining({
        id: "member_1",
        role: { id: "role_2", name: "Member" },
      }),
    );
    expect(requests[0].variables).toEqual({ limit: 3, offset: 3 });
    expect(JSON.stringify({ spaces, members })).not.toContain(
      "private Space description",
    );
    expect(JSON.stringify({ spaces, members })).not.toContain(
      "private@example.com",
    );
    expect(JSON.stringify({ spaces, members })).not.toContain(
      "https://private.example/space",
    );
  });

  it("reduces Space members and Post metadata without content or identity", async () => {
    const requests: JsonObject[] = [];
    const adapter = new BettermodeApiAdapter(async (_url, init) => {
      const body = JSON.parse(String(init.body)) as JsonObject;
      requests.push(body);
      if (String(body.query).includes("RelayBettermodeSpaceMembers"))
        return json({
          data: {
            spaceMembers: {
              nodes: [
                {
                  member: {
                    id: "member_1",
                    name: "Member One",
                    username: "member-one",
                    status: "VERIFIED",
                    email: "private@example.com",
                  },
                  role: { id: "space_role_1", name: "Member" },
                },
              ],
              totalCount: 1,
            },
          },
        });
      return json({
        data: {
          posts: {
            nodes: [
              {
                id: "post_1",
                title: "Release notes",
                spaceId: "space_1",
                status: "PUBLISHED",
                reactionsCount: 5,
                repliesCount: 2,
                locked: false,
                description: "private content",
                shortContent: "private excerpt",
                createdBy: { email: "private@example.com" },
                attachments: [{ url: "https://private.example/file" }],
              },
            ],
            totalCount: 1,
          },
        },
      });
    });

    const spaceMembers = await adapter.listSpaceMembers(credentials, {
      spaceId: "space_1",
      maxResults: 5,
    });
    const posts = await adapter.listPosts(credentials, {
      spaceId: "space_1",
      maxResults: 5,
    });
    expect(spaceMembers.items[0]).toEqual(
      expect.objectContaining({
        member: expect.objectContaining({ id: "member_1" }),
        role: { id: "space_role_1", name: "Member" },
      }),
    );
    expect(posts.items[0]).toEqual(
      expect.objectContaining({ id: "post_1", title: "Release notes" }),
    );
    expect(requests[1].variables).toEqual({
      spaceIds: ["space_1"],
      limit: 5,
      offset: 0,
    });
    expect(JSON.stringify({ spaceMembers, posts })).not.toContain("private");
  });

  it("changes exactly one existing member's Space membership", async () => {
    const requests: JsonObject[] = [];
    const adapter = new BettermodeApiAdapter(async (_url, init) => {
      const body = JSON.parse(String(init.body)) as JsonObject;
      requests.push(body);
      return String(body.query).includes("RelayBettermodeAddSpaceMember")
        ? json({
            data: {
              addSpaceMembers: [
                {
                  member: { id: "member_1", email: "private@example.com" },
                  space: { id: "space_1" },
                  role: { id: "role_1", name: "Member" },
                },
              ],
            },
          })
        : json({ data: { removeSpaceMembers: { status: "SUCCESS" } } });
    });

    await expect(
      adapter.addSpaceMember(credentials, {
        spaceId: "space_1",
        memberId: "member_1",
      }),
    ).resolves.toEqual({
      spaceId: "space_1",
      memberId: "member_1",
      added: true,
    });
    await expect(
      adapter.removeSpaceMember(credentials, {
        spaceId: "space_1",
        memberId: "member_1",
      }),
    ).resolves.toEqual({
      spaceId: "space_1",
      memberId: "member_1",
      removed: true,
    });
    expect(requests.map(({ variables }) => variables)).toEqual([
      { spaceId: "space_1", memberId: "member_1" },
      { spaceId: "space_1", memberId: "member_1" },
    ]);
  });

  it("rejects alternate regions and malformed IDs before network access", async () => {
    const request = jest.fn();
    const adapter = new BettermodeApiAdapter(request);
    await expect(
      adapter.getNetwork({ ...credentials, region: "https://evil.example" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.listSpaceMembers(credentials, { spaceId: "../admin" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listSpaces(credentials, { maxResults: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps HTTP and GraphQL denials without returning provider bodies", async () => {
    const limited = new BettermodeApiAdapter(async () =>
      json({ errors: [{ message: "private quota detail" }] }, 429, {
        "Retry-After": "8",
      }),
    );
    await expect(limited.getNetwork(credentials)).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
      details: { retryAfter: "8" },
      message: "Bettermode GraphQL request failed.",
    });

    const denied = new BettermodeApiAdapter(async () =>
      json({
        errors: [
          {
            message: "private provider detail",
            extensions: { code: "FORBIDDEN" },
          },
        ],
      }),
    );
    await expect(denied.getCurrentMember(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
      message: "Bettermode GraphQL request failed.",
    });
  });
});

type JsonObject = Record<string, unknown>;
