import {
  MicrosoftPlannerApiAdapter,
  MicrosoftPlannerApiError,
} from "./microsoft-planner-api.adapter";

describe("MicrosoftPlannerApiAdapter", () => {
  it("uses the fixed own-task endpoint and excludes assignment identities and details", async () => {
    const calls: string[] = [];
    const adapter = new MicrosoftPlannerApiAdapter(async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "task-1",
              title: "Review launch",
              planId: "plan-1",
              assignments: {
                "user-secret": { assignedBy: { user: { id: "admin-secret" } } },
              },
              details: { description: "secret" },
            },
          ],
          "@odata.nextLink": "https://graph.microsoft.com/secret-skip-token",
        }),
        { status: 200 },
      );
    });
    const result = await adapter.listAssignedTasks("token");
    expect(calls).toEqual([
      "https://graph.microsoft.com/v1.0/me/planner/tasks",
    ]);
    expect(result.tasks[0]).toEqual(
      expect.objectContaining({
        id: "task-1",
        title: "Review launch",
        assignmentCount: 1,
        assignmentIdentitiesExcluded: true,
        detailsExcluded: true,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("user-secret");
    expect(JSON.stringify(result)).not.toContain("admin-secret");
    expect(JSON.stringify(result)).not.toContain("skip-token");
  });

  it("rejects unsafe identifiers before provider I/O", async () => {
    const request = jest.fn();
    const adapter = new MicrosoftPlannerApiAdapter(request);
    await expect(
      adapter.getTask("token", { taskId: "../details" }),
    ).rejects.toBeInstanceOf(MicrosoftPlannerApiError);
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on oversized responses and maps throttling safely", async () => {
    const oversized = new MicrosoftPlannerApiAdapter(
      async () => new Response("x".repeat(1_000_001), { status: 200 }),
    );
    await expect(oversized.health("token")).rejects.toMatchObject({
      code: "microsoft_planner_response_too_large",
    });
    const throttled = new MicrosoftPlannerApiAdapter(
      async () => new Response("{}", { status: 429 }),
    );
    await expect(throttled.health("token")).rejects.toMatchObject({
      code: "microsoft_planner_rate_limited",
      statusCode: 429,
    });
  });
});
