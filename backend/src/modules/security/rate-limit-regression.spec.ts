import { readFileSync } from "fs";
import { resolve } from "path";

const backendRoot = resolve(__dirname, "../../..");

function readBackendFile(relativePath: string) {
  return readFileSync(resolve(backendRoot, relativePath), "utf8");
}

function expectThrottleNear(source: string, marker: string) {
  const markerIndex = source.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  const nearbyDecorators = source.slice(
    Math.max(0, markerIndex - 260),
    markerIndex + 260,
  );
  expect(nearbyDecorators).toContain("@Throttle");
}

describe("rate limit regressions", () => {
  it("registers the Nest throttler guard globally with a proxy-aware tracker", () => {
    const source = readBackendFile("src/app.module.ts");

    expect(source).toContain("provide: APP_GUARD");
    expect(source).toContain("useClass: AbuseThrottlerGuard");
    expect(source).toContain("getRateLimitTracker");
    expect(source).toContain("modules/security/client-ip");
    expect(source).toContain("DistributedRateLimitService");
    expect(source).toContain("storage,");

    const clientIp = readBackendFile("src/modules/security/client-ip.ts");
    expect(clientIp).toContain('"x-real-ip"');
    expect(clientIp).not.toContain("x-forwarded-for");
    expect(clientIp).not.toContain("cf-connecting-ip");

    const guard = readBackendFile(
      "src/modules/security/abuse-throttler.guard.ts",
    );
    expect(guard).toContain("security.rate_limit.exceeded");
    expect(guard).toContain("trackerHash");
    expect(guard).toContain("hashTracker");

    const gateway = readBackendFile("src/gateways/events.gateway.ts");
    expect(gateway).toContain("getRateLimitTracker");
    expect(gateway).toContain("socketRateLimitTrackers");
    expect(gateway).toContain("websocket.rate_limit.exceeded");
    expect(gateway).toContain("websocket.client.disconnected");
    expect(gateway).toContain("rateLimits.incrementNamed");
    expect(gateway).not.toContain("ipMessageBuckets");
    expect(gateway).not.toContain("socketMessageBuckets");
    expect(gateway).not.toContain('request.socket.remoteAddress ?? "unknown"');

    const distributedStore = readBackendFile(
      "src/modules/security/distributed-rate-limit.service.ts",
    );
    expect(distributedStore).toContain('redis.call("INCR"');
    expect(distributedStore).toContain('redis.call("PEXPIRE"');
    expect(distributedStore).toContain("RATE_LIMIT_FALLBACK_CAPACITY");
    expect(distributedStore).toContain(
      "while (this.fallback.size >= capacity)",
    );
  });

  it("keeps stricter throttles on public credential-bearing auth surfaces", () => {
    const auth = readBackendFile("src/modules/auth/auth.controller.ts");
    const waitlist = readBackendFile(
      "src/modules/waitlist/waitlist.controller.ts",
    );

    expect(auth).toContain("AUTH_CREDENTIAL_RATE_LIMIT");
    expect(auth).toContain("AUTH_REFRESH_RATE_LIMIT");
    expect(auth).toContain("getTrustedClientIp");
    expect(auth).not.toContain("x-forwarded-for");

    for (const marker of [
      "@Post('register')",
      "@Post('password-reset/request')",
      "@Post('login')",
      "@Post('refresh')",
      "@Post('web/login')",
      "@Post('web/register')",
      "@Post('web/refresh')",
    ]) {
      expectThrottleNear(auth, marker);
    }
    expectThrottleNear(waitlist, "@Post()");
  });

  it("keeps stricter throttles on bridge enrollment creation and redemption", () => {
    const source = readBackendFile("src/modules/bridge/bridge.controller.ts");

    expectThrottleNear(source, '@Post("enroll")');
    expectThrottleNear(source, '@Post("device/auth")');
    expectThrottleNear(source, '@Post("workspaces/:id/enrollments")');
  });

  it("keeps throttles on marketplace tool request and runtime execution paths", () => {
    const marketplace = readBackendFile(
      "src/modules/marketplace/marketplace.controller.ts",
    );
    const localappconnectorTools = readBackendFile(
      "src/modules/marketplace/localappconnector-agent-api-tools.controller.ts",
    );
    const xTools = readBackendFile(
      "src/modules/marketplace/x-marketplace.controller.ts",
    );

    expectThrottleNear(marketplace, '@Post("tool-requests")');
    expectThrottleNear(
      localappconnectorTools,
      "export class LocalAppConnectorAgentApiBridgeToolsController",
    );
    expectThrottleNear(
      xTools,
      "export class XMarketplaceBridgeToolsController",
    );
  });
});
