import { TeamworkApiAdapter } from "./teamwork-api.adapter";

const credentials = {
  accessToken: "fixture-value",
  apiOrigin: "https://relay-test.teamwork.com/",
  installationId: "42",
};

describe("TeamworkApiAdapter", () => {
  it("binds health to the exact installation", async () => {
    const requester = jest.fn(
      async (_url: string | URL, _init: RequestInit) =>
        new Response(JSON.stringify({ installation_id: 42, user_id: 7 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(
      new TeamworkApiAdapter(requester).health(credentials),
    ).resolves.toEqual({
      installationId: "42",
      apiOrigin: credentials.apiOrigin,
    });
    expect(requester.mock.calls[0][0]).toBe(
      "https://www.teamwork.com/launchpad/v1/userinfo.json",
    );
  });

  it("uses the returned installation origin for bounded project reads", async () => {
    const requester = jest.fn(
      async (_url: string | URL, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            projects: [{ id: 9, name: "Launch", status: "active" }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    await expect(
      new TeamworkApiAdapter(requester).listProjects(credentials, {
        limit: 10,
      }),
    ).resolves.toMatchObject({
      projects: [{ projectId: "9", name: "Launch" }],
    });
    const url = requester.mock.calls[0][0] as URL;
    expect(url.origin).toBe("https://relay-test.teamwork.com");
    expect(url.pathname).toBe("/projects/api/v3/projects.json");
    expect(url.searchParams.get("pageSize")).toBe("10");
  });

  it("requires approval-safe relative Projects API paths", async () => {
    const adapter = new TeamworkApiAdapter(jest.fn());
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "https://evil.example/projects/api/v3/tasks.json",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
    });
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "/projects/api/../secrets",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });

  it("rejects credential-bearing request fields", async () => {
    const adapter = new TeamworkApiAdapter(jest.fn());
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/projects/api/v3/tasks.json",
        json: { access_token: "do-not-send" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("does not accept an attacker-controlled Teamwork-looking origin", async () => {
    const adapter = new TeamworkApiAdapter(jest.fn());
    await expect(
      adapter.listTasks({
        ...credentials,
        apiOrigin: "https://teamwork.com.evil.example/",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
  });
});
