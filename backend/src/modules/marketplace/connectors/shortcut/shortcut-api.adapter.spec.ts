import { ShortcutApiAdapter, ShortcutApiError } from "./shortcut-api.adapter";

describe("ShortcutApiAdapter", () => {
  const api = new ShortcutApiAdapter();

  afterEach(() => jest.restoreAllMocks());

  it("validates a token against the current member and never places it in the URL or body", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "member_1", name: "Relay Test" }), {
        status: 200,
      }),
    );
    await expect(
      api.health({ apiToken: "shortcut_secret" }),
    ).resolves.toMatchObject({ id: "member_1" });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.app.shortcut.com/api/v3/member",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)[
        "Shortcut-Token"
      ],
    ).toBe("shortcut_secret");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("shortcut_secret");
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toContain(
      "shortcut_secret",
    );
  });

  it("separates bounded reads from write methods", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify([{ id: 1 }]), { status: 200 }),
      );
    await api.read(
      { apiToken: "token" },
      { path: "/api/v3/stories/123", query: { full: true } },
    );
    await api.write(
      { apiToken: "token" },
      { method: "PUT", path: "/api/v3/stories/123", json: { name: "Bounded" } },
    );
    expect(fetchMock.mock.calls.map((call) => call[1]?.method)).toEqual([
      "GET",
      "PUT",
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.app.shortcut.com/api/v3/stories/123?full=true",
    );
  });

  it("blocks foreign origins, traversal, unsupported methods, and credential-bearing fields before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      api.read(
        { apiToken: "token" },
        { path: "https://attacker.example/api/v3/member" },
      ),
    ).rejects.toMatchObject<Partial<ShortcutApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      api.read({ apiToken: "token" }, { path: "/api/v3/../settings" }),
    ).rejects.toMatchObject<Partial<ShortcutApiError>>({
      code: "provider_validation_error",
    });
    expect(() =>
      api.write(
        { apiToken: "token" },
        { method: "PATCH", path: "/api/v3/stories/1" },
      ),
    ).toThrow("Shortcut write method must be POST, PUT, or DELETE.");
    await expect(
      api.write(
        { apiToken: "token" },
        { method: "POST", path: "/api/v3/stories", json: { apiToken: "leak" } },
      ),
    ).rejects.toMatchObject<Partial<ShortcutApiError>>({
      code: "policy_blocked",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps provider errors and redacts credential-like response fields", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
      }),
    );
    await expect(api.health({ apiToken: "bad" })).rejects.toMatchObject<
      Partial<ShortcutApiError>
    >({
      code: "credential_missing",
    });
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 1, token: "leak", nested: { api_key: "leak" } }),
          { status: 200 },
        ),
      );
    await expect(
      api.read({ apiToken: "good" }, { path: "/api/v3/member" }),
    ).resolves.toEqual({
      id: 1,
      token: "[redacted]",
      nested: { api_key: "[redacted]" },
    });
  });
});
