import {
  CreatioApiAdapter,
  type CreatioCredentials,
} from "./creatio-api.adapter";

const credentials: CreatioCredentials = {
  host: "relay-test.creatio.com",
  username: "relay-integration-user",
  password: "user-password",
};
const contactId = "11a71596-83e7-624d-c792-5ab9006dd493";
const sessionCookie =
  "BPMLOADER=loader-cookie; Path=/; HttpOnly, .ASPXAUTH=auth-cookie; Path=/; HttpOnly, BPMCSRF=csrf-cookie; Path=/, UserName=user-cookie; Path=/; HttpOnly";

function loginResponse(status = 200, code = 0) {
  return new Response(
    JSON.stringify({
      Code: code,
      Message: code === 0 ? "" : "Authentication failed",
      Exception: null,
    }),
    { status, headers: { "Set-Cookie": sessionCookie } },
  );
}

describe("CreatioApiAdapter", () => {
  const originalFetch = global.fetch;
  let adapter: CreatioApiAdapter;

  beforeEach(() => {
    adapter = new CreatioApiAdapter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("authenticates at the exact tenant and pins health to OData 4", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve(loginResponse()))
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ value: [] }), { status: 200 }),
        ),
      );
    global.fetch = fetchMock;

    await expect(adapter.health(credentials)).resolves.toEqual({
      authenticated: true,
      protocol: "OData 4",
      tenant: "https://relay-test.creatio.com",
    });
    const [loginUrl, loginInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(loginUrl.toString()).toBe(
      "https://relay-test.creatio.com/ServiceModel/AuthService.svc/Login",
    );
    expect(JSON.parse(loginInit.body as string)).toEqual({
      UserName: "relay-integration-user",
      UserPassword: "user-password",
    });
    expect(loginInit.redirect).toBe("error");
    const [apiUrl, apiInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(apiUrl.toString()).toBe(
      "https://relay-test.creatio.com/0/odata/Contact?%24select=Id&%24top=1&%24skip=0",
    );
    const headers = apiInit.headers as Record<string, string>;
    expect(headers.BPMCSRF).toBe("csrf-cookie");
    expect(headers.Cookie).toContain(".ASPXAUTH=auth-cookie");
    expect(headers.Cookie).toContain("BPMCSRF=csrf-cookie");
    expect(apiInit.redirect).toBe("error");
  });

  it("constructs bounded selected fields, filters, ordering, and pages", async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve(loginResponse()))
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ value: [] }), { status: 200 }),
        ),
      );

    await adapter.read(credentials, {
      operation: "list",
      entity: "Contact",
      fields: ["Id", "Name", "Email"],
      filters: {
        Name: { startswith: "Relay" },
        Email: { ne: null },
      },
      orderBy: "Name",
      direction: "desc",
      top: 25,
      skip: 50,
    });
    const [url] = (global.fetch as jest.Mock).mock.calls[1] as [URL];
    expect(url.pathname).toBe("/0/odata/Contact");
    expect(url.searchParams.get("$select")).toBe("Id,Name,Email");
    expect(url.searchParams.get("$filter")).toBe(
      "startswith(Name,'Relay') and Email ne null",
    );
    expect(url.searchParams.get("$orderby")).toBe("Name desc");
    expect(url.searchParams.get("$top")).toBe("25");
    expect(url.searchParams.get("$skip")).toBe("50");
  });

  it("sends exact OData create and update operations", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve(loginResponse()))
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ Id: contactId }), { status: 201 }),
        ),
      )
      .mockImplementationOnce(() => Promise.resolve(loginResponse()))
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(null, { status: 204 })),
      );
    global.fetch = fetchMock;

    await adapter.manage(credentials, {
      operation: "create",
      entity: "Contact",
      attributes: { Name: "Relay Test" },
    });
    await adapter.manage(credentials, {
      operation: "update",
      entity: "Contact",
      recordId: contactId,
      attributes: { Email: "relay@example.test" },
    });
    const [createUrl, createInit] = fetchMock.mock.calls[1] as [
      URL,
      RequestInit,
    ];
    expect(createUrl.pathname).toBe("/0/odata/Contact");
    expect(createInit.method).toBe("POST");
    expect(JSON.parse(createInit.body as string)).toEqual({
      Name: "Relay Test",
    });
    const [updateUrl, updateInit] = fetchMock.mock.calls[3] as [
      URL,
      RequestInit,
    ];
    expect(updateUrl.pathname).toBe(`/0/odata/Contact(${contactId})`);
    expect(updateInit.method).toBe("PATCH");
  });

  it("rejects non-Creatio Cloud origins and unsupported entities", async () => {
    await expect(
      adapter.read(
        { ...credentials, host: "crm.example.com" },
        { operation: "list", entity: "Contact" },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(() =>
      adapter.read(credentials, { operation: "list", entity: "SysAdminUnit" }),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
  });

  it("rejects credential-shaped attributes before authentication", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    expect(() =>
      adapter.manage(credentials, {
        operation: "create",
        entity: "Contact",
        attributes: { Name: "Relay", BPMCSRF: "not-allowed" },
      }),
    ).toThrow(expect.objectContaining({ code: "policy_blocked" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps authentication and API throttle failures to safe categories", async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve(loginResponse(401, 1)));
    await expect(
      adapter.read(credentials, { operation: "list", entity: "Contact" }),
    ).rejects.toMatchObject({ code: "token_refresh_failed", statusCode: 401 });

    global.fetch = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve(loginResponse()))
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { message: "throttled" } }), {
            status: 429,
          }),
        ),
      );
    await expect(
      adapter.read(credentials, { operation: "list", entity: "Contact" }),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });

  it("returns a safe authentication network failure", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("private network detail"));
    await expect(
      adapter.read(credentials, { operation: "list", entity: "Contact" }),
    ).rejects.toMatchObject({
      code: "provider_unavailable",
      message: "Creatio authentication could not be reached.",
    });
  });
});
