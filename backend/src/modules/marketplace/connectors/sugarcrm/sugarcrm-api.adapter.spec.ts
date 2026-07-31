import {
  SugarCrmApiAdapter,
  type SugarCrmCredentials,
} from "./sugarcrm-api.adapter";

const credentials: SugarCrmCredentials = {
  host: "relay-test.sugarondemand.com",
  clientId: "relay-oauth-key",
  clientSecret: "client-secret",
  username: "relay-user",
  password: "user-password",
};
const accountId = "11a71596-83e7-624d-c792-5ab9006dd493";

describe("SugarCrmApiAdapter", () => {
  const originalFetch = global.fetch;
  let adapter: SugarCrmApiAdapter;

  beforeEach(() => {
    adapter = new SugarCrmApiAdapter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("exchanges dedicated-user credentials and pins health to REST v11", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: "derived-token",
              refresh_token: "never-return-this",
              download_token: "never-return-this-either",
            }),
            { status: 200 },
          ),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ records: [], next_offset: -1 }), {
            status: 200,
          }),
        ),
      );
    global.fetch = fetchMock;

    await expect(adapter.health(credentials)).resolves.toEqual({
      authenticated: true,
      apiVersion: "v11",
      tenant: "https://relay-test.sugarondemand.com",
    });
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(tokenUrl.toString()).toBe(
      "https://relay-test.sugarondemand.com/rest/v11/oauth2/token",
    );
    expect(JSON.parse(tokenInit.body as string)).toEqual({
      grant_type: "password",
      client_id: "relay-oauth-key",
      client_secret: "client-secret",
      username: "relay-user",
      password: "user-password",
      platform: "relay_console_api",
    });
    const [apiUrl, apiInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(apiUrl.toString()).toBe(
      "https://relay-test.sugarondemand.com/rest/v11/Accounts?fields=id&max_num=1&offset=0",
    );
    expect((apiInit.headers as Record<string, string>)["OAuth-Token"]).toBe(
      "derived-token",
    );
    expect(
      (apiInit.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
    expect(tokenInit.redirect).toBe("error");
    expect(apiInit.redirect).toBe("error");
  });

  it("constructs bounded fields, Sugar filters, sorting, and offsets", async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ access_token: "derived-token" }), {
            status: 200,
          }),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ records: [] }), { status: 200 }),
        ),
      );

    await adapter.read(credentials, {
      operation: "list",
      module: "Accounts",
      fields: ["id", "name", "account_type"],
      filters: {
        account_type: { $equals: "Customer" },
        name: { $starts: "Relay" },
      },
      orderBy: "name",
      direction: "DESC",
      maxNum: 25,
      offset: 50,
    });
    const [url] = (global.fetch as jest.Mock).mock.calls[1] as [URL];
    expect(url.pathname).toBe("/rest/v11/Accounts");
    expect(url.searchParams.get("fields")).toBe("id,name,account_type");
    expect(JSON.parse(url.searchParams.get("filter")!)).toEqual([
      { account_type: { $equals: "Customer" } },
      { name: { $starts: "Relay" } },
    ]);
    expect(url.searchParams.get("order_by")).toBe("name:DESC");
    expect(url.searchParams.get("max_num")).toBe("25");
    expect(url.searchParams.get("offset")).toBe("50");
  });

  it("sends exact REST v11 create and update operations", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ access_token: "token-1" }), {
            status: 200,
          }),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ id: accountId }), { status: 200 }),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ access_token: "token-2" }), {
            status: 200,
          }),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ id: accountId }), { status: 200 }),
        ),
      );
    global.fetch = fetchMock;

    await adapter.manage(credentials, {
      operation: "create",
      module: "Accounts",
      attributes: { name: "Relay Test" },
    });
    await adapter.manage(credentials, {
      operation: "update",
      module: "Accounts",
      recordId: accountId,
      attributes: { account_type: "Customer" },
    });
    const [createUrl, createInit] = fetchMock.mock.calls[1] as [
      URL,
      RequestInit,
    ];
    expect(createUrl.pathname).toBe("/rest/v11/Accounts");
    expect(createInit.method).toBe("POST");
    expect(JSON.parse(createInit.body as string)).toEqual({
      name: "Relay Test",
    });
    const [updateUrl, updateInit] = fetchMock.mock.calls[3] as [
      URL,
      RequestInit,
    ];
    expect(updateUrl.pathname).toBe(`/rest/v11/Accounts/${accountId}`);
    expect(updateInit.method).toBe("PUT");
  });

  it("rejects non-SugarCloud origins and unsupported modules", async () => {
    await expect(
      adapter.read(
        { ...credentials, host: "crm.example.com" },
        { operation: "list", module: "Accounts" },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(() =>
      adapter.read(credentials, { operation: "list", module: "Users" }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
  });

  it("rejects credential-shaped attributes before token or CRM requests", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    expect(() =>
      adapter.manage(credentials, {
        operation: "create",
        module: "Contacts",
        attributes: { last_name: "Lovelace", refresh_token: "not-allowed" },
      }),
    ).toThrow(expect.objectContaining({ code: "policy_blocked" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps Sugar authorization and rate errors to safe Relay categories", async () => {
    global.fetch = jest.fn().mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_message: "The provided authorization grant is invalid.",
          }),
          { status: 401 },
        ),
      ),
    );
    await expect(
      adapter.read(credentials, { operation: "list", module: "Accounts" }),
    ).rejects.toMatchObject({ code: "token_expired", statusCode: 401 });

    global.fetch = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ access_token: "derived-token" }), {
            status: 200,
          }),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "rate_limit" }), {
            status: 429,
          }),
        ),
      );
    await expect(
      adapter.read(credentials, { operation: "list", module: "Accounts" }),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });

  it("returns a safe network failure without exposing transport details", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("private network detail"));
    await expect(
      adapter.read(credentials, { operation: "list", module: "Accounts" }),
    ).rejects.toMatchObject({
      code: "provider_unavailable",
      message: "SugarCRM could not be reached.",
    });
  });
});
