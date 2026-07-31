import { VercelApiAdapter, VercelApiError } from "./vercel-api.adapter";

const credentials = {
  accessToken: "secret",
  projectId: "prj_abc123",
  teamId: "team_abc123",
  installationId: "icfg_abc123",
};

describe("VercelApiAdapter", () => {
  it("lists only the bounded first project page with exact team binding", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify({
            projects: [
              {
                id: credentials.projectId,
                name: "relay-web",
                env: [{ value: "hidden" }],
              },
            ],
            pagination: { next: 2 },
          }),
          { status: 200 },
        ),
    );
    const adapter = new VercelApiAdapter(requester);

    const result = await adapter.listProjects(credentials, { limit: 3 });

    expect(requester.mock.calls[0][0]).toBe(
      "https://api.vercel.com/v9/projects?limit=3&teamId=team_abc123",
    );
    expect(result).toMatchObject({
      returnedCount: 1,
      more: true,
      automaticPagination: false,
    });
    expect(result.projects[0]).not.toHaveProperty("env");
    expect(result.projects[0]).toMatchObject({
      environmentValuesReturned: false,
      sourceMetadataReturned: false,
    });
  });

  it("rejects a project response that does not match the selected project", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(JSON.stringify({ id: "prj_other", name: "other" }), {
          status: 200,
        }),
    );
    const adapter = new VercelApiAdapter(requester);

    await expect(adapter.getProject(credentials)).rejects.toMatchObject<
      Partial<VercelApiError>
    >({ code: "vercel_project_binding_mismatch" });
  });

  it("lists only selected-project deployment summaries and removes source metadata", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>(
      async () =>
        new Response(
          JSON.stringify({
            deployments: [
              {
                uid: "dpl_abc123",
                name: "relay-web",
                projectId: credentials.projectId,
                meta: { githubCommitSha: "private" },
                creator: { uid: "user_abc", username: "alex" },
              },
            ],
            pagination: {},
          }),
          { status: 200 },
        ),
    );
    const adapter = new VercelApiAdapter(requester);

    const result = await adapter.listDeployments(credentials, { limit: 10 });

    expect(requester.mock.calls[0][0]).toBe(
      "https://api.vercel.com/v6/deployments?projectId=prj_abc123&limit=10&teamId=team_abc123",
    );
    expect(result.deployments[0]).not.toHaveProperty("meta");
    expect(result.deployments[0]).toMatchObject({
      filesReturned: false,
      rawLogsReturned: false,
      sourceMetadataReturned: false,
    });
  });

  it("rejects invalid identifiers before network access", async () => {
    const requester = jest.fn<Promise<Response>, [string, RequestInit]>();
    const adapter = new VercelApiAdapter(requester);

    await expect(
      adapter.getProject({ ...credentials, projectId: "../../v2/user" }),
    ).rejects.toMatchObject<Partial<VercelApiError>>({
      code: "vercel_project_id_invalid",
    });
    expect(requester).not.toHaveBeenCalled();
  });
});
