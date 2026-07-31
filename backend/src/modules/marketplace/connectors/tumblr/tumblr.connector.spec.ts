import { TumblrApiAdapter } from "./tumblr-api.adapter";
import { TUMBLR_CONNECTOR_MANIFEST, TUMBLR_SCOPES } from "./tumblr.connector";

describe("Tumblr connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers exact read scopes, three tools and two policies", () => {
    expect(TUMBLR_SCOPES).toEqual(["basic", "offline_access"]);
    expect(TUMBLR_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      TUMBLR_CONNECTOR_MANIFEST.approvalProfiles.map((item) => item.id),
    ).toEqual(["tumblr_safe", "dangerously_skip_permissions"]);
  });

  it("bounds published posts, prefers NPF text and never follows paging", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            blog: { uuid: "t:blog_1", name: "relay-blog" },
            posts: [
              {
                id_string: "1234567890123456789",
                blog_name: "relay-blog",
                content: [{ type: "text", text: "Useful NPF text" }],
              },
            ],
            _links: { next: { href: "ignored" } },
          },
        }),
        { status: 200 },
      ),
    );
    const posts = await new TumblrApiAdapter().listPublishedPosts(
      "synthetic-token",
      "t:blog_1",
      "relay-blog",
      99,
      null,
    );
    expect(posts[0]).toMatchObject({
      text: "Useful NPF text",
      contentFormat: "npf",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=10");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects posts returned for another selected blog", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            blog: { uuid: "t:other", name: "other-blog" },
            posts: [],
          },
        }),
        { status: 200 },
      ),
    );
    await expect(
      new TumblrApiAdapter().listPublishedPosts(
        "synthetic-token",
        "t:blog_1",
        "relay-blog",
        10,
        null,
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
