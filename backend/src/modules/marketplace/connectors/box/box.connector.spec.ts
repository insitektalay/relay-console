import { BoxApiAdapter } from "./box-api.adapter";
import { BOX_CONNECTOR_MANIFEST, BOX_SCOPES } from "./box.connector";

describe("Box connector", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("declares the confidential OAuth, bounded tool, and Safe/Dangerous contracts", () => {
    expect(BOX_SCOPES).toEqual(["root_readwrite"]);
    expect(BOX_CONNECTOR_MANIFEST.auth.oauth).toEqual(
      expect.objectContaining({
        authorizationUrl: "https://account.box.com/api/oauth2/authorize",
        tokenUrl: "https://api.box.com/oauth2/token",
        pkce: false,
        supportsRefresh: true,
      }),
    );
    expect(BOX_CONNECTOR_MANIFEST.tools).toHaveLength(10);
    expect(
      BOX_CONNECTOR_MANIFEST.tools.filter((tool) => tool.approvalRequired),
    ).toHaveLength(4);
    expect(
      BOX_CONNECTOR_MANIFEST.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("validates the connected Box user without exposing a token", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "123",
            type: "user",
            name: "Alex",
            login: "alex@example.com",
            status: "active",
            enterprise: { id: "456", name: "Relay" },
            space_amount: 1000,
            space_used: 10,
          }),
          { status: 200 },
        ),
    ) as typeof fetch;
    const result = await new BoxApiAdapter().getCurrentUser("secret-token");
    expect(result).toEqual(
      expect.objectContaining({
        id: "123",
        name: "Alex",
        enterprise: { id: "456", name: "Relay" },
        providerRequestCount: 1,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      "https://api.box.com/2.0/users/me",
    );
  });

  it("lists one bounded marker page without automatic pagination", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            entries: Array.from({ length: 8 }, (_, index) => ({
              type: index % 2 ? "folder" : "file",
              id: String(index + 1),
              name: `Item ${index + 1}`,
              etag: `e${index + 1}`,
            })),
            next_marker: "next",
          }),
          { status: 200 },
        ),
    ) as typeof fetch;
    const result = await new BoxApiAdapter().listFolderItems("token", {
      folderId: "0",
      maxResults: 3,
    });
    expect(result).toEqual(
      expect.objectContaining({
        folderId: "0",
        count: 3,
        nextMarker: "next",
        nextPageFollowed: false,
        providerRequestCount: 1,
      }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = new URL(String((global.fetch as jest.Mock).mock.calls[0][0]));
    expect(url.searchParams.get("usemarker")).toBe("true");
    expect(url.searchParams.get("limit")).toBe("3");
  });

  it("uploads bounded text with attributes before the file part", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            entries: [
              { type: "file", id: "99", name: "note.txt", sha1: "abc" },
            ],
          }),
          { status: 201 },
        ),
    ) as typeof fetch;
    const result = await new BoxApiAdapter().uploadText("token", {
      parentFolderId: "0",
      name: "note.txt",
      text: "hello",
      idempotencyKey: "idem-1",
    });
    expect(result).toEqual(
      expect.objectContaining({
        operation: "upload_text",
        idempotencyKey: "idem-1",
        providerRequestCount: 1,
      }),
    );
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(call[0])).toContain(
      "https://upload.box.com/api/2.0/files/content",
    );
    const body = new TextDecoder().decode(call[1].body as Uint8Array);
    expect(body.indexOf('name="attributes"')).toBeLessThan(
      body.indexOf('name="file"'),
    );
    expect(body).toContain("hello");
  });

  it.each([
    ["carriage return", "note\rX-Evil: yes.txt"],
    ["line feed", "note\nX-Evil: yes.txt"],
    ["quote", 'note"; name="evil.txt'],
    ["NUL", "note\u0000.txt"],
    ["directional format control", "note\u202Etxt.md"],
  ])("rejects multipart %s syntax before any provider request", async (_label, name) => {
    global.fetch = jest.fn() as typeof fetch;
    await expect(
      new BoxApiAdapter().uploadText("token", {
        parentFolderId: "0",
        name,
        text: "hello",
        idempotencyKey: "idem-hostile",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "provider_validation_error",
      }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("guards moves with etag and maps stale writes to a safe error", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ code: "precondition_failed" }), {
          status: 412,
        }),
    ) as typeof fetch;
    await expect(
      new BoxApiAdapter().moveItem("token", {
        itemType: "file",
        itemId: "7",
        destinationFolderId: "8",
        etag: "etag-1",
        approvalId: "approval-1",
        idempotencyKey: "idem-1",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "provider_validation_error",
        statusCode: 412,
      }),
    );
    expect(
      (global.fetch as jest.Mock).mock.calls[0][1].headers["If-Match"],
    ).toBe("etag-1");
  });
});
