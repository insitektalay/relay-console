import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import {
  createHash,
  createPrivateKey,
  sign as signBytes,
  timingSafeEqual,
} from "crypto";
import { DataSource, IsNull, MoreThan, Repository } from "typeorm";
import {
  AuditLogEntity,
  RelayBackupRecordEntity,
  RelayCommercialSubscriptionEntity,
  RelayDeploymentEntity,
  RelayOperatorDeploymentEntity,
  RelayOperatorProvisioningJobEntity,
  RelayOwnerBootstrapEntity,
  RelayServiceIncidentEntity,
  RelaySupportAccessGrantEntity,
  UserEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
  WorkspaceMemberRole,
} from "../../entities";
import { AuditLogService } from "../audit-log/audit-log.service";
import { AuthService } from "../auth/auth.service";
import {
  hashAccountPassword,
  isBcryptCompatiblePassword,
} from "../auth/password-policy";
import { HealthService } from "../health/health.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { isManagedCloudLaunchEnabled } from "../../config/managed-cloud-launch.policy";
import {
  BRIDGE_COMPATIBILITY_MANIFEST,
  RELAY_RUNTIME_CONNECTOR_CONTRACT,
  RELAY_RUNTIME_CONNECTOR_PROTOCOLS,
} from "../bridge/bridge-compatibility-policy";
import {
  evaluateRelayClientVersion,
  RELAY_MINIMUM_CLIENTS,
} from "./client-compatibility-policy";
import { isRelayCloudWritableEntitlement } from "./entitlement-policy";
import {
  RELAY_SYNC_CONTRACT_VERSION,
  RELAY_SYNC_OBJECT_TYPES,
} from "../relay-sync/relay-sync.types";

const API_CONTRACT = "v1";
const PRODUCT_VERSION = "2026.7.12";
const RUNTIME_CONTRACT = "bridge.v1";
const MARKETPLACE_CONTRACT = "swift-marketplace.v1";
const SIGNATURE_ALGORITHM = "ed25519";
const SUPPORT_SCOPES = new Set([
  "diagnostics",
  "deployment",
  "backup",
  "content_read",
]);

type JsonObject = Record<string, unknown>;

