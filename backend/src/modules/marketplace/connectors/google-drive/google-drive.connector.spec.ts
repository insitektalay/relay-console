import { GoogleDriveApiAdapter, GoogleDriveApiError } from "./google-drive-api.adapter";
import { GOOGLE_DRIVE_CONNECTOR_MANIFEST, GOOGLE_DRIVE_SCOPES } from "./google-drive.connector";

describe("Google Drive connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses exact per-file OAuth and exposes six bounded tools", () => {
    expect(GOOGLE_DRIVE_SCOPES).toEqual(["openid", "email", "https://www.googleapis.com/auth/drive.file"]);
    expect(GOOGLE_DRIVE_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({ authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", refreshUrl: "https://oauth2.googleapis.com/token", revocationUrl: "https://oauth2.googleapis.com/revoke", pkce: true, supportsRefresh: true });
    expect(GOOGLE_DRIVE_CONNECTOR_MANIFEST.tools).toHaveLength(6);
    expect(GOOGLE_DRIVE_CONNECTOR_MANIFEST.tools.filter((tool) => tool.approvalRequired).map((tool) => tool.functionName)).toEqual(["google_drive_text_create", "google_drive_file_copy"]);
    expect(GOOGLE_DRIVE_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id)).toEqual(["google_drive_safe", "dangerously_skip_permissions"]);
  });

  it("pins search bounds and never follows a page token", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ nextPageToken: "secret-page", files: [{ id: "file_1", name: "Plan.txt", mimeType: "text/plain", modifiedTime: "2026-07-17T08:00:00Z" }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await new GoogleDriveApiAdapter().searchFiles("token", { query: "Plan", maxResults: 5 });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/drive/v3/files");
    expect(url.searchParams.get("pageSize")).toBe("5");
    expect(url.searchParams.get("q")).toContain("trashed = false");
    expect(init.redirect).toBe("error");
    expect(result).toMatchObject({ count: 1, nextPageTokenPresent: true, nextPageFollowed: false, providerRequestCount: 1 });
  });

  it("rejects non-text content before downloading it", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "file_1", name: "photo.jpg", mimeType: "image/jpeg" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(new GoogleDriveApiAdapter().readText("token", { fileId: "file_1" })).rejects.toMatchObject<Partial<GoogleDriveApiError>>({ code: "provider_validation_error" });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("creates one bounded multipart text file with an idempotency result", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "created_1", name: "Plan.txt", mimeType: "text/plain" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await new GoogleDriveApiAdapter().createTextFile("token", { name: "Plan.txt", text: "hello", parentFolderId: "folder_1", idempotencyKey: "request-123" });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://www.googleapis.com/upload/drive/v3/files");
    expect(url.searchParams.get("uploadType")).toBe("multipart");
    expect(init.method).toBe("POST");
    expect(String((init.headers as Record<string, string>)["Content-Type"])).toContain("multipart/related");
    expect(result).toMatchObject({ operation: "create_text_file", idempotencyKey: "request-123", providerRequestCount: 1 });
  });
});
