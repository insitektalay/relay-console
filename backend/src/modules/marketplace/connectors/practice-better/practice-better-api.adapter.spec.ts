import { PracticeBetterApiAdapter } from "./practice-better-api.adapter";

describe("PracticeBetterApiAdapter", () => {
  const adapter = new PracticeBetterApiAdapter();
  const credentials = {
    clientId: "customer-client-id",
    clientSecret: "customer-client-secret",
  };
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function mockFetch() {
    global.fetch = jest.fn().mockImplementation(async (url: string | URL) => {
      const parsed = new URL(String(url));
      if (parsed.pathname === "/oauth2/token")
        return new Response(
          JSON.stringify({
            access_token: "derived-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200 },
        );
      return new Response(JSON.stringify({ data: [], access_token: "redact-me" }), {
        status: 200,
      });
    });
  }

  it("exchanges customer credentials and binds reads to the fixed API origin", async () => {
    mockFetch();
    const data = await adapter.read(credentials, {
      path: "/consultant/records",
      query: { limit: 25, status: ["created"] },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.practicebetter.io/oauth2/token",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
        redirect: "error",
      }),
    );
    const tokenRequest = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(String(tokenRequest.body)).toBe(
      "client_id=customer-client-id&client_secret=customer-client-secret",
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        origin: "https://api.practicebetter.io",
        pathname: "/consultant/records",
        search: "?limit=25&status=created",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer derived-access-token",
        }),
        redirect: "error",
      }),
    );
    expect(data).toEqual({ data: [], access_token: "[redacted]" });
  });

  it("allows non-mutating report POST operations without widening the route", async () => {
    mockFetch();
    await adapter.read(credentials, {
      method: "POST",
      path: "/consultant/reports/billing/statement",
      json: { start: "2026-01-01", end: "2026-01-31" },
    });
    await expect(
      Promise.resolve().then(() =>
        adapter.read(credentials, {
          method: "POST",
          path: "/consultant/records",
          json: { first_name: "Test" },
        }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("allows representative clinical, scheduling, program, and webhook mutations", async () => {
    mockFetch();
    await adapter.manage(credentials, {
      method: "PUT",
      path: "/consultant/medicalhistory/client-1/healthproducts",
      json: { name: "Example" },
    });
    await adapter.manage(credentials, {
      method: "POST",
      path: "/consultant/sessions/session-1/cancel",
      json: { reason: "requested" },
    });
    await adapter.manage(credentials, {
      method: "POST",
      path: "/consultant/courses/course-1/enrollments",
      json: { records: ["client-1"] },
    });
    await adapter.manage(credentials, {
      method: "DELETE",
      path: "/webhooks/subscription/subscription-1",
    });
    expect(global.fetch).toHaveBeenCalledTimes(8);
  });

  it("rejects unofficial routes, missing credentials, and credential-bearing agent input", async () => {
    await expect(
      Promise.resolve().then(() =>
        adapter.read(credentials, { path: "https://example.com/steal" }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.read(
        { ...credentials, clientSecret: "" },
        { path: "/consultant/profile" },
      ),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      Promise.resolve().then(() =>
        adapter.manage(credentials, {
          method: "POST",
          path: "/consultant/records",
          json: { apiKey: "leak" },
        }),
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
