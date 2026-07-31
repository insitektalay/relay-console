import { BadRequestException } from "@nestjs/common";
import { RuntimeMigrationService } from "./runtime-migration.service";

describe("RuntimeMigrationService", () => {
  const encryptionKey = "migration-test-key-0123456789abcdef0123456789";

  function harness(status = "source_paused") {
    const migration = {
      id: "migration-1",
      workspaceId: "workspace-1",
      agentId: "agent-1",
      operationKey: "migration-operation-1",
      runtimeType: "hermes",
      sourceRuntimeHostId: "source-host",
      destinationRuntimeHostId: "destination-host",
      sourceObservationId: "source-observation",
      destinationObservationId: null,
      status,
      sourceAssignmentEpoch: "3",
      destinationAssignmentEpoch: null,
      manifestHash: null,
      manifest: {},
      credentialsReauthorizationRequired: true,
      validationChecks: [],
      lastError: null,
      sourcePausedAt: new Date(),
      switchedAt: null,
      completedAt: null,
      rolledBackAt: null,
    };
    const migrations = {
      findOne: jest.fn().mockResolvedValue(migration),
      save: jest.fn(async (value) => value),
    };
    const service = new RuntimeMigrationService(
      migrations as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        get: (name: string) =>
          name === "RUNTIME_MIGRATION_ENCRYPTION_KEY"
            ? encryptionKey
            : undefined,
      } as any,
    );
    return { service, migration, migrations };
  }

  const safeManifest = {
    schemaVersion: "relay-runtime-migration.v1",
    selectedCategories: ["identity", "memory", "artifactIndex"],
    payload: {
      identity: { displayName: "Review agent" },
      memory: [{ title: "Decision", text: "Keep the bounded context." }],
      artifactIndex: [{ title: "report.md", size: 42, hash: "abc" }],
    },
  };

  function journeyHarness(runtimeType: "hermes" | "openclaw") {
    const migration = {
      id: `migration-${runtimeType}`,
      workspaceId: "workspace-1",
      agentId: "agent-1",
      operationKey: `operation-${runtimeType}`,
      runtimeType,
      sourceRuntimeHostId: "source-host",
      destinationRuntimeHostId: "destination-host",
      sourceObservationId: "source-observation",
      destinationObservationId: "destination-observation",
      status: "planned",
      sourceAssignmentEpoch: "3",
      destinationAssignmentEpoch: null,
      manifestHash: null,
      manifest: {},
      credentialsReauthorizationRequired: true,
      validationChecks: [],
      lastError: null,
      sourcePausedAt: null,
      switchedAt: null,
      completedAt: null,
      rolledBackAt: null,
    } as any;
    const migrations = {
      findOne: jest.fn(async () => migration),
      save: jest.fn(async (value) => value),
      create: jest.fn((value) => value),
    };
    const sourceObservation = {
      id: "source-observation",
      status: "active",
      externalAgentId: `${runtimeType}-source`,
    };
    const destinationObservation = {
      id: "destination-observation",
      runtimeHostId: "destination-host",
      runtimeType,
      status: "migration_target",
      externalAgentId: `${runtimeType}-destination`,
      agentId: "agent-1",
    };
    const observations = {
      findOne: jest.fn(async ({ where }: any) =>
        where.id === "destination-observation"
          ? destinationObservation
          : where.id === "source-observation"
            ? sourceObservation
            : null,
      ),
      save: jest.fn(async (value) => value),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    const authority = {
      assignExecutionOwner: jest.fn(async () => ({
        binding: { assignmentEpoch: "4" },
      })),
      observeAgent: jest.fn(),
    };
    const service = new RuntimeMigrationService(
      migrations as any,
      {} as any,
      {} as any,
      {} as any,
      observations as any,
      authority as any,
      {
        get: (name: string) =>
          name === "RUNTIME_MIGRATION_ENCRYPTION_KEY"
            ? encryptionKey
            : undefined,
      } as any,
    );
    return {
      service,
      migration,
      migrations,
      observations,
      authority,
    };
  }

  it("encrypts a bounded snapshot at rest and verifies it when read", async () => {
    const { service, migration } = harness();

    await service.advance("workspace-1", "migration-1", {
      expectedStatus: "source_paused",
      manifest: safeManifest,
    });

    expect(migration.status).toBe("snapshot_ready");
    expect(migration.manifest).toMatchObject({
      schemaVersion: "relay-runtime-migration-encrypted.v1",
      algorithm: "aes-256-gcm",
    });
    expect(JSON.stringify(migration.manifest)).not.toContain("Review agent");
    expect(migration.manifestHash).toMatch(/^[a-f0-9]{64}$/);

    const result = await service.readManifest("workspace-1", "migration-1");
    expect(result.manifest).toEqual(safeManifest);
    expect(result.credentialsIncluded).toBe(false);
  });

  it.each([
    {
      name: "secret key",
      manifest: {
        ...safeManifest,
        payload: { identity: { apiKey: "must-not-migrate" } },
      },
    },
    {
      name: "machine path",
      manifest: {
        ...safeManifest,
        payload: { memory: [{ source: "/Users/alex/.hermes/state.json" }] },
      },
    },
    {
      name: "artifact bytes",
      manifest: {
        ...safeManifest,
        payload: { artifactIndex: [{ title: "report", content: "bytes" }] },
      },
    },
  ])("rejects $name from a migration snapshot", async ({ manifest }) => {
    const { service } = harness();
    await expect(
      service.advance("workspace-1", "migration-1", {
        expectedStatus: "source_paused",
        manifest,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ["Local-to-Connect Hermes", "hermes", "hermes_bridge"],
    ["OpenClaw-to-OpenClaw", "openclaw", "bridge_ws"],
  ] as const)(
    "completes and can roll back the %s journey without changing harness type",
    async (_label, runtimeType, adapterKind) => {
      const { service, migration, authority, observations } =
        journeyHarness(runtimeType);

      await service.advance("workspace-1", migration.id, {
        expectedStatus: "planned",
        manifest: safeManifest,
      });
      expect(migration.status).toBe("snapshot_ready");
      expect(authority.assignExecutionOwner).not.toHaveBeenCalled();

      await service.advance("workspace-1", migration.id, {
        expectedStatus: "snapshot_ready",
      });
      await service.advance("workspace-1", migration.id, {
        expectedStatus: "imported",
        validationChecks: [
          { name: "runtime-type", passed: true },
          { name: "manifest-hash", passed: true },
          { name: "destination-health", passed: true },
        ],
        credentialsReauthorized: true,
      });
      expect(migration.status).toBe("validated");
      expect(authority.assignExecutionOwner).not.toHaveBeenCalled();

      await service.advance("workspace-1", migration.id, {
        expectedStatus: "validated",
      });
      expect(migration.status).toBe("switched");
      expect(authority.assignExecutionOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeHostId: "destination-host",
          runtimeType,
          adapterKind,
        }),
      );
      expect(observations.update).toHaveBeenCalledWith(
        { id: "source-observation" },
        { status: "migration_source" },
      );

      await service.rollback("workspace-1", migration.id);
      expect(migration.status).toBe("rolled_back");
      expect(authority.assignExecutionOwner).toHaveBeenLastCalledWith(
        expect.objectContaining({
          runtimeHostId: "source-host",
          runtimeType,
          adapterKind,
        }),
      );
    },
  );

  it("resumes safely at every persisted boundary and rejects stale callers", async () => {
    const { service, migration, migrations, authority } =
      journeyHarness("hermes");
    const steps = [
      {
        state: "planned",
        input: { manifest: safeManifest },
        next: "snapshot_ready",
      },
      { state: "snapshot_ready", input: {}, next: "imported" },
      {
        state: "imported",
        input: {
          validationChecks: [{ name: "destination", passed: true }],
          credentialsReauthorized: true,
        },
        next: "validated",
      },
      { state: "validated", input: {}, next: "switched" },
      { state: "switched", input: {}, next: "completed" },
    ];

    for (const step of steps) {
      expect(migration.status).toBe(step.state);
      const savesBeforeStaleAttempt = migrations.save.mock.calls.length;
      await expect(
        service.advance("workspace-1", migration.id, {
          expectedStatus: "stale-client-state",
          ...step.input,
        }),
      ).rejects.toThrow("MIGRATION_STATUS_CHANGED");
      expect(migrations.save).toHaveBeenCalledTimes(savesBeforeStaleAttempt);

      await service.advance("workspace-1", migration.id, {
        expectedStatus: step.state,
        ...step.input,
      });
      expect(migration.status).toBe(step.next);
    }
    expect(authority.assignExecutionOwner).toHaveBeenCalledTimes(1);
  });

  it("rolls back before the switch without reassigning the already-authoritative source", async () => {
    const { service, migration, authority } = journeyHarness("hermes");
    await service.advance("workspace-1", migration.id, {
      expectedStatus: "planned",
      manifest: safeManifest,
    });

    await service.rollback("workspace-1", migration.id);

    expect(migration.status).toBe("rolled_back");
    expect(authority.assignExecutionOwner).not.toHaveBeenCalled();
  });
});
