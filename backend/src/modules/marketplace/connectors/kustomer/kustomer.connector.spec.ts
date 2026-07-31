import { KustomerApiAdapter, KustomerApiError } from "./kustomer-api.adapter";
import { KUSTOMER_CONNECTOR_MANIFEST } from "./kustomer.connector";

const credentials = { apiKey: "test-api-key" };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Kustomer connector", () => {
  it("publishes content-free reads and an approval-gated API broker", () => {
    expect(KUSTOMER_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "kustomer.listConversations",
      "kustomer.getConversation",
      "kustomer.request",
    ]);
    expect(
      KUSTOMER_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds Bearer auth to page one and strips private data", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.kustomerapp.com/v1/conversations?page=1&pageSize=2",
      );
      expect(init.headers).toMatchObject({
        Authorization: "Bearer test-api-key",
      });
      return response({
        data: [
          {
            id: "conv_41",
            attributes: {
              name: "Private subject",
              preview: "Private message",
              status: "open",
              channels: ["email"],
              messageCount: 5,
              noteCount: 1,
              spam: false,
              createdAt: "2026-07-18T10:00:00Z",
              tags: ["private"],
            },
            relationships: { customer: { data: { id: "private" } } },
          },
        ],
        links: { next: "private-page-url" },
      });
    });
    const result = await new KustomerApiAdapter(requester).listConversations(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual({
      conversations: [
        expect.objectContaining({
          conversationId: "conv_41",
          status: "open",
          channels: ["email"],
          messageCount: 5,
        }),
      ],
      hasNextPage: true,
      limit: 2,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("customer");
  });

  it("reads one exact conversation through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(new URL(String(url)).pathname).toBe("/v1/conversations/conv_72");
      return response({
        data: {
          id: "conv_72",
          attributes: { status: "done", preview: "private" },
        },
      });
    });
    await expect(
      new KustomerApiAdapter(requester).getConversation(credentials, "conv_72"),
    ).resolves.toMatchObject({
      conversation: { conversationId: "conv_72", status: "done" },
    });
  });

  it("redacts secrets from broader responses", async () => {
    const result = await new KustomerApiAdapter(async () =>
      response({ access_token: "provider-secret" }),
    ).request(credentials, { method: "GET", path: "/v1/teams" });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile paths, credential fields, missing keys, and oversized responses", async () => {
    const adapter = new KustomerApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "https://evil.test",
      }),
    ).rejects.toBeInstanceOf(KustomerApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/v1/conversations",
        json: { apiToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(adapter.health({ apiKey: "" })).rejects.toMatchObject({
      code: "credential_missing",
    });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
