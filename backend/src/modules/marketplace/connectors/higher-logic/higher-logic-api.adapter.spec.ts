import {
  HigherLogicApiAdapter,
  type HigherLogicCredentials,
} from "./higher-logic-api.adapter";

const credentials: HigherLogicCredentials = {
  region: "us",
  contactKey: "contact-123",
  iamKey: "iam-test-key",
  apiPassword: "api-test-password",
};
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

describe("HigherLogicApiAdapter", () => {
  it("binds fixed regional IAM headers to one exact contact", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const adapter = new HigherLogicApiAdapter(async (url, init) => {
      requests.push({ url, init });
      return json({
        ContactKey: "contact-123",
        DisplayName: "Relay Operator",
        MemberStatus: "Member",
        IsAdmin: false,
        PrimaryEmail: "private@example.com",
        SecurityGroups: [{ Name: "private" }],
        PhoneNumber: "private-phone",
      });
    });

    const result = await adapter.getCurrentContact(credentials);
    expect(result.contact).toEqual({
      id: "contact-123",
      displayName: "Relay Operator",
      memberStatus: "Member",
      contactStatusCode: null,
      administrator: false,
    });
    const url = new URL(requests[0].url);
    expect(url.origin).toBe("https://api.higherlogic.com");
    expect(url.pathname).toBe("/api/v2.0/Contacts/GetWhoAmI");
    expect(url.searchParams.get("includeSecurityGroups")).toBe("false");
    const headers = new Headers(requests[0].init.headers);
    expect(headers.get("hliamkey")).toBe("iam-test-key");
    expect(headers.get("hlpassword")).toBe("api-test-password");
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("rejects a different authenticated contact", async () => {
    const adapter = new HigherLogicApiAdapter(async () =>
      json({ ContactKey: "different-contact" }),
    );
    await expect(adapter.getCurrentContact(credentials)).rejects.toMatchObject({
      code: "policy_blocked",
      statusCode: 403,
    });
  });

  it("reduces joined, viewable, and contributable Community records", async () => {
    const requests: string[] = [];
    const adapter = new HigherLogicApiAdapter(async (url) => {
      requests.push(url);
      return json({
        Communities: [
          {
            CommunityKey: "community-1",
            CommunityName: "Product Community",
            CommunityType: "Discussion",
            MemberCount: 100,
            DiscussionCount: 4,
            IsMember: true,
            CanContribute: true,
            Description: "private Community description",
            CommunityUrl: "https://private.example/community",
            Members: [{ PrimaryEmail: "private@example.com" }],
          },
          { CommunityKey: "community-2", CommunityName: "Support" },
        ],
      });
    });

    const mine = await adapter.listMyCommunities(credentials, {
      maxResults: 1,
    });
    const viewable = await adapter.listViewableCommunities(credentials, {
      maxResults: 1,
    });
    const contributable = await adapter.listContributableCommunities(
      credentials,
      { maxResults: 1 },
    );
    expect(mine).toEqual(
      expect.objectContaining({ returned: 1, truncated: true }),
    );
    expect(mine.items[0]).toEqual({
      id: "community-1",
      name: "Product Community",
      type: "Discussion",
      memberCount: 100,
      discussionCount: 4,
      joined: true,
      canContribute: true,
    });
    expect(JSON.stringify({ mine, viewable, contributable })).not.toContain(
      "private@example.com",
    );
    expect(requests.map((url) => new URL(url).pathname)).toEqual([
      "/api/v2.0/Communities/GetMyCommunities",
      "/api/v2.0/Communities/GetViewableCommunities",
      "/api/v2.0/Communities/GetCommunitiesCanContribute",
    ]);
  });

  it("reduces eligible Discussions without posts, bodies, authors, or URLs", async () => {
    const adapter = new HigherLogicApiAdapter(async () =>
      json([
        {
          DiscussionKey: "discussion-1",
          DiscussionName: "Product updates",
          CommunityKey: "community-1",
          IsSubscribed: true,
          IsActive: true,
          LatestPost: {
            Body: "private post",
            AuthorEmail: "private@example.com",
          },
          DiscussionUrl: "https://private.example/discussion",
        },
      ]),
    );

    const result = await adapter.listEligibleDiscussions(credentials, {
      maxResults: 5,
    });
    expect(result.items[0]).toEqual({
      id: "discussion-1",
      name: "Product updates",
      communityId: "community-1",
      subscribed: true,
      active: true,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("uses provider bounds and reduces upcoming Event records", async () => {
    const requests: string[] = [];
    const adapter = new HigherLogicApiAdapter(async (url) => {
      requests.push(url);
      return json({
        Events: [
          {
            EventKey: "event-1",
            EventName: "Annual meeting",
            EventTypeName: "Conference",
            StartDateTime: "2026-08-01T09:00:00Z",
            EndDateTime: "2026-08-01T17:00:00Z",
            IsAllDay: false,
            CommunityKey: "community-1",
            Description: "private event details",
            Registrants: [{ Email: "private@example.com" }],
            RegistrationUrl: "https://private.example/register",
          },
        ],
      });
    });

    const result = await adapter.listUpcomingEvents(credentials, {
      maxResults: 7,
    });
    expect(result.items[0]).toEqual({
      id: "event-1",
      name: "Annual meeting",
      eventType: "Conference",
      startsAt: "2026-08-01T09:00:00Z",
      endsAt: "2026-08-01T17:00:00Z",
      allDay: false,
      communityId: "community-1",
    });
    expect(new URL(requests[0]).searchParams.get("maxRecords")).toBe("7");
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("rejects alternate regions and invalid bounds before network access", async () => {
    const request = jest.fn();
    const adapter = new HigherLogicApiAdapter(request);
    await expect(
      adapter.getCurrentContact({ ...credentials, region: "eu" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getCurrentContact({ ...credentials, contactKey: "../admin" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.listUpcomingEvents(credentials, { maxResults: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps provider denial and quotas without returning provider bodies", async () => {
    const denied = new HigherLogicApiAdapter(async () =>
      json({ Message: "sensitive provider explanation" }, 403),
    );
    await expect(denied.getCurrentContact(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
      statusCode: 403,
      message: "Higher Logic API request failed.",
    });

    const limited = new HigherLogicApiAdapter(async () =>
      json({}, 429, { "Retry-After": "30" }),
    );
    await expect(limited.getCurrentContact(credentials)).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
      details: { retryAfter: "30" },
    });
  });
});
