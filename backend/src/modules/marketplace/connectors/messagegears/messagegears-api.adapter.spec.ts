import {
  MessageGearsApiAdapter,
  type MessageGearsCredentials,
} from "./messagegears-api.adapter";
import {
  MESSAGEGEARS_MANAGE_OPERATION_IDS,
  MESSAGEGEARS_OPERATIONS,
  MESSAGEGEARS_SENSITIVE_READ_OPERATION_IDS,
  MESSAGEGEARS_STRUCTURAL_READ_OPERATION_IDS,
} from "./messagegears-operation-registry";

describe("MessageGearsApiAdapter", () => {
  const credentials: MessageGearsCredentials = {
    accountId: "123456789",
    apiKey: "customer-api-key",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins the 5 selected operations and 1/2/2 policy split", () => {
    expect(MESSAGEGEARS_OPERATIONS).toHaveLength(5);
    expect(MESSAGEGEARS_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(1);
    expect(MESSAGEGEARS_SENSITIVE_READ_OPERATION_IDS).toHaveLength(2);
    expect(MESSAGEGEARS_MANAGE_OPERATION_IDS).toHaveLength(2);
  });

  it("pins the 3.1 URL and injects credentials only into the POST form", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          "<AccountSummaryResponse><Result>REQUEST_SUCCESSFUL</Result></AccountSummaryResponse>",
        ),
      );
    await new MessageGearsApiAdapter().read(
      credentials,
      "get_account_summary",
      { parameters: { ActivityDate: "2026-07-16" } },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.messagegears.net/3.1/WebService",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      redirect: "error",
    });
    const form = new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body));
    expect(Object.fromEntries(form)).toMatchObject({
      Action: "AccountSummary",
      AccountId: "123456789",
      ApiKey: "customer-api-key",
      ActivityDate: "2026-07-16",
    });
  });

  it("requires one recipient and authorization attestation for sends", async () => {
    const adapter = new MessageGearsApiAdapter();
    await expect(
      adapter.manage(credentials, "send_transactional_job", {
        parameters: {
          FromAddress: "sender@example.com",
          SubjectLine: "Receipt",
          RecipientXml:
            "<Recipient><EmailAddress>buyer@example.com</EmailAddress></Recipient>",
          TextTemplate: "Thanks",
        },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "send_transactional_job", {
        consentAttestation: true,
        parameters: {
          FromAddress: "sender@example.com",
          SubjectLine: "Receipt",
          RecipientXml:
            "<!DOCTYPE x><Recipient><EmailAddress>buyer@example.com</EmailAddress></Recipient>",
          TextTemplate: "Thanks",
        },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("blocks bulk sends, cross-policy use, and credential parameters", async () => {
    const adapter = new MessageGearsApiAdapter();
    expect(() => adapter.manage(credentials, "bulk_job_submit", {})).toThrow();
    expect(() =>
      adapter.read(credentials, "send_transactional_campaign", {}),
    ).toThrow();
    await expect(
      adapter.read(credentials, "get_bulk_job_summary", {
        parameters: { BulkJobRequestId: "job-1", ApiKey: "agent-secret" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
