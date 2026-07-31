import { BeehiivApiAdapter, BeehiivApiError } from "./beehiiv-api.adapter";
import { BEEHIIV_CONNECTOR_MANIFEST } from "./beehiiv.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("beehiiv connector", () => {
  const credentials = {
    accessToken: "secret",
    organizationId: "org_00000000-0000-0000-0000-000000000000",
  };

  it("exposes only three approval-gated reads with least-privilege OAuth", () => {
    expect(BEEHIIV_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      requiredScopes: ["identify:read", "publications:read", "posts:read"],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: true,
    });
    expect(BEEHIIV_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "beehiiv.getAccountSummary",
      "beehiiv.listPublications",
      "beehiiv.listPosts",
    ]);
    expect(
      BEEHIIV_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds token info without returning user or application identity", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(
        json({
          resource_owner_id: credentials.organizationId,
          scope: "identify:read publications:read posts:read",
          expires_in_seconds: 7200,
          created_at: 1739980800,
          application: { uid: "private", name: "Private app" },
          email: "private@example.com",
        }),
      );
    const adapter = new BeehiivApiAdapter(requester, () => new Date(0));
    const result = await adapter.getAccountSummary(credentials);
    expect(result.account).toMatchObject({
      organizationId: credentials.organizationId,
      expiresInSeconds: 7200,
    });
    expect(JSON.stringify(result)).not.toMatch(/private|email|application/i);
  });

  it("uses fixed first pages and strips publication and post content", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(
        json({
          data: [
            {
              id: "pub_00000000-0000-0000-0000-000000000000",
              name: "Private newsletter",
              organization_name: "Private org",
              referral_program_enabled: true,
              created: 1715698529,
              stats: { active_subscriptions: 12 },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: [
            {
              id: "post_00000000-0000-0000-0000-000000000000",
              title: "Secret title",
              authors: ["Private author"],
              subject_line: "Secret subject",
              free_web_content: "Secret body",
              web_url: "https://secret.example",
              status: "confirmed",
              audience: "free",
              platform: "both",
              split_tested: false,
              created: 1715698529,
            },
          ],
        }),
      );
    let now = 0;
    const adapter = new BeehiivApiAdapter(
      requester,
      () => new Date((now += 350)),
    );
    const publications = await adapter.listPublications(credentials);
    const posts = await adapter.listPosts(
      credentials,
      "pub_00000000-0000-0000-0000-000000000000",
    );
    expect(String(requester.mock.calls[0][0])).toContain(
      "/v2/publications?limit=25&page=1",
    );
    expect(String(requester.mock.calls[1][0])).toContain(
      "/posts?limit=25&page=1",
    );
    expect(publications.publications[0]).toMatchObject({
      referralProgramEnabled: true,
    });
    expect(posts.posts[0]).toMatchObject({
      status: "confirmed",
      platform: "both",
    });
    expect(JSON.stringify({ publications, posts })).not.toMatch(
      /Private|Secret|active_subscriptions|web_url/,
    );
  });

  it("rejects changed organizations, invalid publication IDs, and bursts", async () => {
    const changed = new BeehiivApiAdapter(
      jest
        .fn()
        .mockResolvedValue(
          json({
            resource_owner_id: "org_11111111-1111-1111-1111-111111111111",
          }),
        ),
      () => new Date(0),
    );
    await expect(changed.health(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
    });
    const adapter = new BeehiivApiAdapter(
      jest.fn().mockResolvedValue(json({ data: [] })),
      () => new Date(0),
    );
    await expect(
      adapter.listPosts(credentials, "../subscriptions"),
    ).rejects.toBeInstanceOf(BeehiivApiError);
    await adapter.listPublications(credentials);
    await expect(adapter.listPublications(credentials)).rejects.toMatchObject({
      code: "provider_rate_limited",
    });
  });
});
