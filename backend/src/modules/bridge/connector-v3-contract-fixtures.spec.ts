import { readFileSync } from "fs";
import { resolve } from "path";
import { RELAY_RUNTIME_CONNECTOR_PROTOCOLS } from "./bridge-compatibility-policy";

const fixtureDirectory = resolve(
  __dirname,
  "../../../../docs/native-agent-connection/fixtures",
);

function fixture<T extends Record<string, any>>(name: string): T {
  return JSON.parse(readFileSync(resolve(fixtureDirectory, name), "utf8")) as T;
}

describe("native-agent connector v3 shared contract fixtures", () => {
  it("keeps the inventory fixture metadata-only and path-free", () => {
    const request = fixture("connector-v3-inventory-request.json");

    expect(RELAY_RUNTIME_CONNECTOR_PROTOCOLS).toContain(
      request.protocolVersion,
    );
    expect(request.completeInventory).toBe(true);
    expect(request.agents).toHaveLength(1);
    expect(request.agents[0].documents).toEqual([]);
    expect(JSON.stringify(request)).not.toMatch(
      /(?:\/Users\/|\/home\/|[A-Za-z]:\\\\|credential|accessToken|apiKey)/,
    );
  });

  it("uses only supported directives and requires consent before document sync", () => {
    const inventory = fixture("connector-v3-inventory-response.json");
    const connect = fixture("connector-v3-connect-directive.json");
    const directives = new Set([
      "metadata_only",
      "connect",
      "synchronize",
      "disconnect",
      "quarantine",
    ]);

    expect(directives.has(inventory.discoveries[0].directive)).toBe(true);
    expect(inventory.discoveries[0].documentSync).toBe(false);
    expect(directives.has(connect.directive)).toBe(true);
    expect(connect.documentConsentVersion).toBeGreaterThanOrEqual(1);
    expect(connect.documentSync).toBe(true);
    expect(connect.bindingEpoch).toMatch(/^[1-9][0-9]*$/);
  });

  it("binds provision request and result to one host, job, command, and idempotency key", () => {
    const request = fixture("connector-v3-provision-request.json");
    const result = fixture("connector-v3-provision-result.json");

    for (const key of [
      "commandId",
      "jobId",
      "workspaceId",
      "runtimeHostId",
      "runtimeType",
      "idempotencyKey",
    ]) {
      expect(result[key]).toBe(request[key]);
    }
    expect(request.runtimeHostId).toBeTruthy();
    expect(request.expectedBindingEpoch).toBe(result.appliedBindingEpoch);
    expect(result.status).toBe("ready");
    expect(result.externalAgentId).toBe(request.payload.slug);
  });
});
