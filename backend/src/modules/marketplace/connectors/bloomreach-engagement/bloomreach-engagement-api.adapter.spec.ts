import {
  BloomreachEngagementApiAdapter,
  type BloomreachEngagementCredentials,
} from "./bloomreach-engagement-api.adapter";
import {
  BLOOMREACH_ENGAGEMENT_MANAGE_OPERATION_IDS,
  BLOOMREACH_ENGAGEMENT_OPERATIONS,
  BLOOMREACH_ENGAGEMENT_SENSITIVE_READ_OPERATION_IDS,
  BLOOMREACH_ENGAGEMENT_STRUCTURAL_READ_OPERATION_IDS,
} from "./bloomreach-engagement-operation-registry";
describe("BloomreachEngagementApiAdapter", () => {
  const credentials: BloomreachEngagementCredentials = {
    projectToken: "project-123",
    apiKeyId: "key-id",
    apiSecret: "secret",
  };
  afterEach(() => jest.restoreAllMocks());
  it("pins the 4 selected operations and 2/1/1 policy split", () => {
    expect(BLOOMREACH_ENGAGEMENT_OPERATIONS).toHaveLength(4);
    expect(BLOOMREACH_ENGAGEMENT_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(2);
    expect(BLOOMREACH_ENGAGEMENT_SENSITIVE_READ_OPERATION_IDS).toHaveLength(1);
    expect(BLOOMREACH_ENGAGEMENT_MANAGE_OPERATION_IDS).toHaveLength(1);
  });
  it("uses private Basic auth only at the fixed project-bound API route", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{"success":true,"data":[]}'));
    await new BloomreachEngagementApiAdapter().read(
      credentials,
      "list_catalogs",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.exponea.com/data/v2/projects/project-123/catalogs",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({
        Authorization: `Basic ${Buffer.from("key-id:secret").toString("base64")}`,
      }),
    });
  });
  it("builds a bounded exact-customer attribute request", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{"success":true,"data":[]}'));
    await new BloomreachEngagementApiAdapter().read(
      credentials,
      "get_customer_attributes",
      {
        customerIds: { registered: "person-1" },
        propertyNames: ["first_name"],
      },
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      customer_ids: { registered: "person-1" },
      attributes: [{ type: "property", property: "first_name" }],
    });
  });
  it("requires authorization and blocks consent-like properties", async () => {
    const adapter = new BloomreachEngagementApiAdapter();
    await expect(
      adapter.manage(credentials, "update_customer_properties", {
        customerIds: { registered: "person-1" },
        properties: { city: "Paris" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "update_customer_properties", {
        customerIds: { registered: "person-1" },
        properties: { email_consent: true },
        consentAttestation: true,
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
  it("blocks cross-policy and arbitrary operations", () => {
    const adapter = new BloomreachEngagementApiAdapter();
    expect(() =>
      adapter.read(credentials, "update_customer_properties", {}),
    ).toThrow();
    expect(() => adapter.manage(credentials, "send_email", {})).toThrow();
  });
});
