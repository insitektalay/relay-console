import {
  ZohoWorkDriveApiAdapter,
  ZohoWorkDriveApiError,
  type ZohoWorkDriveOrigins,
} from "./zoho-workdrive-api.adapter";
import {
  ZOHO_WORKDRIVE_ADMIN_OPERATION_IDS,
  ZOHO_WORKDRIVE_CONTENT_WRITE_OPERATION_IDS,
  ZOHO_WORKDRIVE_OPERATIONS,
  ZOHO_WORKDRIVE_READ_OPERATION_IDS,
  ZOHO_WORKDRIVE_REQUIRED_SCOPES,
} from "./zoho-workdrive-operation-registry";

const ORIGINS: ZohoWorkDriveOrigins = {
  apiOrigin: "https://www.zohoapis.eu",
  downloadOrigin: "https://download.zoho.eu",
  uploadOrigin: "https://upload.zoho.eu",
};

describe("ZohoWorkDriveApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the complete reviewed official operation and scope surface", () => {
    expect(ZOHO_WORKDRIVE_OPERATIONS).toHaveLength(229);
    expect(ZOHO_WORKDRIVE_READ_OPERATION_IDS).toHaveLength(90);
    expect(
      ZOHO_WORKDRIVE_CONTENT_WRITE_OPERATION_IDS.length +
        ZOHO_WORKDRIVE_ADMIN_OPERATION_IDS.length,
    ).toBe(139);
    expect(ZOHO_WORKDRIVE_REQUIRED_SCOPES).toHaveLength(66);
  });

  it("uses the bound regional API origin and Zoho OAuth header", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "user-1", type: "users" } }), {
        status: 200,
        headers: { "Content-Type": "application/vnd.api+json" },
      }),
    );
    await new ZohoWorkDriveApiAdapter().read(
      "access-value",
      ORIGINS,
      "Get_User_Info",
      {},
    );
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://www.zohoapis.eu/workdrive/api/v1/users/me"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Zoho-oauthtoken access-value",
        }),
        redirect: "error",
      }),
    );
  });

  it("encodes pinned path parameters and rejects undocumented query keys", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );
    const adapter = new ZohoWorkDriveApiAdapter();
    await adapter.read("token", ORIGINS, "Get_File_List", {
      pathParameters: { folder_id: "folder/one" },
      query: { "page[limit]": 25 },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining("folder%2Fone/files?page%5Blimit%5D=25"),
      }),
      expect.anything(),
    );
    await expect(
      adapter.read("token", ORIGINS, "Get_File_List", {
        pathParameters: { folder_id: "folder" },
        query: { redirect_uri: "https://example.test" },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("prevents crossing tool groups or using an unpinned operation", async () => {
    const adapter = new ZohoWorkDriveApiAdapter();
    expect(() => adapter.read("token", ORIGINS, "Create_Folder", {})).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
    expect(() =>
      adapter.manageContent("token", ORIGINS, "Create_Group", {}),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
    expect(() =>
      adapter.admin("token", ORIGINS, "GET https://evil.test", {}),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
  });

  it("rejects alternate data-center origins and credential-shaped input", async () => {
    const adapter = new ZohoWorkDriveApiAdapter();
    await expect(
      adapter.read(
        "token",
        { ...ORIGINS, apiOrigin: "https://evil.test" },
        "Get_User_Info",
        {},
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read("token", ORIGINS, "Get_User_Info", {
        body: { access_token: "leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("builds a bounded multipart upload without accepting an authorization override", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "file-1" } }), {
        status: 200,
      }),
    );
    const adapter = new ZohoWorkDriveApiAdapter();
    await adapter.manageContent("token", ORIGINS, "Upload_File", {
      body: { filename: "note.txt", parent_id: "folder-1" },
      fileName: "note.txt",
      mimeType: "text/plain",
      contentBase64: Buffer.from("hello").toString("base64"),
    });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchMock.mock.calls[0][0]).toEqual(
      new URL("https://www.zohoapis.eu/workdrive/api/v1/upload"),
    );
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.headers as Record<string, string>).Authorization).toBe(
      "Zoho-oauthtoken token",
    );
    await expect(
      adapter.manageContent("token", ORIGINS, "Upload_File", {
        headers: { Authorization: "Bearer wrong" },
        contentBase64: Buffer.from("hello").toString("base64"),
      }),
    ).rejects.toBeInstanceOf(ZohoWorkDriveApiError);
  });

  it("returns safe redacted provider errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ title: "denied", access_token: "secret-value" }],
        }),
        { status: 403 },
      ),
    );
    await expect(
      new ZohoWorkDriveApiAdapter().read("token", ORIGINS, "Get_User_Info", {}),
    ).rejects.toMatchObject({
      code: "insufficient_scope",
      message: "denied",
      statusCode: 403,
    });
  });
});
