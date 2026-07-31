import { WrikeApiAdapter } from "./wrike-api.adapter";

const credentials = {
  accessToken: "fixture-value",
  apiOrigin: "https://www.wrike.com/api/v4",
  accountId: "IEAAA",
  userId: "KUAAA",
};

describe("WrikeApiAdapter", () => {
  it("binds health to the exact account, user, and regional host", async () => {
    const requester = jest.fn(
      async (url: string | URL) =>
        new Response(
          JSON.stringify({
            data: [
              (url as URL).pathname.endsWith("/account")
                ? { id: "IEAAA" }
                : { id: "KUAAA" },
            ],
          }),
          { status: 200 },
        ),
    );
    await expect(
      new WrikeApiAdapter(requester).health(credentials),
    ).resolves.toEqual({
      accountId: "IEAAA",
      userId: "KUAAA",
      apiOrigin: credentials.apiOrigin,
    });
    expect((requester.mock.calls[0][0] as URL).origin).toBe(
      "https://www.wrike.com",
    );
  });

  it("uses the exact regional API origin for bounded project reads", async () => {
    const requester = jest.fn(
      async (_url: string | URL, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: "IEAFOLDER",
                title: "Launch",
                project: { status: "Green" },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    await expect(
      new WrikeApiAdapter(requester).listProjects(credentials, { limit: 10 }),
    ).resolves.toMatchObject({
      projects: [{ projectId: "IEAFOLDER", title: "Launch" }],
    });
    const url = requester.mock.calls[0][0] as URL;
    expect(url.pathname).toBe("/api/v4/folders");
    expect(url.searchParams.get("pageSize")).toBe("10");
  });

  it("supports a bounded task read", async () => {
    const requester = jest.fn(
      async (_url: string | URL, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            data: [{ id: "IEATASK", title: "Ship", status: "Active" }],
          }),
          { status: 200 },
        ),
    );
    await expect(
      new WrikeApiAdapter(requester).getTask(credentials, {
        taskId: "IEATASK",
      }),
    ).resolves.toMatchObject({ task: { taskId: "IEATASK", title: "Ship" } });
    expect((requester.mock.calls[0][0] as URL).pathname).toBe(
      "/api/v4/tasks/IEATASK",
    );
  });

  it("rejects absolute paths, traversal, credential fields, and lookalike hosts", async () => {
    const adapter = new WrikeApiAdapter(jest.fn());
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "https://evil.example/tasks",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "/tasks/../contacts",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/tasks",
        form: { access_token: "do-not-send" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.listTasks({
        ...credentials,
        apiOrigin: "https://www.wrike.com.evil.example/api/v4",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
  });
});
