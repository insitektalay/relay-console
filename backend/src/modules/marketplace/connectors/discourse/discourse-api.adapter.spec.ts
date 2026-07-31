import {
  DiscourseApiAdapter,
  type DiscourseCredentials,
} from "./discourse-api.adapter";

const credentials: DiscourseCredentials = {
  baseUrl: "https://community.example.com",
  apiKey: "discourse-test-key",
  apiUsername: "relay_operator",
};
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

describe("DiscourseApiAdapter", () => {
  it("binds header authentication to one exact public HTTPS site and actor", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new DiscourseApiAdapter(async (url, init) => {
      requests.push({ url, init });
      return json({
        current_user: {
          id: 7,
          username: "relay_operator",
          name: "Relay Operator",
          trust_level: 4,
          admin: true,
          moderator: true,
          email: "private@example.com",
          user_fields: { secret: "excluded" },
        },
      });
    });

    const result = await adapter.getCurrentUser(credentials);
    expect(result.user).toEqual({
      id: 7,
      username: "relay_operator",
      name: "Relay Operator",
      trustLevel: 4,
      admin: true,
      moderator: true,
    });
    expect(requests[0].url).toBe(
      "https://community.example.com/session/current.json",
    );
    const headers = new Headers(requests[0].init.headers);
    expect(headers.get("api-key")).toBe("discourse-test-key");
    expect(headers.get("api-username")).toBe("relay_operator");
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("reduces Categories and Tags while enforcing bounded output", async () => {
    const requests: string[] = [];
    const adapter = new DiscourseApiAdapter(async (url) => {
      requests.push(url);
      if (url.includes("/categories.json"))
        return json({
          category_list: {
            categories: Array.from({ length: 3 }, (_, index) => ({
              id: index + 1,
              name: `Category ${index + 1}`,
              slug: `category-${index + 1}`,
              topic_count: 10,
              post_count: 20,
              read_restricted: false,
              description_text: "private category description",
              topic_url: "https://private.example/category",
            })),
          },
        });
      return json({
        tags: [
          {
            id: 1,
            name: "support",
            count: 5,
            pm_count: 4,
            private_field: "excluded",
          },
        ],
      });
    });

    const categories = await adapter.listCategories(credentials, {
      maxResults: 2,
    });
    const tags = await adapter.listTags(credentials, { maxResults: 1 });
    expect(categories).toEqual(
      expect.objectContaining({ returned: 2, truncated: true }),
    );
    expect(categories.items[0]).toEqual(
      expect.objectContaining({ id: 1, name: "Category 1", topicCount: 10 }),
    );
    expect(tags.items[0]).toEqual({
      id: 1,
      name: "support",
      count: 5,
      targetTag: null,
    });
    expect(JSON.stringify({ categories, tags })).not.toContain("private");
    expect(new URL(requests[0]).searchParams.get("include_subcategories")).toBe(
      "true",
    );
  });

  it("reduces Groups and excludes biography and email configuration", async () => {
    const adapter = new DiscourseApiAdapter(async () =>
      json({
        groups: [
          {
            id: 9,
            name: "support-team",
            display_name: "Support Team",
            title: "Support",
            user_count: 12,
            visibility_level: 1,
            public_admission: false,
            public_exit: false,
            bio_raw: "private biography",
            bio_cooked: "private cooked biography",
            incoming_email: "private@example.com",
            automatic_membership_email_domains: "private.example",
          },
        ],
      }),
    );

    const result = await adapter.listGroups(credentials, { maxResults: 5 });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 9,
        name: "support-team",
        userCount: 12,
        publicAdmission: false,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("deduplicates Group owners and returns reduced member identity", async () => {
    const adapter = new DiscourseApiAdapter(async () =>
      json({
        owners: [
          {
            id: 1,
            username: "owner.one",
            name: "Owner One",
            timezone: "private timezone",
            last_seen_at: "private activity",
          },
        ],
        members: [
          { id: 1, username: "owner.one", name: "Owner One" },
          {
            id: 2,
            username: "member.two",
            name: "Member Two",
            avatar_template: "private avatar",
          },
        ],
        meta: { total: 2, limit: 50, offset: 0 },
      }),
    );

    const result = await adapter.listGroupMembers(credentials, {
      groupName: "support-team",
      maxResults: 5,
    });
    expect(result.items).toEqual([
      expect.objectContaining({ username: "owner.one", owner: true }),
      expect.objectContaining({ username: "member.two", owner: false }),
    ]);
    expect(result.total).toBe(2);
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("lists bounded Topic metadata without excerpts, media, URLs, or posters", async () => {
    const requests: string[] = [];
    const adapter = new DiscourseApiAdapter(async (url) => {
      requests.push(url);
      return json({
        users: [{ id: 4, username: "private-user" }],
        topic_list: {
          per_page: 10,
          more_topics_url: "/latest?page=3",
          topics: [
            {
              id: 100,
              title: "Release notes",
              slug: "release-notes",
              category_id: 3,
              posts_count: 5,
              reply_count: 4,
              views: 50,
              like_count: 8,
              excerpt: "private post excerpt",
              image_url: "https://private.example/image",
              posters: [{ user_id: 4 }],
            },
          ],
        },
      });
    });

    const result = await adapter.listLatestTopics(credentials, {
      page: 2,
      maxResults: 10,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 100,
        title: "Release notes",
        categoryId: 3,
        views: 50,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private");
    const url = new URL(requests[0]);
    expect(url.pathname).toBe("/latest.json");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("per_page")).toBe("10");
    expect(url.searchParams.get("order")).toBe("activity");
  });

  it("adds and removes one exact username using documented Group shapes", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new DiscourseApiAdapter(async (url, init) => {
      requests.push({ url, init });
      return json({ success: "OK", emails: ["private@example.com"] });
    });

    await expect(
      adapter.addGroupMember(credentials, {
        groupId: 9,
        username: "member.two",
      }),
    ).resolves.toEqual({ groupId: 9, username: "member.two", added: true });
    await expect(
      adapter.removeGroupMember(credentials, {
        groupId: 9,
        username: "member.two",
      }),
    ).resolves.toEqual({ groupId: 9, username: "member.two", removed: true });
    expect(requests.map(({ init }) => init.method)).toEqual(["PUT", "DELETE"]);
    expect(requests.map(({ url }) => new URL(url).pathname)).toEqual([
      "/groups/9/members.json",
      "/groups/9/members.json",
    ]);
    expect(requests.map(({ init }) => JSON.parse(String(init.body)))).toEqual([
      { usernames: "member.two" },
      { usernames: "member.two" },
    ]);
  });

  it("rejects unsafe origins and identifiers before network access", async () => {
    const request = jest.fn();
    const adapter = new DiscourseApiAdapter(request);
    for (const baseUrl of [
      "http://community.example.com",
      "https://localhost",
      "https://localhost.",
      "https://127.0.0.1",
      "https://community.example.com/subpath",
    ])
      await expect(
        adapter.getSiteBasicInfo({ ...credentials, baseUrl }),
      ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getGroup(credentials, { groupName: "../admin" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps provider denial and quotas without returning provider bodies", async () => {
    const denied = new DiscourseApiAdapter(async () =>
      json({ errors: ["sensitive provider explanation"] }, 403),
    );
    await expect(denied.getSiteBasicInfo(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
      statusCode: 403,
      message: "Discourse API request failed.",
    });

    const limited = new DiscourseApiAdapter(async () =>
      json({}, 429, { "Retry-After": "30" }),
    );
    await expect(limited.getSiteBasicInfo(credentials)).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
      details: { retryAfter: "30" },
    });
  });
});
