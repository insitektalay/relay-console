import { KONTAINER_CONNECTOR_MANIFEST } from "./kontainer.connector";
import {
  KONTAINER_OPENAPI_OPERATION_COUNT,
  KontainerApiAdapter,
  KontainerApiError,
} from "./kontainer-api.adapter";

describe("KontainerApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes all 127 OpenAPI operations under Safe and Dangerous policy", () => {
    expect(KONTAINER_OPENAPI_OPERATION_COUNT).toBe(127);
    expect(KONTAINER_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(
      ["kontainer.read", "kontainer.manage"],
    );
    expect(
      KONTAINER_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["kontainer_manage"]);
    expect(
      KONTAINER_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions,
    ).toEqual([]);
  });

  it("pins requests to the validated customer tenant and JSON:API headers", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ meta: { user: "Alex" } }), {
        status: 200,
        headers: { "content-type": "application/vnd.api+json" },
      }),
    );
    await new KontainerApiAdapter().request(
      { tenant: "customer-one", accessToken: "customer-token" },
      { method: "GET", path: "/meta" },
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "customer-one.kontainer.com",
        pathname: "/jsonapi/v2/meta",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/vnd.api+json",
          Authorization: "Bearer customer-token",
        }),
        redirect: "error",
      }),
    );
  });

  it("builds bounded multipart file uploads without overriding the boundary", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "file-1" } }), {
        status: 201,
        headers: { "content-type": "application/vnd.api+json" },
      }),
    );
    await new KontainerApiAdapter().request(
      { tenant: "example", accessToken: "customer-token" },
      {
        method: "POST",
        path: "/dam/folders/folder-1/files",
        multipartFields: {
          "data[type]": "file",
          "data[attributes][name]": "asset.txt",
        },
        multipartField: "data[attributes][file_content]",
        fileName: "asset.txt",
        contentType: "text/plain",
        contentBase64: Buffer.from("hello").toString("base64"),
      },
    );
    const request = (fetch as jest.Mock).mock.calls[0][1];
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.headers).not.toHaveProperty("Content-Type");
    expect(request.body.get("data[type]")).toBe("file");
    expect(
      (request.body.get("data[attributes][file_content]") as File).name,
    ).toBe("asset.txt");
  });

  it("returns bounded binary streams as base64", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(Buffer.from("binary"), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const result = await new KontainerApiAdapter().request(
      { tenant: "example", accessToken: "customer-token" },
      { method: "GET", path: "/dam/files/file-1/stream" },
    );
    expect(result.data).toEqual({
      contentType: "image/png",
      contentBase64: Buffer.from("binary").toString("base64"),
    });
  });

  it("rejects routes, methods, credentials, and tenant escape attempts", async () => {
    const adapter = new KontainerApiAdapter();
    await expect(
      adapter.request(
        { tenant: "example", accessToken: "token" },
        { method: "DELETE", path: "/meta" },
      ),
    ).rejects.toBeInstanceOf(KontainerApiError);
    await expect(
      adapter.request(
        { tenant: "example.kontainer.com", accessToken: "token" },
        { method: "GET", path: "/meta" },
      ),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.request(
        { tenant: "example", accessToken: "token" },
        {
          method: "POST",
          path: "/users",
          json: { accessToken: "leak" },
        },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
