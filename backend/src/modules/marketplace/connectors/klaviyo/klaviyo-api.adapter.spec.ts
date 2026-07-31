import { KLAVIYO_API_REVISION } from "./klaviyo.connector";
import { KlaviyoApiAdapter } from "./klaviyo-api.adapter";

const credentials = {
  accessToken: "private-klaviyo-access-token",
  accountId: "AbC123",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/vnd.api+json" },
  });
}

describe("KlaviyoApiAdapter", () => {
  it("validates one exact Account at the pinned revision", async () => {
    const request = jest.fn(async () =>
      response({
        data: [
          {
            type: "account",
            id: "AbC123",
            attributes: {
              name: "Relay Commerce",
              timezone: "Europe/London",
              currency: "GBP",
              contact_information: { email: "private@example.com" },
            },
          },
        ],
      }),
    );
    const result = await new KlaviyoApiAdapter(request).health(credentials);
    const [url, init] = request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://a.klaviyo.com/api/accounts?fields%5Baccount%5D=name%2Ctimezone%2Ccurrency",
    );
    expect(init.headers).toMatchObject({ revision: KLAVIYO_API_REVISION });
    expect(result).toMatchObject({ accountId: "AbC123", reachable: true });
  });

  it("lists one fixed page of sparse List lifecycle metadata", async () => {
    const request = jest.fn(async () =>
      response({
        data: [
          {
            type: "list",
            id: "XyZ123",
            attributes: {
              name: "Product updates",
              created: "2025-01-01T00:00:00Z",
              updated: "2026-07-11T09:00:00Z",
              opt_in_process: "double_opt_in",
              profile_count: 1000,
            },
            relationships: { profiles: { data: ["private-profile"] } },
          },
        ],
      }),
    );
    const result = await new KlaviyoApiAdapter(request).listRecentLists(
      credentials,
    );
    const url = new URL(
      (request.mock.calls[0] as unknown as [string, RequestInit])[0],
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      "page[size]": "10",
      sort: "-updated",
      "fields[list]": "name,created,updated,opt_in_process",
    });
    expect(result.lists[0]).toEqual({
      listId: "XyZ123",
      name: "Product updates",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2026-07-11T09:00:00Z",
      optInProcess: "double_opt_in",
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("profile_count");
  });

  it("lists email Campaign lifecycle metadata without names or content", async () => {
    const request = jest.fn(async () =>
      response({
        data: [
          {
            type: "campaign",
            id: "01H5QQV9F57XJHJDMD86RX4QM5",
            attributes: {
              name: "private campaign name",
              status: "Sent",
              archived: false,
              created_at: "2026-07-10T08:00:00Z",
              scheduled_at: "2026-07-11T08:30:00Z",
              updated_at: "2026-07-11T09:00:00Z",
              messages: [{ content: "private content" }],
            },
          },
        ],
      }),
    );
    const result = await new KlaviyoApiAdapter(
      request,
    ).listRecentEmailCampaigns(credentials);
    const url = new URL(
      (request.mock.calls[0] as unknown as [string, RequestInit])[0],
    );
    expect(url.searchParams.get("filter")).toBe(
      "equals(messages.channel,'email')",
    );
    expect(url.searchParams.get("page[size]")).toBe("25");
    expect(result.campaigns[0]).toEqual({
      campaignId: "01H5QQV9F57XJHJDMD86RX4QM5",
      status: "Sent",
      archived: false,
      createdAt: "2026-07-10T08:00:00Z",
      scheduledAt: "2026-07-11T08:30:00Z",
      updatedAt: "2026-07-11T09:00:00Z",
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects changed or invalid Account bindings", async () => {
    const request = jest.fn(async () =>
      response({ data: [{ id: "Other1", attributes: {} }] }),
    );
    const adapter = new KlaviyoApiAdapter(request);
    await expect(
      adapter.health({ ...credentials, accountId: "../unsafe" }),
    ).rejects.toMatchObject({ code: "klaviyo_account_binding_invalid" });
    await expect(adapter.getAccount(credentials)).rejects.toMatchObject({
      code: "klaviyo_account_binding_mismatch",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
