import { CRISP_CONNECTOR_MANIFEST } from "./crisp.connector";
import { CrispApiAdapter, CrispApiError } from "./crisp-api.adapter";

const credentials = {
  websiteId: "website_41",
  tokenIdentifier: "token-id",
  tokenKey: "token-key",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Crisp connector", () => {
  it("publishes content-free reads and an approval-gated API broker", () => {
    expect(CRISP_CONNECTOR_MANIFEST.slug).toBe("crisp");
    expect(CRISP_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(CRISP_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "crisp.listConversations",
      "crisp.getConversationState",
      "crisp.request",
    ]);
    expect(
      CRISP_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds website-token auth to the fixed website API and strips private data", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.crisp.chat/v1/website/website_41/conversations/1?per_page=20",
      );
      expect(init.headers).toMatchObject({
        Authorization: `Basic ${Buffer.from("token-id:token-key").toString("base64")}`,
        "X-Crisp-Tier": "website",
      });
      return response({
        error: false,
        reason: "listed",
        data: [
          {
            session_id: "session_72",
            inbox_id: "inbox_2",
            state: "unresolved",
            status: 1,
            unread: { operator: 3, visitor: 0 },
            assigned: { user_id: "operator_9" },
            created_at: 1721290000000,
            last_message: "private body",
            meta: { email: "private@example.com" },
            participants: [{ target: "private@example.com" }],
          },
        ],
      });
    });
    const result = await new CrispApiAdapter(requester).listConversations(
      credentials,
      { limit: 20 },
    );
    expect(result).toEqual({
      conversations: [
        expect.objectContaining({
          sessionId: "session_72",
          inboxId: "inbox_2",
          state: "unresolved",
          operatorUnread: 3,
          assignedOperatorId: "operator_9",
        }),
      ],
      limit: 20,
      hasNextPage: false,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("reads one exact conversation state through a content-free projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(String(url)).toBe(
        "https://api.crisp.chat/v1/website/website_41/conversation/session_72/state",
      );
      return response({
        error: false,
        reason: "resolved",
        data: { state: "resolved", message: "private" },
      });
    });
    await expect(
      new CrispApiAdapter(requester).getConversationState(
        credentials,
        "session_72",
      ),
    ).resolves.toEqual({
      conversation: { sessionId: "session_72", state: "resolved" },
    });
  });

  it("allows bounded website-relative operations and redacts secrets", async () => {
    const result = await new CrispApiAdapter(async () =>
      response({ token_key: "provider-secret" }),
    ).request(credentials, { method: "GET", path: "/people/stats" });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile paths, credential fields, missing tokens, and oversized responses", async () => {
    const adapter = new CrispApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "https://evil.test",
      }),
    ).rejects.toBeInstanceOf(CrispApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/conversation",
        json: { tokenKey: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.health({ ...credentials, tokenKey: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
