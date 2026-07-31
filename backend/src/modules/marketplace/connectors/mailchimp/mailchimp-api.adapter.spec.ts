import { MailchimpApiAdapter } from "./mailchimp-api.adapter";

const credentials = {
  accessToken: "private-mailchimp-access-token",
  apiOrigin: "https://us21.api.mailchimp.com",
  accountId: "0123456789abcdef0123456789abcdef",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("MailchimpApiAdapter", () => {
  it("validates the exact metadata-derived account binding", async () => {
    const request = jest.fn(async () =>
      response({
        account_id: credentials.accountId,
        account_name: "Relay Marketing",
        role: "admin",
        member_since: "2024-01-01T00:00:00Z",
      }),
    );
    const result = await new MailchimpApiAdapter(request).health(credentials);
    expect((request.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
      "https://us21.api.mailchimp.com/3.0/?fields=account_id%2Caccount_name%2Crole%2Cmember_since",
    );
    expect(result).toMatchObject({
      accountId: credentials.accountId,
      role: "admin",
      reachable: true,
    });
  });

  it("lists one fixed page of audience aggregates without contact data", async () => {
    const request = jest.fn(async () =>
      response({
        lists: [
          {
            id: "list_1",
            name: "Product updates",
            date_created: "2026-07-01T09:00:00Z",
            contact: { address1: "private address" },
            campaign_defaults: { from_email: "private@example.com" },
            stats: {
              member_count: 250,
              unsubscribe_count: 4,
              open_rate: 98,
            },
          },
        ],
      }),
    );
    const result = await new MailchimpApiAdapter(request).listAudiences(
      credentials,
    );
    const url = new URL(
      (request.mock.calls[0] as unknown as [string, RequestInit])[0],
    );
    expect(url.origin + url.pathname).toBe(
      "https://us21.api.mailchimp.com/3.0/lists",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      count: "25",
      offset: "0",
      sort_field: "date_created",
      sort_dir: "DESC",
      fields:
        "lists.id,lists.name,lists.date_created,lists.stats.member_count,lists.stats.unsubscribe_count",
    });
    expect(result.audiences[0]).toEqual({
      audienceId: "list_1",
      name: "Product updates",
      createdAt: "2026-07-01T09:00:00Z",
      memberCount: 250,
      unsubscribeCount: 4,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("lists sent campaign lifecycle metadata without content or recipients", async () => {
    const request = jest.fn(async () =>
      response({
        campaigns: [
          {
            id: "campaign_1",
            type: "regular",
            status: "sent",
            create_time: "2026-07-10T08:00:00Z",
            send_time: "2026-07-11T09:00:00Z",
            settings: { subject_line: "private subject" },
            recipients: { list_name: "private audience" },
          },
        ],
      }),
    );
    const result = await new MailchimpApiAdapter(
      request,
    ).listRecentSentCampaigns(credentials);
    const url = new URL(
      (request.mock.calls[0] as unknown as [string, RequestInit])[0],
    );
    expect(url.searchParams.get("status")).toBe("sent");
    expect(url.searchParams.get("count")).toBe("25");
    expect(result.campaigns[0]).toEqual({
      campaignId: "campaign_1",
      type: "regular",
      status: "sent",
      createdAt: "2026-07-10T08:00:00Z",
      sentAt: "2026-07-11T09:00:00Z",
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects non-provider origins and changed account bindings", async () => {
    const request = jest.fn(async () =>
      response({ account_id: "fedcba9876543210fedcba9876543210" }),
    );
    const adapter = new MailchimpApiAdapter(request);
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://example.com" }),
    ).rejects.toMatchObject({ code: "mailchimp_api_origin_invalid" });
    await expect(adapter.getAccount(credentials)).rejects.toMatchObject({
      code: "mailchimp_account_binding_mismatch",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
