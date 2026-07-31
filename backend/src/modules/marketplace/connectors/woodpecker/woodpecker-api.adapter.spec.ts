import { WoodpeckerApiAdapter } from "./woodpecker-api.adapter";

const credentials = { apiKey: "fixture-api-key", campaignId: "12345678" }; const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("WoodpeckerApiAdapter", () => {
  it("pins the exact v2 campaign GET and redacts accounts, settings, schedules, and message content", async () => {
    const request = jest.fn(async () => json({ id: 12345678, name: "Outbound audit", status: "PAUSED", bounce_shield_autopaused_at: "2026-01-02T03:04:05Z", email_account_ids: [112233], settings: { daily_enroll: 50 }, steps: { followup: { body: { versions: [{ subject: "private", message: "private body" }] } } } }));
    const result = await new WoodpeckerApiAdapter(request).getCampaignStatus(credentials);
    expect(request).toHaveBeenCalledWith(`https://api.woodpecker.co/rest/v2/campaigns/${credentials.campaignId}`, expect.objectContaining({ method: "GET", headers: expect.objectContaining({ "x-api-key": credentials.apiKey }) }));
    expect(result.campaign).toEqual({ campaignId: credentials.campaignId, name: "Outbound audit", status: "PAUSED", bounceShieldAutoPaused: true });
    expect(result.campaign).not.toHaveProperty("email_account_ids"); expect(result.campaign).not.toHaveProperty("settings"); expect(result.campaign).not.toHaveProperty("steps");
  });
  it("rejects mismatched campaign IDs and maps provider authentication errors safely", async () => {
    await expect(new WoodpeckerApiAdapter(async () => json({ id: 99 })).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new WoodpeckerApiAdapter(async () => json({ detail: credentials.apiKey }, 401)).health(credentials)).rejects.toMatchObject({ code: "credential_missing", message: "Woodpecker API request failed." });
  });
});
