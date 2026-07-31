import { ConfigService } from "@nestjs/config";
import { RailwayManagedRuntimeProvider } from "./railway-managed-runtime.provider";

const configuredValues: Record<string, string> = {
  RELAY_MANAGED_RAILWAY_TOKEN: "railway-workspace-token",
  RELAY_MANAGED_RAILWAY_PROJECT_ID: "project-1",
  RELAY_MANAGED_RAILWAY_ENVIRONMENT_ID: "environment-1",
  RELAY_MANAGED_HERMES_IMAGE:
    "registry.example/relay-hermes@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY:
    "managed-runtime-credential-master-key-with-enough-entropy",
};

function runtime(overrides: Record<string, unknown> = {}) {
  return {
    id: "runtime-1",
    workspaceId: "workspace-1",
    agentId: "11111111-1111-4111-8111-111111111111",
    providerRuntimeReference: "service-1",
    providerVolumeReference: "volume-1",
    metadata: {},
    ...overrides,
  } as any;
}

function provider(values: Record<string, string> = configuredValues) {
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  return new RailwayManagedRuntimeProvider(config);
}

function graphqlResult(data: Record<string, unknown>) {
  return Promise.resolve({
    ok: true,
    json: async () => ({ data }),
  } as Response);
}

describe("RailwayManagedRuntimeProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("fails closed unless every isolated-provider setting is configured", () => {
    expect(provider().isConfigured()).toBe(true);
    expect(
      provider({
        ...configuredValues,
        MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY: "",
      }).isConfigured(),
    ).toBe(false);
  });

  it("reuses isolated resources and deploys only on Railway private networking", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() =>
        graphqlResult({ variableCollectionUpsert: true }),
      )
      .mockImplementationOnce(() =>
        graphqlResult({ serviceInstanceDeploy: "deployment-1" }),
      );
    global.fetch = fetchMock as typeof fetch;

    const result = await provider().provision(runtime());
    expect(result).toMatchObject({
      serviceId: "service-1",
      volumeId: "volume-1",
      deploymentId: "deployment-1",
      serviceName: "relay-hermes-runtime-1",
      workerBaseUrl:
        "http://relay-hermes-runtime-1.railway.internal:8765",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requests = fetchMock.mock.calls.map((call) =>
      JSON.parse(String((call[1] as RequestInit).body)),
    );
    expect(requests[0].query).toContain("variableCollectionUpsert");
    expect(requests[0].variables.input).toMatchObject({
      projectId: "project-1",
      environmentId: "environment-1",
      serviceId: "service-1",
      skipDeploys: true,
      variables: expect.objectContaining({
        HERMES_WORKER_ENV: "production",
        HERMES_WORKSPACE_ROOT: "/data/workspace",
        HERMES_WORKSPACE_KEY: "runtime-1",
        HERMES_WORKER_FORBIDDEN_TOOLSETS: "session_search,terminal",
      }),
    });
    expect(JSON.stringify(requests)).not.toContain("serviceCreate");
    expect(JSON.stringify(requests)).not.toContain("volumeCreate");
    expect(JSON.stringify(requests)).not.toContain("serviceDomainCreate");
  });

  it("rejects mutable worker image tags", async () => {
    await expect(
      provider({
        ...configuredValues,
        RELAY_MANAGED_HERMES_IMAGE: "registry.example/relay-hermes:latest",
      }).provision(runtime()),
    ).rejects.toThrow("MUST_BE_DIGEST_PINNED");
  });

  it("sends a fresh model credential only to Railway variables and does not echo it", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() =>
        graphqlResult({ variableCollectionUpsert: true }),
      )
      .mockImplementationOnce(() =>
        graphqlResult({ serviceInstanceDeploy: "deployment-2" }),
      );
    global.fetch = fetchMock as typeof fetch;
    const credential = "sk-ant-fresh-provider-credential";

    const result = await provider().authorizeModel(runtime(), {
      provider: "anthropic",
      credential,
    });
    const variableRequest = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    );
    expect(variableRequest.variables.input.variables.ANTHROPIC_API_KEY).toBe(
      credential,
    );
    expect(result).toEqual({
      variableName: "ANTHROPIC_API_KEY",
      credentialPersistedInRelayDatabase: false,
    });
    expect(JSON.stringify(result)).not.toContain(credential);
  });

  it("requests retained volume deletion before deleting the service", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => graphqlResult({ volumeDelete: true }))
      .mockImplementationOnce(() => graphqlResult({ serviceDelete: true }));
    global.fetch = fetchMock as typeof fetch;

    await provider().decommission(runtime());
    const queries = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)).query,
    );
    expect(queries[0]).toContain("volumeDelete");
    expect(queries[1]).toContain("serviceDelete");
  });

  it("reads bounded storage usage from the authenticated managed worker health route", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() =>
        graphqlResult({
          deployments: {
            edges: [{
              node: {
                id: "deployment-1",
                status: "SUCCESS",
                createdAt: "2026-07-24T12:00:00.000Z",
              },
            }],
          },
        }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ok", storageUsedBytes: 12_345 }),
      } as Response);
    global.fetch = fetchMock as typeof fetch;

    const result = await provider().health(runtime());

    expect(result.storageUsedBytes).toBe("12345");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://relay-hermes-runtime-1.railway.internal:8765/health",
    );
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toEqual({
      Authorization: expect.stringMatching(/^Bearer /),
    });
  });

  it("derives distinct per-runtime credentials and rotates them with the master key", () => {
    const first = provider().workerTarget(runtime());
    const otherRuntime = provider().workerTarget(runtime({ id: "runtime-2" }));
    const rotated = provider({
      ...configuredValues,
      MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY:
        "different-managed-runtime-master-key-with-enough-entropy",
    }).workerTarget(runtime());

    expect(first.baseUrl).toBe(
      "http://relay-hermes-runtime-1.railway.internal:8765",
    );
    expect(first.sharedSecret).not.toBe(otherRuntime.sharedSecret);
    expect(first.sharedSecret).not.toBe(rotated.sharedSecret);
    expect(first.sharedSecret).toHaveLength(43);
  });

  it("rejects an undersized credential master key", () => {
    const undersized = provider({
        ...configuredValues,
        MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY: "short",
      });
    expect(undersized.isConfigured()).toBe(false);
    expect(() => undersized.workerTarget(runtime())).toThrow("TOO_SHORT");
  });
});
