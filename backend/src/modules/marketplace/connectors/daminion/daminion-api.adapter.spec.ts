import { DAMINION_CONNECTOR_MANIFEST } from "./daminion.connector";
import {
  DAMINION_API_OPERATION_COUNT,
  DaminionApiAdapter,
  DaminionApiError,
} from "./daminion-api.adapter";

const login = () =>
  new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": ".AspNet.ApplicationCookie=session-value; Path=/; HttpOnly",
    },
  });

describe("DaminionApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes all 331 API help signatures under Safe and Dangerous policy", () => {
    expect(DAMINION_API_OPERATION_COUNT).toBe(331);
    expect(DAMINION_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "daminion.read",
      "daminion.manage",
    ]);
    expect(
      DAMINION_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["daminion_manage"]);
    expect(
      DAMINION_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions,
    ).toEqual([]);
  });

  it("logs into the validated cloud tenant and attaches only the returned session cookie", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, user: "Asset Reader" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    await new DaminionApiAdapter().request(
      {
        tenant: "customer-one",
        username: "relay-user",
        password: "customer-password",
      },
      { method: "GET", path: "/api/Settings/GetLoggedUser" },
    );
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://customer-one.daminion.net/account/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          usernameOrEmailAddress: "relay-user",
          password: "customer-password",
        }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        hostname: "customer-one.daminion.net",
        pathname: "/api/Settings/GetLoggedUser",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: ".AspNet.ApplicationCookie=session-value",
        }),
        redirect: "error",
      }),
    );
  });

  it("builds bounded multipart uploads without overriding the boundary", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, id: 42 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    await new DaminionApiAdapter().request(
      { tenant: "example", username: "relay-user", password: "password" },
      {
        method: "POST",
        path: "/api/Import/UploadFile",
        multipartFields: { title: "Campaign asset" },
        multipartField: "file",
        fileName: "asset.txt",
        contentType: "text/plain",
        contentBase64: Buffer.from("hello").toString("base64"),
      },
    );
    const request = (fetch as jest.Mock).mock.calls[1][1];
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.headers).not.toHaveProperty("Content-Type");
    expect(request.body.get("title")).toBe("Campaign asset");
    expect((request.body.get("file") as File).name).toBe("asset.txt");
  });

  it("supports documented raw content uploads and bounded binary downloads", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(
        new Response(Buffer.from("binary"), {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        }),
      );
    const result = await new DaminionApiAdapter().request(
      { tenant: "example", username: "relay-user", password: "password" },
      { method: "GET", path: "/api/Download/Get/42" },
    );
    expect(result.data).toEqual({
      contentType: "application/octet-stream",
      byteLength: 6,
      contentBase64: Buffer.from("binary").toString("base64"),
    });
  });

  it("permanently blocks credential, server-path, and host-control routes", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(login());
    const adapter = new DaminionApiAdapter();
    const credentials = {
      tenant: "example",
      username: "relay-user",
      password: "password",
    };
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "/api/Settings/GetApiKey",
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/api/Intranet/OpenFile",
        json: { id: 42 },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "/api/MediaItems",
        query: { id: 42 },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("rejects undocumented routes, credential-bearing fields, and tenant escape attempts", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(login());
    const adapter = new DaminionApiAdapter();
    await expect(
      adapter.request(
        { tenant: "example", username: "relay-user", password: "password" },
        { method: "GET", path: "/api/Unknown/Route" },
      ),
    ).rejects.toBeInstanceOf(DaminionApiError);
    await expect(
      adapter.request(
        {
          tenant: "example.daminion.net",
          username: "relay-user",
          password: "password",
        },
        { method: "GET", path: "/api/Settings/GetLoggedUser" },
      ),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.request(
        { tenant: "example", username: "relay-user", password: "password" },
        {
          method: "POST",
          path: "/api/SharedCollection/Create",
          json: { accessToken: "leak" },
        },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
