import { MS_PROJECT_CONNECTOR_MANIFEST } from "./ms-project.connector";
import {
  MS_PROJECT_ENTITY_SETS,
  MS_PROJECT_SCHEDULE_ACTIONS,
  MsProjectApiAdapter,
  MsProjectApiError,
} from "./ms-project-api.adapter";

describe("MsProjectApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes ten schedule entities, twelve actions, and Safe or Dangerous policy", () => {
    expect(Object.keys(MS_PROJECT_ENTITY_SETS)).toHaveLength(10);
    expect(MS_PROJECT_SCHEDULE_ACTIONS).toHaveLength(12);
    expect(
      MS_PROJECT_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual(["ms-project.read", "ms-project.schedule"]);
    expect(
      MS_PROJECT_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["ms_project_schedule"]);
    expect(
      MS_PROJECT_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions,
    ).toEqual([]);
  });

  it("pins health and reads to the selected Dataverse environment", async () => {
    jest.spyOn(global, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ UserId: "user-id", value: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const adapter = new MsProjectApiAdapter();
    await adapter.health("access-token", "https://relay.crm4.dynamics.com");
    await adapter.read("access-token", "https://relay.crm4.dynamics.com", {
      entity: "tasks",
      select: ["msdyn_projecttaskid", "msdyn_subject"],
      filter: "statecode eq 0",
      orderBy: "msdyn_scheduledstart asc",
      top: 25,
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        hostname: "relay.crm4.dynamics.com",
        pathname: "/api/data/v9.2/WhoAmI",
      }),
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
    const readUrl = (fetch as jest.Mock).mock.calls[1][0] as URL;
    expect(readUrl.pathname).toBe("/api/data/v9.2/msdyn_projecttasks");
    expect(readUrl.searchParams.get("$top")).toBe("25");
    expect(readUrl.searchParams.get("$select")).toBe(
      "msdyn_projecttaskid,msdyn_subject",
    );
  });

  it("runs only documented bounded schedule actions", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ OperationSetId: "operation-id" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await new MsProjectApiAdapter().schedule(
      "access-token",
      "https://relay.crm.dynamics.com",
      {
        action: "msdyn_ExecuteOperationSetV3",
        parameters: {
          ProjectId: "00000000-0000-4000-8000-000000000001",
          OperationSetDescription: "Relay schedule update",
          CreateEntityCollection: [],
          UpdateEntityCollection: [],
          DeleteEntityCollection: [],
        },
      },
    );
    const [url, request] = (fetch as jest.Mock).mock.calls[0];
    expect((url as URL).pathname).toBe(
      "/api/data/v9.2/msdyn_ExecuteOperationSetV3",
    );
    expect(request.method).toBe("POST");
  });

  it("rejects other Dataverse tables, actions, origins, and unbounded collections", async () => {
    const adapter = new MsProjectApiAdapter();
    await expect(
      adapter.read("token", "https://relay.crm.dynamics.com", {
        entity: "accounts",
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.schedule("token", "https://relay.crm.dynamics.com", {
        action: "WhoAmI",
        parameters: {},
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(() => adapter.normalizeEnvironment("https://example.com")).toThrow(
      MsProjectApiError,
    );
    await expect(
      adapter.schedule("token", "https://relay.crm.dynamics.com", {
        action: "msdyn_ExecuteOperationSetV3",
        parameters: {
          CreateEntityCollection: Array.from({ length: 101 }, () => ({})),
        },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("blocks credential fields and relationships outside project scheduling", async () => {
    const adapter = new MsProjectApiAdapter();
    await expect(
      adapter.schedule("token", "https://relay.crm.dynamics.com", {
        action: "msdyn_PssCreateV1",
        parameters: { accessToken: "must-not-pass" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.schedule("token", "https://relay.crm.dynamics.com", {
        action: "msdyn_PssCreateV1",
        parameters: {
          Entity: {
            "ownerid@odata.bind":
              "/systemusers(00000000-0000-4000-8000-000000000001)",
          },
        },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
