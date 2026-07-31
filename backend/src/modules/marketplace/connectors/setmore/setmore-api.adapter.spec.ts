import { SetmoreApiAdapter } from "./setmore-api.adapter";

describe("SetmoreApiAdapter", () => {
  const adapter = new SetmoreApiAdapter();
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockFetch() {
    global.fetch = jest.fn().mockImplementation(async (url: URL) => {
      if (url.pathname.endsWith("/o/oauth2/token"))
        return new Response(JSON.stringify({ response: true, data: { token: { access_token: "derived-access-token", expires_in: 604799 } } }), { status: 200 });
      return new Response(JSON.stringify({ response: true, data: {} }), { status: 200 });
    });
  }

  it("exchanges the encrypted refresh token and binds reads to Setmore's fixed origin", async () => {
    mockFetch();
    await adapter.read({ refreshToken: "provider-refresh-token" }, { path: "/api/v1/bookingapi/services" });
    expect(global.fetch).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ origin: "https://developer.setmore.com", pathname: "/api/v1/o/oauth2/token", search: "?refreshToken=provider-refresh-token" }),
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ origin: "https://developer.setmore.com", pathname: "/api/v1/bookingapi/services" }),
      expect.objectContaining({ method: "GET", headers: expect.objectContaining({ Authorization: "Bearer derived-access-token" }), redirect: "error" }),
    );
  });

  it("treats the documented POST slot lookup as a read", async () => {
    mockFetch();
    await adapter.read({ refreshToken: "provider-refresh-token" }, { method: "POST", path: "/api/v1/bookingapi/slots", json: { staff_key: "staff", service_key: "service", selected_date: "15/07/2026" } });
    expect(global.fetch).toHaveBeenNthCalledWith(2, expect.any(URL), expect.objectContaining({ method: "POST" }));
  });

  it("permits only documented mutations", async () => {
    mockFetch();
    await adapter.manage({ refreshToken: "provider-refresh-token" }, { method: "PUT", path: "/api/v1/bookingapi/appointments/appointment-1/label", query: { label: "Confirmed" } });
    await expect(Promise.resolve().then(() => adapter.manage({ refreshToken: "provider-refresh-token" }, { method: "DELETE", path: "/api/v1/bookingapi/appointments/appointment-1" }))).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("rejects unofficial routes and credential-bearing agent input", async () => {
    await expect(Promise.resolve().then(() => adapter.read({ refreshToken: "provider-refresh-token" }, { path: "https://example.com/steal" }))).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(Promise.resolve().then(() => adapter.manage({ refreshToken: "provider-refresh-token" }, { method: "POST", path: "/api/v1/bookingapi/customer/create", json: { accessToken: "leak" } }))).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
