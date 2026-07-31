import { IntercomApiAdapter, IntercomApiError } from "./intercom-api.adapter";

const credentials = {
  accessToken: "intercom-access",
  apiOrigin: "https://api.eu.intercom.io",
  workspaceId: "workspace_123",
  adminId: "admin_123",
  region: "EU",
};

describe("IntercomApiAdapter", () => {
  it("binds health to the exact region, workspace, and verified admin", async () => {
    const requester = jest.fn().mockImplementation(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            id: "admin_123",
            name: "Relay Admin",
            email: "private@example.com",
            email_verified: true,
            app: {
              id_code: "workspace_123",
              name: "Relay Support",
              region: "EU",
            },
          }),
          { status: 200 },
        ),
    );
    const adapter = new IntercomApiAdapter(requester);
    await expect(adapter.health(credentials)).resolves.toEqual({
      workspaceId: "workspace_123",
      workspaceName: "Relay Support",
      adminId: "admin_123",
      region: "EU",
      emailVerified: true,
    });
    expect(requester.mock.calls[0][0]).toBe("https://api.eu.intercom.io/me");
    expect(
      new Headers(requester.mock.calls[0][1].headers).get("Authorization"),
    ).toBe("Bearer intercom-access");
  });

  it("returns only bounded privacy-redacted conversation metadata", async () => {
    const requester = jest.fn().mockImplementation(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            total_count: 1,
            conversations: [
              {
                id: "123",
                title: "private title",
                source: { body: "private body" },
                contacts: [{ email: "private@example.com" }],
                conversation_parts: { parts: [{ body: "private reply" }] },
                state: "open",
                priority: true,
                read: false,
                created_at: 10,
                updated_at: 20,
                waiting_since: 15,
                snoozed_until: null,
                open: true,
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const result = await new IntercomApiAdapter(requester).listConversations(
      credentials,
      { limit: 1 },
    );
    expect(result).toEqual({
      totalCount: 1,
      conversations: [
        {
          conversationId: "123",
          state: "open",
          priority: true,
          read: false,
          createdAt: 10,
          updatedAt: 20,
          waitingSince: 15,
          snoozedUntil: null,
          open: true,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects invalid region and identifier inputs before dispatch", async () => {
    const requester = jest.fn();
    const adapter = new IntercomApiAdapter(requester);
    await expect(
      adapter.getConversation(credentials, { conversationId: "../contacts" }),
    ).rejects.toBeInstanceOf(IntercomApiError);
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://evil.example" }),
    ).rejects.toMatchObject({ code: "intercom_region_invalid" });
    expect(requester).not.toHaveBeenCalled();
  });
});
