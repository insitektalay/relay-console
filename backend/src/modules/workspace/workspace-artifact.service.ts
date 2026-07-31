import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import { In, IsNull, Repository } from "typeorm";
import {
  AgentEntity,
  BridgeDeviceEntity,
  RelayClientInstallationEntity,
  RelaySyncObjectEntity,
  RelayWorkspaceChangeEntity,
  RelayWorkspaceSyncLinkEntity,
  RuntimeHostEntity,
} from "../../entities";
import { BridgeDeviceStatus } from "../../entities/bridge-device.entity";
import {
  WorkspaceArtifactSyncDto,
  WorkspaceArtifactSyncItemDto,
} from "./dto/artifact.dto";
import {
  EXTERNAL_ARTIFACT_URL_BLOCKED_REASON,
  normalizeExternalArtifactUrl,
} from "./artifact-url-policy";

const ARTIFACT_SCHEMA = "relay-artifact.v2";
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

type SourceIdentityKind = "client_installation" | "bridge_device";
type SourcePlatform = "macos" | "windows" | "linux" | "unknown";
type ArtifactSourceHealth = "online" | "offline" | "revoked" | "external";
type ArtifactPresentationState =
  | "available"
  | "unavailable"
  | "moved"
  | "expired"
  | "deleted"
  | "permission_denied";

type ArtifactSource = {
  identityKind: SourceIdentityKind;
  identityId: string;
  machineId: string;
  machineLabel: string;
  platform: SourcePlatform;
  actorUserId: string | null;
  installationId: string | null;
};

type WorkspaceArtifactPayload = WorkspaceArtifactSyncItemDto & {
  schemaVersion: typeof ARTIFACT_SCHEMA;
  sourceKey: string;
  sourceArtifactId: string;
  sourceIdentityKind: SourceIdentityKind;
  sourceIdentityId: string;
  sourceMachineId: string;
  sourceMachineLabel: string;
  sourcePlatform: SourcePlatform;
  runtimeHostId: string | null;
  filename: string;
  agentAvatarUrl?: string | null;
  syncedAt: string;
};

@Injectable()
export class WorkspaceArtifactService {
  constructor(
    @InjectRepository(RelaySyncObjectEntity)
    private readonly objects: Repository<RelaySyncObjectEntity>,
    @InjectRepository(RelayWorkspaceChangeEntity)
    private readonly changes: Repository<RelayWorkspaceChangeEntity>,
    @InjectRepository(AgentEntity)
    private readonly agents: Repository<AgentEntity>,
    @InjectRepository(BridgeDeviceEntity)
    private readonly bridgeDevices: Repository<BridgeDeviceEntity>,
    @InjectRepository(RelayClientInstallationEntity)
    private readonly installations: Repository<RelayClientInstallationEntity>,
    @InjectRepository(RelayWorkspaceSyncLinkEntity)
    private readonly syncLinks: Repository<RelayWorkspaceSyncLinkEntity>,
    @Optional()
    @InjectRepository(RuntimeHostEntity)
    private readonly runtimeHosts?: Repository<RuntimeHostEntity>,
  ) {}

  async list(workspaceId: string) {
    const objects = await this.artifactObjectsForPresentation(workspaceId);
    const entries = objects
      .map((object) => ({ object, payload: this.payload(object) }))
      .filter(
        (
          entry,
        ): entry is {
          object: RelaySyncObjectEntity;
          payload: WorkspaceArtifactPayload;
        } => Boolean(entry.payload),
      );
    const sourceHealth = await this.sourceHealth(
      entries.map((entry) => entry.payload),
    );
    const artifacts = entries
      .map(({ object, payload }) =>
        this.metadata(payload, sourceHealth, object.deletedAt),
      )
      .sort((left, right) =>
        (right.updatedAt ?? right.syncedAt).localeCompare(
          left.updatedAt ?? left.syncedAt,
        ),
      );
    return { artifacts, refreshedAt: new Date().toISOString() };
  }

  async detail(workspaceId: string, artifactId: string) {
    const object = await this.objects.findOne({
      where: {
        workspaceId,
        objectType: "artifact",
        objectId: artifactId,
      },
    });
    const artifact = object ? this.payload(object) : null;
    if (!artifact) throw new NotFoundException("ARTIFACT_NOT_FOUND");
    return this.metadata(
      artifact,
      await this.sourceHealth([artifact]),
      object?.deletedAt ?? null,
    );
  }

