import {
  MURAL_READ_OPERATIONS,
  MURAL_WRITE_OPERATIONS,
  MuralApiAdapter,
  MuralApiError,
} from "./mural-api.adapter";

describe("MuralApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the official public API and exposes the exact current 88-operation surface", async () => {
    expect(MURAL_READ_OPERATIONS).toHaveLength(31);
    expect(MURAL_WRITE_OPERATIONS).toHaveLength(57);
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ value: [{ id: "workspace1234.1606743986126" }] }), { status: 200 }),
    );
    await expect(new MuralApiAdapter().callRead("oauth-token", {
      path: "/workspaces/workspace1234/murals",
      query: { limit: 50 },
    })).resolves.toEqual({ value: [{ id: "workspace1234.1606743986126" }] });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://app.mural.co/api/public/v1/workspaces/workspace1234/murals?limit=50");
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "GET", redirect: "error" }));
  });

  it("allows exact documented mutations and rejects undocumented or cross-policy routes", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ value: { id: "widget123" } }), { status: 201 }),
    );
    await expect(new MuralApiAdapter().callWrite("oauth-token", {
      method: "POST",
      path: "/murals/workspace1234.1606743986126/widgets/sticky-note",
      json: { text: "Next step" },
    })).resolves.toEqual({ value: { id: "widget123" } });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ text: "Next step" });

    const adapter = new MuralApiAdapter();
    await expect(adapter.callRead("oauth-token", { path: "/murals/example/export" })).rejects.toMatchObject<Partial<MuralApiError>>({ code: "provider_validation_error" });
    await expect(adapter.callWrite("oauth-token", { method: "GET", path: "/users/me" })).rejects.toMatchObject<Partial<MuralApiError>>({ code: "provider_validation_error" });
    await expect(adapter.callWrite("oauth-token", { method: "POST", path: "/admin/users", json: {} })).rejects.toMatchObject<Partial<MuralApiError>>({ code: "provider_validation_error" });
  });

  it("blocks credential-bearing request fields and path traversal", async () => {
    const adapter = new MuralApiAdapter();
    await expect(adapter.callWrite("oauth-token", {
      method: "POST",
      path: "/rooms",
      json: { name: "Planning", clientSecret: "must-not-pass" },
    })).rejects.toMatchObject<Partial<MuralApiError>>({ code: "policy_blocked" });
    await expect(adapter.callRead("oauth-token", { path: "/workspaces/../users" })).rejects.toMatchObject<Partial<MuralApiError>>({ code: "provider_validation_error" });
  });
});
