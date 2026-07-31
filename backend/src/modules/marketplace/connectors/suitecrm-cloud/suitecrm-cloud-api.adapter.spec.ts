import {
  SuiteCrmCloudApiAdapter,
  type SuiteCrmCloudCredentials,
} from "./suitecrm-cloud-api.adapter";

const credentials: SuiteCrmCloudCredentials = {
  host: "relay-test.suiteondemand.com",
  clientId: "client-id",
  clientSecret: "client-secret",
};
const accountId = "11a71596-83e7-624d-c792-5ab9006dd493";

describe("SuiteCrmCloudApiAdapter", () => {
  const originalFetch = global.fetch;
  let adapter: SuiteCrmCloudApiAdapter;

  beforeEach(() => {
    adapter = new SuiteCrmCloudApiAdapter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("exchanges the customer OAuth client and pins V8 health to the hosted tenant", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              token_type: "Bearer",
              expires_in: 3600,
              access_token: "derived-token",
            }),
            { status: 200 },
          ),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ data: { Accounts: { label: "Accounts" } } }),
            {
              status: 200,
            },
          ),
        ),
      );
    global.fetch = fetchMock;

    await expect(adapter.health(credentials)).resolves.toMatchObject({
      oauthVerified: true,
      apiVersion: "V8",
    });
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(tokenUrl.toString()).toBe(
      "https://relay-test.suiteondemand.com/Api/access_token",
    );
    expect(JSON.parse(tokenInit.body as string)).toEqual({
      grant_type: "client_credentials",
      client_id: "client-id",
      client_secret: "client-secret",
    });
    const [apiUrl, apiInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(apiUrl.toString()).toBe(
      "https://relay-test.suiteondemand.com/Api/V8/meta/modules",
    );
    expect((apiInit.headers as Record<string, string>).Authorization).toBe(
      "Bearer derived-token",
    );
    expect(tokenInit.redirect).toBe("error");
    expect(apiInit.redirect).toBe("error");
  });

  it("constructs bounded JSON API fields, filters, sorting, and pagination", async () => {
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
          new Response(JSON.stringify({ data: [] }), { status: 200 }),
        ),
      );

    await adapter.read(credentials, {
      operation: "list",
      module: "Accounts",
      fields: ["name", "account_type"],
      filters: { account_type: { eq: "Customer" } },
      sortField: "name",
      sortDirection: "DESC",
      pageNumber: 3,
      pageSize: 25,
    });
    const [url] = (global.fetch as jest.Mock).mock.calls[1] as [URL];
    expect(url.pathname).toBe("/Api/V8/module/Accounts");
    expect(url.searchParams.get("fields[Accounts]")).toBe("name,account_type");
    expect(url.searchParams.get("filter[operator]")).toBe("and");
    expect(url.searchParams.get("filter[account_type][eq]")).toBe("Customer");
    expect(url.searchParams.get("sort")).toBe("-name");
    expect(url.searchParams.get("page[number]")).toBe("3");
    expect(url.searchParams.get("page[size]")).toBe("25");
  });

  it("sends an exact JSON API record create", async () => {
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
          new Response(
            JSON.stringify({ data: { type: "Accounts", id: accountId } }),
            {
              status: 201,
            },
          ),
        ),
      );

    await adapter.manage(credentials, {
      operation: "create",
      module: "Accounts",
      attributes: { name: "Relay Test" },
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[1] as [
      URL,
      RequestInit,
    ];
    expect(url.pathname).toBe("/Api/V8/module");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      data: { type: "Accounts", attributes: { name: "Relay Test" } },
    });
  });

  it("rejects non-hosted origins and unsupported dynamic modules", async () => {
    await expect(
      adapter.read(
        { ...credentials, host: "crm.example.com" },
        { operation: "modules" },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(() =>
      adapter.read(credentials, { operation: "fields", module: "Users" }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
  });

  it("rejects credential-shaped attributes before OAuth or API requests", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    expect(() =>
      adapter.manage(credentials, {
        operation: "create",
        module: "Contacts",
        attributes: { last_name: "Lovelace", client_secret: "not-allowed" },
      }),
    ).toThrow(expect.objectContaining({ code: "policy_blocked" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps JSON API authorization errors without exposing provider detail", async () => {
    global.fetch = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              errors: [{ status: "401", title: "Invalid client" }],
            }),
            { status: 401 },
          ),
        ),
      );
    await expect(
      adapter.read(credentials, { operation: "modules" }),
    ).rejects.toMatchObject({
      code: "token_expired",
      statusCode: 401,
    });
  });

  it("returns a safe network failure", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("private network detail"));
    await expect(
      adapter.read(credentials, { operation: "modules" }),
    ).rejects.toMatchObject({
      code: "provider_unavailable",
      message: "SuiteCRM Cloud could not be reached.",
    });
  });
});
