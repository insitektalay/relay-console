import { VeroApiAdapter, type VeroCredentials } from "./vero-api.adapter";
import {
  VERO_MANAGE_OPERATION_IDS,
  VERO_OPERATIONS,
  VERO_SENSITIVE_READ_OPERATION_IDS,
  VERO_STRUCTURAL_READ_OPERATION_IDS,
} from "./vero-operation-registry";

describe("VeroApiAdapter", () => {
  const credentials: VeroCredentials = {
    trackingApiKey: "customer-tracking-key",
    campaignsApiKey: "customer-campaign-secret",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins the 24 selected operations and 10/2/12 policy split", () => {
    expect(VERO_OPERATIONS).toHaveLength(24);
    expect(VERO_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(10);
    expect(VERO_SENSITIVE_READ_OPERATION_IDS).toHaveLength(2);
    expect(VERO_MANAGE_OPERATION_IDS).toHaveLength(12);
  });

  it("pins the Campaigns API origin, revision, authorization, and first page", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    await new VeroApiAdapter().read(credentials, "list_broadcasts", {});
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.getvero.com/api/v2/broadcasts?limit=25",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({
        Authorization: "Bearer customer-campaign-secret",
        revision: "2026-03-01",
      }),
      redirect: "error",
    });
  });

  it("injects the tracking key in the body and requires consent attestation", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ status: 200 })));
    const adapter = new VeroApiAdapter();
    await expect(
      adapter.manage(credentials, "identify_user", {
        body: { id: "user-1", email: "user@example.com" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await adapter.manage(credentials, "identify_user", {
      body: { id: "user-1", email: "user@example.com" },
      consentAttestation: true,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      id: "user-1",
      email: "user@example.com",
      tracking_api_key: "customer-tracking-key",
    });
  });

  it("blocks delete, cross-policy use, scheduling, and credential inputs", async () => {
    const adapter = new VeroApiAdapter();
    expect(() => adapter.manage(credentials, "delete_user", {})).toThrow();
    expect(() => adapter.read(credentials, "track_event", {})).toThrow();
    await expect(
      adapter.manage(credentials, "create_broadcast", {
        body: { name: "Draft", schedule: { at: "tomorrow" } },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "edit_user_tags", {
        body: { id: "user-1", api_key: "agent-secret" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
