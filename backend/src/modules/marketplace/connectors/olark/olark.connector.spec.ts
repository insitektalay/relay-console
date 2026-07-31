import { OLARK_CONNECTOR_MANIFEST } from "./olark.connector";
import {
  OlarkWebhookAdapter,
  OlarkWebhookError,
} from "./olark-webhook.adapter";

const credentials = {
  relayWebhookSecret: "relay-test-secret-at-least-24-chars",
};
describe("Olark connector", () => {
  it("publishes only the approval-gated transcript projection", () => {
    expect(OLARK_CONNECTOR_MANIFEST.connectorType).toBe(
      "webhook_automation_platform",
    );
    expect(OLARK_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "olark.projectTranscript",
    ]);
    expect(OLARK_CONNECTOR_MANIFEST.tools[0].approvalRequired).toBe(true);
  });
  it("projects content-free operational metadata", () => {
    const result = new OlarkWebhookAdapter().projectTranscript(credentials, {
      kind: "Conversation",
      id: "EV695BI2930",
      tags: ["private-tag"],
      operators: [{ email: "private@example.com" }],
      groups: [{ name: "private" }],
      messages: [{ body: "private body" }],
      started_at: "2026-07-18T10:00:00Z",
      visitor: { email: "private@example.com" },
      customFields: { secret: "private" },
    });
    expect(result).toEqual({
      conversation: {
        conversationId: "EV695BI2930",
        kind: "Conversation",
        operatorCount: 1,
        groupCount: 1,
        messageCount: 1,
        tagCount: 1,
        startedAt: "2026-07-18T10:00:00Z",
        endedAt: null,
      },
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("rejects missing secrets, invalid IDs, non-object and oversized payloads", () => {
    const adapter = new OlarkWebhookAdapter();
    expect(() => adapter.health({ relayWebhookSecret: "" })).toThrow(
      OlarkWebhookError,
    );
    expect(() =>
      adapter.projectTranscript(credentials, { id: "https://evil.test" }),
    ).toThrow(OlarkWebhookError);
    expect(() => adapter.projectTranscript(credentials, [])).toThrow(
      OlarkWebhookError,
    );
    expect(() =>
      adapter.projectTranscript(credentials, {
        id: "OK",
        value: "x".repeat(1_000_001),
      }),
    ).toThrow(OlarkWebhookError);
  });
  it("does not publish invented REST, credential, or browser automation tools", () => {
    const text = JSON.stringify(OLARK_CONNECTOR_MANIFEST);
    expect(text).not.toContain("apiKey");
    expect(text).not.toContain("javascript.execute");
    expect(text).not.toContain("olark.request");
  });
  it("reports the documented webhook and JavaScript-only surface", () => {
    expect(new OlarkWebhookAdapter().health(credentials)).toEqual({
      integration: "transcript_webhook",
      apiSurface: "webhook_and_browser_javascript",
    });
  });
});
