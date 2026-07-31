import {
  EmarsysApiAdapter,
  type EmarsysCredentials,
} from "./emarsys-api.adapter";
import {
  EMARSYS_MANAGE_OPERATION_IDS,
  EMARSYS_OPERATIONS,
  EMARSYS_SENSITIVE_READ_OPERATION_IDS,
  EMARSYS_STRUCTURAL_READ_OPERATION_IDS,
} from "./emarsys-operation-registry";

describe("EmarsysApiAdapter", () => {
  const credentials: EmarsysCredentials = {
    clientId: "customer-client",
    clientSecret: "customer-secret",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins the 6 selected operations and 2/2/2 policy split", () => {
    expect(EMARSYS_OPERATIONS).toHaveLength(6);
    expect(EMARSYS_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(2);
    expect(EMARSYS_SENSITIVE_READ_OPERATION_IDS).toHaveLength(2);
    expect(EMARSYS_MANAGE_OPERATION_IDS).toHaveLength(2);
  });

  it("exchanges client credentials only at the fixed token origin and calls the fixed API", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"access_token":"ephemeral-token","expires_in":3600}'),
      )
      .mockResolvedValueOnce(new Response('{"replyCode":0,"data":[]}'));
    await new EmarsysApiAdapter().read(
      credentials,
      "list_available_fields",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://auth.emarsys.net/oauth2/token",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: "grant_type=client_credentials",
      redirect: "error",
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://api.emarsys.net/api/v3/field/translate/en",
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({
        Authorization: "Bearer ephemeral-token",
      }),
    });
  });

  it("requires contact authorization and double-opt-in evidence", async () => {
    const adapter = new EmarsysApiAdapter();
    await expect(
      adapter.manage(credentials, "create_contact", {
        email: "person@example.com",
        optIn: false,
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "create_contact", {
        email: "person@example.com",
        optIn: true,
        consentAttestation: true,
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("sends exactly one mapped contact and blocks cross-policy, arbitrary, and secret input", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"access_token":"ephemeral-token","expires_in":3600}'),
      )
      .mockResolvedValueOnce(
        new Response('{"replyCode":0,"data":{"ids":[1]}}'),
      );
    const adapter = new EmarsysApiAdapter();
    await adapter.manage(credentials, "create_contact", {
      email: "person@example.com",
      firstName: "Ari",
      optIn: true,
      consentAttestation: true,
      doubleOptInAttestation: true,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      key_id: "3",
      contacts: [{ "1": "Ari", "3": "person@example.com", "31": 1 }],
    });
    expect(() => adapter.read(credentials, "create_contact", {})).toThrow();
    expect(() =>
      adapter.manage(credentials, "trigger_external_event", {}),
    ).toThrow();
    await expect(
      adapter.read(credentials, "get_contact_by_email", {
        email: "person@example.com",
        clientSecret: "agent-secret",
      } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
