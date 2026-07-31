import { RevApiAdapter, RevApiError } from "./rev-api.adapter";

describe("RevApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { clientApiKey: "fixture-client", userApiKey: "fixture-user" };
  it("pins the official origin, injects the Rev key pair, and bounds order lists", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ orders: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    await new RevApiAdapter().listOrders(credentials, { page_size: 1000 });
    const [request, init] = fetchMock.mock.calls[0]; const url = new URL(String(request));
    expect(url.origin + url.pathname).toBe("https://api.rev.com/api/v1/orders"); expect(url.searchParams.get("page_size")).toBe("20"); expect((init?.headers as Record<string, string>).Authorization).toBe("Rev fixture-client:fixture-user");
  });
  it("blocks alternate paths, caller callbacks, and credential fields", async () => {
    const adapter = new RevApiAdapter();
    await expect(adapter.request(credentials, { method: "GET", path: "/../oauth" })).rejects.toMatchObject<Partial<RevApiError>>({ code: "provider_validation_error" });
    await expect(adapter.placeOrder(credentials, { notification: { url: "https://attacker.example" } })).rejects.toMatchObject<Partial<RevApiError>>({ code: "policy_blocked" });
    await expect(adapter.request(credentials, { method: "POST", path: "/orders", json: { api_key: "stolen" } })).rejects.toMatchObject<Partial<RevApiError>>({ code: "policy_blocked" });
  });
  it("returns an approved share link while redacting credential-shaped response fields", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ share_url: "https://www.rev.com/edit/fixture", api_key: "secret" }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(new RevApiAdapter().createShareLink(credentials, { attachmentId: "attachment-1", access: "ReadOnly" })).resolves.toEqual({ share_url: "https://www.rev.com/edit/fixture", api_key: "[redacted]" });
  });
});
