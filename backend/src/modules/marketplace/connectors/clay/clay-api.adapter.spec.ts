import { ClayApiAdapter } from "./clay-api.adapter";
const credentials = { apiKey: "fixture-api-key" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("ClayApiAdapter", () => {
  it("pins GET /public/v0/me, authenticates only in clay-api-key, and redacts personal fields", async () => {
    const request = jest.fn(async () => json({ user: { id: "user_123", name: "Private User", email: "private@example.com" }, workspace: { id: "workspace_456", name: "GTM Ops", members: [{ email: "other@example.com" }] } }));
    const result = await new ClayApiAdapter(request).getWorkspace(credentials);
    expect(request).toHaveBeenCalledWith("https://api.clay.com/public/v0/me", expect.objectContaining({ method: "GET", redirect: "error", headers: expect.objectContaining({ "clay-api-key": credentials.apiKey }) }));
    expect(result.workspace).toEqual({ workspaceId: "workspace_456", workspaceName: "GTM Ops", userId: "user_123" });
    expect(result.workspace).not.toHaveProperty("email"); expect(result.workspace).not.toHaveProperty("members");
  });
  it("validates exact workspace and maps credential/rate errors safely", async () => {
    await expect(new ClayApiAdapter(async () => json({ message: credentials.apiKey }, 401)).health(credentials)).rejects.toMatchObject({ code: "credential_missing", message: "Clay Public API request failed." });
    await expect(new ClayApiAdapter(async () => json({ user: { id: "user_1" } })).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new ClayApiAdapter(async () => json({}, 429)).health(credentials)).rejects.toMatchObject({ code: "provider_rate_limited" });
  });
});
