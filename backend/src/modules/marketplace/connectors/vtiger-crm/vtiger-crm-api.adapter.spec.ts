import {
  VtigerCrmApiAdapter,
  type VtigerCrmCredentials,
} from "./vtiger-crm-api.adapter";

const credentials: VtigerCrmCredentials = {
  instance: "relay-test",
  cluster: "od2",
  username: "relay@example.com",
  accessKey: "vtiger-test-key",
};

describe("VtigerCrmApiAdapter", () => {
  const originalFetch = global.fetch;
  let adapter: VtigerCrmApiAdapter;

  beforeEach(() => {
    adapter = new VtigerCrmApiAdapter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("binds health to the validated instance and connected Basic-auth user", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: { id: "19x7", email: "relay@example.com" },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    global.fetch = fetchMock;

    await expect(adapter.health(credentials)).resolves.toMatchObject({
      userVerified: true,
      userId: "19x7",
      apiVersion: "v1",
    });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://relay-test.od2.vtiger.com/restapi/v1/vtiger/default/me",
    );
    expect(init.redirect).toBe("error");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("relay@example.com:vtiger-test-key").toString("base64")}`,
    );
  });

  it("constructs a bounded selected-module query instead of accepting raw SQL", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: [] }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock;

    await adapter.read(credentials, {
      operation: "query",
      module: "Contacts",
      fields: ["id", "firstname", "lastname"],
      filter: "email like '%@example.com'",
      orderBy: ["createdtime"],
      direction: "DESC",
      offset: 20,
      limit: 25,
    });

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.origin).toBe("https://relay-test.od2.vtiger.com");
    expect(url.pathname).toBe("/restapi/v1/vtiger/default/query");
    expect(url.searchParams.get("query")).toBe(
      "SELECT id,firstname,lastname FROM Contacts WHERE email like '%@example.com' ORDER BY createdtime DESC LIMIT 20, 25;",
    );
  });

  it("encodes a selected partial record update as a bounded form request", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, result: { id: "4x2063" } }),
          { status: 200 },
        ),
      );
    global.fetch = fetchMock;

    await adapter.manage(credentials, {
      operation: "revise",
      element: { id: "4x2063", firstname: "Ada" },
    });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/restapi/v1/vtiger/default/revise");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(new URLSearchParams(init.body as string).get("element")).toBe(
      JSON.stringify({ id: "4x2063", firstname: "Ada" }),
    );
  });

  it("rejects unofficial clusters, unsupported modules, and injected query clauses", async () => {
    await expect(
      adapter.read({ ...credentials, cluster: "eu1" }, { operation: "me" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() =>
      adapter.read(credentials, { operation: "describe", module: "Users" }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
    expect(() =>
      adapter.read(credentials, {
        operation: "query",
        module: "Contacts",
        filter: "id != '' UNION SELECT * FROM Users",
      }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
  });

  it("rejects credential-bearing record fields before a request", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    expect(() =>
      adapter.manage(credentials, {
        operation: "create",
        module: "Contacts",
        element: { lastname: "Lovelace", access_key: "not-allowed" },
      }),
    ).toThrow(expect.objectContaining({ code: "policy_blocked" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps provider envelope errors and plan quotas to safe Relay errors", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "ACCESS_DENIED",
              message: "Invalid authentication information",
            },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      adapter.read(credentials, { operation: "me" }),
    ).rejects.toMatchObject({
      code: "token_expired",
    });

    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "API_LIMIT_EXCEEDED" },
          }),
          {
            status: 429,
          },
        ),
      ),
    );
    await expect(
      adapter.read(credentials, { operation: "me" }),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
    });
  });

  it("uses safe provider-unavailable errors for network failures", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network detail"));
    await expect(
      adapter.read(credentials, { operation: "me" }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "provider_unavailable",
        message: "Vtiger CRM could not be reached.",
      }),
    );
  });
});
