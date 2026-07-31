import { SendGridApiAdapter, SendGridApiError, type SendGridCredentials } from "./sendgrid-api.adapter";

describe("SendGridApiAdapter", () => {
  const credentials: SendGridCredentials = { apiKey: "SG.test", region: "EU", senderBoundary: "example.com" };
  afterEach(() => jest.restoreAllMocks());

  it("uses the fixed regional origin and never exposes the API key", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 202 }));
    await new SendGridApiAdapter().sendMail(credentials, { message: { personalizations: [{ to: [{ email: "user@example.net" }] }], from: { email: "agent@example.com" }, subject: "Hello", content: [{ type: "text/plain", value: "Body" }] } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.eu.sendgrid.com/v3/mail/send");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer SG.test");
    expect(String(init?.body)).not.toContain("SG.test");
  });

  it("enforces sender, origin, and secret-field boundaries", async () => {
    const adapter = new SendGridApiAdapter();
    expect(() => adapter.sendMail(credentials, { message: { personalizations: [{ to: [{ email: "x@y.test" }] }], from: { email: "bad@other.test" } } })).toThrow(SendGridApiError);
    await expect(adapter.request(credentials, { method: "GET", path: "https://evil.test/v3/user/profile" })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.request(credentials, { method: "POST", path: "/v3/templates", json: { api_key: "leak" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