@Injectable()
export class CloudCommercialService {
  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly auth: AuthService,
    private readonly audit: AuditLogService,
    private readonly membership: WorkspaceMembershipService,
    private readonly health: HealthService,
    @InjectRepository(RelayDeploymentEntity)
    private readonly deployments: Repository<RelayDeploymentEntity>,
    @InjectRepository(RelayCommercialSubscriptionEntity)
    private readonly subscriptions: Repository<RelayCommercialSubscriptionEntity>,
    @InjectRepository(RelaySupportAccessGrantEntity)
    private readonly supportGrants: Repository<RelaySupportAccessGrantEntity>,
    @InjectRepository(RelayBackupRecordEntity)
    private readonly backups: Repository<RelayBackupRecordEntity>,
    @InjectRepository(RelayOperatorDeploymentEntity)
    private readonly operatorDeployments: Repository<RelayOperatorDeploymentEntity>,
    @InjectRepository(RelayOperatorProvisioningJobEntity)
    private readonly provisioningJobs: Repository<RelayOperatorProvisioningJobEntity>,
    @InjectRepository(RelayServiceIncidentEntity)
    private readonly incidents: Repository<RelayServiceIncidentEntity>,
  ) {}

  async manifest() {
    const deployment = await this.ensureDeployment();
    const origins = this.origins();
    const incident = await this.incidents.findOne({
      where: { deploymentKey: deployment.deploymentKey, resolvedAt: IsNull() },
      order: { startedAt: "DESC" },
    });
    const managedCloudLaunchEnabled = isManagedCloudLaunchEnabled(this.config);
    const enabledFeatures = {
      ...deployment.capabilities,
      managedRuntime:
        managedCloudLaunchEnabled &&
        deployment.capabilities?.managedRuntime === true,
      managedCloudLaunchEnabled,
      runtimeConnectorProtocolV2: true,
      runtimeConnectorProtocolV3: true,
      runtimeConnectorProtocols: [...RELAY_RUNTIME_CONNECTOR_PROTOCOLS],
    };
    return {
      schemaVersion: "relay.deployment-manifest.v1",
      // Native clients pin the immutable deployment row id. The deployment
      // key is the public configuration key used when registering a client.
      deploymentId: deployment.id,
      deploymentKey: deployment.deploymentKey,
      displayName: deployment.displayName,
      productVersion:
        this.config.get<string>("RELAY_RELEASE_VERSION") || PRODUCT_VERSION,
      apiContractVersion: deployment.apiVersion || API_CONTRACT,
      apiVersion: deployment.apiVersion || API_CONTRACT,
      syncContractVersion: deployment.syncContractVersion,
      runtimeHostContractVersion: RELAY_RUNTIME_CONNECTOR_CONTRACT,
      supportedRuntimeHostContractVersions: [
        ...RELAY_RUNTIME_CONNECTOR_PROTOCOLS,
      ],
      runtimeContractVersion:
        deployment.runtimeContractVersion || RUNTIME_CONTRACT,
      marketplaceContractVersion:
        deployment.marketplaceContractVersion || MARKETPLACE_CONTRACT,
      origins,
      ownershipType: this.ownershipType(deployment),
      releaseChannel:
        this.config.get<string>("RELAY_RELEASE_CHANNEL") || "stable",
      minimumClients: this.minimumClients(),
      maximumClientContract: API_CONTRACT,
      enabledFeatures,
      features: enabledFeatures,
      limits: this.defaultLimits(),
      authenticationMethods: [
        "password",
        "web_cookie",
        "mobile_refresh",
        "websocket_ticket",
      ],
      attachmentCapability: {
        enabled: true,
        maxBytes: 52_428_800,
        signedUploads: true,
      },
      marketplaceConnectorModes: this.marketplaceModes(),
      supportedBridgeReleases: this.bridgeReleases(),
      support: {
        status: incident ? "incident" : "supported",
        incident: incident
          ? { severity: incident.severity, summary: incident.publicSummary }
          : null,
        supportUrl:
          this.config.get<string>("RELAY_SUPPORT_URL") ||
          "https://relayconsole.work/support",
      },
      upgrade: {
        status: this.config.get<string>("RELAY_UPGRADE_STATUS") || "current",
        supportedReleaseWindow:
          this.config.get<string>("RELAY_SUPPORTED_RELEASE_WINDOW") ||
          "current-and-previous",
        releaseNotesUrl:
          this.config.get<string>("RELAY_RELEASE_NOTES_URL") ||
          "https://relayconsole.work/release-notes",
      },
      connectionDescriptorSigning: {
        algorithm: SIGNATURE_ALGORITHM,
        keyId:
          this.config.get<string>("CONNECTION_DESCRIPTOR_KEY_ID") ||
          "deployment-v1",
        publicKey:
          this.config.get<string>("CONNECTION_DESCRIPTOR_PUBLIC_KEY") || null,
      },
    };
  }

  async releaseManifest() {
    const manifest = await this.manifest();
    return {
      schemaVersion: "relay.release-manifest.v1",
      releaseChannel: manifest.releaseChannel,
      backendVersion: manifest.productVersion,
      webVersion:
        this.config.get<string>("RELAY_WEB_VERSION") || manifest.productVersion,
      databaseMigrationRange: {
        minimum: "049",
        current: await this.migrationVersion(),
      },
      clientContractRange: {
        minimum: "v1",
        maximum: manifest.maximumClientContract,
      },
      runtimeHostContractVersion: manifest.runtimeHostContractVersion,
      supportedRuntimeHostContractVersions:
        manifest.supportedRuntimeHostContractVersions,
      bridgeReleases: manifest.supportedBridgeReleases,
      marketplaceContractVersion: manifest.marketplaceContractVersion,
      marketplaceBrokerConformance:
        this.config.get<string>("RELAY_MARKETPLACE_CONFORMANCE") ||
        "swift-reference",
      rollbackClassification:
        this.config.get<string>("RELAY_ROLLBACK_CLASSIFICATION") ||
        "backup-required",
      backupRequired: true,
      releaseNotesUrl: manifest.upgrade.releaseNotesUrl,
    };
  }

  async connectionPackage() {
    const manifest = await this.manifest();
    const descriptor = {
      schemaVersion: "relay.connection-descriptor.v1",
      deploymentId: manifest.deploymentId,
      displayName: (await this.ensureDeployment()).displayName,
      ownershipType: manifest.ownershipType,
      apiOrigin: manifest.origins.api,
      websocketOrigin: manifest.origins.websocket,
      webOrigin: manifest.origins.web,
      manifestUrl: `${manifest.origins.backend}/api/v1/deployment/manifest`,
      issuedAt: new Date().toISOString(),
    };
    const signedDescriptor = this.sign(descriptor);
    const encoded = Buffer.from(JSON.stringify(signedDescriptor)).toString(
      "base64url",
    );
    return {
      descriptor: signedDescriptor,
      connectionPage: `${manifest.origins.web}/connect`,
      universalLink: `${manifest.origins.web}/connect?descriptor=${encodeURIComponent(encoded)}`,
      qrPayload: `clawchat://connect?descriptor=${encodeURIComponent(encoded)}`,
      swiftLink: `relayconsole://connect?descriptor=${encodeURIComponent(encoded)}`,
      authenticationRequired: true,
    };
  }

  async compatibility(
    clientKind: string,
    version: string,
    contractVersion: string,
    deploymentId?: string,
  ) {
    const deployment = await this.ensureDeployment();
    const expectedDeploymentId = deployment.id;
    if (
      deploymentId &&
      deploymentId !== expectedDeploymentId &&
      deploymentId !== deployment.deploymentKey
    ) {
      return {
        compatible: false,
        blockWrites: true,
        code: "DEPLOYMENT_ID_MISMATCH",
        expectedDeploymentId,
      };
    }
    if (contractVersion !== API_CONTRACT)
      return {
        compatible: false,
        blockWrites: true,
        code: "CONTRACT_VERSION_MISMATCH",
      };
    const result = evaluateRelayClientVersion(clientKind, version);
    return result.compatible ? { ...result, warning: null } : result;
  }

  async bootstrapOwner(input: {
    token: string;
    email: string;
    name: string;
    password: string;
  }) {
    if (!isBcryptCompatiblePassword(input.password)) {
      throw new BadRequestException("OWNER_BOOTSTRAP_INPUT_INVALID");
    }
    const configured = this.config
      .get<string>("CLAWCHAT_OWNER_BOOTSTRAP_TOKEN")
      ?.trim();
    if (!configured) throw new NotFoundException("OWNER_BOOTSTRAP_DISABLED");
    const expiresAt = new Date(
      this.config.get<string>("CLAWCHAT_OWNER_BOOTSTRAP_EXPIRES_AT") || 0,
    );
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())
      throw new UnauthorizedException("OWNER_BOOTSTRAP_EXPIRED");
    if (!this.equalSecret(configured, input.token))
      throw new UnauthorizedException("OWNER_BOOTSTRAP_INVALID");
    if (
      !/^\S+@\S+\.\S+$/.test(input.email) ||
      input.name.trim().length < 2 ||
      input.password.length < 12
    ) {
      throw new BadRequestException("OWNER_BOOTSTRAP_INPUT_INVALID");
    }
    const deploymentKey = this.deploymentKey();
    const tokenHash = this.hash(input.token);
    const result = await this.dataSource.transaction(async (manager) => {
      const bootstrapRepo = manager.getRepository(RelayOwnerBootstrapEntity);
      let bootstrap = await bootstrapRepo
        .createQueryBuilder("bootstrap")
        .addSelect("bootstrap.tokenHash")
        .where("bootstrap.deploymentKey = :deploymentKey", { deploymentKey })
        .setLock("pessimistic_write")
        .getOne();
      if (bootstrap?.redeemedAt)
        throw new ConflictException("OWNER_BOOTSTRAP_ALREADY_REDEEMED");
      const users = manager.getRepository(UserEntity);
      if (await users.exist())
        throw new ConflictException(
          "OWNER_BOOTSTRAP_REQUIRES_EMPTY_DEPLOYMENT",
        );
      if (!bootstrap)
        bootstrap = bootstrapRepo.create({
          deploymentKey,
          tokenHash,
          expiresAt,
          redeemedAt: null,
          redeemedByUserId: null,
        });
      if (!this.equalSecret(bootstrap.tokenHash, tokenHash))
        throw new UnauthorizedException("OWNER_BOOTSTRAP_INVALID");
      const user = await users.save(
        users.create({
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          passwordHash: await hashAccountPassword(input.password, 12),
        }),
      );
      const workspace = await manager.getRepository(WorkspaceEntity).save(
        manager.getRepository(WorkspaceEntity).create({
          name: `${user.name}'s Relay`,
          type: "personal",
          ownerId: user.id,
        }),
      );
      await manager.getRepository(WorkspaceMemberEntity).save(
        manager.getRepository(WorkspaceMemberEntity).create({
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceMemberRole.OWNER,
        }),
      );
      bootstrap.redeemedAt = new Date();
      bootstrap.redeemedByUserId = user.id;
      await bootstrapRepo.save(bootstrap);
      return { user, workspace };
    });
    await this.audit.record({
      actorType: "bootstrap",
      actorId: result.user.id,
      workspaceId: result.workspace.id,
      eventType: "deployment.owner_bootstrapped",
      resourceType: "deployment",
      resourceId: deploymentKey,
    });
    const auth = await this.auth.login({
      email: input.email,
      password: input.password,
    });
    return {
      user: auth.user,
      workspace: result.workspace,
      tokens: auth.tokens,
      bootstrapRevoked: true,
    };
  }

  async entitlements(userId: string, workspaceId: string) {
    await this.membership.ensureWorkspaceAccess(workspaceId, userId);
    const payload = await this.entitlementPayload(workspaceId);
    return this.sign(payload);
  }

  async entitlementPayload(workspaceId: string) {
    let subscription = await this.subscriptions.findOne({
      where: { workspaceId },
    });
    if (!subscription) {
      subscription = await this.ensureBetaAccessSubscription(workspaceId);
    }
    const status = subscription?.status || "subscription_required";
    const mode =
      subscription && isRelayCloudWritableEntitlement(subscription)
        ? "read_write"
        : "read_only";
    const managedCloudLaunchEnabled = isManagedCloudLaunchEnabled(this.config);
    const subscriptionFeatures = subscription?.features || {
      cloudControlPlane: true,
      customerRuntimeHosts: true,
      managedRuntime: false,
    };
    const subscriptionLimits = {
      ...this.defaultLimits(),
      ...(subscription?.limits || {}),
    };
    return {
      schemaVersion: "relay.entitlements.v1",
      workspaceId,
      plan: subscription?.plan || "relay_connect_monthly",
      status,
      mode,
      provider: subscription?.provider || null,
      currentPeriodEndsAt: subscription?.currentPeriodEndsAt || null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
      features: {
        ...subscriptionFeatures,
        managedRuntime:
          managedCloudLaunchEnabled &&
          subscriptionFeatures.managedRuntime === true,
        managedCloudLaunchEnabled,
      },
      limits: {
        ...subscriptionLimits,
        managedRuntimeMinutes: managedCloudLaunchEnabled
          ? subscriptionLimits.managedRuntimeMinutes
          : 0,
      },
      lifecycle: {
        trialEndsAt: subscription?.trialEndsAt || null,
        graceEndsAt: subscription?.graceEndsAt || null,
        readOnlyAt: subscription?.readOnlyAt || null,
        deletionEligibleAt: subscription?.deletionEligibleAt || null,
      },
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    };
  }

  private async ensureBetaAccessSubscription(workspaceId: string) {
    const workspace = await this.dataSource
      .getRepository(WorkspaceEntity)
      .findOne({ where: { id: workspaceId }, select: ["id", "ownerId"] });
    if (!workspace?.ownerId) return null;

    const owner = await this.dataSource.getRepository(UserEntity).findOne({
      where: { id: workspace.ownerId },
      select: ["id", "betaAccessEndsAt"],
    });
    const betaAccessEndsAt = owner?.betaAccessEndsAt;
    if (!betaAccessEndsAt || betaAccessEndsAt <= new Date()) return null;

    const record = this.subscriptions.create({
      workspaceId,
      plan: "relay_beta_60_day_full_access",
      status: "active",
      provider: "relay_beta",
      providerCustomerId: null,
      providerSubscriptionId: null,
      trialEndsAt: betaAccessEndsAt,
      graceEndsAt: null,
      readOnlyAt: betaAccessEndsAt,
      deletionEligibleAt: null,
      cancelledAt: null,
      currentPeriodEndsAt: betaAccessEndsAt,
      providerStateAt: new Date(),
      cancelAtPeriodEnd: false,
      features: {
        cloudControlPlane: true,
        customerRuntimeHosts: true,
        managedRuntime: true,
        betaFullAccess: true,
      },
      limits: {
        ...this.defaultLimits(),
        managedRuntimeMinutes: 10_000,
      },
    });

    try {
      const saved = await this.subscriptions.save(record);
      await this.audit.record({
        actorType: "system",
        actorId: owner.id,
        workspaceId,
        eventType: "billing.beta_access.granted",
        resourceType: "subscription",
        resourceId: saved.id,
        metadata: {
          plan: saved.plan,
          accessEndsAt: betaAccessEndsAt.toISOString(),
        },
      });
      return saved;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "23505"
      ) {
        return this.subscriptions.findOne({ where: { workspaceId } });
      }
      throw error;
    }
  }

  async supportBundle(userId: string, workspaceId: string) {
    await this.membership.ensureWorkspaceAdminAccess(workspaceId, userId);
    const deployment = await this.ensureDeployment();
    const [ready, backup, audits] = await Promise.all([
      this.health.ready(),
      this.backups.findOne({
        where: { deploymentKey: deployment.deploymentKey },
        order: { completedAt: "DESC" },
      }),
      this.dataSource.getRepository(AuditLogEntity).find({
        where: { workspaceId },
        order: { createdAt: "DESC" },
        take: 50,
        select: ["eventType", "createdAt", "resourceType"],
      }),
    ]);
    const bundle = {
      schemaVersion: "relay.support-bundle.v1",
      generatedAt: new Date().toISOString(),
      deploymentId: deployment.deploymentKey,
      productVersion:
        this.config.get<string>("RELAY_RELEASE_VERSION") || PRODUCT_VERSION,
      migrationVersion: await this.migrationVersion(),
      health: ready,
      environmentKeyNames: Object.keys(process.env)
        .filter((key) =>
          /^(CLAWCHAT_|RELAY_|RAILWAY_|DATABASE_|REDIS_|JWT_|APP_|ATTACHMENT_)/.test(
            key,
          ),
        )
        .sort(),
      recentEvents: audits.map((entry) => ({
        code: entry.eventType,
        resourceType: entry.resourceType,
        at: entry.createdAt,
      })),
      protocols: {
        api: API_CONTRACT,
        runtime: RUNTIME_CONTRACT,
        runtimeHost: RELAY_RUNTIME_CONNECTOR_CONTRACT,
        runtimeHostSupported: [...RELAY_RUNTIME_CONNECTOR_PROTOCOLS],
        marketplace: MARKETPLACE_CONTRACT,
        bridges: this.bridgeReleases(),
      },
      backup: backup
        ? {
            status: backup.status,
            completedAt: backup.completedAt,
            restoreTestedAt: backup.restoreTestedAt,
            encrypted: backup.encrypted,
          }
        : null,
      contentIncluded: false,
      secretValuesIncluded: false,
    };
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "support.bundle.exported",
      resourceType: "workspace",
      resourceId: workspaceId,
    });
    return bundle;
  }

  async createSupportGrant(
    userId: string,
    workspaceId: string,
    input: {
      supportPrincipalId: string;
      scopes: string[];
      reason?: string;
      expiresInMinutes: number;
    },
  ) {
    await this.membership.ensureWorkspaceAdminAccess(workspaceId, userId);
    if (
      !input.supportPrincipalId?.trim() ||
      !input.scopes?.length ||
      input.scopes.some((scope) => !SUPPORT_SCOPES.has(scope))
    )
      throw new BadRequestException("SUPPORT_GRANT_INVALID");
    if (input.expiresInMinutes < 5 || input.expiresInMinutes > 1440)
      throw new BadRequestException("SUPPORT_GRANT_EXPIRY_INVALID");
    const grant = await this.supportGrants.save(
      this.supportGrants.create({
        workspaceId,
        grantedByUserId: userId,
        supportPrincipalId: input.supportPrincipalId,
        scopes: input.scopes,
        reason: input.reason || null,
        expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000),
        revokedAt: null,
      }),
    );
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "support.access.granted",
      resourceType: "support_access_grant",
      resourceId: grant.id,
      metadata: { scopes: input.scopes, expiresAt: grant.expiresAt },
    });
    return grant;
  }

  async revokeSupportGrant(
    userId: string,
    workspaceId: string,
    grantId: string,
  ) {
    await this.membership.ensureWorkspaceAdminAccess(workspaceId, userId);
    const grant = await this.supportGrants.findOne({
      where: { id: grantId, workspaceId },
    });
    if (!grant) throw new NotFoundException("SUPPORT_GRANT_NOT_FOUND");
    grant.revokedAt = grant.revokedAt || new Date();
    await this.supportGrants.save(grant);
    await this.audit.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "support.access.revoked",
      resourceType: "support_access_grant",
      resourceId: grant.id,
    });
    return grant;
  }

  async upsertProvisioningJob(input: JsonObject) {
    const idempotencyKey = this.requiredText(
      input.idempotencyKey,
      "IDEMPOTENCY_KEY_REQUIRED",
    );
    let job = await this.provisioningJobs.findOne({
      where: { idempotencyKey },
    });
    if (!job)
      job = this.provisioningJobs.create({
        idempotencyKey,
        ownershipType: this.requiredText(
          input.ownershipType,
          "OWNERSHIP_TYPE_REQUIRED",
        ),
      });
    Object.assign(
      job,
      this.pick(input, [
        "state",
        "deploymentKey",
        "railwayProjectId",
        "serviceIds",
        "safeErrorCode",
        "metadata",
        "completedAt",
        "cancelledAt",
      ]),
    );
    const saved = await this.provisioningJobs.save(job);
    await this.audit.record({
      actorType: "operator",
      eventType: "deployment.provisioning.updated",
      resourceType: "provisioning_job",
      resourceId: saved.id,
      metadata: { state: saved.state, idempotencyKey },
    });
    return saved;
  }

  async upsertOperatorDeployment(input: JsonObject) {
    const deploymentKey = this.requiredText(
      input.deploymentKey,
      "DEPLOYMENT_KEY_REQUIRED",
    );
    let record = await this.operatorDeployments.findOne({
      where: { deploymentKey },
    });
    if (!record)
      record = this.operatorDeployments.create({
        deploymentKey,
        ownershipType: this.requiredText(
          input.ownershipType,
          "OWNERSHIP_TYPE_REQUIRED",
        ),
      });
    Object.assign(
      record,
      this.pick(input, [
        "ownershipType",
        "customerReference",
        "railwayProjectId",
        "railwayEnvironmentId",
        "backendOrigin",
        "webOrigin",
        "status",
        "releaseVersion",
        "migrationVersion",
        "lastHealthyAt",
        "capacity",
        "metadata",
      ]),
    );
    return this.operatorDeployments.save(record);
  }

  async upsertSubscription(input: JsonObject) {
    const workspaceId = this.requiredText(
      input.workspaceId,
      "WORKSPACE_ID_REQUIRED",
    );
    let record = await this.subscriptions.findOne({ where: { workspaceId } });
    if (!record) record = this.subscriptions.create({ workspaceId });
    Object.assign(
      record,
      this.pick(input, [
        "plan",
        "status",
        "provider",
        "providerCustomerId",
        "providerSubscriptionId",
        "limits",
        "features",
        "trialEndsAt",
        "graceEndsAt",
        "readOnlyAt",
        "deletionEligibleAt",
        "cancelledAt",
        "currentPeriodEndsAt",
        "cancelAtPeriodEnd",
      ]),
    );
    const saved = await this.subscriptions.save(record);
    await this.audit.record({
      actorType: "operator",
      workspaceId,
      eventType: "billing.subscription.updated",
      resourceType: "subscription",
      resourceId: saved.id,
      metadata: { plan: saved.plan, status: saved.status },
    });
    return this.entitlementPayload(workspaceId);
  }

  async grantComplimentaryLifetimeAccess(input: JsonObject) {
    const workspaceId = this.requiredText(
      input.workspaceId,
      "WORKSPACE_ID_REQUIRED",
    );
    const reason = this.requiredText(
      input.reason,
      "COMPLIMENTARY_GRANT_REASON_REQUIRED",
    );
    const workspace = await this.dataSource
      .getRepository(WorkspaceEntity)
      .findOne({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException("WORKSPACE_NOT_FOUND");
    let record = await this.subscriptions.findOne({ where: { workspaceId } });
    if (!record) record = this.subscriptions.create({ workspaceId });
    Object.assign(record, {
      plan: "relay_cloud_complimentary_lifetime",
      status: "active",
      provider: "relay_complimentary",
      providerCustomerId: null,
      providerSubscriptionId: null,
      trialEndsAt: null,
      graceEndsAt: null,
      readOnlyAt: null,
      deletionEligibleAt: null,
      cancelledAt: null,
      currentPeriodEndsAt: null,
      providerStateAt: new Date(),
      cancelAtPeriodEnd: false,
      features: {
        cloudControlPlane: true,
        customerRuntimeHosts: true,
        managedRuntime: false,
        complimentaryLifetime: true,
      },
      limits: {
        ...this.defaultLimits(),
        ...((input.limits as JsonObject) || {}),
      },
    });
    const saved = await this.subscriptions.save(record);
    await this.audit.record({
      actorType: "operator",
      workspaceId,
      eventType: "billing.complimentary_lifetime.granted",
      resourceType: "subscription",
      resourceId: saved.id,
      metadata: { plan: saved.plan, reason },
    });
    return this.entitlementPayload(workspaceId);
  }

  async revokeComplimentaryLifetimeAccess(
    workspaceId: string,
    input: JsonObject,
  ) {
    const reason = this.requiredText(
      input.reason,
      "COMPLIMENTARY_REVOCATION_REASON_REQUIRED",
    );
    const record = await this.subscriptions.findOne({ where: { workspaceId } });
    if (
      !record ||
      record.provider !== "relay_complimentary" ||
      record.plan !== "relay_cloud_complimentary_lifetime"
    ) {
      throw new NotFoundException("COMPLIMENTARY_LIFETIME_GRANT_NOT_FOUND");
    }
    const now = new Date();
    Object.assign(record, {
      status: "cancelled",
      cancelledAt: now,
      readOnlyAt: now,
      providerStateAt: now,
      cancelAtPeriodEnd: false,
    });
    const saved = await this.subscriptions.save(record);
    await this.audit.record({
      actorType: "operator",
      workspaceId,
      eventType: "billing.complimentary_lifetime.revoked",
      resourceType: "subscription",
      resourceId: saved.id,
      metadata: { reason },
    });
    return this.entitlementPayload(workspaceId);
  }

  async recordBackup(input: JsonObject) {
    const record = await this.backups.save(
      this.backups.create({
        deploymentKey: this.requiredText(
          input.deploymentKey,
          "DEPLOYMENT_KEY_REQUIRED",
        ),
        workspaceId: (input.workspaceId as string) || null,
        provider: this.requiredText(input.provider, "BACKUP_PROVIDER_REQUIRED"),
        backupReference: this.requiredText(
          input.backupReference,
          "BACKUP_REFERENCE_REQUIRED",
        ),
        status: (input.status as string) || "pending",
        encrypted: input.encrypted !== false,
        databaseMigration: (input.databaseMigration as string) || null,
        sizeBytes: input.sizeBytes == null ? null : String(input.sizeBytes),
        completedAt: input.completedAt
          ? new Date(String(input.completedAt))
          : null,
        restoreTestedAt: input.restoreTestedAt
          ? new Date(String(input.restoreTestedAt))
          : null,
        metadata: (input.metadata as JsonObject) || {},
      }),
    );
    await this.audit.record({
      actorType: "operator",
      eventType: record.restoreTestedAt
        ? "backup.restore_tested"
        : "backup.recorded",
      resourceType: "backup",
      resourceId: record.id,
      metadata: { deploymentKey: record.deploymentKey, status: record.status },
    });
    return record;
  }

  async upsertIncident(input: JsonObject) {
    const deploymentKey = this.deploymentKey();
    if (
      input.deploymentKey !== undefined &&
      this.requiredText(input.deploymentKey, "DEPLOYMENT_KEY_REQUIRED") !==
        deploymentKey
    ) {
      throw new BadRequestException("INCIDENT_DEPLOYMENT_INVALID");
    }
    const id = typeof input.id === "string" ? input.id : undefined;
    let incident = id ? await this.incidents.findOne({ where: { id } }) : null;
    if (id && (!incident || incident.deploymentKey !== deploymentKey)) {
      throw new NotFoundException("INCIDENT_NOT_FOUND");
    }
    const severity = this.incidentEnum(
      input.severity ?? incident?.severity,
      new Set(["minor", "major", "critical"]),
      "INCIDENT_SEVERITY_INVALID",
    );
    const status = this.incidentEnum(
      input.status ?? incident?.status,
      new Set(["investigating", "identified", "monitoring", "resolved"]),
      "INCIDENT_STATUS_INVALID",
    );
    const publicSummary = this.publicIncidentSummary(
      input.publicSummary ?? incident?.publicSummary,
    );
    const startedAt =
      incident?.startedAt ||
      this.incidentDate(
        input.startedAt,
        new Date(),
        "INCIDENT_STARTED_AT_INVALID",
      );
    const resolvedAt =
      status === "resolved"
        ? this.incidentDate(
            input.resolvedAt,
            new Date(),
            "INCIDENT_RESOLVED_AT_INVALID",
          )
        : null;
    const metadata =
      input.metadata === undefined
        ? incident?.metadata || {}
        : this.safeIncidentMetadata(input.metadata);
    if (!incident) {
      incident = this.incidents.create({
        deploymentKey,
        severity,
        status,
        publicSummary,
        startedAt,
        resolvedAt,
        metadata,
      });
    } else {
      Object.assign(incident, {
        severity,
        status,
        publicSummary,
        resolvedAt,
        metadata,
      });
    }
    const saved = await this.incidents.save(incident);
    await this.audit.record({
      actorType: "operator",
      eventType:
        status === "resolved"
          ? "service.incident.resolved"
          : "service.incident.updated",
      resourceType: "service_incident",
      resourceId: saved.id,
      metadata: { deploymentKey, severity, status },
    });
    return saved;
  }

  async operatorOverview() {
    const [deployments, jobs, backups, incidents, activeSupportGrants] =
      await Promise.all([
        this.operatorDeployments.find({
          order: { updatedAt: "DESC" },
          take: 200,
        }),
        this.provisioningJobs.find({ order: { updatedAt: "DESC" }, take: 200 }),
        this.backups.find({ order: { createdAt: "DESC" }, take: 200 }),
        this.incidents.find({ order: { startedAt: "DESC" }, take: 200 }),
        this.supportGrants.count({
          where: { revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
        }),
      ]);
    return {
      deployments,
      provisioningJobs: jobs,
      backups,
      incidents,
      activeSupportGrants,
      customerContentIncluded: false,
    };
  }

  private async ensureDeployment() {
    const deploymentKey = this.deploymentKey();
    let deployment = await this.deployments.findOne({
      where: { deploymentKey },
    });
    const capabilities = {
      ...(deployment?.capabilities || {}),
      workspaceSync: true,
      initialImport: true,
      changeFeed: true,
      tombstones: true,
      attachments: true,
      swiftRuntimeDevice: true,
      headlessRuntimeDevices: true,
      executionOwnerLeases: true,
      signedConnectionDescriptors: true,
      serverEntitlements: true,
      marketplaceExecutionAuthorities: ["swift", "railway"],
      supportedRuntimes: ["hermes", "openclaw"],
      supportedObjectTypes: RELAY_SYNC_OBJECT_TYPES,
    };
    if (!deployment)
      deployment = await this.deployments.save(
        this.deployments.create({
          deploymentKey,
          displayName:
            this.config.get<string>("CLAWCHAT_DEPLOYMENT_NAME") ||
            "Relay",
          apiVersion: API_CONTRACT,
          syncContractVersion: RELAY_SYNC_CONTRACT_VERSION,
          runtimeContractVersion: RUNTIME_CONTRACT,
          marketplaceContractVersion: MARKETPLACE_CONTRACT,
          ownershipType:
            this.config.get<string>("CLAWCHAT_DEPLOYMENT_OWNERSHIP") ||
            "relay_managed",
          capabilities,
        }),
      );
    else if (
      deployment.apiVersion !== API_CONTRACT ||
      deployment.syncContractVersion !== RELAY_SYNC_CONTRACT_VERSION ||
      deployment.runtimeContractVersion !== RUNTIME_CONTRACT ||
      deployment.marketplaceContractVersion !== MARKETPLACE_CONTRACT ||
      JSON.stringify(deployment.capabilities) !== JSON.stringify(capabilities)
    ) {
      Object.assign(deployment, {
        apiVersion: API_CONTRACT,
        syncContractVersion: RELAY_SYNC_CONTRACT_VERSION,
        runtimeContractVersion: RUNTIME_CONTRACT,
        marketplaceContractVersion: MARKETPLACE_CONTRACT,
        capabilities,
      });
      deployment = await this.deployments.save(deployment);
    }
    return deployment;
  }

  private ownershipType(deployment?: RelayDeploymentEntity) {
    void deployment;
    return "relay_managed";
  }
  private deploymentKey() {
    return (
      this.config.get<string>("CLAWCHAT_DEPLOYMENT_ID")?.trim() ||
      "relay-railway-production"
    );
  }
  private origins() {
    const backend = this.secureOrigin(
      this.config.get<string>("RELAY_PUBLIC_BACKEND_ORIGIN") ||
        (this.config.get<string>("RAILWAY_PUBLIC_DOMAIN")
          ? `https://${this.config.get<string>("RAILWAY_PUBLIC_DOMAIN")}`
          : "https://api.relayconsole.work"),
      "https:",
    );
    const websocket = this.secureOrigin(
      this.config.get<string>("RELAY_PUBLIC_WEBSOCKET_ORIGIN") ||
        backend.replace(/^https:/, "wss:"),
      "wss:",
    );
    const web = this.secureOrigin(
      this.config.get<string>("RELAY_PUBLIC_WEB_ORIGIN") ||
        "https://relayconsole.work",
      "https:",
    );
    return { backend, api: `${backend}/api/v1`, websocket, web };
  }
  private secureOrigin(value: string, protocol: "https:" | "wss:") {
    const url = new URL(value);
    if (
      url.protocol !== protocol ||
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname) ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("PUBLIC_ORIGIN_INVALID");
    return url.origin;
  }
  private marketplaceModes() {
    return [
      "user_token",
      "customer_oauth",
      "relay_oauth_broker",
      "organization_service",
      "device_local",
    ];
  }
  private bridgeReleases() {
    return [
      {
        repository: BRIDGE_COMPATIBILITY_MANIFEST.repository,
        releaseCandidate: BRIDGE_COMPATIBILITY_MANIFEST.release,
        hermes: BRIDGE_COMPATIBILITY_MANIFEST.plugins.hermes.version,
        openclaw: BRIDGE_COMPATIBILITY_MANIFEST.plugins.openclaw.version,
        supportedPluginVersions: {
          hermes:
            BRIDGE_COMPATIBILITY_MANIFEST.plugins.hermes
              .supportedPluginVersions,
          openclaw:
            BRIDGE_COMPATIBILITY_MANIFEST.plugins.openclaw
              .supportedPluginVersions,
        },
        hermesHarness:
          BRIDGE_COMPATIBILITY_MANIFEST.plugins.hermes.runtimeVersion,
        openclawHarness:
          BRIDGE_COMPATIBILITY_MANIFEST.plugins.openclaw.runtimeVersion,
        apiContract: BRIDGE_COMPATIBILITY_MANIFEST.apiContract,
        websocketContract: BRIDGE_COMPATIBILITY_MANIFEST.websocketContract,
        runtimeConnectorContract:
          BRIDGE_COMPATIBILITY_MANIFEST.runtimeConnectorContract,
        runtimeConnectorProtocols:
          BRIDGE_COMPATIBILITY_MANIFEST.supportedRuntimeConnectorProtocols,
        status: BRIDGE_COMPATIBILITY_MANIFEST.releaseStatus,
        knownGap: BRIDGE_COMPATIBILITY_MANIFEST.knownGaps[0] ?? null,
      },
    ];
  }
  private minimumClients() {
    return { ...RELAY_MINIMUM_CLIENTS };
  }
  private defaultLimits() {
    return {
      seats: 1,
      storageBytes: 1_073_741_824,
      attachmentBytes: 52_428_800,
      runtimeDevices: 5,
      websocketConnections: 10,
      dispatchesPerMinute: 60,
      managedRuntimeMinutes: 0,
    };
  }
  private sign(payload: JsonObject) {
    const privateKey = this.config
      .get<string>("CONNECTION_DESCRIPTOR_PRIVATE_KEY")
      ?.trim();
    if (!privateKey)
      throw new Error("CONNECTION_DESCRIPTOR_PRIVATE_KEY_REQUIRED");
    const signature = signBytes(
      null,
      Buffer.from(this.canonical(payload)),
      createPrivateKey({
        key: Buffer.from(privateKey, "base64"),
        format: "der",
        type: "pkcs8",
      }),
    ).toString("base64url");
    return {
      payload,
      signature,
      algorithm: SIGNATURE_ALGORITHM,
      keyId:
        this.config.get<string>("CONNECTION_DESCRIPTOR_KEY_ID") ||
        "deployment-v1",
    };
  }
  private canonical(value: unknown): string {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (Array.isArray(value))
      return `[${value.map((item) => this.canonical(item)).join(",")}]`;
    if (value && typeof value === "object")
      return `{${Object.entries(value as JsonObject)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.canonical(item)}`)
        .join(",")}}`;
    return JSON.stringify(value);
  }
  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
  private equalSecret(left: string, right: string) {
    const a = createHash("sha256").update(left).digest();
    const b = createHash("sha256").update(right).digest();
    return timingSafeEqual(a, b);
  }
  private async migrationVersion() {
    try {
      const rows = await this.dataSource.query(
        `SELECT name FROM migrations ORDER BY id DESC LIMIT 1`,
      );
      return rows[0]?.name || "unknown";
    } catch {
      return "unknown";
    }
  }
  private requiredText(value: unknown, code: string) {
    if (typeof value !== "string" || !value.trim())
      throw new BadRequestException(code);
    return value.trim();
  }
  private pick(input: JsonObject, keys: string[]) {
    return Object.fromEntries(
      keys
        .filter((key) => input[key] !== undefined)
        .map((key) => [
          key,
          /At$/.test(key) && input[key]
            ? new Date(String(input[key]))
            : input[key],
        ]),
    );
  }
  private incidentEnum(
    value: unknown,
    allowed: ReadonlySet<string>,
    code: string,
  ) {
    const normalized = this.requiredText(value, code).toLowerCase();
    if (!allowed.has(normalized)) throw new BadRequestException(code);
    return normalized;
  }
  private publicIncidentSummary(value: unknown) {
    const summary = this.requiredText(value, "INCIDENT_SUMMARY_REQUIRED")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (summary.length < 10 || summary.length > 500)
      throw new BadRequestException("INCIDENT_SUMMARY_LENGTH_INVALID");
    if (
      /(?:bearer\s+[a-z0-9._~+\/-]{12,}|sk_(?:live|test)_[a-z0-9]+|(?:password|secret|token)\s*[:=])/i.test(
        summary,
      )
    ) {
      throw new BadRequestException("INCIDENT_SUMMARY_SECRET_LIKE");
    }
    return summary;
  }
  private incidentDate(value: unknown, fallback: Date, code: string) {
    if (value === undefined || value === null || value === "") return fallback;
    const date = new Date(String(value));
    if (!Number.isFinite(date.getTime())) throw new BadRequestException(code);
    return date;
  }
  private safeIncidentMetadata(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new BadRequestException("INCIDENT_METADATA_INVALID");
    const input = value as JsonObject;
    const allowed = new Set([
      "ownerReference",
      "backendVersion",
      "webVersion",
      "bridgeRelease",
      "migrationVersion",
      "nextUpdateAt",
    ]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new BadRequestException("INCIDENT_METADATA_INVALID");
    const output: JsonObject = {};
    for (const key of [
      "ownerReference",
      "backendVersion",
      "webVersion",
      "bridgeRelease",
      "migrationVersion",
    ]) {
      if (input[key] === undefined) continue;
      const text = String(input[key]).trim();
      if (!/^[A-Za-z0-9._:+-]{1,100}$/.test(text))
        throw new BadRequestException("INCIDENT_METADATA_INVALID");
      output[key] = text;
    }
    if (input.nextUpdateAt !== undefined) {
      output.nextUpdateAt = this.incidentDate(
        input.nextUpdateAt,
        new Date(),
        "INCIDENT_METADATA_INVALID",
      ).toISOString();
    }
    return output;
  }
}
