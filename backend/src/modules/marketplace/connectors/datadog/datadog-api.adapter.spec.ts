import { DatadogApiAdapter } from "./datadog-api.adapter";

describe("DatadogApiAdapter", () => {
  it("uses only fixed monitor search parameters and returns bounded provider semantics", async () => {
    const requester = jest.fn(
      async (url: string) =>
        new Response(
          JSON.stringify({
            monitors: [
              {
                id: 7,
                name: "API latency",
                status: "Alert",
                type: "metric alert",
                tags: ["service:api"],
                scopes: ["env:prod"],
                notifications: [{ handle: "secret@example.com" }],
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const adapter = new DatadogApiAdapter(requester);
    const result = await adapter.searchMonitors(
      { accessToken: "secret", apiOrigin: "https://api.datadoghq.com" },
      { query: "status:alert", limit: 5 },
    );
    expect(requester.mock.calls[0][0]).toContain("/api/v1/monitor/search?");
    expect(requester.mock.calls[0][0]).toContain("per_page=5");
    expect(result.monitors[0]).toEqual(
      expect.objectContaining({
        name: "API latency",
        status: "Alert",
        type: "metric alert",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("secret@example.com");
  });

  it("rejects arbitrary Datadog-like hosts before any request", async () => {
    const requester = jest.fn();
    const adapter = new DatadogApiAdapter(requester);
    await expect(
      adapter.searchMonitors(
        {
          accessToken: "secret",
          apiOrigin: "https://api.datadoghq.com.evil.example",
        },
        {},
      ),
    ).rejects.toMatchObject({ code: "datadog_site_invalid", statusCode: 400 });
    expect(requester).not.toHaveBeenCalled();
  });
});
