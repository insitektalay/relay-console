import {
  ReclaimAiApiAdapter,
  ReclaimAiApiError,
} from "./reclaim-ai-api.adapter";

describe("ReclaimAiApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  const credentials = { apiKey: "reclaim-secret" };

  it("uses the fixed public API origin and server-held bearer key", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await new ReclaimAiApiAdapter().read(credentials, {
      path: "/events",
      query: { start: "2026-07-15", end: "2026-07-16", allConnected: true },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.app.reclaim.ai/api/events?start=2026-07-15&end=2026-07-16&allConnected=true",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer reclaim-secret" }),
    );
  });

  it("allows exact task, planner, habit, and scheduling-link mutations", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ id: "result" }), { status: 200 }),
      );
    await new ReclaimAiApiAdapter().manage(credentials, {
      method: "PATCH",
      path: "/tasks/task_1",
      json: { title: "Ship" },
    });
    await new ReclaimAiApiAdapter().manage(credentials, {
      method: "POST",
      path: "/smart-habits/planner/habit_1/start",
    });
    await new ReclaimAiApiAdapter().manage(credentials, {
      method: "POST",
      path: "/scheduling-link/derivative",
      json: { parentId: "link_1" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("blocks unknown routes, method mismatches, and credential-bearing input", async () => {
    const api = new ReclaimAiApiAdapter();
    expect(() => api.read(credentials, { path: "/billing" })).toThrow(
      ReclaimAiApiError,
    );
    expect(() =>
      api.manage(credentials, { method: "PATCH", path: "/events/event_1" }),
    ).toThrow(ReclaimAiApiError);
    await expect(
      api.manage(credentials, {
        method: "POST",
        path: "/tasks",
        json: { apiToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("redacts credential fields and maps throttling safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ apiKey: "secret" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Slow down" }), { status: 429 }),
      );
    await expect(
      new ReclaimAiApiAdapter().read(credentials, { path: "/users/current" }),
    ).resolves.toEqual({ apiKey: "[redacted]" });
    await expect(
      new ReclaimAiApiAdapter().read(credentials, { path: "/users/current" }),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
