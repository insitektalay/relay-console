import { DropboxApiAdapter, DropboxApiError } from "./dropbox-api.adapter";
import {
  DROPBOX_CONNECTOR_MANIFEST,
  DROPBOX_SCOPES,
} from "./dropbox.connector";

describe("Dropbox connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("declares Relay-owned offline OAuth and eleven bounded tools", () => {
    expect(DROPBOX_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      pkce: true,
      supportsRefresh: true,
      requiredScopes: DROPBOX_SCOPES,
    });
    expect(DROPBOX_CONNECTOR_MANIFEST.tools).toHaveLength(11);
    expect(
      DROPBOX_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
    expect(
      DROPBOX_CONNECTOR_MANIFEST.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("validates account identity without returning the token", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            account_id: "dbid:1",
            name: { display_name: "Alex" },
            email: "a@example.com",
            root_info: { root_namespace_id: "1" },
          }),
          { status: 200 },
        ),
      );
    const result = await new DropboxApiAdapter().getCurrentAccount(
      "secret-token",
    );
    expect(result).toMatchObject({
      accountId: "dbid:1",
      email: "a@example.com",
      providerRequestCount: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.dropboxapi.com/2/users/get_current_account",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret-token",
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("bounds folder entries and never follows cursors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          entries: [
            { ".tag": "file", id: "id:1", name: "a.txt" },
            { ".tag": "folder", id: "id:2", name: "B" },
          ],
          cursor: "secret-cursor",
          has_more: true,
        }),
        { status: 200 },
      ),
    );
    await expect(
      new DropboxApiAdapter().listFolder("token", { path: "", maxResults: 1 }),
    ).resolves.toMatchObject({
      count: 1,
      cursorReturned: true,
      hasMore: true,
      nextPageFollowed: false,
    });
  });

  it("sends one bounded delete and maps provider failures safely", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            metadata: { ".tag": "file", id: "id:1", name: "a.txt" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error_summary: "provider internals" }), {
          status: 429,
        }),
      );
    await new DropboxApiAdapter().deleteEntry("token", {
      path: "/a.txt",
      idempotencyKey: "delete-1",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.dropboxapi.com/2/files/delete_v2",
    );
    expect(
      JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)),
    ).toEqual({ path: "/a.txt" });
    await expect(
      new DropboxApiAdapter().getMetadata("token", { path: "/a.txt" }),
    ).rejects.toMatchObject<Partial<DropboxApiError>>({
      code: "provider_rate_limited",
      statusCode: 429,
      message: "Dropbox rate limit reached; retry later.",
    });
  });
});
