import { ActiveCampaignApiAdapter } from "./activecampaign-api.adapter";

const credentials = {
  apiUrl: "https://relay-demo.api-us1.com",
  apiToken: "private-activecampaign-token",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ActiveCampaignApiAdapter", () => {
  it("validates the exact official origin and token-bound user", async () => {
    const request = jest.fn(async () =>
      response({
        user: {
          id: "42",
          username: "private-user",
          email: "private@example.com",
        },
      }),
    );
    const result = await new ActiveCampaignApiAdapter(request).health(
      credentials,
    );
    const [url, init] = request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://relay-demo.api-us1.com/api/3/users/me");
    expect(init.headers).toMatchObject({
      "Api-Token": "private-activecampaign-token",
    });
    expect(result).toEqual({
      apiOrigin: "https://relay-demo.api-us1.com",
      userId: "42",
      apiVersion: "3",
      reachable: true,
    });
    expect(JSON.stringify(result)).not.toContain("private-user");
  });

  it("lists one fixed page of redacted List lifecycle metadata", async () => {
    const request = jest.fn(async () =>
      response({
        lists: [
          {
            id: "7",
            name: "Product updates",
            cdate: "2026-07-01T09:00:00Z",
            private: "0",
            analytics_ua: "private-tracker",
            sender_reminder: "private address",
          },
        ],
      }),
    );
    const result = await new ActiveCampaignApiAdapter(request).listRecentLists(
      credentials,
    );
    const url = new URL(
      (request.mock.calls[0] as unknown as [string, RequestInit])[0],
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: "25",
      offset: "0",
      "orders[id]": "DESC",
    });
    expect(result.lists[0]).toEqual({
      listId: "7",
      name: "Product updates",
      createdAt: "2026-07-01T09:00:00Z",
      isPrivate: "0",
    });
    expect(JSON.stringify(result)).not.toContain("private-tracker");
    expect(JSON.stringify(result)).not.toContain("private address");
  });

  it("lists Campaign lifecycle metadata without names, content, or reports", async () => {
    const request = jest.fn(async () =>
      response({
        campaigns: [
          {
            id: "9",
            type: "single",
            status: "5",
            cdate: "2026-07-10T08:00:00Z",
            mdate: "2026-07-10T09:00:00Z",
            sdate: "2026-07-11T08:30:00Z",
            ldate: "2026-07-11T09:00:00Z",
            name: "private campaign",
            opens: "100",
            linkclicks: "12",
            messages: ["private content"],
          },
        ],
      }),
    );
    const result = await new ActiveCampaignApiAdapter(
      request,
    ).listRecentCampaigns(credentials);
    const url = new URL(
      (request.mock.calls[0] as unknown as [string, RequestInit])[0],
    );
    expect(url.searchParams.get("orders[sdate]")).toBe("DESC");
    expect(result.campaigns[0]).toEqual({
      campaignId: "9",
      type: "single",
      status: "5",
      createdAt: "2026-07-10T08:00:00Z",
      modifiedAt: "2026-07-10T09:00:00Z",
      scheduledAt: "2026-07-11T08:30:00Z",
      lastSentAt: "2026-07-11T09:00:00Z",
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("opens");
  });

  it("rejects arbitrary or path-bearing origins before network access", async () => {
    const request = jest.fn();
    const adapter = new ActiveCampaignApiAdapter(request);
    await expect(
      adapter.health({ ...credentials, apiUrl: "https://example.com" }),
    ).rejects.toMatchObject({ code: "activecampaign_api_origin_invalid" });
    await expect(
      adapter.health({
        ...credentials,
        apiUrl: "https://relay-demo.api-us1.com/api/3",
      }),
    ).rejects.toMatchObject({ code: "activecampaign_api_origin_invalid" });
    expect(request).not.toHaveBeenCalled();
  });
});
