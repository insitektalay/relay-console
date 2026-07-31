import { TickTickApiAdapter } from "./ticktick-api.adapter";

describe("TickTickApiAdapter", () => {
  const credentials = { accessToken: "access-token-fixture" };

  it("validates the token-bound grant on the fixed Open API origin", async () => {
    const adapter = new TickTickApiAdapter(async (url, init) => {
      expect(String(url)).toBe("https://api.ticktick.com/open/v1/project");
      expect(init.redirect).toBe("error");
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer access-token-fixture",
      );
      return new Response("[]", { status: 200 });
    });
    await expect(adapter.health(credentials)).resolves.toEqual({
      grantVerified: true,
      apiOrigin: "https://api.ticktick.com/open/v1",
    });
  });

  it("returns bounded project summaries", async () => {
    const adapter = new TickTickApiAdapter(
      async () =>
        new Response(
          JSON.stringify([
            { id: "p1", name: "Launch", sortOrder: 1, permission: "write" },
          ]),
          { status: 200 },
        ),
    );
    const result = await adapter.listProjects(credentials, { limit: 1 });
    expect(result.projects).toEqual([
      {
        projectId: "p1",
        name: "Launch",
        color: null,
        viewMode: null,
        kind: null,
        closed: false,
        groupId: null,
      },
    ]);
    expect(result.projects[0]).not.toHaveProperty("permission");
  });

  it("rejects traversal and credential-bearing payloads", async () => {
    const adapter = new TickTickApiAdapter(
      async () => new Response("{}", { status: 200 }),
    );
    await expect(
      adapter.request(credentials, { method: "GET", path: "/../project" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/task",
        json: { access_token: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
