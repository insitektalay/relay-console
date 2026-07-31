import { MentionApiAdapter, MentionApiError } from "./mention-api.adapter";
import { MENTION_CONNECTOR_MANIFEST } from "./mention.connector";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Mention connector", () => {
  const credentials = { accessToken: "test-token", accountId: "acct_123" };
  it("exposes only two approval-gated reads", () => {
    expect(MENTION_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "mention.getAccountStatus",
      "mention.listAlerts",
    ]);
    expect(
      MENTION_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });
  it("validates fixed origin, version, bearer token, and account", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(json({ account: { id: "acct_123" } }));
    await expect(
      new MentionApiAdapter(requester).health(credentials),
    ).resolves.toEqual({
      apiOrigin: "https://api.mention.net",
      accountId: "acct_123",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.mention.net/api/accounts/acct_123",
    );
    expect(requester.mock.calls[0][1].headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Accept-Version": "1.19",
    });
  });
  it("redacts account identity", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(
        json({
          account: {
            id: "acct_123",
            name: "Private",
            email: "private@example.test",
            avatar_url: "https://example.test/a",
            language_code: "en",
            timezone: "Europe/Paris",
          },
        }),
      );
    const result = await new MentionApiAdapter(requester).getAccountStatus(
      credentials,
    );
    expect(result).toMatchObject({
      accountId: "acct_123",
      languageCode: "en",
      timezone: "Europe/Paris",
    });
    expect(JSON.stringify(result)).not.toMatch(/Private|example|avatar/);
  });
  it("redacts alert names, queries, shares, and content", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(
        json({
          alerts: [
            {
              id: "112233",
              name: "Private",
              query: { type: "basic", included_keywords: ["secret"] },
              shares: [{ email: "private@example.test" }],
              description: "Confidential",
              index_version: 2,
            },
          ],
        }),
      );
    const result = await new MentionApiAdapter(requester).listAlerts(
      credentials,
    );
    expect(result.alerts).toEqual([
      { alertId: "112233", queryType: "basic", indexVersion: 2 },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /Private|secret|example|Confidential/,
    );
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.mention.net/api/accounts/acct_123/alerts?limit=25",
    );
  });
  it("rejects unsafe IDs and cross-account responses", async () => {
    await expect(
      new MentionApiAdapter(jest.fn()).listAlerts({
        ...credentials,
        accountId: "../other",
      }),
    ).rejects.toBeInstanceOf(MentionApiError);
    await expect(
      new MentionApiAdapter(
        jest.fn().mockResolvedValue(json({ id: "other" })),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
  });
});
