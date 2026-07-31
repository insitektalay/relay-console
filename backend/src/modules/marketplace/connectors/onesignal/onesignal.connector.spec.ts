import {
  OneSignalApiAdapter,
  OneSignalApiError,
} from "./onesignal-api.adapter";
import { ONESIGNAL_CONNECTOR_MANIFEST } from "./onesignal.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("OneSignal connector", () => {
  const credentials = {
    appId: "202d4f61-1ca9-42df-9d36-bb17d8123abc",
    appApiKey: "test-app-api-key",
  };

  it("exposes only one approval-gated delivery-summary read", () => {
    expect(ONESIGNAL_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "onesignal.listNotificationDeliverySummaries",
    ]);
    expect(ONESIGNAL_CONNECTOR_MANIFEST.tools[0].approvalRequired).toBe(true);
  });

  it("uses the fixed first page and redacts content and audience data", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        total_count: 1,
        next_time_offset: "private-cursor",
        notifications: [
          {
            id: "3c90c3cc-0d44-4b50-8888-8dd25736052a",
            app_id: credentials.appId,
            name: "Private campaign",
            contents: { en: "Private message" },
            included_segments: ["Private audience"],
            data: { secret: true },
            url: "https://private.example.test",
            queued_at: 100,
            completed_at: 200,
            successful: 90,
            failed: 5,
            converted: 3,
            remaining: 0,
            canceled: false,
          },
        ],
      }),
    );
    const result =
      await new OneSignalApiAdapter(requester).listNotificationDeliverySummaries(
        credentials,
      );
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.onesignal.com/notifications?app_id=202d4f61-1ca9-42df-9d36-bb17d8123abc&limit=25&offset=0",
    );
    expect(requester.mock.calls[0][1].headers).toMatchObject({
      Authorization: "Key test-app-api-key",
    });
    expect(result.notifications[0]).toMatchObject({
      id: "3c90c3cc-0d44-4b50-8888-8dd25736052a",
      queuedAt: 100,
      completedAt: 200,
      successful: 90,
      failed: 5,
      converted: 3,
      remaining: 0,
      canceled: false,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /Private|private-cursor|private\.example|contents|segments|secret/,
    );
  });

  it("rejects non-v4 app IDs and unsafe keys", async () => {
    const adapter = new OneSignalApiAdapter(jest.fn());
    await expect(
      adapter.health({ ...credentials, appId: "not-an-app" }),
    ).rejects.toBeInstanceOf(OneSignalApiError);
    await expect(
      adapter.health({ ...credentials, appApiKey: "bad\nkey" }),
    ).rejects.toBeInstanceOf(OneSignalApiError);
  });

  it("preserves provider rate limits", async () => {
    await expect(
      new OneSignalApiAdapter(jest.fn().mockResolvedValue(json({}, 429))).health(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
