import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { IsNull, Repository } from "typeorm";
import {
  BridgeDeviceEntity,
  BridgeDeviceStatus,
} from "../../entities/bridge-device.entity";
import { EventsGateway } from "../../gateways/events.gateway";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  hasExactRelayJwtAudience,
  RELAY_JWT_ALGORITHM,
  RELAY_JWT_AUDIENCES,
} from "../auth/auth-token-policy";
import { BRIDGE_RUNTIME_TYPES } from "./bridge-compatibility-policy";
import { normalizeServerAuthorizedBridgeCapabilities } from "./bridge-capabilities";
import {
  BRIDGE_ACCESS_AUDIENCE,
  BRIDGE_ACCESS_TOKEN_USE,
  BRIDGE_TOKEN_ISSUER,
  BRIDGE_WEBSOCKET_AUDIENCE,
  BRIDGE_WEBSOCKET_TOKEN_USE,
  isBridgeTokenId,
  resolveBridgeTokenPolicy,
} from "./bridge-token-policy";

interface BridgeCredentialMetadata {
  capabilities?: string[];
  pluginVersion?: string;
  openCoreVersion?: string;
}

interface BridgeIdentity {
  runtimeType: string | null;
  hostType: string | null;
}

interface AuditRequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class BridgeDeviceCredentials {
  constructor(
    private readonly bridgeDeviceRepo: Repository<BridgeDeviceEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly eventsGateway: EventsGateway,
    private readonly auditLog: AuditLogService,
  ) {}

  generateCredential(): string {
    return randomBytes(32).toString("base64url");
  }

  hashOpaqueSecret(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  matchesOpaqueSecret(
    value: string,
    expectedHash: string | null | undefined,
  ): boolean {
    if (
      typeof expectedHash !== "string" ||
      !/^[0-9a-f]{64}$/.test(expectedHash)
    ) {
      return false;
    }
    const actual = Buffer.from(this.hashOpaqueSecret(value), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  assertStableIdentity(
    device: BridgeDeviceEntity,
    compatibility: BridgeIdentity,
  ): void {
    if (
      !device.runtimeType ||
      !compatibility.runtimeType ||
      device.runtimeType !== compatibility.runtimeType ||
      !device.hostType ||
      !compatibility.hostType ||
      device.hostType !== compatibility.hostType
    ) {
      throw new UnauthorizedException(
        "Bridge runtime or host identity cannot change after enrollment",
      );
    }
  }

  async issueTokens(device: {
    id: string;
    workspaceId: string;
    devicePublicId: string;
    credentialVersion?: number;
  }) {
    const accessSecret = this.requiredSecret(
      "JWT_SECRET",
      "JWT_SECRET_MISSING",
    );
    const websocketSecret = this.requiredSecret(
      "JWT_WS_SECRET",
      "JWT_WS_SECRET_MISSING",
    );
    const policy = this.tokenPolicy();
    const commonPayload = {
      sub: device.id,
      did: device.id,
      workspaceId: device.workspaceId,
      dpid: device.devicePublicId,
      kind: "bridge_device",
      role: "bridge_device",
      cv: device.credentialVersion ?? 1,
    };
    const [accessToken, wsToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...commonPayload, tokenUse: BRIDGE_ACCESS_TOKEN_USE },
        {
          secret: accessSecret,
          expiresIn: policy.accessExpiresInSeconds,
          issuer: BRIDGE_TOKEN_ISSUER,
          audience: BRIDGE_ACCESS_AUDIENCE,
          algorithm: RELAY_JWT_ALGORITHM,
          jwtid: randomUUID(),
        },
      ),
      this.jwtService.signAsync(
        { ...commonPayload, tokenUse: BRIDGE_WEBSOCKET_TOKEN_USE },
        {
          secret: websocketSecret,
          expiresIn: policy.websocketExpiresInSeconds,
          issuer: BRIDGE_TOKEN_ISSUER,
          audience: BRIDGE_WEBSOCKET_AUDIENCE,
          algorithm: RELAY_JWT_ALGORITHM,
          jwtid: randomUUID(),
        },
      ),
    ]);
    return {
      accessToken,
      wsToken,
      accessExpiresIn: policy.accessExpiresInSeconds,
      wsExpiresIn: policy.websocketExpiresInSeconds,
    };
  }

