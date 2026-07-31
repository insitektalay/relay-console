import { FRESHCHAT_CONNECTOR_MANIFEST } from "./freshchat.connector";
import {
  FreshchatApiAdapter,
  FreshchatApiError,
} from "./freshchat-api.adapter";

const credentials = {
  accountUrl: "https://relay-support.freshchat.com",
  apiKey: "test-api-key",
};
const response = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

describe("Freshchat connector", () => {
  it("publishes bounded content-free reads and an approval-gated API v2 broker", () => {
    expect(FRESHCHAT_CONNECTOR_MANIFEST.slug).toBe("freshchat");
    expect(FRESHCHAT_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(FRESHCHAT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(
      [
        "freshchat.getConversation",
        "freshchat.listMessages",
        "freshchat.request",
      ],
    );
    expect(
      FRESHCHAT_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds bearer auth to the exact Freshchat account and projects conversation metadata", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      const parsed = new URL(String(url));
      expect(parsed.origin).toBe("https://relay-support.freshchat.com");
      expect(parsed.pathname).toBe("/v2/conversations/conversation_41");
      expect(init.headers).toMatchObject({
        Authorization: "Bearer test-api-key",
      });
      return response({
        conversation_id: "conversation_41",
        status: "assigned",
        priority: "high",
        assigned_group_id: "group_2",
        user_id: "customer-private",
        messages: [{ message_parts: [{ text: { content: "private body" } }] }],
        created_time: "2026-07-18T09:00:00Z",
      });
    });
    const result = await new FreshchatApiAdapter(requester).getConversation(
      credentials,
      "conversation_41",
    );
    expect(result.conversation).toMatchObject({
      conversationId: "conversation_41",
      status: "assigned",
      priority: "high",
      assignedGroupId: "group_2",
    });
    expect(JSON.stringify(result)).not.toContain("customer-private");
    expect(JSON.stringify(result)).not.toContain("private body");
  });

  it("lists one bounded first page of content-free message metadata", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      const parsed = new URL(String(url));
      expect(parsed.pathname).toBe(
        "/v2/conversations/conversation_72/messages",
      );
      expect(parsed.searchParams.get("page")).toBe("1");
      expect(parsed.searchParams.get("items_per_page")).toBe("2");
      return response({
        messages: [
          {
            message_id: "message_1",
            actor_type: "agent",
            message_type: "normal",
            created_time: "2026-07-18T09:10:00Z",
            user_id: "private-user",
            message_parts: [{ text: { content: "private body" } }],
          },
        ],
      });
    });
    const result = await new FreshchatApiAdapter(requester).listMessages(
      credentials,
      {
        conversationId: "conversation_72",
        limit: 2,
      },
    );
    expect(result.messages).toEqual([
      {
        messageId: "message_1",
        actorType: "agent",
        messageType: "normal",
        createdAt: "2026-07-18T09:10:00Z",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("allows bounded relative v2 requests and redacts secrets", async () => {
    const requester = jest.fn(async () =>
      response({ item: { id: 1, access_token: "provider-secret" } }),
    );
    const result = await new FreshchatApiAdapter(requester).request(
      credentials,
      {
        method: "GET",
        path: "/v2/agents",
      },
    );
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile account URLs, paths, credential fields, and oversized responses", async () => {
    const adapter = new FreshchatApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.health({
        ...credentials,
        accountUrl: "https://relay.freshchat.com.evil",
      }),
    ).rejects.toBeInstanceOf(FreshchatApiError);
    await expect(
      adapter.request(credentials, { method: "GET", path: "/v2/../admin" }),
    ).rejects.toBeInstanceOf(FreshchatApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/v2/conversations",
        json: { accessToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
