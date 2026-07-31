import {
  VanillaForumsApiAdapter,
  type VanillaForumsCredentials,
} from "./vanilla-forums-api.adapter";

const credentials: VanillaForumsCredentials = {
  baseUrl: "https://community.example.com",
  accessToken: "vanilla-test-token",
};
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

describe("VanillaForumsApiAdapter", () => {
  it("binds Bearer authentication to one exact public HTTPS community", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new VanillaForumsApiAdapter(async (url, init) => {
      requests.push({ url, init });
      return json({
        userID: 7,
        name: "Relay Operator",
        admin: true,
        moderator: false,
        roles: [{ roleID: 2, name: "Administrator" }],
        email: "private@example.com",
        profileFields: { company: "private" },
      });
    });

    const result = await adapter.getCurrentUser(credentials);
    expect(result.user).toEqual(
      expect.objectContaining({
        id: 7,
        name: "Relay Operator",
        admin: true,
        roleNames: ["Administrator"],
      }),
    );
    const url = new URL(requests[0].url);
    expect(url.origin).toBe("https://community.example.com");
    expect(url.pathname).toBe("/api/v2/users/me");
    expect(url.searchParams.get("fields")).toBe(
      "userID,name,admin,moderator,roles,rankID",
    );
    expect(new Headers(requests[0].init.headers).get("authorization")).toBe(
      "Bearer vanilla-test-token",
    );
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("requests bounded reduced Category and Badge fields", async () => {
    const requests: string[] = [];
    const adapter = new VanillaForumsApiAdapter(async (url) => {
      requests.push(url);
      if (url.includes("/categories"))
        return json(
          [
            {
              categoryID: 3,
              name: "Support",
              urlcode: "support",
              countDiscussions: 10,
              countComments: 25,
              description: "private category copy",
            },
          ],
          200,
          { "X-App-Page-Next-Url": "https://private.example/next" },
        );
      return json([
        {
          badgeID: 8,
          name: "Helper",
          enabled: true,
          points: 10,
          photoUrl: "https://private.example/badge.png",
        },
      ]);
    });

    const categories = await adapter.listCategories(credentials, {
      page: 2,
      maxResults: 5,
    });
    const badges = await adapter.listBadges(credentials, { maxResults: 5 });
    expect(categories).toEqual(
      expect.objectContaining({ page: 2, limit: 5, hasNextPage: true }),
    );
    expect(categories.items[0]).toEqual(
      expect.objectContaining({ id: 3, slug: "support", discussionCount: 10 }),
    );
    expect(badges.items[0]).toEqual(
      expect.objectContaining({ id: 8, name: "Helper", enabled: true }),
    );
    expect(JSON.stringify({ categories, badges })).not.toContain("private");
    expect(new URL(requests[0]).searchParams.get("limit")).toBe("5");
    expect(new URL(requests[0]).searchParams.get("page")).toBe("2");
    expect(new URL(requests[0]).searchParams.get("fields")).not.toContain(
      "description",
    );
  });

  it("reduces Discussion metadata without bodies, author identity, or URLs", async () => {
    const adapter = new VanillaForumsApiAdapter(async () =>
      json([
        {
          discussionID: 12,
          name: "Release notes",
          categoryID: 3,
          type: "discussion",
          status: "active",
          dateInserted: "2026-07-01T12:00:00Z",
          countComments: 4,
          score: 9,
          closed: false,
          sink: false,
          body: "private discussion body",
          excerpt: "private excerpt",
          insertUser: { userID: 44, email: "private@example.com" },
          url: "https://private.example/discussion",
        },
      ]),
    );

    const result = await adapter.listDiscussions(credentials, {
      maxResults: 10,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 12,
        name: "Release notes",
        categoryId: 3,
        commentCount: 4,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("reduces users without email, IP, SSO, profile, avatar, or activity data", async () => {
    const adapter = new VanillaForumsApiAdapter(async () =>
      json([
        {
          userID: 21,
          name: "Community Member",
          admin: false,
          moderator: false,
          dateInserted: "2025-01-01T00:00:00Z",
          countDiscussions: 3,
          countComments: 20,
          points: 15,
          rankID: 2,
          email: "private@example.com",
          lastIPAddress: "192.0.2.4",
          ssoID: "private-sso",
          dateLastActive: "2026-07-18T00:00:00Z",
          profileFields: { company: "private" },
          photoUrl: "https://private.example/avatar.png",
        },
      ]),
    );

    const result = await adapter.listUsers(credentials, { maxResults: 10 });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 21,
        name: "Community Member",
        discussionCount: 3,
        commentCount: 20,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("192.0.2.4");
  });

  it("rejects unsafe origins and invalid pagination before network access", async () => {
    const request = jest.fn();
    const adapter = new VanillaForumsApiAdapter(request);
    for (const baseUrl of [
      "http://community.example.com",
      "https://localhost",
      "https://localhost.",
      "https://127.0.0.1",
      "https://community.example.com/api/v2",
    ])
      await expect(
        adapter.getCurrentUser({ ...credentials, baseUrl }),
      ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.listCategories(credentials, { page: 0 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listCategories(credentials, { maxResults: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps provider denial and quotas without returning provider bodies", async () => {
    const denied = new VanillaForumsApiAdapter(async () =>
      json({ message: "sensitive provider explanation" }, 403),
    );
    await expect(denied.getCurrentUser(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
      statusCode: 403,
      message: "Vanilla API request failed.",
    });

    const limited = new VanillaForumsApiAdapter(async () =>
      json({}, 429, { "Retry-After": "30" }),
    );
    await expect(limited.getCurrentUser(credentials)).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
      details: { retryAfter: "30" },
    });
  });
});
