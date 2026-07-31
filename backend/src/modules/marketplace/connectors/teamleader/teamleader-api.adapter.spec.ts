import { TeamleaderApiAdapter } from "./teamleader-api.adapter";

const credentials = { accessToken: "fixture-teamleader-access-token" };
const dealId = "4e235f27-0af0-40e5-82f3-d32d0aa9edb3";
const userId = "9d4096c3-813f-4bd5-b3c4-4091807b5b74";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("TeamleaderApiAdapter", () => {
  it("uses only fixed current-user, first-page Deal, and exact Deal calls", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses: unknown[] = [
      {
        data: { id: userId, first_name: "Relay", email: "private@example.com" },
      },
      {
        data: [
          {
            id: dealId,
            title: "Renewal",
            customer: { type: "company", id: userId },
            responsible_user_id: userId,
          },
        ],
        meta: { page: { size: 3, number: 1 }, matches: 7 },
      },
      {
        data: {
          id: dealId,
          title: "Renewal",
          contact: { id: userId },
          custom_fields: [{ value: "private" }],
        },
      },
    ];
    const adapter = new TeamleaderApiAdapter(async (url, init) => {
      calls.push({ url, init });
      return json(responses.shift());
    });

    const user = await adapter.getCurrentUser(credentials);
    const list = await adapter.listDeals(credentials, { limit: 3 });
    const exact = await adapter.getDeal(credentials, { dealId });

    expect(calls.map((call) => [call.init.method, call.url])).toEqual([
      ["POST", "https://api.focus.teamleader.eu/users.me"],
      ["POST", "https://api.focus.teamleader.eu/deals.list"],
      ["POST", "https://api.focus.teamleader.eu/deals.info"],
    ]);
    expect(calls.map((call) => JSON.parse(String(call.init.body)))).toEqual([
      {},
      { page: { size: 3, number: 1 } },
      { id: dealId },
    ]);
    expect(
      (calls[0].init.headers as Record<string, string>).Authorization,
    ).toBe(`Bearer ${credentials.accessToken}`);
    expect(user.user).not.toHaveProperty("email");
    expect(list.deals[0]).not.toHaveProperty("customer");
    expect(list.deals[0]).not.toHaveProperty("responsible_user_id");
    expect(list.hasMore).toBe(true);
    expect(exact.deal).not.toHaveProperty("contact");
    expect(exact.deal).not.toHaveProperty("custom_fields");
  });

  it("rejects missing tokens, invalid IDs, and bounds before network access", async () => {
    const request = jest.fn();
    const adapter = new TeamleaderApiAdapter(request);
    await expect(
      adapter.getCurrentUser({ accessToken: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getDeal(credentials, { dealId: "../users.me" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listDeals(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on identity mismatch and provider failures", async () => {
    const mismatch = new TeamleaderApiAdapter(async () =>
      json({ data: { id: userId } }),
    );
    await expect(
      mismatch.getDeal(credentials, { dealId }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });

    const denied = new TeamleaderApiAdapter(async () =>
      json({ errors: [{ title: `denied ${credentials.accessToken}` }] }, 401),
    );
    await expect(denied.getCurrentUser(credentials)).rejects.toMatchObject({
      code: "credential_missing",
      message: "Teamleader API request failed.",
    });
  });
});
