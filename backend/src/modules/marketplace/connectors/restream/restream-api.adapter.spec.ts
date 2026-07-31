import { RestreamApiAdapter, RestreamApiError } from "./restream-api.adapter";

const ok = (value: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: status === 204 ? {} : { "Content-Type": "application/json" },
  });

describe("RestreamApiAdapter", () => {
  it("validates health through the fixed profile endpoint", async () => {
    const request = jest.fn(async () =>
      ok({ id: 42, username: "relay", email: "relay@example.test" }),
    );
    const adapter = new RestreamApiAdapter(request);

    await expect(adapter.health("oauth-token")).resolves.toEqual({
      profile: { id: 42, username: "relay", email: "relay@example.test" },
    });
    expect(request).toHaveBeenCalledWith(
      "https://api.restream.io/v2/user/profile",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-token",
        }),
        redirect: "error",
      }),
    );
  });

  it("bounds event history pagination", async () => {
    const request = jest.fn(async (url: string) => {
      expect(url).toBe(
        "https://api.restream.io/v2/user/events/history?page=2&limit=25",
      );
      return ok({ items: [{ id: "event" }], pagination: { page: 2 } });
    });
    const adapter = new RestreamApiAdapter(request);

    await expect(
      adapter.listEvents("token", { kind: "history", page: 2, limit: 25 }),
    ).resolves.toEqual({
      kind: "history",
      result: { items: [{ id: "event" }], pagination: { page: 2 } },
    });
  });

  it("allows an approval-gated documented event mutation", async () => {
    const request = jest.fn(async (_url: string, init: RequestInit) => {
      expect(init.body).toBe(
        JSON.stringify({ streamType: "encoder", title: "Weekly show" }),
      );
      return ok({ id: "2527849f-f961-4b1d-8ae0-8eae4f068327" }, 201);
    });
    const adapter = new RestreamApiAdapter(request);

    await expect(
      adapter.requestDocumented("token", {
        method: "POST",
        path: "/v2/user/events/new",
        json: { streamType: "encoder", title: "Weekly show" },
      }),
    ).resolves.toEqual({
      method: "POST",
      path: "/v2/user/events/new",
      result: { id: "2527849f-f961-4b1d-8ae0-8eae4f068327" },
    });
  });

  it.each([
    ["GET", "/v2/user/stream-key", undefined],
    [
      "GET",
      "/v2/user/events/2527849f-f961-4b1d-8ae0-8eae4f068327/stream-key",
      undefined,
    ],
    ["POST", "/v2/user/channels", { streamKey: "must-not-enter-agent-input" }],
    ["GET", "/v2/user/../oauth/token", undefined],
  ])("blocks secret or escaping routes", async (method, path, json) => {
    const adapter = new RestreamApiAdapter(jest.fn());
    await expect(
      adapter.requestDocumented("token", { method, path, json }),
    ).rejects.toMatchObject<Partial<RestreamApiError>>({
      code: "policy_blocked",
    });
  });

  it("maps provider authorization failures without exposing the body", async () => {
    const adapter = new RestreamApiAdapter(
      jest.fn(async () => ok({ error: { message: "provider detail" } }, 403)),
    );
    await expect(adapter.listChannels("token")).rejects.toMatchObject<
      Partial<RestreamApiError>
    >({ code: "insufficient_scope", statusCode: 403 });
  });
});
