import {
  SendlaneApiAdapter,
  type SendlaneCredentials,
} from "./sendlane-api.adapter";
import {
  SENDLANE_OPERATIONS,
  SENDLANE_READ_OPERATION_IDS,
  SENDLANE_TRACK_OPERATION_IDS,
} from "./sendlane-operation-registry";

describe("SendlaneApiAdapter", () => {
  const credentials: SendlaneCredentials = {
    apiToken: "account-api-v2-token",
    integrationToken: "custom-integration-token",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins the 7 agent-safe operations and 1/6 policy split", () => {
    expect(SENDLANE_OPERATIONS).toHaveLength(7);
    expect(SENDLANE_READ_OPERATION_IDS).toEqual(["list_senders"]);
    expect(SENDLANE_TRACK_OPERATION_IDS).toHaveLength(6);
  });

  it("pins the v2 bearer origin and injects the integration token", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ success: true })));
    await new SendlaneApiAdapter().track(credentials, "send_order_placed", {
      body: { order_id: "order-1", email: "buyer@example.com" },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.sendlane.com/v2/tracking/order-placed",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer account-api-v2-token",
      }),
      redirect: "error",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      order_id: "order-1",
      token: "custom-integration-token",
    });
  });

  it("blocks legacy, cross-policy, agent-supplied token, and credential URLs", async () => {
    const adapter = new SendlaneApiAdapter();
    expect(() =>
      adapter.read(credentials, "legacy_list_contacts", {}),
    ).toThrow();
    expect(() => adapter.read(credentials, "send_order_placed", {})).toThrow();
    await expect(
      adapter.track(credentials, "send_order_placed", {
        body: { order_id: "order-1", token: "agent-secret" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.track(credentials, "send_checkout_started", {
        body: { checkout_url: "https://shop.example/cart?token=leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
