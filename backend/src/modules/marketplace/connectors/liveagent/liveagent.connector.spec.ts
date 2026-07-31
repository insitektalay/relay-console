import { LIVEAGENT_CONNECTOR_MANIFEST } from "./liveagent.connector";
import {
  LiveAgentApiAdapter,
  LiveAgentApiError,
} from "./liveagent-api.adapter";

const credentials = { domain: "relay-test.ladesk.com", apiKey: "test-api-key" };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("LiveAgent connector", () => {
  it("publishes content-free reads and an approval-gated API broker", () => {
    expect(LIVEAGENT_CONNECTOR_MANIFEST.slug).toBe("liveagent");
    expect(LIVEAGENT_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(LIVEAGENT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(
      ["liveagent.listTickets", "liveagent.getTicket", "liveagent.request"],
    );
    expect(
      LIVEAGENT_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds API-key auth to the tenant API v3 origin and strips ticket content", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://relay-test.ladesk.com/api/v3/tickets?_page=1&_perPage=2",
      );
      expect(init.headers).toMatchObject({ apikey: "test-api-key" });
      return response([
        {
          id: "TICKET_41",
          code: "ABC-123",
          status: "open",
          channel: "E",
          priority: "N",
          department_id: "DEP_2",
          agent_id: "AGENT_9",
          date_created: "2026-07-18T10:00:00Z",
          subject: "private subject",
          messages: [{ body: "private body" }],
          requester_email: "private@example.com",
        },
      ]);
    });
    const result = await new LiveAgentApiAdapter(requester).listTickets(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual({
      tickets: [
        expect.objectContaining({
          ticketId: "TICKET_41",
          code: "ABC-123",
          status: "open",
          departmentId: "DEP_2",
          agentId: "AGENT_9",
        }),
      ],
      limit: 2,
      hasNextPage: false,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("reads one exact ticket through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(String(url)).toBe(
        "https://relay-test.ladesk.com/api/v3/tickets/TICKET_72",
      );
      return response({
        id: "TICKET_72",
        status: "resolved",
        department_id: "DEP_5",
      });
    });
    await expect(
      new LiveAgentApiAdapter(requester).getTicket(credentials, "TICKET_72"),
    ).resolves.toMatchObject({
      ticket: {
        ticketId: "TICKET_72",
        status: "resolved",
        departmentId: "DEP_5",
      },
    });
  });

  it("allows bounded tenant-relative operations and redacts secrets", async () => {
    const result = await new LiveAgentApiAdapter(async () =>
      response({ api_key: "provider-secret" }),
    ).request(credentials, { method: "GET", path: "/agents" });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile domains, paths, credential fields, missing keys, and oversized responses", async () => {
    const adapter = new LiveAgentApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.health({ domain: "evil.test", apiKey: "x" }),
    ).rejects.toBeInstanceOf(LiveAgentApiError);
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "https://evil.test",
      }),
    ).rejects.toBeInstanceOf(LiveAgentApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/tickets",
        json: { apiKey: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.health({ ...credentials, apiKey: "" }),
    ).rejects.toMatchObject({
      code: "credential_missing",
    });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
