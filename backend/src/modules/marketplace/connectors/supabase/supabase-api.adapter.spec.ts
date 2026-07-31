import {
  SupabaseApiAdapter,
  type SupabaseCredentials,
} from "./supabase-api.adapter";

const credentials: SupabaseCredentials = {
  accessToken: "supabase-access-token",
  organizationSlug: "relay-org",
  projectRef: "abcdefghijklmnopqrst",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const project = {
  id: "project-relay-prod",
  ref: "abcdefghijklmnopqrst",
  name: "Relay Production",
  organization_id: "org-relay",
  organization_slug: "relay-org",
  region: "eu-west-2",
  status: "ACTIVE_HEALTHY",
  database: { host: "must-not-leak" },
};

describe("SupabaseApiAdapter", () => {
  it("reads the exact Organization and excludes members and entitlements", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(
        response({ id: "org-relay", slug: "relay-org", name: "Relay" }),
      );
    const result = await new SupabaseApiAdapter(requester).getOrganization(
      credentials,
    );
    expect(requester.mock.calls[0][0]).toBe(
      "https://api.supabase.com/v1/organizations/relay-org",
    );
    expect(result.organization).toMatchObject({
      slug: "relay-org",
      membersReturned: false,
      entitlementsReturned: false,
    });
  });

  it("lists only offset-zero bounded Projects", async () => {
    const requester = jest.fn().mockResolvedValue(
      response({
        projects: [project],
        pagination: { count: 31, limit: 5, offset: 0 },
      }),
    );
    const result = await new SupabaseApiAdapter(requester).listProjects(
      credentials,
      { limit: 5 },
    );
    expect(requester.mock.calls[0][0]).toBe(
      "https://api.supabase.com/v1/organizations/relay-org/projects?offset=0&limit=5",
    );
    expect(result).toMatchObject({
      pagination: { count: 31, limit: 5, offset: 0 },
      automaticPagination: false,
    });
  });

  it("reads the exact Project without database details", async () => {
    const requester = jest.fn().mockResolvedValue(response(project));
    const result = await new SupabaseApiAdapter(requester).getProject(
      credentials,
    );
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(result.project).toMatchObject({
      ref: "abcdefghijklmnopqrst",
      organizationSlug: "relay-org",
      databaseDetailsReturned: false,
    });
  });

  it("rejects cross-Organization Projects and maps rate limits", async () => {
    await expect(
      new SupabaseApiAdapter(
        jest
          .fn()
          .mockResolvedValue(
            response({ ...project, organization_slug: "other-org" }),
          ),
      ).getProject(credentials),
    ).rejects.toMatchObject({ code: "supabase_organization_binding_mismatch" });
    await expect(
      new SupabaseApiAdapter(
        jest.fn().mockResolvedValue(response({}, 429)),
      ).getProject(credentials),
    ).rejects.toMatchObject({ code: "supabase_rate_limited", statusCode: 429 });
  });
});
