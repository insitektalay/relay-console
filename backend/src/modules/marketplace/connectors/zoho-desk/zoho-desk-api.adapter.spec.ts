import { ZohoDeskApiAdapter } from "./zoho-desk-api.adapter";

const credentials = {
  accessToken: "fixture-access-token",
  apiOrigin: "https://desk.zoho.eu",
  organizationId: "2389290",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("ZohoDeskApiAdapter", () => {
  it("pins organization, regional origin, first page, limit, sort, and redacted fields", async () => {
    const request = jest.fn(async () =>
      json({
        data: [
          {
            id: "903000000000099",
            ticketNumber: "101",
            subject: "Cannot sign in",
            status: "Open",
            priority: "High",
            classification: "Question",
            category: "Access",
            subCategory: "Login",
            channel: "Email",
            language: "en",
            departmentId: "1001",
            productId: "2001",
            dueDate: "2026-07-20T12:00:00.000Z",
            createdTime: "2026-07-17T12:00:00.000Z",
            modifiedTime: "2026-07-18T12:00:00.000Z",
            contact: { email: "private@example.com" },
            description: "private body",
            assignee: { email: "agent@example.com" },
            cf: { private: true },
          },
        ],
      }),
    );
    const result = await new ZohoDeskApiAdapter(request).listTickets(
      credentials,
      { limit: 10 },
    );
    expect(request).toHaveBeenCalledWith(
      "https://desk.zoho.eu/api/v1/tickets?from=1&limit=10&sortBy=-modifiedTime",
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: `Zoho-oauthtoken ${credentials.accessToken}`,
          orgId: credentials.organizationId,
        }),
      }),
    );
    expect(result.tickets[0]).toMatchObject({
      ticketId: "903000000000099",
      subject: "Cannot sign in",
      status: "Open",
      departmentId: "1001",
    });
    expect(result.tickets[0]).not.toHaveProperty("contact");
    expect(result.tickets[0]).not.toHaveProperty("description");
    expect(result.tickets[0]).not.toHaveProperty("assignee");
    expect(result.tickets[0]).not.toHaveProperty("cf");
    expect(result.nextPageFollowed).toBe(false);
  });

  it("pins exact ticket IDs and rejects origins, IDs, and limits before network access", async () => {
    const request = jest.fn(async () => json({ id: "903000000000099" }));
    await new ZohoDeskApiAdapter(request).getTicket(credentials, {
      ticketId: "903000000000099",
    });
    expect(request).toHaveBeenLastCalledWith(
      "https://desk.zoho.eu/api/v1/tickets/903000000000099",
      expect.any(Object),
    );
    const blocked = jest.fn();
    const adapter = new ZohoDeskApiAdapter(blocked);
    await expect(
      adapter.getTicket({ ...credentials, apiOrigin: "https://evil.example" }, { ticketId: "1" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.getTicket(credentials, { ticketId: "../ticket" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.listTickets(credentials, { limit: 26 })).rejects.toMatchObject({
      code: "provider_validation_error",
    });
    expect(blocked).not.toHaveBeenCalled();
  });

  it("validates the exact accessible organization and redacts provider errors", async () => {
    const health = await new ZohoDeskApiAdapter(async () =>
      json({ data: [{ id: credentials.organizationId, companyName: "Relay Support" }] }),
    ).health(credentials);
    expect(health).toMatchObject({
      organizationId: credentials.organizationId,
      organizationName: "Relay Support",
    });
    await expect(
      new ZohoDeskApiAdapter(async () => json({ detail: credentials.accessToken }, 403)).health(
        credentials,
      ),
    ).rejects.toMatchObject({
      code: "insufficient_scope",
      message: "Zoho Desk API request failed.",
    });
  });
});
