import {
  BRIDGE_COMPATIBILITY_MANIFEST,
  evaluateBridgeCompatibility,
} from "./bridge-compatibility-policy";

describe("bridge compatibility policy", () => {
  const compatible = {
    runtimeType: "hermes",
    hostType: "macos-launchd",
    pluginVersion: "0.3.0-rc.5",
    runtimeVersion: "v2026.7.7.2",
    apiContractVersion: "v2",
    websocketContractVersion: "bridge.v1",
    capabilities: [
      "clawchat.runtime.hermes",
      "clawchat.runtime.structured_jobs",
    ],
  };

  it("accepts an exact advertised bridge, runtime, host, and contract tuple", () => {
    expect(evaluateBridgeCompatibility(compatible)).toMatchObject({
      compatible: true,
      code: null,
      runtimeType: "hermes",
      hostType: "macos-launchd",
      level: "verified",
      operatingMode: "full",
    });
  });

  it("accepts the Hermes 0.12.0 runtime installed by the supported CLI release", () => {
    expect(
      evaluateBridgeCompatibility({ ...compatible, runtimeVersion: "0.12.0" }),
    ).toMatchObject({ compatible: true, code: null });
  });

  it("admits the locally observed Hermes 0.15.1 release in safe mode", () => {
    expect(
      evaluateBridgeCompatibility({ ...compatible, runtimeVersion: "0.15.1" }),
    ).toMatchObject({
      compatible: true,
      level: "compatible",
      operatingMode: "safe",
      verifiedRuntime: false,
    });
  });

  it("keeps managed Hermes marketplace skill installation available in safe mode", () => {
    expect(
      evaluateBridgeCompatibility({
        ...compatible,
        runtimeVersion: "0.15.1",
        capabilities: [
          ...compatible.capabilities,
          "marketplaceHermesSkillInstall",
        ],
      }),
    ).toMatchObject({
      compatible: true,
      operatingMode: "safe",
      enabledCapabilities: [
        "clawchat.runtime.hermes",
        "marketplaceHermesSkillInstall",
      ],
    });
  });

  it("admits newer Hermes semver releases in capability-restricted safe mode", () => {
    expect(
      evaluateBridgeCompatibility({ ...compatible, runtimeVersion: "0.15.2" }),
    ).toMatchObject({
      compatible: true,
      code: null,
      level: "compatible",
      operatingMode: "safe",
      verifiedRuntime: false,
      enabledCapabilities: ["clawchat.runtime.hermes"],
      disabledCapabilities: ["clawchat.runtime.structured_jobs"],
      warnings: [
        "BRIDGE_RUNTIME_VERSION_UNVERIFIED",
        "BRIDGE_SAFE_MODE_CAPABILITIES_RESTRICTED",
      ],
    });
  });

  it("admits unparseable future runtime versions only in safe mode", () => {
    expect(
      evaluateBridgeCompatibility({
        ...compatible,
        runtimeVersion: "nightly-current",
      }),
    ).toMatchObject({
      compatible: true,
      level: "compatible",
      operatingMode: "safe",
      warnings: expect.arrayContaining(["BRIDGE_RUNTIME_VERSION_UNVERIFIED"]),
    });
  });

  it("accepts the current and two previous Hermes API v2 builds during rollout", () => {
    expect(evaluateBridgeCompatibility(compatible)).toMatchObject({
      compatible: true,
      code: null,
    });
    expect(
      evaluateBridgeCompatibility({
        ...compatible,
        pluginVersion: "0.3.0-rc.3",
      }),
    ).toMatchObject({
      compatible: true,
      code: null,
    });
    expect(
      evaluateBridgeCompatibility({
        ...compatible,
        pluginVersion: "0.3.0-rc.2",
      }),
    ).toMatchObject({
      compatible: true,
      code: null,
    });
    expect(
      evaluateBridgeCompatibility({
        ...compatible,
        pluginVersion: "0.3.0-rc.1",
      }),
    ).toMatchObject({
      compatible: false,
      code: "BRIDGE_PLUGIN_VERSION_UNSUPPORTED",
    });
  });

  it("accepts only the OpenClaw API v2 credential-persistence build", () => {
    const openclaw = {
      runtimeType: "openclaw",
      hostType: "linux-systemd",
      runtimeVersion: "v2026.6.11",
      apiContractVersion: "v2",
      websocketContractVersion: "bridge.v1",
    };
    expect(
      evaluateBridgeCompatibility({
        ...openclaw,
        pluginVersion: "2026.7.31-rc.1",
      }),
    ).toMatchObject({ compatible: true, code: null });
    expect(
      evaluateBridgeCompatibility({
        ...openclaw,
        pluginVersion: "2026.7.26-rc.1",
      }),
    ).toMatchObject({
      compatible: false,
      code: "BRIDGE_PLUGIN_VERSION_UNSUPPORTED",
    });
  });

  it("admits newer date-versioned OpenClaw releases in safe mode", () => {
    const result = evaluateBridgeCompatibility({
      runtimeType: "openclaw",
      hostType: "linux-systemd",
      pluginVersion: "2026.7.31-rc.1",
      runtimeVersion: "2026.8.4",
      apiContractVersion: "v2",
      websocketContractVersion: "bridge.v1",
      capabilities: [
        "clawchat.runtime.openclaw",
        "clawchat.runtime.structured_jobs",
      ],
    });
    expect(result).toMatchObject({
      compatible: true,
      level: "compatible",
      operatingMode: "safe",
      enabledCapabilities: ["clawchat.runtime.openclaw"],
      disabledCapabilities: ["clawchat.runtime.structured_jobs"],
    });
  });

  it.each([
    ["hermes", "0.12.0", "verified", "full", true],
    ["hermes", "0.15.1", "compatible", "safe", true],
    ["hermes", "0.99.0", "compatible", "safe", true],
    ["hermes", "1.0.0", "unsupported", "blocked", false],
    ["openclaw", "2026.6.11", "verified", "full", true],
    ["openclaw", "2026.12.1", "compatible", "safe", true],
    ["openclaw", "2025.12.31", "unsupported", "blocked", false],
  ])(
    "applies the rolling runtime matrix to %s %s",
    (runtimeType, runtimeVersion, level, operatingMode, accepted) => {
      const result = evaluateBridgeCompatibility({
        runtimeType,
        hostType: "macos-launchd",
        pluginVersion:
          runtimeType === "hermes" ? "0.3.0-rc.5" : "2026.7.31-rc.1",
        runtimeVersion,
        apiContractVersion: "v2",
        websocketContractVersion: "bridge.v1",
        capabilities: [`clawchat.runtime.${runtimeType}`],
      });
      expect(result).toMatchObject({
        compatible: accepted,
        level,
        operatingMode,
      });
    },
  );

  it("admits only the exact in-repository Claude runtime tuple", () => {
    const claude = {
      runtimeType: "claude_code",
      hostType: "macos-launchd",
      pluginVersion: "1.0.0",
      runtimeVersion: "1.0.0",
      apiContractVersion: "v2",
      websocketContractVersion: "bridge.v1",
    };

    expect(evaluateBridgeCompatibility(claude)).toMatchObject({
      compatible: true,
      code: null,
      runtimeType: "claude_code",
      hostType: "macos-launchd",
    });
    expect(
      evaluateBridgeCompatibility({
        ...claude,
        hostType: "linux-systemd",
      }),
    ).toMatchObject({
      compatible: false,
      code: "BRIDGE_HOST_UNSUPPORTED",
    });
    expect(
      evaluateBridgeCompatibility({ ...claude, pluginVersion: "1.0.1" }),
    ).toMatchObject({
      compatible: false,
      code: "BRIDGE_PLUGIN_VERSION_UNSUPPORTED",
    });
  });

  it.each([
    [{ ...compatible, runtimeType: undefined }, "BRIDGE_RUNTIME_TYPE_REQUIRED"],
    [{ ...compatible, hostType: "windows-service" }, "BRIDGE_HOST_UNSUPPORTED"],
    [
      { ...compatible, pluginVersion: "0.1.0" },
      "BRIDGE_PLUGIN_VERSION_UNSUPPORTED",
    ],
    [
      { ...compatible, runtimeVersion: "v2026.1.1" },
      "BRIDGE_RUNTIME_VERSION_UNSUPPORTED",
    ],
    [
      { ...compatible, apiContractVersion: "v1" },
      "BRIDGE_API_CONTRACT_MISMATCH",
    ],
    [
      { ...compatible, websocketContractVersion: "bridge.v2" },
      "BRIDGE_WEBSOCKET_CONTRACT_MISMATCH",
    ],
  ])("rejects an incompatible tuple with %s", (input, code) => {
    expect(evaluateBridgeCompatibility(input)).toMatchObject({
      compatible: false,
      code,
    });
  });

  it("pins the backend to the API v2 connector-v3 candidate", () => {
    expect(BRIDGE_COMPATIBILITY_MANIFEST).toMatchObject({
      schemaVersion: "relay.bridge-compatibility.v2",
      release: "v0.3.0-rc.7",
      releaseStatus: "preview",
      apiContract: "v2",
      websocketContract: "bridge.v1",
      runtimeConnectorContract: "relay-connector.v3",
      supportedRuntimeConnectorProtocols: [
        "agent-replica.v1",
        "relay-connector.v2",
        "relay-connector.v3",
      ],
      runtimeConnectorCompatibilityWindow: {
        "agent-replica.v1": {
          mode: "existing-bindings-only",
          newConnectionConsent: false,
          sunsetAt: "2026-09-30T23:59:59Z",
        },
        "relay-connector.v2": {
          mode: "existing-bindings-and-metadata-discovery",
          newConnectionConsent: false,
          sunsetAt: "2026-10-31T23:59:59Z",
        },
        "relay-connector.v3": {
          mode: "current",
          newConnectionConsent: true,
          sunsetAt: null,
        },
      },
      supportedBackend: {
        version: "1.0.0",
        commit: null,
        origin: "https://api.relayconsole.work",
      },
      plugins: {
        claude_code: {
          version: "1.0.0",
          supportedPluginVersions: ["1.0.0"],
          runtimeVersion: "1.0.0",
          candidateHostOS: ["macos-launchd"],
        },
        hermes: {
          version: "0.3.0-rc.6",
          supportedPluginVersions: [
            "0.3.0-rc.2",
            "0.3.0-rc.3",
            "0.3.0-rc.4",
            "0.3.0-rc.5",
            "0.3.0-rc.6",
          ],
          verifiedRuntimeVersions: ["v2026.7.7.2", "0.12.0"],
          runtimeDependencies: { python: { aiohttp: ">=3.10,<4" } },
        },
        openclaw: {
          version: "2026.7.31-rc.1",
          supportedPluginVersions: ["2026.7.31-rc.1"],
          runtimeVersionPolicy: expect.objectContaining({
            unknownRuntimeMode: "safe",
          }),
        },
      },
    });
  });
});
