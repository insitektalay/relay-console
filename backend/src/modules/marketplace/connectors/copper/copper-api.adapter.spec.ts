import { CopperApiAdapter } from "./copper-api.adapter";

const credentials = { accessToken: "secret-token", accountId: "123" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("CopperApiAdapter", () => {
  it("uses only fixed bounded account and opportunity requests", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses: unknown[] = [
      { id: 123, name: "Relay CRM", primary_timezone: "Europe/London" },
      [{ id: 7, name: "Deal", company_name: "Example", monetary_value: 12 }],
      { id: 7, name: "Deal", company_name: "Example", monetary_value: 12 },
    ];
    const adapter = new CopperApiAdapter(async (url, init) => {
      calls.push({ url, init });
      return json(responses.shift());
    });
    await adapter.getAccount(credentials);
    await adapter.listOpportunities(credentials, { limit: 3 });
    await adapter.getOpportunity(credentials, { opportunityId: "7" });
    expect(calls.map((call) => [call.init.method, call.url])).toEqual([
      ["GET", "https://api.copper.com/developer_api/v1/account"],
      ["POST", "https://api.copper.com/developer_api/v1/opportunities/search"],
      ["GET", "https://api.copper.com/developer_api/v1/opportunities/7"],
    ]);
    expect(JSON.parse(String(calls[1].init.body))).toEqual({
      page_size: 3,
      sort_by: "date_modified",
      sort_direction: "desc",
    });
    expect(
      (calls[1].init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer secret-token");
  });

  it("rejects invalid account, opportunity ID, and limit before network access", async () => {
    const request = jest.fn();
    const adapter = new CopperApiAdapter(request);
    await expect(
      adapter.getAccount({ ...credentials, accountId: "0" }),
    ).rejects.toMatchObject({ code: "copper_account_binding_invalid" });
    await expect(
      adapter.getOpportunity(credentials, { opportunityId: "7/files" }),
    ).rejects.toMatchObject({ code: "copper_opportunity_id_invalid" });
    await expect(
      adapter.listOpportunities(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "copper_input_invalid" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps provider failures without exposing tokens or response detail", async () => {
    const adapter = new CopperApiAdapter(async () =>
      json({ message: "denied secret-token" }, 403),
    );
    await expect(
      adapter.listOpportunities(credentials, {}),
    ).rejects.toMatchObject({
      code: "copper_permission_denied",
      message: "Copper API request failed.",
    });
  });
});