  async synchronizeFromInstallation(
    workspaceId: string,
    userId: string,
    dto: WorkspaceArtifactSyncDto,
  ) {
    if (!dto.sourceInstallationId) {
      throw new BadRequestException("ARTIFACT_SOURCE_INSTALLATION_REQUIRED");
    }
    const installation = await this.installations.findOne({
      where: { id: dto.sourceInstallationId, userId, revokedAt: IsNull() },
    });
    if (!installation)
      throw new ForbiddenException("ARTIFACT_SOURCE_INSTALLATION_INVALID");
    const link = await this.syncLinks.findOne({
      where: { workspaceId, installationId: installation.id, userId },
    });
    if (!link || link.status === "unlinked") {
      throw new ForbiddenException("ARTIFACT_SOURCE_NOT_LINKED_TO_WORKSPACE");
    }
    installation.lastSeenAt = new Date();
    await this.installations.save(installation);
    return this.synchronize(
      workspaceId,
      {
        identityKind: "client_installation",
        identityId: installation.id,
        machineId: dto.machineId?.trim() || installation.installationPublicId,
        machineLabel:
          dto.machineLabel?.trim() || installation.label || "Relay Console Mac",
        platform: dto.platform ?? "macos",
        actorUserId: userId,
        installationId: installation.id,
      },
      dto.artifacts,
    );
  }

  async synchronizeFromBridge(
    workspaceId: string,
    bridgeDeviceId: string,
    dto: WorkspaceArtifactSyncDto,
  ) {
    const device = await this.bridgeDevices.findOne({
      where: { id: bridgeDeviceId, workspaceId },
    });
    if (
      !device ||
      device.status !== BridgeDeviceStatus.ACTIVE ||
      device.revokedAt
    ) {
      throw new ForbiddenException("ARTIFACT_SOURCE_BRIDGE_INVALID");
    }
    device.lastSeenAt = new Date();
    await this.bridgeDevices.save(device);
    return this.synchronize(
      workspaceId,
      {
        identityKind: "bridge_device",
        identityId: device.id,
        machineId: dto.machineId?.trim() || device.devicePublicId,
        machineLabel: dto.machineLabel?.trim() || device.label,
        platform: dto.platform ?? this.platformForHost(device.hostType),
        actorUserId: null,
        installationId: null,
      },
      dto.artifacts,
    );
  }

  private async synchronize(
    workspaceId: string,
    source: ArtifactSource,
    incoming: WorkspaceArtifactSyncItemDto[],
  ) {
    const now = new Date();
    const existing = await this.artifactObjects(workspaceId);
    const sourceObjects = existing
      .map((object) => ({ object, payload: this.payload(object) }))
      .filter(
        (
          entry,
        ): entry is {
          object: RelaySyncObjectEntity;
          payload: WorkspaceArtifactPayload;
        } =>
          Boolean(entry.payload) &&
          entry.payload.sourceIdentityKind === source.identityKind &&
          entry.payload.sourceIdentityId === source.identityId,
      );
    const existingBySourceArtifactId = new Map(
      sourceObjects.map((entry) => [
        entry.payload.sourceArtifactId,
        entry.object,
      ]),
    );
    const seen = new Set<string>();

    for (const item of incoming) {
      const relativePath = this.normalizeRelativePath(item.relativePath);
      const sourceArtifactId = item.id.trim();
      if (!sourceArtifactId || seen.has(sourceArtifactId)) continue;
      seen.add(sourceArtifactId);
      const externalUrl =
        item.externalUrl === undefined
          ? undefined
          : normalizeExternalArtifactUrl(item.externalUrl);
      if (item.externalUrl !== undefined && !externalUrl) {
        throw new BadRequestException("INVALID_EXTERNAL_ARTIFACT_URL");
      }

      const agent = item.agentId
        ? await this.agents.findOne({
            where: { workspaceId, id: item.agentId },
          })
        : null;
      const runtimeHost = this.runtimeHosts
        ? await this.runtimeHosts.findOne({
            where:
              source.identityKind === "bridge_device"
                ? { workspaceId, bridgeDeviceId: source.identityId }
                : { workspaceId, clientInstallationId: source.identityId },
          })
        : null;
      const sourceKey = `${source.identityKind}:${source.identityId}:${sourceArtifactId}`;
      const current = existingBySourceArtifactId.get(sourceArtifactId) ?? null;
      const currentPayload = current ? this.payload(current) : null;
      const objectId = current?.objectId ?? this.objectId(sourceKey);
      const version = String(Number(current?.serverVersion ?? "0") + 1);
      const payload: WorkspaceArtifactPayload = {
        ...item,
        externalUrl,
        id: objectId,
        schemaVersion: ARTIFACT_SCHEMA,
        sourceKey,
        sourceArtifactId,
        sourceIdentityKind: source.identityKind,
        sourceIdentityId: source.identityId,
        sourceMachineId: source.machineId,
        sourceMachineLabel: source.machineLabel,
        sourcePlatform: source.platform,
        runtimeHostId: runtimeHost?.id ?? null,
        relativePath,
        filename: relativePath.split("/").pop() ?? item.title,
        agentId: agent?.id ?? undefined,
        agentName: agent?.name ?? item.agentName,
        agentAvatarUrl: agent?.avatarUrl ?? null,
        presentationState:
          item.presentationState ??
          (currentPayload && currentPayload.relativePath !== relativePath
            ? "moved"
            : "available"),
        presentationReason: item.presentationReason ?? null,
        syncedAt: now.toISOString(),
      };
      if (
        currentPayload &&
        this.fingerprint(currentPayload) === this.fingerprint(payload)
      ) {
        continue;
      }
      const saved = await this.objects.save(
        this.objects.create({
          ...current,
          workspaceId,
          objectType: "artifact",
          objectId,
          sourceInstallationId: source.installationId,
          sourceObjectId: sourceArtifactId,
          canonicalObjectId: current?.canonicalObjectId ?? objectId,
          serverVersion: version,
          payload: payload as unknown as Record<string, unknown>,
          deletedAt: null,
        }),
      );
      await this.recordChange(
        workspaceId,
        source,
        saved,
        "upsert",
        payload as unknown as Record<string, unknown>,
      );
    }

    for (const { object, payload } of sourceObjects) {
      if (seen.has(payload.sourceArtifactId)) continue;
      object.serverVersion = String(Number(object.serverVersion) + 1);
      object.deletedAt = now;
      const saved = await this.objects.save(object);
      await this.recordChange(workspaceId, source, saved, "tombstone", {
        deletedAt: now.toISOString(),
        canonicalObjectId: saved.canonicalObjectId,
      });
    }

    return {
      synchronized: seen.size,
      sourceMachineId: source.machineId,
      sourceIdentityId: source.identityId,
      refreshedAt: now.toISOString(),
    };
  }

