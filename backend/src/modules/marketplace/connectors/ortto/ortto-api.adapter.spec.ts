import { OrttoApiAdapter, type OrttoCredentials } from "./ortto-api.adapter";
import {
  ORTTO_MANAGE_OPERATION_IDS,
  ORTTO_OPERATIONS,
  ORTTO_SENSITIVE_READ_OPERATION_IDS,
  ORTTO_STRUCTURAL_READ_OPERATION_IDS,
} from "./ortto-operation-registry";

describe("OrttoApiAdapter", () => {
  const credentials: OrttoCredentials = {
    apiKey: "customer-custom-api-key",
    region: "eu",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins the 19 selected operations and 7/5/7 policy split", () => {
    expect(ORTTO_OPERATIONS).toHaveLength(19);
    expect(ORTTO_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(7);
    expect(ORTTO_SENSITIVE_READ_OPERATION_IDS).toHaveLength(5);
    expect(ORTTO_MANAGE_OPERATION_IDS).toHaveLength(7);
  });

  it("pins the EU v1 origin, custom-key header, and first audience page", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ audiences: [] })));
    await new OrttoApiAdapter().read(credentials, "list_audiences", {});
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.eu.ap3api.com/v1/audiences/get",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "X-Api-Key": "customer-custom-api-key",
      }),
      redirect: "error",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      limit: 50,
      offset: 0,
    });
  });

  it("blocks arbitrary operations, cross-policy use, forced refresh, and attachments", async () => {
    const adapter = new OrttoApiAdapter();
    expect(() => adapter.read(credentials, "export_campaign", {})).toThrow();
    expect(() => adapter.read(credentials, "merge_people", {})).toThrow();
    await expect(
      adapter.read(credentials, "get_report", {
        body: { report_id: "report-1", refresh: true },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "send_transactional_email", {
        body: {
          emails: [{ fields: { "str::email": "buyer@example.com" } }],
          asset: { attachments: [{ filename: "bulk.csv" }] },
        },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("requires recorded consent for opt-ins and caps record batches", async () => {
    const adapter = new OrttoApiAdapter();
    await expect(
      adapter.manage(credentials, "update_audience_subscription", {
        body: {
          audience_id: "audience-1",
          people: [{ email: "person@example.com", subscribed: true }],
        },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "merge_people", {
        body: { people: Array.from({ length: 26 }, () => ({ fields: {} })) },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
