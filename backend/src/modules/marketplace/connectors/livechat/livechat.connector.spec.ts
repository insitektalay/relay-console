import { LIVECHAT_CONNECTOR_MANIFEST } from "./livechat.connector";
import { LiveChatApiAdapter, LiveChatApiError } from "./livechat-api.adapter";

const credentials = { personalAccessToken: "test-personal-access-token" };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("LiveChat connector", () => {
  it("publishes content-free reads and an approval-gated action broker", () => {
    expect(LIVECHAT_CONNECTOR_MANIFEST.slug).toBe("livechat");
    expect(LIVECHAT_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(LIVECHAT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "livechat.listChats",
      "livechat.getChat",
      "livechat.request",
    ]);
    expect(
      LIVECHAT_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds Basic PAT auth to Agent Chat v3.5 and strips private chat data", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.livechatinc.com/v3.5/agent/action/list_chats",
      );
      expect(init.headers).toMatchObject({
        Authorization: "Basic test-personal-access-token",
      });
      expect(JSON.parse(String(init.body))).toMatchObject({
        limit: 2,
        sort_order: "desc",
      });
      return response({
        chats: [
          {
            id: "CHAT_41",
            users: [
              { id: "customer-private", email: "private@example.com" },
              { id: "agent-private" },
            ],
            threads: [
              {
                id: "THREAD_2",
                active: true,
                created_at: "2026-07-18T10:00:00Z",
                events: [{ type: "message", text: "private body" }],
                access: { group_ids: [3] },
                properties: { private: true },
              },
            ],
          },
        ],
        next_page_id: "private-page-token",
      });
    });
    const result = await new LiveChatApiAdapter(requester).listChats(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual({
      chats: [
        expect.objectContaining({
          chatId: "CHAT_41",
          threadId: "THREAD_2",
          threadActive: true,
          eventCount: 1,
          participantCount: 2,
          groupIds: [3],
        }),
      ],
      hasNextPage: true,
      limit: 2,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("reads one exact chat through the same projection", async () => {
    const requester = jest.fn(async (_url: string | URL, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toEqual({ chat_id: "CHAT_72" });
      return response({
        id: "CHAT_72",
        thread: { id: "THREAD_9", active: false, access: { group_ids: [5] } },
      });
    });
    await expect(
      new LiveChatApiAdapter(requester).getChat(credentials, "CHAT_72"),
    ).resolves.toMatchObject({
      chat: { chatId: "CHAT_72", threadId: "THREAD_9", groupIds: [5] },
    });
  });

  it("allows bounded fixed-origin actions and redacts secrets", async () => {
    const result = await new LiveChatApiAdapter(async () =>
      response({ access_token: "provider-secret" }),
    ).request(credentials, { action: "list_agents_for_transfer", json: {} });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile actions, credential fields, missing PATs, and oversized responses", async () => {
    const adapter = new LiveChatApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.request(credentials, { action: "https://evil.test", json: {} }),
    ).rejects.toBeInstanceOf(LiveChatApiError);
    await expect(
      adapter.request(credentials, {
        action: "list_chats",
        json: { accessToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.health({ personalAccessToken: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
