import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  SlackCanvasApiAdapter,
  SlackCanvasApiError,
} from "./slack-canvas-api.adapter";
import { SLACK_CANVAS_CONNECTOR_MANIFEST } from "./slack-canvas.connector";

describe("Slack Canvas Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { accessToken: "slack-canvas-token-fixture" };
  it("registers encrypted customer token auth and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("slack-canvas")).toBe(
      SLACK_CANVAS_CONNECTOR_MANIFEST,
    );
    expect(SLACK_CANVAS_CONNECTOR_MANIFEST.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        {
          name: "SLACK_CANVAS_TOKEN",
          secret: true,
          storedIn: "encrypted_secret",
        },
      ],
    });
    expect(
      SLACK_CANVAS_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["slack_canvas_safe", "dangerously_skip_permissions"]);
  });
  it("pins create to the documented Slack method with header-only auth and bounds", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, canvas_id: "F1234" }), {
          status: 200,
        }),
      );
    await new SlackCanvasApiAdapter().create(credentials, {
      title: "Plan",
      markdown: "# Launch",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://slack.com/api/canvases.create");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer slack-canvas-token-fixture",
    );
    expect(String(init?.body)).not.toContain("slack-canvas-token-fixture");
  });
  it("rejects invalid identifiers and destructive append positions before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new SlackCanvasApiAdapter().append(credentials, {
        canvasId: "../private",
        position: "replace",
        markdown: "x",
      }),
    ).rejects.toBeInstanceOf(SlackCanvasApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("drafts locally without a provider call", () => {
    const fetchMock = jest.spyOn(global, "fetch");
    expect(
      new SlackCanvasApiAdapter().draft({
        title: "Plan",
        markdown: "# Launch",
      }),
    ).toEqual({
      title: "Plan",
      markdown: "# Launch",
      providerSideEffect: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
