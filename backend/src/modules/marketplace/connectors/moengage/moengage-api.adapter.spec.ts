import {
  MoEngageApiAdapter,
  type MoEngageCredentials,
} from "./moengage-api.adapter";
import {
  MOENGAGE_MANAGE_OPERATION_IDS,
  MOENGAGE_OPERATIONS,
  MOENGAGE_SENSITIVE_READ_OPERATION_IDS,
} from "./moengage-operation-registry";
describe("MoEngageApiAdapter", () => {
  const credentials: MoEngageCredentials = {
    workspaceId: "workspace",
    apiKey: "secret",
    dataCenter: "04",
    healthCustomerId: "health-user",
  };
  afterEach(() => jest.restoreAllMocks());
  it("pins the 2 selected operations and 0/1/1 policy split", () => {
    expect(MOENGAGE_OPERATIONS).toHaveLength(2);
    expect(MOENGAGE_SENSITIVE_READ_OPERATION_IDS).toHaveLength(1);
    expect(MOENGAGE_MANAGE_OPERATION_IDS).toHaveLength(1);
  });
  it("uses Basic auth on the enumerated data center for one exact-user read", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{"status":"success"}'));
    await new MoEngageApiAdapter().read(credentials, "get_user", {
      customerId: "person-1",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api-04.moengage.com/v1/customers/export?app_id=workspace",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: `Basic ${Buffer.from("workspace:secret").toString("base64")}`,
      }),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      data: {
        identifiers: [
          { identifier_type: "customer_id", identifier: "person-1" },
        ],
      },
    });
  });
  it("requires authorization and blocks consent-like attributes", async () => {
    const adapter = new MoEngageApiAdapter();
    await expect(
      adapter.manage(credentials, "update_user", {
        customerId: "person-1",
        attributes: { city: "Paris" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "update_user", {
        customerId: "person-1",
        attributes: { email_opt_in: true },
        consentAttestation: true,
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
  it("blocks invalid data centers, cross-policy calls, and arbitrary operations", async () => {
    const adapter = new MoEngageApiAdapter();
    expect(() => adapter.read(credentials, "update_user", {})).toThrow();
    expect(() => adapter.manage(credentials, "send_campaign", {})).toThrow();
    await expect(
      adapter.health({
        ...credentials,
        dataCenter: "https://attacker.example",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
