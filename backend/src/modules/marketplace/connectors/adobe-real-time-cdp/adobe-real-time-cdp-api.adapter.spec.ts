import {
  AdobeRealTimeCdpApiAdapter,
  type AdobeRealTimeCdpCredentials,
} from "./adobe-real-time-cdp-api.adapter";
import {
  ADOBE_REAL_TIME_CDP_OPERATIONS,
  ADOBE_REAL_TIME_CDP_SENSITIVE_READ_OPERATION_IDS,
  ADOBE_REAL_TIME_CDP_STRUCTURAL_READ_OPERATION_IDS,
} from "./adobe-real-time-cdp-operation-registry";

describe("AdobeRealTimeCdpApiAdapter", () => {
  const credentials: AdobeRealTimeCdpCredentials = {
    clientId: "client",
    clientSecret: "secret",
    scopes: "openid,AdobeID",
    organizationId: "123456@AdobeOrg",
    sandboxName: "relay-stage",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins three reads with a 1/2 policy split", () => {
    expect(ADOBE_REAL_TIME_CDP_OPERATIONS).toHaveLength(3);
    expect(ADOBE_REAL_TIME_CDP_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(1);
    expect(ADOBE_REAL_TIME_CDP_SENSITIVE_READ_OPERATION_IDS).toHaveLength(2);
  });

  it("exchanges at fixed IMS and binds a bounded dataset request to org and sandbox", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"access_token":"ephemeral","expires_in":86399}'),
      )
      .mockResolvedValueOnce(new Response('{"dataset":{}}'));
    await new AdobeRealTimeCdpApiAdapter().read(
      credentials,
      "list_datasets",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://ims-na1.adobelogin.com/ims/token/v3",
    );
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://platform.adobe.io/data/foundation/catalog/dataSets?limit=20&properties=name%2Cdescription%2CschemaRef%2Cstate%2Ccreated%2Cupdated%2Ctags",
    );
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: "Bearer ephemeral",
      "x-api-key": "client",
      "x-gw-ims-org-id": "123456@AdobeOrg",
      "x-sandbox-name": "relay-stage",
    });
  });

  it("pins an exact profile and allowlisted fields", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"access_token":"ephemeral","expires_in":3600}'),
      )
      .mockResolvedValueOnce(new Response('{"profile":{}}'));
    await new AdobeRealTimeCdpApiAdapter().read(credentials, "get_profile", {
      entityId: "person@example.com",
      entityIdNamespace: "email",
      fields: ["person.name", "workEmail"],
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "schema.name=_xdm.context.profile",
    );
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "entityId=person%40example.com",
    );
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "fields=person.name%2CworkEmail",
    );
  });

  it("blocks unallowlisted fields, routing input, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new AdobeRealTimeCdpApiAdapter();
    await expect(
      adapter.read(credentials, "get_profile", {
        entityId: "1",
        entityIdNamespace: "CRMID",
        fields: ["everything"],
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.read(credentials, "list_datasets", { sandbox: "prod" } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(() => adapter.read(credentials, "delete_profile", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
