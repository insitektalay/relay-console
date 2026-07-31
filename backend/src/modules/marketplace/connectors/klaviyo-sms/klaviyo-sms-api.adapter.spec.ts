import {
  KlaviyoSmsApiAdapter,
  KlaviyoSmsApiError,
  type KlaviyoSmsCredentials,
} from "./klaviyo-sms-api.adapter";

describe("KlaviyoSmsApiAdapter", () => {
  const credentials: KlaviyoSmsCredentials = {
    accessToken: "oauth",
    accountId: "AbC123",
  };
  afterEach(() => jest.restoreAllMocks());
  it("pins the beta revision, origin, and bounded sender page", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );
    await new KlaviyoSmsApiAdapter().request(credentials, "list_senders", {});
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://a.klaviyo.com/api/text-messaging-senders/?page%5Bsize%5D=20&sort=-created_at",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>).revision,
    ).toBe("2026-07-15.pre");
  });
  it("rejects non-pinned operations and credential-bearing registration data", async () => {
    const adapter = new KlaviyoSmsApiAdapter();
    expect(() => adapter.request(credentials, "send_sms", {})).toThrow(
      KlaviyoSmsApiError,
    );
    await expect(
      adapter.request(credentials, "create_configuration", {
        data: {
          type: "text-messaging-configuration",
          attributes: { api_key: "leak" },
        },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
