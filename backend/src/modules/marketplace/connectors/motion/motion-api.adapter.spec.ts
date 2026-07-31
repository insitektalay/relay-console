import { MotionApiAdapter, MotionApiError } from "./motion-api.adapter";

describe("MotionApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  const credentials = { apiKey: "motion-secret" };

  it("uses the fixed public origin and server-held X-API-Key", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ tasks: [] }), { status: 200 }),
      );
    await new MotionApiAdapter().read(credentials, {
      path: "/v1/tasks",
      query: { workspaceId: "workspace", status: ["Todo", "Doing"] },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.usemotion.com/v1/tasks?workspaceId=workspace&status=Todo&status=Doing",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({ "X-API-Key": "motion-secret" }),
    );
  });

  it("allows exact documented beta and mutation routes", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ id: "task" }), { status: 200 }),
      );
    await new MotionApiAdapter().read(credentials, {
      path: "/beta/workspaces/workspace/custom-fields",
    });
    await new MotionApiAdapter().manage(credentials, {
      method: "PATCH",
      path: "/v1/tasks/task_1/move",
      json: { workspaceId: "workspace" },
    });
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: "PATCH",
        body: '{"workspaceId":"workspace"}',
      }),
    );
  });

  it("blocks unknown routes, method mismatches, and credential-bearing input", async () => {
    const api = new MotionApiAdapter();
    expect(() => api.read(credentials, { path: "/v1/billing" })).toThrow(
      MotionApiError,
    );
    expect(() =>
      api.manage(credentials, { method: "POST", path: "/v1/tasks/task_1" }),
    ).toThrow(MotionApiError);
    await expect(
      api.manage(credentials, {
        method: "POST",
        path: "/v1/tasks",
        json: { apiKey: "no" },
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
      new MotionApiAdapter().read(credentials, { path: "/v1/users/me" }),
    ).resolves.toEqual({ apiKey: "[redacted]" });
    await expect(
      new MotionApiAdapter().read(credentials, { path: "/v1/users/me" }),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
