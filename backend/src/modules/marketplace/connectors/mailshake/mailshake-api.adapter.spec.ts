import { MailshakeApiAdapter } from "./mailshake-api.adapter";

const credentials = { apiKey: "fixture-api-key", campaignId: "1042" }; const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("MailshakeApiAdapter", () => {
  it("pins the exact campaign POST with API-key Basic auth and redacts sender and sequence content", async () => {
    const request = jest.fn(async () => json({ object: "campaign", id: 1042, title: "Outbound audit", created: "2026-01-02T03:04:05.000Z", isArchived: false, isPaused: true, messages: [{ id: 1, subject: "private subject" }, { id: 2, subject: "private follow-up" }], sender: { emailAddress: "sender@example.com" }, url: "https://private.example" }));
    const result = await new MailshakeApiAdapter(request).getCampaignStatus(credentials);
    expect(request).toHaveBeenCalledWith("https://api.mailshake.com/2017-04-01/campaigns/get", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:`).toString("base64")}`, "Content-Type": "application/json" }), body: JSON.stringify({ campaignID: 1042 }) }));
    expect(result.campaign).toEqual({ campaignId: "1042", title: "Outbound audit", createdAt: "2026-01-02T03:04:05.000Z", isArchived: false, isPaused: true, messageCount: 2 });
    expect(result.campaign).not.toHaveProperty("messages"); expect(result.campaign).not.toHaveProperty("sender"); expect(result.campaign).not.toHaveProperty("url");
  });
  it("rejects mismatched campaign IDs and maps provider authentication errors safely", async () => {
    await expect(new MailshakeApiAdapter(async () => json({ id: 99 })).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new MailshakeApiAdapter(async () => json({ code: "invalid_api_key", error: credentials.apiKey }, 401)).health(credentials)).rejects.toMatchObject({ code: "credential_missing", message: "Mailshake API request failed." });
  });
});
