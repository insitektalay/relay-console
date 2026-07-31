import { ZendeskApiAdapter } from "./zendesk-api.adapter";

const credentials = {
  accessToken: "secret-token",
  instanceOrigin: "https://relay-demo.zendesk.com",
  userId: "42",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("ZendeskApiAdapter", () => {
  it("uses one fixed tenant and bounded ticket-list parameters", async () => {
    const request = jest.fn(async () =>
      response({
        tickets: [
          {
            id: 123,
            subject: "Printer issue",
            status: "open",
            description: "Private description",
            requester_id: 99,
            custom_fields: [{ id: 1, value: "private" }],
          },
        ],
        next_page: "private-cursor",
      }),
    );
    const result = await new ZendeskApiAdapter(request).listTickets(
      credentials,
      { limit: 10 },
    );
    const url = new URL((request.mock.calls[0] as unknown as [string])[0]);
    expect(url.origin).toBe("https://relay-demo.zendesk.com");
    expect(url.pathname).toBe("/api/v2/tickets.json");
    expect(url.searchParams.get("per_page")).toBe("10");
    expect(url.searchParams.get("sort_by")).toBe("updated_at");
    expect(url.searchParams.get("sort_order")).toBe("desc");
    expect(url.searchParams.get("query")).toBeNull();
    expect(JSON.stringify(result)).not.toContain("Private description");
    expect(JSON.stringify(result)).not.toContain("private-cursor");
  });

  it("rejects invalid instances, IDs, and changed authorizing users", async () => {
    const adapter = new ZendeskApiAdapter(async () =>
      response({ user: { id: 7, name: "Different user" } }),
    );
    await expect(
      adapter.health({
        ...credentials,
        instanceOrigin: "https://evil.example",
      }),
    ).rejects.toMatchObject({ code: "zendesk_instance_invalid" });
    await expect(
      adapter.getTicket(credentials, { ticketId: "../../users" }),
    ).rejects.toMatchObject({ code: "zendesk_ticket_id_invalid" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "zendesk_user_binding_mismatch",
    });
  });

  it("maps provider failures without exposing response bodies", async () => {
    const adapter = new ZendeskApiAdapter(async () =>
      response({ error: "secret provider detail" }, 403),
    );
    await expect(adapter.ticketCount(credentials)).rejects.toMatchObject({
      code: "zendesk_permission_denied",
      message: "Zendesk API request failed.",
    });
  });
});