  private artifactObjects(workspaceId: string) {
    return this.objects.find({
      where: { workspaceId, objectType: "artifact", deletedAt: IsNull() },
      order: { updatedAt: "DESC" },
    });
  }

  private artifactObjectsForPresentation(workspaceId: string) {
    return this.objects.find({
      where: { workspaceId, objectType: "artifact" },
      order: { updatedAt: "DESC" },
    });
  }

  private payload(
    object: RelaySyncObjectEntity,
  ): WorkspaceArtifactPayload | null {
    const payload = object.payload as Partial<WorkspaceArtifactPayload>;
    if (
      payload.schemaVersion !== ARTIFACT_SCHEMA ||
      typeof payload.sourceKey !== "string" ||
      typeof payload.sourceArtifactId !== "string" ||
      (payload.sourceIdentityKind !== "client_installation" &&
        payload.sourceIdentityKind !== "bridge_device") ||
      typeof payload.sourceIdentityId !== "string" ||
      typeof payload.sourceMachineId !== "string" ||
      typeof payload.sourceMachineLabel !== "string" ||
      typeof payload.relativePath !== "string" ||
      typeof payload.title !== "string" ||
      typeof payload.kind !== "string"
    )
      return null;
    return payload as WorkspaceArtifactPayload;
  }

  private metadata(
    payload: WorkspaceArtifactPayload,
    sourceHealth: Map<
      string,
      { health: ArtifactSourceHealth; lastSeenAt: string | null }
    >,
    deletedAt: Date | null = null,
  ) {
    const externalUrl = payload.externalUrl
      ? normalizeExternalArtifactUrl(payload.externalUrl)
      : null;
    const blockedExternalUrl = Boolean(payload.externalUrl) && !externalUrl;
    const safePayload = {
      ...payload,
      externalUrl,
    };
    const status = externalUrl
      ? { health: "external" as const, lastSeenAt: null }
      : (sourceHealth.get(this.healthKey(payload)) ?? {
          health: "offline" as const,
          lastSeenAt: null,
        });
    return {
      ...safePayload,
      sourceHealth: status.health,
      sourceLastSeenAt: status.lastSeenAt,
      presentationState:
        blockedExternalUrl &&
        !deletedAt &&
        (payload.presentationState === undefined ||
          payload.presentationState === "available" ||
          payload.presentationState === "moved")
          ? "unavailable"
          : this.presentationState(
              payload.presentationState,
              status.health,
              deletedAt,
            ),
      presentationReason:
        deletedAt
          ? "The source no longer reports this artifact."
          : blockedExternalUrl
            ? EXTERNAL_ARTIFACT_URL_BLOCKED_REASON
            : payload.presentationReason ??
              this.defaultPresentationReason(status.health),
      cloudContentAvailable: false,
      storageLocation: "source_machine" as const,
    };
  }

