import { readFileSync } from "fs";
import { resolve } from "path";

const repoRoot = resolve(__dirname, "../../../..");

function source(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("user-managed Hermes and OpenClaw boundary", () => {
  it("does not expose Railway API or SDK routes that manage a runtime installation", () => {
    const files = [
      source("backend/src/modules/agent/agent.controller.ts"),
      source("backend/src/modules/agent/agent.service.ts"),
      source("backend/src/modules/bridge/bridge-capabilities.ts"),
      source("packages/web-sdk/src/index.ts"),
    ];

    for (const content of files) {
      expect(content).not.toContain("clawchat.host.harness_lifecycle");
      expect(content).not.toContain("harness/update");
      expect(content).not.toContain("harness/rollback");
      expect(content).not.toContain("clawchat.host.harness.update");
      expect(content).not.toContain("clawchat.host.harness.rollback");
    }
  });

  it("requires an authenticated bridge instead of mutating a runtime on Railway", () => {
    const service = source("backend/src/modules/agent/agent.service.ts");

    expect(service).toContain("hasBridgeControlSubscribers");
    expect(service).toContain("agent.provision.request");
    expect(service).toContain("configured Hermes runtime is offline");
    expect(service).toContain("host.bridgeDeviceId");
    expect(service).not.toContain("runLocalProvisioning");
    expect(service).not.toContain("OPENCLAW_HOME");
    expect(service).not.toContain('spawn("openclaw"');
    expect(service).not.toContain('runOpenClawCommand(["gateway", "restart"])');
  });

  it("keeps paired-host runtime lifecycle events unavailable", () => {
    const operations = source("claude-runtime/src/host-operations.ts");
    const controls = source("claude-runtime/src/control-runner.ts");
    const config = source("claude-runtime/src/config.ts");
    const entrypoint = source("claude-runtime/src/index.ts");

    expect(controls).not.toContain("clawchat.host.harness_lifecycle");
    expect(config).not.toContain("managedHarnesses");
    expect(entrypoint).not.toContain("calculateManagedTreeDigest");
    expect(entrypoint).not.toContain('command === "digest"');
    expect(operations).not.toContain("calculateManagedTreeDigest");
    expect(operations).not.toContain("private async updateHarness");
    expect(operations).not.toContain("private async rollbackHarness");
    expect(operations).not.toContain('case "clawchat.host.harness.status"');
    expect(operations).not.toContain('case "clawchat.host.harness.update"');
    expect(operations).not.toContain('case "clawchat.host.harness.rollback"');
  });

  it("keeps Swift lifecycle ownership fail closed and launch refresh disabled", () => {
    const manager = source(
      "RelayConsoleSwift/Sources/RelayConsoleCore/HarnessInstallManager.swift",
    );
    const services = source(
      "RelayConsoleSwift/Sources/RelayConsoleCore/RelayConsoleServices.swift",
    );

    expect(manager).toContain(
      "private var legacyManagedRuntimeActionsEnabled: Bool { false }",
    );
    for (const message of [
      "Relay Console does not install runtimes",
      "Relay Console does not update user-managed runtimes",
      "Relay Console does not roll back user-managed runtimes",
      "Authenticate with the model provider inside Hermes Agent or OpenClaw",
      "Start and stop the user-managed runtime outside Relay Console",
    ]) {
      expect(manager).toContain(message);
    }
    expect(services).toContain("launchRefreshTask = nil");
    expect(services).not.toContain(
      "harnessInstall.refreshInstalledHarnesses()",
    );
  });
});
