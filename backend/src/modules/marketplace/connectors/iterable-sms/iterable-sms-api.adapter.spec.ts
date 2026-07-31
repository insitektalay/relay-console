import {
  IterableSmsApiAdapter,
  type IterableSmsCredentials,
} from "./iterable-sms-api.adapter";
import {
  ITERABLE_SMS_MANAGE_OPERATION_IDS,
  ITERABLE_SMS_OPERATIONS,
  ITERABLE_SMS_SAFE_READ_OPERATION_IDS,
  ITERABLE_SMS_SENSITIVE_READ_OPERATION_IDS,
} from "./iterable-sms-operation-registry";

describe("IterableSmsApiAdapter", () => {
  const credentials: IterableSmsCredentials = {
    apiKey: "sms-project-key",
    region: "us",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins the 13 SMS operations and 4/1/8 policy split", () => {
    expect(ITERABLE_SMS_OPERATIONS).toHaveLength(13);
    expect(ITERABLE_SMS_SAFE_READ_OPERATION_IDS).toHaveLength(4);
    expect(ITERABLE_SMS_SENSITIVE_READ_OPERATION_IDS).toHaveLength(1);
    expect(ITERABLE_SMS_MANAGE_OPERATION_IDS).toHaveLength(8);
  });

  it("pins the US origin, API key header, and SMS-only template filter", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ templates: [] })));
    await new IterableSmsApiAdapter().read(
      credentials,
      "list_sms_templates",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.iterable.com/api/templates?messageMedium=SMS&page=1&pageSize=50&sort=id",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({ "Api-Key": "sms-project-key" }),
      redirect: "error",
    });
  });

  it("blocks broader APIs, missing consent attestation, non-SMS fields, and secrets", async () => {
    const adapter = new IterableSmsApiAdapter();
    expect(() => adapter.read(credentials, "list_campaigns", {})).toThrow();
    await expect(
      adapter.manage(credentials, "send_sms", {
        body: { recipientEmail: "user@example.com" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "update_sms_user", {
        consentAttestation: true,
        body: {
          email: "user@example.com",
          dataFields: { phoneNumber: "+14155550132", loyalty: 5 },
        },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.manage(credentials, "cancel_sms", {
        body: { authToken: "secret" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
