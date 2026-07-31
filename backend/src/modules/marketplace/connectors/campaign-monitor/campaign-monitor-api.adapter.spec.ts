import { CampaignMonitorApiAdapter } from "./campaign-monitor-api.adapter";

const clientId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const campaignId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const credentials = {
  accessToken: "private-campaign-monitor-token",
  clientId,
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CampaignMonitorApiAdapter", () => {
  it("revalidates and returns only the exact visible Client", async () => {
    const request = jest.fn(async () =>
      response([
        { ClientID: clientId, Name: "Relay Client", Private: "private" },
        {
          ClientID: "cccccccccccccccccccccccccccccccc",
          Name: "Other Client",
        },
      ]),
    );
    const result = await new CampaignMonitorApiAdapter(request).getClient(
      credentials,
    );
    const [url, init] = request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.createsend.com/api/v3.3/clients.json");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer private-campaign-monitor-token",
    });
    expect(result).toEqual({
      client: { clientId, name: "Relay Client" },
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("Other Client");
  });

  it("lists one fixed page of sparse sent Campaign lifecycle metadata", async () => {
    const request = jest.fn(async () =>
      response({
        Results: [
          {
            CampaignID: campaignId,
            SentDate: "2026-07-11 09:00:00",
            Name: "private name",
            Subject: "private subject",
            FromName: "private sender",
            FromEmail: "private@example.com",
            ReplyTo: "private@example.com",
            WebVersionURL: "https://private.example",
            TotalRecipients: 1000,
            Tags: ["private-tag"],
          },
        ],
      }),
    );
    const result = await new CampaignMonitorApiAdapter(
      request,
    ).listRecentSentCampaigns(credentials);
    const [url] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      `https://api.createsend.com/api/v3.3/clients/${clientId}/campaigns.json?page=1&pagesize=20&orderdirection=desc`,
    );
    expect(result.campaigns).toEqual([
      { campaignId, sentDate: "2026-07-11 09:00:00" },
    ]);
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("1000");
  });

  it("verifies bounded Client membership before returning aggregate counts", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(response([{ CampaignID: campaignId }]))
      .mockResolvedValueOnce(
        response({
          Name: "private campaign name",
          Recipients: 1000,
          TotalOpened: 345,
          UniqueOpened: 298,
          Clicks: 132,
          Unsubscribed: 43,
          Bounced: 15,
          SpamComplaints: 23,
          WebVersionURL: "https://private.example",
          Forwards: 18,
          Likes: 25,
          Mentions: 11,
        }),
      );
    const result = await new CampaignMonitorApiAdapter(
      request,
    ).getCampaignSummary(credentials, { campaignId: campaignId.toUpperCase() });
    expect(request).toHaveBeenCalledTimes(2);
    const [summaryUrl] = request.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(summaryUrl).toBe(
      `https://api.createsend.com/api/v3.3/campaigns/${campaignId}/summary.json`,
    );
    expect(result.summary).toEqual({
      recipients: 1000,
      totalOpened: 345,
      uniqueOpened: 298,
      clicks: 132,
      unsubscribed: 43,
      bounced: 15,
      spamComplaints: 23,
      forwards: 18,
      likes: 25,
      mentions: 11,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects invalid IDs and Campaigns outside the bounded Client list", async () => {
    const request = jest.fn(async () => response([]));
    const adapter = new CampaignMonitorApiAdapter(request);
    await expect(
      adapter.health({ ...credentials, clientId: "../unsafe" }),
    ).rejects.toMatchObject({ code: "campaign_monitor_client_id_invalid" });
    await expect(
      adapter.getCampaignSummary(credentials, {
        campaignId: "cccccccccccccccccccccccccccccccc",
      }),
    ).rejects.toMatchObject({ code: "campaign_monitor_campaign_not_bound" });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
