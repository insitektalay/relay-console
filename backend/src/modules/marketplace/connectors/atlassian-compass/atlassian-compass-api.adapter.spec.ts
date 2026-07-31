import {
  AtlassianCompassApiAdapter,
  AtlassianCompassApiError,
} from "./atlassian-compass-api.adapter";
import {
  ATLASSIAN_COMPASS_CONNECTOR_MANIFEST,
  ATLASSIAN_COMPASS_REQUIRED_SCOPES,
} from "./atlassian-compass.connector";

describe("AtlassianCompassApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes least-privilege OAuth scopes and approval-gated creation", () => {
    expect(ATLASSIAN_COMPASS_REQUIRED_SCOPES).toEqual([
      "offline_access",
      "read:me",
      "read:component:compass",
      "write:component:compass",
    ]);
    expect(
      ATLASSIAN_COMPASS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "atlassian-compass.component-get",
      "atlassian-compass.component-create",
    ]);
    expect(
      ATLASSIAN_COMPASS_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (item) => item.id,
      ),
    ).toEqual(["atlassian_compass_component_create"]);
  });

  it("pins GraphQL requests to api.atlassian.com and fixed component reads", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            compass: {
              component: { __typename: "CompassComponent", name: "Relay" },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const componentId =
      "ari:cloud:compass:cloud-1:component/workspace-1/component-1";
    await new AtlassianCompassApiAdapter().componentGet("token", componentId);
    const [url, request] = (fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toBe("https://api.atlassian.com/graphql");
    expect(request).toEqual(
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
    const body = JSON.parse(request.body);
    expect(body.variables).toEqual({ componentId });
    expect(body.query).toContain("RelayCompassComponent");
  });

  it("creates only bounded documented component types", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            compass: {
              createComponent: {
                success: true,
                componentDetails: { id: "component-1", name: "Relay API" },
              },
            },
          },
        }),
        { status: 200 },
      ),
    );
    await new AtlassianCompassApiAdapter().componentCreate("token", "cloud-1", {
      name: "Relay API",
      typeId: "SERVICE",
      description: "Runtime API",
    });
    const request = (fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body).variables).toEqual({
      cloudId: "cloud-1",
      input: {
        name: "Relay API",
        typeId: "SERVICE",
        description: "Runtime API",
      },
    });
  });

  it("rejects malformed component, owner, type, and GraphQL error results", async () => {
    const adapter = new AtlassianCompassApiAdapter();
    await expect(
      adapter.componentGet("token", "component-1"),
    ).rejects.toBeInstanceOf(AtlassianCompassApiError);
    await expect(
      adapter.componentCreate("token", "cloud-1", {
        name: "Relay API",
        typeId: "DATABASE",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.componentCreate("token", "cloud-1", {
        name: "Relay API",
        typeId: "SERVICE",
        ownerId: "https://evil.test/team",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });

    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ errors: [{ message: "Scope denied" }] }),
          { status: 200 },
        ),
      );
    await expect(
      adapter.componentGet(
        "token",
        "ari:cloud:compass:cloud-1:component/workspace-1/component-1",
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
