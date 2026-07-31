import { TodoistApiAdapter } from "./todoist-api.adapter";

describe("TodoistApiAdapter", () => {
  const credentials = {
    accessToken: "access-token-fixture",
    userId: "1234567",
  };

  it("binds health to the exact authorizing user", async () => {
    const adapter = new TodoistApiAdapter(async (url, init) => {
      expect(String(url)).toBe("https://api.todoist.com/api/v1/user");
      expect(init.redirect).toBe("error");
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer access-token-fixture",
      );
      return new Response(
        JSON.stringify({ id: "1234567", token: "must-not-be-returned" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    await expect(adapter.health(credentials)).resolves.toEqual({
      userId: "1234567",
      apiOrigin: "https://api.todoist.com/api/v1",
    });
  });

  it("returns bounded project and task summaries", async () => {
    const requests: string[] = [];
    const adapter = new TodoistApiAdapter(async (url) => {
      requests.push(String(url));
      const item = String(url).includes("/projects")
        ? {
            id: "6XGgm6PHrGgMpCFX",
            name: "Launch",
            description: "private project details",
            role: "admin",
          }
        : {
            id: "6XGgmFVcrG5RRjVr",
            content: "Ship release",
            description: "private task details",
            project_id: "6XGgm6PHrGgMpCFX",
            labels: ["confidential"],
          };
      return new Response(JSON.stringify({ results: [item] }), { status: 200 });
    });

    const projects = await adapter.listProjects(credentials, { limit: 1 });
    const tasks = await adapter.listTasks(credentials, { limit: 1 });

    expect(requests).toEqual([
      "https://api.todoist.com/api/v1/projects?limit=1",
      "https://api.todoist.com/api/v1/tasks?limit=1",
    ]);
    expect(projects.projects[0]).not.toHaveProperty("description");
    expect(tasks.tasks[0]).not.toHaveProperty("description");
    expect(tasks.tasks[0]).not.toHaveProperty("labels");
  });

  it("rejects path traversal and credential-bearing payloads", async () => {
    const adapter = new TodoistApiAdapter(async () =>
      Promise.resolve(new Response("{}", { status: 200 })),
    );

    await expect(
      adapter.request(credentials, { method: "GET", path: "/../user" }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
    });
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/tasks",
        json: { access_token: "not-allowed" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
