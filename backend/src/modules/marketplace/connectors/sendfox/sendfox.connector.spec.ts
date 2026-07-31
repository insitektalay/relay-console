import { SendFoxApiAdapter, SendFoxApiError } from "./sendfox-api.adapter";
import { SENDFOX_CONNECTOR_MANIFEST } from "./sendfox.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("SendFox connector", () => {
  const credentials = { accessToken: "secret", accountId: "42" };

  it("exposes only three bounded approval-gated reads without scopes or refresh", () => {
    expect(SENDFOX_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      requiredScopes: [],
      optionalScopes: [],
      pkce: false,
      supportsRefresh: false,
    });
    expect(SENDFOX_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "sendfox.getAccountSummary",
      "sendfox.listContactLists",
      "sendfox.listCampaigns",
    ]);
    expect(
      SENDFOX_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds health and account output without returning name or email", async () => {
    const requester = jest.fn().mockImplementation(() =>
      Promise.resolve(
        json({
          id: 42,
          name: "Marketing",
          email: "private@example.com",
          contacts_count: 120,
          contact_limit: 5000,
          created_at: "2024-01-02T03:04:05Z",
        }),
      ),
    );
    const adapter = new SendFoxApiAdapter(requester, () => new Date(0));
    await expect(adapter.health(credentials)).resolves.toMatchObject({
      accountId: "42",
    });
    const second = new SendFoxApiAdapter(requester, () => new Date(2_000));
    const result = await second.getAccountSummary(credentials);
    expect(result).toEqual({
      account: {
        accountId: "42",
        contactsCount: 120,
        contactLimit: 5000,
        createdAt: "2024-01-02T03:04:05.000Z",
      },
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("Marketing");
  });

  it("uses only page one and redacts list and campaign payloads", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(
        json({
          data: [
            {
              id: 7,
              user_id: 42,
              name: "News",
              average_email_open_percent: 40,
              average_email_click_percent: 5,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: [
            {
              id: 8,
              title: "Private",
              subject: "Secret",
              html: "<p>Body</p>",
              from_email: "private@example.com",
              sent_at: "2026-07-01T00:00:00Z",
            },
          ],
        }),
      );
    let now = 0;
    const adapter = new SendFoxApiAdapter(
      requester,
      () => new Date((now += 1_000)),
    );
    const lists = await adapter.listContactLists(credentials);
    const campaigns = await adapter.listCampaigns(credentials);
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.sendfox.com/lists?page=1",
    );
    expect(String(requester.mock.calls[1][0])).toBe(
      "https://api.sendfox.com/campaigns?page=1",
    );
    expect(lists.lists[0]).toMatchObject({ listId: "7", name: "News" });
    expect(campaigns.campaigns[0]).toMatchObject({
      campaignId: "8",
      state: "sent",
    });
    expect(JSON.stringify(campaigns)).not.toMatch(
      /Private|Secret|Body|private@example/,
    );
  });

  it("rejects cross-account lists and requests above sixty per minute", async () => {
    const crossAccount = new SendFoxApiAdapter(
      jest
        .fn()
        .mockResolvedValue(
          json({ data: [{ id: 7, user_id: 99, name: "Other" }] }),
        ),
      () => new Date(0),
    );
    await expect(
      crossAccount.listContactLists(credentials),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
    const rateLimited = new SendFoxApiAdapter(
      jest.fn().mockResolvedValue(json({ id: 42 })),
      () => new Date(0),
    );
    await rateLimited.health(credentials);
    await expect(rateLimited.health(credentials)).rejects.toBeInstanceOf(
      SendFoxApiError,
    );
  });
});
