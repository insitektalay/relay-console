import { NutshellApiAdapter } from "./nutshell-api.adapter";

const credentials = {
  email: "relay@example.com",
  apiKey: "fixture-nutshell-api-key",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("NutshellApiAdapter", () => {
  it("uses only fixed first-page search and exact Lead reads", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses: unknown[] = [
      {
        leads: [
          {
            id: "7-leads",
            number: 1007,
            name: "Renewal",
            links: { contacts: ["3-contacts"] },
            description: "private",
          },
        ],
        meta: { totalPages: 2 },
      },
      {
        leads: [
          {
            id: "7-leads",
            number: 1007,
            name: "Renewal",
            links: { accounts: ["2-accounts"] },
            note: "private",
          },
        ],
      },
    ];
    const adapter = new NutshellApiAdapter(async (url, init) => {
      calls.push({ url, init });
      return json(responses.shift());
    });

    const list = await adapter.searchLeads(credentials, {
      query: "  Renewal  ",
      limit: 3,
    });
    const exact = await adapter.getLead(credentials, { leadId: "7-leads" });

    expect(calls.map((call) => [call.init.method, call.url])).toEqual([
      [
        "GET",
        "https://app.nutshell.com/rest/leads?q=Renewal&page%5Bpage%5D=0&page%5Blimit%5D=3",
      ],
      ["GET", "https://app.nutshell.com/rest/leads/7-leads"],
    ]);
    expect(
      (calls[0].init.headers as Record<string, string>).Authorization,
    ).toBe(
      `Basic ${Buffer.from("relay@example.com:fixture-nutshell-api-key").toString("base64")}`,
    );
    expect(list.authorizingEmail).toBe("relay@example.com");
    expect(list.leads[0]).not.toHaveProperty("links");
    expect(list.leads[0]).not.toHaveProperty("description");
    expect(list.hasMore).toBe(true);
    expect(exact.lead).not.toHaveProperty("links");
    expect(exact.lead).not.toHaveProperty("note");
  });

  it("rejects invalid credentials, IDs, searches, and bounds before network access", async () => {
    const request = jest.fn();
    const adapter = new NutshellApiAdapter(request);
    await expect(
      adapter.searchLeads({ ...credentials, email: "invalid" }, { query: "x" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.searchLeads({ ...credentials, apiKey: "" }, { query: "x" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getLead(credentials, { leadId: "../users" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.searchLeads(credentials, { query: "", limit: 3 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.searchLeads(credentials, { query: "Renewal", limit: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on identity mismatch and provider failures", async () => {
    const mismatch = new NutshellApiAdapter(async () =>
      json({ leads: [{ id: "8-leads" }] }),
    );
    await expect(
      mismatch.getLead(credentials, { leadId: "7-leads" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });

    const denied = new NutshellApiAdapter(async () =>
      json({ detail: `denied ${credentials.apiKey}` }, 401),
    );
    await expect(
      denied.searchLeads(credentials, { query: "Renewal" }),
    ).rejects.toMatchObject({
      code: "credential_missing",
      message: "Nutshell API request failed.",
    });
  });
});
