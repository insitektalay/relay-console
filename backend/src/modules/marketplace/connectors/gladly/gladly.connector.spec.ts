import { GladlyApiAdapter, GladlyApiError } from "./gladly-api.adapter";
import { GLADLY_CONNECTOR_MANIFEST } from "./gladly.connector";

const credentials = {
  organization: "relay-support",
  agentEmail: "api-user@relay.test",
  apiToken: "test-api-token",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Gladly connector", () => {
  it("publishes bounded schedule reads and an approval-gated API broker", () => {
    expect(GLADLY_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "gladly.listBusinessHours",
      "gladly.getBusinessHours",
      "gladly.request",
    ]);
    expect(
      GLADLY_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds token Basic auth to the exact tenant and strips schedule content", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://relay-support.gladly.com/api/v1/business-hours",
      );
      expect(init.headers).toMatchObject({
        Authorization: `Basic ${Buffer.from("api-user@relay.test:test-api-token").toString("base64")}`,
      });
      return response([
        {
          id: "bh_primary",
          version: 3,
          name: "Private support schedule",
          primary: true,
          officeHours: {
            timezone: "Europe/London",
            monday: [{ start: "09:00", stop: "17:00" }],
            exceptions: [{ name: "Private holiday" }],
          },
          createdAt: "2026-07-01T12:00:00Z",
        },
      ]);
    });
    const result = await new GladlyApiAdapter(requester).listBusinessHours(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual({
      businessHours: [
        expect.objectContaining({
          businessHoursId: "bh_primary",
          version: 3,
          primary: true,
          timezone: "Europe/London",
          configuredDayCount: 1,
          exceptionCount: 1,
        }),
      ],
      truncated: false,
      limit: 2,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("09:00");
  });

  it("reads one exact business-hours record through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(new URL(String(url)).pathname).toBe(
        "/api/v1/business-hours/bh_weekend",
      );
      return response({
        id: "bh_weekend",
        version: 2,
        primary: false,
        officeHours: { timezone: "America/New_York", saturday: [{}] },
      });
    });
    await expect(
      new GladlyApiAdapter(requester).getBusinessHours(
        credentials,
        "bh_weekend",
      ),
    ).resolves.toMatchObject({
      businessHours: {
        businessHoursId: "bh_weekend",
        version: 2,
        timezone: "America/New_York",
        configuredDayCount: 1,
      },
    });
  });

  it("redacts secrets from broader REST API responses", async () => {
    const result = await new GladlyApiAdapter(async () =>
      response({ api_token: "provider-secret" }),
    ).request(credentials, { method: "GET", path: "/api/v1/organization" });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile tenants, paths, credential fields, and oversized responses", async () => {
    const adapter = new GladlyApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.health({ ...credentials, organization: "relay.gladly.com.evil" }),
    ).rejects.toBeInstanceOf(GladlyApiError);
    await expect(
      adapter.request(credentials, {
        method: "GET",
        path: "/api/v1/../admin",
      }),
    ).rejects.toBeInstanceOf(GladlyApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/api/v1/notes",
        json: { apiToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.health({ ...credentials, apiToken: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
