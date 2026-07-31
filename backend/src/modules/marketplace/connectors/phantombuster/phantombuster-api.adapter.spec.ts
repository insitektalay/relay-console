import { PhantomBusterApiAdapter } from "./phantombuster-api.adapter";
const credentials = { apiKey: "fixture-key", agentId: "2008952215470815" }; const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });
describe("PhantomBusterApiAdapter", () => {
  it("pins exact Agent fetch and redacts outputs, arguments, and file locations", async () => {
    const request = jest.fn(async () => json({ id: credentials.agentId, name: "Lead Phantom", status: "running", lastStart: 123, argument: { sessionCookie: "secret" }, output: "private", s3Folder: "private-path" }));
    const result = await new PhantomBusterApiAdapter(request).getAgentStatus(credentials);
    expect(request).toHaveBeenCalledWith(`https://api.phantombuster.com/api/v2/agents/fetch?id=${credentials.agentId}`, expect.objectContaining({ method: "GET", headers: expect.objectContaining({ "X-Phantombuster-Key": credentials.apiKey }) }));
    expect(result.agent).toMatchObject({ agentId: credentials.agentId, name: "Lead Phantom", status: "running" }); expect(result.agent).not.toHaveProperty("argument"); expect(result.agent).not.toHaveProperty("output"); expect(result.agent).not.toHaveProperty("s3Folder");
  });
  it("rejects mismatched IDs and maps errors safely", async () => {
    await expect(new PhantomBusterApiAdapter(async () => json({ id: "99" })).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(new PhantomBusterApiAdapter(async () => json({ message: credentials.apiKey }, 401)).health(credentials)).rejects.toMatchObject({ code: "credential_missing", message: "PhantomBuster API request failed." });
  });
});
