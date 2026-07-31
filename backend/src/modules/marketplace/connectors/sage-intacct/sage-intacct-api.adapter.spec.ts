import { SageIntacctApiAdapter } from "./sage-intacct-api.adapter";

const credentials = {
  clientId: "fixture-client-id",
  clientSecret: "fixture-client-secret",
  username: "relay-api@example-company",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("SageIntacctApiAdapter", () => {
  it("pins token and reporting-period paths, client credentials, bounds, and returned fields", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses = [
      { access_token: "fixture-access-token", expires_in: 3600 },
      {
        "ia::result": [
          {
            key: "MTAw",
            id: "January 2026",
            name: "Month Ended January 2026",
            startDate: "2026-01-01",
            endDate: "2026-01-31",
            budgeting: true,
            href: "/private/path",
            audit: { createdBy: "private-user" },
          },
        ],
        "ia::meta": { totalCount: 1 },
      },
      { access_token: "fixture-access-token-2", expires_in: 3600 },
      {
        "ia::result": {
          key: "MTAw",
          id: "January 2026",
          name: "Month Ended January 2026",
          status: "active",
          relationships: { budgets: [{ private: true }] },
        },
      },
    ];
    const adapter = new SageIntacctApiAdapter(async (url, init) => {
      calls.push({ url, init });
      return json(responses.shift());
    });

    const list = await adapter.listReportingPeriods(credentials, { limit: 3 });
    const exact = await adapter.getReportingPeriod(credentials, {
      periodKey: "MTAw",
    });

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.intacct.com/ia/api/v1/oauth2/token",
      "https://api.intacct.com/ia/api/v1/objects/general-ledger/reporting-period",
      "https://api.intacct.com/ia/api/v1/oauth2/token",
      "https://api.intacct.com/ia/api/v1/objects/general-ledger/reporting-period/MTAw",
    ]);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      username: credentials.username,
    });
    expect(calls[1].init.headers).toMatchObject({
      Authorization: "Bearer fixture-access-token",
    });
    expect(list.periods[0]).not.toHaveProperty("href");
    expect(list.periods[0]).not.toHaveProperty("audit");
    expect(exact.period).not.toHaveProperty("relationships");
    expect(list.nextPageFollowed).toBe(false);
  });

  it("rejects invalid credentials, keys, and limits before network access", async () => {
    const request = jest.fn();
    const adapter = new SageIntacctApiAdapter(request);
    await expect(
      adapter.listReportingPeriods({ ...credentials, clientSecret: "" }, {}),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.listReportingPeriods({ ...credentials, username: "wrong" }, {}),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getReportingPeriod(credentials, { periodKey: "../MTAw" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listReportingPeriods(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on key mismatch and provider failures without leaking details", async () => {
    const mismatchResponses = [
      json({ access_token: "token" }),
      json({ "ia::result": { key: "OTHER" } }),
    ];
    const mismatch = new SageIntacctApiAdapter(
      async () => mismatchResponses.shift()!,
    );
    await expect(
      mismatch.getReportingPeriod(credentials, { periodKey: "MTAw" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });

    const denied = new SageIntacctApiAdapter(async () =>
      json({ detail: `denied ${credentials.clientSecret}` }, 403),
    );
    await expect(
      denied.listReportingPeriods(credentials, {}),
    ).rejects.toMatchObject({
      code: "insufficient_scope",
      message: "Sage Intacct authentication failed.",
    });
  });
});
