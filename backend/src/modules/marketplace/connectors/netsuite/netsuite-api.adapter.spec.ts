import { NetSuiteApiAdapter } from "./netsuite-api.adapter";

const credentials = {
  accountId: "123456_SB1",
  suiteTalkOrigin: "https://123456-sb1.suitetalk.api.netsuite.com",
  consumerKey: "fixture-consumer-key",
  consumerSecret: "fixture-consumer-secret",
  tokenId: "fixture-token-id",
  tokenSecret: "fixture-token-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("NetSuiteApiAdapter", () => {
  it("pins the account origin, accounting-period paths, OAuth header, fields, and bounds", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses = [
      {
        items: [
          {
            id: "9",
            periodName: "January 2026",
            startDate: "2026-01-01",
            endDate: "2026-01-31",
            closed: true,
            fiscalCalendars: { items: [{ private: true }] },
            links: [{ href: "private" }],
          },
        ],
        hasMore: false,
      },
      {
        id: "9",
        periodName: "January 2026",
        isAdjust: false,
        isPosting: true,
        userNotes: [{ private: true }],
      },
    ];
    const adapter = new NetSuiteApiAdapter(
      async (url, init) => {
        calls.push({ url, init });
        return json(responses.shift());
      },
      () => 1_700_000_000,
      () => "fixed-nonce",
    );

    const list = await adapter.listAccountingPeriods(credentials, { limit: 3 });
    const exact = await adapter.getAccountingPeriod(credentials, {
      periodId: "9",
    });

    expect(calls.map((call) => call.url)).toEqual([
      "https://123456-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/accountingperiod?limit=3&offset=0&fields=id%2CperiodName%2CstartDate%2CendDate%2Cclosed%2CisAdjust%2CisInactive%2CisPosting",
      "https://123456-sb1.suitetalk.api.netsuite.com/services/rest/record/v1/accountingperiod/9?fields=id%2CperiodName%2CstartDate%2CendDate%2Cclosed%2CisAdjust%2CisInactive%2CisPosting",
    ]);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toContain('realm="123456_SB1"');
    expect(headers.Authorization).toContain('oauth_nonce="fixed-nonce"');
    expect(headers.Authorization).toContain(
      'oauth_signature_method="HMAC-SHA256"',
    );
    expect(headers.Authorization).not.toContain(credentials.consumerSecret);
    expect(headers.Authorization).not.toContain(credentials.tokenSecret);
    expect(list.periods[0]).not.toHaveProperty("fiscalCalendars");
    expect(list.periods[0]).not.toHaveProperty("links");
    expect(exact.period).not.toHaveProperty("userNotes");
  });

  it("rejects invalid account binding, secrets, IDs, and limits before network access", async () => {
    const request = jest.fn();
    const adapter = new NetSuiteApiAdapter(request);
    await expect(
      adapter.listAccountingPeriods(
        { ...credentials, suiteTalkOrigin: "https://evil.example.com" },
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listAccountingPeriods({ ...credentials, tokenSecret: "" }, {}),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getAccountingPeriod(credentials, { periodId: "../9" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listAccountingPeriods(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on record mismatch and provider failures without leaking details", async () => {
    const mismatch = new NetSuiteApiAdapter(async () => json({ id: "10" }));
    await expect(
      mismatch.getAccountingPeriod(credentials, { periodId: "9" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    const denied = new NetSuiteApiAdapter(async () =>
      json({ detail: `denied ${credentials.tokenSecret}` }, 403),
    );
    await expect(
      denied.listAccountingPeriods(credentials, {}),
    ).rejects.toMatchObject({
      code: "insufficient_scope",
      message: "NetSuite API request failed.",
    });
  });
});
