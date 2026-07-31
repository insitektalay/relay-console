import {
  MixpanelCohortsApiAdapter,
  type MixpanelCohortsCredentials,
} from "./mixpanel-cohorts-api.adapter";
import { MIXPANEL_COHORTS_OPERATIONS } from "./mixpanel-cohorts-operation-registry";

describe("MixpanelCohortsApiAdapter", () => {
  const credentials: MixpanelCohortsCredentials = {
    serviceAccountUsername: "user",
    serviceAccountSecret: "secret",
    region: "in",
    projectId: "123",
    workspaceId: "456",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins only the saved-cohort metadata operation", () => {
    expect(MIXPANEL_COHORTS_OPERATIONS).toEqual([
      {
        id: "list_saved_cohorts",
        method: "POST",
        path: "/api/query/cohorts/list",
      },
    ]);
  });

  it("uses fixed India Query API routing, project/workspace binding, and Basic auth", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response("[]"));
    await new MixpanelCohortsApiAdapter().read(
      credentials,
      "list_saved_cohorts",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://in.mixpanel.com/api/query/cohorts/list?project_id=123&workspace_id=456",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: `Basic ${Buffer.from("user:secret").toString("base64")}`,
      }),
    });
  });

  it("blocks all agent query/routing input and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new MixpanelCohortsApiAdapter();
    await expect(
      adapter.read(credentials, "list_saved_cohorts", { project_id: "999" }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(
        { ...credentials, region: "https://attacker.example" },
        "list_saved_cohorts",
        {},
      ),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.read(credentials, "query_members", {}),
    ).rejects.toMatchObject({ code: "tool_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
