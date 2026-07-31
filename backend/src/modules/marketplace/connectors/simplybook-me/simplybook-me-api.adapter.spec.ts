import { SimplyBookMeApiAdapter } from "./simplybook-me-api.adapter";

describe("SimplyBookMeApiAdapter", () => {
  const adapter = new SimplyBookMeApiAdapter();
  const credentials = {
    companyLogin: "relay-test",
    apiKey: "company-key",
    userLogin: "admin",
    userApiKey: "api_user_key_test",
  };
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });
  const response = (result: unknown) =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  it("derives an hourly public token and binds the call to the fixed company API", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response("hourly-token"))
      .mockResolvedValueOnce(response([{ id: 1 }]));
    await adapter.publicRead(credentials, {
      method: "getEventList",
      params: [true, true],
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "https://user-api.simplybook.me/login",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"method":"getToken"'),
        redirect: "error",
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://user-api.simplybook.me/",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Company-Login": "relay-test",
          "X-Token": "hourly-token",
        }),
        body: expect.stringContaining('"method":"getEventList"'),
      }),
    );
  });

  it("uses an API User Key for documented administration mutations", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response("admin-token"))
      .mockResolvedValueOnce(response(true));
    await adapter.adminManage(credentials, {
      method: "cancelBooking",
      params: [42],
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "https://user-api.simplybook.me/login",
      expect.objectContaining({
        body: expect.stringContaining('"method":"getUserToken"'),
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://user-api.simplybook.me/admin",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Token": "admin-token" }),
        body: expect.stringContaining('"method":"cancelBooking"'),
      }),
    );
  });

  it("rejects methods outside the exact public and administration allowlists", async () => {
    await expect(
      Promise.resolve().then(() =>
        adapter.publicRead(credentials, { method: "deleteEverything" }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      Promise.resolve().then(() =>
        adapter.adminManage(credentials, { method: "getBookings" }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("rejects credential-bearing agent parameters", async () => {
    global.fetch = jest.fn();
    await expect(
      adapter.publicManage(credentials, {
        method: "book",
        params: [{ apiKey: "leak" }],
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("redacts credential-shaped provider output", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response("hourly-token"))
      .mockResolvedValueOnce(response({ id: 1, apiKey: "provider-secret" }));
    await expect(
      adapter.publicRead(credentials, { method: "getCompanyInfo" }),
    ).resolves.toEqual({ id: 1, apiKey: "[redacted]" });
  });
});
