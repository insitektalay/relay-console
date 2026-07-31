import { PipedriveApiAdapter } from "./pipedrive-api.adapter";

const credentials = { accessToken: "secret-token", companyId: "42", apiOrigin: "https://relay-sandbox.pipedrive.com" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("PipedriveApiAdapter", () => {
  it("uses only fixed bounded organization and deal requests", async () => {
    const calls: string[] = [];
    const adapter = new PipedriveApiAdapter(async (url) => { calls.push(url); return json({ success: true, data: [{ id: 7, name: "Example", title: "Deal", value: 12, currency: "GBP", update_time: "2026-07-17" }] }); });
    await adapter.listOrganizations(credentials, { limit: 3 });
    await adapter.listDeals(credentials, { limit: 2 });
    await adapter.getDeal(credentials, { dealId: "7" });
    expect(calls).toEqual([
      "https://relay-sandbox.pipedrive.com/api/v2/organizations?limit=3&sort_by=update_time&sort_direction=desc",
      "https://relay-sandbox.pipedrive.com/api/v2/deals?limit=2&sort_by=update_time&sort_direction=desc",
      "https://relay-sandbox.pipedrive.com/api/v2/deals/7",
    ]);
  });

  it("rejects invalid domain, company, deal ID, and limit before network access", async () => {
    const request = jest.fn();
    const adapter = new PipedriveApiAdapter(request);
    await expect(adapter.listDeals({ ...credentials, apiOrigin: "https://evil.example" }, {})).rejects.toMatchObject({ code: "pipedrive_api_origin_invalid" });
    await expect(adapter.listDeals({ ...credentials, companyId: "0" }, {})).rejects.toMatchObject({ code: "pipedrive_company_binding_invalid" });
    await expect(adapter.getDeal(credentials, { dealId: "7/notes" })).rejects.toMatchObject({ code: "pipedrive_deal_id_invalid" });
    await expect(adapter.listDeals(credentials, { limit: 26 })).rejects.toMatchObject({ code: "pipedrive_input_invalid" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps provider failures without exposing token or response detail", async () => {
    const adapter = new PipedriveApiAdapter(async () => json({ success: false, error: "denied secret-token" }, 403));
    await expect(adapter.listDeals(credentials, {})).rejects.toMatchObject({ code: "pipedrive_permission_denied", message: "Pipedrive API request failed." });
  });
});
