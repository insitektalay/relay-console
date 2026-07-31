import {
  getOAuthFrontendUrl,
  normalizeOAuthReturnTo,
} from "./oauth-return-url";

const config = (values: Record<string, string> = {}) =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as any;

describe("Marketplace OAuth return URLs", () => {
  it("accepts the exact secret-free Relay Console iOS callback", () => {
    expect(
      normalizeOAuthReturnTo(
        "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=google-calendar",
        config(),
      ),
    ).toBe(
      "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=google-calendar",
    );
  });

  it.each([
    "relayconsole://other/oauth?workspace_id=workspace-1&marketplace_app=slack",
    "relayconsole://marketplace/other?workspace_id=workspace-1&marketplace_app=slack",
    "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack#fragment",
    "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&code=secret",
    "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&state=secret",
    "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&access_token=secret",
    "relayconsole://marketplace/oauth?workspace_id=workspace-1",
    "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=Slack",
    "otherapp://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack",
  ])("rejects unsafe or noncanonical mobile return target %s", (value) => {
    expect(normalizeOAuthReturnTo(value, config())).toBeNull();
  });

  it("keeps approved web returns and the canonical web fallback", () => {
    const reader = config({
      CLAWCHAT_WEB_ORIGIN: "https://relayconsole.work",
      CORS_ORIGINS: "https://preview.relayconsole.work",
    });
    expect(
      normalizeOAuthReturnTo(
        "https://relayconsole.work/app?marketplace_app=slack",
        reader,
      ),
    ).toBe("https://relayconsole.work/app?marketplace_app=slack");
    expect(getOAuthFrontendUrl("/app", reader)).toBe(
      "https://relayconsole.work/app",
    );
  });
});
