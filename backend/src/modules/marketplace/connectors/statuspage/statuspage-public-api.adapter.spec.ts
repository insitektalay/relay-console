import {
  StatuspagePublicApiAdapter,
  StatuspagePublicApiError,
} from "./statuspage-public-api.adapter";

describe("StatuspagePublicApiAdapter", () => {
  it("uses only the exact page-id Status API origin and strips incident bodies", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify({
            page: {
              id: "abc123def456",
              name: "Example",
              url: "https://status.example.com",
            },
            status: { indicator: "minor", description: "Minor outage" },
            components: [
              { id: "component1", name: "API", status: "degraded_performance" },
            ],
            incidents: [
              {
                id: "incident1",
                name: "API latency",
                status: "monitoring",
                incident_updates: [
                  {
                    id: "update1",
                    status: "monitoring",
                    body: "private-looking detail",
                  },
                ],
              },
            ],
            scheduled_maintenances: [],
          }),
          { status: 200 },
        ),
    );
    const adapter = new StatuspagePublicApiAdapter(requester);

    const result = await adapter.readSummary({ pageId: "abc123def456" });

    expect(requester).toHaveBeenCalledWith(
      "https://abc123def456.statuspage.io/api/v2/summary.json",
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
    expect(result.incidents[0]).toEqual(
      expect.objectContaining({
        name: "API latency",
        updates: [expect.objectContaining({ status: "monitoring" })],
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private-looking detail");
  });

  it("pins incident filters and caps returned rows", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify({
            incidents: Array.from({ length: 30 }, (_, index) => ({
              id: `incident${index}`,
              name: `Incident ${index}`,
            })),
          }),
          { status: 200 },
        ),
    );
    const adapter = new StatuspagePublicApiAdapter(requester);

    const result = await adapter.listIncidents(
      { pageId: "abc123def456" },
      { filter: "unresolved", limit: 25 },
    );

    expect(requester.mock.calls[0][0]).toBe(
      "https://abc123def456.statuspage.io/api/v2/incidents/unresolved.json",
    );
    expect(result.returnedCount).toBe(25);
  });

  it("rejects host injection in a page ID before network access", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>();
    const adapter = new StatuspagePublicApiAdapter(requester);

    await expect(
      adapter.health({ pageId: "example.com/../../secret" }),
    ).rejects.toMatchObject<Partial<StatuspagePublicApiError>>({
      code: "statuspage_page_id_invalid",
    });
    expect(requester).not.toHaveBeenCalled();
  });

  it("rejects unsupported filters before network access", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>();
    const adapter = new StatuspagePublicApiAdapter(requester);

    await expect(
      adapter.listScheduledMaintenances(
        { pageId: "abc123def456" },
        { filter: "deleted" },
      ),
    ).rejects.toMatchObject<Partial<StatuspagePublicApiError>>({
      code: "statuspage_filter_invalid",
    });
    expect(requester).not.toHaveBeenCalled();
  });
});
