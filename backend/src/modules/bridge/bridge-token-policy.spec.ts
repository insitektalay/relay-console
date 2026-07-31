import {
  BRIDGE_ACCESS_AUDIENCE,
  BRIDGE_TOKEN_ISSUER,
  BRIDGE_WEBSOCKET_AUDIENCE,
  assertBridgeTokenEnvironment,
  isBridgeTokenId,
} from "./bridge-token-policy";

describe("bridge token policy", () => {
  it("uses short, bounded defaults and disjoint audiences", () => {
    expect(assertBridgeTokenEnvironment({})).toEqual({
      accessExpiresInSeconds: 900,
      websocketExpiresInSeconds: 300,
      expiredAccessGraceSeconds: 120,
    });
    expect(BRIDGE_TOKEN_ISSUER).toBe(
      "https://api.relayconsole.work/api/v1",
    );
    expect(BRIDGE_ACCESS_AUDIENCE).not.toBe(BRIDGE_WEBSOCKET_AUDIENCE);
  });

  it.each([
    ["BRIDGE_ACCESS_EXPIRES_IN", "14m"],
    ["BRIDGE_ACCESS_EXPIRES_IN", "61m"],
    ["BRIDGE_ACCESS_EXPIRES_IN", "900"],
    ["BRIDGE_WS_EXPIRES_IN", "16m"],
    ["BRIDGE_ACCESS_EXPIRED_GRACE_IN", "6m"],
    ["BRIDGE_ACCESS_EXPIRED_GRACE_IN", "30d"],
    ["BRIDGE_ACCESS_EXPIRED_GRACE_IN", "invalid"],
  ])("rejects unsafe %s=%s", (name, value) => {
    expect(() => assertBridgeTokenEnvironment({ [name]: value })).toThrow(name);
  });

  it("accepts bounded explicit durations and UUIDv4 token identifiers", () => {
    expect(
      assertBridgeTokenEnvironment({
        BRIDGE_ACCESS_EXPIRES_IN: "60m",
        BRIDGE_WS_EXPIRES_IN: "60s",
        BRIDGE_ACCESS_EXPIRED_GRACE_IN: "0s",
      }),
    ).toEqual({
      accessExpiresInSeconds: 3600,
      websocketExpiresInSeconds: 60,
      expiredAccessGraceSeconds: 0,
    });
    expect(isBridgeTokenId("5b8d6f1e-2d43-4bbc-8c9a-8f2a5d690b92")).toBe(
      true,
    );
    expect(isBridgeTokenId("predictable-token")).toBe(false);
  });
});
