import { ClickUpApiAdapter, ClickUpApiError } from "./clickup-api.adapter";
import { CLICKUP_CONNECTOR_MANIFEST } from "./clickup.connector";

describe("ClickUp Marketplace connector", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("publishes eight bounded OAuth tools under Safe and Dangerous policies", () => {
    expect(CLICKUP_CONNECTOR_MANIFEST.tools).toHaveLength(8);
    expect(CLICKUP_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://app.clickup.com/api",
      tokenUrl: "https://api.clickup.com/api/v2/oauth/token",
      requiredScopes: [],
      pkce: false,
      supportsRefresh: false,
    });
    const safe = CLICKUP_CONNECTOR_MANIFEST.approvalProfiles[0];
    const dangerous = CLICKUP_CONNECTOR_MANIFEST.approvalProfiles[1];
    expect(safe.allowedActions).toHaveLength(5);
    expect(safe.approvalRequiredActions).toHaveLength(3);
    expect(dangerous.allowedActions).toHaveLength(8);
    expect(dangerous.approvalRequiredActions).toEqual([]);
  });

  it("uses a bearer token and keeps Workspace task search on the first bounded page", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tasks: [
            { id: "task-1", name: "Launch Relay", text_content: "Ship safely" },
            { id: "task-2", name: "Other", text_content: "Unrelated" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;
    const result = await new ClickUpApiAdapter().searchWorkspaceTasks(
      "secret-token",
      {
        workspaceId: "123",
        query: "relay",
        maxResults: 5,
      },
    );
    expect(result.tasks).toHaveLength(1);
    expect(result.nextPageFollowed).toBe(false);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain("/api/v2/team/123/task?page=0");
    expect(String(url)).not.toContain("secret-token");
    expect(init.headers.Authorization).toBe("Bearer secret-token");
  });

  it("normalizes a task write without exposing the token", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "task-1",
          name: "New task",
          url: "https://app.clickup.com/t/task-1",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    ) as typeof fetch;
    const result = await new ClickUpApiAdapter().createTask("secret-token", {
      listId: "456",
      name: "New task",
      priority: 2,
      assigneeIds: [12],
      idempotencyKey: "clickup-create-1",
    });
    expect(result).toMatchObject({
      listId: "456",
      idempotencyKey: "clickup-create-1",
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toBe("https://api.clickup.com/api/v2/list/456/task");
    expect(JSON.parse(init.body)).toMatchObject({
      name: "New task",
      priority: 2,
      assignees: [12],
      notify_all: false,
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("rejects empty updates and maps rate limits to a safe error", async () => {
    await expect(
      new ClickUpApiAdapter().updateTask("token", {
        taskId: "task-1",
        idempotencyKey: "clickup-update-1",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ err: "rate" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;
    await expect(
      new ClickUpApiAdapter().listWorkspaces("token", {}),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ClickUpApiError>>({
        code: "provider_rate_limited",
        statusCode: 429,
      }),
    );
  });
});
