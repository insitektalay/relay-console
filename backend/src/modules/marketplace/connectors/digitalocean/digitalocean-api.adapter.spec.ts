import {
  DigitalOceanApiAdapter,
  DigitalOceanApiError,
} from "./digitalocean-api.adapter";

const credentials = {
  accessToken: "secret",
  teamId: "01234567-89ab-cdef-0123-456789abcdef",
  projectId: "11234567-89ab-cdef-0123-456789abcdef",
  resourceUrn: "do:droplet:123456",
};

describe("DigitalOceanApiAdapter", () => {
  it("lists only the bounded first Project page for the exact Team", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify({
            projects: [
              {
                id: credentials.projectId,
                owner_uuid: credentials.teamId,
                name: "Relay production",
              },
            ],
            links: { pages: { next: "private-next-page" } },
          }),
          { status: 200 },
        ),
    );
    const result = await new DigitalOceanApiAdapter(requester).listProjects(
      credentials,
      { limit: 5 },
    );
    expect(requester.mock.calls[0][0]).toBe(
      "https://api.digitalocean.com/v2/projects?page=1&per_page=5",
    );
    expect(result).toMatchObject({
      returnedCount: 1,
      more: true,
      automaticPagination: false,
    });
    expect(result.projects[0]).toMatchObject({ teamId: credentials.teamId });
  });

  it("rejects a Project returned from another Team", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify({
            project: {
              id: credentials.projectId,
              owner_uuid: "21234567-89ab-cdef-0123-456789abcdef",
            },
          }),
          { status: 200 },
        ),
    );
    await expect(
      new DigitalOceanApiAdapter(requester).getProject(credentials),
    ).rejects.toMatchObject<Partial<DigitalOceanApiError>>({
      code: "digitalocean_team_binding_mismatch",
    });
  });

  it("verifies bounded Project membership before returning a redacted Droplet", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async (url) =>
        url.includes("/resources")
          ? new Response(
              JSON.stringify({
                resources: [{ urn: credentials.resourceUrn, status: "ok" }],
              }),
              { status: 200 },
            )
          : new Response(
              JSON.stringify({
                droplet: {
                  id: 123456,
                  name: "relay-api",
                  user_data: "private cloud-init",
                  networks: {
                    v4: [{ ip_address: "192.0.2.1", type: "public" }],
                  },
                },
              }),
              { status: 200 },
            ),
    );
    const result = await new DigitalOceanApiAdapter(
      requester,
    ).getSelectedResource(credentials);
    expect(result).toMatchObject({
      resourceKind: "droplet",
      projectMembershipVerified: true,
      resource: { id: "123456", userDataReturned: false },
    });
    expect(result.resource).not.toHaveProperty("user_data");
    expect(requester).toHaveBeenCalledTimes(2);
  });

  it("redacts App environment and source metadata", async () => {
    const appId = "31234567-89ab-cdef-0123-456789abcdef";
    const appCredentials = {
      ...credentials,
      resourceUrn: `do:app:${appId}`,
    };
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async (url) =>
        url.includes("/resources")
          ? new Response(
              JSON.stringify({
                resources: [{ urn: appCredentials.resourceUrn }],
              }),
              { status: 200 },
            )
          : new Response(
              JSON.stringify({
                app: {
                  id: appId,
                  spec: {
                    name: "relay-web",
                    services: [
                      {
                        name: "web",
                        envs: [{ key: "SECRET", value: "private" }],
                        github: { repo: "private/repo" },
                      },
                    ],
                  },
                },
              }),
              { status: 200 },
            ),
    );
    const result = await new DigitalOceanApiAdapter(
      requester,
    ).getSelectedResource(appCredentials);
    expect(result.resource).toMatchObject({
      componentNames: ["web"],
      environmentValuesReturned: false,
      sourceMetadataReturned: false,
    });
    expect(result.resource).not.toHaveProperty("spec");
  });

  it("rejects unbound resources and invalid URNs", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(JSON.stringify({ resources: [] }), { status: 200 }),
    );
    await expect(
      new DigitalOceanApiAdapter(requester).getSelectedResource(credentials),
    ).rejects.toMatchObject<Partial<DigitalOceanApiError>>({
      code: "digitalocean_project_membership_unverified",
    });
    await expect(
      new DigitalOceanApiAdapter(requester).getSelectedResource({
        ...credentials,
        resourceUrn: "do:database:secret",
      }),
    ).rejects.toMatchObject<Partial<DigitalOceanApiError>>({
      code: "digitalocean_resource_urn_invalid",
    });
  });
});
