import {
  ZohoCampaignsApiAdapter,
  ZohoCampaignsApiError,
  type ZohoCampaignsCredentials,
} from "./zoho-campaigns-api.adapter";
import { ZOHO_CAMPAIGNS_CONNECTOR_MANIFEST } from "./zoho-campaigns.connector";

const credentials: ZohoCampaignsCredentials = {
  accessToken: "access-token",
  apiOrigin: "https://campaigns.zoho.eu",
  accountsOrigin: "https://accounts.zoho.eu",
  userId: "1000000000001",
};

describe("Zoho Campaigns connector", () => {
  it("publishes only two approval-gated campaign reads", () => {
    expect(
      ZOHO_CAMPAIGNS_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes,
    ).toEqual(["AaaServer.profile.Read", "ZohoCampaigns.campaign.READ"]);
    expect(
      ZOHO_CAMPAIGNS_CONNECTOR_MANIFEST.tools.map((tool) => tool.functionName),
    ).toEqual([
      "zoho_campaigns_campaign_list",
      "zoho_campaigns_campaign_report",
    ]);
    expect(
      ZOHO_CAMPAIGNS_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("lists one bounded first page without preview or recipient fields", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(String(url)).toBe(
        "https://campaigns.zoho.eu/api/v1.1/recentcampaigns?resfmt=JSON&sort=desc&fromindex=1&range=2&status=sent",
      );
      return new Response(
        JSON.stringify({
          status: "success",
          code: "0",
          recent_campaigns: [
            {
              campaign_key: "abc123",
              campaign_name: "Launch",
              campaign_status: "Sent",
              created_time: "123",
              campaign_preview: "private",
              contacts: [{ email: "private@example.com" }],
            },
          ],
        }),
        { status: 200 },
      );
    });
    const result = await new ZohoCampaignsApiAdapter(requester).listCampaigns(
      credentials,
      { status: "sent", limit: 2 },
    );
    expect(result).toEqual({
      status: "sent",
      campaigns: [
        {
          campaignKey: "abc123",
          name: "Launch",
          status: "Sent",
          createdAt: "123",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("projects only aggregate report metrics", async () => {
    const requester = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "success",
            code: "0",
            "campaign-reports": [
              {
                emails_sent_count: "10",
                delivered_count: "9",
                opens_count: "4",
                unique_clicks_count: "2",
                bounces_count: "1",
                unsub_count: "0",
                complaints_count: "0",
                delivered_percent: "90.0",
                open_percent: "44.4",
                unique_clicked_percent: "22.2",
                email_from: "private@example.com",
              },
            ],
            "campaign-details": [{ email_subject: "secret" }],
            "campaign-by-loaction": "private",
          }),
          { status: 200 },
        ),
    );
    const result = await new ZohoCampaignsApiAdapter(requester).campaignReport(
      credentials,
      { campaignKey: "abc123" },
    );
    expect(result.metrics).toMatchObject({
      emailsSent: 10,
      delivered: 9,
      opens: 4,
      uniqueClicks: 2,
      openPercent: 44.4,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("binds the current user and verifies campaign scope", async () => {
    const requester = jest.fn(async (url: string | URL) =>
      String(url).includes("/oauth/user/info")
        ? new Response(
            JSON.stringify({
              ZUID: "1000000000001",
              Display_Name: "Ada",
              Email: "ada@example.com",
            }),
            { status: 200 },
          )
        : new Response(
            JSON.stringify({
              status: "success",
              code: "0",
              recent_campaigns: [],
            }),
            { status: 200 },
          ),
    );
    await expect(
      new ZohoCampaignsApiAdapter(requester).health(credentials),
    ).resolves.toMatchObject({
      userId: "1000000000001",
      apiOrigin: "https://campaigns.zoho.eu",
    });
    expect(requester).toHaveBeenCalledTimes(2);
  });

  it("rejects unsafe keys, regions, statuses, and oversized responses", async () => {
    const adapter = new ZohoCampaignsApiAdapter(
      async () =>
        new Response("{}", {
          status: 200,
          headers: { "content-length": "1000001" },
        }),
    );
    await expect(
      adapter.campaignReport(credentials, { campaignKey: "../contacts" }),
    ).rejects.toBeInstanceOf(ZohoCampaignsApiError);
    await expect(
      adapter.listCampaigns(
        { ...credentials, apiOrigin: "https://attacker.example" },
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listCampaigns(credentials, { status: "recipients" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.listCampaigns(credentials, {})).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
