import {
  evaluateRelayClientVersion,
  RELAY_MINIMUM_CLIENTS,
} from "./client-compatibility-policy";

describe("Relay client compatibility policy", () => {
  it("matches the actual first-release client artifacts", () => {
    expect(RELAY_MINIMUM_CLIENTS).toEqual({
      relayConsoleSwift: "0.1.0",
      ios: "1.0.0",
      web: "0.0.1",
    });
  });

  it.each([
    ["relayConsoleSwift", "0.1.0"],
    ["relay_console_swift", "0.1"],
    ["ios", "1.0"],
    ["web", "0.0.1"],
    ["web", "0.1.0"],
  ])("accepts supported %s version %s", (kind, version) => {
    expect(evaluateRelayClientVersion(kind, version)).toMatchObject({
      compatible: true,
      blockWrites: false,
      code: null,
    });
  });

  it.each([
    ["relay_console_swift", "0.0.9", "CLIENT_UPGRADE_REQUIRED"],
    ["ios", "0.9.9", "CLIENT_UPGRADE_REQUIRED"],
    ["web", "dev", "CLIENT_VERSION_INVALID"],
    ["unknown", "1.0.0", "UNSUPPORTED_CLIENT_KIND"],
  ])("rejects unsupported %s version %s", (kind, version, code) => {
    expect(evaluateRelayClientVersion(kind, version)).toMatchObject({
      compatible: false,
      blockWrites: true,
      code,
    });
  });
});
