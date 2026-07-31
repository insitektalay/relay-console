import { BrazeApiAdapter } from "./braze-api.adapter";

const credentials = {
  restEndpoint: "https://rest.fra-02.braze.eu",
  restApiKey: "private-braze-rest-key",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("BrazeApiAdapter", () => {
  it("validates the exact regional endpoint and all three read permissions", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(response({ message: "success", campaigns: [] }))
      .mockResolvedValueOnce(response({ message: "success", canvases: [] }));
    const result = await new BrazeApiAdapter(request).health(credentials);
    expect(request).toHaveBeenNthCalledWith(
      1,
      "https://rest.fra-02.braze.eu/campaigns/list?page=0&include_archived=false&sort_direction=desc",
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer private-braze-rest-key",
        },
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      restEndpoint: "https://rest.fra-02.braze.eu",
      permissions: ["campaigns.list", "campaigns.data_series", "canvas.list"],
      reachable: true,
    });
  });

  it("lists fixed newest pages while redacting names and tags", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          campaigns: [
            {
              id: "campaign-1",
              last_edited: "2026-07-01T10:00:00Z",
              name: "Private",
              tags: ["private"],
              is_api_campaign: false,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          canvases: [
            {
              id: "canvas-1",
              last_edited: "2026-07-02T10:00:00Z",
              name: "Private Canvas",
              tags: ["private"],
            },
          ],
        }),
      );
    const adapter = new BrazeApiAdapter(request);
    const campaigns = await adapter.listCampaigns(credentials);
    const canvases = await adapter.listCanvases(credentials);
    expect(campaigns.campaigns[0]).toEqual({
      campaignId: "campaign-1",
      lastEditedAt: "2026-07-01T10:00:00Z",
      isApiCampaign: false,
    });
    expect(canvases.canvases[0]).toEqual({
      canvasId: "canvas-1",
      lastEditedAt: "2026-07-02T10:00:00Z",
    });
    expect(JSON.stringify({ campaigns, canvases })).not.toContain("Private");
    expect(JSON.stringify({ campaigns, canvases })).not.toContain("tags");
  });

  it("returns a fixed seven-day aggregate series only for a Campaign in the bounded list", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(response({ campaigns: [{ id: "campaign-1" }] }))
      .mockResolvedValueOnce(
        response({
          data: [
            {
              time: "2026-07-10",
              unique_recipients: 100,
              conversions: 9,
              conversions_by_send_time: 8,
              revenue: 123.45,
              messages: {
                email: [
                  {
                    variation_api_id: "private-variation",
                    sent: 100,
                    opens: 50,
                  },
                ],
              },
            },
          ],
        }),
      );
    const result = await new BrazeApiAdapter(request).getCampaignAnalytics(
      credentials,
      { campaignId: "campaign-1", endingAt: "2026-07-10T23:59:59Z" },
    );
    const analyticsUrl = new URL(
      (request.mock.calls[1] as unknown as [string, RequestInit])[0],
    );
    expect(Object.fromEntries(analyticsUrl.searchParams)).toEqual({
      campaign_id: "campaign-1",
      length: "7",
      ending_at: "2026-07-10T23:59:59Z",
    });
    expect(result.daily[0]).toEqual({
      date: "2026-07-10",
      uniqueRecipients: 100,
      conversions: 9,
      conversionsBySendTime: 8,
      revenueUsd: 123.45,
    });
    expect(JSON.stringify(result)).not.toContain("private-variation");
    expect(JSON.stringify(result)).not.toContain("messages");
  });

  it("rejects unknown hosts and unbound Campaign identifiers", async () => {
    const request = jest.fn(async () => response({ campaigns: [] }));
    const adapter = new BrazeApiAdapter(request);
    await expect(
      adapter.listCampaigns({
        ...credentials,
        restEndpoint: "https://example.com",
      }),
    ).rejects.toMatchObject({ code: "braze_rest_endpoint_invalid" });
    await expect(
      adapter.getCampaignAnalytics(credentials, {
        campaignId: "campaign-1",
        endingAt: "2026-07-10T23:59:59Z",
      }),
    ).rejects.toMatchObject({ code: "braze_campaign_not_bound" });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
