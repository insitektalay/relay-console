import { GorgiasApiAdapter, GorgiasApiError } from "./gorgias-api.adapter";
import { GORGIAS_CONNECTOR_MANIFEST } from "./gorgias.connector";

const credentials = {
  domain: "relay-support",
  username: "api-user@relay.test",
  apiKey: "test-api-key",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Gorgias connector", () => {
  it("publishes content-free reads and an approval-gated API broker", () => {
    expect(GORGIAS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "gorgias.listTickets",
      "gorgias.getTicket",
      "gorgias.request",
    ]);
    expect(
      GORGIAS_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds Basic auth to the exact tenant and strips private data", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      const parsed = new URL(String(url));
      expect(parsed.origin).toBe("https://relay-support.gorgias.com");
      expect(parsed.pathname).toBe("/api/tickets");
      expect(parsed.searchParams.get("limit")).toBe("2");
      expect(parsed.searchParams.get("trashed")).toBe("false");
      expect(init.headers).toMatchObject({
        Authorization: `Basic ${Buffer.from("api-user@relay.test:test-api-key").toString("base64")}`,
      });
      return response({
        data: [
          {
            id: 41,
            subject: "Private subject",
            summary: { text: "Private summary" },
            status: "open",
            channel: "email",
            priority: "high",
            spam: false,
            customer: { email: "private@example.com" },
            messages: [{ body_text: "private" }],
            created_datetime: "2026-07-18T10:00:00Z",
          },
        ],
        meta: { next_cursor: "private-cursor" },
      });
    });
    const result = await new GorgiasApiAdapter(requester).listTickets(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual({
      tickets: [
        expect.objectContaining({
          ticketId: 41,
          status: "open",
          channel: "email",
          priority: "high",
        }),
      ],
      hasNextPage: true,
      limit: 2,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("customer");
  });

  it("reads one exact ticket through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(new URL(String(url)).pathname).toBe("/api/tickets/72");
      return response({ id: 72, status: "closed", subject: "private" });
    });
    await expect(
      new GorgiasApiAdapter(requester).getTicket(credentials, 72),
    ).resolves.toMatchObject({ ticket: { ticketId: 72, status: "closed" } });
  });

  it("redacts secrets from broader responses", async () => {
    const result = await new GorgiasApiAdapter(async () =>
      response({ api_token: "provider-secret" }),
    ).request(credentials, { method: "GET", path: "/api/account" });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile tenants, paths, credential fields, and oversized responses", async () => {
    const adapter = new GorgiasApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.health({ ...credentials, domain: "relay.gorgias.com.evil" }),
    ).rejects.toBeInstanceOf(GorgiasApiError);
    await expect(
      adapter.request(credentials, { method: "GET", path: "/api/../admin" }),
    ).rejects.toBeInstanceOf(GorgiasApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/api/tickets",
        json: { apiToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.health({ ...credentials, apiKey: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
