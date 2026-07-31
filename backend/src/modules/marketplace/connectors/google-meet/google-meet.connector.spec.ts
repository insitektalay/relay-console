import {
  GoogleMeetApiAdapter,
  GoogleMeetApiError,
} from "./google-meet-api.adapter";
import {
  GOOGLE_MEET_CONNECTOR_MANIFEST,
  GOOGLE_MEET_SCOPES,
} from "./google-meet.connector";

describe("Google Meet connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses only the app-created Space scope and exposes four bounded tools", () => {
    expect(GOOGLE_MEET_SCOPES).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/meetings.space.created",
    ]);
    expect(GOOGLE_MEET_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      GOOGLE_MEET_CONNECTOR_MANIFEST.tools
        .filter((tool) => tool.approvalRequired)
        .map((tool) => tool.functionName),
    ).toEqual(["google_meet_space_create", "google_meet_space_patch"]);
  });

  it("rejects open access during local preparation", () => {
    expect(() =>
      new GoogleMeetApiAdapter().prepareSpaceUpdate({
        operation: "create",
        accessType: "OPEN",
      }),
    ).toThrow(GoogleMeetApiError);
  });

  it("forces moderated host-only configuration when creating a Space", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "spaces/relayMeet1",
          meetingUri: "https://meet.google.com/abc-defg-hij",
          meetingCode: "abc-defg-hij",
          config: { accessType: "RESTRICTED", moderation: "ON" },
        }),
        { status: 200 },
      ),
    );
    await new GoogleMeetApiAdapter().createSpace("token", {});
    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      config: {
        accessType: "RESTRICTED",
        moderation: "ON",
        moderationRestrictions: {
          chatRestriction: "HOSTS_ONLY",
          reactionRestriction: "HOSTS_ONLY",
          presentRestriction: "HOSTS_ONLY",
          defaultJoinAsViewerType: "ON",
        },
        attendanceReportGenerationType: "DO_NOT_GENERATE",
        artifactConfig: {
          recordingConfig: { autoRecordingGeneration: "DO_NOT_GENERATE" },
          transcriptionConfig: {
            autoTranscriptionGeneration: "DO_NOT_GENERATE",
          },
          smartNotesConfig: { autoSmartNotesGeneration: "DO_NOT_GENERATE" },
        },
      },
    });
  });

  it("uses the explicit safety mask and strips sensitive Space fields", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "spaces/relayMeet1",
          meetingUri: "https://meet.google.com/abc-defg-hij",
          meetingCode: "abc-defg-hij",
          config: {
            accessType: "TRUSTED",
            entryPointAccess: "ALL",
            moderation: "ON",
          },
          activeConference: {
            conferenceRecord: "conferenceRecords/secret",
          },
          phoneAccess: [{ pin: "secret" }],
          gatewaySipAccess: [{ uri: "sip:secret" }],
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleMeetApiAdapter().updateSpace("token", {
      spaceName: "spaces/relayMeet1",
      accessType: "TRUSTED",
    });
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [URL];
    expect(url.searchParams.get("updateMask")).toContain(
      "config.moderationRestrictions",
    );
    expect(result).toMatchObject({
      explicitSafetyUpdateMask: true,
      space: {
        hasActiveConference: true,
        conferenceRecordIdentifierReturned: false,
        phoneAccessReturned: false,
        gatewaySipAccessReturned: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain("conferenceRecords/secret");
    expect(JSON.stringify(result)).not.toContain("sip:secret");
  });
});
