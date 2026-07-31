import { ManagedRuntimeService } from "./managed-runtime.service";
import { NotFoundException } from "@nestjs/common";

function runtime(overrides: Record<string, unknown> = {}) {
  return {
    id: "runtime-1",
    workspaceId: "workspace-1",
    agentId: null,
    runtimeHostId: "host-1",
    runtimeType: "hermes",
    status: "awaiting_model_authorization",
    ownershipType: "relay_managed",
    region: null,
    providerRuntimeReference: "service-1",
    providerVolumeReference: "volume-1",
    storageQuotaBytes: "21474836480",
    storageUsedBytes: "0",
    runtimeMinutesUsed: "0",
    lastMeteredAt: null,
    modelAuthorizationStatus: "required",
    lastHealthyAt: null,
    suspendedAt: null,
    cancellationRequestedAt: null,
    retentionEndsAt: null,
    deletedAt: null,
    metadata: { operationKey: "operation-1" },
    ...overrides,
  } as any;
}

describe("ManagedRuntimeService", () => {
  function build(current = runtime(), managedCloudEnabled = true) {
    const runtimes = {
      findOne: jest.fn(async () => current),
      save: jest.fn(async (value) => value),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => [current]),
        getOne: jest.fn(async () => null),
      })),
    } as any;
    const hostRepository = { update: jest.fn(async () => ({ affected: 1 })) };
    const dataSource = {
      getRepository: jest.fn(() => hostRepository),
      transaction: jest.fn(),
    } as any;
    const subscriptions = { findOne: jest.fn() } as any;
    const provider = {
      isConfigured: jest.fn(() => true),
      authorizeModel: jest.fn(async () => ({
        credentialPersistedInRelayDatabase: false,
      })),
      provision: jest.fn(async () => ({
        serviceId: "service-1",
        volumeId: "volume-1",
        serviceName: "relay-hermes-runtime-1",
        deploymentId: "deployment-1",
      })),
      health: jest.fn(async () => ({
        status: "success",
        storageUsedBytes: "4096",
      })),
      suspend: jest.fn(),
      resume: jest.fn(),
      decommission: jest.fn(async () => ({
        serviceDeleted: true,
        volumeDeletionRequested: true,
      })),
    } as any;
    const authority = {
      observeAgent: jest.fn(),
      assignExecutionOwner: jest.fn(),
      unlinkConnectAgent: jest.fn(async () => ({})),
    } as any;
    const config = {
      get: jest.fn((key: string) =>
        key === "RELAY_MANAGED_CLOUD_ENABLED" && managedCloudEnabled
          ? "true"
          : undefined,
      ),
    } as any;
    const service = new ManagedRuntimeService(
      dataSource,
      runtimes,
      subscriptions,
      provider,
      authority,
      config,
    );
    return {
      service,
      current,
      runtimes,
      provider,
      hostRepository,
      authority,
      config,
    };
  }

  it("fails closed on every operation that can launch or reactivate managed Cloud", async () => {
    const { service, provider, authority, runtimes } = build(
      runtime({ status: "suspended" }),
      false,
    );

    await expect(
      service.request({
        workspaceId: "workspace-1",
        operationKey: "operation-disabled",
        displayName: "Disabled Hermes",
      }),
    ).rejects.toThrow("RELAY_MANAGED_CLOUD_NOT_ENABLED");
    await expect(
      service.recordModelAuthorization("workspace-1", "runtime-1", {
        authorized: true,
        provider: "anthropic",
        credential: "never-forward-this",
      }),
    ).rejects.toThrow("RELAY_MANAGED_CLOUD_NOT_ENABLED");
    await expect(service.provision("workspace-1", "runtime-1")).rejects.toThrow(
      "RELAY_MANAGED_CLOUD_NOT_ENABLED",
    );
    await expect(
      service.refreshHealth("workspace-1", "runtime-1"),
    ).rejects.toThrow("RELAY_MANAGED_CLOUD_NOT_ENABLED");
    await expect(
      service.attachAgent("workspace-1", "runtime-1", {
        agentId: "agent-1",
      }),
    ).rejects.toThrow("RELAY_MANAGED_CLOUD_NOT_ENABLED");
    await expect(service.resume("workspace-1", "runtime-1")).rejects.toThrow(
      "RELAY_MANAGED_CLOUD_NOT_ENABLED",
    );

    expect(provider.authorizeModel).not.toHaveBeenCalled();
    expect(provider.provision).not.toHaveBeenCalled();
    expect(provider.health).not.toHaveBeenCalled();
    expect(provider.resume).not.toHaveBeenCalled();
    expect(authority.observeAgent).not.toHaveBeenCalled();
    expect(runtimes.save).not.toHaveBeenCalled();
  });

  it("keeps revocation and retention cleanup available while launch is disabled", async () => {
    const current = runtime({
      status: "online",
      agentId: "agent-1",
      lastMeteredAt: new Date(Date.now() - 60_000),
    });
    const { service, provider } = build(current, false);

    await expect(
      service.recordModelAuthorization("workspace-1", "runtime-1", {
        authorized: false,
      }),
    ).resolves.toMatchObject({
      status: "awaiting_model_authorization",
      modelAuthorizationStatus: "required",
    });
    current.status = "online";
    await expect(
      service.cancel("workspace-1", "runtime-1"),
    ).resolves.toMatchObject({ status: "cancellation_retention" });
    expect(provider.authorizeModel).not.toHaveBeenCalled();
  });

  it("does not poll or reactivate active runtimes while launch is disabled", async () => {
    const { service, provider } = build(runtime({ status: "online" }), false);
    await service.monitorManagedRuntimes();
    expect(provider.health).not.toHaveBeenCalled();
    expect(provider.resume).not.toHaveBeenCalled();
  });

  it("passes a fresh credential directly to Railway and never stores it in runtime metadata", async () => {
    const { service, current, provider, runtimes } = build();
    await service.recordModelAuthorization("workspace-1", "runtime-1", {
      authorized: true,
      provider: "anthropic",
      credential: "fresh-provider-secret-value",
    });
    expect(provider.authorizeModel).toHaveBeenCalledWith(
      current,
      expect.objectContaining({ credential: "fresh-provider-secret-value" }),
    );
    expect(JSON.stringify(runtimes.save.mock.calls)).not.toContain(
      "fresh-provider-secret-value",
    );
    expect(current).toMatchObject({
      status: "provisioning",
      modelAuthorizationStatus: "authorized",
      metadata: { credentialsCopiedFromLocalRuntime: false },
    });
  });

  it("provisions idempotent provider resources and retains only provider references", async () => {
    const { service, current, provider } = build();
    await service.provision("workspace-1", "runtime-1");
    expect(provider.provision).toHaveBeenCalledWith(current);
    expect(current).toMatchObject({
      providerRuntimeReference: "service-1",
      providerVolumeReference: "volume-1",
      status: "awaiting_model_authorization",
      metadata: {
        provider: "railway",
        providerEndpointKind: "railway_private",
        providerServiceName: "relay-hermes-runtime-1",
      },
    });
  });

  it("meters active runtime minutes and worker-reported storage without storing content", async () => {
    const current = runtime({
      status: "online",
      runtimeMinutesUsed: "10.000000",
      lastMeteredAt: new Date(Date.now() - 120_000),
    });
    const { service } = build(current);

    const result = await service.refreshHealth("workspace-1", "runtime-1");

    expect(Number(result.runtime.runtimeMinutesUsed)).toBeGreaterThanOrEqual(
      12,
    );
    expect(result.runtime.storageUsedBytes).toBe("4096");
    expect(result.runtime.lastMeteredAt).toBeInstanceOf(Date);
    expect(JSON.stringify(result.runtime)).not.toContain("fileBytes");
  });

  it("exports metering and retained references without credentials or artifact bytes", async () => {
    const { service } = build(
      runtime({
        runtimeMinutesUsed: "42.500000",
        storageUsedBytes: "8192",
      }),
    );

    const exported = await service.exportManifest("workspace-1", "runtime-1");

    expect(exported).toMatchObject({
      runtimeMinutesUsed: "42.500000",
      storageUsedBytes: "8192",
      credentialsIncluded: false,
      artifactBytesIncluded: false,
    });
    expect(JSON.stringify(exported)).not.toContain("providerRuntimeReference");
    expect(JSON.stringify(exported)).not.toContain("providerVolumeReference");
  });

  it("cancels into a recoverable 30-day retention state before provider deletion", async () => {
    const { service, current, provider, hostRepository, authority } = build(
      runtime({ status: "online", agentId: "agent-1" }),
    );
    const result = await service.cancel("workspace-1", "runtime-1");
    expect(provider.decommission).not.toHaveBeenCalled();
    expect(authority.unlinkConnectAgent).toHaveBeenCalledWith(
      "workspace-1",
      "agent-1",
    );
    expect(result.status).toBe("cancellation_retention");
    expect(
      result.retentionEndsAt.getTime() -
        result.cancellationRequestedAt.getTime(),
    ).toBe(30 * 24 * 60 * 60 * 1_000);
    expect(hostRepository.update).toHaveBeenCalledWith(
      { id: "host-1" },
      expect.objectContaining({ status: "retired" }),
    );
  });

  it("cancels safely when canonical ownership was already unlinked", async () => {
    const { service, current, authority } = build(
      runtime({ status: "online", agentId: "agent-1" }),
    );
    authority.unlinkConnectAgent.mockRejectedValueOnce(
      new NotFoundException("RUNTIME_BINDING_NOT_FOUND"),
    );
    const result = await service.cancel("workspace-1", "runtime-1");
    expect(authority.unlinkConnectAgent).toHaveBeenCalled();
    expect(result.status).toBe("cancellation_retention");
    expect(current.retentionEndsAt).toBeInstanceOf(Date);
  });

  it("decommissions service and volume only after retention expires", async () => {
    const expired = runtime({
      status: "cancellation_retention",
      retentionEndsAt: new Date(Date.now() - 1_000),
    });
    const { service, provider, runtimes } = build(expired);
    await service.monitorManagedRuntimes();
    expect(provider.decommission).toHaveBeenCalledWith(expired);
    expect(expired.status).toBe("deleted");
    expect(expired.deletedAt).toBeInstanceOf(Date);
    expect(runtimes.save).toHaveBeenCalledWith(expired);
  });
});
