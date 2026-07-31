import { AttioApiAdapter, AttioApiError } from "./attio-api.adapter";

const workspaceId = "14beef7a-99f7-4534-a87e-70b564330a4c";
const recordId = "bf071e1f-6035-429d-b874-d83ea64ea13b";

describe("AttioApiAdapter", () => {
  it("introspects and binds the exact workspace and authorizing member", async () => {
    const request = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe("https://app.attio.com/oauth/introspect");
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({ Authorization: "Bearer token" });
      return new Response(
        JSON.stringify({
          active: true,
          scope: "object_configuration:read record_permission:read-write",
          workspace_id: workspaceId,
          workspace_name: "Relay",
          workspace_slug: "relay",
          authorized_by_workspace_member_id:
            "50cf242c-7fa3-4cad-87d0-75b1af71c57b",
        }),
        { status: 200 },
      );
    });
    await expect(
      new AttioApiAdapter(request).health({
        accessToken: "token",
        workspaceId,
      }),
    ).resolves.toMatchObject({ active: true, workspaceId });
  });

  it("runs one bounded record query on the fixed origin", async () => {
    const request = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.attio.com/v2/objects/people/records/query",
      );
      expect(init.method).toBe("POST");
      expect(init.redirect).toBe("error");
      expect(init.headers).toMatchObject({ Authorization: "Bearer token" });
      expect(JSON.parse(String(init.body))).toEqual({ limit: 25, offset: 0 });
      return new Response(
        JSON.stringify({
          data: [{ id: { workspace_id: workspaceId, record_id: recordId } }],
        }),
        { status: 200 },
      );
    });
    await expect(
      new AttioApiAdapter(request).read(
        { accessToken: "token", workspaceId },
        {
          method: "POST",
          path: "/v2/objects/people/records/query",
          json: { limit: 25, offset: 0 },
        },
      ),
    ).resolves.toMatchObject({
      data: [{ id: { workspace_id: workspaceId, record_id: recordId } }],
    });
  });

  it("runs an exact approved record mutation", async () => {
    const request = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        `https://api.attio.com/v2/objects/people/records/${recordId}`,
      );
      expect(init.method).toBe("PATCH");
      return new Response(
        JSON.stringify({
          data: { id: { workspace_id: workspaceId, record_id: recordId } },
        }),
        { status: 200 },
      );
    });
    await expect(
      new AttioApiAdapter(request).manage(
        { accessToken: "token", workspaceId },
        {
          method: "PATCH",
          path: `/v2/objects/people/records/${recordId}`,
          json: { data: { values: { name: "Ada" } } },
        },
      ),
    ).resolves.toMatchObject({ data: { id: { workspace_id: workspaceId } } });
  });

  it("rejects schema writes, beta search, oversized queries, and credential-bearing bodies", async () => {
    const adapter = new AttioApiAdapter(jest.fn());
    const credentials = { accessToken: "token", workspaceId };
    await expect(
      adapter.manage(credentials, {
        method: "PATCH",
        path: "/v2/objects/people",
        json: { data: {} },
      }),
    ).rejects.toBeInstanceOf(AttioApiError);
    await expect(
      adapter.read(credentials, {
        method: "POST",
        path: "/v2/objects/records/search",
        json: { query: "Ada" },
      }),
    ).rejects.toBeInstanceOf(AttioApiError);
    await expect(
      adapter.read(credentials, {
        method: "GET",
        path: "/v2/tasks",
        query: { limit: 101 },
      }),
    ).rejects.toBeInstanceOf(AttioApiError);
    await expect(
      adapter.manage(credentials, {
        method: "POST",
        path: "/v2/tasks",
        json: { access_token: "secret" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("fails closed on cross-workspace data and maps provider throttling", async () => {
    const cross = new AttioApiAdapter(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              id: { workspace_id: "24beef7a-99f7-4534-a87e-70b564330a4c" },
            },
          }),
          { status: 200 },
        ),
    );
    await expect(
      cross.read(
        { accessToken: "token", workspaceId },
        { method: "GET", path: "/v2/objects" },
      ),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
    const limited = new AttioApiAdapter(
      async () =>
        new Response(
          JSON.stringify({ status_code: 429, message: "Rate limit exceeded" }),
          { status: 429 },
        ),
    );
    await expect(
      limited.read(
        { accessToken: "token", workspaceId },
        { method: "GET", path: "/v2/objects" },
      ),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
