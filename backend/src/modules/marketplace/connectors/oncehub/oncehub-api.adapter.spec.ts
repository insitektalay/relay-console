import { OnceHubApiAdapter } from "./oncehub-api.adapter";

describe("OnceHubApiAdapter", () => {
  const adapter = new OnceHubApiAdapter();
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("binds reads to OnceHub's fixed v2 origin with an API-Key header", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await adapter.read({ apiKey: "customer-key" }, { path: "/booking-calendars", query: { limit: 10 } });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "https://api.oncehub.com", pathname: "/v2/booking-calendars", search: "?limit=10" }),
      expect.objectContaining({ method: "GET", headers: expect.objectContaining({ "API-Key": "customer-key" }), redirect: "error" }),
    );
  });

  it("permits documented mutations from both current v2 references", async () => {
    global.fetch = jest.fn().mockImplementation(async () => new Response(JSON.stringify({ id: "booking-1" }), { status: 200 }));
    await adapter.manage({ apiKey: "customer-key" }, { method: "POST", path: "/booking-calendars/calendar-1/schedule", json: { start_time: "2026-08-01T10:00:00Z" } });
    await adapter.manage({ apiKey: "customer-key" }, { method: "PATCH", path: "/contacts/contact-1", json: { first_name: "Alex" } });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects unofficial or undocumented routes", async () => {
    await expect(Promise.resolve().then(() => adapter.read({ apiKey: "customer-key" }, { path: "https://example.com/steal" }))).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(Promise.resolve().then(() => adapter.manage({ apiKey: "customer-key" }, { method: "DELETE", path: "/bookings/booking-1" }))).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("never accepts credential-bearing request fields", async () => {
    await expect(Promise.resolve().then(() => adapter.manage({ apiKey: "customer-key" }, { method: "POST", path: "/contacts", json: { apiKey: "leak" } }))).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
