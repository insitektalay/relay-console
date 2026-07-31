import {
  MailchimpTransactionalApiAdapter,
  MailchimpTransactionalApiError,
  type MailchimpTransactionalCredentials,
} from "./mailchimp-transactional-api.adapter";

describe("MailchimpTransactionalApiAdapter", () => {
  const credentials: MailchimpTransactionalCredentials = {
    apiKey: "mandrill-key",
    senderBoundary: "example.com",
  };

  afterEach(() => jest.restoreAllMocks());

  it("uses the fixed JSON origin, injects the key server-side, and redacts it", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            username: "relay",
            key: "mandrill-key",
            quota: 100,
          }),
          { status: 200 },
        ),
      );

    const result = await new MailchimpTransactionalApiAdapter().getAccount(
      credentials,
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://mandrillapp.com/api/1.0/users/info.json");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ key: "mandrill-key" });
    expect(JSON.stringify(result)).not.toContain("mandrill-key");
  });

  it("enforces sender and raw-route boundaries", async () => {
    const adapter = new MailchimpTransactionalApiAdapter();
    expect(() =>
      adapter.sendMessage(credentials, {
        message: {
          from_email: "bad@other.test",
          to: [{ email: "user@example.net" }],
        },
      }),
    ).toThrow(MailchimpTransactionalApiError);
    await expect(
      adapter.request(credentials, {
        path: "/messages/send",
        payload: { message: {} },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.request(credentials, {
        path: "https://evil.test/users/info",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.request(credentials, {
        path: "/messages/search",
        payload: { api_keys: ["leak"] },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("sends through the approved sender wrapper with bounded recipients", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ status: "queued", _id: "message-1" }]), {
        status: 200,
      }),
    );

    await new MailchimpTransactionalApiAdapter().sendMessage(credentials, {
      message: {
        from_email: "agent@example.com",
        to: [{ email: "user@example.net", type: "to" }],
        subject: "Hello",
        text: "Body",
      },
    });

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://mandrillapp.com/api/1.0/messages/send.json",
    );
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain(
      "agent@example.com",
    );
  });
});
