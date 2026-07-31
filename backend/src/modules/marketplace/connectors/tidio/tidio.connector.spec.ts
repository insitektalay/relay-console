import { TIDIO_CONNECTOR_MANIFEST } from "./tidio.connector";
import { TidioApiAdapter, TidioApiError } from "./tidio-api.adapter";

const credentials = { clientId: "ci_test", clientSecret: "cs_test" };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Tidio connector", () => {
  it("publishes content-free reads and an approval-gated OpenAPI broker", () => {
    expect(TIDIO_CONNECTOR_MANIFEST.slug).toBe("tidio");
    expect(TIDIO_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "tidio.listTickets",
      "tidio.getTicket",
      "tidio.request",
    ]);
    expect(
      TIDIO_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });
  it("binds the keypair to api.tidio.com and strips ticket content", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe("https://api.tidio.com/tickets");
      expect(init.headers).toMatchObject({
        "X-Tidio-Openapi-Client-Id": "ci_test",
        "X-Tidio-Openapi-Client-Secret": "cs_test",
        Accept: "application/json; version=1",
      });
      return response({
        data: [
          {
            id: 41,
            status: "open",
            priority: "urgent",
            assigned_department_id: "dep_2",
            assigned: { operator_id: "op_9" },
            subject: "private",
            messages: [{ content: "private" }],
            contact_email: "private@example.com",
          },
        ],
        next_cursor: "private-cursor",
      });
    });
    const result = await new TidioApiAdapter(requester).listTickets(
      credentials,
    );
    expect(result).toEqual({
      tickets: [
        expect.objectContaining({
          ticketId: 41,
          status: "open",
          priority: "urgent",
          assignedDepartmentId: "dep_2",
          assignedOperatorId: "op_9",
        }),
      ],
      hasNextPage: true,
      limit: 25,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("reads one exact ticket through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(String(url)).toBe("https://api.tidio.com/tickets/72");
      return response({
        data: { id: 72, status: "solved", messages: [{ content: "private" }] },
      });
    });
    await expect(
      new TidioApiAdapter(requester).getTicket(credentials, 72),
    ).resolves.toMatchObject({ ticket: { ticketId: 72, status: "solved" } });
  });
  it("redacts secrets from bounded broader responses", async () => {
    const result = await new TidioApiAdapter(async () =>
      response({ client_secret: "provider-secret" }),
    ).request(credentials, { method: "GET", path: "/operators" });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });
  it("rejects hostile paths, credential fields, missing keys, and oversized responses", async () => {
    const adapter = new TidioApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "https://evil.test",
      }),
    ).rejects.toBeInstanceOf(TidioApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/tickets",
        json: { clientSecret: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.health({ ...credentials, clientSecret: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
