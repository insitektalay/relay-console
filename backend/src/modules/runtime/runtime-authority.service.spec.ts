import { RuntimeAuthorityService } from "./runtime-authority.service";

describe("RuntimeAuthorityService observations", () => {
  function build(
    input: {
      mappedAgent?: any;
      existingObservation?: any;
      dataSource?: any;
    } = {},
  ) {
    const hosts = {} as any;
    const observations = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => input.existingObservation ?? null),
      create: jest.fn((value) => ({ id: "observation-new", ...value })),
      save: jest.fn(async (value) => value),
    } as any;
    const suppressions = { findOne: jest.fn(async () => null) } as any;
    const agentRepository = {
      findOne: jest.fn(async () => input.mappedAgent ?? null),
    };
    const dataSource = (input.dataSource ?? {
      getRepository: jest.fn(() => agentRepository),
    }) as any;
    const service = new RuntimeAuthorityService(
      dataSource,
      hosts,
      observations,
      suppressions,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, observations };
  }

  it("keeps the same external id on another host as a distinct native identity", async () => {
    const { service } = build();
    const result = await service.observeAgent({
      workspaceId: "workspace-1",
      runtimeHostId: "host-2",
      runtimeType: "hermes",
      externalAgentId: "shared-external-id",
      observedState: { displayName: "Same Friendly Name" },
    });
    expect(result).toMatchObject({ collision: false, suppressed: false });
    expect(result.observation).toMatchObject({
      agentId: null,
      status: "active",
      connectionState: "discovered",
      quarantineReason: null,
    });
  });

  it("maps an exact native identity when its canonical mapping agrees", async () => {
    const { service } = build({
      mappedAgent: { id: "agent-1", lifecycleStatus: "active" },
    });
    const result = await service.observeAgent({
      workspaceId: "workspace-1",
      runtimeHostId: "host-2",
      runtimeType: "hermes",
      externalAgentId: "shared-external-id",
      canonicalAgentId: "agent-1",
    });
    expect(result.collision).toBe(false);
    expect(result.observation).toMatchObject({
      agentId: "agent-1",
      status: "active",
      quarantineReason: null,
    });
  });

  it("quarantines an exact native identity when its canonical mapping changes", async () => {
    const { service } = build({
      mappedAgent: { id: "agent-2", lifecycleStatus: "active" },
      existingObservation: {
        id: "observation-1",
        agentId: "agent-1",
        connectionState: "connected",
        origin: "customer_existing",
        observedState: {},
        displayMetadata: {},
        capabilitySnapshot: {},
      },
    });
    const result = await service.observeAgent({
      workspaceId: "workspace-1",
      runtimeHostId: "host-1",
      runtimeType: "hermes",
      externalAgentId: "native-id",
      canonicalAgentId: "agent-2",
    });
    expect(result.collision).toBe(true);
    expect(result.observation).toMatchObject({
      status: "quarantined",
      connectionState: "quarantined",
      quarantineReason: "native_identity_mapping_conflict",
    });
  });

  it("uses a grace period before a missing inventory entry becomes unavailable", async () => {
    const observation = {
      id: "observation-1",
      workspaceId: "workspace-1",
      runtimeHostId: "host-1",
      runtimeType: "openclaw",
      externalAgentId: "native-agent-1",
      agentId: "agent-1",
      status: "active",
      connectionState: "connected",
      observedState: {},
      inventoryGeneration: "generation-1",
    };
    const { service, observations } = build();
    observations.find.mockResolvedValue([observation]);

    await expect(
      service.completeInventory({
        workspaceId: "workspace-1",
        runtimeHostId: "host-1",
        runtimeType: "openclaw",
        externalAgentIds: [],
        inventoryGeneration: "generation-2",
        observedAt: new Date("2026-07-26T10:00:00.000Z"),
      }),
    ).resolves.toEqual([]);
    expect(observation).toMatchObject({
      status: "active",
      connectionState: "connected",
      observedState: {
        missingFromCompleteInventoryAt: "2026-07-26T10:00:00.000Z",
      },
    });

    await expect(
      service.completeInventory({
        workspaceId: "workspace-1",
        runtimeHostId: "host-1",
        runtimeType: "openclaw",
        externalAgentIds: [],
        inventoryGeneration: "generation-3",
        observedAt: new Date("2026-07-26T10:05:01.000Z"),
      }),
    ).resolves.toEqual([observation]);
    expect(observation).toMatchObject({
      status: "stale",
      connectionState: "unavailable",
    });
  });

  it("clears the missing-inventory marker as soon as the native agent is observed again", async () => {
    const existingObservation = {
      id: "observation-1",
      agentId: "agent-1",
      connectionState: "connected",
      status: "active",
      origin: "customer_existing",
      observedState: {
        missingFromCompleteInventoryAt: "2026-07-26T10:00:00.000Z",
        retainedField: true,
      },
      displayMetadata: {},
      capabilitySnapshot: {},
    };
    const { service } = build({
      existingObservation,
      mappedAgent: { id: "agent-1", lifecycleStatus: "active" },
    });

    const result = await service.observeAgent({
      workspaceId: "workspace-1",
      runtimeHostId: "host-1",
      runtimeType: "openclaw",
      externalAgentId: "native-agent-1",
      canonicalAgentId: "agent-1",
    });

    expect(result.observation.observedState).toEqual({ retainedField: true });
  });

  it("activates only an explicitly reviewed quarantined observation", async () => {
    const observation = {
      id: "observation-1",
      workspaceId: "workspace-1",
      agentId: null,
      runtimeHostId: "host-1",
      runtimeType: "hermes",
      externalAgentId: "mike-hermes",
      status: "quarantined",
      quarantineReason: "external_agent_identity_collision",
      observedState: {},
    };
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(observation)
        .mockResolvedValueOnce({ id: "agent-1", lifecycleStatus: "active" })
        .mockResolvedValueOnce({ id: "host-1", status: "offline" })
        .mockResolvedValueOnce(null),
      find: jest.fn(async () => []),
      save: jest.fn(async (value) => value),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    const { service } = build({ dataSource });

    const result = await service.activateReviewedObservation({
      workspaceId: "workspace-1",
      observationId: "observation-1",
      canonicalAgentId: "agent-1",
      expectedRuntimeHostId: "host-1",
      expectedRuntimeType: "hermes",
      expectedExternalAgentId: "mike-hermes",
      reviewedByUserId: "user-1",
    });

    expect(result).toMatchObject({
      agentId: "agent-1",
      status: "active",
      quarantineReason: null,
      observedState: {
        authorityReview: {
          resolution: "activate_observation",
          reviewedByUserId: "user-1",
        },
      },
    });
  });

  it("rejects activation while a cross-runtime collision remains active", async () => {
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          id: "observation-1",
          agentId: null,
          runtimeHostId: "host-1",
          runtimeType: "hermes",
          externalAgentId: "shared-id",
          status: "quarantined",
        })
        .mockResolvedValueOnce({ id: "agent-1", lifecycleStatus: "active" })
        .mockResolvedValueOnce({ id: "host-1", status: "online" })
        .mockResolvedValueOnce(null),
      find: jest.fn(async () => [
        {
          id: "observation-2",
          agentId: "agent-2",
          runtimeType: "openclaw",
        },
      ]),
      save: jest.fn(),
    };
    const { service } = build({
      dataSource: {
        transaction: jest.fn(async (callback) => callback(manager)),
      },
    });

    await expect(
      service.activateReviewedObservation({
        workspaceId: "workspace-1",
        observationId: "observation-1",
        canonicalAgentId: "agent-1",
        expectedRuntimeHostId: "host-1",
        expectedRuntimeType: "hermes",
        expectedExternalAgentId: "shared-id",
        reviewedByUserId: "user-1",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "ACTIVE_COLLIDING_OBSERVATION_REMAINS",
      }),
    });
  });

  it("refreshes a reconnecting host without assigning or transferring execution ownership", async () => {
    const existingHost = {
      id: "host-1",
      workspaceId: "workspace-1",
      clientInstallationId: "installation-1",
      supportedRuntimes: ["hermes"],
      capabilities: {},
      status: "offline",
    };
    const hosts = {
      findOne: jest.fn(async () => existingHost),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    } as any;
    const installations = {
      findOne: jest.fn(async () => ({
        id: "installation-1",
        label: "Studio Mac",
        clientVersion: "0.1.1",
        lastSeenAt: new Date(),
        revokedAt: null,
      })),
    } as any;
    const links = {
      findOne: jest.fn(async () => ({
        workspaceId: "workspace-1",
        installationId: "installation-1",
        status: "active",
      })),
    } as any;
    const dataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    } as any;
    const service = new RuntimeAuthorityService(
      dataSource,
      hosts,
      {} as any,
      {} as any,
      {} as any,
      installations,
      links,
    );

    const result = await service.ensureClientHost({
      workspaceId: "workspace-1",
      installationId: "installation-1",
      runtimeType: "hermes",
    });

    expect(result).toMatchObject({ id: "host-1", status: "online" });
    expect(hosts.save).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(dataSource.getRepository).not.toHaveBeenCalled();
  });

  it("requires the exact active host and external identity for document authority", async () => {
    const bindingRepository = {
      findOne: jest.fn(async () => ({
        workspaceId: "workspace-1",
        agentId: "agent-1",
        runtimeHostId: "host-current",
        runtimeType: "openclaw",
        runtimeExternalAgentId: "native-agent-1",
        ownershipState: "active",
        isEnabled: true,
      })),
    };
    const { service } = build({
      dataSource: {
        getRepository: jest.fn(() => bindingRepository),
      },
    });

    await expect(
      service.assertCurrentExecutionBinding({
        workspaceId: "workspace-1",
        agentId: "agent-1",
        runtimeHostId: "host-current",
        runtimeType: "openclaw",
        externalAgentId: "native-agent-1",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        runtimeHostId: "host-current",
      }),
    );

    await expect(
      service.assertCurrentExecutionBinding({
        workspaceId: "workspace-1",
        agentId: "agent-1",
        runtimeHostId: "host-stale",
        runtimeType: "openclaw",
        externalAgentId: "native-agent-1",
      }),
    ).rejects.toThrow("STALE_RUNTIME_BINDING");
  });
});
