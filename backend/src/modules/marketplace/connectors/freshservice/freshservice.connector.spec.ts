import { FRESHSERVICE_CONNECTOR_MANIFEST } from "./freshservice.connector";
import {
  FreshserviceApiAdapter,
  FreshserviceApiError,
} from "./freshservice-api.adapter";

const credentials = { domain: "relay-it", apiKey: "test-api-key" };
const response = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

describe("Freshservice connector", () => {
  it("publishes bounded ticket reads and an approval-gated full API", () => {
    expect(FRESHSERVICE_CONNECTOR_MANIFEST.slug).toBe("freshservice");
    expect(FRESHSERVICE_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      FRESHSERVICE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "freshservice.listTickets",
      "freshservice.getTicket",
      "freshservice.request",
    ]);
    expect(
      FRESHSERVICE_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("binds Basic auth to the exact Freshservice tenant and first page", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      const parsed = new URL(String(url));
      expect(parsed.origin).toBe("https://relay-it.freshservice.com");
      expect(parsed.searchParams.get("page")).toBe("1");
      expect(parsed.searchParams.get("per_page")).toBe("2");
      expect(init.headers).toMatchObject({
        Authorization: `Basic ${Buffer.from("test-api-key:X").toString("base64")}`,
      });
      return response(
        {
          tickets: [
            {
              id: 41,
              subject: "Laptop request",
              status: 2,
              priority: 1,
              requester_id: 99,
              description_text: "private",
              custom_fields: { private: true },
              created_at: "2026-07-17T12:00:00Z",
            },
          ],
        },
        200,
        { link: "<https://relay-it.freshservice.com/api/v2/tickets?page=2>" },
      );
    });
    const result = await new FreshserviceApiAdapter(requester).listTickets(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual({
      tickets: [
        expect.objectContaining({
          ticketId: 41,
          subject: "Laptop request",
          status: 2,
          priority: 1,
        }),
      ],
      hasNextPage: true,
    });
    expect(JSON.stringify(result)).not.toContain("requester");
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("reads one exact ticket through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(new URL(String(url)).pathname).toBe("/api/v2/tickets/72");
      return response({
        ticket: {
          id: 72,
          subject: "VPN access",
          type: "Service Request",
          status: 2,
          priority: 3,
          workspace_id: 5,
          due_by: "2026-07-18T12:00:00Z",
        },
      });
    });
    const result = await new FreshserviceApiAdapter(requester).getTicket(
      credentials,
      72,
    );
    expect(result.ticket).toMatchObject({
      ticketId: 72,
      workspaceId: 5,
      type: "Service Request",
    });
  });

  it("allows bounded relative full-API requests and redacts secrets", async () => {
    const requester = jest.fn(async () =>
      response({ item: { id: 1, access_token: "provider-secret" } }),
    );
    const result = await new FreshserviceApiAdapter(requester).request(
      credentials,
      { method: "GET", path: "/api/v2/assets" },
    );
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile domains, paths, credential fields, and oversized responses", async () => {
    const adapter = new FreshserviceApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.health({
        ...credentials,
        domain: "relay-it.freshservice.com.evil",
      }),
    ).rejects.toBeInstanceOf(FreshserviceApiError);
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "/api/v2/../admin",
      }),
    ).rejects.toBeInstanceOf(FreshserviceApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/api/v2/tickets",
        json: { accessToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
