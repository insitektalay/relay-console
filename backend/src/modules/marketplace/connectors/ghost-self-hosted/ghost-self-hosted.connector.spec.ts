jest.mock("node:dns/promises", () => ({
  lookup: jest
    .fn()
    .mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  GhostSelfHostedApiAdapter,
  GhostSelfHostedApiError,
} from "./ghost-self-hosted-api.adapter";
import { GHOST_SELF_HOSTED_CONNECTOR_MANIFEST } from "./ghost-self-hosted.connector";

const postId = "5ddc9141c35e7700383b2937";
const adminApiKey = `${"a".repeat(24)}:${"b".repeat(64)}`;
const credentials = {
  installationUrl: "https://publisher.example.com/news/",
  adminApiKey,
};
const post = {
  id: postId,
  title: "Bounded draft",
  slug: "bounded-draft",
  status: "draft",
  visibility: "public",
  created_at: "2026-07-18T01:00:00.000Z",
  updated_at: "2026-07-18T02:00:00.000Z",
  published_at: null,
};

describe("Ghost Self-Hosted connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers six approval-gated fixed post tools", () => {
    expect(new MarketplaceConnectorRegistry().get("ghost-self-hosted")).toBe(
      GHOST_SELF_HOSTED_CONNECTOR_MANIFEST,
    );
    expect(GHOST_SELF_HOSTED_CONNECTOR_MANIFEST.tools).toHaveLength(6);
    expect(
      GHOST_SELF_HOSTED_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("pins browse fields, ordering and first-page bounds", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          posts: [post],
          meta: { pagination: { total: 3 } },
        }),
        { status: 200 },
      ),
    );
    const result = await new GhostSelfHostedApiAdapter().listPosts(
      credentials,
      { limit: 2 },
    );
    const target = new URL(fetchMock.mock.calls[0][0].toString());
    expect(target.pathname).toBe("/news/ghost/api/admin/posts/");
    expect(Object.fromEntries(target.searchParams)).toEqual(
      expect.objectContaining({
        limit: "2",
        page: "1",
        order: "updated_at DESC",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ count: 1, total: 3, truncated: true }),
    );
  });

  it("generates a short-lived Ghost JWT with the documented audience", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ posts: [post] }), { status: 200 }),
      );
    await new GhostSelfHostedApiAdapter().getPost(credentials, { postId });
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    const jwt = headers.Authorization.replace(/^Ghost /, "");
    const [header, payload] = jwt
      .split(".")
      .slice(0, 2)
      .map((part) =>
        JSON.parse(Buffer.from(part, "base64url").toString("utf8")),
      );
    expect(header).toEqual({ alg: "HS256", kid: "a".repeat(24), typ: "JWT" });
    expect(payload.aud).toBe("/admin/");
    expect(payload.exp - payload.iat).toBe(60);
  });

  it("creates drafts only and bounds HTML input", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ posts: [post] }), { status: 201 }),
      );
    await new GhostSelfHostedApiAdapter().createDraft(credentials, {
      title: "Bounded draft",
      html: "<p>Safe draft</p>",
    });
    const target = new URL(fetchMock.mock.calls[0][0].toString());
    expect(target.searchParams.get("source")).toBe("html");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      posts: [
        {
          title: "Bounded draft",
          html: "<p>Safe draft</p>",
          status: "draft",
        },
      ],
    });
  });

  it("requires collision timestamps for status changes", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ posts: [{ ...post, status: "published" }] }),
          { status: 200 },
        ),
      );
    await new GhostSelfHostedApiAdapter().setStatus(credentials, {
      postId,
      updatedAt: post.updated_at,
      status: "published",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      posts: [{ status: "published", updated_at: post.updated_at }],
    });
  });

  it("uses one exact DELETE route and returns no provider content", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      new GhostSelfHostedApiAdapter().deletePost(credentials, { postId }),
    ).resolves.toEqual({ deleted: true, postId });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      `https://publisher.example.com/news/ghost/api/admin/posts/${postId}/`,
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
  });

  it.each([
    "http://publisher.example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://user:pass@publisher.example.com",
  ])(
    "rejects an unsafe installation authority: %s",
    async (installationUrl) => {
      await expect(
        new GhostSelfHostedApiAdapter().health({
          ...credentials,
          installationUrl,
        }),
      ).rejects.toMatchObject<Partial<GhostSelfHostedApiError>>({
        code: "policy_blocked",
      });
    },
  );

  it("returns secret-safe provider errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: adminApiKey }] }), {
        status: 401,
      }),
    );
    const promise = new GhostSelfHostedApiAdapter().listPosts(credentials, {});
    await expect(promise).rejects.toThrow(
      "Ghost Self-Hosted rejected the bounded Admin API request.",
    );
    await expect(promise).rejects.not.toThrow(adminApiKey);
  });
});