  private presentationState(
    reported: ArtifactPresentationState | undefined,
    health: ArtifactSourceHealth,
    deletedAt: Date | null,
  ): ArtifactPresentationState {
    if (deletedAt) return "deleted";
    if (
      reported === "moved" ||
      reported === "expired" ||
      reported === "deleted" ||
      reported === "permission_denied"
    )
      return reported;
    if (health === "revoked") return "permission_denied";
    if (health === "offline") return "unavailable";
    return reported ?? "available";
  }

  private defaultPresentationReason(health: ArtifactSourceHealth) {
    if (health === "revoked")
      return "Relay no longer has permission to reach the source.";
    if (health === "offline")
      return "The source device is offline or has stopped reporting.";
    return null;
  }

  private async sourceHealth(payloads: WorkspaceArtifactPayload[]) {
    const installationIds = [
      ...new Set(
        payloads
          .filter(
            (payload) => payload.sourceIdentityKind === "client_installation",
          )
          .map((payload) => payload.sourceIdentityId),
      ),
    ];
    const bridgeIds = [
      ...new Set(
        payloads
          .filter((payload) => payload.sourceIdentityKind === "bridge_device")
          .map((payload) => payload.sourceIdentityId),
      ),
    ];
    const [installations, devices] = await Promise.all([
      installationIds.length
        ? this.installations.find({ where: { id: In(installationIds) } })
        : Promise.resolve([]),
      bridgeIds.length
        ? this.bridgeDevices.find({ where: { id: In(bridgeIds) } })
        : Promise.resolve([]),
    ]);
    const result = new Map<
      string,
      { health: ArtifactSourceHealth; lastSeenAt: string | null }
    >();
    for (const installation of installations) {
      result.set(`client_installation:${installation.id}`, {
        health: installation.revokedAt
          ? "revoked"
          : this.isOnline(installation.lastSeenAt)
            ? "online"
            : "offline",
        lastSeenAt: installation.lastSeenAt?.toISOString() ?? null,
      });
    }
    for (const device of devices) {
      result.set(`bridge_device:${device.id}`, {
        health:
          device.status === BridgeDeviceStatus.REVOKED || device.revokedAt
            ? "revoked"
            : this.isOnline(device.lastSeenAt)
              ? "online"
              : "offline",
        lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      });
    }
    return result;
  }

  private isOnline(lastSeenAt: Date | null) {
    return Boolean(
      lastSeenAt && Date.now() - lastSeenAt.getTime() <= ONLINE_WINDOW_MS,
    );
  }

  private healthKey(payload: WorkspaceArtifactPayload) {
    return `${payload.sourceIdentityKind}:${payload.sourceIdentityId}`;
  }

  private platformForHost(hostType: string | null): SourcePlatform {
    const value = hostType?.toLowerCase() ?? "";
    if (value.includes("windows")) return "windows";
    if (value.includes("mac") || value.includes("darwin")) return "macos";
    if (
      value.includes("linux") ||
      value.includes("service") ||
      value.includes("vps")
    )
      return "linux";
    return "unknown";
  }

  private normalizeRelativePath(value: string) {
    const normalized = value.trim().replace(/^\/+|\/+$/g, "");
    const parts = normalized.split("/");
    if (
      !normalized ||
      normalized.startsWith("~") ||
      /^[A-Za-z]:/.test(normalized) ||
      parts.length > 20 ||
      parts.some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          part.includes("\\") ||
          part.includes("\0"),
      )
    )
      throw new BadRequestException("INVALID_ARTIFACT_RELATIVE_PATH");
    return parts.join("/");
  }

  private objectId(sourceKey: string) {
    return `art_${createHash("sha256").update(sourceKey).digest("hex").slice(0, 40)}`;
  }

  private fingerprint(payload: WorkspaceArtifactPayload) {
    const { syncedAt: _syncedAt, ...stable } = payload;
    return JSON.stringify(stable);
  }

  private async recordChange(
    workspaceId: string,
    source: ArtifactSource,
    object: RelaySyncObjectEntity,
    changeType: "upsert" | "tombstone",
    payload: Record<string, unknown>,
  ) {
    await this.changes.save(
      this.changes.create({
        workspaceId,
        changeType,
        objectType: "artifact",
        objectId: object.objectId,
        serverVersion: object.serverVersion,
        payload,
        actorUserId: source.actorUserId,
        installationId: source.installationId,
      }),
    );
  }
}
