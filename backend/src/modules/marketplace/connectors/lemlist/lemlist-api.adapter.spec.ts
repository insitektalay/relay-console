import { LemlistApiAdapter } from "./lemlist-api.adapter";

const credentials = { apiKey: "fixture-api-key", campaignId: "cam_AbCdEf123456" }; const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("LemlistApiAdapter", () => {
  it("pins the exact campaign read with Basic auth and redacts identities and messaging data", async () => {
    const request = jest.fn(async () => json({ _id: credentials.campaignId, name: "Outbound audit", status: "RUNNING", createdAt: "2026-01-02T03:04:05.000Z", creator: { email: "private@example.com" }, senders: [{ email: "sender@example.com" }], leads: [{ email: "lead@example.com" }], errors: [] }));
    const result = await new LemlistApiAdapter(request).getCampaignStatus(credentials);
    expect(request).toHaveBeenCalledWith(`https://api.lemlist.com/api/campaigns/${credentials.campaignId}`, expect.objectContaining({ method: "GET", headers: expect.objectContaining({ Authorization: `Basic ${Buffer.from(`:${credentials.apiKey}`).toString("base64")}` }) }));
    expect(result.campaign).toEqual({ campaignId: credentials.campaignId, name: "Outbound audit", status: "RUNNING", createdAt: "2026-01-02T03:04:05.000Z", hasError: false });
    expect(result.campaign).not.toHaveProperty("creator"); expect(result.campaign).not.toHaveProperty("senders"); expect(result.campaign).not.toHaveProperty("leads"); expect(result.campaign).not.toHaveProperty("errors");
  });
  it("rejects mismatched campaign IDs and maps authentication errors safely", async () => {
    await expect(new LemlistApiAdapter(async () => json({ _id: "cam_OtherCampaign99" })).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new LemlistApiAdapter(async () => json({ message: credentials.apiKey }, 401)).health(credentials)).rejects.toMatchObject({ code: "credential_missing", message: "lemlist API request failed." });
  });
});
