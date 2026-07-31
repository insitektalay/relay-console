import { ConstantContactApiAdapter } from "./constant-contact-api.adapter";

const credentials = {
  accessToken: "private-cc-token",
  accountId: "p07e1l8cdif9dl",
};
function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ConstantContactApiAdapter", () => {
  it("revalidates the exact Account while excluding contact fields", async () => {
    const request = jest.fn(async () =>
      response({
        encoded_account_id: "p07e1l8cdif9dl",
        organization_name: "Relay News",
        contact_email: "private@example.com",
        contact_phone: "private",
        first_name: "private",
        physical_address: { city: "private" },
        website: "https://private.example",
      }),
    );
    const result = await new ConstantContactApiAdapter(request).getAccount(
      credentials,
    );
    const [url] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cc.email/v3/account/summary");
    expect(result.account).toEqual({
      accountId: "p07e1l8cdif9dl",
      organizationName: "Relay News",
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("lists fixed-page Campaign lifecycle fields without content", async () => {
    const request = jest.fn(async () =>
      response({
        campaigns: [
          {
            campaign_id: "8987dc1a-48ef-433a-b836-7ca4f9aa3481",
            type: "NEWSLETTER",
            current_status: "Done",
            created_at: "2026-07-01T09:00:00Z",
            updated_at: "2026-07-10T09:00:00Z",
            name: "private",
            subject: "private",
            campaign_activities: ["private"],
          },
        ],
        _links: { next: "private" },
      }),
    );
    const result = await new ConstantContactApiAdapter(
      request,
    ).listRecentCampaigns(credentials);
    const [url] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cc.email/v3/emails?limit=25");
    expect(result.campaigns[0]).toEqual({
      campaignId: "8987dc1a-48ef-433a-b836-7ca4f9aa3481",
      type: "NEWSLETTER",
      currentStatus: "Done",
      createdAt: "2026-07-01T09:00:00Z",
      updatedAt: "2026-07-10T09:00:00Z",
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("lists fixed-page aggregate report counts without drilldowns", async () => {
    const request = jest.fn(async () =>
      response({
        bulk_email_campaign_summaries: [
          {
            campaign_id: "8987dc1a-48ef-433a-b836-7ca4f9aa3481",
            campaign_type: "Newsletter",
            last_sent_date: "2026-07-10T09:00:00Z",
            unique_counts: {
              sends: 1000,
              opens: 500,
              clicks: 120,
              forwards: 4,
              optouts: 3,
              abuse: 0,
              bounces: 20,
              not_opened: 480,
            },
            private_contacts: ["private"],
          },
        ],
        aggregate_percents: {
          click: 12,
          open: 50,
          did_not_open: 48,
          bounce: 2,
          unsubscribe: 0.3,
        },
        _links: { next: "private" },
      }),
    );
    const result = await new ConstantContactApiAdapter(
      request,
    ).listRecentCampaignSummaries(credentials);
    const [url] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://api.cc.email/v3/reports/summary_reports/email_campaign_summaries?limit=25",
    );
    expect(result.summaries[0].uniqueCounts).toEqual({
      sends: 1000,
      opens: 500,
      clicks: 120,
      forwards: 4,
      optouts: 3,
      abuse: 0,
      bounces: 20,
      notOpened: 480,
    });
    expect(result.aggregatePercents).toEqual({
      click: 12,
      open: 50,
      didNotOpen: 48,
      bounce: 2,
      unsubscribe: 0.3,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("rejects invalid and changed Account bindings", async () => {
    const request = jest.fn(async () =>
      response({ encoded_account_id: "different_account" }),
    );
    const adapter = new ConstantContactApiAdapter(request);
    await expect(
      adapter.health({ ...credentials, accountId: "../unsafe" }),
    ).rejects.toMatchObject({
      code: "constant_contact_account_binding_invalid",
    });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "constant_contact_account_binding_mismatch",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
