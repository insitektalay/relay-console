import { VagaroApiAdapter } from "./vagaro-api.adapter";

describe("VagaroApiAdapter", () => {
  const adapter = new VagaroApiAdapter();
  const credentials = {
    clientId: "customer-client-id",
    clientSecret: "customer-client-secret",
    region: "us04",
  };
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockFetch() {
    global.fetch = jest.fn().mockImplementation(async (url: URL) => {
      if (url.pathname.endsWith("/merchants/generate-access-token"))
        return new Response(
          JSON.stringify({
            status: 200,
            responseCode: 1000,
            data: { access_token: "derived-access-token", expires_in: 3600 },
          }),
          { status: 200 },
        );
      return new Response(JSON.stringify({ status: 200, data: {} }), {
        status: 200,
      });
    });
  }

  it("exchanges encrypted customer credentials and binds reads to the configured regional path", async () => {
    mockFetch();
    await adapter.read(credentials, {
      method: "POST",
      path: "/api/v2/appointments/availability",
      json: { businessId: "business-1", serviceId: "service-1" },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        origin: "https://api.vagaro.com",
        pathname: "/us04/api/v2/merchants/generate-access-token",
      }),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          clientId: "customer-client-id",
          clientSecretKey: "customer-client-secret",
          scope: "read access",
        }),
        redirect: "error",
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        origin: "https://api.vagaro.com",
        pathname: "/us04/api/v2/appointments/availability",
      }),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          accessToken: "derived-access-token",
        }),
        redirect: "error",
      }),
    );
  });

  it("requests the documented minimum mutation scope", async () => {
    mockFetch();
    await adapter.manage(credentials, {
      method: "PUT",
      path: "/api/v2/employees/employee-1",
      json: { firstName: "Alex" },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.any(URL),
      expect.objectContaining({
        body: expect.stringContaining('"scope":"write employee"'),
      }),
    );

    await adapter.manage(credentials, {
      method: "POST",
      path: "/api/v2/appointments/create",
      json: { businessId: "business-1" },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      expect.any(URL),
      expect.objectContaining({
        body: expect.stringContaining('"scope":"write access"'),
      }),
    );
  });

  it("permits every route class but excludes the undocumented internal Sola route", async () => {
    mockFetch();
    await adapter.read(credentials, {
      method: "GET",
      path: "/api/v2/merchants/access-levels",
    });
    await adapter.manage(credentials, {
      method: "POST",
      path: "/api/v2/personal-tasks/delete/task-1",
      json: {},
    });
    await expect(
      Promise.resolve().then(() =>
        adapter.manage(credentials, {
          method: "POST",
          path: "/api/v2/merchants/settings/suite-location/merchants/m-1/solainvite",
        }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("rejects unofficial routes, invalid regions, and credential-bearing agent input", async () => {
    await expect(
      Promise.resolve().then(() =>
        adapter.read(credentials, { path: "https://example.com/steal" }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.read(
        { ...credentials, region: "https://example.com" },
        { method: "POST", path: "/api/v2/customers", json: {} },
      ),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      Promise.resolve().then(() =>
        adapter.manage(credentials, {
          method: "POST",
          path: "/api/v2/customers/create",
          json: { accessToken: "leak" },
        }),
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
