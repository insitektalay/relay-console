import {
  MicrosoftTeamsGraphAdapter,
  MicrosoftTeamsGraphError,
} from "./microsoft-teams-graph.adapter";
import {
  MICROSOFT_TEAMS_CONNECTOR_MANIFEST,
  MICROSOFT_TEAMS_REQUIRED_SCOPES,
} from "./microsoft-teams.connector";

describe("Microsoft Teams connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("declares exact delegated metadata scopes and four read tools", () => {
    expect(MICROSOFT_TEAMS_REQUIRED_SCOPES).toEqual([
      "openid",
      "profile",
      "offline_access",
      "https://graph.microsoft.com/Team.ReadBasic.All",
      "https://graph.microsoft.com/Channel.ReadBasic.All",
    ]);
    expect(MICROSOFT_TEAMS_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      MICROSOFT_TEAMS_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && !tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("lists only the first twenty-five direct memberships without pagination", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          value: Array.from({ length: 30 }, (_, i) => ({
            id: `team-${i}`,
            displayName: `Team ${i}`,
            email: "blocked@example.com",
          })),
          "@odata.nextLink": "blocked",
        }),
        { status: 200 },
      ),
    );
    const result = await new MicrosoftTeamsGraphAdapter().listJoinedTeams(
      "token",
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://graph.microsoft.com/v1.0/me/joinedTeams",
    );
    expect(result).toMatchObject({
      resultCount: 25,
      truncated: true,
      nextPageFollowed: false,
      workSchoolOnly: true,
      messageContentReturned: false,
    });
    expect(JSON.stringify(result)).not.toContain("blocked@example.com");
  });

  it("uses fixed selected fields for one explicit team and channel list", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ value: [] }), { status: 200 }),
      );
    await new MicrosoftTeamsGraphAdapter().listChannels("token", {
      teamId: "team-1",
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/v1.0/teams/team-1/channels");
    expect(url.searchParams.get("$select")).toBe(
      "id,displayName,description,membershipType,webUrl",
    );
    expect([...url.searchParams.keys()]).toEqual(["$select"]);
  });

  it("returns only bounded channel metadata", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "19:roadmap@thread.tacv2",
          displayName: "Roadmap",
          description: "Plan",
          membershipType: "standard",
          webUrl: "https://teams.microsoft.com/l/channel/example",
          messages: [{ body: "blocked" }],
          members: [{ email: "blocked@example.com" }],
        }),
        { status: 200 },
      ),
    );
    const result = await new MicrosoftTeamsGraphAdapter().getChannel("token", {
      teamId: "team-1",
      channelId: "19:roadmap@thread.tacv2",
    });
    expect(result.channel).toMatchObject({
      displayName: "Roadmap",
      membershipType: "standard",
    });
    expect(JSON.stringify(result)).not.toContain("blocked");
  });

  it("rejects traversal and malformed identifiers before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new MicrosoftTeamsGraphAdapter().getTeam("token", { teamId: "../users" }),
    ).rejects.toBeInstanceOf(MicrosoftTeamsGraphError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
