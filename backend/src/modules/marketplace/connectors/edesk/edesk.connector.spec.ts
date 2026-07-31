import { EDeskApiAdapter, EDeskApiError } from "./edesk-api.adapter";
import { EDESK_CONNECTOR_MANIFEST } from "./edesk.connector";

const credentials = { apiToken: "test-api-token" };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("eDesk connector", () => {
  it("publishes content-free reads and an approval-gated API broker", () => {
    expect(EDESK_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "edesk.listTickets",
      "edesk.getTicket",
      "edesk.request",
    ]);
    expect(
      EDESK_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds Bearer auth to the exact origin and strips private data", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.edesk.com/v1/tickets?order_by=last_updated_at&order_direction=desc",
      );
      expect(init.headers).toMatchObject({
        Authorization: "Bearer test-api-token",
      });
      return response({
        tickets: [
          {
            id: 41,
            subject: "Private subject",
            status: "Open",
            type: "Email",
            contact: { email: "private@example.com" },
            messages: [{ body: "Private body" }],
            created_at: "2026-07-18T10:00:00Z",
            last_updated_at: "2026-07-18T11:00:00Z",
          },
        ],
      });
    });
    const result = await new EDeskApiAdapter(requester).listTickets(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual({
      tickets: [
        expect.objectContaining({
          ticketId: 41,
          status: "Open",
          type: "Email",
        }),
      ],
      returnedCount: 1,
      limit: 2,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("contact");
  });

  it("reads one exact ticket through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(new URL(String(url)).pathname).toBe("/v1/tickets/72");
      return response({
        id: 72,
        status: "Closed",
        type: "Amazon",
        subject: "private",
      });
    });
    await expect(
      new EDeskApiAdapter(requester).getTicket(credentials, 72),
    ).resolves.toMatchObject({
      ticket: { ticketId: 72, status: "Closed", type: "Amazon" },
    });
  });

  it("redacts secrets from broader responses", async () => {
    const result = await new EDeskApiAdapter(async () =>
      response({ api_token: "provider-secret" }),
    ).request(credentials, { method: "GET", path: "/v1/channels" });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile paths, credential fields, missing tokens, and oversized responses", async () => {
    const adapter = new EDeskApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.request(credentials, { method: "GET", path: "/v1/../admin" }),
    ).rejects.toBeInstanceOf(EDeskApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/v1/tickets",
        json: { apiToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(adapter.health({ apiToken: "" })).rejects.toMatchObject({
      code: "credential_missing",
    });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
