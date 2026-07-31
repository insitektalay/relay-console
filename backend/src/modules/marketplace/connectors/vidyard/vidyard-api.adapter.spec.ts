import { VidyardApiAdapter, VidyardApiError } from "./vidyard-api.adapter";

describe("VidyardApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { apiToken: "fixture-token" };
  it("pins the official origin, injects auth, and bounds lists", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
    await new VidyardApiAdapter().listPlayers(credentials, { perPage: 1000 });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://api.vidyard.com/dashboard/v1/players"); expect(url.searchParams.get("auth_token")).toBe("fixture-token"); expect(url.searchParams.get("per_page")).toBe("50");
  });
  it("blocks alternate resources and caller-supplied credentials", async () => {
    const adapter = new VidyardApiAdapter();
    await expect(adapter.request(credentials, { method: "GET", path: "/../oauth", query: {} })).rejects.toMatchObject<Partial<VidyardApiError>>({ code: "provider_validation_error" });
    await expect(adapter.request(credentials, { method: "POST", path: "/players", json: { auth_token: "stolen" } })).rejects.toMatchObject<Partial<VidyardApiError>>({ code: "policy_blocked" });
  });
  it("redacts credential-shaped response fields", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: 1, api_token: "secret" }), { status: 200 }));
    await expect(new VidyardApiAdapter().listAccounts(credentials)).resolves.toEqual({ id: 1, api_token: "[redacted]" });
  });
});
