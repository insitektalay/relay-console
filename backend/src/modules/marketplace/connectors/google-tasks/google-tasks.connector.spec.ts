import {
  GoogleTasksApiAdapter,
  GoogleTasksApiError,
} from "./google-tasks-api.adapter";
import {
  GOOGLE_TASKS_CONNECTOR_MANIFEST,
  GOOGLE_TASKS_SCOPES,
} from "./google-tasks.connector";
describe("Google Tasks connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses the exact Tasks scope and exposes five non-destructive tools", () => {
    expect(GOOGLE_TASKS_SCOPES).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/tasks",
    ]);
    expect(GOOGLE_TASKS_CONNECTOR_MANIFEST.tools).toHaveLength(5);
    expect(
      GOOGLE_TASKS_CONNECTOR_MANIFEST.tools
        .filter((t) => t.approvalRequired)
        .map((t) => t.functionName),
    ).toEqual(["google_tasks_task_create", "google_tasks_task_patch"]);
  });
  it("bounds task-list reads and never follows pagination", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [{ id: "list_1", title: "My Tasks" }],
            nextPageToken: "hidden",
          }),
          { status: 200 },
        ),
      );
    const result = await new GoogleTasksApiAdapter().listTaskLists("token");
    expect(result).toMatchObject({
      count: 1,
      nextPageTokenPresent: true,
      nextPageFollowed: false,
      providerRequestCount: 1,
    });
  });
  it("rejects destructive and empty local patches", () => {
    expect(() =>
      new GoogleTasksApiAdapter().prepareUpdate({
        taskListId: "list_1",
        taskId: "task_1",
        operation: "patch",
      }),
    ).toThrow(GoogleTasksApiError);
  });
  it("preflights assignment and uses If-Match for safe patches", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "task_1", etag: "etag-1" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "task_1",
            etag: "etag-2",
            title: "Done",
            status: "completed",
          }),
          { status: 200 },
        ),
      );
    const result = await new GoogleTasksApiAdapter().patchTask("token", {
      taskListId: "list_1",
      taskId: "task_1",
      etag: "etag-1",
      status: "completed",
      idempotencyKey: "request-123",
    });
    const [, init] = (global.fetch as jest.Mock).mock.calls[1] as [
      URL,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>)["If-Match"]).toBe("etag-1");
    expect(result).toMatchObject({
      operation: "patch_task",
      assignedTaskPreflight: true,
      providerRequestCount: 2,
    });
  });
});
