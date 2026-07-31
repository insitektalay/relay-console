import { BasecampApiAdapter } from "./basecamp-api.adapter";

const credentials = {
  accessToken: "fixture-value",
  accountOrigin: "https://3.basecampapi.com/42",
  accountId: "42",
};

describe("BasecampApiAdapter", () => {
  it("binds health to the exact bc3 account", async () => {
    const requester = jest.fn(
      async (_url: string | URL, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            identity: { id: 7 },
            accounts: [
              {
                product: "bc3",
                id: 42,
                name: "Relay",
                href: credentials.accountOrigin,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    await expect(
      new BasecampApiAdapter(requester).health(credentials),
    ).resolves.toEqual({
      accountId: "42",
      accountOrigin: credentials.accountOrigin,
    });
    expect(requester.mock.calls[0][0]).toBe(
      "https://launchpad.37signals.com/authorization.json",
    );
  });

  it("uses the bound account origin for bounded project reads", async () => {
    const requester = jest.fn(
      async (_url: string | URL, _init: RequestInit) =>
        new Response(
          JSON.stringify([{ id: 9, name: "Launch", status: "active" }]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    await expect(
      new BasecampApiAdapter(requester).listProjects(credentials, {
        limit: 10,
      }),
    ).resolves.toMatchObject({
      projects: [{ projectId: "9", name: "Launch" }],
    });
    const url = requester.mock.calls[0][0] as URL;
    expect(url.origin).toBe("https://3.basecampapi.com");
    expect(url.pathname).toBe("/42/projects.json");
    expect(requester.mock.calls[0][1].headers).toMatchObject({
      "User-Agent": "RelayConsole (support@relayconsole.work)",
    });
  });

  it("supports canonical flat to-do routes", async () => {
    const requester = jest.fn(
      async (_url: string | URL, _init: RequestInit) =>
        new Response(
          JSON.stringify({ id: 71, content: "Ship", completed: false }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    await expect(
      new BasecampApiAdapter(requester).getTodo(credentials, { todoId: "71" }),
    ).resolves.toMatchObject({ todo: { todoId: "71", title: "Ship" } });
    expect((requester.mock.calls[0][0] as URL).pathname).toBe(
      "/42/todos/71.json",
    );
  });

  it("rejects absolute paths, traversal, and credential-bearing fields", async () => {
    const adapter = new BasecampApiAdapter(jest.fn());
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "https://evil.example/projects.json",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "/projects/../secrets.json",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/projects.json",
        json: { access_token: "do-not-send" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("does not accept an attacker-controlled Basecamp-looking origin", async () => {
    const adapter = new BasecampApiAdapter(jest.fn());
    await expect(
      adapter.listProjects({
        ...credentials,
        accountOrigin: "https://3.basecampapi.com.evil.example/42",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
  });
});
