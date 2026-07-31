import { RelayRemediationService } from "./relay-remediation.service";

describe("RelayRemediationService safeguards", () => {
  const evidence = {
    provider: "railway_postgresql" as const,
    backupId: "backup-123",
    createdAt: "2026-07-22T10:00:00.000Z",
    verifiedAt: "2026-07-22T10:05:00.000Z",
    inventoryChecksum: "a".repeat(64),
    restoreRehearsalReference: "restore-rehearsal-123",
  };

  function service(dataSource: any = {}) {
    return new RelayRemediationService(dataSource, {} as any);
  }

  it("requires independently identifiable backup evidence", () => {
    const instance = service() as any;
    expect(() =>
      instance.assertManifest({
        version: "relay-workspace-remediation.v1",
        backupReference: "railway-volume-without-id",
        backupEvidence: evidence,
      }),
    ).toThrow("REMEDIATION_BACKUP_REFERENCE_MISMATCH");
  });

  it("never permits a remediation assignment to enable execution before verification", () => {
    const instance = service() as any;
    expect(() =>
      instance.assertManifest({
        version: "relay-workspace-remediation.v1",
        backupReference: "railway-backup-backup-123",
        backupEvidence: evidence,
        ownershipAssignments: [
          {
            agentId: "agent-1",
            runtimeHostId: "host-1",
            runtimeType: "hermes",
            externalAgentId: "mike-hermes",
            keepExecutionDisabledUntilVerified: false,
          },
        ],
      }),
    ).toThrow("REMEDIATION_ASSIGNMENT_VERIFICATION_REQUIRED");
  });

  it("exports only message hashes and byte counts, never message content", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM runtime_bindings")) {
        expect(sql).toContain('"lastHealthCheckAt"');
        expect(sql).not.toContain('"lastSeenAt"');
        return [];
      }
      if (sql.includes("FROM runtime_dispatches")) {
        expect(sql).toContain("JOIN runtime_bindings");
        expect(sql).toContain('b."runtimeType"');
        return [];
      }
      if (sql.includes("FROM relay_client_installations")) {
        expect(sql).toContain('i."clientKind"');
        expect(sql).toContain('i."clientVersion"');
        expect(sql).not.toContain("i.platform");
        return [];
      }
      if (sql.includes("FROM messages")) {
        return [
          {
            id: "message-1",
            threadId: "thread-1",
            senderId: "agent-1",
            senderName: "Historical Agent",
            provenance: "agent",
            __content: "sensitive historical message",
            createdAt: new Date("2026-07-22T10:00:00.000Z"),
          },
        ];
      }
      return [];
    });
    const instance = service({ query }) as any;
    const inventory = await instance.buildInventory("workspace-1");
    const messages = inventory.sections.messages.rows;
    expect(messages).toEqual([
      expect.objectContaining({
        id: "message-1",
        contentBytes: Buffer.byteLength("sensitive historical message", "utf8"),
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
    expect(JSON.stringify(inventory)).not.toContain(
      "sensitive historical message",
    );
    expect(messages[0]).not.toHaveProperty("__content");
  });

  it("refuses to quarantine and activate the same observation", async () => {
    const instance = service() as any;
    await expect(
      instance.buildPlan("workspace-1", {
        version: "relay-workspace-remediation.v1",
        backupReference: "railway-backup-backup-123",
        backupEvidence: evidence,
        quarantineObservationIds: ["observation-1"],
        activateObservationIds: ["observation-1"],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "REMEDIATION_OBSERVATION_ACTION_CONFLICT",
      }),
    });
  });

  it("plans an exact quarantined-observation activation with execution disabled", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM agents WHERE "workspaceId"')) {
        return [
          {
            id: "agent-1",
            name: "Mike",
            externalId: "mike",
            lifecycleStatus: "active",
          },
        ];
      }
      if (sql.includes('SELECT id, "agentId", "runtimeHostId"')) {
        return [
          {
            id: "observation-1",
            agentId: "agent-1",
            runtimeHostId: "host-1",
            runtimeType: "hermes",
            externalAgentId: "mike-hermes",
            status: "quarantined",
          },
        ];
      }
      if (sql.includes("ACTIVE") || sql.includes("status='active'")) return [];
      if (sql.includes("FROM runtime_observations o JOIN runtime_hosts")) {
        return [
          {
            id: "observation-1",
            agentId: "agent-1",
            status: "quarantined",
            hostStatus: "offline",
          },
        ];
      }
      return [];
    });
    const instance = service({ query }) as any;
    const plan = await instance.buildPlan("workspace-1", {
      version: "relay-workspace-remediation.v1",
      backupReference: "railway-backup-backup-123",
      backupEvidence: evidence,
      activateObservationIds: ["observation-1"],
      ownershipAssignments: [
        {
          agentId: "agent-1",
          runtimeHostId: "host-1",
          runtimeType: "hermes",
          externalAgentId: "mike-hermes",
          keepExecutionDisabledUntilVerified: true,
        },
      ],
    });

    expect(plan.counts).toMatchObject({
      activateObservations: 1,
      ownershipAssignments: 1,
    });
  });
});
