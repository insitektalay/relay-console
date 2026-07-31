import { PostHogApiAdapter } from "./posthog-api.adapter";

const credentials = {
  apiOrigin: "https://eu.posthog.com",
  organizationId: "org_uuid-1",
  projectId: "12345",
  accessToken: "oauth-access-token-example",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("PostHogApiAdapter", () => {
  it("binds the OAuth grant to the exact Cloud region, Organization, and Project", async () => {
    const request = jest.fn(async () =>
      response({
        id: 12345,
        name: "Product Analytics",
        api_token: "must-not-return",
        secret_token: "must-not-return",
      }),
    );
    const result = await new PostHogApiAdapter(request).health(credentials);
    const [url, init] = request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://eu.posthog.com/api/organizations/org_uuid-1/projects/12345/",
    );
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${credentials.accessToken}`,
    });
    expect(result).toEqual({
      apiOrigin: "https://eu.posthog.com",
      organizationId: "org_uuid-1",
      projectId: "12345",
      projectName: "Product Analytics",
      reachable: true,
    });
    expect(JSON.stringify(result)).not.toContain("must-not-return");
  });

  it("returns bounded dashboard and insight summaries without query results or filters", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          results: [
            {
              id: 7,
              name: "Activation",
              description: "Team view",
              tiles: [{ insight: { result: [{ person: "private" }] } }],
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-02T00:00:00Z",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          results: [
            {
              id: 9,
              short_id: "abc",
              name: "Signups",
              description: "Daily",
              query: { kind: "TrendsQuery", series: [{ event: "private" }] },
              result: [{ person: "private" }],
            },
          ],
        }),
      );
    const adapter = new PostHogApiAdapter(request);

    const dashboards = await adapter.listDashboards(credentials, {
      search: "activation",
    });
    const insights = await adapter.listInsights(credentials, {});
    expect(dashboards).toEqual({
      projectId: "12345",
      dashboards: [
        {
          id: "7",
          name: "Activation",
          description: "Team view",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
          tileCount: 1,
        },
      ],
    });
    expect(insights.insights[0]).toEqual(
      expect.objectContaining({
        id: "9",
        shortId: "abc",
        name: "Signups",
        queryKind: "TrendsQuery",
      }),
    );
    expect(JSON.stringify({ dashboards, insights })).not.toContain("private");
  });

  it("runs only one fixed daily TrendsQuery and strips provider detail", async () => {
    const request = jest.fn(async () =>
      response({
        results: [
          {
            days: ["2026-06-01", "2026-06-02"],
            labels: ["1-Jun-2026", "2-Jun-2026"],
            data: [10, 12],
            persons: [{ email: "private@example.com" }],
          },
        ],
      }),
    );
    const adapter = new PostHogApiAdapter(request);

    const result = await adapter.runBoundedTrend(credentials, {
      event: "user_signed_up",
      fromDate: "2026-06-01",
      toDate: "2026-06-02",
    });
    expect(result).toEqual({
      projectId: "12345",
      event: "user_signed_up",
      fromDate: "2026-06-01",
      toDate: "2026-06-02",
      dates: ["2026-06-01", "2026-06-02"],
      labels: ["1-Jun-2026", "2-Jun-2026"],
      values: [10, 12],
    });
    const init = (request.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(init.body))).toEqual({
      query: {
        kind: "TrendsQuery",
        dateRange: {
          date_from: "2026-06-01",
          date_to: "2026-06-02",
        },
        interval: "day",
        series: [
          { kind: "EventsNode", event: "user_signed_up", math: "total" },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("returns redacted schema summaries and rejects unsafe boundaries", async () => {
    const request = jest.fn(async () =>
      response({
        results: [
          {
            id: "event-1",
            name: "checkout_completed",
            description: "Checkout",
            last_seen_at: "2026-07-01T00:00:00Z",
            volume_30_day: 42,
            tags: [{ name: "private" }],
          },
        ],
      }),
    );
    const adapter = new PostHogApiAdapter(request);
    await expect(
      adapter.readSchema(credentials, { kind: "event" }),
    ).resolves.toEqual({
      projectId: "12345",
      kind: "event",
      definitions: [
        {
          id: "event-1",
          name: "checkout_completed",
          description: "Checkout",
          propertyType: null,
          lastSeenAt: "2026-07-01T00:00:00Z",
          volume30Day: 42,
        },
      ],
    });
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://example.com" }),
    ).rejects.toMatchObject({ code: "posthog_api_origin_invalid" });
    await expect(
      adapter.runBoundedTrend(credentials, {
        event: "signup",
        fromDate: "2026-01-01",
        toDate: "2026-02-01",
      }),
    ).rejects.toMatchObject({ code: "posthog_date_range_invalid" });
  });
});
