import { ReAmazeApiAdapter, ReAmazeApiError } from "./re-amaze-api.adapter";
import { REAMAZE_CONNECTOR_MANIFEST } from "./re-amaze.connector";

const credentials = {
  brand: "relay-support",
  loginEmail: "api-user@relay.test",
  apiToken: "test-api-token",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Re:amaze connector", () => {
  it("publishes content-free reads and an approval-gated API broker", () => {
    expect(REAMAZE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "reamaze.listConversations",
      "reamaze.getConversation",
      "reamaze.request",
    ]);
    expect(
      REAMAZE_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds Basic auth to the exact brand and strips private data", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://relay-support.reamaze.io/api/v1/conversations?page=1&sort=changed",
      );
      expect(init.headers).toMatchObject({
        Authorization: `Basic ${Buffer.from("api-user@relay.test:test-api-token").toString("base64")}`,
      });
      return response({
        page_size: 30,
        page_count: 2,
        conversations: [
          {
            subject: "Private subject",
            slug: "conv-41",
            status: 0,
            message: { body: "Private body" },
            author: { email: "private@example.com" },
            category: { channel: 1, email: "private@example.com" },
            created_at: "2026-07-18T10:00:00Z",
            last_customer_message: {
              body: "Private message",
              created_at: "2026-07-18T11:00:00Z",
            },
          },
        ],
      });
    });
    const result = await new ReAmazeApiAdapter(requester).listConversations(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual({
      conversations: [
        expect.objectContaining({
          conversationSlug: "conv-41",
          statusCode: 0,
          status: "open",
          channelCode: 1,
        }),
      ],
      hasNextPage: true,
      limit: 2,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("author");
  });

  it("reads one exact conversation through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(new URL(String(url)).pathname).toBe(
        "/api/v1/conversations/conv-72",
      );
      return response({ slug: "conv-72", status: 2, subject: "private" });
    });
    await expect(
      new ReAmazeApiAdapter(requester).getConversation(credentials, "conv-72"),
    ).resolves.toMatchObject({
      conversation: {
        conversationSlug: "conv-72",
        statusCode: 2,
        status: "done",
      },
    });
  });

  it("redacts secrets from broader responses", async () => {
    const result = await new ReAmazeApiAdapter(async () =>
      response({ api_token: "provider-secret" }),
    ).request(credentials, { method: "GET", path: "/api/v1/channels" });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile brands, paths, credential fields, and oversized responses", async () => {
    const adapter = new ReAmazeApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.health({ ...credentials, brand: "relay.reamaze.io.evil" }),
    ).rejects.toBeInstanceOf(ReAmazeApiError);
    await expect(
      adapter.request(credentials, { method: "GET", path: "/api/v1/../admin" }),
    ).rejects.toBeInstanceOf(ReAmazeApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/api/v1/conversations",
        json: { apiToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.health({ ...credentials, apiToken: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
