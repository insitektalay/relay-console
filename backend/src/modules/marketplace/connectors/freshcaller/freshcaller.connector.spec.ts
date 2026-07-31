import { FRESHCALLER_CONNECTOR_MANIFEST } from "./freshcaller.connector";
import {
  FreshcallerApiAdapter,
  FreshcallerApiError,
} from "./freshcaller-api.adapter";

const credentials = { domain: "relay-phone", apiKey: "test-api-key" };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Freshcaller connector", () => {
  it("publishes bounded metric reads and an approval-gated API v1 broker", () => {
    expect(FRESHCALLER_CONNECTOR_MANIFEST.slug).toBe("freshcaller");
    expect(FRESHCALLER_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      FRESHCALLER_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "freshcaller.listCallMetrics",
      "freshcaller.getCallMetrics",
      "freshcaller.request",
    ]);
    expect(
      FRESHCALLER_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("binds X-Api-Auth to the exact tenant and projects page-one metrics", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      const parsed = new URL(String(url));
      expect(parsed.origin).toBe("https://relay-phone.freshcaller.com");
      expect(parsed.searchParams.get("page")).toBe("1");
      expect(parsed.searchParams.get("per_page")).toBe("2");
      expect(init.headers).toMatchObject({ "X-Api-Auth": "test-api-key" });
      return response([
        {
          id: 41,
          call_id: 72,
          talk_time: 18,
          hold_duration: 2,
          cost: 1.5,
          cost_unit: "usd",
          participants: [{ phone_number: "private" }],
          recording: { url: "private" },
          life_cycle: [{ type: "private" }],
        },
      ]);
    });
    const result = await new FreshcallerApiAdapter(requester).listCallMetrics(
      credentials,
      { limit: 2 },
    );
    expect(result.metrics[0]).toMatchObject({
      metricId: 41,
      callId: 72,
      talkSeconds: 18,
      holdSeconds: 2,
      cost: 1.5,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("reads one exact call metric through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(new URL(String(url)).pathname).toBe(
        "/api/v1/calls/72/call_metrics",
      );
      return response({
        call_metric: {
          id: 41,
          call_id: 72,
          ivr_time: 4,
          recording_duration: 9,
        },
      });
    });
    await expect(
      new FreshcallerApiAdapter(requester).getCallMetrics(credentials, 72),
    ).resolves.toMatchObject({
      metric: { callId: 72, ivrSeconds: 4, recordingSeconds: 9 },
    });
  });

  it("allows bounded relative API requests and redacts secrets", async () => {
    const result = await new FreshcallerApiAdapter(async () =>
      response({ access_token: "provider-secret" }),
    ).request(credentials, { method: "GET", path: "/api/v1/teams" });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile domains, paths, credential fields, and oversized responses", async () => {
    const adapter = new FreshcallerApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.health({ ...credentials, domain: "relay.freshcaller.com.evil" }),
    ).rejects.toBeInstanceOf(FreshcallerApiError);
    await expect(
      adapter.request(credentials, { method: "GET", path: "/api/v1/../admin" }),
    ).rejects.toBeInstanceOf(FreshcallerApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/api/v1/teams",
        json: { apiKey: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
