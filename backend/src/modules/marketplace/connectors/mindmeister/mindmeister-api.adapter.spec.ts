import { MindMeisterApiAdapter } from "./mindmeister-api.adapter";

describe("MindMeisterApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses the fixed v2 origin and bearer token for profile reads", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: 7, name: "Alex" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(new MindMeisterApiAdapter().callRead("oauth-token", { operation: "profile.get" })).resolves.toMatchObject({ id: 7 });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://www.mindmeister.com/api/v2/users/me");
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer oauth-token");
  });
  it("maps exact legacy write methods to the OAuth v1 endpoint", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response("<rsp stat=\"ok\"/>", { status: 200, headers: { "Content-Type": "application/xml" } }));
    await new MindMeisterApiAdapter().callWrite("oauth-token", { operation: "v1.mm.maps.add", params: { title: "Plan" } });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/services/rest/oauth2?method=mm.maps.add");
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain("title=Plan");
  });
  it("rejects undocumented operations and credential fields", async () => {
    await expect(new MindMeisterApiAdapter().callRead("oauth-token", { operation: "maps.destroy_everything" })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new MindMeisterApiAdapter().callRead("oauth-token", { operation: "maps.list", query: { access_token: "nope" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });
  it("bounds binary provider responses", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(new Uint8Array(16_000_001), { status: 200, headers: { "Content-Type": "application/pdf" } }));
    await expect(new MindMeisterApiAdapter().callRead("oauth-token", { operation: "maps.export_pdf", params: { id: 1 } })).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
