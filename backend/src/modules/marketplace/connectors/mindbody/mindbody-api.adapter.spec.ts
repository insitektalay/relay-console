import { MindbodyApiAdapter } from "./mindbody-api.adapter";

describe("MindbodyApiAdapter", () => {
  const adapter = new MindbodyApiAdapter();
  const credentials = {
    apiKey: "customer-api-key",
    siteId: "12345",
    staffToken: "customer-staff-token",
  };
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockFetch() {
    global.fetch = jest.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ PaginationResponse: {}, Sites: [] }), {
          status: 200,
        }),
    );
  }

  it("pins Public API V6 requests to the configured site and server-side credentials", async () => {
    mockFetch();
    await adapter.read(credentials, {
      path: "/public/v6/site/sites",
      query: { Limit: 10 },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://api.mindbodyonline.com",
        pathname: "/public/v6/site/sites",
        search: "?Limit=10&SiteId=12345",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "API-Key": "customer-api-key",
          Authorization: "customer-staff-token",
          "User-Agent": "RelayConsole/1.0",
        }),
        redirect: "error",
      }),
    );
  });

  it("permits fixed and identifier-bearing operations from the official 145-operation business surface", async () => {
    mockFetch();
    await adapter.manage(credentials, {
      method: "POST",
      path: "/public/v6/appointment/addappointment",
      json: { ClientId: "client-1" },
    });
    await adapter.read(credentials, {
      path: "/public/v6/pickaspot/v1/class/class-1",
    });
    await adapter.manage(credentials, {
      method: "PATCH",
      path: "/public/v6/class/updateclassschedulenotes/schedule-1",
      json: { Notes: "Updated" },
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.any(URL),
      expect.objectContaining({
        body: expect.stringContaining('"SiteId":12345'),
      }),
    );
  });

  it("keeps staff-token lifecycle and undocumented routes out of agent control", async () => {
    await expect(
      Promise.resolve().then(() =>
        adapter.manage(credentials, {
          method: "POST",
          path: "/public/v6/usertoken/renew",
          json: {},
        }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      Promise.resolve().then(() =>
        adapter.read(credentials, { path: "/public/v6/site/not-real" }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      Promise.resolve().then(() =>
        adapter.read(credentials, { path: "https://example.com/steal" }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("preserves explicit provider-authorized sites and blocks credential-bearing agent input", async () => {
    global.fetch = jest.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ Clients: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await adapter.read(credentials, {
      path: "/public/v6/client/clients",
      query: { SiteId: "99999" },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ search: "?SiteId=99999" }),
      expect.any(Object),
    );
    await expect(
      Promise.resolve().then(() =>
        adapter.manage(credentials, {
          method: "POST",
          path: "/public/v6/client/addclient",
          json: { apiKey: "leak" },
        }),
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
