import { PostmarkApiAdapter, PostmarkApiError, type PostmarkCredentials } from "./postmark-api.adapter";

describe("PostmarkApiAdapter", () => {
  const credentials: PostmarkCredentials = { serverToken: "server-test", accountToken: "account-test", senderBoundary: "example.com", messageStream: "outbound" };
  afterEach(() => jest.restoreAllMocks());
  it("uses fixed origin/server authority and redacts returned API tokens", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ ID: 1, ApiTokens: ["secret"] }), { status: 200 }));
    const result = await new PostmarkApiAdapter().getServer(credentials);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.postmarkapp.com/server");
    expect((init?.headers as Record<string, string>)["X-Postmark-Server-Token"]).toBe("server-test");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("enforces sender, stream, recipient, origin, and account-token boundaries", async () => {
    const adapter = new PostmarkApiAdapter();
    expect(() => adapter.sendEmail(credentials, { message: { From: "bad@other.test", To: "x@y.test" } })).toThrow(PostmarkApiError);
    expect(() => adapter.sendEmail(credentials, { message: { From: "ok@example.com", To: "x@y.test", MessageStream: "broadcasts" } })).toThrow(PostmarkApiError);
    await expect(adapter.request(credentials, { method: "GET", path: "https://evil.test/server" })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.request({ ...credentials, accountToken: undefined }, { authority: "account", method: "GET", path: "/servers" })).rejects.toMatchObject({ code: "credential_missing" });
  });
  it("accepts bounded batch arrays and rejects more than 500 messages", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify([{ ErrorCode: 0 }]), { status: 200 }));
    await new PostmarkApiAdapter().request(credentials, { method: "POST", path: "/email/batch", json: [{ From: "ok@example.com", To: "x@y.test" }] });
    expect(fetchMock.mock.calls[0][1]?.body).toBe('[{"From":"ok@example.com","To":"x@y.test"}]');
    await expect(new PostmarkApiAdapter().request(credentials, { method: "POST", path: "/email/batch", json: Array.from({ length: 501 }, () => ({})) })).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
