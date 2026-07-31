import {
  MightyNetworksApiAdapter,
  type MightyNetworksCredentials,
} from "./mighty-networks-api.adapter";

const credentials: MightyNetworksCredentials = {
  apiToken: "admin-api-test-token",
  networkId: "builders-network",
};
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

describe("MightyNetworksApiAdapter", () => {
  it("binds credentials to the configured Network and required fixed headers", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new MightyNetworksApiAdapter(async (url, init) => {
      requests.push({ url, init });
      return json({
        network: {
          id: 42,
          title: "Builders",
          domain: "builders.example.com",
          subdomain: "builders-network",
          private_setting: "excluded",
        },
      });
    });

    await expect(adapter.health(credentials)).resolves.toEqual({
      tokenValid: true,
      network: expect.objectContaining({
        id: "42",
        name: "Builders",
        subdomain: "builders-network",
      }),
    });
    expect(requests[0].url).toBe(
      "https://api.mn.co/admin/v1/networks/builders-network/",
    );
    const headers = new Headers(requests[0].init.headers);
    expect(headers.get("authorization")).toBe("Bearer admin-api-test-token");
    expect(headers.get("user-agent")).toBe(
      "RelayConsole/1.0 (+https://relayconsole.work)",
    );
    expect(JSON.stringify(await adapter.getNetwork(credentials))).not.toContain(
      "private_setting",
    );
  });

  it("lists bounded post metadata without content, URLs, media, or author email", async () => {
    const requests: string[] = [];
    const adapter = new MightyNetworksApiAdapter(async (url) => {
      requests.push(url);
      return json({
        data: [
          {
            id: 101,
            title: "Welcome",
            status: "published",
            post_type: "article",
            space_id: 20,
            author: {
              id: 30,
              name: "Host",
              email: "private@example.com",
            },
            body: "private content",
            url: "https://private.example/post",
            media: [{ url: "https://private.example/media" }],
            comments_count: 2,
            reactions_count: 3,
          },
        ],
        meta: { current_page: 2, total_pages: 4, total_count: 31 },
      });
    });

    const result = await adapter.listPosts(credentials, {
      spaceId: 20,
      page: 2,
      maxResults: 10,
    });
    expect(result).toEqual(
      expect.objectContaining({
        page: 2,
        totalPages: 4,
        items: [
          expect.objectContaining({
            id: 101,
            title: "Welcome",
            authorName: "Host",
            commentsCount: 2,
          }),
        ],
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private");
    const url = new URL(requests[0]);
    expect(url.origin).toBe("https://api.mn.co");
    expect(url.pathname).toBe("/admin/v1/networks/builders-network/posts");
    expect(url.searchParams.get("space_id")).toBe("20");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("per_page")).toBe("10");
  });

  it("reduces member records to bounded operational identity", async () => {
    const adapter = new MightyNetworksApiAdapter(async () =>
      json({
        items: [
          {
            id: 30,
            user_id: 31,
            email: "member@example.com",
            first_name: "Member",
            last_name: "One",
            role: "member",
            status: "active",
            location: "private location",
            time_zone: "private timezone",
            avatar: "https://private.example/avatar",
            permalink: "https://private.example/member",
            custom_fields: { secret: true },
          },
        ],
      }),
    );

    const result = await adapter.listMembers(credentials, {});
    expect(result.items[0]).toEqual({
      id: 30,
      userId: 31,
      email: "member@example.com",
      firstName: "Member",
      lastName: "One",
      memberType: null,
      role: "member",
      status: "active",
      createdAt: null,
      updatedAt: null,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("adds and removes one exact existing user from one exact Space", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new MightyNetworksApiAdapter(async (url, init) => {
      requests.push({ url, init });
      return json({});
    });

    await expect(
      adapter.addSpaceMember(credentials, { spaceId: 20, userId: 30 }),
    ).resolves.toEqual({ spaceId: 20, userId: 30, added: true });
    await expect(
      adapter.removeSpaceMember(credentials, { spaceId: 20, userId: 30 }),
    ).resolves.toEqual({ spaceId: 20, userId: 30, removed: true });

    const addUrl = new URL(requests[0].url);
    expect(requests[0].init.method).toBe("POST");
    expect(addUrl.pathname).toBe(
      "/admin/v1/networks/builders-network/spaces/20/members",
    );
    expect(addUrl.searchParams.get("user_id")).toBe("30");
    expect(requests[1].init.method).toBe("DELETE");
    expect(new URL(requests[1].url).pathname).toBe(
      "/admin/v1/networks/builders-network/spaces/20/members/30/",
    );
  });

  it("maps scope and quota denial without returning provider bodies", async () => {
    const denied = new MightyNetworksApiAdapter(async () =>
      json({ detail: "sensitive provider explanation" }, 403),
    );
    await expect(denied.getNetwork(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
      statusCode: 403,
      message: "Mighty Networks Admin API request failed.",
    });

    const limited = new MightyNetworksApiAdapter(async () =>
      json({}, 429, { "Retry-After": "60" }),
    );
    await expect(limited.getNetwork(credentials)).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
      details: { retryAfter: "60" },
    });
  });

  it("rejects invalid Network and resource identifiers before requesting", async () => {
    const request = jest.fn();
    const adapter = new MightyNetworksApiAdapter(request);
    await expect(
      adapter.getNetwork({ ...credentials, networkId: "../other-network" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getSpace(credentials, { spaceId: "../members" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });
});
