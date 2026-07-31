import { MarketplaceConnectorRegistry } from "../connector-registry";
import { TempoTimesheetsApiAdapter } from "./tempo-timesheets-api.adapter";
import { TEMPO_TIMESHEETS_CONNECTOR_MANIFEST } from "./tempo-timesheets.connector";

describe("Tempo Timesheets connector", () => {
  it("registers a complete Safe and Dangerous policy surface", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("tempo-timesheets")).toBe(TEMPO_TIMESHEETS_CONNECTOR_MANIFEST);
    expect(TEMPO_TIMESHEETS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "tempoTimesheets.listWorklogs",
      "tempoTimesheets.getWorklog",
      "tempoTimesheets.listAccounts",
      "tempoPlanner.searchPlans",
      "tempoTimesheets.request",
    ]);
    expect(TEMPO_TIMESHEETS_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("uses the bounded Tempo Planner search contract", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe("https://api.tempo.io/4/plans/search");
      expect(init.method).toBe("POST");
      expect(JSON.parse(String(init.body))).toEqual({ from: "2026-07-01", to: "2026-07-31", limit: 10, offset: 0 });
      return new Response(JSON.stringify({ results: [{ id: 7 }] }), { status: 200 });
    });
    const adapter = new TempoTimesheetsApiAdapter(requester);
    await expect(adapter.searchPlans({ apiToken: "tempo-secret-token-value", jiraSiteUrl: "https://relay.atlassian.net" }, { from: "2026-07-01", to: "2026-07-31", limit: 10 })).resolves.toEqual({ plans: [{ id: 7 }], metadata: null });
  });

  it("pins requests to the Tempo v4 origin and bearer header", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe("https://api.tempo.io/4/worklogs?from=2026-07-01&to=2026-07-10&limit=5&offset=0");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tempo-secret-token-value");
      return new Response(JSON.stringify({ results: [{ tempoWorklogId: 1 }], metadata: { count: 1 } }), { status: 200 });
    });
    const adapter = new TempoTimesheetsApiAdapter(requester);
    await expect(adapter.listWorklogs({ apiToken: "tempo-secret-token-value", jiraSiteUrl: "https://relay.atlassian.net" }, { from: "2026-07-01", to: "2026-07-10", limit: 5 })).resolves.toEqual({ worklogs: [{ tempoWorklogId: 1 }], metadata: { count: 1 } });
  });

  it("rejects tenant drift, oversized windows and traversal", async () => {
    const adapter = new TempoTimesheetsApiAdapter();
    const credentials = { apiToken: "tempo-secret-token-value", jiraSiteUrl: "https://example.com" };
    await expect(adapter.health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.listWorklogs({ ...credentials, jiraSiteUrl: "https://relay.atlassian.net" }, { from: "2026-01-01", to: "2026-07-01" })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.request({ ...credentials, jiraSiteUrl: "https://relay.atlassian.net" }, { method: "GET", path: "/../oauth/token" })).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
