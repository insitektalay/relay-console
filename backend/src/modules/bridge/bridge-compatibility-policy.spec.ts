import {
  BRIDGE_COMPATIBILITY_MANIFEST,
  evaluateBridgeCompatibility,
} from "./bridge-compatibility-policy";

describe("bridge compatibility policy", () => {
  const compatible = {
    runtimeType: "hermes",
    hostType: "macos-launchd",
    pluginVersion: "0.3.0-rc.2",
    runtimeVersion: "v2026.7.7.2",
    apiContractVersion: "v2",
    websocketContractVersion: "bridge.v1",
  };

  it("accepts an exact advertised bridge, runtime, host, and contract tuple", () => {
    expect(evaluateBridgeCompatibility(compatible)).toMatchObject({
      compatible: true,
      code: null,
      runtimeType: "hermes",
      hostType: "macos-launchd",
    });
  });

  it("accepts the Hermes 0.12.0 runtime installed by the supported CLI release", () => {
    expect(
      evaluateBridgeCompatibility({ ...compatible, runtimeVersion: "0.12.0" }),
    ).toMatchObject({ compatible: true, code: null });
  });

  it("accepts only the Hermes API v2 credential-persistence build", () => {
    expect(evaluateBridgeCompatibility(compatible)).toMatchObject({
      compatible: true,
      code: null,
    });
    expect(
      evaluateBridgeCompatibility({ ...compatible, pluginVersion: "0.3.0-rc.1" }),
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
      evaluateBridgeCompatibility({ ...openclaw, pluginVersion: "2026.7.31-rc.1" }),
    ).toMatchObject({ compatible: true, code: null });
    expect(
      evaluateBridgeCompatibility({ ...openclaw, pluginVersion: "2026.7.26-rc.1" }),
    ).toMatchObject({
      compatible: false,
      code: "BRIDGE_PLUGIN_VERSION_UNSUPPORTED",
    });
  });

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
      schemaVersion: "relay.bridge-compatibility.v1",
      release: "v0.3.0-rc.2",
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
          version: "0.3.0-rc.2",
          supportedPluginVersions: ["0.3.0-rc.2"],
          runtimeDependencies: { python: { aiohttp: "3.14.1" } },
        },
        openclaw: {
          version: "2026.7.31-rc.1",
          supportedPluginVersions: ["2026.7.31-rc.1"],
        },
      },
    });
  });
});
