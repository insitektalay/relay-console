import { ZohoProjectsApiAdapter } from "./zoho-projects-api.adapter";
const credentials = { accessToken: "fixture-access-token", apiOrigin: "https://www.zohoapis.eu", portalId: "2389290" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("ZohoProjectsApiAdapter", () => {
  it("pins portal, V3 origin, first page, limit, and redacted project fields", async () => {
    const request = jest.fn(async () => json({ projects: [{ id: "9001", name: "Launch", status: { name: "Active" }, start_date: "2026-07-01", end_date: "2026-08-01", percent_complete: 20, owner: { email: "private@example.com" }, description: "private" }] }));
    const result = await new ZohoProjectsApiAdapter(request).listProjects(credentials, { limit: 10 });
    expect(request).toHaveBeenCalledWith("https://www.zohoapis.eu/projects/v3/portal/2389290/projects?page=1&per_page=10", expect.objectContaining({ method: "GET", redirect: "error", headers: expect.objectContaining({ Authorization: `Zoho-oauthtoken ${credentials.accessToken}` }) }));
    expect(result.projects[0]).toMatchObject({ projectId: "9001", name: "Launch", status: "Active", percentComplete: 20 });
    expect(result.projects[0]).not.toHaveProperty("owner"); expect(result.projects[0]).not.toHaveProperty("description"); expect(result.nextPageFollowed).toBe(false);
  });
  it("pins exact project/task IDs and redacts private task fields", async () => {
    const request = jest.fn(async () => json({ tasks: [{ id: "8001", name: "Review", status: { name: "Open" }, priority: "High", assignees: [{ email: "private@example.com" }], description: "private" }] }));
    const result = await new ZohoProjectsApiAdapter(request).listTasks(credentials, { projectId: "9001", limit: 5 });
    expect(request).toHaveBeenCalledWith("https://www.zohoapis.eu/projects/v3/portal/2389290/projects/9001/tasks?page=1&per_page=5", expect.any(Object));
    expect(result.tasks[0]).toMatchObject({ taskId: "8001", name: "Review", status: "Open" }); expect(result.tasks[0]).not.toHaveProperty("assignees");
  });
  it("validates the exact portal and rejects origins, IDs, and limits before network access", async () => {
    const health = await new ZohoProjectsApiAdapter(async () => json({ portals: [{ id: credentials.portalId, name: "Relay" }] })).health(credentials);
    expect(health).toMatchObject({ portalId: credentials.portalId, portalName: "Relay" });
    const blocked = jest.fn(); const adapter = new ZohoProjectsApiAdapter(blocked);
    await expect(adapter.listProjects({ ...credentials, apiOrigin: "https://evil.example" }, {})).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.listTasks(credentials, { projectId: "../project" })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.listProjects(credentials, { limit: 26 })).rejects.toMatchObject({ code: "provider_validation_error" }); expect(blocked).not.toHaveBeenCalled();
  });
});