  async authenticateAccessToken(authorizationHeader?: string) {
    const token = authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice("Bearer ".length).trim()
      : null;
    if (!token) {
      throw new UnauthorizedException("Missing bridge bearer token");
    }
    const verifyOptions = {
      secret: this.requiredSecret("JWT_SECRET", "JWT_SECRET_MISSING"),
      issuer: BRIDGE_TOKEN_ISSUER,
      audience: BRIDGE_ACCESS_AUDIENCE,
      algorithms: [RELAY_JWT_ALGORITHM],
    };
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, verifyOptions);
    } catch (error) {
      if (!this.isJwtExpiredError(error)) {
        throw new UnauthorizedException("Invalid bridge bearer token");
      }
      try {
        payload = await this.jwtService.verifyAsync(token, {
          ...verifyOptions,
          ignoreExpiration: true,
        });
      } catch {
        throw new UnauthorizedException("Invalid bridge bearer token");
      }
      if (!this.isExpiredAccessTokenWithinGrace(payload)) {
        throw new UnauthorizedException("Invalid bridge bearer token");
      }
    }
    if (
      payload.kind !== "bridge_device" ||
      payload.role !== "bridge_device" ||
      payload.tokenUse !== BRIDGE_ACCESS_TOKEN_USE ||
      !hasExactRelayJwtAudience(payload, RELAY_JWT_AUDIENCES.bridgeAccess) ||
      !isBridgeTokenId(payload.jti) ||
      typeof payload.sub !== "string" ||
      typeof payload.did !== "string" ||
      payload.sub !== payload.did ||
      typeof payload.dpid !== "string" ||
      typeof payload.workspaceId !== "string" ||
      !Number.isSafeInteger(payload.cv) ||
      payload.cv < 1
    ) {
      throw new UnauthorizedException("Invalid bridge bearer token");
    }
    const device = await this.bridgeDeviceRepo.findOne({
      where: { id: payload.did },
      select: [
        "id",
        "devicePublicId",
        "workspaceId",
        "runtimeType",
        "status",
        "revokedAt",
        "credentialVersion",
      ],
    });
    if (
      !device ||
      device.status !== BridgeDeviceStatus.ACTIVE ||
      device.revokedAt
    ) {
      throw new UnauthorizedException("Bridge device has been revoked");
    }
    const runtimeType = BRIDGE_RUNTIME_TYPES.find(
      (candidate) => candidate === device.runtimeType,
    );
    if (!runtimeType) {
      throw new UnauthorizedException(
        "Bridge device has no supported runtime identity",
      );
    }
    if (payload.cv !== device.credentialVersion) {
      throw new UnauthorizedException("Bridge device credential was rotated");
    }
    if (
      payload.dpid !== device.devicePublicId ||
      payload.workspaceId !== device.workspaceId
    ) {
      throw new UnauthorizedException("Invalid bridge bearer token");
    }
    await this.bridgeDeviceRepo.update(device.id, { lastSeenAt: new Date() });
    return {
      deviceId: device.id,
      devicePublicId: device.devicePublicId,
      workspaceId: device.workspaceId,
      runtimeType,
    };
  }

  async rotateAndIssueTokens(
    device: BridgeDeviceEntity,
    metadata: BridgeCredentialMetadata,
    compatibility: BridgeIdentity,
    eventType:
      | "bridge.device.auth.success"
      | "bridge.device.credential_rotated",
    requestContext?: AuditRequestContext,
  ) {
    const credentialVersion = device.credentialVersion ?? 1;
    if (
      !Number.isSafeInteger(credentialVersion) ||
      credentialVersion < 1 ||
      credentialVersion >= 2_147_483_647
    ) {
      throw new UnauthorizedException("Invalid bridge device credentials");
    }
    const previousCredentialHash = device.credentialHash;
    const nextToken = this.generateCredential();
    const nextCredentialHash = this.hashOpaqueSecret(nextToken);
    const rotatedAt = new Date();
    const capabilities = Array.isArray(metadata.capabilities)
      ? normalizeServerAuthorizedBridgeCapabilities(metadata.capabilities)
      : device.capabilities;
    const rotation = await this.bridgeDeviceRepo.update(
      {
        id: device.id,
        credentialHash: previousCredentialHash,
        status: BridgeDeviceStatus.ACTIVE,
        revokedAt: IsNull(),
      },
      {
        credentialHash: nextCredentialHash,
        previousCredentialHash,
        previousCredentialVersion: credentialVersion,
        previousCredentialConsumedAt: rotatedAt,
        credentialVersion: () => '"credentialVersion" + 1',
        credentialRotatedAt: rotatedAt,
        pluginVersion: metadata.pluginVersion ?? device.pluginVersion,
        openCoreVersion: metadata.openCoreVersion ?? device.openCoreVersion,
        runtimeType: compatibility.runtimeType,
        hostType: compatibility.hostType,
        capabilities,
        lastSeenAt: rotatedAt,
      },
    );
    if (rotation?.affected !== 1) {
      await this.rejectReplay(device, requestContext);
    }
    device.previousCredentialHash = previousCredentialHash;
    device.previousCredentialVersion = credentialVersion;
    device.previousCredentialConsumedAt = rotatedAt;
    device.credentialHash = nextCredentialHash;
    device.credentialVersion = credentialVersion + 1;
    device.credentialRotatedAt = rotatedAt;
    device.pluginVersion = metadata.pluginVersion ?? device.pluginVersion;
    device.openCoreVersion = metadata.openCoreVersion ?? device.openCoreVersion;
    device.runtimeType = compatibility.runtimeType;
    device.hostType = compatibility.hostType;
    device.capabilities = capabilities;
    device.lastSeenAt = rotatedAt;
    this.eventsGateway.disconnectBridgeDevice(device.id);
    const tokens = await this.issueTokens(device);
    await this.auditLog.record({
      actorType: "bridge_device",
      actorId: device.id,
      workspaceId: device.workspaceId,
      eventType,
      resourceType: "bridge_device",
      resourceId: device.id,
      ipAddress: requestContext?.ipAddress ?? null,
      userAgent: requestContext?.userAgent ?? null,
      metadata: {
        devicePublicId: device.devicePublicId,
        credentialVersion: device.credentialVersion,
      },
    });
    return {
      device,
      credentials: {
        devicePublicId: device.devicePublicId,
        deviceToken: nextToken,
      },
      tokens,
    };
  }

  async rejectReplay(
    device: Pick<
      BridgeDeviceEntity,
      "id" | "devicePublicId" | "workspaceId" | "status" | "revokedAt"
    >,
    requestContext?: AuditRequestContext,
  ): Promise<never> {
    const revokedAt = new Date();
    if (device.status === BridgeDeviceStatus.ACTIVE && !device.revokedAt) {
      await this.bridgeDeviceRepo.update(
        {
          id: device.id,
          status: BridgeDeviceStatus.ACTIVE,
          revokedAt: IsNull(),
        },
        { status: BridgeDeviceStatus.REVOKED, revokedAt },
      );
      this.eventsGateway.disconnectBridgeDevice(device.id);
    }
    await this.auditLog.record({
      actorType: "bridge_device",
      actorId: device.id,
      workspaceId: device.workspaceId,
      eventType: "bridge.device.credential_replay_detected",
      resourceType: "bridge_device",
      resourceId: device.id,
      ipAddress: requestContext?.ipAddress ?? null,
      userAgent: requestContext?.userAgent ?? null,
      metadata: { devicePublicId: device.devicePublicId },
    });
    throw new UnauthorizedException("Invalid bridge device credentials");
  }

  private requiredSecret(name: string, errorCode: string): string {
    const secret = this.config.get<string>(name)?.trim();
    if (!secret) throw new Error(errorCode);
    return secret;
  }

  private tokenPolicy() {
    return resolveBridgeTokenPolicy((name) => this.config.get<string>(name));
  }

  private isJwtExpiredError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === "TokenExpiredError" ||
        error.constructor?.name === "TokenExpiredError")
    );
  }

  private isExpiredAccessTokenWithinGrace(payload: { exp?: unknown }): boolean {
    if (typeof payload.exp !== "number") return false;
    const expiredForSeconds = Date.now() / 1000 - payload.exp;
    return (
      expiredForSeconds < 0 ||
      expiredForSeconds <= this.tokenPolicy().expiredAccessGraceSeconds
    );
  }
}
