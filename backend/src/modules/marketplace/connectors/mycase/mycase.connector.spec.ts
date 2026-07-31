import { MyCaseApiAdapter, MyCaseApiError } from "./mycase-api.adapter";
import { MYCASE_CONNECTOR_MANIFEST } from "./mycase.connector";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("MyCase connector", () => {
  const credentials = { accessToken: "test-access-token" };

  it("exposes one approval-gated identity-free authority read", () => {
    expect(MYCASE_CONNECTOR_MANIFEST.slug).toBe("mycase");
    expect(MYCASE_CONNECTOR_MANIFEST.auth.type).toBe("custom");
    expect(MYCASE_CONNECTOR_MANIFEST.tools).toHaveLength(1);
    expect(MYCASE_CONNECTOR_MANIFEST.tools[0]).toMatchObject({ name: "myCase.getConnectionAuthority", approvalRequired: true });
  });

  it("uses one fixed endpoint and strips firm and legal-practice data", async () => {
    const requester = jest.fn().mockResolvedValue(json({ data: { id: 123, name: "Secret Firm", contacts: [{ email: "secret@example.com" }] } }));
    await expect(new MyCaseApiAdapter(requester).getConnectionAuthority(credentials)).resolves.toEqual({
      authorized: true,
      apiVersion: "v1",
      redactionStatus: "firm-user-and-legal-practice-data-excluded",
    });
    expect(String(requester.mock.calls[0][0])).toBe("https://external-integrations.mycase.com/v1/firm");
    expect(requester.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "error" });
  });

  it("rejects malformed tokens and incomplete authority", async () => {
    const requester = jest.fn();
    await expect(new MyCaseApiAdapter(requester).health({ accessToken: "bad\ntoken" })).rejects.toBeInstanceOf(MyCaseApiError);
    expect(requester).not.toHaveBeenCalled();
    await expect(new MyCaseApiAdapter(jest.fn().mockResolvedValue(json({ data: {} }))).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("preserves provider rate limits and response bounds", async () => {
    await expect(new MyCaseApiAdapter(jest.fn().mockResolvedValue(json({}, 429))).health(credentials)).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    await expect(new MyCaseApiAdapter(jest.fn().mockResolvedValue(new Response("x".repeat(1_000_001)))).health(credentials)).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
