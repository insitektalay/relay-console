import { ReplyIoApiAdapter } from "./reply-io-api.adapter";

const credentials = { apiKey: "fixture-api-key", sequenceId: "12345" }; const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("ReplyIoApiAdapter", () => {
  it("pins the exact V3 sequence GET and redacts owners, accounts, settings, and message content", async () => {
    const request = jest.fn(async () => json({ id: 12345, teamId: 100, ownerId: 42, name: "Outbound audit", created: "2026-01-02T03:04:05+00:00", status: "Paused", isArchived: false, scheduleId: 1, emailAccounts: [{ id: 2, email: "sender@example.com" }], settings: { dailyThrottling: 200 }, steps: [{ template: { emailTemplate: { templates: [{ subject: "private", body: "private body" }] } } }] }));
    const result = await new ReplyIoApiAdapter(request).getSequenceStatus(credentials);
    expect(request).toHaveBeenCalledWith(`https://api.reply.io/v3/sequences/${credentials.sequenceId}`, expect.objectContaining({ method: "GET", headers: expect.objectContaining({ "X-API-Key": credentials.apiKey }) }));
    expect(result.sequence).toEqual({ sequenceId: credentials.sequenceId, name: "Outbound audit", createdAt: "2026-01-02T03:04:05+00:00", status: "Paused", isArchived: false });
    expect(result.sequence).not.toHaveProperty("teamId"); expect(result.sequence).not.toHaveProperty("ownerId"); expect(result.sequence).not.toHaveProperty("emailAccounts"); expect(result.sequence).not.toHaveProperty("settings"); expect(result.sequence).not.toHaveProperty("steps");
  });
  it("rejects mismatched sequence IDs and maps provider authentication errors safely", async () => {
    await expect(new ReplyIoApiAdapter(async () => json({ id: 99 })).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new ReplyIoApiAdapter(async () => json({ detail: credentials.apiKey }, 401)).health(credentials)).rejects.toMatchObject({ code: "credential_missing", message: "Reply.io API request failed." });
  });
});
