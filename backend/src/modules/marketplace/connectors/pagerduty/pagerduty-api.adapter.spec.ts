import { PagerDutyApiAdapter } from "./pagerduty-api.adapter";

describe("PagerDutyApiAdapter", () => {
  it("uses one bounded incident page and excludes contact and alert content", async () => {
    const requester = jest.fn(
      async (url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            incidents: [
              {
                id: "PINCIDENT1",
                incident_number: 42,
                title: "Checkout latency",
                status: "triggered",
                urgency: "high",
                service: { id: "PSERVICE1", summary: "Checkout API" },
                assignments: [
                  { assignee: { id: "PUSER1", summary: "Private Person" } },
                ],
                alerts: [{ body: { details: "private alert payload" } }],
              },
            ],
            more: true,
          }),
          { status: 200 },
        ),
    );
    const result = await new PagerDutyApiAdapter(requester).listIncidents(
      { accessToken: "secret", apiOrigin: "https://api.pagerduty.com" },
      { statuses: ["triggered"], limit: 5 },
    );
    const url = new URL(requester.mock.calls[0][0]);
    expect(url.pathname).toBe("/incidents");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("offset")).toBe("0");
    expect(url.searchParams.getAll("statuses[]")).toEqual(["triggered"]);
    expect(result.incidents[0]).toMatchObject({
      title: "Checkout latency",
      assignmentCount: 1,
      service: { name: "Checkout API" },
    });
    expect(result).toMatchObject({ more: true, automaticPagination: false });
    expect(JSON.stringify(result)).not.toContain("Private Person");
    expect(JSON.stringify(result)).not.toContain("private alert payload");
  });

  it("rejects arbitrary origins and unsafe incident IDs before a request", async () => {
    const requester = jest.fn();
    const adapter = new PagerDutyApiAdapter(requester);
    await expect(
      adapter.listServices(
        {
          accessToken: "secret",
          apiOrigin: "https://api.pagerduty.com.evil.example",
        },
        {},
      ),
    ).rejects.toMatchObject({
      code: "pagerduty_region_invalid",
      statusCode: 400,
    });
    await expect(
      adapter.getIncident(
        { accessToken: "secret", apiOrigin: "https://api.eu.pagerduty.com" },
        { incidentId: "../../users" },
      ),
    ).rejects.toMatchObject({
      code: "pagerduty_incident_id_invalid",
      statusCode: 400,
    });
    expect(requester).not.toHaveBeenCalled();
  });
});
