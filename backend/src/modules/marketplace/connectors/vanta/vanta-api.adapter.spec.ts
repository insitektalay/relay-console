import { VantaApiAdapter, VantaApiError } from "./vanta-api.adapter";

const credentials = { clientId: "client", clientSecret: "secret" };

describe("VantaApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("mints a read-only token and minimizes a bounded document page", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: {
              data: [
                {
                  id: "access-requests",
                  title: "Access request ticket and history",
                  category: "Account setup",
                  overallStatus: "Needs document",
                  url: "https://app.vanta.com/private/document",
                  description: "hidden",
                },
              ],
              pageInfo: {
                hasNextPage: true,
                endCursor: "cursor_2",
              },
            },
          }),
          { status: 200 },
        ),
      );

    await expect(
      new VantaApiAdapter().read(credentials, {
        operation: "documents.list",
        pageSize: 20,
        pageCursor: "cursor_1",
      }),
    ).resolves.toEqual({
      documents: [
        {
          id: "access-requests",
          title: "Access request ticket and history",
          category: "Account setup",
          overallStatus: "Needs document",
        },
      ],
      pageSize: 20,
      hasNextPage: true,
      nextPageCursor: "cursor_2",
    });

    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.vanta.com/oauth/token",
    );
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      client_id: "client",
      client_secret: "secret",
      grant_type: "client_credentials",
      scope: "vanta-api.all:read",
    });
    expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
      "https://api.vanta.com/v1/documents?pageSize=20&pageCursor=cursor_1",
    );
    expect(fetchSpy.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("rejects arbitrary operations, oversized pages, and unsafe cursors", async () => {
    const adapter = new VantaApiAdapter();
    await expect(
      adapter.read(credentials, { operation: "people.list" }),
    ).rejects.toBeInstanceOf(VantaApiError);
    await expect(
      adapter.read(credentials, { operation: "documents.list", pageSize: 21 }),
    ).rejects.toBeInstanceOf(VantaApiError);
    await expect(
      adapter.read(credentials, {
        operation: "documents.list",
        pageCursor: "bad cursor?",
      }),
    ).rejects.toBeInstanceOf(VantaApiError);
  });
});
