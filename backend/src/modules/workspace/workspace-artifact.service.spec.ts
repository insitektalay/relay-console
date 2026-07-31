import { WorkspaceArtifactService } from "./workspace-artifact.service";

function repo() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((value) => ({ ...value })),
    save: jest.fn(async (value) => value),
  } as any;
}

const item = {
  id: "artifact-local",
  title: "Competitive research index",
  kind: "document" as const,
  sourceKind: "cron_document",
  relativePath: "docs/competitive-research/index.md",
  fileExtension: "md",
  byteCount: 32_000_000_000,
  updatedAt: "2026-07-21T17:00:00.000Z",
  agentId: "max-agent",
  agentName: "Max Radical",
  cronJobName: "Relay Console competitive research docs",
  harnessType: "hermes",
  harnessLabel: "Hermes",
  isReadableText: true,
};

function service(overrides: { objects?: any } = {}) {
  const objects = overrides.objects ?? repo();
  const changes = repo();
  const agents = repo();
  const bridges = repo();
  const installations = repo();
  const links = repo();
  return {
    value: new WorkspaceArtifactService(
      objects,
      changes,
      agents,
      bridges,
      installations,
      links,
    ),
    objects,
    changes,
    agents,
    bridges,
    installations,
    links,
  };
}

describe("WorkspaceArtifactService", () => {
  it("stores metadata only for a source-scoped desktop catalogue", async () => {
    const test = service();
    test.installations.findOne.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      userId: "user-a",
      installationPublicId: "mac-installation",
      label: "Alex's MacBook",
      revokedAt: null,
    });
    test.links.findOne.mockResolvedValue({ status: "active" });
    test.agents.findOne.mockResolvedValue({
      id: "max-agent",
      name: "Max Radical",
      avatarUrl: "https://cdn.example/max.png",
    });

    const result = await test.value.synchronizeFromInstallation(
      "workspace-a",
      "user-a",
      {
        sourceInstallationId: "10000000-0000-4000-8000-000000000001",
        machineLabel: "Alex's MacBook",
        platform: "macos",
        artifacts: [item],
      },
    );

    expect(result.synchronized).toBe(1);
    expect(test.objects.save).toHaveBeenCalledWith(
      expect.objectContaining({
        objectType: "artifact",
        sourceInstallationId: "10000000-0000-4000-8000-000000000001",
        payload: expect.objectContaining({
          schemaVersion: "relay-artifact.v2",
          sourceMachineId: "mac-installation",
          sourceMachineLabel: "Alex's MacBook",
          relativePath: "docs/competitive-research/index.md",
          filename: "index.md",
          byteCount: 32_000_000_000,
          agentId: "max-agent",
          agentAvatarUrl: "https://cdn.example/max.png",
        }),
      }),
    );
    expect(JSON.stringify(test.objects.save.mock.calls)).not.toContain(
      "/Users/",
    );
    expect(JSON.stringify(test.objects.save.mock.calls)).not.toContain(
      "content",
    );
    expect(JSON.stringify(test.objects.save.mock.calls)).not.toContain(
      "preview",
    );
  });

  it("canonicalizes an HTTPS external URL before persistence", async () => {
    const test = service();
    test.installations.findOne.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      userId: "user-a",
      installationPublicId: "mac-installation",
      label: "MacBook",
      revokedAt: null,
    });
    test.links.findOne.mockResolvedValue({ status: "active" });

    await test.value.synchronizeFromInstallation("workspace-a", "user-a", {
      sourceInstallationId: "10000000-0000-4000-8000-000000000001",
      artifacts: [
        {
          ...item,
          sourceKind: "external",
          externalUrl: "HTTPS://Docs.Example.test:443/brief?q=1#section",
        },
      ],
    });

    expect(test.objects.save).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          externalUrl: "https://docs.example.test/brief?q=1#section",
        }),
      }),
    );
  });

  it.each([
    "http://docs.example.test/brief",
    "https:docs.example.test/brief",
    "https://user:secret@docs.example.test/brief",
    "https://docs.example.test\\@attacker.test/brief",
  ])("rejects unsafe URL input even when DTO validation is bypassed", async (url) => {
    const test = service();
    test.installations.findOne.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      userId: "user-a",
      installationPublicId: "mac-installation",
      label: "MacBook",
      revokedAt: null,
    });
    test.links.findOne.mockResolvedValue({ status: "active" });

    await expect(
      test.value.synchronizeFromInstallation("workspace-a", "user-a", {
        sourceInstallationId: "10000000-0000-4000-8000-000000000001",
        artifacts: [{ ...item, sourceKind: "external", externalUrl: url }],
      }),
    ).rejects.toThrow("INVALID_EXTERNAL_ARTIFACT_URL");
    expect(test.objects.save).not.toHaveBeenCalled();
  });

  it("lists only v2 catalogue metadata and derives source health", async () => {
    const objects = repo();
    objects.find.mockResolvedValue([
      {
        objectId: "art_good",
        payload: {
          ...item,
          id: "art_good",
          schemaVersion: "relay-artifact.v2",
          sourceKey: "client_installation:install-a:artifact-local",
          sourceArtifactId: "artifact-local",
          sourceIdentityKind: "client_installation",
          sourceIdentityId: "install-a",
          sourceMachineId: "mac-installation",
          sourceMachineLabel: "Alex's MacBook",
          sourcePlatform: "macos",
          filename: "index.md",
          syncedAt: "2026-07-21T18:00:00.000Z",
        },
      },
      {
        objectId: "old-v1",
        payload: {
          schemaVersion: "relay-artifact.v1",
          title: "Old cloud copy",
        },
      },
    ]);
    const test = service({ objects });
    test.installations.find.mockResolvedValue([
      { id: "install-a", lastSeenAt: new Date(), revokedAt: null },
    ]);

    const result = await test.value.list("workspace-a");

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]).toEqual(
      expect.objectContaining({
        id: "art_good",
        sourceHealth: "online",
        presentationState: "available",
        cloudContentAvailable: false,
        storageLocation: "source_machine",
      }),
    );
    expect(result.artifacts[0]).not.toHaveProperty("content");
  });

  it("presents unavailable moved expired deleted and permission-denied states explicitly", async () => {
    const objects = repo();
    const payload = (
      id: string,
      sourceIdentityId: string,
      presentationState?: string,
      externalUrl?: string,
    ) => ({
      ...item,
      id,
      schemaVersion: "relay-artifact.v2",
      sourceKey: `client_installation:${sourceIdentityId}:${id}`,
      sourceArtifactId: id,
      sourceIdentityKind: "client_installation",
      sourceIdentityId,
      sourceMachineId: sourceIdentityId,
      sourceMachineLabel: sourceIdentityId,
      sourcePlatform: "macos",
      filename: `${id}.md`,
      presentationState,
      externalUrl,
      syncedAt: "2026-07-21T18:00:00.000Z",
    });
    objects.find.mockResolvedValue([
      { objectId: "available", deletedAt: null, payload: payload("available", "online") },
      {
        objectId: "unavailable",
        deletedAt: null,
        payload: payload("unavailable", "offline"),
      },
      {
        objectId: "moved",
        deletedAt: null,
        payload: payload("moved", "online", "moved"),
      },
      {
        objectId: "expired",
        deletedAt: null,
        payload: payload(
          "expired",
          "online",
          "expired",
          "https://example.test/expired",
        ),
      },
      {
        objectId: "deleted",
        deletedAt: new Date("2026-07-21T19:00:00.000Z"),
        payload: payload("deleted", "online"),
      },
      {
        objectId: "permission",
        deletedAt: null,
        payload: payload("permission", "revoked"),
      },
    ]);
    const test = service({ objects });
    test.installations.find.mockResolvedValue([
      { id: "online", lastSeenAt: new Date(), revokedAt: null },
      {
        id: "offline",
        lastSeenAt: new Date("2020-01-01T00:00:00.000Z"),
        revokedAt: null,
      },
      { id: "revoked", lastSeenAt: new Date(), revokedAt: new Date() },
    ]);

    const result = await test.value.list("workspace-a");
    const states = Object.fromEntries(
      result.artifacts.map((artifact) => [
        artifact.id,
        artifact.presentationState,
      ]),
    );
    expect(states).toEqual({
      available: "available",
      unavailable: "unavailable",
      moved: "moved",
      expired: "expired",
      deleted: "deleted",
      permission: "permission_denied",
    });
    expect(result.artifacts.find((artifact) => artifact.id === "deleted"))
      .toEqual(
        expect.objectContaining({
          presentationReason: "The source no longer reports this artifact.",
        }),
      );
  });

  it("quarantines an unsafe persisted external URL before presentation", async () => {
    const objects = repo();
    objects.find.mockResolvedValue([
      {
        objectId: "legacy-http",
        deletedAt: null,
        payload: {
          ...item,
          id: "legacy-http",
          schemaVersion: "relay-artifact.v2",
          sourceKey: "bridge_device:device-a:legacy-http",
          sourceArtifactId: "legacy-http",
          sourceIdentityKind: "bridge_device",
          sourceIdentityId: "device-a",
          sourceMachineId: "device-a",
          sourceMachineLabel: "Bridge host",
          sourcePlatform: "linux",
          filename: "legacy.artifact.json",
          sourceKind: "external",
          externalUrl: "http://docs.example.test/private",
          presentationState: "available",
          presentationReason: "Attacker-controlled reason",
          syncedAt: "2026-07-21T18:00:00.000Z",
        },
      },
    ]);
    const test = service({ objects });

    const result = await test.value.list("workspace-a");

    expect(result.artifacts[0]).toEqual(
      expect.objectContaining({
        externalUrl: null,
        sourceHealth: "offline",
        presentationState: "unavailable",
        presentationReason:
          "External artifact link blocked because it does not use an approved HTTPS URL.",
      }),
    );
    expect(JSON.stringify(result)).not.toContain(
      "http://docs.example.test/private",
    );
    expect(JSON.stringify(result)).not.toContain("Attacker-controlled reason");
  });

  it("does not infer artifact ownership from a display name", async () => {
    const test = service();
    test.installations.findOne.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      userId: "user-a",
      installationPublicId: "mac-installation",
      label: "MacBook",
      revokedAt: null,
    });
    test.links.findOne.mockResolvedValue({ status: "active" });

    await test.value.synchronizeFromInstallation("workspace-a", "user-a", {
      sourceInstallationId: "10000000-0000-4000-8000-000000000001",
      artifacts: [{ ...item, agentId: undefined, agentName: "Max Radical" }],
    });

    expect(test.agents.findOne).not.toHaveBeenCalled();
    expect(test.objects.save).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          agentId: undefined,
          agentName: "Max Radical",
        }),
      }),
    );
  });

  it("never tombstones another machine's catalogue during synchronization", async () => {
    const objects = repo();
    objects.find.mockResolvedValue([
      {
        objectId: "pc-artifact",
        objectType: "artifact",
        serverVersion: "1",
        payload: {
          ...item,
          id: "pc-artifact",
          schemaVersion: "relay-artifact.v2",
          sourceKey: "bridge_device:pc-bridge:artifact-local",
          sourceArtifactId: "artifact-local",
          sourceIdentityKind: "bridge_device",
          sourceIdentityId: "pc-bridge",
          sourceMachineId: "pc-downstairs",
          sourceMachineLabel: "Downstairs PC",
          sourcePlatform: "windows",
          filename: "index.md",
          syncedAt: "2026-07-21T18:00:00.000Z",
        },
      },
    ]);
    const test = service({ objects });
    test.installations.findOne.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      userId: "user-a",
      installationPublicId: "mac-installation",
      label: "MacBook",
      revokedAt: null,
    });
    test.links.findOne.mockResolvedValue({ status: "active" });

    await test.value.synchronizeFromInstallation("workspace-a", "user-a", {
      sourceInstallationId: "10000000-0000-4000-8000-000000000001",
      artifacts: [],
    });

    expect(objects.save).not.toHaveBeenCalledWith(
      expect.objectContaining({
        objectId: "pc-artifact",
        deletedAt: expect.any(Date),
      }),
    );
  });
});
