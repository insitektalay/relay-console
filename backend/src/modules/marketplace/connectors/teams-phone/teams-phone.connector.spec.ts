import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  TeamsPhoneGraphAdapter,
  TeamsPhoneGraphError,
} from "./teams-phone-graph.adapter";
import { TEAMS_PHONE_CONNECTOR_MANIFEST } from "./teams-phone.connector";

describe("Teams Phone Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("registers delegated least-privilege Microsoft OAuth and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("teams-phone")).toBe(
      TEAMS_PHONE_CONNECTOR_MANIFEST,
    );
    expect(TEAMS_PHONE_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes).toEqual([
      "offline_access",
      "TeamsTelephoneNumber.Read.All",
    ]);
    expect(
      TEAMS_PHONE_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["teams_phone_safe", "dangerously_skip_permissions"]);
  });
  it("pins bounded reads and fixed filters to Microsoft Graph", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ value: [] }), { status: 200 }),
      );
    await new TeamsPhoneGraphAdapter().listUnassigned(
      "teams-phone-token-fixture",
      { limit: 999, numberType: "directRouting" },
    );
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      "https://graph.microsoft.com/v1.0/admin/teams/telephoneNumberManagement/numberAssignments",
    );
    expect(parsed.searchParams.get("$top")).toBe("25");
    expect(parsed.searchParams.get("$filter")).toBe(
      "assignmentStatus eq 'unassigned' and numberType eq 'directRouting'",
    );
    expect(String(init?.body ?? "")).not.toContain("teams-phone-token-fixture");
  });
  it("rejects arbitrary filter values before provider access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new TeamsPhoneGraphAdapter().listAssignments(
        "teams-phone-token-fixture",
        { numberType: "directRouting' or 1 eq 1" },
      ),
    ).rejects.toBeInstanceOf(TeamsPhoneGraphError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("masks numbers and removes assignee, location, operator, and raw IDs", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          value: [
            {
              id: "sensitive-id",
              telephoneNumber: "+12025550123",
              operatorId: "operator",
              assignmentTargetId: "person",
              locationId: "location",
              civicAddressId: "address",
              networkSiteId: "site",
              numberType: "directRouting",
              assignmentStatus: "userAssigned",
              capabilities: ["userAssignment"],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new TeamsPhoneGraphAdapter().listAssignments(
      "teams-phone-token-fixture",
      {},
    );
    expect(result.assignments[0]).toEqual({
      telephoneNumberMasked: "+*******0123",
      numberType: "directRouting",
      numberSource: null,
      activationState: null,
      assignmentCategory: null,
      assignmentStatus: "userAssigned",
      portInStatus: null,
      capabilities: ["userAssignment"],
    });
    expect(JSON.stringify(result)).not.toContain("sensitive-id");
    expect(JSON.stringify(result)).not.toContain("person");
    expect(JSON.stringify(result)).not.toContain("location");
  });
});
