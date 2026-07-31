import { EvabootApiAdapter } from "./evaboot-api.adapter";
const credentials = { apiToken: "fixture-token" }; const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("EvabootApiAdapter", () => {
  it("pins the quota endpoint and redacts Sales Navigator account IDs", async () => {
    const request = jest.fn(async () => json({ success: true, quota: { daily_limit: 2500, used_today: 250, remaining: 2250, credits: 1500.5, salesnavs: [{ id: "private-one", status: "valid" }, { id: "private-two", status: "invalid" }] } }));
    const result = await new EvabootApiAdapter(request).getQuota(credentials);
    expect(request).toHaveBeenCalledWith("https://api.evaboot.com/v1/quota/", expect.objectContaining({ method: "GET", headers: expect.objectContaining({ Authorization: `Bearer ${credentials.apiToken}` }) }));
    expect(result.quota).toEqual({ dailyLimit: 2500, usedToday: 250, remainingToday: 2250, credits: 1500.5, salesNavigatorAccounts: { total: 2, valid: 1, invalid: 1 } });
    expect(JSON.stringify(result)).not.toContain("private-one");
  });
  it("validates tokens and maps provider errors safely", async () => {
    await expect(new EvabootApiAdapter().health({ apiToken: "" })).rejects.toMatchObject({ code: "credential_missing" });
    await expect(new EvabootApiAdapter(async () => json({ detail: credentials.apiToken }, 401)).health(credentials)).rejects.toMatchObject({ code: "credential_missing", message: "Evaboot API request failed." });
  });
});
