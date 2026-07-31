import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  SlackEnterpriseGridApiAdapter,
  SlackEnterpriseGridApiError,
} from "./slack-enterprise-grid-api.adapter";
import { SLACK_ENTERPRISE_GRID_CONNECTOR_MANIFEST } from "./slack-enterprise-grid.connector";

describe("Slack Enterprise Grid Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { adminToken: "slack-user-token-fixture" };

  it("registers encrypted customer-owned org token auth and both profiles", () => {
    expect(
      new MarketplaceConnectorRegistry().get("slack-enterprise-grid"),
    ).toBe(SLACK_ENTERPRISE_GRID_CONNECTOR_MANIFEST);
    expect(SLACK_ENTERPRISE_GRID_CONNECTOR_MANIFEST.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        {
          name: "SLACK_ENTERPRISE_ADMIN_TOKEN",
          secret: true,
          storedIn: "encrypted_secret",
        },
      ],
    });
    expect(
      SLACK_ENTERPRISE_GRID_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["slack_enterprise_safe", "dangerously_skip_permissions"]);
  });

  it("pins bounded workspace reads to one documented Slack method", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, teams: [] }), { status: 200 }),
      );
    await new SlackEnterpriseGridApiAdapter().listWorkspaces(credentials, {
      limit: 999,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://slack.com/api/admin.teams.list");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer slack-user-token-fixture",
    );
    expect(JSON.parse(String(init?.body))).toEqual({ limit: 100 });
    expect(String(init?.body)).not.toContain("slack-user-token-fixture");
  });

  it("validates exact workspace IDs before making provider calls", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new SlackEnterpriseGridApiAdapter().listWorkspaceAdmins(credentials, {
        teamId: "../../private",
      }),
    ).rejects.toBeInstanceOf(SlackEnterpriseGridApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shapes workspace results without owner email addresses or cursors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          teams: [
            {
              id: "T1234",
              name: "Core",
              discoverability: "hidden",
              team_url: "https://core.slack.com/",
              primary_owner: { user_id: "W1234", email: "private@example.com" },
            },
          ],
          response_metadata: { next_cursor: "secret-cursor" },
        }),
        { status: 200 },
      ),
    );
    await expect(
      new SlackEnterpriseGridApiAdapter().listWorkspaces(credentials, {}),
    ).resolves.toEqual({
      workspaces: [
        {
          teamId: "T1234",
          name: "Core",
          discoverability: "hidden",
          workspaceUrl: "https://core.slack.com/",
          primaryOwnerUserId: "W1234",
        },
      ],
      count: 1,
      nextCursorUsed: false,
    });
  });
});
