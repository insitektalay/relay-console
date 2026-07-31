import {
  MicrosoftToDoApiAdapter,
  MicrosoftToDoApiError,
} from "./microsoft-to-do-api.adapter";

describe("MicrosoftToDoApiAdapter", () => {
  it("uses the fixed signed-in-user endpoint and excludes private task content", async () => {
    const calls: string[] = [];
    const adapter = new MicrosoftToDoApiAdapter(async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "task-1",
              title: "Review launch",
              status: "notStarted",
              dueDateTime: { dateTime: "2026-07-18T10:00:00.0000000" },
              body: { content: "private body" },
              categories: ["confidential"],
              linkedResources: [{ webUrl: "https://secret.example" }],
            },
          ],
          "@odata.nextLink": "https://graph.microsoft.com/secret-skip-token",
        }),
        { status: 200 },
      );
    });
    const result = await adapter.listTasks("token", { taskListId: "list-1" });
    expect(calls).toEqual([
      "https://graph.microsoft.com/v1.0/me/todo/lists/list-1/tasks",
    ]);
    expect(result.tasks[0]).toEqual(
      expect.objectContaining({
        id: "task-1",
        title: "Review launch",
        dueDateTime: "2026-07-18T10:00:00.0000000",
        bodyExcluded: true,
        categoriesExcluded: true,
        relatedContentExcluded: true,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private body");
    expect(JSON.stringify(result)).not.toContain("confidential");
    expect(JSON.stringify(result)).not.toContain("secret.example");
    expect(JSON.stringify(result)).not.toContain("skip-token");
  });

  it("rejects unsafe identifiers before provider I/O", async () => {
    const request = jest.fn();
    const adapter = new MicrosoftToDoApiAdapter(request);
    await expect(
      adapter.getTask("token", { taskListId: "../lists", taskId: "task-1" }),
    ).rejects.toBeInstanceOf(MicrosoftToDoApiError);
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on oversized responses and maps throttling safely", async () => {
    const oversized = new MicrosoftToDoApiAdapter(
      async () => new Response("x".repeat(1_000_001), { status: 200 }),
    );
    await expect(oversized.health("token")).rejects.toMatchObject({
      code: "microsoft_todo_response_too_large",
    });
    const throttled = new MicrosoftToDoApiAdapter(
      async () => new Response("{}", { status: 429 }),
    );
    await expect(throttled.health("token")).rejects.toMatchObject({
      code: "microsoft_todo_rate_limited",
      statusCode: 429,
    });
  });
});
