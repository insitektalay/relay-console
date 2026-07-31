import { MailgunApiAdapter, MailgunApiError, type MailgunCredentials } from "./mailgun-api.adapter";

describe("MailgunApiAdapter", () => {
  const account: MailgunCredentials = { apiKey: "key-test", domain: "mg.example.com", region: "EU", keyType: "account" };

  afterEach(() => jest.restoreAllMocks());

  it("uses the fixed regional origin, bound domain, and redacts secrets", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "queued", api_key: "must-not-leak" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await new MailgunApiAdapter().sendMessage(account, { from: "Agent <agent@mg.example.com>", to: ["user@example.net"], subject: "Hello", text: "Body" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.eu.mailgun.net/v3/mg.example.com/messages");
    expect((init?.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
    expect(JSON.stringify(result)).toContain("[REDACTED]");
  });

  it("rejects arbitrary origins, another domain, and secret-bearing raw fields", async () => {
    const adapter = new MailgunApiAdapter();
    await expect(adapter.request(account, { method: "GET", path: "https://evil.example/v3/domains" })).rejects.toBeInstanceOf(MailgunApiError);
    await expect(adapter.request(account, { method: "GET", path: "/v3/other.example.com/events" })).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(adapter.request(account, { method: "POST", path: "/v3/routes", fields: { apiKey: "leak" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("limits domain sending keys to sends for their bound domain", async () => {
    const sendOnly = { ...account, keyType: "domain_sending" as const };
    expect(() => new MailgunApiAdapter().getDomain(sendOnly)).toThrow(MailgunApiError);
    await expect(new MailgunApiAdapter().request(sendOnly, { method: "GET", path: "/v3/mg.example.com/events" })).rejects.toMatchObject({ code: "insufficient_scope" });
  });
});
