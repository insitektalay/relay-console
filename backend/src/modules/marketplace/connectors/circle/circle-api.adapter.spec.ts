import { CircleApiAdapter, type CircleCredentials } from "./circle-api.adapter";

const credentials: CircleCredentials = { apiToken: "admin-v2-test-token" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("CircleApiAdapter", () => {
  it("binds the token to Circle's fixed Admin API v2 community route", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new CircleApiAdapter(async (url, init) => {
      requests.push({ url, init });
      return json({
        id: 10,
        name: "Builders",
        slug: "builders",
        locale: "en",
        is_private: true,
        white_label: false,
        prefs: { has_posts: true, has_spaces: true },
        reply_to_email: "private@example.com",
      });
    });

    await expect(adapter.health(credentials)).resolves.toEqual({
      tokenValid: true,
      community: expect.objectContaining({
        id: 10,
        name: "Builders",
        slug: "builders",
        isPrivate: true,
      }),
    });
    expect(requests[0].url).toBe(
      "https://app.circle.so/api/admin/v2/community",
    );
    expect(new Headers(requests[0].init.headers).get("authorization")).toBe(
      "Bearer admin-v2-test-token",
    );
    expect(
      JSON.stringify(await adapter.getCommunity(credentials)),
    ).not.toContain("private@example.com");
  });

  it("lists bounded posts while excluding bodies, URLs, and author emails", async () => {
    const requests: string[] = [];
    const adapter = new CircleApiAdapter(async (url) => {
      requests.push(url);
      return json({
        page: 1,
        per_page: 10,
        has_next_page: false,
        count: 1,
        page_count: 1,
        records: [
          {
            id: 100,
            name: "Welcome",
            slug: "welcome",
            status: "published",
            space_id: 20,
            space_name: "General",
            user_name: "Admin",
            user_email: "private@example.com",
            body: { body: "private post body" },
            url: "https://app.circle.so/private-post",
            comments_count: 2,
            likes_count: 3,
            published_at: "2026-07-18T00:00:00Z",
          },
        ],
      });
    });

    const result = await adapter.listPosts(credentials, {
      spaceId: 20,
      status: "published",
      maxResults: 10,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 100,
        name: "Welcome",
        authorName: "Admin",
        commentsCount: 2,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private");
    const url = new URL(requests[0]);
    expect(url.origin).toBe("https://app.circle.so");
    expect(url.pathname).toBe("/api/admin/v2/posts");
    expect(url.searchParams.get("space_id")).toBe("20");
    expect(url.searchParams.get("per_page")).toBe("10");
  });

  it("reduces member records to bounded operational identity", async () => {
    const adapter = new CircleApiAdapter(async () =>
      json({
        page: 1,
        records: [
          {
            id: 30,
            name: "Member",
            email: "member@example.com",
            headline: "Engineer",
            active: true,
            public_uid: "member",
            roles: { admin: false, moderator: true },
            posts_count: 5,
            comments_count: 8,
            flattened_profile_fields: { location: "private location" },
            sso_provider_user_id: "private-sso-id",
            avatar_url: "https://private.example/avatar.png",
          },
        ],
      }),
    );

    const result = await adapter.listMembers(credentials, { status: "active" });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 30,
        email: "member@example.com",
        moderator: true,
        postsCount: 5,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("adds and removes one exact Space member using documented shapes", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new CircleApiAdapter(async (url, init) => {
      requests.push({ url, init });
      return json({ message: "ok" });
    });

    await expect(
      adapter.addSpaceMember(credentials, {
        spaceId: 20,
        email: "Member@Example.com",
      }),
    ).resolves.toEqual({
      spaceId: 20,
      email: "member@example.com",
      added: true,
    });
    await expect(
      adapter.removeSpaceMember(credentials, {
        spaceId: 20,
        email: "member@example.com",
      }),
    ).resolves.toEqual({
      spaceId: 20,
      email: "member@example.com",
      removed: true,
    });
    expect(requests[0].init.method).toBe("POST");
    expect(JSON.parse(String(requests[0].init.body))).toEqual({
      email: "member@example.com",
      space_id: 20,
    });
    const removeUrl = new URL(requests[1].url);
    expect(requests[1].init.method).toBe("DELETE");
    expect(removeUrl.searchParams.get("space_id")).toBe("20");
    expect(removeUrl.searchParams.get("email")).toBe("member@example.com");
  });

  it("maps plan or token-type denial without returning provider bodies", async () => {
    const adapter = new CircleApiAdapter(async () =>
      json({ message: "sensitive provider explanation" }, 403),
    );
    await expect(adapter.getCommunity(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
      statusCode: 403,
      message: "Circle Admin API request failed.",
    });
  });

  it("rejects invalid identifiers before calling Circle", async () => {
    const request = jest.fn();
    const adapter = new CircleApiAdapter(request);
    await expect(
      adapter.getSpace(credentials, { spaceId: "../community" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });
});
