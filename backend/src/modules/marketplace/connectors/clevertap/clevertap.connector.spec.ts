import {
  CleverTapApiAdapter,
  CleverTapApiError,
} from "./clevertap-api.adapter";
import { CLEVERTAP_CONNECTOR_MANIFEST } from "./clevertap.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("CleverTap connector", () => {
  const credentials = {
    accountId: "TEST-ABC-123",
    passcode: "test-passcode",
    region: "us1",
    profileIdentity: "bound-user-42",
  };

  it("exposes only one approval-gated bound profile read", () => {
    expect(CLEVERTAP_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "clevertap.getBoundUserProfile",
    ]);
    expect(CLEVERTAP_CONNECTOR_MANIFEST.tools[0].approvalRequired).toBe(true);
    expect(CLEVERTAP_CONNECTOR_MANIFEST.tools[0].inputSchema).toEqual({
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  });

  it("uses the fixed regional profile endpoint and redacts sensitive fields", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        status: "success",
        record: {
          identity: "bound-user-42",
          name: "Ada",
          email: "ada@example.test",
          profileData: { Plan: "Secret", Score: 99 },
          events: {
            "App Launched": { count: 10, first_seen: 100, last_seen: 200 },
          },
          platformInfo: [
            {
              platform: "iOS",
              objectId: "private-object",
              push_token: "private-token",
            },
          ],
        },
      }),
    );
    const result = await new CleverTapApiAdapter(requester).getBoundUserProfile(
      credentials,
    );
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://us1.api.clevertap.com/1/profile.json?identity=bound-user-42",
    );
    expect(requester.mock.calls[0][1].headers).toMatchObject({
      "X-CleverTap-Account-Id": "TEST-ABC-123",
      "X-CleverTap-Passcode": "test-passcode",
    });
    expect(result).toMatchObject({
      profileReference: "connection-bound-identity",
      name: "Ada",
      email: "ada@example.test",
      platforms: ["iOS"],
      customPropertyKeys: ["Plan", "Score"],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /bound-user-42|Secret|private-object|private-token/,
    );
  });

  it("allowlists documented regions and rejects unsafe bindings", async () => {
    const adapter = new CleverTapApiAdapter(jest.fn());
    await expect(
      adapter.health({ ...credentials, region: "evil.example" }),
    ).rejects.toBeInstanceOf(CleverTapApiError);
    await expect(
      adapter.health({ ...credentials, profileIdentity: "bad\nidentity" }),
    ).rejects.toBeInstanceOf(CleverTapApiError);
  });

  it("preserves provider rate limits", async () => {
    await expect(
      new CleverTapApiAdapter(jest.fn().mockResolvedValue(json({}, 429))).health(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
