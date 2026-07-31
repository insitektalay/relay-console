import { OneNoteApiAdapter, OneNoteApiError } from "./onenote-api.adapter";

describe("OneNoteApiAdapter", () => {
  it("uses the fixed signed-in-user endpoint and excludes page content and identities", async () => {
    const calls: string[] = [];
    const adapter = new OneNoteApiAdapter(async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "page-1",
              title: "Launch notes",
              contentUrl: "https://secret.example/content",
              preview: "private",
              createdBy: { user: { displayName: "Private Person" } },
            },
          ],
          "@odata.nextLink": "https://graph.microsoft.com/secret-skip-token",
        }),
        { status: 200 },
      );
    });
    const result = await adapter.listPages("token", { sectionId: "section-1" });
    expect(calls).toEqual([
      "https://graph.microsoft.com/v1.0/me/onenote/sections/section-1/pages",
    ]);
    expect(result.pages[0]).toEqual(
      expect.objectContaining({
        id: "page-1",
        title: "Launch notes",
        contentUrlExcluded: true,
        contentExcluded: true,
        previewExcluded: true,
        createdByIdentityExcluded: true,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("secret.example");
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("Private Person");
    expect(JSON.stringify(result)).not.toContain("skip-token");
  });

  it("rejects unsafe identifiers before provider I/O", async () => {
    const request = jest.fn();
    const adapter = new OneNoteApiAdapter(request);
    await expect(
      adapter.getPage("token", { pageId: "../content" }),
    ).rejects.toBeInstanceOf(OneNoteApiError);
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on oversized responses and maps throttling safely", async () => {
    const oversized = new OneNoteApiAdapter(
      async () => new Response("x".repeat(1_000_001), { status: 200 }),
    );
    await expect(oversized.health("token")).rejects.toMatchObject({
      code: "onenote_response_too_large",
    });
    const throttled = new OneNoteApiAdapter(
      async () => new Response("{}", { status: 429 }),
    );
    await expect(throttled.health("token")).rejects.toMatchObject({
      code: "onenote_rate_limited",
      statusCode: 429,
    });
  });
});
