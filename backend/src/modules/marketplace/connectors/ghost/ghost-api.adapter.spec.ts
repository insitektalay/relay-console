import { createHmac } from "node:crypto";
import { GhostApiAdapter, GhostApiError } from "./ghost-api.adapter";
import { GHOST_CONNECTOR_MANIFEST } from "./ghost.connector";

describe("Ghost connector", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = {
    adminUrl: "https://publication.example.com",
    adminApiKey: `${"a".repeat(24)}:${"b".repeat(64)}`,
  };

  it("defines seven exact tools and Safe versus Dangerous authority", () => {
    expect(GHOST_CONNECTOR_MANIFEST.tools).toHaveLength(7);
    expect(GHOST_CONNECTOR_MANIFEST.auth).toMatchObject({ type: "api_key" });
    const safe = GHOST_CONNECTOR_MANIFEST.approvalProfiles.find(
      (profile) => profile.id === "ghost_safe",
    );
    const dangerous = GHOST_CONNECTOR_MANIFEST.approvalProfiles.find(
      (profile) => profile.id === "dangerously_skip_permissions",
    );
    expect(safe?.approvalRequiredActions.map((action) => action.id)).toEqual([
      "ghost_post_create_draft",
      "ghost_post_update_draft",
      "ghost_post_publish",
    ]);
    expect(dangerous?.approvalRequiredActions).toEqual([]);
  });

  it("pins the publication Admin API and signs a five-minute Ghost JWT", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ site: { title: "Publication" } }), {
          status: 200,
        }),
      );
    await new GhostApiAdapter().getSite(credentials);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://publication.example.com/ghost/api/admin/site/",
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers["Accept-Version"]).toBe("v5.0");
    const token = headers.Authorization.replace(/^Ghost /, "");
    const [encodedHeader, encodedPayload, signature] = token.split(".");
    expect(
      JSON.parse(Buffer.from(encodedHeader, "base64url").toString()),
    ).toEqual({
      alg: "HS256",
      kid: "a".repeat(24),
      typ: "JWT",
    });
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString(),
    );
    expect(payload.aud).toBe("/admin/");
    expect(payload.exp - payload.iat).toBe(300);
    expect(signature).toBe(
      createHmac("sha256", Buffer.from("b".repeat(64), "hex"))
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest("base64url"),
    );
  });

  it("forces draft creation and uses Ghost HTML conversion without exposing the key", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ posts: [{ id: "post-1", status: "draft" }] }),
          { status: 201 },
        ),
      );
    const result = await new GhostApiAdapter().createDraft(credentials, {
      title: "A draft",
      html: "<p>Body</p>",
      status: "published",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/ghost/api/admin/posts/?source=html",
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.posts[0]).toMatchObject({
      title: "A draft",
      html: "<p>Body</p>",
      status: "draft",
    });
    expect(JSON.stringify(result)).not.toContain(credentials.adminApiKey);
  });

  it("requires the reviewed current draft before update or publication", async () => {
    const adapter = new GhostApiAdapter();
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            posts: [
              {
                id: "abc-123",
                status: "draft",
                updated_at: "2026-07-16T10:00:00.000Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    await expect(
      adapter.publishPost(credentials, {
        postId: "abc-123",
        expectedUpdatedAt: "2026-07-16T09:00:00.000Z",
      }),
    ).rejects.toMatchObject<Partial<GhostApiError>>({
      code: "approval_mismatch",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("blocks private origins, invalid keys, unbounded lists, and credential-like response fields", async () => {
    const adapter = new GhostApiAdapter();
    await expect(
      adapter.getSite({ ...credentials, adminUrl: "https://127.0.0.1" }),
    ).rejects.toMatchObject<Partial<GhostApiError>>({ code: "policy_blocked" });
    await expect(
      adapter.getSite({ ...credentials, adminApiKey: "not-a-key" }),
    ).rejects.toMatchObject<Partial<GhostApiError>>({
      code: "credential_missing",
    });
    await expect(
      adapter.listPosts(credentials, { limit: 1000 }),
    ).rejects.toMatchObject<Partial<GhostApiError>>({
      code: "provider_validation_error",
    });
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ site: { title: "Publication", api_key: "leak" } }),
          { status: 200 },
        ),
      );
    const result = await adapter.getSite(credentials);
    expect(result).toEqual({
      site: { title: "Publication", api_key: "[redacted]" },
    });
  });
});
