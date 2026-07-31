import { WorkivaApiAdapter, WorkivaApiError } from "./workiva-api.adapter";

const credentials = {
  region: "eu",
  clientId: "client",
  clientSecret: "wk_secret:secret",
};

describe("WorkivaApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins one region and minimizes a bounded first page with exact read scope", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "token", scope: "file:read" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "@nextLink": "https://api.eu.wdesk.com/files?$next=opaque",
            data: [
              {
                id: "file-1",
                name: "Year-end review",
                kind: "Document",
                state: "Active",
                template: false,
                type: "10-K",
                container: "hidden-folder",
                created: { user: { id: "hidden-user" } },
                modified: {
                  dateTime: "2026-07-18T00:00:00Z",
                  user: { id: "hidden-user" },
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    await expect(
      new WorkivaApiAdapter().read(credentials, {
        operation: "files.list",
        maxPageSize: 2,
      }),
    ).resolves.toEqual({
      files: [
        {
          id: "file-1",
          name: "Year-end review",
          kind: "Document",
          state: "Active",
          template: false,
          type: "10-K",
          modifiedAt: "2026-07-18T00:00:00Z",
        },
      ],
      region: "eu",
      maxPageSize: 2,
      hasMore: true,
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.eu.wdesk.com/oauth2/token",
    );
    expect(String(fetchSpy.mock.calls[0]?.[1]?.body)).toBe(
      "grant_type=client_credentials&client_id=client&client_secret=wk_secret%3Asecret&scope=file%3Aread",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Version": "2026-01-01",
        }),
      }),
    );
    expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
      "https://api.eu.wdesk.com/files?%24maxpagesize=2",
    );
    expect(fetchSpy.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
          "X-Version": "2026-01-01",
        }),
      }),
    );
  });

  it("rejects invalid regions, arbitrary operations, broad scopes, and oversized pages", async () => {
    const adapter = new WorkivaApiAdapter();
    await expect(
      adapter.read(
        { ...credentials, region: "uk" },
        { operation: "files.list" },
      ),
    ).rejects.toBeInstanceOf(WorkivaApiError);
    await expect(
      adapter.read(credentials, { operation: "documents.export" }),
    ).rejects.toBeInstanceOf(WorkivaApiError);
    await expect(
      adapter.read(credentials, { operation: "files.list", maxPageSize: 21 }),
    ).rejects.toBeInstanceOf(WorkivaApiError);

    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "token",
          scope: "file:read file:write",
        }),
        { status: 200 },
      ),
    );
    await expect(
      adapter.read(credentials, { operation: "files.list" }),
    ).rejects.toMatchObject({ code: "policy_blocked", statusCode: 403 });
  });
});
