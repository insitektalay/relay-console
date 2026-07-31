import { ThreadsApiAdapter } from "./threads-api.adapter";
import {
  THREADS_CONNECTOR_MANIFEST,
  THREADS_SCOPES,
} from "./threads.connector";

describe("Threads connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers the exact bounded surface and two install policies", () => {
    expect(THREADS_SCOPES).toEqual([
      "threads_basic",
      "threads_content_publish",
    ]);
    expect(THREADS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "relay_threads_get_profile",
      "relay_threads_list_own_posts",
      "relay_threads_get_own_post",
      "relay_threads_draft_text_post",
      "relay_threads_publish_text_post",
    ]);
    expect(
      THREADS_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["threads_safe", "dangerously_skip_permissions"]);
  });

  it("bounds and ownership-checks reads without following paging", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ id: "post_1", text: "hello", owner: { id: "profile_1" } }],
            paging: { next: "https://evil.example" },
          }),
          { status: 200 },
        ),
      );
    const posts = await new ThreadsApiAdapter().listOwnPosts(
      "secret-token",
      "profile_1",
      99,
    );
    expect(posts).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=10");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer secret-token");
  });

  it("drafts locally and publishes with exactly two non-retried requests", async () => {
    const adapter = new ThreadsApiAdapter();
    expect(adapter.draftText("A useful update.")).toMatchObject({
      providerCallMade: false,
      characterCount: 16,
    });
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "container_1" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "post_1" }), { status: 200 }),
      );
    await expect(
      adapter.publishText("secret-token", "A useful update."),
    ).resolves.toMatchObject({ postId: "post_1", providerAcknowledged: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(() => adapter.draftText("Visit https://example.com")).toThrow(
      /does not publish links/,
    );
  });
});
