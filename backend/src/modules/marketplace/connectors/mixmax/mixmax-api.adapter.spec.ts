import { MixmaxApiAdapter } from "./mixmax-api.adapter";

const credentials = { apiToken: "fixture-api-token", sequenceId: "52ee8b4b7df7362e9aea4c30" }; const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("MixmaxApiAdapter", () => {
  it("pins the exact sequence GET and redacts owners, stages, recipients, tracking, and CRM state", async () => {
    const request = jest.fn(async () => json({ _id: credentials.sequenceId, userId: "private-owner", name: "Outbound audit", createdAt: "2026-01-02T03:04:05.000Z", updatedAt: "2026-01-03T03:04:05.000Z", stages: ["private-stage"], cc: [{ email: "private@example.com" }], variables: ["private"], crmsConnected: [{ name: "Salesforce", logTo: true }], linkTrackingEnabled: true }));
    const result = await new MixmaxApiAdapter(request).getSequenceSummary(credentials);
    expect(request).toHaveBeenCalledWith(`https://api.mixmax.com/v1/sequences/${credentials.sequenceId}`, expect.objectContaining({ method: "GET", headers: expect.objectContaining({ "X-API-Token": credentials.apiToken }) }));
    expect(result.sequence).toEqual({ sequenceId: credentials.sequenceId, name: "Outbound audit", createdAt: "2026-01-02T03:04:05.000Z", updatedAt: "2026-01-03T03:04:05.000Z" });
    expect(result.sequence).not.toHaveProperty("userId"); expect(result.sequence).not.toHaveProperty("stages"); expect(result.sequence).not.toHaveProperty("cc"); expect(result.sequence).not.toHaveProperty("variables"); expect(result.sequence).not.toHaveProperty("crmsConnected"); expect(result.sequence).not.toHaveProperty("linkTrackingEnabled");
  });
  it("rejects mismatched sequence IDs and maps provider authentication errors safely", async () => {
    await expect(new MixmaxApiAdapter(async () => json({ _id: "aaaaaaaaaaaaaaaaaaaaaaaa" })).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new MixmaxApiAdapter(async () => json({ message: credentials.apiToken }, 401)).health(credentials)).rejects.toMatchObject({ code: "credential_missing", message: "Mixmax API request failed." });
  });
});
