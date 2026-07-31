import { AgentService } from "./agent.service";
import { BadRequestException } from "@nestjs/common";

describe("AgentService runtime binding acceptance repair", () => {
  const createRepo = () => ({
    findOne: jest.fn(),
    findOneOrFail: jest.fn().mockResolvedValue({ id: "agent-1" }),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (value) => value),
    create: jest.fn((value) => value),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    })),
  });

  const createService = () => {
    const agentRepo = createRepo();
    const deptRepo = createRepo();
    const companyRepo = createRepo();
    const teamRepo = createRepo();
    const provisioningJobRepo = createRepo();
    const provisioningJobs: Array<Record<string, any>> = [];
    provisioningJobRepo.save.mockImplementation(async (value) => {
      const saved = {
        ...value,
        id: value.id ?? `provision-job-${provisioningJobs.length + 1}`,
        createdAt: value.createdAt ?? new Date("2026-07-26T10:00:00Z"),
      };
      const index = provisioningJobs.findIndex((job) => job.id === saved.id);
      if (index >= 0) provisioningJobs[index] = saved;
      else provisioningJobs.push(saved);
      return saved;
    });
    provisioningJobRepo.findOne.mockImplementation(async (options) => {
      const where = options?.where ?? {};
      return (
        provisioningJobs.find((job) =>
          Object.entries(where).every(([key, value]) => job[key] === value),
        ) ?? null
      );
    });
    provisioningJobRepo.find.mockImplementation(async (options) => {
      const where = options?.where ?? {};
      return provisioningJobs.filter((job) =>
        Object.entries(where).every(([key, value]) => job[key] === value),
      );
    });
    const workspaceRepo = createRepo();
    const connectionRepo = createRepo();
    const taskRepo = createRepo();
    const workLogRepo = createRepo();
    const scheduleRepo = createRepo();
    const shiftRuleRepo = createRepo();
    const availabilityRepo = createRepo();
    const metricsRepo = createRepo();
    const runRepo = createRepo();
    const reviewRepo = createRepo();
    const eventsGateway = {
      hasBridgeControlSubscribers: jest.fn(() => false),
      emitToBridgeControls: jest.fn(),
      emitToHermesBridgeWorkspace: jest.fn(),
      emitWorkspaceEvent: jest.fn(),
      emitToWorkspace: jest.fn(),
      getWorkspaceHermesBridgeRuntime: jest.fn(() => ({
        connectedBridgeDeviceCount: 0,
        liveRegisteredAgentCount: 0,
        liveRegisteredExternalAgentIds: [],
      })),
      requestBridgeControl: jest.fn().mockResolvedValue({ acknowledged: true }),
      getBridgeDeviceIdForExternalAgent: jest.fn(() => "device-1"),
    };
    const resourceAccessService = {
      ensureWorkspaceAdminAccess: jest.fn(),
      ensureAgentAccess: jest.fn(),
      ensureAgentAdminAccess: jest.fn(),
      ensureWorkspaceAccess: jest.fn(),
      assertCompanyInWorkspace: jest.fn(),
      assertDepartmentInWorkspace: jest.fn(),
      assertTeamInWorkspace: jest.fn(),
    };
    const claudeService = {
      upsertAgentBinding: jest.fn(),
      getBindingByAgentId: jest.fn(),
      deleteBindingForAgent: jest.fn(),
    };
    const runtimeBindingService = {
      upsertByAgentId: jest.fn(),
      findByAgentIds: jest.fn().mockResolvedValue([]),
      findByAgentId: jest.fn().mockResolvedValue(null),
      findEnabledByAgentId: jest.fn().mockResolvedValue(null),
      deleteByAgentId: jest.fn(),
    };
    const runtimeAuthorityService = {
      observeAgent: jest.fn().mockResolvedValue({
        observation: {
          id: "observation-1",
          connectedAt: null,
        },
        suppressed: false,
        collision: false,
      }),
      assignExecutionOwner: jest.fn(),
      unlinkConnectAgent: jest.fn(),
    };
    const runtimeObservationRepo = createRepo();
    const runtimeHostRepo = createRepo();
    runtimeHostRepo.findOne.mockResolvedValue({
      id: "runtime-host-1",
      workspaceId: "workspace-1",
      bridgeDeviceId: "device-1",
      status: "online",
      supportedRuntimes: ["hermes"],
    });
    const runtimeProvisioningTargets = {
      resolve: jest.fn().mockResolvedValue({
        target: { selectionSource: "initial_connection" },
        host: {
          id: "runtime-host-1",
          bridgeDeviceId: "device-1",
          status: "online",
          supportedRuntimes: ["hermes"],
        },
        online: true,
      }),
    };
    const auditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AgentService(
      agentRepo as any,
      deptRepo as any,
      companyRepo as any,
      teamRepo as any,
      provisioningJobRepo as any,
      workspaceRepo as any,
      connectionRepo as any,
      taskRepo as any,
      workLogRepo as any,
      scheduleRepo as any,
      shiftRuleRepo as any,
      availabilityRepo as any,
      metricsRepo as any,
      runRepo as any,
      reviewRepo as any,
      createRepo() as any,
      createRepo() as any,
      createRepo() as any,
      eventsGateway as any,
      resourceAccessService as any,
      claudeService as any,
      runtimeBindingService as any,
      runtimeAuthorityService as any,
      runtimeObservationRepo as any,
      runtimeHostRepo as any,
      runtimeProvisioningTargets as any,
      auditLogService as any,
    );

    jest.spyOn(service, "findOne").mockResolvedValue({
      id: "agent-1",
      name: "Hermes Worker",
      runtimeBinding: null,
    } as any);

    return {
      service,
      agentRepo,
      resourceAccessService,
      claudeService,
      runtimeBindingService,
      eventsGateway,
      runtimeProvisioningTargets,
      runtimeAuthorityService,
      runtimeObservationRepo,
      runtimeHostRepo,
      provisioningJobRepo,
      teamRepo,
      deptRepo,
      auditLogService,
    };
  };

  it("creates Hermes agents with a generic runtime binding", async () => {
    const { service, agentRepo, runtimeBindingService } = createService();
    agentRepo.save.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      source: "hermes",
      modelPrimary: "gpt-5.5",
    });

    await service.create(
      {
        name: "Hermes Worker",
        workspaceId: "workspace-1",
        role: "Repository agent",
        source: "hermes",
        externalId: "hermes_repo",
        runtimeBinding: {
          runtimeType: "hermes",
          repoKey: "repo-a",
          configMetadata: {
            model: "nous-hermes",
          },
        },
      } as any,
      "user-1",
    );

    expect(runtimeBindingService.upsertByAgentId).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({
        workspaceId: "workspace-1",
        runtimeType: "hermes",
        adapterKind: "hermes_bridge",
        workspaceRoot: null,
        repoKey: "repo-a",
        healthStatus: "ready",
        configMetadata: expect.objectContaining({ model: "gpt-5.5" }),
      }),
    );
  });

  it("rejects Hermes host paths before creating an agent", async () => {
    const { service, agentRepo, runtimeBindingService } = createService();

    await expect(
      service.create(
        {
          name: "Unsafe Hermes",
          workspaceId: "workspace-1",
          role: "Repository agent",
          source: "hermes",
          externalId: "unsafe_hermes",
          runtimeBinding: {
            runtimeType: "hermes",
            workspaceRoot: "/private/repository",
          },
        } as any,
        "user-1",
      ),
    ).rejects.toThrow(/opaque repoKey/);

    expect(agentRepo.save).not.toHaveBeenCalled();
    expect(runtimeBindingService.upsertByAgentId).not.toHaveBeenCalled();
  });

  it("propagates a model-only Hermes update into the runtime binding", async () => {
    const { service, agentRepo, resourceAccessService, runtimeBindingService } =
      createService();
    resourceAccessService.ensureAgentAdminAccess.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      source: "hermes",
      modelPrimary: null,
    });
    runtimeBindingService.findByAgentId.mockResolvedValue({
      agentId: "agent-1",
      runtimeType: "hermes",
      configMetadata: { compatibilitySource: "hermes_bridge_registration" },
    });
    (service.findOne as jest.Mock).mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      source: "hermes",
      modelPrimary: "gpt-5.4",
    });
    agentRepo.update.mockResolvedValue(undefined);

    await service.update(
      "agent-1",
      { modelPrimary: "gpt-5.4" } as any,
      "user-1",
    );

    expect(runtimeBindingService.upsertByAgentId).toHaveBeenCalledWith(
      "agent-1",
      {
        configMetadata: {
          compatibilitySource: "hermes_bridge_registration",
          model: "gpt-5.4",
        },
      },
    );
  });

  it("requires paired Hermes scheduler acknowledgement", async () => {
    const { service, agentRepo, runtimeBindingService, eventsGateway } =
      createService();
    agentRepo.findOne.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      externalId: "hermes-1",
      source: "hermes",
    });
    runtimeBindingService.findEnabledByAgentId = jest.fn().mockResolvedValue({
      runtimeType: "hermes",
      configMetadata: {},
    });

    await service.maintainCronScheduler(
      "agent-1",
      "daily-report",
      "recover",
      "user-1",
    );

    expect(eventsGateway.requestBridgeControl).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "clawchat.host.scheduler.maintain",
        capability: "clawchat.host.scheduler_maintenance",
        runtimeType: "hermes",
        data: expect.objectContaining({
          externalAgentId: "hermes-1",
          jobId: "daily-report",
          action: "recover",
        }),
      }),
    );
  });

  it("lists native OpenClaw cron jobs through the paired host", async () => {
    const { service, agentRepo, runtimeBindingService, eventsGateway } =
      createService();
    agentRepo.findOne.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      externalId: "gapminer",
      source: "openclaw",
    });
    runtimeBindingService.findEnabledByAgentId = jest.fn().mockResolvedValue({
      runtimeType: "openclaw",
      configMetadata: { bridgeDeviceId: "device-1" },
    });

    await service.listCronJobs("agent-1", "user-1");

    expect(eventsGateway.requestBridgeControl).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "clawchat.host.cron.list",
        capability: "clawchat.host.cron_management",
        runtimeType: "openclaw",
        targetBridgeDeviceId: "device-1",
        data: expect.objectContaining({
          externalAgentId: "gapminer",
          runtimeType: "openclaw",
          scope: "workspace",
        }),
      }),
    );
  });

  it("emits a Hermes bridge provisioning request when creating a bridge-backed Hermes agent", async () => {
    const { service, agentRepo, eventsGateway, provisioningJobRepo } =
      createService();
    eventsGateway.hasBridgeControlSubscribers.mockReturnValue(true);
    agentRepo.save.mockImplementation(async (value) => ({
      ...value,
      id: "agent-1",
    }));
    await service.create(
      {
        name: "Myner Hermes",
        workspaceId: "workspace-1",
        role: "GapMiner Operator",
        source: "hermes",
        externalId: "myner_hermes",
        modelPrimary: "nous-hermes",
        runtimeBinding: {
          runtimeType: "hermes",
          adapterKind: "hermes_bridge",
          routingMode: "default_target",
          repoKey: "myner-hermes-repo",
          configMetadata: {
            defaultSkills: ["workflow-router"],
          },
        },
      } as any,
      "user-1",
    );

    expect(eventsGateway.hasBridgeControlSubscribers).toHaveBeenCalledWith(
      "workspace-1",
      null,
      "device-1",
      "hermes",
    );
    expect(eventsGateway.emitToHermesBridgeWorkspace).toHaveBeenCalledWith(
      "workspace-1",
      "hermes.agent.provision",
      expect.objectContaining({
        commandId: "provision-job-1",
        jobId: "provision-job-1",
        workspaceId: "workspace-1",
        agentId: "agent-1",
        runtimeHostId: "runtime-host-1",
        runtimeType: "hermes",
        idempotencyKey: "create:agent-1",
        externalAgentId: "profile:myner_hermes",
        name: "Myner Hermes",
        role: "GapMiner Operator",
        model: "nous-hermes",
        runtimeBinding: expect.objectContaining({
          runtimeType: "hermes",
          adapterKind: "hermes_bridge",
          routingMode: "default_target",
          repoKey: "myner-hermes-repo",
          configMetadata: expect.objectContaining({
            defaultSkills: ["workflow-router"],
            model: "nous-hermes",
          }),
        }),
      }),
      null,
      "device-1",
    );
    expect(provisioningJobRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        runtimeType: "hermes",
        runtimeHostId: "runtime-host-1",
        targetResolutionSource: "initial_connection",
        idempotencyKey: "create:agent-1",
        createdAgentId: "agent-1",
        externalAgentId: "profile:myner_hermes",
      }),
    );
    expect(agentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: "profile:myner_hermes",
        provisioningStatus: "provisioning",
      }),
    );
  });

  it("durably waits on the selected Hermes target without failing over when it is offline", async () => {
    const {
      service,
      agentRepo,
      eventsGateway,
      provisioningJobRepo,
      runtimeProvisioningTargets,
    } = createService();
    runtimeProvisioningTargets.resolve.mockResolvedValue({
      target: { selectionSource: "administrator" },
      host: {
        id: "runtime-host-offline",
        bridgeDeviceId: "device-offline",
        status: "offline",
        supportedRuntimes: ["hermes"],
      },
      online: false,
    });
    agentRepo.save.mockImplementation(async (value) => ({
      ...value,
      id: "agent-offline",
    }));
    await expect(
      service.create(
        {
          name: "Offline Hermes",
          workspaceId: "workspace-1",
          role: "assistant",
          source: "hermes",
          runtimeBinding: {
            runtimeType: "hermes",
            adapterKind: "hermes_bridge",
            routingMode: "default_target",
          },
        } as any,
        "user-1",
      ),
    ).resolves.toBeDefined();

    expect(provisioningJobRepo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtimeHostId: "runtime-host-offline",
        status: "waiting_for_host",
        stage: "waiting_for_host",
      }),
    );
    expect(eventsGateway.emitToHermesBridgeWorkspace).not.toHaveBeenCalled();
  });

  it("resumes a waiting Hermes job only when its exact target host reconnects", async () => {
    const { service, eventsGateway, provisioningJobRepo, runtimeHostRepo } =
      createService();
    const waitingJob = {
      id: "provision-job-1",
      workspaceId: "workspace-1",
      runtimeHostId: "runtime-host-1",
      runtimeType: "hermes",
      idempotencyKey: "create:agent-1",
      createdAgentId: "agent-1",
      externalAgentId: "profile:sales",
      name: "Sales",
      role: "assistant",
      status: "waiting_for_host",
      stage: "waiting_for_host",
      payload: {
        agentId: "agent-1",
        externalAgentId: "profile:sales",
        modelPrimary: "gpt-5.5",
        runtimeBinding: { adapterKind: "hermes_bridge" },
      },
      files: [],
      createdAt: new Date("2026-07-26T10:00:00Z"),
    };
    provisioningJobRepo.find.mockResolvedValue([waitingJob]);
    provisioningJobRepo.findOne.mockResolvedValue(waitingJob);
    provisioningJobRepo.save.mockImplementation(async (value) => value);
    runtimeHostRepo.findOne.mockResolvedValue({
      id: "runtime-host-1",
      workspaceId: "workspace-1",
      bridgeDeviceId: "device-1",
      status: "online",
    });
    eventsGateway.hasBridgeControlSubscribers.mockReturnValue(true);

    await expect(
      service.resumeWaitingProvisioningJobsForHost(
        "workspace-1",
        "runtime-host-1",
        "hermes",
      ),
    ).resolves.toEqual(["provision-job-1"]);

    expect(eventsGateway.emitToHermesBridgeWorkspace).toHaveBeenCalledWith(
      "workspace-1",
      "hermes.agent.provision",
      expect.objectContaining({
        jobId: "provision-job-1",
        runtimeHostId: "runtime-host-1",
        externalAgentId: "profile:sales",
        idempotencyKey: "create:agent-1",
      }),
      null,
      "device-1",
    );
    expect(eventsGateway.emitToBridgeControls).not.toHaveBeenCalled();
  });

  it("binds a Relay-created Hermes profile only to the bridge host that received provisioning", async () => {
    const {
      service,
      agentRepo,
      runtimeBindingService,
      runtimeAuthorityService,
      runtimeObservationRepo,
      runtimeHostRepo,
      provisioningJobRepo,
    } = createService();
    agentRepo.findOne.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      source: "hermes",
      externalId: "profile:sales",
      name: "Sales",
      role: "Sales assistant",
      modelPrimary: "gpt-5.5",
      description: null,
      capabilities: [],
    });
    runtimeHostRepo.findOne.mockResolvedValue({
      id: "runtime-host-1",
      workspaceId: "workspace-1",
      bridgeDeviceId: "device-1",
      supportedRuntimes: ["hermes"],
    });
    runtimeBindingService.findByAgentId.mockResolvedValue({
      configMetadata: {
        provisioningRuntimeHostId: "runtime-host-1",
      },
    });
    provisioningJobRepo.findOne.mockResolvedValue({
      id: "provision-job-1",
      workspaceId: "workspace-1",
      idempotencyKey: "create:agent-1",
      status: "awaiting_bridge",
      stage: "dispatching",
    });

    await service.completeHermesNativeProvision(
      "agent-1",
      {
        runtimeHostId: "runtime-host-1",
        externalAgentId: "profile:sales",
        nativeProfileName: "sales",
        profile: { name: "Sales" },
      },
      "device-1",
      "workspace-1",
    );

    expect(runtimeAuthorityService.observeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeHostId: "runtime-host-1",
        externalAgentId: "profile:sales",
        canonicalAgentId: "agent-1",
        origin: "relay_created",
      }),
    );
    expect(runtimeObservationRepo.update).toHaveBeenCalledWith(
      "observation-1",
      expect.objectContaining({
        connectionState: "connected",
        documentConsentVersion: 1,
      }),
    );
    expect(runtimeAuthorityService.assignExecutionOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeHostId: "runtime-host-1",
        externalAgentId: "profile:sales",
      }),
    );
    expect(provisioningJobRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "provision-job-1",
        status: "completed",
        stage: "completed",
        createdAgentId: "agent-1",
        externalAgentId: "profile:sales",
        nativeCreatedAt: expect.any(Date),
      }),
    );
  });

  it("returns the winning canonical agent when a concurrent connection claim already completed", async () => {
    const {
      service,
      agentRepo,
      runtimeAuthorityService,
      runtimeObservationRepo,
      runtimeHostRepo,
    } = createService();
    runtimeObservationRepo.findOne
      .mockResolvedValueOnce({
        id: "observation-1",
        workspaceId: "workspace-1",
        runtimeHostId: "runtime-host-1",
        runtimeType: "openclaw",
        externalAgentId: "native-agent-1",
        connectionState: "discovered",
        status: "active",
        displayMetadata: { name: "Native Agent" },
        capabilitySnapshot: {},
      })
      .mockResolvedValueOnce({
        id: "observation-1",
        workspaceId: "workspace-1",
        connectionState: "connected",
        agentId: "winning-agent",
      });
    runtimeObservationRepo.update.mockResolvedValue({ affected: 0 });
    runtimeHostRepo.findOne.mockResolvedValue({
      id: "runtime-host-1",
      workspaceId: "workspace-1",
      status: "online",
    });
    (service.findOne as jest.Mock).mockResolvedValue({
      id: "winning-agent",
      name: "Native Agent",
    });

    await expect(
      service.connectNativeObservation(
        "workspace-1",
        "observation-1",
        "user-1",
        {
          expectedState: "discovered",
          documentConsentVersion: 1,
        },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "winning-agent",
      }),
    );

    expect(agentRepo.save).not.toHaveBeenCalled();
    expect(runtimeAuthorityService.assignExecutionOwner).not.toHaveBeenCalled();
  });

  it("ignores the retired workspace cohort variable and keeps native connections global", async () => {
    const previous = process.env.RELAY_NATIVE_AGENT_CONNECTION_WORKSPACE_IDS;
    process.env.RELAY_NATIVE_AGENT_CONNECTION_WORKSPACE_IDS =
      "workspace-launch-customer";
    const { service, resourceAccessService } = createService();
    try {
      await expect(
        service.connectNativeObservation(
          "workspace-outside-cohort",
          "observation-1",
          "user-1",
          { documentConsentVersion: 1 },
        ),
      ).rejects.toThrow("RUNTIME_OBSERVATION_NOT_FOUND");
      expect(
        resourceAccessService.ensureWorkspaceAdminAccess,
      ).toHaveBeenCalledWith("workspace-outside-cohort", "user-1");
    } finally {
      if (previous === undefined) {
        delete process.env.RELAY_NATIVE_AGENT_CONNECTION_WORKSPACE_IDS;
      } else {
        process.env.RELAY_NATIVE_AGENT_CONNECTION_WORKSPACE_IDS = previous;
      }
    }
  });

  it("accepts only the current native document consent version", async () => {
    const { service, runtimeObservationRepo } = createService();
    runtimeObservationRepo.findOne.mockResolvedValue({
      id: "observation-1",
      workspaceId: "workspace-1",
      runtimeHostId: "runtime-host-1",
      runtimeType: "openclaw",
      externalAgentId: "native-agent-1",
      agentId: null,
      connectionState: "discovered",
      status: "active",
      compatibilityStatus: "compatible",
      displayMetadata: {},
      capabilitySnapshot: {},
      observedState: {},
    });

    await expect(
      service.connectNativeObservation(
        "workspace-1",
        "observation-1",
        "user-1",
        { documentConsentVersion: 2 },
      ),
    ).rejects.toThrow("DOCUMENT_CONSENT_VERSION_REQUIRED");
  });

  it("redacts raw per-agent errors returned by batch connection", async () => {
    const { service } = createService();
    jest
      .spyOn(service, "connectNativeObservation")
      .mockRejectedValue(new Error("/Users/private/provider-secret"));

    await expect(
      service.connectNativeObservationBatch("workspace-1", "user-1", {
        observationIds: ["observation-1"],
        documentConsentVersion: 1,
      }),
    ).resolves.toEqual({
      results: [
        {
          observationId: "observation-1",
          status: "failed",
          error: "NATIVE_AGENT_CONNECTION_FAILED",
        },
      ],
    });
  });

  it("restores the connected state and records a safe retryable failure when unlinking fails", async () => {
    const {
      service,
      runtimeAuthorityService,
      runtimeObservationRepo,
      auditLogService,
    } = createService();
    runtimeObservationRepo.findOne.mockResolvedValue({
      id: "observation-1",
      workspaceId: "workspace-1",
      runtimeHostId: "runtime-host-1",
      runtimeType: "openclaw",
      externalAgentId: "native-agent-1",
      agentId: "agent-1",
      connectionState: "connected",
      status: "active",
      observedState: {},
    });
    runtimeAuthorityService.unlinkConnectAgent.mockRejectedValue(
      new Error("/Users/private/provider-secret"),
    );

    await expect(
      service.disconnectNativeObservation(
        "workspace-1",
        "observation-1",
        "user-1",
      ),
    ).rejects.toThrow("NATIVE_AGENT_CONNECTION_FAILED");
    expect(runtimeObservationRepo.update).toHaveBeenLastCalledWith(
      "observation-1",
      expect.objectContaining({
        connectionState: "connected",
        observedState: expect.objectContaining({
          lastDisconnectError: "NATIVE_AGENT_CONNECTION_FAILED",
          lastDisconnectFailedAt: expect.any(String),
        }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "native_agent.disconnect.failed",
        metadata: expect.objectContaining({
          errorCode: "NATIVE_AGENT_CONNECTION_FAILED",
        }),
      }),
    );
    expect(JSON.stringify(auditLogService.record.mock.calls)).not.toContain(
      "/Users/private",
    );
  });

  it("reconnects the existing canonical agent instead of creating a duplicate", async () => {
    const {
      service,
      agentRepo,
      runtimeAuthorityService,
      runtimeObservationRepo,
      runtimeHostRepo,
    } = createService();
    runtimeObservationRepo.findOne.mockResolvedValue({
      id: "observation-1",
      workspaceId: "workspace-1",
      runtimeHostId: "runtime-host-1",
      runtimeType: "openclaw",
      externalAgentId: "native-agent-1",
      agentId: "canonical-agent-1",
      connectionState: "disconnected",
      status: "active",
      displayMetadata: { name: "Native Agent" },
      capabilitySnapshot: {},
      observedState: {},
    });
    runtimeObservationRepo.update.mockResolvedValue({ affected: 1 });
    runtimeHostRepo.findOne.mockResolvedValue({
      id: "runtime-host-1",
      workspaceId: "workspace-1",
      status: "online",
    });
    agentRepo.findOne.mockResolvedValue({
      id: "canonical-agent-1",
      workspaceId: "workspace-1",
      lifecycleStatus: "active",
    });
    (service.findOne as jest.Mock).mockResolvedValue({
      id: "canonical-agent-1",
      workspaceId: "workspace-1",
    });

    await expect(
      service.connectNativeObservation(
        "workspace-1",
        "observation-1",
        "user-1",
        {
          expectedState: "disconnected",
          documentConsentVersion: 1,
        },
      ),
    ).resolves.toEqual(expect.objectContaining({ id: "canonical-agent-1" }));

    expect(agentRepo.save).not.toHaveBeenCalled();
    expect(runtimeAuthorityService.assignExecutionOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "canonical-agent-1",
        runtimeHostId: "runtime-host-1",
        externalAgentId: "native-agent-1",
      }),
    );
  });

  it("persists a redacted per-agent failure marker and supports an explicit retry", async () => {
    const {
      service,
      agentRepo,
      runtimeAuthorityService,
      runtimeObservationRepo,
      runtimeHostRepo,
      auditLogService,
    } = createService();
    const observation = {
      id: "observation-1",
      workspaceId: "workspace-1",
      runtimeHostId: "runtime-host-1",
      runtimeType: "openclaw",
      externalAgentId: "native-agent-1",
      connectionState: "discovered",
      status: "active",
      displayMetadata: { name: "Native Agent" },
      capabilitySnapshot: {},
      observedState: { connectorProtocol: "relay-connector.v3" },
    };
    runtimeObservationRepo.findOne.mockResolvedValue(observation);
    runtimeObservationRepo.update.mockResolvedValue({ affected: 1 });
    runtimeHostRepo.findOne.mockResolvedValue({
      id: "runtime-host-1",
      workspaceId: "workspace-1",
      status: "online",
    });
    agentRepo.findOne.mockResolvedValue(null);
    agentRepo.save.mockResolvedValue({
      id: "agent-created",
      workspaceId: "workspace-1",
    });
    runtimeAuthorityService.assignExecutionOwner.mockRejectedValue(
      new Error("sensitive provider detail"),
    );

    await expect(
      service.connectNativeObservation(
        "workspace-1",
        "observation-1",
        "user-1",
        { documentConsentVersion: 1 },
      ),
    ).rejects.toThrow("sensitive provider detail");

    expect(runtimeObservationRepo.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "observation-1",
        workspaceId: "workspace-1",
        connectionState: "connection_pending",
      }),
      expect.objectContaining({
        connectionState: "discovered",
        observedState: expect.objectContaining({
          connectorProtocol: "relay-connector.v3",
          lastConnectionError: "NATIVE_AGENT_CONNECTION_FAILED",
          lastConnectionFailedAt: expect.any(String),
          lastConnectionCorrelationId: expect.any(String),
        }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "native_agent.connect.failed",
        metadata: expect.objectContaining({
          errorCode: "NATIVE_AGENT_CONNECTION_FAILED",
        }),
      }),
    );

    const connect = jest
      .spyOn(service, "connectNativeObservation")
      .mockResolvedValue({ id: "agent-created" } as any);
    await service.retryNativeObservation(
      "workspace-1",
      "observation-1",
      "user-1",
      { documentConsentVersion: 1 },
    );
    expect(connect).toHaveBeenCalledWith(
      "workspace-1",
      "observation-1",
      "user-1",
      expect.objectContaining({
        expectedState: "discovered",
        auditOperation: "retry",
      }),
    );
  });

  it("dismisses a candidate without suppressing or deleting its native identity", async () => {
    const { service, runtimeObservationRepo, resourceAccessService } =
      createService();
    runtimeObservationRepo.findOne.mockResolvedValue({
      id: "observation-1",
      workspaceId: "workspace-1",
      connectionState: "discovered",
      observedState: { connectorProtocol: "relay-connector.v3" },
    });

    const result = await service.dismissNativeObservation(
      "workspace-1",
      "observation-1",
      "user-1",
    );

    expect(
      resourceAccessService.ensureWorkspaceAdminAccess,
    ).toHaveBeenCalledWith("workspace-1", "user-1");
    expect(runtimeObservationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "observation-1",
        connectionState: "discovered",
        observedState: expect.objectContaining({
          connectorProtocol: "relay-connector.v3",
          dismissedAt: expect.any(String),
          dismissedByUserId: "user-1",
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        dismissed: true,
        identitySuppressed: false,
        nativeAgentPreserved: true,
      }),
    );
  });

  it("removes generic runtime bindings when an agent clears runtimeBinding", async () => {
    const { service, resourceAccessService, runtimeBindingService, agentRepo } =
      createService();
    resourceAccessService.ensureAgentAdminAccess.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      source: "hermes",
    });
    agentRepo.update.mockResolvedValue(undefined);

    await service.update(
      "agent-1",
      {
        runtimeBinding: null,
      } as any,
      "user-1",
    );

    expect(runtimeBindingService.deleteByAgentId).toHaveBeenCalledWith(
      "agent-1",
    );
  });

  it("rejects agent creation with a team outside the target workspace", async () => {
    const { service, agentRepo, resourceAccessService } = createService();
    resourceAccessService.assertTeamInWorkspace.mockRejectedValue(
      new BadRequestException("Team does not belong to this workspace"),
    );

    await expect(
      service.create(
        {
          name: "Cross Workspace Agent",
          workspaceId: "workspace-1",
          role: "Operator",
          teamId: "team-other-workspace",
        } as any,
        "user-1",
      ),
    ).rejects.toThrow("Team does not belong to this workspace");

    expect(agentRepo.save).not.toHaveBeenCalled();
  });

  it("rejects agent updates when team and department hierarchy conflict", async () => {
    const { service, agentRepo, resourceAccessService, teamRepo, deptRepo } =
      createService();
    resourceAccessService.ensureAgentAdminAccess.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      groupType: "business",
      source: "manual",
    });
    resourceAccessService.assertDepartmentInWorkspace.mockResolvedValue(
      undefined,
    );
    resourceAccessService.assertTeamInWorkspace.mockResolvedValue(undefined);
    deptRepo.findOne.mockResolvedValue({
      id: "department-1",
      companyId: "company-1",
    });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      departmentId: "department-2",
    });

    await expect(
      service.update(
        "agent-1",
        {
          groupType: "business",
          departmentId: "department-1",
          teamId: "team-1",
        } as any,
        "user-1",
      ),
    ).rejects.toThrow("Team does not belong to the selected department");

    expect(agentRepo.update).not.toHaveBeenCalled();
  });
});
