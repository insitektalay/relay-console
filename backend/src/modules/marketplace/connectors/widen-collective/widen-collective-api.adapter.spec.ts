import { WIDEN_COLLECTIVE_CONNECTOR_MANIFEST } from "./widen-collective.connector";
import {
  WIDEN_COLLECTIVE_SDK_OPERATION_COUNT,
  WidenCollectiveApiAdapter,
  WidenCollectiveApiError,
} from "./widen-collective-api.adapter";

describe("WidenCollectiveApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes the current 94-method SDK surface under Safe and Dangerous policy", () => {
    expect(WIDEN_COLLECTIVE_SDK_OPERATION_COUNT).toBe(94);
    expect(
      WIDEN_COLLECTIVE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["widen-collective.read", "widen-collective.manage"]);
    expect(
      WIDEN_COLLECTIVE_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["widen_collective_manage"]);
    expect(
      WIDEN_COLLECTIVE_CONNECTOR_MANIFEST.approvalProfiles[1]
        .approvalRequiredActions,
    ).toEqual([]);
  });

  it("pins V2 requests to the shared Acquia DAM API and redacts delivery capabilities", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1", downloadUrl: "secret" }), {
        status: 200,
      }),
    );
    const result = await new WidenCollectiveApiAdapter().request(
      { collective: "example", accessToken: "customer-token" },
      { apiVersion: "2", method: "GET", path: "/user" },
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "api.widencollective.com",
        pathname: "/v2/user",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer customer-token",
        }),
        redirect: "error",
      }),
    );
    expect((result.data as any).downloadUrl).toBe("[redacted]");
  });

  it("pins V1 requests to the validated customer collective", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      );
    await new WidenCollectiveApiAdapter().request(
      { collective: "customer-one", accessToken: "customer-token" },
      { apiVersion: "1", method: "GET", path: "/fileformats" },
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "customer-one.widencollective.com",
        pathname: "/api/rest/fileformats",
      }),
      expect.anything(),
    );
  });

  it("builds bounded multipart bodies for SDK upload operations", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "asset-1" }), { status: 201 }),
      );
    await new WidenCollectiveApiAdapter().request(
      { collective: "example", accessToken: "customer-token" },
      {
        apiVersion: "2",
        method: "POST",
        path: "/uploads",
        multipartFields: { profile: "default", filename: "asset.txt" },
        multipartField: "file",
        fileName: "asset.txt",
        contentType: "text/plain",
        contentBase64: Buffer.from("hello").toString("base64"),
      },
    );
    const request = (fetch as jest.Mock).mock.calls[0][1];
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.headers).not.toHaveProperty("Content-Type");
    expect(request.body.get("profile")).toBe("default");
    expect((request.body.get("file") as File).name).toBe("asset.txt");
  });

  it("accepts the SDK version, order, conversion, and workflow route methods", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(async () => new Response("{}"));
    const adapter = new WidenCollectiveApiAdapter();
    const credentials = {
      collective: "example",
      accessToken: "customer-token",
    };
    await adapter.request(credentials, {
      apiVersion: "2",
      method: "GET",
      path: "/assets/asset-1/versions/version-1",
    });
    await adapter.request(credentials, {
      apiVersion: "1",
      method: "POST",
      path: "/order/uuid/order-1/zip",
    });
    await adapter.request(credentials, {
      apiVersion: "1",
      method: "POST",
      path: "/conversion/order/profile/uuid/profile-1",
      json: { uuids: ["asset-1"] },
    });
    await adapter.request(credentials, {
      apiVersion: "2",
      method: "PUT",
      path: "/workflow/projects/project-1/deliverables/deliverable-1/close",
      json: { reason: "complete" },
    });
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("rejects routes outside the current SDK and credential-bearing bodies", async () => {
    const adapter = new WidenCollectiveApiAdapter();
    await expect(
      adapter.request(
        { collective: "example", accessToken: "token" },
        { apiVersion: "2", method: "DELETE", path: "/user" },
      ),
    ).rejects.toBeInstanceOf(WidenCollectiveApiError);
    await expect(
      adapter.request(
        { collective: "example", accessToken: "token" },
        {
          apiVersion: "2",
          method: "POST",
          path: "/products",
          json: { accessToken: "leak" },
        },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
