import { existsSync, readFileSync } from "fs";
import { join } from "path";

const read = (relativePath: string) =>
  readFileSync(join(__dirname, relativePath), "utf8");

describe("JWT credential-family source boundary", () => {
  const authService = read("auth.service.ts");
  const authController = read("auth.controller.ts");
  const strategy = read("strategies/jwt.strategy.ts");
  const events = read("../../gateways/events.gateway.ts");
  const realtimeAuth = read("../../gateways/realtime-auth-policy.ts");
  const bridge = read("../bridge/bridge.service.ts");
  const bridgeCredentials = read("../bridge/bridge-device-credentials.ts");
  const bridgePolicy = read("../bridge/bridge-token-policy.ts");
  const entitlement = read("../cloud-commercial/entitlement-write.guard.ts");

  it("covers every first-party JWT family with its dedicated audience", () => {
    const combined = [
      authService,
      authController,
      strategy,
      events,
      realtimeAuth,
      bridge,
      bridgeCredentials,
      bridgePolicy,
      entitlement,
    ].join("\n");
    for (const audienceKey of [
      "webAccess",
      "mobileAccess",
      "webRefresh",
      "mobileRefresh",
      "browserWebsocket",
      "bridgeAccess",
      "bridgeWebsocket",
    ]) {
      expect(combined).toContain(`RELAY_JWT_AUDIENCES.${audienceKey}`);
    }
    expect(combined).not.toContain("clawchat-bridge-api");
    expect(combined).not.toContain("clawchat-bridge-websocket");
  });

  it("allow-lists HS256 on issuance and verification boundaries", () => {
    for (const source of [
      authService,
      authController,
      strategy,
      realtimeAuth,
      bridgeCredentials,
      entitlement,
    ]) {
      expect(source).toContain("RELAY_JWT_ALGORITHM");
    }
    expect(realtimeAuth).not.toMatch(/verify\(token,\s*\{\s*secret\s*\}\)/);
    expect(authController).toMatch(
      /verifyAsync\(token,\s*\{[\s\S]{0,500}audience,[\s\S]{0,200}algorithms:\s*\[RELAY_JWT_ALGORITHM\]/,
    );
  });

  it("has no generic refresh Passport strategy or sid-less mobile compatibility path", () => {
    expect(
      existsSync(join(__dirname, "strategies/jwt-refresh.strategy.ts")),
    ).toBe(false);
    expect(read("auth.module.ts")).not.toContain("JwtRefreshStrategy");
    expect(strategy).not.toContain("legacyRefreshToken");
    expect(strategy).not.toContain("Temporary compatibility");
    expect(authService).not.toContain("Legacy token path");
  });

  it("keeps opaque account-action and bridge device credentials outside JWT policy", () => {
    expect(authService).toContain('randomBytes(32).toString("base64url")');
    expect(authService).toContain('createHash("sha256")');
    expect(bridgeCredentials).toContain("hashOpaqueSecret");
    expect(bridgeCredentials).toContain(
      'randomBytes(32).toString("base64url")',
    );
  });
});
