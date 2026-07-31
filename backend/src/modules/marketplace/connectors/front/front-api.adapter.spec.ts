import { FRONT_CONNECTOR_MANIFEST } from "./front.connector";
import { FrontApiAdapter, FrontApiError } from "./front-api.adapter";

describe("Front connector", () => {
  const credentials = { accessToken: "front-token", companyId: "cmp_k30" };

  it("declares bounded reads plus approval-gated full Core API access", () => {
    expect(FRONT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "front.listConversations",
      "front.getConversation",
      "front.request",
    ]);
    expect(
      FRONT_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["front_safe", "dangerously_skip_permissions"]);
    expect(FRONT_CONNECTOR_MANIFEST.auth.oauth?.authorizationUrl).toBe(
      "https://app.frontapp.com/oauth/authorize",
    );
  });

  it("binds health to the exact Front company", async () => {
    const requester = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "cmp_k30", name: "Dunder Mifflin" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await new FrontApiAdapter(requester).health(credentials);
    expect(result).toEqual({
      companyId: "cmp_k30",
      companyName: "Dunder Mifflin",
    });
    expect(requester.mock.calls[0][0].toString()).toBe(
      "https://api2.frontapp.com/me",
    );
  });

  it("returns only allowlisted conversation metadata from a bounded first page", async () => {
    const requester = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          _results: [
            {
              id: "cnv_55c8c149",
              subject: "Shipping question",
              status: "assigned",
              status_id: "sts_5x",
              status_category: "open",
              ticket_ids: ["TICKET-1"],
              is_private: false,
              created_at: 1453770984.123,
              recipient: { handle: "private@example.com" },
              assignee: { email: "agent@example.com" },
              tags: [{ name: "sensitive" }],
            },
          ],
          _pagination: {
            next: "https://acme.api.frontapp.com/conversations?page_token=x",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const result = await new FrontApiAdapter(requester).listConversations(
      credentials,
      { limit: 1 },
    );
    expect(result).toEqual({
      conversations: [
        {
          conversationId: "cnv_55c8c149",
          subject: "Shipping question",
          status: "assigned",
          statusId: "sts_5x",
          statusCategory: "open",
          ticketIds: ["TICKET-1"],
          isPrivate: false,
          createdAt: "2016-01-26T01:16:24.123Z",
          waitingSince: null,
        },
      ],
      hasMore: true,
    });
    expect(requester.mock.calls[0][0].toString()).toBe(
      "https://api2.frontapp.com/conversations?limit=1&sort_by=date&sort_order=desc",
    );
  });

  it("rejects traversal, absolute URLs, and credential-bearing request fields", async () => {
    const adapter = new FrontApiAdapter(jest.fn());
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "/../oauth/token",
      }),
    ).rejects.toMatchObject<Partial<FrontApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/conversations",
        json: { authorization: "secret" },
      }),
    ).rejects.toMatchObject<Partial<FrontApiError>>({ code: "policy_blocked" });
  });

  it("rejects a changed company during health validation", async () => {
    const requester = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "cmp_other", name: "Other" }), {
        status: 200,
      }),
    );
    await expect(
      new FrontApiAdapter(requester).health(credentials),
    ).rejects.toMatchObject<Partial<FrontApiError>>({
      code: "insufficient_scope",
      statusCode: 403,
    });
  });
});
