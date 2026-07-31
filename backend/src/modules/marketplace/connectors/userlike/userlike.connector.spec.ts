import { USERLIKE_CONNECTOR_MANIFEST } from "./userlike.connector";
import { UserlikeApiAdapter, UserlikeApiError } from "./userlike-api.adapter";
const credentials = { organizationToken: "test-organization-token" };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
describe("Userlike connector", () => {
  it("publishes content-free reads and an approval-gated API broker", () => {
    expect(USERLIKE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "userlike.listConversations",
      "userlike.getConversation",
      "userlike.request",
    ]);
    expect(
      USERLIKE_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });
  it("binds token auth to JSON API v3 and strips private data", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.userlike.com/api/um/v3/conversations/?limit=2",
      );
      expect(init.headers).toMatchObject({
        Authorization: "test-organization-token",
      });
      return response({
        results: [
          {
            id: 41,
            status: "ended",
            channel: "chat",
            operator_id: 9,
            widget_id: 4,
            message_count: 5,
            note_count: 1,
            contact: { email: "private@example.com" },
            messages: [{ body: "private" }],
          },
        ],
        next: "private-page-url",
      });
    });
    const result = await new UserlikeApiAdapter(requester).listConversations(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual({
      conversations: [
        expect.objectContaining({
          conversationId: 41,
          status: "ended",
          operatorId: "9",
          messageCount: 5,
        }),
      ],
      hasNextPage: true,
      limit: 2,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("reads one exact conversation through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(String(url)).toBe(
        "https://api.userlike.com/api/um/v3/conversations/72/",
      );
      return response({
        id: 72,
        status: "open",
        messages: [{ body: "private" }],
      });
    });
    await expect(
      new UserlikeApiAdapter(requester).getConversation(credentials, 72),
    ).resolves.toMatchObject({
      conversation: { conversationId: 72, status: "open" },
    });
  });
  it("redacts secrets from broader responses", async () => {
    const result = await new UserlikeApiAdapter(async () =>
      response({ api_token: "provider-secret" }),
    ).request(credentials, { method: "GET", path: "/operators/" });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });
  it("rejects hostile paths, credential fields, missing tokens, and oversized responses", async () => {
    const adapter = new UserlikeApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "https://evil.test",
      }),
    ).rejects.toBeInstanceOf(UserlikeApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/notes/",
        json: { apiToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.health({ organizationToken: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
