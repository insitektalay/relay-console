import { AgentHostSyncService } from "./agent-host-sync.service";

function memoryRepository<T extends Record<string, any>>(rows: T[] = []) {
  let nextId = 1;
  const matches = (row: T, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  return {
    rows,
    create: jest.fn((value) => value),
    find: jest.fn(async (options?: any) =>
      options?.where
        ? rows.filter((row) => matches(row, options.where))
        : [...rows],
    ),
    findOne: jest.fn(async (options: any) => {
      const candidates = rows.filter((row) => matches(row, options.where));
      return candidates.at(-1) ?? null;
    }),
    save: jest.fn(async (value: any) => {
      const row = value as T;
      if (!(row as any).id) (row as any).id = `row-${nextId++}`;
      const index = rows.findIndex((candidate) => candidate.id === row.id);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
      return row;
    }),
    update: jest.fn(async (id: string, fields: Record<string, unknown>) => {
      const row = rows.find((candidate) => candidate.id === id);
      if (row) Object.assign(row, fields);
    }),
  };
}

describe("AgentHostSyncService", () => {
  it("stores host-managed documents only in the canonical managed table", async () => {
    const objects = memoryRepository<any>();
    const changes = memoryRepository<any>();
    const managed = memoryRepository<any>();
    (managed as any).createQueryBuilder = jest.fn(() => {
      const builder = {
        addSelect: jest.fn(() => builder),
        where: jest.fn(() => builder),
        andWhere: jest.fn(() => builder),
        getOne: jest.fn(async () => null),
      };
      return builder;
    });
    const service = new AgentHostSyncService(
      memoryRepository<any>() as any,
      objects as any,
      changes as any,
      memoryRepository<any>() as any,
      memoryRepository<any>() as any,
      {} as any,
      managed as any,
    );

    const saved = await (service as any).saveDocument({
      bridge: { workspaceId: "workspace-1", deviceId: "device-1" },
      runtimeType: "hermes",
      agent: { id: "agent-1" },
      existing: null,
      folder: "skills",
      filename: "research.md",
      content: "canonical content",
    });

    expect(objects.save).not.toHaveBeenCalled();
    expect(managed.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        agentId: "agent-1",
        relativePath: "skills/research.md",
        desiredContent: "canonical content",
      }),
    );
    expect(saved.payload.content).toBe("canonical content");
    expect(changes.save).toHaveBeenCalled();
  });

  function metadataOnlyService() {
    const agents = memoryRepository<any>([]);
    const runtimeAuthority = {
      ensureBridgeHost: jest.fn(async () => ({ id: "runtime-host-1" })),
      observeAgent: jest.fn(async (input: { externalAgentId: string }) => ({
        observation: {
          id: `observation:${input.externalAgentId}`,
          agentId: null,
          connectionState: "discovered",
          origin: "customer_existing",
        },
        suppressed: false,
        collision: false,
      })),
      completeInventory: jest.fn(async () => undefined),
    };
    const service = new AgentHostSyncService(
      agents as any,
      memoryRepository<any>() as any,
      memoryRepository<any>() as any,
      memoryRepository<any>() as any,
      memoryRepository<any>() as any,
      runtimeAuthority as any,
      undefined,
      undefined,
      {
        ensureForConnectedHost: jest.fn(async () => ({
          id: "target-1",
          runtimeHostId: "runtime-host-1",
          status: "active",
        })),
      } as any,
    );
    return { service, runtimeAuthority };
  }

  it("accepts the required 250-agent metadata inventory boundary and rejects 251", async () => {
    const { service, runtimeAuthority } = metadataOnlyService();
    const bridge = {
      workspaceId: "workspace-1",
      deviceId: "device-1",
      devicePublicId: "host-pc",
      runtimeType: "hermes",
    };
    const agents = Array.from({ length: 250 }, (_, index) => ({
      externalId: `profile:${String(index).padStart(3, "0")}`,
      name: `Profile ${index}`,
    }));

    const accepted = await service.exchange(bridge, {
      protocolVersion: "relay-connector.v3",
      runtimeType: "hermes",
      completeInventory: true,
      inventoryGeneration: "generation-250",
      agents,
    });

    expect(accepted.discoveries).toHaveLength(250);
    expect(runtimeAuthority.observeAgent).toHaveBeenCalledTimes(250);
    expect(runtimeAuthority.completeInventory).toHaveBeenCalledWith(
      expect.objectContaining({
        externalAgentIds: agents.map((agent) => agent.externalId),
      }),
    );

    await expect(
      service.exchange(bridge, {
        protocolVersion: "relay-connector.v3",
        runtimeType: "hermes",
        agents: [...agents, { externalId: "profile:overflow" }],
      }),
    ).rejects.toThrow("INVALID_AGENT_REPLICA_INVENTORY");
    expect(runtimeAuthority.observeAgent).toHaveBeenCalledTimes(250);
  });

  it("rejects and audits forbidden discovery metadata without recording its value", async () => {
    const { service } = metadataOnlyService();
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    (service as any).auditLogService = audit;

    await expect(
      service.exchange(
        {
          workspaceId: "workspace-1",
          deviceId: "device-1",
          devicePublicId: "host-pc",
          runtimeType: "openclaw",
        },
        {
          protocolVersion: "relay-connector.v3",
          runtimeType: "openclaw",
          agents: [
            {
              externalId: "agent-1",
              description: "/Users/private/runtime/agent",
            },
          ],
        },
      ),
    ).rejects.toThrow("FORBIDDEN_ABSOLUTE_PATH_METADATA");

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "native_agent.connector_payload.rejected",
        metadata: expect.objectContaining({
          errorCode: "FORBIDDEN_ABSOLUTE_PATH_METADATA",
          payloadRedacted: true,
        }),
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      "/Users/private/runtime/agent",
    );
  });

  it("keeps connector v2 discovery metadata-only until explicit Relay consent", async () => {
    const { service } = metadataOnlyService();

    const result = await service.exchange(
      {
        workspaceId: "workspace-1",
        deviceId: "device-1",
        devicePublicId: "host-pc",
        runtimeType: "hermes",
      },
      {
        protocolVersion: "relay-connector.v2",
        runtimeType: "hermes",
        agents: [
          {
            externalId: "profile:legacy-sales",
            canonicalAgentId: "untrusted-canonical-claim",
            documents: [
              {
                filename: "SOUL.md",
                content: "Must remain on the host before consent.",
              },
            ],
          },
        ],
      },
    );

    expect(result.discoveries).toEqual([
      expect.objectContaining({
        externalId: "profile:legacy-sales",
        directive: "metadata_only",
        documentSync: false,
      }),
    ]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        code: "DOCUMENTS_NOT_ALLOWED_BEFORE_CONNECTION",
        excluded: true,
      }),
    ]);
    expect((service as any).bridgeService).toBeUndefined();
  });

  it("accepts the required 2,000-document boundary and rejects 2,001 before ingestion", async () => {
    const { service } = metadataOnlyService();
    const bridge = {
      workspaceId: "workspace-1",
      deviceId: "device-1",
      devicePublicId: "host-pc",
      runtimeType: "openclaw",
    };
    const documents = Array.from({ length: 2_000 }, (_, index) => ({
      folder: "memory",
      filename: `${String(index).padStart(4, "0")}.md`,
    }));

    const accepted = await service.exchange(bridge, {
      protocolVersion: "relay-connector.v3",
      runtimeType: "openclaw",
      agents: [{ externalId: "agent-1", documents }],
    });

    expect(accepted.discoveries).toEqual([
      expect.objectContaining({
        externalId: "agent-1",
        directive: "metadata_only",
        documentSync: false,
      }),
    ]);
    expect(accepted.conflicts).toEqual([
      expect.objectContaining({
        code: "DOCUMENTS_NOT_ALLOWED_BEFORE_CONNECTION",
        excluded: true,
      }),
    ]);

    await expect(
      service.exchange(bridge, {
        protocolVersion: "relay-connector.v3",
        runtimeType: "openclaw",
        agents: [
          {
            externalId: "agent-1",
            documents: [
              ...documents,
              { folder: "memory", filename: "overflow.md" },
            ],
          },
        ],
      }),
    ).rejects.toThrow("AGENT_DOCUMENT_COUNT_LIMIT_EXCEEDED");
  });

  it("applies the 2,000-document limit independently to each native agent", async () => {
    const { service, runtimeAuthority } = metadataOnlyService();
    const documents = Array.from({ length: 2_000 }, (_, index) => ({
      folder: "memory",
      filename: `${String(index).padStart(4, "0")}.md`,
    }));

    const result = await service.exchange(
      {
        workspaceId: "workspace-1",
        deviceId: "device-1",
        devicePublicId: "host-pc",
        runtimeType: "openclaw",
      },
      {
        protocolVersion: "relay-connector.v3",
        runtimeType: "openclaw",
        agents: [
          { externalId: "agent-1", documents },
          { externalId: "agent-2", documents },
        ],
      },
    );

    expect(result.discoveries).toHaveLength(2);
    expect(runtimeAuthority.observeAgent).toHaveBeenCalledTimes(2);
  });

  it("keeps connector v3 discovery metadata-only until the observation is connected", async () => {
    const agents = memoryRepository<any>([]);
    const runtimeAuthority = {
      ensureBridgeHost: jest.fn(async () => ({ id: "runtime-host-1" })),
      observeAgent: jest.fn(async () => ({
        observation: {
          id: "observation-1",
          agentId: null,
          connectionState: "discovered",
          origin: "customer_existing",
        },
        suppressed: false,
        collision: false,
      })),
    };
    const provisioningTargets = {
      ensureForConnectedHost: jest.fn(async () => ({
        id: "target-1",
        runtimeHostId: "runtime-host-1",
        status: "active",
      })),
    };
    const service = new AgentHostSyncService(
      agents as any,
      memoryRepository<any>() as any,
      memoryRepository<any>() as any,
      memoryRepository<any>() as any,
      memoryRepository<any>() as any,
      runtimeAuthority as any,
      undefined,
      undefined,
      provisioningTargets as any,
    );

    const result = await service.exchange(
      {
        workspaceId: "workspace-1",
        deviceId: "device-1",
        devicePublicId: "host-pc",
        runtimeType: "hermes",
      },
      {
        protocolVersion: "relay-connector.v3",
        runtimeType: "hermes",
        inventoryGeneration: "generation-1",
        agents: [
          {
            externalId: "profile:sales",
            name: "Sales",
            skillCount: 4,
            documents: [
              {
                filename: "SOUL.md",
                content: "This content must not be accepted during discovery.",
              },
            ],
          },
        ],
      },
    );

    expect(result.agents).toEqual([]);
    expect(result.discoveries).toEqual([
      expect.objectContaining({
        externalId: "profile:sales",
        observationId: "observation-1",
        directive: "metadata_only",
        connectionState: "discovered",
        documentSync: false,
      }),
    ]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        code: "DOCUMENTS_NOT_ALLOWED_BEFORE_CONNECTION",
        excluded: true,
      }),
    ]);
    expect((service as any).bridgeService).toBeUndefined();
    expect(runtimeAuthority.observeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalAgentId: null,
        inventoryGeneration: "generation-1",
        displayMetadata: expect.objectContaining({
          name: "Sales",
          skillCount: 4,
        }),
      }),
    );
    expect(provisioningTargets.ensureForConnectedHost).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      runtimeType: "hermes",
      runtimeHostId: "runtime-host-1",
    });
  });

  it("rejects document synchronization from a stale or reassigned runtime binding", async () => {
    const agents = memoryRepository<any>([
      {
        id: "agent-1",
        workspaceId: "workspace-1",
        lifecycleStatus: "active",
      },
    ]);
    const runtimeAuthority = {
      ensureBridgeHost: jest.fn(async () => ({ id: "runtime-host-old" })),
      observeAgent: jest.fn(async () => ({
        observation: {
          id: "observation-1",
          agentId: "agent-1",
          connectionState: "connected",
          origin: "customer_existing",
        },
        suppressed: false,
        collision: false,
      })),
      assertCurrentExecutionBinding: jest.fn(async () => ({
        assignmentEpoch: "2",
      })),
    };
    const service = new AgentHostSyncService(
      agents as any,
      memoryRepository<any>() as any,
      memoryRepository<any>() as any,
      memoryRepository<any>() as any,
      memoryRepository<any>() as any,
      runtimeAuthority as any,
    );

    const result = await service.exchange(
      {
        workspaceId: "workspace-1",
        deviceId: "device-old",
        devicePublicId: "host-old",
        runtimeType: "openclaw",
      },
      {
        protocolVersion: "relay-connector.v3",
        runtimeType: "openclaw",
        agents: [
          {
            externalId: "native-agent-1",
            bindingEpoch: "1",
            documents: [
              {
                filename: "SOUL.md",
                content: "A stale host must not write this.",
              },
            ],
          },
        ],
      },
    );

    expect(result.agents).toEqual([]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        code: "STALE_RUNTIME_BINDING",
        excluded: true,
      }),
    ]);
    expect(result.discoveries).toEqual([
      expect.objectContaining({
        directive: "quarantine",
        documentSync: false,
      }),
    ]);
  });

  it("syncs a consented v2 fallback binding and accepts versioned offline edits", async () => {
    const agent = {
      id: "agent-1",
      workspaceId: "workspace-1",
      externalId: "gapminerauditor",
      name: "GapMiner Auditor",
      role: "assistant",
      description: null,
      avatarUrl: null,
      status: "active",
      source: "openclaw",
      groupType: "business",
      groupLabel: null,
      companyId: null,
      departmentId: null,
      teamId: null,
      capabilities: [],
      workingHoursMode: "scheduled",
      timezone: "UTC",
      modelPrimary: null,
      responsePresentation: "standard",
      updatedAt: new Date("2026-07-21T10:00:00Z"),
    };
    const agents = memoryRepository<any>([agent]);
    const objects = memoryRepository<any>([]);
    const changes = memoryRepository<any>([]);
    const runtimeReplicas = memoryRepository<any>([]);
    const documentReplicas = memoryRepository<any>([]);

    (objects as any).createQueryBuilder = jest.fn(() => {
      const parameters: Record<string, string> = {};
      const builder: any = {
        where: jest.fn((_: string, values?: Record<string, string>) => {
          Object.assign(parameters, values ?? {});
          return builder;
        }),
        andWhere: jest.fn((_: string, values?: Record<string, string>) => {
          Object.assign(parameters, values ?? {});
          return builder;
        }),
        orderBy: jest.fn(() => builder),
        getOne: jest.fn(
          async () =>
            objects.rows.find((row) => {
              const payload = row.payload ?? {};
              return (
                row.workspaceId === parameters.workspaceId &&
                row.objectType === "agent_document" &&
                payload.agentId === parameters.agentId &&
                (!parameters.runtimeType ||
                  payload.runtimeType === parameters.runtimeType) &&
                payload.folder === parameters.folder &&
                payload.filename === parameters.filename
              );
            }) ?? null,
        ),
        getMany: jest.fn(async () =>
          objects.rows.filter(
            (row) =>
              row.workspaceId === parameters.workspaceId &&
              row.objectType === "agent_document" &&
              row.payload?.agentId === parameters.agentId &&
              (!parameters.runtimeType ||
                row.payload?.runtimeType === parameters.runtimeType),
          ),
        ),
      };
      return builder;
    });

    const runtimeAuthority = {
      ensureBridgeHost: jest.fn(async () => ({ id: "runtime-host-1" })),
      observeAgent: jest.fn(async () => ({
        observation: {
          id: "observation-1",
          agentId: "agent-1",
          connectionState: "connected",
          origin: "customer_existing",
        },
        suppressed: false,
        collision: false,
      })),
      assertCurrentExecutionBinding: jest.fn(async () => ({
        assignmentEpoch: "1",
      })),
    };
    const service = new AgentHostSyncService(
      agents as any,
      objects as any,
      changes as any,
      runtimeReplicas as any,
      documentReplicas as any,
      runtimeAuthority as any,
    );
    const bridge = {
      workspaceId: "workspace-1",
      deviceId: "device-1",
      devicePublicId: "host-pc",
      runtimeType: "openclaw",
    };

    const first = await service.exchange(bridge, {
      protocolVersion: "relay-connector.v2",
      runtimeType: "openclaw",
      agents: [
        {
          externalId: "gapminerauditor",
          name: "GapMiner Auditor",
          documents: [
            {
              filename: "SOUL.md",
              content: "# Auditor\n\nOriginal instructions.",
            },
          ],
        },
      ],
    });

    expect(first.agents).toHaveLength(1);
    expect(first.agents[0].documents).toEqual([
      expect.objectContaining({
        filename: "SOUL.md",
        serverVersion: "1",
        deleted: false,
      }),
    ]);
    expect((service as any).bridgeService).toBeUndefined();
    expect(runtimeAuthority.ensureBridgeHost).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        bridgeDeviceId: "device-1",
        runtimeType: "openclaw",
        protocolVersion: "2",
      }),
    );
    expect(runtimeAuthority.observeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeHostId: "runtime-host-1",
        runtimeType: "openclaw",
        externalAgentId: "gapminerauditor",
        observedState: expect.objectContaining({
          connectorProtocol: "relay-connector.v2",
        }),
      }),
    );

    const document = first.agents[0].documents[0];
    const second = await service.exchange(bridge, {
      protocolVersion: "relay-connector.v2",
      runtimeType: "openclaw",
      agents: [
        {
          externalId: "gapminerauditor",
          documents: [
            {
              objectId: document.objectId,
              baseServerVersion: document.serverVersion,
              filename: "SOUL.md",
              content: "# Auditor\n\nEdited while the host was offline.",
            },
          ],
        },
      ],
    });

    expect(second.conflicts).toEqual([]);
    expect(second.agents[0].documents[0]).toEqual(
      expect.objectContaining({
        serverVersion: "2",
        content: "# Auditor\n\nEdited while the host was offline.",
      }),
    );
    expect((service as any).bridgeService).toBeUndefined();
  });
});
