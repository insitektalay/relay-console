import {
  LOCAL_APP_CONNECTOR_DEFAULT_RUNTIME_PROFILE,
  resolveLocalAppRuntimeProfile,
} from "./local-app-runtime-profile";

describe("local app runtime profile", () => {
  it("provides the LocalAppConnector runtime recovery defaults", () => {
    expect(
      resolveLocalAppRuntimeProfile({
        appSlug: "local-localappconnector",
        appName: "LocalAppConnector",
      }),
    ).toEqual(LOCAL_APP_CONNECTOR_DEFAULT_RUNTIME_PROFILE);
  });

  it("preserves hard-stop prompts and source-host details from metadata", () => {
    expect(
      resolveLocalAppRuntimeProfile({
        appSlug: "local-custom",
        repoPath: "/repo/app",
        metadata: {
          sourceHostId: "bridge-1",
          localAppUrl: "http://localhost:4000",
          runtimeProfile: {
            startCommand: "pnpm dev",
            healthCheckUrl: "http://localhost:4000/health",
            autoStartAllowed: true,
            hardStopConditions: ["install", "unknown interactive prompt"],
            expectedPorts: [4000],
          },
        },
      }),
    ).toMatchObject({
      repoPath: "/repo/app",
      appUrl: "http://localhost:4000",
      startCommand: "pnpm dev",
      healthCheckUrl: "http://localhost:4000/health",
      autoStartAllowed: true,
      hardStopConditions: ["install", "unknown interactive prompt"],
      expectedPorts: [4000],
      sourceHostId: "bridge-1",
    });
  });
});
