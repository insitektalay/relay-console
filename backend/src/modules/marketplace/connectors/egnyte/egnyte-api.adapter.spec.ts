import { EgnyteApiAdapter } from "./egnyte-api.adapter";
import {
  EGNYTE_ADMIN_OPERATION_IDS,
  EGNYTE_CONTENT_WRITE_OPERATION_IDS,
  EGNYTE_OPERATIONS,
  EGNYTE_READ_OPERATION_IDS,
} from "./egnyte-operation-registry";

describe("EgnyteApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the complete active official operation surface", () => {
    expect(EGNYTE_OPERATIONS).toHaveLength(168);
    expect(EGNYTE_READ_OPERATION_IDS).toHaveLength(71);
    expect(EGNYTE_CONTENT_WRITE_OPERATION_IDS).toHaveLength(46);
    expect(EGNYTE_ADMIN_OPERATION_IDS).toHaveLength(51);
  });

  it("binds requests to one normalized customer Egnyte domain", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ bookmarks: [] }), { status: 200 }),
      );
    await new EgnyteApiAdapter().read(
      "access-value",
      "acme.egnyte.com",
      "listBookmarks",
      {},
    );
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://acme.egnyte.com/pubapi/v1/bookmarks"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-value",
        }),
        redirect: "error",
      }),
    );
  });

  it("encodes pinned path values and rejects undocumented query keys", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ folders: [] }), { status: 200 }),
      );
    const adapter = new EgnyteApiAdapter();
    await adapter.read("token", "acme", "portal-prod-get-fs-v2", {
      pathParameters: { path: "Shared/Documents" },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      new URL("https://acme.egnyte.com/pubapi/v2/fs/Shared%2FDocuments"),
      expect.anything(),
    );
    await expect(
      adapter.read("token", "acme", "listBookmarks", {
        query: { redirect_uri: "https://evil.test" },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("prevents crossing tool groups and rejects untrusted domains", async () => {
    const adapter = new EgnyteApiAdapter();
    expect(() => adapter.read("token", "acme", "createBookmark", {})).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
    expect(() => adapter.normalizeDomain("https://evil.test/path")).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
  });

  it("redacts provider errors and blocks credential-shaped input", async () => {
    const adapter = new EgnyteApiAdapter();
    await expect(
      adapter.read("token", "acme", "listBookmarks", {
        body: { access_token: "leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ message: "denied", access_token: "secret" }),
        {
          status: 403,
        },
      ),
    );
    await expect(
      adapter.read("token", "acme", "listBookmarks", {}),
    ).rejects.toMatchObject({ code: "insufficient_scope", message: "denied" });
  });
});
