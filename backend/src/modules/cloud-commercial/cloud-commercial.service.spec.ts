import { generateKeyPairSync, verify } from "crypto";
import { CloudCommercialService } from "./cloud-commercial.service";
import { UserEntity, WorkspaceEntity } from "../../entities";
import { RELAY_SYNC_CONTRACT_VERSION } from "../relay-sync/relay-sync.types";

function repository(initial: any = null) {
  let value = initial;
  return {
    setValue: (next: any) => {
      value = next;
    },
    findOne: jest.fn(async () => value),
    find: jest.fn(async () => []),
    count: jest.fn(async () => 0),
    create: jest.fn((input) => ({ ...input })),
    save: jest.fn(async (input) => {
      value = { id: "deployment-row", ...input };
      return value;
    }),
  } as any;
}

function canonicalWireJson(value: unknown): string {
  const sort = (item: any): any => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === "object") {
      return Object.keys(item)
        .sort()
        .reduce(
          (result, key) => {
            result[key] = sort(item[key]);
            return result;
          },
          {} as Record<string, unknown>,
        );
    }
    return item;
  };
  return JSON.stringify(sort(JSON.parse(JSON.stringify(value))));
}

describe("CloudCommercialService", () => {
  const keys = generateKeyPairSync("ed25519");
  const privateKey = keys.privateKey
    .export({ format: "der", type: "pkcs8" })
    .toString("base64");
  const publicKey = (keys.publicKey.export({ format: "jwk" }) as any).x;
  const deploymentRepo = repository();
  const subscriptionRepo = repository();
  const supportGrantRepo = repository();
  const backupRepo = repository();
  const operatorDeploymentRepo = repository();
  const provisioningRepo = repository();
  const incidentRepo = repository();
  const auditRepo = {
    find: jest.fn(async () => [
      {
        eventType: "runtime.offline",
        resourceType: "runtime_device",
        createdAt: new Date("2026-07-14T12:00:00Z"),
        metadata: {
          messageContent: "private-message",
          credential: "private-token",
        },
      },
    ]),
  } as any;
  const workspaceRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      where.id === "workspace-1" ? { id: "workspace-1" } : null,
    ),
  } as any;
  const userRepo = {
    findOne: jest.fn(async () => null),
  } as any;
  const audit = { record: jest.fn() } as any;
  const membership = {
    ensureWorkspaceAccess: jest.fn(),
    ensureWorkspaceAdminAccess: jest.fn(),
  } as any;
  const config = {
    get: jest.fn(
      (key: string) =>
        (
          ({
            CLAWCHAT_DEPLOYMENT_ID: "deployment-test",
            CLAWCHAT_DEPLOYMENT_NAME: "Test Relay",
            CLAWCHAT_DEPLOYMENT_OWNERSHIP: "self_hosted",
            RELAY_PUBLIC_BACKEND_ORIGIN: "https://api.example.com",
            RELAY_PUBLIC_WEBSOCKET_ORIGIN: "wss://api.example.com",
            RELAY_PUBLIC_WEB_ORIGIN: "https://app.example.com",
            CONNECTION_DESCRIPTOR_PRIVATE_KEY: privateKey,
            CONNECTION_DESCRIPTOR_PUBLIC_KEY: publicKey,
          }) as Record<string, string>
        )[key],
    ),
  } as any;
  const dataSource = {
    query: jest.fn(async () => [
      { name: "AddCloudCommercialPlatform0510000000000" },
    ]),
    getRepository: jest.fn((entity) =>
      entity === WorkspaceEntity
        ? workspaceRepo
        : entity === UserEntity
          ? userRepo
          : auditRepo,
    ),
    transaction: jest.fn(),
  } as any;
  const service = new CloudCommercialService(
    config,
    dataSource,
    {} as any,
    audit,
    membership,
    { ready: jest.fn(async () => ({ ok: true })) } as any,
    deploymentRepo,
    subscriptionRepo,
    supportGrantRepo,
    backupRepo,
    operatorDeploymentRepo,
    provisioningRepo,
    incidentRepo,
  );

  it("normalizes legacy ownership configuration to the Relay-managed launch product", async () => {
    const manifest = await service.manifest();
    expect(manifest.deploymentId).toBe("deployment-row");
    expect(manifest.ownershipType).toBe("relay_managed");
    expect(manifest.origins.api).toBe("https://api.example.com/api/v1");
    expect(manifest.runtimeHostContractVersion).toBe("relay-connector.v3");
    expect(manifest.supportedRuntimeHostContractVersions).toEqual([
      "agent-replica.v1",
      "relay-connector.v2",
      "relay-connector.v3",
    ]);
    expect(manifest.runtimeContractVersion).toBe("bridge.v1");
    expect(manifest.syncContractVersion).toBe(RELAY_SYNC_CONTRACT_VERSION);
    expect(manifest.enabledFeatures).toMatchObject({
      managedRuntime: false,
      managedCloudLaunchEnabled: false,
      runtimeConnectorProtocolV2: true,
      runtimeConnectorProtocolV3: true,
      runtimeConnectorProtocols: [
        "agent-replica.v1",
        "relay-connector.v2",
        "relay-connector.v3",
      ],
    });
    expect(JSON.stringify(manifest)).not.toMatch(
      /PRIVATE_KEY|JWT_SECRET|passwordHash|databaseUrl|deviceToken/i,
    );
  });

  it("rejects an over-limit owner password before bootstrap state access", async () => {
    dataSource.transaction.mockClear();

    await expect(
      service.bootstrapOwner({
        token: "t".repeat(32),
        email: "owner@example.test",
        name: "Owner",
        password: "€".repeat(25),
      }),
    ).rejects.toThrow("OWNER_BOOTSTRAP_INPUT_INVALID");
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it("advertises connector v3 independently from bridge websocket v1", async () => {
    const release = await service.releaseManifest();
    expect(release.runtimeHostContractVersion).toBe("relay-connector.v3");
    expect(release.supportedRuntimeHostContractVersions).toEqual([
      "agent-replica.v1",
      "relay-connector.v2",
      "relay-connector.v3",
    ]);
    expect(release.bridgeReleases).toEqual([
      expect.objectContaining({
        websocketContract: "bridge.v1",
        runtimeConnectorContract: "relay-connector.v3",
        runtimeConnectorProtocols: [
          "agent-replica.v1",
          "relay-connector.v2",
          "relay-connector.v3",
        ],
        supportedPluginVersions: {
          hermes: ["0.3.0-rc.2", "0.3.0-rc.3", "0.3.0-rc.4", "0.3.0-rc.5", "0.3.0-rc.6"],
          openclaw: ["2026.7.31-rc.1"],
        },
      }),
    ]);
  });

  it("signs connection descriptors with the advertised Ed25519 key", async () => {
    const connection = await service.connectionPackage();
    const signed = connection.descriptor;
    const canonical = (service as any).canonical(signed.payload);
    expect(
      verify(
        null,
        Buffer.from(canonical),
        keys.publicKey,
        Buffer.from(signed.signature, "base64url"),
      ),
    ).toBe(true);
    expect(JSON.stringify(connection)).not.toMatch(
      /operator|database|bootstrap/i,
    );
  });

  it("keeps cloud writes read-only until a paid or explicit trial entitlement exists", async () => {
    const entitlements = await service.entitlementPayload("workspace-1");
    expect(entitlements).toMatchObject({
      plan: "relay_connect_monthly",
      status: "subscription_required",
      mode: "read_only",
    });
  });

  it("repairs a stale persisted synchronization contract before serving the manifest", async () => {
    deploymentRepo.setValue({
      id: "deployment-row",
      deploymentKey: "deployment-test",
      displayName: "Test Relay",
      apiVersion: "v1",
      syncContractVersion: "2026-07-12.prd1.v1",
      runtimeContractVersion: "bridge.v1",
      marketplaceContractVersion: "swift-marketplace.v1",
      ownershipType: "relay_managed",
      capabilities: {
        workspaceSync: true,
        supportedObjectTypes: ["profile", "workspace", "agent"],
      },
    });

    const manifest = await service.manifest();

    expect(manifest.syncContractVersion).toBe(RELAY_SYNC_CONTRACT_VERSION);
    expect(
      (manifest.enabledFeatures as Record<string, unknown>).supportedObjectTypes,
    ).toEqual(
      expect.arrayContaining(["agent", "agent_document"]),
    );
    expect(deploymentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        syncContractVersion: RELAY_SYNC_CONTRACT_VERSION,
      }),
    );
  });

  it("automatically grants an invited workspace full beta access until the owner's 60-day window ends", async () => {
    const betaAccessEndsAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    workspaceRepo.findOne.mockResolvedValueOnce({
      id: "workspace-1",
      ownerId: "beta-user",
    });
    userRepo.findOne.mockResolvedValueOnce({
      id: "beta-user",
      betaAccessEndsAt,
    });

    const entitlements = await service.entitlementPayload("workspace-1");

    expect(entitlements).toMatchObject({
      plan: "relay_beta_60_day_full_access",
      status: "active",
      mode: "read_write",
      provider: "relay_beta",
      currentPeriodEndsAt: betaAccessEndsAt,
      features: {
        cloudControlPlane: true,
        customerRuntimeHosts: true,
        betaFullAccess: true,
      },
    });
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        trialEndsAt: betaAccessEndsAt,
        readOnlyAt: betaAccessEndsAt,
        currentPeriodEndsAt: betaAccessEndsAt,
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "billing.beta_access.granted",
        workspaceId: "workspace-1",
      }),
    );

    const signed = await service.entitlements("beta-user", "workspace-1");
    expect(
      verify(
        null,
        Buffer.from(canonicalWireJson(signed.payload)),
        keys.publicKey,
        Buffer.from(signed.signature, "base64url"),
      ),
    ).toBe(true);
  });

  it("masks stale managed-runtime entitlements and capacity while launch is disabled", async () => {
    await subscriptionRepo.save({
      workspaceId: "workspace-1",
      plan: "relay_managed_cloud_monthly",
      status: "active",
      features: {
        cloudControlPlane: true,
        customerRuntimeHosts: true,
        managedRuntime: true,
      },
      limits: { managedRuntimeMinutes: 10_000 },
    });
    await expect(
      service.entitlementPayload("workspace-1"),
    ).resolves.toMatchObject({
      features: {
        managedRuntime: false,
        managedCloudLaunchEnabled: false,
      },
      limits: { managedRuntimeMinutes: 0 },
    });
  });

  it("enables cloud writes for an active Relay Cloud subscription", async () => {
    await subscriptionRepo.save({
      workspaceId: "workspace-1",
      plan: "relay_connect_monthly",
      status: "active",
    });
    const entitlements = await service.entitlementPayload("workspace-1");
    expect(entitlements).toMatchObject({
      plan: "relay_connect_monthly",
      status: "active",
      mode: "read_write",
    });
  });

  it("grants explicit lifetime complimentary Relay Cloud access without pretending it is a paid provider subscription", async () => {
    const entitlements = await service.grantComplimentaryLifetimeAccess({
      workspaceId: "workspace-1",
      reason: "Relay owner account",
    });
    expect(entitlements).toMatchObject({
      plan: "relay_cloud_complimentary_lifetime",
      status: "active",
      mode: "read_write",
      provider: "relay_complimentary",
      currentPeriodEndsAt: null,
      features: { complimentaryLifetime: true },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "billing.complimentary_lifetime.granted",
        workspaceId: "workspace-1",
      }),
    );
  });

  it("expires bounded migration and billing grace without waiting for another provider event", async () => {
    const future = new Date(Date.now() + 60_000);
    await subscriptionRepo.save({
      workspaceId: "workspace-1",
      plan: "relay_cloud_migration_grace",
      status: "grace",
      provider: "relay_migration",
      graceEndsAt: future,
      readOnlyAt: future,
    });
    await expect(
      service.entitlementPayload("workspace-1"),
    ).resolves.toMatchObject({
      status: "grace",
      mode: "read_write",
    });

    const past = new Date(Date.now() - 60_000);
    await subscriptionRepo.save({
      workspaceId: "workspace-1",
      plan: "relay_cloud_migration_grace",
      status: "grace",
      provider: "relay_migration",
      graceEndsAt: past,
      readOnlyAt: past,
    });
    await expect(
      service.entitlementPayload("workspace-1"),
    ).resolves.toMatchObject({
      status: "grace",
      mode: "read_only",
    });
  });

  it("blocks unsafe writes for incompatible clients", async () => {
    await expect(
      service.compatibility("ios", "0.9.0", "v1"),
    ).resolves.toMatchObject({
      compatible: false,
      blockWrites: true,
      code: "CLIENT_UPGRADE_REQUIRED",
    });
    await expect(
      service.compatibility("ios", "1.0.0", "v1", "wrong"),
    ).resolves.toMatchObject({
      code: "DEPLOYMENT_ID_MISMATCH",
      blockWrites: true,
    });
    await expect(
      service.compatibility("relay_console_swift", "0.1.0", "v1"),
    ).resolves.toMatchObject({ compatible: true, minimumVersion: "0.1.0" });
    await expect(
      service.compatibility("web", "0.0.1", "v1"),
    ).resolves.toMatchObject({ compatible: true, minimumVersion: "0.0.1" });
    await expect(
      service.compatibility("web", "dev", "v1"),
    ).resolves.toMatchObject({
      compatible: false,
      code: "CLIENT_VERSION_INVALID",
    });
  });

  it("exports a content-free support bundle containing environment names but never values", async () => {
    const priorSecret = process.env.RELAY_SUPPORT_TEST_SECRET;
    process.env.RELAY_SUPPORT_TEST_SECRET = "support-secret-value";
    await backupRepo.save({
      deploymentKey: "deployment-test",
      status: "completed",
      completedAt: new Date("2026-07-14T11:00:00Z"),
      restoreTestedAt: null,
      encrypted: true,
      metadata: { customerContent: "private-backup-content" },
    });

    try {
      const bundle = await service.supportBundle("user-1", "workspace-1");
      const serialized = JSON.stringify(bundle);

      expect(membership.ensureWorkspaceAdminAccess).toHaveBeenCalledWith(
        "workspace-1",
        "user-1",
      );
      expect(bundle).toMatchObject({
        schemaVersion: "relay.support-bundle.v1",
        contentIncluded: false,
        secretValuesIncluded: false,
        recentEvents: [
          { code: "runtime.offline", resourceType: "runtime_device" },
        ],
        backup: { status: "completed", encrypted: true },
      });
      expect(bundle.environmentKeyNames).toContain("RELAY_SUPPORT_TEST_SECRET");
      expect(serialized).not.toContain("support-secret-value");
      expect(serialized).not.toContain("private-message");
      expect(serialized).not.toContain("private-token");
      expect(serialized).not.toContain("private-backup-content");
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "support.bundle.exported",
          workspaceId: "workspace-1",
        }),
      );
    } finally {
      if (priorSecret === undefined)
        delete process.env.RELAY_SUPPORT_TEST_SECRET;
      else process.env.RELAY_SUPPORT_TEST_SECRET = priorSecret;
    }
  });

  it("does not inspect support data when workspace admin access is denied", async () => {
    const backupReadsBefore = backupRepo.findOne.mock.calls.length;
    const auditRepositoryReadsBefore =
      dataSource.getRepository.mock.calls.length;
    membership.ensureWorkspaceAdminAccess.mockRejectedValueOnce(
      new Error("WORKSPACE_ADMIN_ACCESS_DENIED"),
    );

    await expect(
      service.supportBundle("user-a", "workspace-b"),
    ).rejects.toThrow("WORKSPACE_ADMIN_ACCESS_DENIED");

    expect(backupRepo.findOne).toHaveBeenCalledTimes(backupReadsBefore);
    expect(dataSource.getRepository).toHaveBeenCalledTimes(
      auditRepositoryReadsBefore,
    );
  });

  it("requires scoped, named, expiring, revocable support grants for content access", async () => {
    const before = Date.now();
    const grant = await service.createSupportGrant("user-1", "workspace-1", {
      supportPrincipalId: "support-person-1",
      scopes: ["content_read"],
      reason: "Customer approved message investigation",
      expiresInMinutes: 60,
    });

    expect(grant).toMatchObject({
      workspaceId: "workspace-1",
      grantedByUserId: "user-1",
      supportPrincipalId: "support-person-1",
      scopes: ["content_read"],
      revokedAt: null,
    });
    expect(grant.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 59 * 60_000,
    );
    expect(grant.expiresAt.getTime()).toBeLessThanOrEqual(before + 61 * 60_000);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "support.access.granted",
        workspaceId: "workspace-1",
      }),
    );

    const revoked = await service.revokeSupportGrant(
      "user-1",
      "workspace-1",
      grant.id,
    );
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "support.access.revoked",
        workspaceId: "workspace-1",
      }),
    );

    await expect(
      service.createSupportGrant("user-1", "workspace-1", {
        supportPrincipalId: "support-person-1",
        scopes: ["unbounded_database"],
        expiresInMinutes: 60,
      }),
    ).rejects.toThrow("SUPPORT_GRANT_INVALID");
    await expect(
      service.createSupportGrant("user-1", "workspace-1", {
        supportPrincipalId: "support-person-1",
        scopes: ["content_read"],
        expiresInMinutes: 1441,
      }),
    ).rejects.toThrow("SUPPORT_GRANT_EXPIRY_INVALID");
  });

  it("publishes only bounded audited incident state for the current deployment", async () => {
    const incident = await service.upsertIncident({
      deploymentKey: "deployment-test",
      severity: "major",
      status: "investigating",
      publicSummary:
        "Cloud message delivery is delayed while Relay investigates.",
      metadata: {
        ownerReference: "incident-owner-1",
        backendVersion: "2026.7.12",
        nextUpdateAt: "2026-07-14T21:00:00.000Z",
      },
    });

    expect(incident).toMatchObject({
      deploymentKey: "deployment-test",
      severity: "major",
      status: "investigating",
      publicSummary:
        "Cloud message delivery is delayed while Relay investigates.",
      resolvedAt: null,
      metadata: {
        ownerReference: "incident-owner-1",
        backendVersion: "2026.7.12",
        nextUpdateAt: "2026-07-14T21:00:00.000Z",
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "service.incident.updated",
        resourceType: "service_incident",
        resourceId: incident.id,
        metadata: {
          deploymentKey: "deployment-test",
          severity: "major",
          status: "investigating",
        },
      }),
    );

    const manifest = await service.manifest();
    expect(manifest.support.incident).toEqual({
      severity: "major",
      summary: "Cloud message delivery is delayed while Relay investigates.",
    });
    expect(JSON.stringify(manifest.support)).not.toMatch(
      /ownerReference|backendVersion|nextUpdateAt/,
    );
  });

  it("rejects invalid or secret-like public incident input", async () => {
    await expect(
      service.upsertIncident({
        deploymentKey: "another-deployment",
        severity: "major",
        status: "investigating",
        publicSummary: "A valid public incident summary.",
      }),
    ).rejects.toThrow("INCIDENT_DEPLOYMENT_INVALID");
    await expect(
      service.upsertIncident({
        deploymentKey: "deployment-test",
        severity: "catastrophic",
        status: "investigating",
        publicSummary: "A valid public incident summary.",
      }),
    ).rejects.toThrow("INCIDENT_SEVERITY_INVALID");
    await expect(
      service.upsertIncident({
        deploymentKey: "deployment-test",
        severity: "major",
        status: "investigating",
        publicSummary: "Provider token=sk_live_do_not_publish",
      }),
    ).rejects.toThrow("INCIDENT_SUMMARY_SECRET_LIKE");
    await expect(
      service.upsertIncident({
        deploymentKey: "deployment-test",
        severity: "major",
        status: "investigating",
        publicSummary: "A valid public incident summary.",
        metadata: { rawLogs: "private customer content" },
      }),
    ).rejects.toThrow("INCIDENT_METADATA_INVALID");
  });
});
