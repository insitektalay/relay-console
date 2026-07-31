import {
  HelpScoutApiAdapter,
  HelpScoutApiError,
} from "./help-scout-api.adapter";

const credentials = { accessToken: "help-scout-token", userId: "42" };

describe("HelpScoutApiAdapter", () => {
  it("binds health to the exact active authorizing user", async () => {
    const requester = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 42,
          firstName: "Relay",
          lastName: "Admin",
          email: "private@example.com",
          role: "owner",
          active: true,
        }),
        { status: 200 },
      ),
    );
    await expect(
      new HelpScoutApiAdapter(requester).health(credentials),
    ).resolves.toEqual({
      userId: "42",
      displayName: "Relay Admin",
      role: "owner",
      active: true,
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.helpscout.net/v2/users/me",
    );
    expect(
      new Headers(requester.mock.calls[0][1].headers).get("Authorization"),
    ).toBe("Bearer help-scout-token");
  });

  it("returns only bounded privacy-redacted conversation metadata", async () => {
    const requester = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          _embedded: {
            conversations: [
              {
                id: 123,
                number: 5,
                threads: 2,
                type: "email",
                status: "active",
                state: "published",
                subject: "private subject",
                preview: "private preview",
                primaryCustomer: { email: "private@example.com" },
                assignee: { email: "agent@example.com" },
                mailboxId: 9,
                folderId: 2,
                createdAt: "2026-07-17T01:02:03Z",
                closedAt: null,
              },
            ],
          },
          page: { totalElements: 1 },
        }),
        { status: 200 },
      ),
    );
    const result = await new HelpScoutApiAdapter(
      requester,
    ).listConversations(credentials, { limit: 1 });
    expect(result).toEqual({
      totalCount: 1,
      conversations: [
        {
          conversationId: "123",
          number: 5,
          threads: 2,
          type: "email",
          status: "active",
          state: "published",
          mailboxId: "9",
          folderId: "2",
          createdAt: "2026-07-17T01:02:03.000Z",
          closedAt: null,
          waitingSince: null,
          snoozedUntil: null,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects absolute paths, traversal, and credential-bearing input", async () => {
    const requester = jest.fn();
    const adapter = new HelpScoutApiAdapter(requester);
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "/v2/../oauth2/token",
      }),
    ).rejects.toBeInstanceOf(HelpScoutApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/v2/conversations",
        json: { accessToken: "leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(requester).not.toHaveBeenCalled();
  });
});
