import {
  HivebriteApiAdapter,
  type HivebriteCredentials,
} from "./hivebrite-api.adapter";

const credentials: HivebriteCredentials = {
  baseUrl: "https://community.example.org",
  adminId: "42",
  accessToken: "test-token",
};
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

describe("HivebriteApiAdapter", () => {
  it("binds one public HTTPS tenant and exact administrator", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new HivebriteApiAdapter(async (url, init) => {
      requests.push({ url, init });
      return json({
        id: 42,
        email: "private@example.com",
        name: "Relay Admin",
        admin_type: "global",
        created_at: "2026-01-01T00:00:00Z",
      });
    });
    const result = await adapter.getCurrentAdmin(credentials);
    expect(result.admin).toEqual({
      id: "42",
      name: "Relay Admin",
      adminType: "global",
      createdAt: "2026-01-01T00:00:00Z",
    });
    expect(new URL(requests[0].url).pathname).toBe("/api/admin/v1/me");
    expect(new Headers(requests[0].init.headers).get("authorization")).toBe(
      "Bearer test-token",
    );
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("rejects administrator drift", async () => {
    const adapter = new HivebriteApiAdapter(async () =>
      json({ id: 43, name: "Other" }),
    );
    await expect(adapter.getCurrentAdmin(credentials)).rejects.toMatchObject({
      code: "policy_blocked",
      statusCode: 403,
    });
  });

  it("uses fixed bounded Group and News Category routes with reduced output", async () => {
    const requests: string[] = [];
    const adapter = new HivebriteApiAdapter(async (url) => {
      requests.push(url);
      if (url.includes("/topics"))
        return json(
          [
            {
              id: 1,
              name: "Alumni",
              public: false,
              restricted_access: true,
              secret: true,
              published: true,
              description: "private",
              experts: [{ user_id: 9 }],
              location: { address: "private" },
            },
          ],
          200,
          {
            Link: '<https://community.example.org/api/admin/v2/topics?page=2>; rel="next"',
          },
        );
      return json([{ id: 7, name: "Updates", description: "private" }]);
    });
    const groups = await adapter.listGroups(credentials, {
      page: 1,
      maxResults: 5,
    });
    const categories = await adapter.listNewsCategories(credentials, {
      maxResults: 5,
    });
    expect(groups).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 5,
        returned: 1,
        hasNextPage: true,
      }),
    );
    expect(groups.items[0]).toEqual(
      expect.objectContaining({
        id: "1",
        name: "Alumni",
        secret: true,
        restrictedAccess: true,
      }),
    );
    expect(categories.items).toEqual([{ id: "7", name: "Updates" }]);
    expect(JSON.stringify({ groups, categories })).not.toContain("private");
    expect(new URL(requests[0]).searchParams.get("per_page")).toBe("5");
  });

  it("reduces Event and Company records without private fields", async () => {
    const adapter = new HivebriteApiAdapter(async (url) =>
      url.includes("network_events")
        ? json([
            {
              id: 5,
              title: "Annual meeting",
              start_date: "2026-09-01T09:00:00Z",
              end_date: "2026-09-01T17:00:00Z",
              registration_type: "tickets",
              public: false,
              description: "private",
              contact_email: "private@example.com",
              location: { address: "private" },
              attendees: [{ email: "private@example.com" }],
            },
          ])
        : json([
            {
              id: 8,
              name: "Example Co",
              email: "private@example.com",
              annual_revenue: "private",
              postal_location: { address_1: "private" },
            },
          ]),
    );
    const events = await adapter.listEvents(credentials, { maxResults: 3 });
    const companies = await adapter.listCompanies(credentials, {
      maxResults: 3,
    });
    expect(events.items[0]).toEqual(
      expect.objectContaining({
        id: "5",
        title: "Annual meeting",
        registrationType: "tickets",
        public: false,
      }),
    );
    expect(companies.items).toEqual([{ id: "8", name: "Example Co" }]);
    expect(JSON.stringify({ events, companies })).not.toContain("private");
  });

  it("rejects unsafe origins, IDs, and bounds before network access", async () => {
    const request = jest.fn();
    const adapter = new HivebriteApiAdapter(request);
    await expect(
      adapter.getCurrentAdmin({
        ...credentials,
        baseUrl: "http://community.example.org",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getCurrentAdmin({ ...credentials, baseUrl: "https://127.0.0.1" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getCurrentAdmin({ ...credentials, adminId: "../42" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.listGroups(credentials, { maxResults: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps authorization and rate failures without provider bodies", async () => {
    const denied = new HivebriteApiAdapter(async () =>
      json({ error: "private detail" }, 403),
    );
    await expect(denied.getCurrentAdmin(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
      statusCode: 403,
      message: "Hivebrite API request failed.",
    });
    const limited = new HivebriteApiAdapter(async () =>
      json({}, 429, { "Retry-After": "60" }),
    );
    await expect(limited.getCurrentAdmin(credentials)).rejects.toMatchObject({
      code: "provider_rate_limited",
      details: { retryAfter: "60" },
    });
  });
});
