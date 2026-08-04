import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "crypto";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OpenClawConnectionEntity } from "../../entities/openclaw-connection.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { MessageEntity } from "../../entities/message.entity";
import { TaskEntity } from "../../entities/task.entity";
import { RunEntity } from "../../entities/run.entity";
import { RunEventEntity } from "../../entities/run-event.entity";
import { WorkLogEntity } from "../../entities/work-log.entity";
import { ThreadEntity } from "../../entities/thread.entity";
import { MessageProvenance } from "../../entities/message.entity";
import { EventsGateway } from "../../gateways/events.gateway";
import { BridgeControlBusService } from "../../gateways/bridge-control-bus.service";
import { MessageService } from "../message/message.service";
import {
  MESSAGE_CONTENT_FORMAT_MARKDOWN,
  buildRuntimeResponsePresentationContext,
  prepareAgentReplyForStorage,
} from "../message/response-presentation";
import { signOpenClawAttachmentProvenance } from "../message/message-attachment-provenance";
import { ThreadMembershipService } from "../thread/thread-membership.service";
import { BridgeControlCoordinatorService } from "../../gateways/bridge-control-coordinator.service";
import {
  AgentProvisioningJobEntity,
  ApprovalEntity,
  BridgeDeviceEntity,
  BridgeDeviceStatus,
  BridgeEnrollmentEntity,
  BridgeEnrollmentStatus,
  WorkspaceEntity,
} from "../../entities";
import { EncryptionService } from "../security/encryption.service";
import {
  AuditLogRequestContext,
  AuditLogService,
} from "../audit-log/audit-log.service";
import { RuntimeBindingService } from "../runtime/runtime-binding.service";
import { RuntimeDispatchCoordinator } from "../runtime/runtime-dispatch-coordinator.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { type LocalAppRuntimeProfile } from "../marketplace/local-app-runtime-profile";
import { normalizeServerAuthorizedBridgeCapabilities } from "./bridge-capabilities";
import {
  BRIDGE_API_CONTRACT,
  BRIDGE_WEBSOCKET_CONTRACT,
  evaluateBridgeCompatibility,
} from "./bridge-compatibility-policy";
import { BRIDGE_ROTATING_CREDENTIAL_CAPABILITY } from "./bridge-token-policy";
import { BridgeDeviceCredentials } from "./bridge-device-credentials";

const OPENCLAW_RUNTIME_TYPE = "openclaw";
const OPENCLAW_ADAPTER_KIND = "bridge_ws";
const HERMES_RUNTIME_TYPE = "hermes";
const HERMES_ADAPTER_KIND = "hermes_bridge";
const HERMES_RUNTIME_CAPABILITY = "clawchat.runtime.hermes";
const HERMES_BROWSER_TOOLS = [
  "browser_navigate",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_vision",
] as const;
const DEFAULT_RUNTIME_TIMEOUT_MS = 20 * 60 * 1000;
const ATTACHMENT_CAPABILITY =
  EventsGateway.CLAWCHAT_ATTACHMENT_BRIDGE_CAPABILITY;
const MAX_ATTACHMENT_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const ATTACHMENT_CHUNK_SIZE_BYTES = 1024 * 1024;
const ATTACHMENT_UPLOAD_INIT_TIMEOUT_MS = 15_000;
const ATTACHMENT_UPLOAD_CHUNK_TIMEOUT_MS = 30_000;
const ATTACHMENT_UPLOAD_COMPLETE_TIMEOUT_MS = 30_000;
const BRIDGE_UPGRADE_REQUIRED_STATUS = 426;

const ATTACHMENT_KIND_VALUES = new Set([
  "image",
  "audio",
  "video",
  "document",
  "file",
]);

const ALLOWED_ATTACHMENT_MIME_PREFIXES = [
  "image/",
  "audio/",
  "video/",
  "text/",
];
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/octet-stream",
]);

export interface BridgeAgentPayload {
  externalId: string;
  name: string;
  role: string;
  status: string;
  capabilities: string[];
  workspaceId: string;
  description?: string;
  metadata?: Record<string, any>;
  source?: string;
}

export interface BridgeDeviceAuthContext {
  deviceId: string;
  devicePublicId: string;
  workspaceId: string;
  runtimeType: string;
}

export interface BridgeDeviceMetadata {
  pluginVersion?: string;
  openCoreVersion?: string;
  runtimeType?: string;
  hostType?: string;
  apiContractVersion?: string;
  websocketContractVersion?: string;
  capabilities?: string[];
}

export interface BridgeRuntimeModelCatalogPayload {
  runtimeType: string;
  defaultModel: string;
  models: string[];
  source: string;
  observedAt?: string;
}

export type OpenClawAttachmentMetadata = {
  id: string;
  workspaceId: string;
  threadId: string;
  messageId?: string | null;
  bridgeDeviceId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
  kind: "image" | "audio" | "video" | "document" | "file";
  status: "uploaded" | "attached" | "missing" | "unavailable" | "failed";
  storage: "openclaw_local";
  localMediaRef: string;
  provenanceToken?: string;
  createdAt: string;
};

export type PublicOpenClawIntegrationStatusCode =
  | "not_configured"
  | "connected"
  | "needs_attention"
  | "offline";

export interface PublicOpenClawIntegrationStatus {
  provider: "openclaw";
  status: PublicOpenClawIntegrationStatusCode;
  title: string;
  description: string;
  isConfigured: boolean;
  isOnline: boolean;
  hasLiveAgents: boolean;
  isChatRoutable: boolean;
  needsAttention: boolean;
  connectionCount: number;
  pairedDeviceCount: number;
  onlineDeviceCount: number;
  liveBridgeControlCount: number;
  mappedAgentCount: number;
  liveAgentCount: number;
}

export interface BridgeTaskPayload {
  externalId: string;
  title: string;
  description?: string;
  status: string;
  externalAgentId: string;
  workspaceId: string;
  startedAt?: string;
  completedAt?: string;
  tokensUsed?: number;
  cost?: number;
  error?: string;
}

export interface OpenClawOperationResult {
  ok: boolean;
  operation: string;
  status: number;
  endpoint: string;
  data: unknown;
}

export interface LocalAppConnectorAgentApiCallResult {
  ok: boolean;
  status: number;
  endpoint: string;
  data: unknown;
}

export interface BridgeLibraryFilePayload {
  filename: string;
  content: string;
  contentEncoding?: "utf8" | "base64";
  contentType?: string;
}

export interface BridgeLibraryFolderEntry {
  name: string;
  path: string;
}

export interface BridgeLibraryFileEntry {
  filename: string;
  path: string;
  size: number;
  updatedAt?: string | null;
}

export interface BridgeLibraryListPayload {
  requestId: string;
  folder: string;
  folders: BridgeLibraryFolderEntry[];
  files: BridgeLibraryFileEntry[];
}

export interface BridgeLibraryReadPayload {
  requestId: string;
  folder: string;
  filename: string;
  content: string;
  size: number;
  updatedAt?: string | null;
}

export interface BridgeLibraryWritePayload {
  requestId: string;
  folder: string;
  written: string[];
  createdFolder?: boolean;
}

export interface BridgeLibraryDeletePayload {
  requestId: string;
  folder: string;
  filename: string;
  deleted: boolean;
}

export interface BridgeAgentWorkspaceListPayload {
  requestId: string;
  agentId: string;
  workspace?: string;
  folder: string;
  folders: BridgeLibraryFolderEntry[];
  files: BridgeLibraryFileEntry[];
}

export interface BridgeAgentWorkspaceReadPayload {
  requestId: string;
  agentId: string;
  workspace?: string;
  folder: string;
  filename: string;
  content: string;
  size: number;
  updatedAt?: string | null;
}

export interface BridgeAgentWorkspaceWritePayload {
  requestId: string;
  agentId: string;
  workspace?: string;
  folder: string;
  written: string[];
  createdFolder?: boolean;
}

export interface BridgeAgentWorkspaceDeletePayload {
  requestId: string;
  agentId: string;
  workspace?: string;
  folder: string;
  filename: string;
  deleted: boolean;
}

export interface BridgeLibraryDeleteFolderPayload {
  requestId: string;
  folder: string;
  deleted: boolean;
}

export interface BridgeAgentWorkspaceDeleteFolderPayload {
  requestId: string;
  agentId: string;
  workspace?: string;
  folder: string;
  deleted: boolean;
}

export type HermesWorkspaceFolder = "agent" | "shared" | "sessions" | "project";

export interface HermesWorkspaceEntryPayload {
  name: string;
  type: "file" | "folder";
  size?: number;
  mtime?: string | null;
}

export interface HermesWorkspaceResultPayload {
  requestId: string;
  ok: boolean;
  folder?: HermesWorkspaceFolder;
  path?: string;
  entries?: HermesWorkspaceEntryPayload[];
  filename?: string | null;
  content?: string;
  encoding?: "utf8" | "base64";
  size?: number;
  mtime?: string | null;
  error?: {
    code?: string;
    message?: string;
  };
}

export const MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY =
  "marketplaceHermesSkillInstall";
export const MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY =
  "marketplaceLocalRepoDocsRead";
export const MARKETPLACE_LOCAL_REPO_DOCS_WRITE_CAPABILITY =
  "marketplaceLocalRepoDocsWrite";
export const MARKETPLACE_LOCAL_APP_AGENT_API_SETUP_CAPABILITY =
  "marketplaceLocalAppAgentApiSetup";
export const MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY =
  "clawchat.marketplace.tools";

export interface MarketplaceLocalCliRequestPayload extends Record<
  string,
  unknown
> {
  type: "marketplace.localCliRequest";
  requestId: string;
  workspaceId: string;
  appSlug: string;
  sourceHostId: string;
  sourceHostType: "hermes_bridge" | "openclaw_bridge" | "runtime_host";
  executable: "obsidian" | "roam" | "logseq" | "wp";
  argv: string[];
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface MarketplaceLocalCliResponsePayload {
  requestId: string;
  status: "ok" | "failed";
  exitCode?: number | null;
  stdout?: string | null;
  stderr?: string | null;
  errorCode?: string | null;
  error?: string | null;
}
export const LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY = "localAppRuntimeRecovery";

export interface MarketplaceHermesSkillInstallRequestPayload {
  type: "marketplace.installHermesSkill";
  requestId: string;
  workspaceId: string;
  agentId: string;
  appSlug: string;
  marketplaceInstallId?: string | null;
  runtimeFormat: "hermes";
  skillName: string;
  targetRoot: string;
  approvalProfileId: string;
  selectedCapabilities: string[];
  connection: {
    id: string | null;
    displayName: string | null;
    environment: string | null;
    authType: string | null;
  };
  files: Array<{
    relativePath: string;
    content: string;
    sha256: string;
  }>;
  policy: {
    overwrite: "managed_files_only";
    removeStaleManagedFiles: boolean;
  };
  metadata: {
    generatedBy: "clawchat-marketplace";
    packVersion: string;
    canonicalPackSlug: string;
    generatedAt: string;
    autonomyPolicy?: Record<string, unknown>;
  };
}

export interface MarketplaceHermesSkillInstallResponsePayload {
  requestId: string;
  status: "installed" | "rejected" | "failed";
  agentId: string;
  appSlug: string;
  installedFiles: string[];
  skippedFiles?: string[];
  bridgeCapabilities?: string[];
  error?: {
    code: string;
    message: string;
  };
}

export interface MarketplaceReadLocalRepoDocsRequestPayload {
  type: "marketplace.readLocalRepoDocs";
  requestId: string;
  workspaceId: string;
  sourceHostId?: string | null;
  bridgeDeviceId?: string | null;
  sourceHostType?: string | null;
  runtimeType?: string | null;
  repoPath: string;
  docsSourcePath: string;
  includeGlobs: string[];
}

export interface MarketplaceReadLocalRepoDocsResponsePayload {
  requestId: string;
  status: "ok" | "not_found" | "failed";
  repoPath: string;
  docsSourcePath: string;
  files: Array<{
    relativePath: string;
    content: string;
    sha256: string;
    sizeBytes: number;
  }>;
  missingFiles: string[];
  errors: string[];
  gitCommit?: string | null;
  gitBranch?: string | null;
  dirtyState?: boolean | null;
  dirtyFiles?: string[] | null;
}

export interface MarketplaceApplyLocalRepoDocsRequestPayload {
  type: "marketplace.applyLocalRepoDocs";
  requestId: string;
  workspaceId: string;
  sourceHostId?: string | null;
  bridgeDeviceId?: string | null;
  sourceHostType?: string | null;
  runtimeType?: string | null;
  repoPath: string;
  docsSourcePath: string;
  files: Array<{
    relativePath: string;
    path?: string;
    docsRelativePath?: string;
    expectedPreviousHash: string | null;
    expectedPreviousSha256?: string | null;
    updatedContent: string;
    content?: string;
    updatedHash: string;
    sha256?: string;
    updatedSha256?: string;
  }>;
}

export interface MarketplaceApplyLocalRepoDocsResponsePayload {
  requestId: string;
  status: "ok" | "applied" | "conflict" | "failed";
  repoPath: string;
  writtenFiles: string[];
  conflicts: Array<{
    path: string | null;
    message: string;
  }>;
  errors: string[];
  gitCommit?: string | null;
  gitBranch?: string | null;
  dirtyState?: boolean | null;
  dirtyFiles?: string[] | null;
}

export interface MarketplaceLocalAppCampaignPayload {
  id: string;
  name: string;
  slug?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MarketplaceLocalAppAgentApiSetupRequestPayload {
  type: "marketplace.localAppAgentApiSetup";
  requestId: string;
  workspaceId: string;
  appSlug: string;
  appName?: string | null;
  sourceHostId?: string | null;
  bridgeDeviceId?: string | null;
  sourceHostType?: string | null;
  runtimeType?: string | null;
  localAppUrl?: string | null;
  localApiUrl?: string | null;
  agentApiBaseUrl?: string | null;
  legacyRouteNamespace: "/api/openclaw";
  desiredCampaignId?: string | null;
  desiredCampaignName?: string | null;
  autonomyPolicy?: Record<string, unknown>;
}

export interface MarketplaceLocalAppAgentApiSetupResponsePayload {
  requestId: string;
  status: "ok" | "selection_required" | "failed";
  sourceHostReachable?: boolean;
  localAppReachable?: boolean;
  agentApiRouteReachable?: boolean;
  agentApiKeyConfigured?: boolean;
  bearerKey?: string | null;
  bearerReturnedToClawChat?: boolean;
  agentApiBaseUrl?: string | null;
  settingsStatus?: number | null;
  authenticatedSettingsStatus?: number | null;
  campaigns?: MarketplaceLocalAppCampaignPayload[];
  selectedCampaign?: MarketplaceLocalAppCampaignPayload | null;
  policySync?: Record<string, unknown> | null;
  errors?: string[];
  diagnostics?: Record<string, unknown>;
}

export interface MarketplaceLocalAppAgentApiRequestPayload {
  type: "marketplace.localAppAgentApiRequest";
  requestId: string;
  workspaceId: string;
  appSlug: string;
  linkedAppId?: string | null;
  sourceHostId?: string | null;
  bridgeDeviceId?: string | null;
  sourceHostType?: string | null;
  baseUrl: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  credential: {
    type: "bearer";
    authorizationHeader: string;
    tokenExposure: "bridge_only";
  };
  bridgeOnlyCredential?: {
    type: "bearer";
    authorizationHeader: string;
    tokenExposure: "bridge_only";
  };
  bridgeOnlyBearerCredential?: {
    authorizationHeader: string;
    tokenExposure: "bridge_only";
  };
  contractVersion: string;
  timeoutMs: number;
  runtimeProfile?: LocalAppRuntimeProfile | null;
  runtimeRecovery?: {
    action: "localApp.ensureRunning";
    reason: string;
    approvalRequired: boolean;
    approvalId: string | null;
    autoStartAllowed: boolean;
    hardStopConditions: string[];
    bridgeActions: string[];
    disabledReason?: string | null;
  };
}

export interface MarketplaceLocalAppAgentApiRequestResponsePayload {
  requestId: string;
  status: "ok" | "failed";
  httpStatus?: number | null;
  headers?: Record<string, string>;
  body?: unknown;
  data?: unknown;
  errorCode?: string | null;
  error?: string | null;
  diagnostics?: Record<string, unknown>;
}

export interface LocalAppRuntimeRecoveryRequestPayload {
  type:
    | "localApp.getRuntimeStatus"
    | "localApp.ensureRunning"
    | "localApp.start"
    | "localApp.restart"
    | "localApp.healthCheck"
    | "localApp.tailLogs"
    | "localApp.explainRecoveryFailure";
  requestId: string;
  workspaceId: string;
  appSlug: string;
  linkedAppId?: string | null;
  sourceHostId?: string | null;
  bridgeDeviceId?: string | null;
  sourceHostType?: string | null;
  runtimeProfile: LocalAppRuntimeProfile;
  reason?: string | null;
  input?: Record<string, unknown>;
}

export interface LocalAppRuntimeRecoveryResponsePayload {
  requestId: string;
  status: "ok" | "already_running" | "started" | "failed" | "blocked";
  appReachable?: boolean;
  backendReachable?: boolean | null;
  started?: boolean;
  blockedByHardStop?: string | null;
  message?: string | null;
  diagnostics?: Record<string, unknown>;
  data?: unknown;
}

@Injectable()
export class BridgeService {
  // In-memory store for external-id -> internal-id mapping (persisted via DB lookup)
  private agentExternalToInternal: Map<string, string> = new Map();
  private taskExternalToInternal: Map<string, string> = new Map();
  private readonly logger = new Logger(BridgeService.name);
  private readonly bridgeCredentials: BridgeDeviceCredentials;

  constructor(
    @InjectRepository(OpenClawConnectionEntity)
    private connectionRepo: Repository<OpenClawConnectionEntity>,

    @InjectRepository(BridgeDeviceEntity)
    private bridgeDeviceRepo: Repository<BridgeDeviceEntity>,

    @InjectRepository(BridgeEnrollmentEntity)
    private bridgeEnrollmentRepo: Repository<BridgeEnrollmentEntity>,

    @InjectRepository(AgentProvisioningJobEntity)
    private provisioningJobRepo: Repository<AgentProvisioningJobEntity>,

    @InjectRepository(WorkspaceEntity)
    private workspaceRepo: Repository<WorkspaceEntity>,

    @InjectRepository(AgentEntity)
    private agentRepo: Repository<AgentEntity>,

    @InjectRepository(MessageEntity)
    private messageRepo: Repository<MessageEntity>,

    @InjectRepository(TaskEntity)
    private taskRepo: Repository<TaskEntity>,

    @InjectRepository(ApprovalEntity)
    private approvalRepo: Repository<ApprovalEntity>,

    @InjectRepository(RunEntity)
    private runRepo: Repository<RunEntity>,

    @InjectRepository(RunEventEntity)
    private runEventRepo: Repository<RunEventEntity>,

    @InjectRepository(WorkLogEntity)
    private workLogRepo: Repository<WorkLogEntity>,

    @InjectRepository(ThreadEntity)
    private threadRepo: Repository<ThreadEntity>,

    private readonly eventsGateway: EventsGateway,
    private readonly bridgeControlCoordinator: BridgeControlCoordinatorService,
    private readonly bridgeControlBus: BridgeControlBusService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    private readonly threadMembershipService: ThreadMembershipService,
    private readonly runtimeBindingService: RuntimeBindingService,
    private readonly runtimeDispatchCoordinator: RuntimeDispatchCoordinator,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
    private readonly encryptionService: EncryptionService,
    private readonly auditLogService: AuditLogService,
    jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.bridgeCredentials = new BridgeDeviceCredentials(
      bridgeDeviceRepo,
      jwtService,
      configService,
      eventsGateway,
      auditLogService,
    );
  }

  async publishRuntimeModelCatalog(
    bridge: BridgeDeviceAuthContext,
    payload: BridgeRuntimeModelCatalogPayload,
  ) {
    const runtimeType = payload.runtimeType?.trim().toLowerCase();
    if (!["hermes", "openclaw"].includes(runtimeType)) {
      throw new BadRequestException("Unsupported runtime model catalog");
    }
    const safeModel = /^[A-Za-z0-9._:/-]{1,128}$/;
    const models = Array.from(
      new Set(
        (Array.isArray(payload.models) ? payload.models : [])
          .map((model) => (typeof model === "string" ? model.trim() : ""))
          .filter((model) => safeModel.test(model)),
      ),
    ).slice(0, 100);
    const defaultModel = payload.defaultModel?.trim();
    if (!models.length || !safeModel.test(defaultModel)) {
      throw new BadRequestException(
        "Runtime model catalog is empty or invalid",
      );
    }
    const observedAt = payload.observedAt
      ? new Date(payload.observedAt)
      : new Date();
    const effectiveObservedAt = Number.isNaN(observedAt.getTime())
      ? new Date()
      : observedAt;
    const catalog = {
      runtimeType,
      defaultModel: models.includes(defaultModel) ? defaultModel : models[0],
      models,
      source:
        typeof payload.source === "string" && payload.source.trim()
          ? payload.source.trim().slice(0, 128)
          : "runtime-observed",
      observedAt: effectiveObservedAt.toISOString(),
    };
    await this.bridgeDeviceRepo.update(
      { id: bridge.deviceId, workspaceId: bridge.workspaceId },
      {
        runtimeModelCatalog: catalog,
        runtimeModelCatalogObservedAt: effectiveObservedAt,
        lastSeenAt: new Date(),
      },
    );
    return { success: true, catalog };
  }

  // ─── Connections ─────────────────────────────────────────────────────────────

  async createConnection(
    workspaceId: string,
    instanceUrl: string,
    apiKey?: string,
    useMockMode = false,
    createdByUserId?: string,
    requestContext?: AuditLogRequestContext,
  ): Promise<OpenClawConnectionEntity> {
    const encryptedApiKey = apiKey?.trim()
      ? this.encryptionService.encryptString(apiKey.trim())
      : null;
    const connection = this.connectionRepo.create({
      workspaceId,
      instanceUrl,
      apiKeyCiphertext: encryptedApiKey?.ciphertext ?? null,
      apiKeyIv: encryptedApiKey?.iv ?? null,
      apiKeyAuthTag: encryptedApiKey?.authTag ?? null,
      apiKeyKeyVersion: encryptedApiKey?.keyVersion ?? null,
      useMockMode,
      status: "disconnected",
    });
    const saved = await this.connectionRepo.save(connection);
    await this.auditLogService.record({
      actorType: "user",
      actorId: createdByUserId ?? null,
      workspaceId,
      eventType: "bridge.connection.created",
      resourceType: "openclaw_connection",
      resourceId: saved.id,
      ipAddress: requestContext?.ipAddress ?? null,
      userAgent: requestContext?.userAgent ?? null,
      metadata: {
        instanceUrl,
        useMockMode,
      },
    });
    return saved;
  }

  async getConnections(
    workspaceId: string,
  ): Promise<OpenClawConnectionEntity[]> {
    return this.connectionRepo.find({ where: { workspaceId } });
  }

  async getConnectionStatus(id: string): Promise<OpenClawConnectionEntity> {
    const conn = await this.connectionRepo.findOne({ where: { id } });
    if (!conn) throw new NotFoundException(`Connection ${id} not found`);
    return conn;
  }

  async callOpenClawOperation(input: {
    workspaceId: string;
    operation: string;
    payload?: Record<string, unknown>;
    connectionId?: string | null;
  }): Promise<OpenClawOperationResult> {
    const connection = await this.resolveOpenClawConnectionForOperation(
      input.workspaceId,
      input.connectionId,
    );
    const bearerToken = this.decryptOpenClawApiKey(connection);
    if (!bearerToken) {
      throw new UnauthorizedException(
        "OpenClaw bearer key is missing. Save a valid OpenClaw connection bearer key before syncing LocalAppConnector campaign policy.",
      );
    }
    const baseUrl = connection.instanceUrl.replace(/\/+$/, "");
    const localAppConnectorEndpoint = this.localAppConnectorOpenClawEndpoint(
      baseUrl,
      input.operation,
    );
    if (localAppConnectorEndpoint) {
      return this.callLocalAppConnectorOpenClawEndpoint({
        endpoint: localAppConnectorEndpoint,
        operation: input.operation,
        bearerToken,
        payload: input.payload ?? {},
      });
    }
    const endpoints = [
      `${baseUrl}/api/openclaw/operations/${encodeURIComponent(input.operation)}`,
      `${baseUrl}/api/operations/${encodeURIComponent(input.operation)}`,
      `${baseUrl}/openclaw/operations/${encodeURIComponent(input.operation)}`,
    ];
    let lastError: string | null = null;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${bearerToken}`,
          },
          body: JSON.stringify({
            operation: input.operation,
            ...(input.payload ?? {}),
          }),
        });
        const text = await response.text();
        const data = text ? this.safeJsonParse(text) : null;
        if (response.status === 401 || response.status === 403) {
          throw new UnauthorizedException(
            "OpenClaw rejected the bearer key. Update the OpenClaw connection with a valid bearer key before syncing LocalAppConnector campaign policy.",
          );
        }
        if (response.ok) {
          return {
            ok: true,
            operation: input.operation,
            status: response.status,
            endpoint,
            data,
          };
        }
        lastError = `OpenClaw operation ${input.operation} failed with ${response.status}: ${text}`;
      } catch (error) {
        if (error instanceof UnauthorizedException) throw error;
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    throw new ServiceUnavailableException(
      lastError ||
        `OpenClaw operation ${input.operation} failed. Check the OpenClaw connection URL and bearer key.`,
    );
  }

  async callLocalAppConnectorAgentApi(input: {
    workspaceId: string;
    connectionId?: string | null;
    method: "GET" | "POST";
    path: string;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    contractVersion?: string | null;
    sourceHostId?: string | null;
    sourceHostType?: string | null;
    appSlug?: string | null;
    linkedAppId?: string | null;
    runtimeProfile?: LocalAppRuntimeProfile | null;
    runtimeRecoveryApprovalId?: string | null;
    agentId?: string | null;
    dispatchId?: string | null;
  }): Promise<LocalAppConnectorAgentApiCallResult> {
    const connection = await this.resolveOpenClawConnectionForOperation(
      input.workspaceId,
      input.connectionId,
    );
    let bearerToken: string | null = null;
    try {
      bearerToken = this.decryptOpenClawApiKey(connection);
      this.logger.log(
        JSON.stringify({
          event: "localappconnector.agent_api.credential_decrypt",
          workspaceId: input.workspaceId,
          connectionId: connection.id,
          bearerConfigured: Boolean(bearerToken),
          secretDecryptSuccess: Boolean(bearerToken),
          tokenExposure: "never_logged",
        }),
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "localappconnector.agent_api.credential_decrypt_failed",
          workspaceId: input.workspaceId,
          connectionId: connection.id,
          errorClass:
            error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: this.redactedErrorMessage(error),
          tokenExposure: "never_logged",
        }),
      );
      throw this.localAppConnectorAgentApiError(
        HttpStatus.UNAUTHORIZED,
        "credential_decrypt_failed",
        "LocalAppConnector Agent API bearer key could not be decrypted. Re-save the LocalAppConnector Agent API bearer key.",
        { connectionId: connection.id },
      );
    }
    if (!bearerToken) {
      throw this.localAppConnectorAgentApiError(
        HttpStatus.UNAUTHORIZED,
        "credential_missing",
        "LocalAppConnector Agent API bearer key is missing. Save a valid LocalAppConnector Agent API bearer key before using LocalAppConnector Agent API tools.",
        { connectionId: connection.id },
      );
    }

    const normalizedPath = input.path
      .trim()
      .replace(/^\/+/, "")
      .replace(/^api\/openclaw\/?/i, "");
    if (!normalizedPath || normalizedPath.includes("..")) {
      throw new BadRequestException(
        "A valid LocalAppConnector Agent API path is required.",
      );
    }

    const baseUrl = connection.instanceUrl.replace(/\/+$/, "");
    let endpoint: URL;
    try {
      endpoint = new URL(`${baseUrl}/api/openclaw/${normalizedPath}`);
    } catch {
      throw this.localAppConnectorAgentApiError(
        HttpStatus.BAD_REQUEST,
        "source_host_rejected_target",
        "LocalAppConnector Agent API base URL is invalid. Update the connected app Agent API base URL.",
        { baseUrl },
      );
    }
    if (!["http:", "https:"].includes(endpoint.protocol)) {
      throw this.localAppConnectorAgentApiError(
        HttpStatus.BAD_REQUEST,
        "source_host_rejected_target",
        "LocalAppConnector Agent API target protocol is not allowed.",
        { protocol: endpoint.protocol },
      );
    }
    const contractVersion = input.contractVersion?.trim() || "2026-03-18";
    endpoint.searchParams.set("contractVersion", contractVersion);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (value === undefined || value === null || value === "") continue;
      endpoint.searchParams.set(key, String(value));
    }

    const isLocalTarget = this.isLocalOrPrivateUrl(endpoint);
    const executionMode = isLocalTarget
      ? "source_host_proxy"
      : "railway_direct";
    this.logger.log(
      JSON.stringify({
        event: "localappconnector.agent_api.outbound_preflight",
        workspaceId: input.workspaceId,
        connectionId: connection.id,
        method: input.method,
        path: normalizedPath,
        executionMode,
        outboundTarget: this.redactEndpoint(endpoint),
        sourceHostId: input.sourceHostId ?? null,
        sourceHostType: input.sourceHostType ?? null,
        bearerConfigured: true,
        tokenExposure: "never_logged",
      }),
    );
    if (isLocalTarget) {
      return this.callLocalAppConnectorAgentApiViaSourceHost({
        workspaceId: input.workspaceId,
        appSlug: input.appSlug ?? "localappconnector",
        linkedAppId: input.linkedAppId ?? null,
        sourceHostId: input.sourceHostId ?? null,
        sourceHostType: input.sourceHostType ?? null,
        connectionId: connection.id,
        baseUrl,
        endpoint,
        method: input.method,
        normalizedPath,
        query: input.query ?? {},
        body: input.body ?? {},
        contractVersion,
        bearerToken,
        runtimeProfile: input.runtimeProfile ?? null,
        runtimeRecoveryApprovalId: input.runtimeRecoveryApprovalId ?? null,
        agentId: input.agentId ?? null,
        dispatchId: input.dispatchId ?? null,
      });
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: input.method,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${bearerToken}`,
        },
        ...(input.method === "POST"
          ? {
              body: JSON.stringify({
                contractVersion,
                input: input.body ?? {},
              }),
            }
          : {}),
      });
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "localappconnector.agent_api.fetch_failed",
          workspaceId: input.workspaceId,
          connectionId: connection.id,
          executionMode,
          outboundTarget: this.redactEndpoint(endpoint),
          sourceHostId: input.sourceHostId ?? null,
          sourceHostType: input.sourceHostType ?? null,
          errorClass:
            error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: this.redactedErrorMessage(error),
          tokenExposure: "never_logged",
        }),
      );
      throw this.localAppConnectorAgentApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        "source_host_unavailable",
        "LocalAppConnector Agent API could not be reached from the selected execution path.",
        {
          executionMode,
          outboundTarget: this.redactEndpoint(endpoint),
          sourceHostId: input.sourceHostId ?? null,
          sourceHostType: input.sourceHostType ?? null,
        },
      );
    }
    const text = await response.text();
    const data = text ? this.safeJsonParse(text) : null;
    if (response.status === 401 || response.status === 403) {
      throw this.localAppConnectorAgentApiError(
        HttpStatus.UNAUTHORIZED,
        "localappconnector_auth_failed",
        "LocalAppConnector Agent API rejected the stored bearer key. Update the LocalAppConnector Agent API connection with a valid bearer key.",
        {
          status: response.status,
          outboundTarget: this.redactEndpoint(endpoint),
        },
      );
    }
    if (!response.ok) {
      throw this.localAppConnectorAgentApiError(
        HttpStatus.BAD_GATEWAY,
        "localappconnector_agent_api_error",
        `LocalAppConnector Agent API call failed with ${response.status}.`,
        {
          status: response.status,
          outboundTarget: this.redactEndpoint(endpoint),
          response: typeof data === "string" ? data.slice(0, 500) : data,
        },
      );
    }
    return {
      ok: true,
      status: response.status,
      endpoint: endpoint.toString(),
      data,
    };
  }

  async getLocalAppConnectorAgentApiRuntimeSecret(input: {
    workspaceId: string;
    connectionId?: string | null;
  }) {
    const connection = await this.resolveOpenClawConnectionForOperation(
      input.workspaceId,
      input.connectionId,
    );
    let bearerToken: string | null = null;
    try {
      bearerToken = this.decryptOpenClawApiKey(connection);
    } catch {
      throw this.localAppConnectorAgentApiError(
        HttpStatus.UNAUTHORIZED,
        "credential_decrypt_failed",
        "LocalAppConnector Agent API bearer key could not be decrypted. Re-save the LocalAppConnector Agent API bearer key.",
        { connectionId: connection.id },
      );
    }
    if (!bearerToken) {
      throw this.localAppConnectorAgentApiError(
        HttpStatus.UNAUTHORIZED,
        "credential_missing",
        "LocalAppConnector Agent API bearer key is missing. Save a valid LocalAppConnector Agent API bearer key before using LocalAppConnector Agent API tools.",
        { connectionId: connection.id },
      );
    }
    return {
      type: "bearer",
      connectionId: connection.id,
      instanceUrl: connection.instanceUrl,
      authorizationHeader: `Bearer ${bearerToken}`,
    };
  }

  async executeLocalAppRuntimeTool(input: {
    workspaceId: string;
    appSlug: string;
    linkedAppId?: string | null;
    sourceHostId?: string | null;
    sourceHostType?: string | null;
    runtimeProfile: LocalAppRuntimeProfile;
    toolName: string;
    input?: Record<string, unknown>;
    agentId?: string | null;
    dispatchId?: string | null;
  }) {
    const action = this.localAppRuntimeAction(input.toolName);
    if (!action) {
      throw new BadRequestException(
        `Unsupported local app runtime tool: ${input.toolName}`,
      );
    }
    const runtimeProfile = input.runtimeProfile;
    if (
      !runtimeProfile ||
      (!runtimeProfile.repoPath &&
        !runtimeProfile.appUrl &&
        !runtimeProfile.healthCheckUrl &&
        !runtimeProfile.backendHealthCheckUrl)
    ) {
      throw new BadRequestException(
        "Registered local app runtime profile is missing or incomplete.",
      );
    }

    if (action === "localApp.inspectConfig") {
      return {
        ok: true,
        status: "ok",
        toolName: input.toolName,
        appSlug: input.appSlug,
        runtimeProfile: this.redactedRuntimeProfile(runtimeProfile),
        safety: {
          arbitraryShell: false,
          arbitraryFilesystem: false,
          credentialsExposed: false,
        },
      };
    }

    if (action === "localApp.explainRecoveryFailure") {
      return {
        ok: true,
        status: "ok",
        toolName: input.toolName,
        appSlug: input.appSlug,
        runtimeProfile: this.redactedRuntimeProfile(runtimeProfile),
        diagnostics: this.localAppRuntimeReadiness(input),
      };
    }

    if (this.localAppRuntimeActionRequiresApproval(action)) {
      await this.assertLocalAppRuntimeActionApproved({
        action,
        workspaceId: input.workspaceId,
        appSlug: input.appSlug,
        linkedAppId: input.linkedAppId ?? null,
        sourceHostId:
          input.sourceHostId ?? input.runtimeProfile.sourceHostId ?? null,
        sourceHostType: input.sourceHostType ?? null,
        agentId: input.agentId ?? null,
        dispatchId: input.dispatchId ?? null,
        runtimeProfile,
        input: input.input ?? {},
      });
    }

    const bridgeDeviceId =
      input.sourceHostId?.trim() || runtimeProfile.sourceHostId?.trim() || null;
    const isHermesHost =
      input.sourceHostType === "hermes_bridge" ||
      input.sourceHostType === "runtime_host";
    const hasHermesRuntimeTool =
      this.eventsGateway.hasHermesBridgeWorkspaceCapability(
        input.workspaceId,
        LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
        bridgeDeviceId,
      );
    const hasBridgeRuntimeTool = this.eventsGateway.hasBridgeControlSubscribers(
      input.workspaceId,
      LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
      bridgeDeviceId,
    );
    if (!hasHermesRuntimeTool && !hasBridgeRuntimeTool) {
      throw new ServiceUnavailableException(
        "The selected source host does not currently advertise registered local app runtime controls.",
      );
    }

    const payload: Omit<LocalAppRuntimeRecoveryRequestPayload, "requestId"> = {
      type: action,
      workspaceId: input.workspaceId,
      appSlug: input.appSlug,
      linkedAppId: input.linkedAppId ?? null,
      sourceHostId: bridgeDeviceId,
      bridgeDeviceId,
      sourceHostType: input.sourceHostType ?? null,
      runtimeProfile,
      reason: this.localAppRuntimeReason(action),
      input: this.normalizedLocalAppRuntimeToolInput(action, input.input ?? {}),
    };

    this.logger.log(
      JSON.stringify({
        event: "local_app.runtime_tool.dispatch",
        workspaceId: input.workspaceId,
        appSlug: input.appSlug,
        linkedAppId: input.linkedAppId ?? null,
        sourceHostId: bridgeDeviceId,
        sourceHostType: input.sourceHostType ?? null,
        action,
        repoPath: runtimeProfile.repoPath,
        appUrl: runtimeProfile.appUrl,
        healthCheckUrl: runtimeProfile.healthCheckUrl,
        backendHealthCheckUrl: runtimeProfile.backendHealthCheckUrl,
        startCommandAllowed:
          runtimeProfile.startCommand &&
          this.isApprovedPackageManagerScript(runtimeProfile.startCommand),
        autoStartAllowed: runtimeProfile.autoStartAllowed,
        expectedPorts: runtimeProfile.expectedPorts,
        tokenExposure: "never_logged",
      }),
    );

    const eventType = action;
    const resultEvent = `${eventType}.result`;
    const errorEvent = `${eventType}.error`;
    const timeoutMs =
      action === "localApp.start" || action === "localApp.restart"
        ? 45_000
        : 20_000;
    if (isHermesHost && hasHermesRuntimeTool) {
      const requestId = randomUUID();
      const pending =
        this.bridgeControlCoordinator.registerRequest<LocalAppRuntimeRecoveryResponsePayload>(
          requestId,
          [resultEvent, errorEvent],
          timeoutMs,
          {
            workspaceId: input.workspaceId,
            runtimeType: "hermes",
            targetBridgeDeviceId: bridgeDeviceId,
          },
        );
      this.eventsGateway.emitToHermesBridgeWorkspace(
        input.workspaceId,
        eventType,
        {
          requestId,
          ...payload,
        },
        LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
        bridgeDeviceId,
      );
      return this.normalizeLocalAppRuntimeToolResponse(
        input.toolName,
        action,
        (await pending).data,
      );
    }

    const response =
      await this.sendBridgeControlRequest<LocalAppRuntimeRecoveryResponsePayload>(
        input.workspaceId,
        eventType,
        payload,
        [resultEvent],
        [errorEvent],
        timeoutMs,
        LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
        bridgeDeviceId,
      );
    return this.normalizeLocalAppRuntimeToolResponse(
      input.toolName,
      action,
      response,
    );
  }

  async configureWorkspaceOpenClawConnection(input: {
    workspaceId: string;
    instanceUrl: string;
    apiKey?: string | null;
    connectionId?: string | null;
    useMockMode?: boolean;
    actorUserId?: string | null;
    requestContext?: AuditLogRequestContext;
  }): Promise<OpenClawConnectionEntity> {
    const instanceUrl = input.instanceUrl.trim().replace(/\/+$/, "");
    if (!instanceUrl) {
      throw new BadRequestException("OpenClaw base URL is required.");
    }
    const encryptedApiKey = input.apiKey?.trim()
      ? this.encryptionService.encryptString(input.apiKey.trim())
      : null;
    let connection = input.connectionId
      ? await this.connectionRepo.findOne({
          where: { id: input.connectionId, workspaceId: input.workspaceId },
          select: [
            "id",
            "workspaceId",
            "instanceUrl",
            "apiKeyCiphertext",
            "apiKeyIv",
            "apiKeyAuthTag",
            "apiKeyKeyVersion",
            "status",
            "useMockMode",
            "createdAt",
            "updatedAt",
          ],
        })
      : null;
    if (!connection) {
      connection =
        (await this.connectionRepo.findOne({
          where: { workspaceId: input.workspaceId, useMockMode: true },
          order: { updatedAt: "DESC" },
          select: [
            "id",
            "workspaceId",
            "instanceUrl",
            "apiKeyCiphertext",
            "apiKeyIv",
            "apiKeyAuthTag",
            "apiKeyKeyVersion",
            "status",
            "useMockMode",
            "createdAt",
            "updatedAt",
          ],
        })) ??
        this.connectionRepo.create({
          workspaceId: input.workspaceId,
        });
    }
    connection.instanceUrl = instanceUrl;
    connection.useMockMode = input.useMockMode ?? false;
    connection.status = "connected";
    if (encryptedApiKey) {
      connection.apiKeyCiphertext = encryptedApiKey.ciphertext;
      connection.apiKeyIv = encryptedApiKey.iv;
      connection.apiKeyAuthTag = encryptedApiKey.authTag;
      connection.apiKeyKeyVersion = encryptedApiKey.keyVersion;
    }
    const saved = await this.connectionRepo.save(connection);
    await this.auditLogService.record({
      actorType: "user",
      actorId: input.actorUserId ?? null,
      workspaceId: input.workspaceId,
      eventType: "bridge.connection.configured",
      resourceType: "openclaw_connection",
      resourceId: saved.id,
      ipAddress: input.requestContext?.ipAddress ?? null,
      userAgent: input.requestContext?.userAgent ?? null,
      metadata: {
        instanceUrl,
        useMockMode: saved.useMockMode,
        apiKeyUpdated: Boolean(encryptedApiKey),
      },
    });
    return saved;
  }

  private localAppConnectorOpenClawEndpoint(
    baseUrl: string,
    operation: string,
  ) {
    const map: Record<string, string> = {
      "autonomy.get_policy": "autonomy/get_policy",
      "autonomy.update_policy": "autonomy/update_policy",
      "autonomy.explain_effective_policy": "autonomy/explain_effective_policy",
    };
    const path = map[operation];
    return path ? `${baseUrl}/api/openclaw/${path}` : null;
  }

  private async callLocalAppConnectorOpenClawEndpoint(input: {
    endpoint: string;
    operation: string;
    bearerToken: string;
    payload: Record<string, unknown>;
  }): Promise<OpenClawOperationResult> {
    const response = await fetch(input.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.bearerToken}`,
      },
      body: JSON.stringify({
        contractVersion: String(input.payload.contractVersion ?? "2026-03-18"),
        input: this.localAppConnectorOperationInput(
          input.operation,
          input.payload,
        ),
      }),
    });
    const text = await response.text();
    const data = text ? this.safeJsonParse(text) : null;
    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedException(
        "OpenClaw rejected the bearer key. Update the OpenClaw connection with a valid bearer key before syncing LocalAppConnector campaign policy.",
      );
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `OpenClaw operation ${input.operation} failed with ${response.status}: ${text}`,
      );
    }
    return {
      ok: true,
      operation: input.operation,
      status: response.status,
      endpoint: input.endpoint,
      data,
    };
  }

  private localAppConnectorOperationInput(
    operation: string,
    payload: Record<string, unknown>,
  ) {
    const { contractVersion: _contractVersion, ...rest } = payload;
    if (operation === "autonomy.update_policy") {
      return rest.policy && typeof rest.policy === "object"
        ? rest.policy
        : rest;
    }
    return rest;
  }

  private async resolveOpenClawConnectionForOperation(
    workspaceId: string,
    connectionId?: string | null,
  ) {
    const where = connectionId
      ? { id: connectionId, workspaceId }
      : { workspaceId };
    const connection = await this.connectionRepo.findOne({
      where,
      order: { updatedAt: "DESC" },
      select: [
        "id",
        "workspaceId",
        "instanceUrl",
        "apiKeyCiphertext",
        "apiKeyIv",
        "apiKeyAuthTag",
        "apiKeyKeyVersion",
        "status",
        "updatedAt",
      ],
    });
    if (!connection) {
      throw new NotFoundException(
        "No OpenClaw connection found. Save an OpenClaw connection with a valid bearer key before syncing LocalAppConnector campaign policy.",
      );
    }
    return connection;
  }

  private decryptOpenClawApiKey(connection: OpenClawConnectionEntity) {
    if (
      !connection.apiKeyCiphertext ||
      !connection.apiKeyIv ||
      !connection.apiKeyAuthTag ||
      !connection.apiKeyKeyVersion
    ) {
      return null;
    }
    return this.encryptionService.decryptString({
      ciphertext: connection.apiKeyCiphertext,
      iv: connection.apiKeyIv,
      authTag: connection.apiKeyAuthTag,
      keyVersion: connection.apiKeyKeyVersion,
    });
  }

  private localAppConnectorAgentApiError(
    status: HttpStatus,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    return new HttpException(
      {
        statusCode: status,
        error: "LocalAppConnector Agent API setup error",
        code,
        message,
        details,
      },
      status,
    );
  }

  private isLocalOrPrivateUrl(endpoint: URL) {
    const hostname = endpoint.hostname.toLowerCase();
    const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4) {
      const first = Number(ipv4[1]);
      const second = Number(ipv4[2]);
      return (
        first === 10 ||
        first === 127 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 169 && second === 254)
      );
    }
    return (
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    );
  }

  private redactEndpoint(endpoint: URL) {
    const clone = new URL(endpoint.toString());
    clone.username = "";
    clone.password = "";
    return clone.toString();
  }

  private redactedErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(
      /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
      "Bearer [REDACTED]",
    );
  }

  private localAppRuntimeAction(toolName: string) {
    const normalized = typeof toolName === "string" ? toolName.trim() : "";
    const map: Record<
      string,
      LocalAppRuntimeRecoveryRequestPayload["type"] | "localApp.inspectConfig"
    > = {
      "localApp.status": "localApp.getRuntimeStatus",
      localApp_status: "localApp.getRuntimeStatus",
      "localApp.inspectConfig": "localApp.inspectConfig",
      localApp_inspect_config: "localApp.inspectConfig",
      "localApp.ensureRunning": "localApp.ensureRunning",
      localApp_ensure_running: "localApp.ensureRunning",
      "localApp.start": "localApp.start",
      localApp_start: "localApp.start",
      "localApp.restart": "localApp.restart",
      localApp_restart: "localApp.restart",
      "localApp.healthCheck": "localApp.healthCheck",
      localApp_health_check: "localApp.healthCheck",
      "localApp.tailLogs": "localApp.tailLogs",
      localApp_tail_logs: "localApp.tailLogs",
      "localApp.explainRecoveryFailure": "localApp.explainRecoveryFailure",
      localApp_explain_recovery_failure: "localApp.explainRecoveryFailure",
    };
    return map[normalized] ?? null;
  }

  private localAppRuntimeActionRequiresApproval(
    action:
      | LocalAppRuntimeRecoveryRequestPayload["type"]
      | "localApp.inspectConfig",
  ) {
    return (
      action === "localApp.start" ||
      action === "localApp.restart" ||
      action === "localApp.ensureRunning"
    );
  }

  private async assertLocalAppRuntimeActionApproved(input: {
    action: "localApp.start" | "localApp.restart" | "localApp.ensureRunning";
    workspaceId: string;
    appSlug: string;
    linkedAppId?: string | null;
    sourceHostId?: string | null;
    sourceHostType?: string | null;
    agentId?: string | null;
    dispatchId?: string | null;
    runtimeProfile: LocalAppRuntimeProfile;
    input: Record<string, unknown>;
  }) {
    if (!input.runtimeProfile.autoStartAllowed) {
      throw new ForbiddenException(
        "Registered local app runtime recovery is not enabled for this app.",
      );
    }
    const approvalId = this.localAppRuntimeApprovalId(input.input);
    if (!approvalId) {
      throw new ForbiddenException(
        "Registered local app runtime recovery requires an approved approvalId.",
      );
    }
    const startCommand = input.runtimeProfile.startCommand?.trim() || "";
    if (!this.isApprovedPackageManagerScript(startCommand)) {
      throw new ForbiddenException(
        "Registered local app runtime recovery is limited to approved package-manager scripts.",
      );
    }

    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    if (!approval) {
      throw new ForbiddenException("Runtime recovery approval was not found.");
    }
    if (approval.status === "rejected") {
      throw new ForbiddenException("Runtime recovery approval was rejected.");
    }
    if (approval.status === "expired" || this.isExpired(approval.expiresAt)) {
      throw new ForbiddenException("Runtime recovery approval has expired.");
    }
    if (approval.status !== "approved") {
      throw new ForbiddenException(
        "Runtime recovery requires an approved approval.",
      );
    }
    if (!approval.resolvedAt || !approval.resolvedByUserId) {
      throw new ForbiddenException(
        "Runtime recovery approval has not been resolved by an authorized user.",
      );
    }

    this.assertLocalAppRuntimeApprovalMetadata(approval.metadata ?? {}, {
      ...input,
      approvalId,
      startCommand,
    });
  }

  private localAppRuntimeApprovalId(input: Record<string, unknown>) {
    return typeof input.approvalId === "string" && input.approvalId.trim()
      ? input.approvalId.trim()
      : null;
  }

  private assertLocalAppRuntimeApprovalMetadata(
    metadata: Record<string, unknown>,
    input: {
      action: "localApp.start" | "localApp.restart" | "localApp.ensureRunning";
      approvalId: string;
      workspaceId: string;
      appSlug: string;
      linkedAppId?: string | null;
      sourceHostId?: string | null;
      sourceHostType?: string | null;
      agentId?: string | null;
      dispatchId?: string | null;
      startCommand: string;
    },
  ) {
    const provider = this.metadataString(metadata, "provider");
    if (
      provider !== "registered_local_app_runtime" &&
      provider !== "local_app_runtime"
    ) {
      throw new ForbiddenException(
        "Runtime recovery approval provider does not match.",
      );
    }

    this.assertMetadataStringEquals(metadata, "action", input.action);
    this.assertMetadataStringEquals(metadata, "appSlug", input.appSlug);
    if (input.linkedAppId) {
      this.assertMetadataStringEquals(
        metadata,
        "linkedAppId",
        input.linkedAppId,
      );
    }
    if (input.sourceHostId) {
      const sourceHostId =
        this.metadataString(metadata, "sourceHostId") ??
        this.metadataString(metadata, "bridgeDeviceId");
      if (sourceHostId !== input.sourceHostId) {
        throw new ForbiddenException(
          "Runtime recovery approval source host does not match.",
        );
      }
    }
    if (input.agentId) {
      this.assertMetadataStringEquals(
        metadata,
        "requestingAgentId",
        input.agentId,
      );
    }
    const dispatchId = this.metadataString(metadata, "dispatchId");
    if (dispatchId && input.dispatchId && dispatchId !== input.dispatchId) {
      throw new ForbiddenException(
        "Runtime recovery approval dispatch does not match.",
      );
    }
    const sourceHostType = this.metadataString(metadata, "sourceHostType");
    if (
      sourceHostType &&
      input.sourceHostType &&
      sourceHostType !== input.sourceHostType
    ) {
      throw new ForbiddenException(
        "Runtime recovery approval source host type does not match.",
      );
    }
    const startCommand = this.metadataString(metadata, "startCommand");
    if (startCommand && startCommand !== input.startCommand) {
      throw new ForbiddenException(
        "Runtime recovery approval start command does not match.",
      );
    }
  }

  private assertMetadataStringEquals(
    metadata: Record<string, unknown>,
    key: string,
    expected: string,
  ) {
    if (this.metadataString(metadata, key) !== expected) {
      throw new ForbiddenException(
        "Runtime recovery approval scope does not match.",
      );
    }
  }

  private metadataString(metadata: Record<string, unknown>, key: string) {
    const value = metadata[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private isExpired(expiresAt: Date | string | null | undefined): boolean {
    if (!expiresAt) return false;
    const expiresAtMs =
      expiresAt instanceof Date
        ? expiresAt.getTime()
        : new Date(expiresAt).getTime();
    return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
  }

  private isApprovedPackageManagerScript(command: string) {
    const normalized = command.trim().replace(/\s+/g, " ");
    if (!normalized || /[;&|`$<>\n\r]/.test(normalized)) return false;
    return new Set([
      "pnpm dev",
      "pnpm start",
      "npm run dev",
      "npm start",
      "yarn dev",
      "yarn start",
      "bun run dev",
      "bun start",
    ]).has(normalized);
  }

  private normalizedLocalAppRuntimeToolInput(
    action: LocalAppRuntimeRecoveryRequestPayload["type"],
    input: Record<string, unknown>,
  ) {
    if (action === "localApp.tailLogs") {
      const lines = Number(input.lines ?? 80);
      return {
        lines: Number.isFinite(lines)
          ? Math.max(1, Math.min(200, Math.trunc(lines)))
          : 80,
      };
    }
    if (this.localAppRuntimeActionRequiresApproval(action)) {
      return {
        approvalId:
          typeof input.approvalId === "string" && input.approvalId.trim()
            ? input.approvalId.trim()
            : null,
      };
    }
    return {};
  }

  private localAppRuntimeReason(
    action: LocalAppRuntimeRecoveryRequestPayload["type"],
  ) {
    const reasons: Record<
      LocalAppRuntimeRecoveryRequestPayload["type"],
      string
    > = {
      "localApp.getRuntimeStatus":
        "Agent requested registered local app runtime status.",
      "localApp.ensureRunning":
        "Agent requested registered local app runtime recovery.",
      "localApp.start": "Agent requested approved registered local app start.",
      "localApp.restart":
        "Agent requested approved registered local app restart.",
      "localApp.healthCheck":
        "Agent requested registered local app health checks.",
      "localApp.tailLogs":
        "Agent requested a short redacted registered local app log tail.",
      "localApp.explainRecoveryFailure":
        "Agent requested registered local app runtime recovery diagnostics.",
    };
    return reasons[action];
  }

  private normalizeLocalAppRuntimeToolResponse(
    toolName: string,
    action: LocalAppRuntimeRecoveryRequestPayload["type"],
    response: LocalAppRuntimeRecoveryResponsePayload,
  ) {
    return {
      ok: response.status !== "failed" && response.status !== "blocked",
      toolName,
      action,
      status: response.status,
      appReachable: response.appReachable ?? null,
      backendReachable: response.backendReachable ?? null,
      started: response.started ?? false,
      blockedByHardStop: response.blockedByHardStop ?? null,
      message: response.message ?? null,
      data: this.redactRuntimeToolData(response.data ?? null),
      diagnostics: this.redactRuntimeToolData(response.diagnostics ?? null),
    };
  }

  private redactedRuntimeProfile(profile: LocalAppRuntimeProfile) {
    return {
      repoPath: profile.repoPath,
      appUrl: profile.appUrl,
      agentApiUrl: profile.agentApiUrl,
      startCommand: profile.startCommand,
      healthCheckUrl: profile.healthCheckUrl,
      backendHealthCheckUrl: profile.backendHealthCheckUrl,
      autoStartAllowed: profile.autoStartAllowed,
      hardStopConditions: profile.hardStopConditions,
      expectedPorts: profile.expectedPorts,
      sourceHostId: profile.sourceHostId,
    };
  }

  private localAppRuntimeReadiness(input: {
    workspaceId: string;
    sourceHostId?: string | null;
    sourceHostType?: string | null;
    runtimeProfile: LocalAppRuntimeProfile;
  }) {
    const bridgeDeviceId =
      input.sourceHostId?.trim() ||
      input.runtimeProfile.sourceHostId?.trim() ||
      null;
    return {
      sourceHostId: bridgeDeviceId,
      sourceHostType: input.sourceHostType ?? null,
      recoveryCapability: LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
      hermesRecoveryAdvertised:
        this.eventsGateway.hasHermesBridgeWorkspaceCapability(
          input.workspaceId,
          LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
          bridgeDeviceId,
        ),
      bridgeRecoveryAdvertised: this.eventsGateway.hasBridgeControlSubscribers(
        input.workspaceId,
        LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
        bridgeDeviceId,
      ),
      autoStartAllowed: input.runtimeProfile.autoStartAllowed,
      approvedStartCommand:
        Boolean(input.runtimeProfile.startCommand) &&
        this.isApprovedPackageManagerScript(
          input.runtimeProfile.startCommand ?? "",
        ),
      hardStopConditions: input.runtimeProfile.hardStopConditions,
      expectedPorts: input.runtimeProfile.expectedPorts,
    };
  }

  private redactRuntimeToolData(value: unknown): unknown {
    if (typeof value === "string") {
      return value
        .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
        .replace(
          /(api[_-]?key|token|password|secret|authorization)=([^&\s]+)/gi,
          "$1=[REDACTED]",
        );
    }
    if (Array.isArray(value)) {
      return value.map((entry) => this.redactRuntimeToolData(entry));
    }
    if (value && typeof value === "object") {
      const redacted: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (/api[_-]?key|token|password|secret|authorization/i.test(key)) {
          redacted[key] = "[REDACTED]";
        } else {
          redacted[key] = this.redactRuntimeToolData(entry);
        }
      }
      return redacted;
    }
    return value;
  }

  private safeJsonParse(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async getPublicWorkspaceIntegrationStatus(
    workspaceId: string,
  ): Promise<PublicOpenClawIntegrationStatus> {
    const [connections, devices, agents] = await Promise.all([
      this.connectionRepo.find({ where: { workspaceId } }),
      this.bridgeDeviceRepo.find({
        where: { workspaceId, status: BridgeDeviceStatus.ACTIVE },
      }),
      this.agentRepo.find({
        where: { workspaceId } as any,
        select: ["id", "externalId", "description"],
      }),
    ]);

    const runtime = this.eventsGateway.getWorkspaceBridgeRuntime(workspaceId);
    const connectionCount = connections.length;
    const pairedDeviceCount = devices.filter(
      (device) => !device.revokedAt,
    ).length;
    const mappedAgentCount = agents.filter((agent) =>
      this.hasAgentExternalMapping(agent),
    ).length;
    const onlineDeviceCount = runtime.connectedBridgeDeviceCount;
    const liveBridgeControlCount = runtime.bridgeControlSubscriberCount;
    const liveAgentCount = runtime.liveRegisteredAgentCount;
    const isConfigured =
      connectionCount > 0 || pairedDeviceCount > 0 || mappedAgentCount > 0;
    const isOnline =
      onlineDeviceCount > 0 || liveBridgeControlCount > 0 || liveAgentCount > 0;
    const hasLiveAgents = liveAgentCount > 0;
    const isChatRoutable = hasLiveAgents;

    if (!isConfigured) {
      return {
        provider: "openclaw",
        status: "not_configured",
        title: "Not set up",
        description: "OpenClaw has not been set up for this workspace yet.",
        isConfigured,
        isOnline,
        hasLiveAgents,
        isChatRoutable,
        needsAttention: false,
        connectionCount,
        pairedDeviceCount,
        onlineDeviceCount,
        liveBridgeControlCount,
        mappedAgentCount,
        liveAgentCount,
      };
    }

    if (isChatRoutable) {
      return {
        provider: "openclaw",
        status: "connected",
        title: "Connected",
        description:
          "OpenClaw is online and your workspace can message live agents.",
        isConfigured,
        isOnline,
        hasLiveAgents,
        isChatRoutable,
        needsAttention: false,
        connectionCount,
        pairedDeviceCount,
        onlineDeviceCount,
        liveBridgeControlCount,
        mappedAgentCount,
        liveAgentCount,
      };
    }

    if (!isOnline && pairedDeviceCount > 0 && mappedAgentCount > 0) {
      return {
        provider: "openclaw",
        status: "offline",
        title: "Offline",
        description:
          "OpenClaw is set up for this workspace, but no bridge devices are online right now.",
        isConfigured,
        isOnline,
        hasLiveAgents,
        isChatRoutable,
        needsAttention: true,
        connectionCount,
        pairedDeviceCount,
        onlineDeviceCount,
        liveBridgeControlCount,
        mappedAgentCount,
        liveAgentCount,
      };
    }

    let description =
      "OpenClaw setup exists for this workspace, but it needs attention before agent chat is available.";

    if (!pairedDeviceCount) {
      description =
        "OpenClaw setup has started for this workspace, but no bridge device has been paired yet.";
    } else if (!mappedAgentCount) {
      description = isOnline
        ? "OpenClaw is online, but no workspace agents have been linked yet."
        : "OpenClaw has a paired device, but no workspace agents have been linked yet.";
    } else if (!isOnline) {
      description =
        "OpenClaw is set up for this workspace, but the live bridge is not currently available.";
    } else if (!hasLiveAgents) {
      description =
        "OpenClaw is online, but no live agents are currently registered for chat.";
    } else {
      description =
        "OpenClaw setup exists for this workspace, but it needs attention before agent chat is available.";
    }

    return {
      provider: "openclaw",
      status: "needs_attention",
      title: "Needs attention",
      description,
      isConfigured,
      isOnline,
      hasLiveAgents,
      isChatRoutable,
      needsAttention: true,
      connectionCount,
      pairedDeviceCount,
      onlineDeviceCount,
      liveBridgeControlCount,
      mappedAgentCount,
      liveAgentCount,
    };
  }

  async updateConnectionStatus(
    id: string,
    status: string,
    data?: {
      agentsSynced?: number;
      lastConnectedAt?: Date;
      lastEventAt?: Date;
      error?: string;
    },
  ): Promise<void> {
    const update: any = { status };
    if (data?.agentsSynced !== undefined)
      update.agentsSynced = data.agentsSynced;
    if (data?.lastConnectedAt) update.lastConnectedAt = data.lastConnectedAt;
    if (data?.lastEventAt) update.lastEventAt = data.lastEventAt;
    await this.connectionRepo.update(id, update);
  }

  async triggerReconnect(
    id: string,
    userId?: string,
    requestContext?: AuditLogRequestContext,
  ): Promise<void> {
    await this.getConnectionStatus(id);
    await this.connectionRepo.update(id, { status: "reconnect_requested" });
    if (userId) {
      const connection = await this.connectionRepo.findOne({ where: { id } });
      await this.auditLogService.record({
        actorType: "user",
        actorId: userId,
        workspaceId: connection?.workspaceId ?? null,
        eventType: "bridge.connection.reconnect_requested",
        resourceType: "openclaw_connection",
        resourceId: id,
        ipAddress: requestContext?.ipAddress ?? null,
        userAgent: requestContext?.userAgent ?? null,
      });
    }
  }

  async createEnrollment(
    workspaceId: string,
    userId: string,
    deviceLabel?: string,
    expiresInMinutes: number = 10,
    requestContext?: AuditLogRequestContext,
  ) {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }

    const normalizedMinutes = Math.max(1, Math.min(30, expiresInMinutes));
    const enrollmentCode = this.generateBridgeCode();
    const enrollment = await this.bridgeEnrollmentRepo.save(
      this.bridgeEnrollmentRepo.create({
        workspaceId,
        createdByUserId: userId,
        codeHash: this.bridgeCredentials.hashOpaqueSecret(enrollmentCode),
        deviceLabel: deviceLabel?.trim() || null,
        expiresAt: new Date(Date.now() + normalizedMinutes * 60 * 1000),
        status: BridgeEnrollmentStatus.ACTIVE,
      }),
    );

    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "bridge.enrollment.created",
      resourceType: "bridge_enrollment",
      resourceId: enrollment.id,
      ipAddress: requestContext?.ipAddress ?? null,
      userAgent: requestContext?.userAgent ?? null,
      metadata: {
        expiresInMinutes: normalizedMinutes,
        deviceLabel: enrollment.deviceLabel,
      },
    });

    return {
      id: enrollment.id,
      workspaceId,
      workspaceName: workspace.name,
      code: enrollmentCode,
      deviceLabel: enrollment.deviceLabel,
      expiresAt: enrollment.expiresAt,
      status: enrollment.status,
    };
  }

  async redeemEnrollment(
    code: string,
    input: BridgeDeviceMetadata & { deviceLabel?: string },
    requestContext?: AuditLogRequestContext,
  ) {
    const enrollment = await this.findActiveEnrollmentByCode(code);
    if (!enrollment) {
      await this.auditLogService.record({
        actorType: "bridge_device",
        actorId: null,
        eventType: "bridge.enrollment.failed",
        ipAddress: requestContext?.ipAddress ?? null,
        userAgent: requestContext?.userAgent ?? null,
        metadata: { reason: "invalid_or_expired_code" },
      });
      throw new UnauthorizedException("Enrollment code is invalid or expired");
    }

    const workspace = await this.workspaceRepo.findOne({
      where: { id: enrollment.workspaceId },
      select: ["id", "name"],
    });
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const compatibility = this.assertBridgeCompatibility(input);

    const usedAt = new Date();
    const redemption = await this.bridgeEnrollmentRepo.update(
      { id: enrollment.id, status: BridgeEnrollmentStatus.ACTIVE },
      { status: BridgeEnrollmentStatus.USED, usedAt },
    );
    if (redemption?.affected === 0) {
      await this.auditLogService.record({
        actorType: "bridge_device",
        actorId: null,
        workspaceId: enrollment.workspaceId,
        eventType: "bridge.enrollment.failed",
        resourceType: "bridge_enrollment",
        resourceId: enrollment.id,
        ipAddress: requestContext?.ipAddress ?? null,
        userAgent: requestContext?.userAgent ?? null,
        metadata: { reason: "already_used" },
      });
      throw new UnauthorizedException("Enrollment code is invalid or expired");
    }
    enrollment.status = BridgeEnrollmentStatus.USED;
    enrollment.usedAt = usedAt;

    const deviceToken = this.bridgeCredentials.generateCredential();
    const device = await this.bridgeDeviceRepo.save(
      this.bridgeDeviceRepo.create({
        workspaceId: enrollment.workspaceId,
        createdByUserId: enrollment.createdByUserId,
        label:
          input.deviceLabel?.trim() ||
          enrollment.deviceLabel ||
          "Local Open Core",
        devicePublicId: `bdev_${randomUUID()}`,
        credentialHash: this.bridgeCredentials.hashOpaqueSecret(deviceToken),
        status: BridgeDeviceStatus.ACTIVE,
        capabilities: compatibility.enabledCapabilities,
        openCoreVersion: input.openCoreVersion ?? null,
        pluginVersion: input.pluginVersion ?? null,
        runtimeType: compatibility.runtimeType,
        hostType: compatibility.hostType,
        credentialVersion: 1,
        credentialRotatedAt: null,
        previousCredentialHash: null,
        previousCredentialVersion: null,
        previousCredentialConsumedAt: null,
        lastSeenAt: new Date(),
      }),
    );

    const tokens = await this.issueBridgeTokens(device);
    await this.auditLogService.record({
      actorType: "bridge_device",
      actorId: device.id,
      workspaceId: device.workspaceId,
      eventType: "bridge.device.paired",
      resourceType: "bridge_device",
      resourceId: device.id,
      ipAddress: requestContext?.ipAddress ?? null,
      userAgent: requestContext?.userAgent ?? null,
      metadata: {
        devicePublicId: device.devicePublicId,
        label: device.label,
        pluginVersion: device.pluginVersion,
        openCoreVersion: device.openCoreVersion,
        runtimeType: device.runtimeType,
        hostType: device.hostType,
        compatibilityLevel: compatibility.level,
        operatingMode: compatibility.operatingMode,
      },
    });

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      device: this.serializeBridgeDevice(device),
      credentials: {
        devicePublicId: device.devicePublicId,
        deviceToken,
      },
      tokens,
    };
  }

  async authenticateDevice(
    devicePublicId: string,
    deviceToken: string,
    metadata?: BridgeDeviceMetadata,
    requestContext?: AuditLogRequestContext,
  ) {
    const device = await this.bridgeDeviceRepo.findOne({
      where: { devicePublicId },
      select: [
        "id",
        "workspaceId",
        "createdByUserId",
        "label",
        "devicePublicId",
        "credentialHash",
        "previousCredentialHash",
        "previousCredentialVersion",
        "previousCredentialConsumedAt",
        "status",
        "capabilities",
        "pluginVersion",
        "openCoreVersion",
        "runtimeType",
        "hostType",
        "credentialVersion",
        "credentialRotatedAt",
        "lastSeenAt",
        "revokedAt",
        "createdAt",
        "updatedAt",
      ],
    });
    if (
      !device ||
      !this.bridgeCredentials.matchesOpaqueSecret(
        deviceToken,
        device.credentialHash,
      )
    ) {
      if (
        device &&
        this.bridgeCredentials.matchesOpaqueSecret(
          deviceToken,
          device.previousCredentialHash,
        )
      ) {
        await this.rejectReplayedBridgeCredential(device, requestContext);
      }
      await this.auditLogService.record({
        actorType: "bridge_device",
        actorId: devicePublicId,
        eventType: "bridge.device.auth.failed",
        ipAddress: requestContext?.ipAddress ?? null,
        userAgent: requestContext?.userAgent ?? null,
        metadata: { reason: "invalid_device_credentials" },
      });
      throw new UnauthorizedException("Invalid bridge device credentials");
    }

    if (device.status !== BridgeDeviceStatus.ACTIVE || device.revokedAt) {
      await this.auditLogService.record({
        actorType: "bridge_device",
        actorId: device.id,
        workspaceId: device.workspaceId,
        eventType: "bridge.device.auth.failed",
        resourceType: "bridge_device",
        resourceId: device.id,
        ipAddress: requestContext?.ipAddress ?? null,
        userAgent: requestContext?.userAgent ?? null,
        metadata: {
          reason: "revoked",
          devicePublicId: device.devicePublicId,
        },
      });
      throw new UnauthorizedException("Bridge device has been revoked");
    }

    const compatibility = this.assertBridgeCompatibility(metadata ?? {});
    this.assertStableBridgeIdentity(device, compatibility);

    return this.rotateBridgeCredentialAndIssueTokens(
      device,
      metadata ?? {},
      compatibility,
      "bridge.device.auth.success",
      requestContext,
    );
  }

  async rotateDeviceCredential(
    devicePublicId: string,
    deviceToken: string,
    metadata: BridgeDeviceMetadata,
    requestContext?: AuditLogRequestContext,
  ) {
    const device = await this.bridgeDeviceRepo.findOne({
      where: { devicePublicId },
      select: [
        "id",
        "workspaceId",
        "createdByUserId",
        "label",
        "devicePublicId",
        "credentialHash",
        "previousCredentialHash",
        "previousCredentialVersion",
        "previousCredentialConsumedAt",
        "status",
        "capabilities",
        "pluginVersion",
        "openCoreVersion",
        "runtimeType",
        "hostType",
        "credentialVersion",
        "credentialRotatedAt",
        "lastSeenAt",
        "revokedAt",
        "createdAt",
        "updatedAt",
      ],
    });
    if (
      !device ||
      !this.bridgeCredentials.matchesOpaqueSecret(
        deviceToken,
        device.credentialHash,
      )
    ) {
      if (
        device &&
        this.bridgeCredentials.matchesOpaqueSecret(
          deviceToken,
          device.previousCredentialHash,
        )
      ) {
        await this.rejectReplayedBridgeCredential(device, requestContext);
      }
      throw new UnauthorizedException("Invalid bridge device credentials");
    }
    if (device.status !== BridgeDeviceStatus.ACTIVE || device.revokedAt) {
      throw new UnauthorizedException("Bridge device has been revoked");
    }

    const compatibility = this.assertBridgeCompatibility(metadata);
    this.assertStableBridgeIdentity(device, compatibility);
    return this.rotateBridgeCredentialAndIssueTokens(
      device,
      metadata,
      compatibility,
      "bridge.device.credential_rotated",
      requestContext,
    );
  }

  async authenticateBridgeAccessToken(
    authorizationHeader?: string,
  ): Promise<BridgeDeviceAuthContext> {
    return this.bridgeCredentials.authenticateAccessToken(authorizationHeader);
  }

  async getBridgeDevice(deviceId: string) {
    const device = await this.bridgeDeviceRepo.findOne({
      where: { id: deviceId },
    });
    if (!device) {
      throw new NotFoundException(`Bridge device ${deviceId} not found`);
    }
    return device;
  }

  async listBridgeDevices(workspaceId: string) {
    const devices = await this.bridgeDeviceRepo.find({
      where: { workspaceId },
      order: { updatedAt: "DESC" },
    });
    const connectedDeviceIds =
      this.eventsGateway.getConnectedBridgeDeviceIds(workspaceId);
    return devices.map((device) =>
      this.serializeBridgeDevice(device, connectedDeviceIds),
    );
  }

  async listMarketplaceLocalRepoSourceHosts(workspaceId: string) {
    const devices = await this.bridgeDeviceRepo.find({
      where: { workspaceId },
      order: { updatedAt: "DESC" },
    });
    const connectedBridgeDeviceIds =
      this.eventsGateway.getConnectedBridgeDeviceIds(workspaceId);
    return devices
      .filter(
        (device) =>
          device.status === BridgeDeviceStatus.ACTIVE &&
          !device.revokedAt &&
          (device.capabilities ?? []).includes(
            MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY,
          ),
      )
      .map((device) => {
        const capabilities = device.capabilities ?? [];
        const isConnected = connectedBridgeDeviceIds.has(device.id);
        const runtimeType = capabilities.includes("clawchat.runtime.hermes")
          ? "hermes"
          : "openclaw";
        const type =
          runtimeType === "hermes" ? "hermes_bridge" : "openclaw_bridge";
        return {
          id: device.id,
          type,
          label:
            device.label ||
            `${runtimeType === "hermes" ? "Hermes" : "OpenClaw"} bridge`,
          status: isConnected ? "available" : "offline",
          runtimeType,
          bridgeDeviceId: device.id,
          runtimeBindingId: null,
          capabilities,
          supportsLocalRepoDocsRead: true,
        };
      });
  }

  async revokeBridgeDevice(
    deviceId: string,
    userId: string,
    requestContext?: AuditLogRequestContext,
  ) {
    const device = await this.getBridgeDevice(deviceId);
    if (device.status === BridgeDeviceStatus.REVOKED) {
      return;
    }

    await this.bridgeDeviceRepo.update(device.id, {
      status: BridgeDeviceStatus.REVOKED,
      revokedAt: new Date(),
    });
    this.eventsGateway.disconnectBridgeDevice(device.id);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId: device.workspaceId,
      eventType: "bridge.device.revoked",
      resourceType: "bridge_device",
      resourceId: device.id,
      ipAddress: requestContext?.ipAddress ?? null,
      userAgent: requestContext?.userAgent ?? null,
      metadata: {
        devicePublicId: device.devicePublicId,
        label: device.label,
      },
    });
  }

  async revokeAllBridgeDevices(
    workspaceId: string,
    userId: string,
    requestContext?: AuditLogRequestContext,
  ) {
    const devices = await this.bridgeDeviceRepo.find({
      where: { workspaceId, status: BridgeDeviceStatus.ACTIVE },
    });
    const revokedIds = devices.map((device) => device.id);
    if (!revokedIds.length) {
      return [];
    }

    await this.bridgeDeviceRepo
      .createQueryBuilder()
      .update(BridgeDeviceEntity)
      .set({
        status: BridgeDeviceStatus.REVOKED,
        revokedAt: new Date(),
      })
      .where("id IN (:...ids)", { ids: revokedIds })
      .execute();

    for (const device of devices) {
      this.eventsGateway.disconnectBridgeDevice(device.id);
    }

    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "bridge.device.revoke_all",
      resourceType: "workspace",
      resourceId: workspaceId,
      ipAddress: requestContext?.ipAddress ?? null,
      userAgent: requestContext?.userAgent ?? null,
      metadata: { revokedDeviceIds: revokedIds },
    });

    return revokedIds;
  }

  async recordSyncRequested(
    workspaceId: string,
    userId: string,
    requestContext?: AuditLogRequestContext,
  ) {
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "bridge.sync.requested",
      resourceType: "workspace",
      resourceId: workspaceId,
      ipAddress: requestContext?.ipAddress ?? null,
      userAgent: requestContext?.userAgent ?? null,
    });
  }

  async listLibrary(
    workspaceId: string,
    folder: string = "",
  ): Promise<Omit<BridgeLibraryListPayload, "requestId">> {
    const safeFolder = this.normalizeLibraryFolder(folder);
    const response =
      await this.sendBridgeLibraryRequest<BridgeLibraryListPayload>(
        workspaceId,
        "library.list",
        { folder: safeFolder },
        ["library.list.result"],
      );

    return {
      folder: this.normalizeLibraryFolder(response.folder),
      folders: response.folders ?? [],
      files: response.files ?? [],
    };
  }

  async readLibraryFile(
    workspaceId: string,
    folder: string,
    filename: string,
  ): Promise<Omit<BridgeLibraryReadPayload, "requestId">> {
    const safeFolder = this.normalizeLibraryFolder(folder);
    const safeFilename = this.normalizeWorkspaceTextFilename(filename);
    const response =
      await this.sendBridgeLibraryRequest<BridgeLibraryReadPayload>(
        workspaceId,
        "library.read",
        {
          folder: safeFolder,
          filename: safeFilename,
        },
        ["library.read.result"],
      );

    return {
      folder: this.normalizeLibraryFolder(response.folder),
      filename: response.filename,
      content: response.content,
      size: response.size ?? Buffer.byteLength(response.content || "", "utf8"),
      updatedAt: response.updatedAt ?? null,
    };
  }

  async writeLibraryFiles(
    workspaceId: string,
    folder: string,
    files: BridgeLibraryFilePayload[],
  ): Promise<Omit<BridgeLibraryWritePayload, "requestId">> {
    const safeFolder = this.normalizeLibraryFolder(folder);
    const safeFiles = this.normalizeWorkspaceFilePayloads(files);
    const response =
      await this.sendBridgeLibraryRequest<BridgeLibraryWritePayload>(
        workspaceId,
        "library.write",
        {
          folder: safeFolder,
          files: safeFiles,
        },
        ["library.write.result"],
        60_000,
      );

    return {
      folder: this.normalizeLibraryFolder(response.folder),
      written: response.written ?? safeFiles.map((entry) => entry.filename),
      createdFolder: Boolean(response.createdFolder),
    };
  }

  async deleteLibraryFile(
    workspaceId: string,
    folder: string,
    filename: string,
  ): Promise<Omit<BridgeLibraryDeletePayload, "requestId">> {
    const safeFolder = this.normalizeLibraryFolder(folder);
    const safeFilename = this.normalizeWorkspaceTextFilename(filename);
    const response =
      await this.sendBridgeLibraryRequest<BridgeLibraryDeletePayload>(
        workspaceId,
        "library.delete",
        {
          folder: safeFolder,
          filename: safeFilename,
        },
        ["library.delete.result"],
      );

    return {
      folder: this.normalizeLibraryFolder(response.folder),
      filename: response.filename,
      deleted: Boolean(response.deleted),
    };
  }

  async listAgentWorkspace(
    workspaceId: string,
    agentId: string,
    folder: string = "",
  ): Promise<Omit<BridgeAgentWorkspaceListPayload, "requestId" | "workspace">> {
    const safeFolder = this.normalizeLibraryFolder(folder);
    const response =
      await this.sendBridgeControlRequest<BridgeAgentWorkspaceListPayload>(
        workspaceId,
        "agent.workspace.list",
        {
          agentId,
          folder: safeFolder,
        },
        ["agent.workspace.list.result"],
        ["agent.workspace.error"],
      );

    return {
      agentId: response.agentId,
      folder: this.normalizeLibraryFolder(response.folder),
      folders: response.folders ?? [],
      files: response.files ?? [],
    };
  }

  async readAgentWorkspaceFile(
    workspaceId: string,
    agentId: string,
    folder: string,
    filename: string,
  ): Promise<Omit<BridgeAgentWorkspaceReadPayload, "requestId" | "workspace">> {
    const safeFolder = this.normalizeLibraryFolder(folder);
    const safeFilename = this.normalizeWorkspaceTextFilename(filename);
    const response =
      await this.sendBridgeControlRequest<BridgeAgentWorkspaceReadPayload>(
        workspaceId,
        "agent.workspace.read",
        {
          agentId,
          folder: safeFolder,
          filename: safeFilename,
        },
        ["agent.workspace.read.result"],
        ["agent.workspace.error"],
      );

    return {
      agentId: response.agentId,
      folder: this.normalizeLibraryFolder(response.folder),
      filename: response.filename,
      content: response.content,
      size: response.size ?? Buffer.byteLength(response.content || "", "utf8"),
      updatedAt: response.updatedAt ?? null,
    };
  }

  async writeAgentWorkspaceFiles(
    workspaceId: string,
    agentId: string,
    folder: string,
    files: BridgeLibraryFilePayload[],
  ): Promise<
    Omit<BridgeAgentWorkspaceWritePayload, "requestId" | "workspace">
  > {
    const safeFolder = this.normalizeLibraryFolder(folder);
    const safeFiles = this.normalizeWorkspaceFilePayloads(files);
    const response =
      await this.sendBridgeControlRequest<BridgeAgentWorkspaceWritePayload>(
        workspaceId,
        "agent.workspace.write",
        {
          agentId,
          folder: safeFolder,
          files: safeFiles,
        },
        ["agent.workspace.write.result"],
        ["agent.workspace.error"],
        60_000,
      );

    return {
      agentId: response.agentId,
      folder: this.normalizeLibraryFolder(response.folder),
      written: response.written ?? safeFiles.map((entry) => entry.filename),
      createdFolder: Boolean(response.createdFolder),
    };
  }

  async deleteAgentWorkspaceFile(
    workspaceId: string,
    agentId: string,
    folder: string,
    filename: string,
  ): Promise<
    Omit<BridgeAgentWorkspaceDeletePayload, "requestId" | "workspace">
  > {
    const safeFolder = this.normalizeLibraryFolder(folder);
    const safeFilename = this.normalizeWorkspaceTextFilename(filename);
    const response =
      await this.sendBridgeControlRequest<BridgeAgentWorkspaceDeletePayload>(
        workspaceId,
        "agent.workspace.delete",
        {
          agentId,
          folder: safeFolder,
          filename: safeFilename,
        },
        ["agent.workspace.delete.result"],
        ["agent.workspace.error"],
      );

    return {
      agentId: response.agentId,
      folder: this.normalizeLibraryFolder(response.folder),
      filename: response.filename,
      deleted: Boolean(response.deleted),
    };
  }

  async deleteLibraryFolder(
    workspaceId: string,
    folder: string,
  ): Promise<Omit<BridgeLibraryDeleteFolderPayload, "requestId">> {
    const safeFolder = this.normalizeLibraryFolder(folder, {
      requireNonEmpty: true,
    });
    // Sending library.delete WITHOUT a filename tells the bridge plugin to
    // rmSync the entire folder recursively (library.ts handleLibraryDelete).
    await this.sendBridgeLibraryRequest(
      workspaceId,
      "library.delete",
      { folder: safeFolder },
      ["library.delete.result"],
      30_000,
    );
    return {
      folder: safeFolder,
      deleted: true,
    };
  }

  async deleteAgentWorkspaceFolder(
    workspaceId: string,
    agentId: string,
    folder: string,
  ): Promise<
    Omit<BridgeAgentWorkspaceDeleteFolderPayload, "requestId" | "workspace">
  > {
    const safeFolder = this.normalizeLibraryFolder(folder, {
      requireNonEmpty: true,
    });
    // Sending agent.workspace.delete WITHOUT a filename triggers the same
    // recursive-directory-delete path in the bridge plugin.
    await this.sendBridgeControlRequest(
      workspaceId,
      "agent.workspace.delete",
      { agentId, folder: safeFolder },
      ["agent.workspace.delete.result"],
      ["agent.workspace.error"],
      30_000,
    );
    return {
      agentId,
      folder: safeFolder,
      deleted: true,
    };
  }

  async listHermesWorkspace(
    workspaceId: string,
    agentId: string,
    folder: HermesWorkspaceFolder,
    requestedPath: string = "/",
  ): Promise<BridgeLibraryListPayload> {
    const { externalAgentId } = await this.requireHermesWorkspaceTarget(
      workspaceId,
      agentId,
      folder,
    );
    const normalizedPath = this.normalizeHermesWorkspacePath(requestedPath);
    const response = await this.sendHermesWorkspaceRequest(workspaceId, {
      type: "hermes.workspace.list",
      externalAgentId,
      folder,
      path: normalizedPath,
    });

    const entries = response.entries ?? [];
    return {
      requestId: response.requestId,
      folder: this.hermesPathToLibraryFolder(response.path ?? normalizedPath),
      folders: entries
        .filter((entry) => entry.type === "folder")
        .map((entry) => ({
          name: entry.name,
          path: this.joinHermesDisplayPath(
            response.path ?? normalizedPath,
            entry.name,
          ),
        })),
      files: entries
        .filter((entry) => entry.type === "file")
        .map((entry) => ({
          filename: entry.name,
          path: this.joinHermesDisplayPath(
            response.path ?? normalizedPath,
            entry.name,
          ),
          size: entry.size ?? 0,
          updatedAt: entry.mtime ?? null,
        })),
    };
  }

  async readHermesWorkspaceFile(
    workspaceId: string,
    agentId: string,
    folder: HermesWorkspaceFolder,
    requestedPath: string,
    filename: string,
  ): Promise<BridgeLibraryReadPayload> {
    const { externalAgentId } = await this.requireHermesWorkspaceTarget(
      workspaceId,
      agentId,
      folder,
    );
    const normalizedPath = this.normalizeHermesWorkspacePath(requestedPath);
    const safeFilename = this.normalizeWorkspacePathSegment(
      filename,
      "filename",
    );
    const response = await this.sendHermesWorkspaceRequest(workspaceId, {
      type: "hermes.workspace.read",
      externalAgentId,
      folder,
      path: normalizedPath,
      filename: safeFilename,
    });

    return {
      requestId: response.requestId,
      folder: this.hermesPathToLibraryFolder(response.path ?? normalizedPath),
      filename: response.filename ?? safeFilename,
      content: response.content ?? "",
      size: response.size ?? Buffer.byteLength(response.content ?? "", "utf8"),
      updatedAt: response.mtime ?? null,
    };
  }

  async writeHermesWorkspaceFiles(
    workspaceId: string,
    agentId: string,
    folder: HermesWorkspaceFolder,
    requestedPath: string,
    files: Array<{
      filename: string;
      content: string;
      encoding?: "utf8" | "base64";
    }>,
  ): Promise<BridgeLibraryWritePayload> {
    const { externalAgentId } = await this.requireHermesWorkspaceTarget(
      workspaceId,
      agentId,
      folder,
      { requireWritable: true },
    );
    const normalizedPath = this.normalizeHermesWorkspacePath(requestedPath);
    const safeFiles = files.map((file) => ({
      ...file,
      filename: this.normalizeWorkspacePathSegment(file.filename, "filename"),
    }));
    const written: string[] = [];

    for (const file of safeFiles) {
      const response = await this.sendHermesWorkspaceRequest(
        workspaceId,
        {
          type: "hermes.workspace.write",
          externalAgentId,
          folder,
          path: normalizedPath,
          filename: file.filename,
          content: file.content,
          encoding: file.encoding ?? "utf8",
        },
        60_000,
      );
      written.push(response.filename ?? file.filename);
    }

    return {
      requestId: "",
      folder: this.hermesPathToLibraryFolder(normalizedPath),
      written,
      createdFolder: false,
    };
  }

  async createHermesWorkspaceFolder(
    workspaceId: string,
    agentId: string,
    folder: HermesWorkspaceFolder,
    requestedPath: string,
    filename: string,
  ): Promise<BridgeLibraryWritePayload> {
    const { externalAgentId } = await this.requireHermesWorkspaceTarget(
      workspaceId,
      agentId,
      folder,
      { requireWritable: true },
    );
    const normalizedPath = this.normalizeHermesWorkspacePath(requestedPath);
    const safeFilename = this.normalizeWorkspacePathSegment(
      filename,
      "folder name",
    );
    await this.sendHermesWorkspaceRequest(workspaceId, {
      type: "hermes.workspace.mkdir",
      externalAgentId,
      folder,
      path: normalizedPath,
      filename: safeFilename,
    });

    return {
      requestId: "",
      folder: this.hermesPathToLibraryFolder(normalizedPath),
      written: [],
      createdFolder: true,
    };
  }

  async deleteHermesWorkspaceFile(
    workspaceId: string,
    agentId: string,
    folder: HermesWorkspaceFolder,
    requestedPath: string,
    filename: string,
  ): Promise<BridgeLibraryDeletePayload> {
    const { externalAgentId } = await this.requireHermesWorkspaceTarget(
      workspaceId,
      agentId,
      folder,
      { requireWritable: true },
    );
    const normalizedPath = this.normalizeHermesWorkspacePath(requestedPath);
    const safeFilename = this.normalizeWorkspacePathSegment(
      filename,
      "filename",
    );
    const response = await this.sendHermesWorkspaceRequest(workspaceId, {
      type: "hermes.workspace.delete",
      externalAgentId,
      folder,
      path: normalizedPath,
      filename: safeFilename,
    });

    return {
      requestId: response.requestId,
      folder: this.hermesPathToLibraryFolder(response.path ?? normalizedPath),
      filename: response.filename ?? safeFilename,
      deleted: true,
    };
  }

  private buildExternalCacheKey(
    workspaceId?: string | null,
    externalId?: string | null,
  ): string | null {
    const workspace = workspaceId?.trim();
    const external = externalId?.trim();
    return workspace && external ? `${workspace}:${external}` : null;
  }

  // ─── Agent Mapping ───────────────────────────────────────────────────────────

  /**
   * Remove an externalId from whichever agent(s) currently hold it in their description.
   * Call this to clear a corrupted mapping before re-registering the correct agent.
   */
  async clearExternalIdMapping(
    externalId: string,
    workspaceId: string,
  ): Promise<{ cleared: number }> {
    const mappingKey = this.buildExternalCacheKey(workspaceId, externalId);
    const agents = await this.agentRepo
      .createQueryBuilder("agent")
      .where("agent.workspaceId = :workspaceId", { workspaceId })
      .andWhere("agent.description LIKE :pattern", {
        pattern: `%External ID: ${externalId}`,
      })
      .getMany();

    for (const agent of agents) {
      const cleaned = (agent.description || "")
        .replace(
          new RegExp(
            `\\s*External ID:\\s*${externalId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
            "i",
          ),
          "",
        )
        .trim();
      await this.agentRepo.update(agent.id, {
        description: cleaned,
        externalId: null,
      });
    }

    // Also clear from in-memory map
    if (mappingKey) {
      this.agentExternalToInternal.delete(mappingKey);
    }

    return { cleared: agents.length };
  }

  async getAgentIdMapping(
    externalId: string,
    workspaceId: string,
  ): Promise<string | null> {
    const mappingKey = this.buildExternalCacheKey(workspaceId, externalId);
    if (mappingKey && this.agentExternalToInternal.has(mappingKey)) {
      return this.agentExternalToInternal.get(mappingKey)!;
    }
    const agent = await this.agentRepo.findOne({
      where: { workspaceId, externalId } as any,
    });
    if (agent && mappingKey) {
      this.agentExternalToInternal.set(mappingKey, agent.id);
      return agent.id;
    }
    return null;
  }

  async createOrUpdateAgentFromBridge(
    workspaceId: string,
    payload: BridgeAgentPayload,
    options: { assignLegacyBinding?: boolean } = {},
  ): Promise<AgentEntity> {
    const mappingKey = this.buildExternalCacheKey(
      workspaceId,
      payload.externalId,
    );
    const normalizedStatus = this.normalizeAgentStatus(payload.status);
    const normalizedDescription = this.buildAgentDescription(
      payload.description,
      payload.externalId,
      true,
    );

    // First try the real externalId field. This is the authoritative mapping for
    // newly provisioned and bridge-synced agents.
    let agent = await this.agentRepo.findOne({
      where: { workspaceId, externalId: payload.externalId } as any,
    });

    // Runtime identities are never inferred from a display name or a legacy
    // description suffix. Those fields are mutable and are not identity keys.

    if (agent) {
      // Keep bridge-synced records fresh so names and roles don't go stale.
      const normalizedSource = this.resolveBridgeAgentSource(payload);
      await this.agentRepo.update(agent.id, {
        name: payload.name,
        role: payload.role,
        externalId: payload.externalId,
        source: normalizedSource,
        status: normalizedStatus,
        capabilities: payload.capabilities,
        description: normalizedDescription,
        modelPrimary:
          typeof payload.metadata?.modelPrimary === "string"
            ? payload.metadata.modelPrimary
            : null,
        provisioningStatus: "ready",
      });
      agent.name = payload.name;
      agent.role = payload.role;
      agent.externalId = payload.externalId;
      agent.source = normalizedSource;
      agent.status = normalizedStatus;
      agent.capabilities = payload.capabilities;
      agent.description = normalizedDescription;
      agent.modelPrimary =
        typeof payload.metadata?.modelPrimary === "string"
          ? payload.metadata.modelPrimary
          : null;
      agent.provisioningStatus = "ready";
      if (options.assignLegacyBinding !== false) {
        await this.upsertBridgeRuntimeBinding(agent, payload);
      }
      if (mappingKey) {
        this.agentExternalToInternal.set(mappingKey, agent.id);
      }
      return agent;
    }

    // Create new agent
    const newAgent = this.agentRepo.create({
      workspaceId,
      name: payload.name,
      role: payload.role,
      externalId: payload.externalId,
      source: this.resolveBridgeAgentSource(payload),
      status: normalizedStatus,
      capabilities: payload.capabilities,
      description: normalizedDescription,
      modelPrimary:
        typeof payload.metadata?.modelPrimary === "string"
          ? payload.metadata.modelPrimary
          : null,
      provisioningStatus: "ready",
    });
    const saved = await this.agentRepo.save(newAgent);
    if (options.assignLegacyBinding !== false) {
      await this.upsertBridgeRuntimeBinding(saved, payload);
    }
    if (mappingKey) {
      this.agentExternalToInternal.set(mappingKey, saved.id);
    }
    return saved;
  }

  private async upsertBridgeRuntimeBinding(
    agent: Pick<AgentEntity, "id" | "workspaceId" | "externalId">,
    payload: Pick<BridgeAgentPayload, "source" | "capabilities" | "metadata">,
  ) {
    if (!agent.workspaceId) {
      return;
    }
    const runtimeType = this.isHermesBridgeAgent(payload)
      ? HERMES_RUNTIME_TYPE
      : OPENCLAW_RUNTIME_TYPE;
    const adapterKind =
      runtimeType === HERMES_RUNTIME_TYPE
        ? HERMES_ADAPTER_KIND
        : OPENCLAW_ADAPTER_KIND;
    const capabilityRecord = (payload.capabilities ?? []).reduce<
      Record<string, true>
    >((record, capability) => {
      record[capability] = true;
      return record;
    }, {});
    const browserSupport = runtimeType === HERMES_RUNTIME_TYPE;
    await this.runtimeBindingService.upsertByAgentId(agent.id, {
      workspaceId: agent.workspaceId,
      runtimeType,
      adapterKind,
      routingMode: "default_target",
      isEnabled: Boolean(agent.externalId),
      healthStatus: agent.externalId ? "ready" : "unconfigured",
      capabilities: {
        streamText: false,
        cancelRun: false,
        resumeSession: false,
        toolActivity: "none",
        bridgeBacked: true,
        requiresExternalRuntimePresence: true,
        ...capabilityRecord,
        browserSupport,
        browserTools: browserSupport ? [...HERMES_BROWSER_TOOLS] : [],
      },
      configMetadata: {
        compatibilitySource: "bridge_service_sync",
        bridgeDeviceId:
          typeof payload.metadata?.bridgeDeviceId === "string"
            ? payload.metadata.bridgeDeviceId
            : null,
        devicePublicId:
          typeof payload.metadata?.devicePublicId === "string"
            ? payload.metadata.devicePublicId
            : null,
        runtimeHostKind:
          typeof payload.metadata?.runtimeHostKind === "string"
            ? payload.metadata.runtimeHostKind
            : "external_bridge",
      },
    });
  }

  private resolveBridgeAgentSource(
    payload: Pick<BridgeAgentPayload, "source" | "capabilities">,
  ) {
    return this.isHermesBridgeAgent(payload)
      ? HERMES_RUNTIME_TYPE
      : payload.source || OPENCLAW_RUNTIME_TYPE;
  }

  private isHermesBridgeAgent(
    payload: Pick<BridgeAgentPayload, "source" | "capabilities">,
  ) {
    return (
      payload.source === HERMES_RUNTIME_TYPE ||
      (payload.capabilities ?? []).includes(HERMES_RUNTIME_CAPABILITY)
    );
  }

  private async sendBridgeControlRequest<T extends { requestId: string }>(
    workspaceId: string,
    eventType: string,
    data: Record<string, unknown>,
    expectedResponseTypes: string[],
    expectedErrorTypes: string[],
    timeoutMs: number = 15_000,
    capability?: string | null,
    targetBridgeDeviceId?: string | null,
    runtimeType: "openclaw" | "hermes" = OPENCLAW_RUNTIME_TYPE,
  ): Promise<T> {
    const hasLocalBridgeControl =
      this.eventsGateway.hasBridgeControlSubscribers(
        workspaceId,
        capability,
        targetBridgeDeviceId,
        runtimeType,
      );
    const targetRemoteInstanceId = hasLocalBridgeControl
      ? null
      : await this.bridgeControlBus.resolveRemoteSubscriber({
          workspaceId,
          capability,
          targetBridgeDeviceId,
          runtimeType,
        });

    if (!hasLocalBridgeControl && !targetRemoteInstanceId) {
      throw new ServiceUnavailableException(
        targetBridgeDeviceId
          ? "The selected runtime host is not currently reachable for this workspace"
          : "No local OpenClaw bridge control client is connected for this workspace",
      );
    }

    const requestId = randomUUID();
    const pending = this.bridgeControlCoordinator.registerRequest<T>(
      requestId,
      [...expectedResponseTypes, ...expectedErrorTypes],
      timeoutMs,
      {
        workspaceId,
        runtimeType,
        targetBridgeDeviceId: targetBridgeDeviceId ?? null,
      },
    );

    if (hasLocalBridgeControl) {
      this.eventsGateway.emitToBridgeControls(
        workspaceId,
        eventType,
        {
          requestId,
          ...data,
        },
        capability,
        targetBridgeDeviceId,
        runtimeType,
      );
    } else {
      await this.bridgeControlBus.publishControlRequest({
        targetInstanceId: targetRemoteInstanceId!,
        requestId,
        workspaceId,
        eventType,
        data: {
          requestId,
          ...data,
        },
        capability,
        targetBridgeDeviceId,
        runtimeType,
        timeoutMs,
      });
    }

    const response = await pending;
    return response.data;
  }

  private async sendBridgeLibraryRequest<T extends { requestId: string }>(
    workspaceId: string,
    eventType: string,
    data: Record<string, unknown>,
    expectedResponseTypes: string[],
    timeoutMs: number = 15_000,
  ): Promise<T> {
    return this.sendBridgeControlRequest<T>(
      workspaceId,
      eventType,
      data,
      expectedResponseTypes,
      ["library.error"],
      timeoutMs,
    );
  }

  private async sendHermesWorkspaceRequest(
    workspaceId: string,
    input: {
      type:
        | "hermes.workspace.list"
        | "hermes.workspace.read"
        | "hermes.workspace.write"
        | "hermes.workspace.delete"
        | "hermes.workspace.mkdir";
      externalAgentId: string;
      folder: HermesWorkspaceFolder;
      path: string;
      filename?: string | null;
      content?: string;
      encoding?: "utf8" | "base64";
    },
    timeoutMs: number = 15_000,
  ): Promise<HermesWorkspaceResultPayload> {
    const runtime =
      this.eventsGateway.getWorkspaceHermesBridgeRuntime(workspaceId);
    if (runtime.connectedBridgeDeviceCount <= 0) {
      throw new ServiceUnavailableException(
        "No Hermes bridge client is connected for this workspace",
      );
    }

    const requestId = randomUUID();
    const pending =
      this.bridgeControlCoordinator.registerRequest<HermesWorkspaceResultPayload>(
        requestId,
        ["hermes.workspace.result"],
        timeoutMs,
        {
          workspaceId,
          runtimeType: "hermes",
          targetBridgeDeviceId: null,
        },
      );

    this.eventsGateway.emitToHermesBridgeWorkspace(workspaceId, input.type, {
      requestId,
      workspaceId,
      externalAgentId: input.externalAgentId,
      folder: input.folder,
      path: input.path,
      filename: input.filename ?? null,
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.encoding ? { encoding: input.encoding } : {}),
    });

    const response = (await pending).data;
    if (response.ok === false) {
      throw new BadRequestException(
        response.error?.message || "Hermes workspace request failed",
      );
    }
    return response;
  }

  hasHermesMarketplaceSkillInstallCapability(workspaceId: string) {
    return this.eventsGateway.hasHermesBridgeWorkspaceCapability(
      workspaceId,
      MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
    );
  }

  hasLocalAppAgentApiSetupCapability(
    workspaceId: string,
    bridgeDeviceId?: string | null,
  ) {
    return (
      this.eventsGateway.hasHermesBridgeWorkspaceCapability(
        workspaceId,
        MARKETPLACE_LOCAL_APP_AGENT_API_SETUP_CAPABILITY,
        bridgeDeviceId?.trim() || null,
      ) ||
      this.eventsGateway.hasBridgeControlSubscribers(
        workspaceId,
        MARKETPLACE_LOCAL_APP_AGENT_API_SETUP_CAPABILITY,
        bridgeDeviceId?.trim() || null,
      )
    );
  }

  async installMarketplaceHermesSkill(
    workspaceId: string,
    request: Omit<MarketplaceHermesSkillInstallRequestPayload, "requestId">,
    timeoutMs: number = 30_000,
  ): Promise<{
    request: MarketplaceHermesSkillInstallRequestPayload;
    response: MarketplaceHermesSkillInstallResponsePayload;
  }> {
    const runtime =
      this.eventsGateway.getWorkspaceHermesBridgeRuntime(workspaceId);
    if (runtime.connectedBridgeDeviceCount <= 0) {
      throw new ServiceUnavailableException(
        "No Hermes bridge client is connected for this workspace",
      );
    }
    if (
      !this.eventsGateway.hasHermesBridgeWorkspaceCapability(
        workspaceId,
        MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
      )
    ) {
      throw new ServiceUnavailableException(
        `Hermes bridge is connected but does not advertise ${MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY}`,
      );
    }
    if (!runtime.liveRegisteredExternalAgentIds.includes(request.agentId)) {
      throw new ServiceUnavailableException(
        "Hermes bridge is connected, but the selected Hermes agent is not currently live",
      );
    }

    const requestId = randomUUID();
    const payload: MarketplaceHermesSkillInstallRequestPayload = {
      requestId,
      ...request,
    };
    const pending =
      this.bridgeControlCoordinator.registerRequest<MarketplaceHermesSkillInstallResponsePayload>(
        requestId,
        ["marketplace.installHermesSkill.result"],
        timeoutMs,
        {
          workspaceId,
          runtimeType: "hermes",
          targetBridgeDeviceId: null,
        },
      );

    this.eventsGateway.emitToHermesBridgeWorkspace(
      workspaceId,
      "marketplace.installHermesSkill",
      payload,
      MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
    );

    const response = (await pending).data;
    return { request: payload, response };
  }

  async readMarketplaceLocalRepoDocs(
    workspaceId: string,
    request: Omit<
      MarketplaceReadLocalRepoDocsRequestPayload,
      "type" | "requestId" | "workspaceId"
    >,
    timeoutMs: number = 30_000,
  ): Promise<MarketplaceReadLocalRepoDocsResponsePayload> {
    const bridgeDeviceId = request.bridgeDeviceId?.trim() || null;
    let selectedDevice: BridgeDeviceEntity | null = null;
    if (bridgeDeviceId) {
      selectedDevice = await this.bridgeDeviceRepo.findOne({
        where: { id: bridgeDeviceId, workspaceId },
      });
      if (
        !selectedDevice ||
        selectedDevice.status !== BridgeDeviceStatus.ACTIVE ||
        selectedDevice.revokedAt
      ) {
        throw new ServiceUnavailableException(
          "This repo path is on a runtime host that is not currently reachable. Select a connected OpenClaw/Hermes host or sync the repo to this machine.",
        );
      }
      if (
        !(selectedDevice.capabilities ?? []).includes(
          MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY,
        )
      ) {
        throw new ServiceUnavailableException(
          `Selected runtime host does not advertise ${MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY}. Update the OpenClaw/Hermes bridge before reading local repo docs.`,
        );
      }
    }
    const payload = {
      type: "marketplace.readLocalRepoDocs",
      workspaceId,
      sourceHostId: request.sourceHostId ?? bridgeDeviceId,
      bridgeDeviceId,
      sourceHostType: request.sourceHostType ?? null,
      runtimeType: request.runtimeType ?? null,
      repoPath: request.repoPath,
      docsSourcePath: request.docsSourcePath,
      includeGlobs: request.includeGlobs,
    };
    const selectedDeviceCapabilities = selectedDevice?.capabilities ?? [];
    const isHermesHost =
      request.sourceHostType === "hermes_bridge" ||
      request.runtimeType === "hermes" ||
      selectedDeviceCapabilities.includes("clawchat.runtime.hermes");
    if (isHermesHost) {
      if (
        !this.eventsGateway.hasHermesBridgeWorkspaceCapability(
          workspaceId,
          MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY,
          bridgeDeviceId,
        )
      ) {
        throw new ServiceUnavailableException(
          "The selected Hermes runtime host is not currently reachable for this workspace",
        );
      }
      const requestId = randomUUID();
      const pending =
        this.bridgeControlCoordinator.registerRequest<MarketplaceReadLocalRepoDocsResponsePayload>(
          requestId,
          [
            "marketplace.readLocalRepoDocs.result",
            "marketplace.readLocalRepoDocs.error",
          ],
          timeoutMs,
          {
            workspaceId,
            runtimeType: "hermes",
            targetBridgeDeviceId: bridgeDeviceId,
          },
        );
      this.eventsGateway.emitToHermesBridgeWorkspace(
        workspaceId,
        "marketplace.readLocalRepoDocs",
        {
          requestId,
          ...payload,
        },
        MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY,
        bridgeDeviceId,
      );
      return (await pending).data;
    }

    const response =
      await this.sendBridgeControlRequest<MarketplaceReadLocalRepoDocsResponsePayload>(
        workspaceId,
        "marketplace.readLocalRepoDocs",
        payload,
        ["marketplace.readLocalRepoDocs.result"],
        ["marketplace.readLocalRepoDocs.error"],
        timeoutMs,
        MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY,
        bridgeDeviceId,
      );
    return response;
  }

  async setupMarketplaceLocalAppAgentApi(
    workspaceId: string,
    request: Omit<
      MarketplaceLocalAppAgentApiSetupRequestPayload,
      "type" | "requestId" | "workspaceId"
    >,
    timeoutMs: number = 45_000,
  ): Promise<MarketplaceLocalAppAgentApiSetupResponsePayload> {
    const bridgeDeviceId = request.bridgeDeviceId?.trim() || null;
    const payload = {
      type: "marketplace.localAppAgentApiSetup",
      workspaceId,
      appSlug: request.appSlug,
      appName: request.appName ?? null,
      sourceHostId: request.sourceHostId ?? bridgeDeviceId,
      bridgeDeviceId,
      sourceHostType: request.sourceHostType ?? null,
      runtimeType: request.runtimeType ?? null,
      localAppUrl: request.localAppUrl ?? null,
      localApiUrl: request.localApiUrl ?? null,
      agentApiBaseUrl: request.agentApiBaseUrl ?? null,
      legacyRouteNamespace: "/api/openclaw" as const,
      desiredCampaignId: request.desiredCampaignId ?? null,
      desiredCampaignName: request.desiredCampaignName ?? null,
      autonomyPolicy: request.autonomyPolicy ?? undefined,
    };
    const isHermesHost =
      request.sourceHostType === "hermes_bridge" ||
      request.runtimeType === "hermes";
    if (isHermesHost) {
      if (
        !this.eventsGateway.hasHermesBridgeWorkspaceCapability(
          workspaceId,
          MARKETPLACE_LOCAL_APP_AGENT_API_SETUP_CAPABILITY,
          bridgeDeviceId,
        )
      ) {
        throw new ServiceUnavailableException(
          `The selected Hermes runtime host does not advertise ${MARKETPLACE_LOCAL_APP_AGENT_API_SETUP_CAPABILITY}. Update the Hermes bridge before using one-click LocalAppConnector Agent API setup.`,
        );
      }
      const requestId = randomUUID();
      const pending =
        this.bridgeControlCoordinator.registerRequest<MarketplaceLocalAppAgentApiSetupResponsePayload>(
          requestId,
          [
            "marketplace.localAppAgentApiSetup.result",
            "marketplace.localAppAgentApiSetup.error",
          ],
          timeoutMs,
          {
            workspaceId,
            runtimeType: "hermes",
            targetBridgeDeviceId: bridgeDeviceId,
          },
        );
      this.eventsGateway.emitToHermesBridgeWorkspace(
        workspaceId,
        "marketplace.localAppAgentApiSetup",
        {
          requestId,
          ...payload,
        },
        MARKETPLACE_LOCAL_APP_AGENT_API_SETUP_CAPABILITY,
        bridgeDeviceId,
      );
      return (await pending).data;
    }

    return this.sendBridgeControlRequest<MarketplaceLocalAppAgentApiSetupResponsePayload>(
      workspaceId,
      "marketplace.localAppAgentApiSetup",
      payload,
      ["marketplace.localAppAgentApiSetup.result"],
      ["marketplace.localAppAgentApiSetup.error"],
      timeoutMs,
      MARKETPLACE_LOCAL_APP_AGENT_API_SETUP_CAPABILITY,
      bridgeDeviceId,
    );
  }

  async callMarketplaceLocalCli(input: {
    workspaceId: string;
    appSlug: "obsidian" | "roam-research" | "logseq" | "local-wordpress-org";
    sourceHostId: string;
    sourceHostType: "hermes_bridge" | "openclaw_bridge" | "runtime_host";
    executable: "obsidian" | "roam" | "logseq" | "wp";
    argv: string[];
    timeoutMs: number;
    maxOutputBytes: number;
  }): Promise<MarketplaceLocalCliResponsePayload> {
    const sourceHostId = input.sourceHostId.trim();
    if (!sourceHostId) {
      throw new BadRequestException(
        "A source host is required for local CLI execution",
      );
    }
    const executableMatchesApp =
      (input.appSlug === "obsidian" && input.executable === "obsidian") ||
      (input.appSlug === "roam-research" && input.executable === "roam") ||
      (input.appSlug === "logseq" && input.executable === "logseq") ||
      (input.appSlug === "local-wordpress-org" && input.executable === "wp");
    if (
      !executableMatchesApp ||
      !Array.isArray(input.argv) ||
      input.argv.length < 2 ||
      input.argv.length > 20 ||
      input.argv.some(
        (argument) =>
          typeof argument !== "string" ||
          argument.length > 16_500 ||
          /[\u0000\r]/.test(argument),
      )
    ) {
      throw new BadRequestException("Invalid bounded Marketplace CLI request");
    }
    const hasHermesProxy =
      this.eventsGateway.hasHermesBridgeWorkspaceCapability(
        input.workspaceId,
        MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
        sourceHostId,
      );
    const hasBridgeProxy = this.eventsGateway.hasBridgeControlSubscribers(
      input.workspaceId,
      MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
      sourceHostId,
    );
    const sourceHostAvailable =
      input.sourceHostType === "openclaw_bridge"
        ? hasBridgeProxy
        : hasHermesProxy;
    if (!sourceHostAvailable) {
      throw new ServiceUnavailableException(
        "The selected source host does not advertise Marketplace local tool execution.",
      );
    }

    const requestId = randomUUID();
    const timeoutMs = Math.max(1_000, Math.min(20_000, input.timeoutMs));
    const maxOutputBytes = Math.max(
      1_024,
      Math.min(65_536, input.maxOutputBytes),
    );
    const payload: MarketplaceLocalCliRequestPayload = {
      type: "marketplace.localCliRequest",
      requestId,
      workspaceId: input.workspaceId,
      appSlug: input.appSlug,
      sourceHostId,
      sourceHostType: input.sourceHostType,
      executable: input.executable,
      argv: input.argv,
      timeoutMs,
      maxOutputBytes,
    };
    const command =
      input.appSlug === "obsidian"
        ? input.argv[1]
        : input.appSlug === "local-wordpress-org"
          ? input.argv.find((argument) => !argument.startsWith("--"))
          : input.argv[0];
    this.logger.log(
      JSON.stringify({
        event: "marketplace.local_cli.request",
        workspaceId: input.workspaceId,
        appSlug: input.appSlug,
        sourceHostId,
        sourceHostType: input.sourceHostType,
        command: command ?? null,
        argumentCount: input.argv.length,
        timeoutMs,
        maxOutputBytes,
        argumentValuesLogged: false,
      }),
    );

    try {
      if (
        input.sourceHostType === "hermes_bridge" ||
        input.sourceHostType === "runtime_host"
      ) {
        const pending =
          this.bridgeControlCoordinator.registerRequest<MarketplaceLocalCliResponsePayload>(
            requestId,
            [
              "marketplace.localCliRequest.result",
              "marketplace.localCliRequest.error",
            ],
            timeoutMs,
            {
              workspaceId: input.workspaceId,
              runtimeType: "hermes",
              targetBridgeDeviceId: sourceHostId,
            },
          );
        this.eventsGateway.emitToHermesBridgeWorkspace(
          input.workspaceId,
          "marketplace.localCliRequest",
          payload,
          MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
          sourceHostId,
        );
        return (await pending).data;
      }
      const { requestId: _requestId, ...bridgePayload } = payload;
      return await this.sendBridgeControlRequest<MarketplaceLocalCliResponsePayload>(
        input.workspaceId,
        "marketplace.localCliRequest",
        bridgePayload,
        ["marketplace.localCliRequest.result"],
        ["marketplace.localCliRequest.error"],
        timeoutMs,
        MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
        sourceHostId,
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "marketplace.local_cli.request_failed",
          workspaceId: input.workspaceId,
          appSlug: input.appSlug,
          sourceHostId,
          sourceHostType: input.sourceHostType,
          command: command ?? null,
          errorClass:
            error instanceof Error ? error.constructor.name : typeof error,
          argumentValuesLogged: false,
        }),
      );
      throw new ServiceUnavailableException(
        "The selected source host did not complete the bounded Marketplace CLI request.",
      );
    }
  }

  async callMarketplaceLocalApi(input: {
    workspaceId: string;
    appSlug: "anytype";
    sourceHostId: string;
    sourceHostType: "hermes_bridge" | "openclaw_bridge" | "runtime_host";
    runtime: "desktop" | "cli";
    bearerToken: string;
    apiVersion: "2025-11-08";
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    query: Record<string, unknown>;
    body: Record<string, unknown>;
    timeoutMs: number;
    maxResponseBytes: number;
  }): Promise<MarketplaceLocalAppAgentApiRequestResponsePayload> {
    const sourceHostId = input.sourceHostId.trim();
    if (
      !sourceHostId ||
      !/^\/v1\/(?:[A-Za-z0-9._~!$&'()*+,;=:@%/-]+)?$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("//") ||
      !input.bearerToken ||
      input.bearerToken.length > 4_096
    ) {
      throw new BadRequestException(
        "Invalid bounded Marketplace local API request",
      );
    }
    const bridgeDeviceId = sourceHostId;
    const isHermesHost =
      input.sourceHostType === "hermes_bridge" ||
      input.sourceHostType === "runtime_host";
    const hasHermesProxy =
      this.eventsGateway.hasHermesBridgeWorkspaceCapability(
        input.workspaceId,
        MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
        bridgeDeviceId,
      );
    const hasBridgeProxy = this.eventsGateway.hasBridgeControlSubscribers(
      input.workspaceId,
      MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
      bridgeDeviceId,
    );
    if (
      (isHermesHost && !hasHermesProxy) ||
      (input.sourceHostType === "openclaw_bridge" && !hasBridgeProxy)
    ) {
      throw new ServiceUnavailableException(
        "The selected source host does not advertise Marketplace local API execution.",
      );
    }

    const baseUrl =
      input.runtime === "desktop"
        ? "http://127.0.0.1:31009"
        : "http://127.0.0.1:31012";
    const requestId = randomUUID();
    const timeoutMs = Math.max(1_000, Math.min(30_000, input.timeoutMs));
    const maxResponseBytes = Math.max(
      1_024,
      Math.min(2_000_000, input.maxResponseBytes),
    );
    const payload: MarketplaceLocalAppAgentApiRequestPayload = {
      type: "marketplace.localAppAgentApiRequest",
      requestId,
      workspaceId: input.workspaceId,
      appSlug: input.appSlug,
      sourceHostId,
      bridgeDeviceId,
      sourceHostType: input.sourceHostType,
      baseUrl,
      endpoint: `${baseUrl}${input.path}`,
      method: input.method,
      path: input.path,
      query: input.query,
      body: input.body,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "anytype-version": input.apiVersion,
        "x-relay-max-response-bytes": String(maxResponseBytes),
      },
      credential: {
        type: "bearer",
        authorizationHeader: `Bearer ${input.bearerToken}`,
        tokenExposure: "bridge_only",
      },
      bridgeOnlyCredential: {
        type: "bearer",
        authorizationHeader: `Bearer ${input.bearerToken}`,
        tokenExposure: "bridge_only",
      },
      bridgeOnlyBearerCredential: {
        authorizationHeader: `Bearer ${input.bearerToken}`,
        tokenExposure: "bridge_only",
      },
      contractVersion: input.apiVersion,
      timeoutMs,
    };
    this.logger.log(
      JSON.stringify({
        event: "marketplace.local_api.request",
        workspaceId: input.workspaceId,
        appSlug: input.appSlug,
        sourceHostId,
        sourceHostType: input.sourceHostType,
        runtime: input.runtime,
        method: input.method,
        path: input.path,
        timeoutMs,
        maxResponseBytes,
        queryValuesLogged: false,
        bodyLogged: false,
        tokenExposure: "never_logged",
      }),
    );
    try {
      if (isHermesHost) {
        const pending =
          this.bridgeControlCoordinator.registerRequest<MarketplaceLocalAppAgentApiRequestResponsePayload>(
            requestId,
            [
              "marketplace.localAppAgentApiRequest.result",
              "marketplace.localAppAgentApiRequest.error",
            ],
            timeoutMs,
            {
              workspaceId: input.workspaceId,
              runtimeType: "hermes",
              targetBridgeDeviceId: bridgeDeviceId,
            },
          );
        this.eventsGateway.emitToHermesBridgeWorkspace(
          input.workspaceId,
          "marketplace.localAppAgentApiRequest",
          payload,
          MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
          bridgeDeviceId,
        );
        return (await pending).data;
      }
      const { requestId: _requestId, ...bridgePayload } = payload;
      return await this.sendBridgeControlRequest<MarketplaceLocalAppAgentApiRequestResponsePayload>(
        input.workspaceId,
        "marketplace.localAppAgentApiRequest",
        bridgePayload,
        ["marketplace.localAppAgentApiRequest.result"],
        ["marketplace.localAppAgentApiRequest.error"],
        timeoutMs,
        MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
        bridgeDeviceId,
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "marketplace.local_api.request_failed",
          workspaceId: input.workspaceId,
          appSlug: input.appSlug,
          sourceHostId,
          sourceHostType: input.sourceHostType,
          method: input.method,
          path: input.path,
          errorClass:
            error instanceof Error ? error.constructor.name : typeof error,
          tokenExposure: "never_logged",
        }),
      );
      throw new ServiceUnavailableException(
        "The selected source host did not complete the bounded Marketplace local API request.",
      );
    }
  }

  private async callLocalAppConnectorAgentApiViaSourceHost(input: {
    workspaceId: string;
    appSlug: string;
    linkedAppId?: string | null;
    sourceHostId?: string | null;
    sourceHostType?: string | null;
    connectionId: string;
    baseUrl: string;
    endpoint: URL;
    method: "GET" | "POST";
    normalizedPath: string;
    query: Record<string, unknown>;
    body: Record<string, unknown>;
    contractVersion: string;
    bearerToken: string;
    runtimeProfile?: LocalAppRuntimeProfile | null;
    runtimeRecoveryApprovalId?: string | null;
    agentId?: string | null;
    dispatchId?: string | null;
  }): Promise<LocalAppConnectorAgentApiCallResult> {
    const bridgeDeviceId = input.sourceHostId?.trim() || null;
    const isHermesHost =
      input.sourceHostType === "hermes_bridge" ||
      input.sourceHostType === "runtime_host";
    const hasHermesProxy =
      this.eventsGateway.hasHermesBridgeWorkspaceCapability(
        input.workspaceId,
        MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
        bridgeDeviceId,
      );
    const hasBridgeProxy = this.eventsGateway.hasBridgeControlSubscribers(
      input.workspaceId,
      MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
      bridgeDeviceId,
    );
    if (!hasHermesProxy && !hasBridgeProxy) {
      throw this.localAppConnectorAgentApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        "source_host_proxy_required",
        "LocalAppConnector Agent API is configured with a local host URL. ClawChat Railway cannot call user-local LocalAppConnector directly, and no source-host bridge currently advertises local Agent API request execution.",
        {
          executionMode: "source_host_proxy",
          capability: MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
          outboundTarget: this.redactEndpoint(input.endpoint),
          sourceHostId: bridgeDeviceId,
          sourceHostType: input.sourceHostType ?? null,
        },
      );
    }

    if (input.runtimeProfile?.autoStartAllowed) {
      await this.tryEnsureLocalAppRunning({
        workspaceId: input.workspaceId,
        appSlug: input.appSlug,
        linkedAppId: input.linkedAppId ?? null,
        sourceHostId: bridgeDeviceId,
        sourceHostType: input.sourceHostType ?? null,
        runtimeProfile: input.runtimeProfile,
        approvalId: input.runtimeRecoveryApprovalId ?? null,
        agentId: input.agentId ?? null,
        dispatchId: input.dispatchId ?? null,
        reason:
          "LocalAppConnector Agent API tool call is about to execute against a local app target.",
      });
    }

    const runtimeRecoveryApprovalId =
      input.runtimeRecoveryApprovalId?.trim() || null;

    const payload = {
      type: "marketplace.localAppAgentApiRequest" as const,
      workspaceId: input.workspaceId,
      appSlug: input.appSlug,
      linkedAppId: input.linkedAppId ?? null,
      sourceHostId: bridgeDeviceId,
      bridgeDeviceId,
      sourceHostType: input.sourceHostType ?? null,
      baseUrl: input.baseUrl,
      endpoint: this.redactEndpoint(input.endpoint),
      method: input.method,
      path: input.normalizedPath,
      query: input.query,
      body: input.body,
      headers: {
        "content-type": "application/json",
      },
      credential: {
        type: "bearer" as const,
        authorizationHeader: `Bearer ${input.bearerToken}`,
        tokenExposure: "bridge_only" as const,
      },
      bridgeOnlyCredential: {
        type: "bearer" as const,
        authorizationHeader: `Bearer ${input.bearerToken}`,
        tokenExposure: "bridge_only" as const,
      },
      bridgeOnlyBearerCredential: {
        authorizationHeader: `Bearer ${input.bearerToken}`,
        tokenExposure: "bridge_only" as const,
      },
      contractVersion: input.contractVersion,
      timeoutMs: 30_000,
      runtimeProfile: input.runtimeProfile ?? null,
      runtimeRecovery: input.runtimeProfile
        ? {
            action: "localApp.ensureRunning" as const,
            reason:
              "If this local app is unreachable, run runtime recovery before returning app-unreachable to the agent.",
            approvalRequired: input.runtimeProfile.autoStartAllowed === true,
            approvalId: runtimeRecoveryApprovalId,
            autoStartAllowed:
              input.runtimeProfile.autoStartAllowed === true &&
              Boolean(runtimeRecoveryApprovalId),
            hardStopConditions: input.runtimeProfile.hardStopConditions,
            bridgeActions: runtimeRecoveryApprovalId
              ? [
                  "localApp.getRuntimeStatus",
                  "localApp.ensureRunning",
                  "localApp.start",
                  "localApp.restart",
                ]
              : ["localApp.getRuntimeStatus"],
            disabledReason: runtimeRecoveryApprovalId
              ? null
              : "approval_required_for_runtime_recovery",
          }
        : undefined,
    };

    this.logger.log(
      JSON.stringify({
        event: "localappconnector.agent_api.source_host_request",
        workspaceId: input.workspaceId,
        connectionId: input.connectionId,
        appSlug: input.appSlug,
        linkedAppId: input.linkedAppId ?? null,
        method: input.method,
        path: input.normalizedPath,
        executionMode: "source_host_proxy",
        outboundTarget: this.redactEndpoint(input.endpoint),
        sourceHostId: bridgeDeviceId,
        sourceHostType: input.sourceHostType ?? null,
        capability: MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
        tokenExposure: "never_logged",
      }),
    );

    let response: MarketplaceLocalAppAgentApiRequestResponsePayload;
    try {
      if (isHermesHost && hasHermesProxy) {
        const requestId = randomUUID();
        const pending =
          this.bridgeControlCoordinator.registerRequest<MarketplaceLocalAppAgentApiRequestResponsePayload>(
            requestId,
            [
              "marketplace.localAppAgentApiRequest.result",
              "marketplace.localAppAgentApiRequest.error",
            ],
            30_000,
            {
              workspaceId: input.workspaceId,
              runtimeType: "hermes",
              targetBridgeDeviceId: bridgeDeviceId,
            },
          );
        this.eventsGateway.emitToHermesBridgeWorkspace(
          input.workspaceId,
          "marketplace.localAppAgentApiRequest",
          {
            requestId,
            ...payload,
          },
          MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
          bridgeDeviceId,
        );
        response = (await pending).data;
      } else {
        response =
          await this.sendBridgeControlRequest<MarketplaceLocalAppAgentApiRequestResponsePayload>(
            input.workspaceId,
            "marketplace.localAppAgentApiRequest",
            payload,
            ["marketplace.localAppAgentApiRequest.result"],
            ["marketplace.localAppAgentApiRequest.error"],
            30_000,
            MARKETPLACE_LOCAL_APP_AGENT_API_REQUEST_CAPABILITY,
            bridgeDeviceId,
          );
      }
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "localappconnector.agent_api.source_host_request_failed",
          workspaceId: input.workspaceId,
          connectionId: input.connectionId,
          appSlug: input.appSlug,
          linkedAppId: input.linkedAppId ?? null,
          executionMode: "source_host_proxy",
          outboundTarget: this.redactEndpoint(input.endpoint),
          sourceHostId: bridgeDeviceId,
          sourceHostType: input.sourceHostType ?? null,
          errorClass:
            error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: this.redactedErrorMessage(error),
          tokenExposure: "never_logged",
        }),
      );
      throw this.localAppConnectorAgentApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        "source_host_unavailable",
        "The configured source host did not complete the LocalAppConnector Agent API request.",
        {
          executionMode: "source_host_proxy",
          outboundTarget: this.redactEndpoint(input.endpoint),
          sourceHostId: bridgeDeviceId,
          sourceHostType: input.sourceHostType ?? null,
        },
      );
    }

    const httpStatus = Number(response.httpStatus ?? response.status);
    const data = response.data ?? response.body ?? null;
    if (response.status === "failed") {
      const code =
        typeof response.errorCode === "string"
          ? response.errorCode
          : "source_host_proxy_failed";
      throw this.localAppConnectorAgentApiError(
        HttpStatus.BAD_GATEWAY,
        code,
        response.error ||
          "The source host failed to execute the LocalAppConnector Agent API request.",
        {
          executionMode: "source_host_proxy",
          outboundTarget: this.redactEndpoint(input.endpoint),
          sourceHostId: bridgeDeviceId,
          sourceHostType: input.sourceHostType ?? null,
          diagnostics: response.diagnostics ?? null,
        },
      );
    }
    if (httpStatus === 401 || httpStatus === 403) {
      throw this.localAppConnectorAgentApiError(
        HttpStatus.UNAUTHORIZED,
        "localappconnector_auth_failed",
        "LocalAppConnector Agent API rejected the stored bearer key. Update the LocalAppConnector Agent API connection with a valid bearer key.",
        {
          status: httpStatus,
          executionMode: "source_host_proxy",
          outboundTarget: this.redactEndpoint(input.endpoint),
        },
      );
    }
    if (!Number.isFinite(httpStatus) || httpStatus < 200 || httpStatus >= 300) {
      throw this.localAppConnectorAgentApiError(
        HttpStatus.BAD_GATEWAY,
        "localappconnector_agent_api_error",
        `LocalAppConnector Agent API call failed with ${Number.isFinite(httpStatus) ? httpStatus : "unknown status"}.`,
        {
          status: Number.isFinite(httpStatus) ? httpStatus : null,
          executionMode: "source_host_proxy",
          outboundTarget: this.redactEndpoint(input.endpoint),
          response: data,
        },
      );
    }

    return {
      ok: true,
      status: httpStatus,
      endpoint: this.redactEndpoint(input.endpoint),
      data,
    };
  }

  private async tryEnsureLocalAppRunning(input: {
    workspaceId: string;
    appSlug: string;
    linkedAppId?: string | null;
    sourceHostId?: string | null;
    sourceHostType?: string | null;
    runtimeProfile: LocalAppRuntimeProfile;
    approvalId?: string | null;
    agentId?: string | null;
    dispatchId?: string | null;
    reason: string;
  }) {
    const bridgeDeviceId =
      input.sourceHostId?.trim() ||
      input.runtimeProfile.sourceHostId?.trim() ||
      null;
    const approvalId = input.approvalId?.trim() || null;
    if (!approvalId) {
      this.logger.log(
        JSON.stringify({
          event: "local_app.runtime_recovery.approval_required",
          workspaceId: input.workspaceId,
          appSlug: input.appSlug,
          linkedAppId: input.linkedAppId ?? null,
          sourceHostId: bridgeDeviceId,
          sourceHostType: input.sourceHostType ?? null,
          behavior: "ensure_running_disabled_without_approved_approval",
        }),
      );
      return null;
    }

    await this.assertLocalAppRuntimeActionApproved({
      action: "localApp.ensureRunning",
      workspaceId: input.workspaceId,
      appSlug: input.appSlug,
      linkedAppId: input.linkedAppId ?? null,
      sourceHostId: bridgeDeviceId,
      sourceHostType: input.sourceHostType ?? null,
      agentId: input.agentId ?? null,
      dispatchId: input.dispatchId ?? null,
      runtimeProfile: input.runtimeProfile,
      input: { approvalId },
    });

    const isHermesHost =
      input.sourceHostType === "hermes_bridge" ||
      input.sourceHostType === "runtime_host";
    const hasHermesRecovery =
      this.eventsGateway.hasHermesBridgeWorkspaceCapability(
        input.workspaceId,
        LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
        bridgeDeviceId,
      );
    const hasBridgeRecovery = this.eventsGateway.hasBridgeControlSubscribers(
      input.workspaceId,
      LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
      bridgeDeviceId,
    );

    if (!hasHermesRecovery && !hasBridgeRecovery) {
      this.logger.log(
        JSON.stringify({
          event: "local_app.runtime_recovery.not_advertised",
          workspaceId: input.workspaceId,
          appSlug: input.appSlug,
          linkedAppId: input.linkedAppId ?? null,
          sourceHostId: bridgeDeviceId,
          sourceHostType: input.sourceHostType ?? null,
          capability: LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
          behavior:
            "runtime_profile_embedded_for_hermes_or_source_host_auto_recovery",
        }),
      );
      return null;
    }

    const payload = {
      type: "localApp.ensureRunning" as const,
      workspaceId: input.workspaceId,
      appSlug: input.appSlug,
      linkedAppId: input.linkedAppId ?? null,
      sourceHostId: bridgeDeviceId,
      bridgeDeviceId,
      sourceHostType: input.sourceHostType ?? null,
      runtimeProfile: input.runtimeProfile,
      reason: input.reason,
      input: { approvalId },
    };

    this.logger.log(
      JSON.stringify({
        event: "local_app.runtime_recovery.ensure_running",
        workspaceId: input.workspaceId,
        appSlug: input.appSlug,
        linkedAppId: input.linkedAppId ?? null,
        sourceHostId: bridgeDeviceId,
        sourceHostType: input.sourceHostType ?? null,
        repoPath: input.runtimeProfile.repoPath,
        appUrl: input.runtimeProfile.appUrl,
        healthCheckUrl: input.runtimeProfile.healthCheckUrl,
        backendHealthCheckUrl: input.runtimeProfile.backendHealthCheckUrl,
        autoStartAllowed: input.runtimeProfile.autoStartAllowed,
        expectedPorts: input.runtimeProfile.expectedPorts,
      }),
    );

    try {
      if (isHermesHost && hasHermesRecovery) {
        const requestId = randomUUID();
        const pending =
          this.bridgeControlCoordinator.registerRequest<LocalAppRuntimeRecoveryResponsePayload>(
            requestId,
            ["localApp.ensureRunning.result", "localApp.ensureRunning.error"],
            45_000,
            {
              workspaceId: input.workspaceId,
              runtimeType: "hermes",
              targetBridgeDeviceId: bridgeDeviceId,
            },
          );
        this.eventsGateway.emitToHermesBridgeWorkspace(
          input.workspaceId,
          "localApp.ensureRunning",
          {
            requestId,
            ...payload,
          },
          LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
          bridgeDeviceId,
        );
        return (await pending).data;
      }
      return await this.sendBridgeControlRequest<LocalAppRuntimeRecoveryResponsePayload>(
        input.workspaceId,
        "localApp.ensureRunning",
        payload,
        ["localApp.ensureRunning.result"],
        ["localApp.ensureRunning.error"],
        45_000,
        LOCAL_APP_RUNTIME_RECOVERY_CAPABILITY,
        bridgeDeviceId,
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "local_app.runtime_recovery.ensure_running_failed",
          workspaceId: input.workspaceId,
          appSlug: input.appSlug,
          linkedAppId: input.linkedAppId ?? null,
          sourceHostId: bridgeDeviceId,
          sourceHostType: input.sourceHostType ?? null,
          errorClass:
            error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: this.redactedErrorMessage(error),
        }),
      );
      return null;
    }
  }

  async applyMarketplaceLocalRepoDocs(
    workspaceId: string,
    request: Omit<
      MarketplaceApplyLocalRepoDocsRequestPayload,
      "type" | "requestId" | "workspaceId"
    >,
    timeoutMs: number = 30_000,
  ): Promise<MarketplaceApplyLocalRepoDocsResponsePayload> {
    const bridgeDeviceId = request.bridgeDeviceId?.trim() || null;
    let selectedDevice: BridgeDeviceEntity | null = null;
    if (bridgeDeviceId) {
      selectedDevice = await this.bridgeDeviceRepo.findOne({
        where: { id: bridgeDeviceId, workspaceId },
      });
      if (
        !selectedDevice ||
        selectedDevice.status !== BridgeDeviceStatus.ACTIVE ||
        selectedDevice.revokedAt
      ) {
        throw new ServiceUnavailableException(
          "This repo path is on a runtime host that is not currently reachable. Select a connected OpenClaw/Hermes host or sync the repo to this machine.",
        );
      }
      if (
        !(selectedDevice.capabilities ?? []).includes(
          MARKETPLACE_LOCAL_REPO_DOCS_WRITE_CAPABILITY,
        )
      ) {
        throw new ServiceUnavailableException(
          `Selected runtime host does not advertise ${MARKETPLACE_LOCAL_REPO_DOCS_WRITE_CAPABILITY}. Update the source-host bridge before applying local repo docs proposals.`,
        );
      }
    }

    const payload = {
      type: "marketplace.applyLocalRepoDocs",
      workspaceId,
      sourceHostId: request.sourceHostId ?? bridgeDeviceId,
      bridgeDeviceId,
      sourceHostType: request.sourceHostType ?? null,
      runtimeType: request.runtimeType ?? null,
      repoPath: request.repoPath,
      docsSourcePath: request.docsSourcePath,
      files: request.files,
    };
    const selectedDeviceCapabilities = selectedDevice?.capabilities ?? [];
    const isHermesHost =
      request.sourceHostType === "hermes_bridge" ||
      request.runtimeType === "hermes" ||
      selectedDeviceCapabilities.includes("clawchat.runtime.hermes");
    if (isHermesHost) {
      if (
        !this.eventsGateway.hasHermesBridgeWorkspaceCapability(
          workspaceId,
          MARKETPLACE_LOCAL_REPO_DOCS_WRITE_CAPABILITY,
          bridgeDeviceId,
        )
      ) {
        throw new ServiceUnavailableException(
          "The selected Hermes runtime host is not currently reachable for local repo docs writes",
        );
      }
      const requestId = randomUUID();
      const pending =
        this.bridgeControlCoordinator.registerRequest<MarketplaceApplyLocalRepoDocsResponsePayload>(
          requestId,
          [
            "marketplace.applyLocalRepoDocs.result",
            "marketplace.applyLocalRepoDocs.error",
          ],
          timeoutMs,
          {
            workspaceId,
            runtimeType: "hermes",
            targetBridgeDeviceId: bridgeDeviceId,
          },
        );
      this.eventsGateway.emitToHermesBridgeWorkspace(
        workspaceId,
        "marketplace.applyLocalRepoDocs",
        {
          requestId,
          ...payload,
        },
        MARKETPLACE_LOCAL_REPO_DOCS_WRITE_CAPABILITY,
        bridgeDeviceId,
      );
      return (await pending).data;
    }

    return this.sendBridgeControlRequest<MarketplaceApplyLocalRepoDocsResponsePayload>(
      workspaceId,
      "marketplace.applyLocalRepoDocs",
      payload,
      ["marketplace.applyLocalRepoDocs.result"],
      ["marketplace.applyLocalRepoDocs.error"],
      timeoutMs,
      MARKETPLACE_LOCAL_REPO_DOCS_WRITE_CAPABILITY,
      bridgeDeviceId,
    );
  }

  private async requireHermesWorkspaceTarget(
    workspaceId: string,
    agentId: string,
    folder: HermesWorkspaceFolder,
    options?: { requireWritable?: boolean },
  ) {
    if (!["agent", "shared", "sessions", "project"].includes(folder)) {
      throw new BadRequestException("Unknown Hermes workspace folder");
    }
    if (options?.requireWritable && folder === "sessions") {
      throw new BadRequestException("Hermes session snapshots are read-only");
    }

    const lookupWhere: Array<Partial<AgentEntity>> = [
      { externalId: agentId, workspaceId },
    ];
    if (this.isUuid(agentId)) {
      lookupWhere.unshift({ id: agentId, workspaceId });
    }

    const agent = await this.agentRepo.findOne({
      where: lookupWhere as any,
      select: ["id", "workspaceId", "externalId", "source"],
    });
    if (!agent) {
      throw new NotFoundException("Hermes agent not found");
    }
    if (agent.source !== "hermes") {
      throw new BadRequestException("Agent is not a Hermes agent");
    }
    const externalAgentId = agent.externalId?.trim();
    if (!externalAgentId) {
      throw new BadRequestException("Hermes agent is missing externalId");
    }

    const binding = await this.runtimeBindingService.findByAgentId(agent.id);
    if (
      !binding ||
      binding.runtimeType !== "hermes" ||
      !["bridge", "hermes_bridge"].includes(
        binding.adapterKind?.trim().toLowerCase() ?? "",
      )
    ) {
      throw new BadRequestException(
        "Agent is not configured for Hermes bridge",
      );
    }
    if (folder === "project" && !binding.repoKey?.trim()) {
      throw new BadRequestException("Hermes project repoKey is not configured");
    }

    return { agent, binding, externalAgentId };
  }

  private normalizeHermesWorkspacePath(value?: string | null) {
    const raw = this.decodePathInput(
      value?.trim() || "/",
      "Hermes workspace path",
    );
    if (
      raw.includes("\\") ||
      raw.includes("\0") ||
      /^[a-zA-Z]:/.test(raw) ||
      !raw.startsWith("/")
    ) {
      throw new BadRequestException("Invalid Hermes workspace path");
    }
    const normalized = raw.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
    const segments = normalized.split("/").filter(Boolean);
    if (segments.some((segment) => segment === "." || segment === "..")) {
      throw new BadRequestException("Invalid Hermes workspace path");
    }
    return normalized;
  }

  private hermesPathToLibraryFolder(value?: string | null) {
    const normalized = this.normalizeHermesWorkspacePath(value);
    return normalized === "/" ? "" : normalized.replace(/^\/+/, "");
  }

  private joinHermesDisplayPath(basePath: string, name: string) {
    const base = this.normalizeHermesWorkspacePath(basePath);
    const joined = base === "/" ? `/${name}` : `${base}/${name}`;
    return this.hermesPathToLibraryFolder(joined);
  }

  private isUuid(value?: string | null) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value ?? "",
    );
  }

  private normalizeLibraryFolder(
    folder?: string | null,
    options: { requireNonEmpty?: boolean } = {},
  ): string {
    const raw = this.decodePathInput(folder ?? "", "folder").trim();
    if (!raw) {
      if (options.requireNonEmpty) {
        throw new BadRequestException("Folder is required");
      }
      return "";
    }
    if (
      raw.includes("\\") ||
      raw.includes("\0") ||
      raw.startsWith("/") ||
      /^[a-zA-Z]:/.test(raw)
    ) {
      throw new BadRequestException("Invalid folder path");
    }
    const normalized = raw.replace(/\/+/g, "/").replace(/\/$/, "");
    const segments = normalized.split("/").filter(Boolean);
    if (
      !segments.length ||
      segments.some((segment) => segment === "." || segment === "..")
    ) {
      throw new BadRequestException("Invalid folder path");
    }
    return segments.join("/");
  }

  private normalizeWorkspaceTextFilename(filename?: string | null) {
    const normalized = this.normalizeWorkspacePathSegment(filename, "filename");
    const lower = normalized.toLowerCase();
    if (!lower.endsWith(".md") && !lower.startsWith(".env")) {
      throw new BadRequestException("Enter a markdown or env filename");
    }
    return normalized;
  }

  private normalizeWorkspaceWritableFilename(filename?: string | null) {
    const normalized = this.normalizeWorkspacePathSegment(filename, "filename");
    const lower = normalized.toLowerCase();
    if (
      !lower.endsWith(".md") &&
      !lower.startsWith(".env") &&
      !lower.endsWith(".png")
    ) {
      throw new BadRequestException("Enter a markdown, env, or PNG filename");
    }
    return normalized;
  }

  private normalizeWorkspaceFilePayloads(files: BridgeLibraryFilePayload[]) {
    return files.map((file) => ({
      ...file,
      filename: this.normalizeWorkspaceWritableFilename(file.filename),
    }));
  }

  private normalizeWorkspacePathSegment(
    value: string | null | undefined,
    label: string,
  ) {
    const raw = this.decodePathInput(value ?? "", label).trim();
    if (
      !raw ||
      raw.includes("/") ||
      raw.includes("\\") ||
      raw.includes("\0") ||
      raw === "." ||
      raw === ".." ||
      raw.startsWith("/") ||
      /^[a-zA-Z]:/.test(raw)
    ) {
      throw new BadRequestException(`Invalid ${label}`);
    }
    return raw;
  }

  private decodePathInput(value: string, label: string) {
    let decoded = value;
    for (let index = 0; index < 3 && decoded.includes("%"); index += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        throw new BadRequestException(`Invalid ${label}`);
      }
    }
    return decoded;
  }

  async beginOpenClawAttachmentUpload(input: {
    threadId: string;
    userId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    kind: string;
    totalChunks: number;
  }) {
    const thread = await this.threadRepo.findOne({
      where: { id: input.threadId },
    });
    if (!thread) {
      throw new NotFoundException(`Thread ${input.threadId} not found`);
    }
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      input.userId,
    );
    this.validateAttachmentUploadInput(input);
    const target = await this.resolveAttachmentBridgeTarget(thread.id);
    if (
      target.runtimeType === HERMES_RUNTIME_TYPE &&
      !input.mimeType.toLowerCase().startsWith("image/")
    ) {
      throw new BadRequestException(
        "Hermes currently supports image attachments only.",
      );
    }

    const attachmentId = randomUUID();
    await this.sendBridgeControlRequest<{
      requestId: string;
      attachmentId: string;
    }>(
      thread.workspaceId,
      "clawchat.attachment.upload.init",
      {
        attachmentId,
        workspaceId: thread.workspaceId,
        threadId: thread.id,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        kind: input.kind,
        totalChunks: input.totalChunks,
        chunkSizeBytes: ATTACHMENT_CHUNK_SIZE_BYTES,
      },
      ["clawchat.attachment.upload.init.result"],
      ["clawchat.attachment.upload.error"],
      ATTACHMENT_UPLOAD_INIT_TIMEOUT_MS,
      ATTACHMENT_CAPABILITY,
      target.bridgeDeviceId,
      target.runtimeType,
    );

    return {
      attachmentId,
      chunkSizeBytes: ATTACHMENT_CHUNK_SIZE_BYTES,
      maxFileSizeBytes: MAX_ATTACHMENT_FILE_SIZE_BYTES,
      maxFilesPerMessage: MAX_ATTACHMENTS_PER_MESSAGE,
    };
  }

  async uploadOpenClawAttachmentChunk(input: {
    threadId: string;
    userId: string;
    attachmentId: string;
    chunkIndex: number;
    totalChunks: number;
    offsetBytes: number;
    chunkBase64: string;
  }) {
    const thread = await this.threadRepo.findOne({
      where: { id: input.threadId },
    });
    if (!thread) {
      throw new NotFoundException(`Thread ${input.threadId} not found`);
    }
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      input.userId,
    );
    const target = await this.resolveAttachmentBridgeTarget(thread.id);

    if (!input.attachmentId || !input.chunkBase64) {
      throw new BadRequestException(
        "Attachment chunk is missing required data",
      );
    }
    const chunkBytes = Buffer.byteLength(input.chunkBase64, "base64");
    if (chunkBytes <= 0 || chunkBytes > ATTACHMENT_CHUNK_SIZE_BYTES) {
      throw new BadRequestException("Attachment chunk size is invalid");
    }

    return this.sendBridgeControlRequest<{
      requestId: string;
      attachmentId: string;
      chunkIndex: number;
      receivedBytes: number;
    }>(
      thread.workspaceId,
      "clawchat.attachment.upload.chunk",
      {
        attachmentId: input.attachmentId,
        workspaceId: thread.workspaceId,
        threadId: thread.id,
        chunkIndex: input.chunkIndex,
        totalChunks: input.totalChunks,
        offsetBytes: input.offsetBytes,
        chunkBase64: input.chunkBase64,
      },
      ["clawchat.attachment.upload.chunk.result"],
      ["clawchat.attachment.upload.error"],
      ATTACHMENT_UPLOAD_CHUNK_TIMEOUT_MS,
      ATTACHMENT_CAPABILITY,
      target.bridgeDeviceId,
      target.runtimeType,
    );
  }

  async completeOpenClawAttachmentUpload(input: {
    threadId: string;
    userId: string;
    attachmentId: string;
  }): Promise<OpenClawAttachmentMetadata> {
    const thread = await this.threadRepo.findOne({
      where: { id: input.threadId },
    });
    if (!thread) {
      throw new NotFoundException(`Thread ${input.threadId} not found`);
    }
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      input.userId,
    );
    const target = await this.resolveAttachmentBridgeTarget(thread.id);

    const result = await this.sendBridgeControlRequest<
      OpenClawAttachmentMetadata & { requestId: string }
    >(
      thread.workspaceId,
      "clawchat.attachment.upload.complete",
      {
        attachmentId: input.attachmentId,
        workspaceId: thread.workspaceId,
        threadId: thread.id,
      },
      ["clawchat.attachment.upload.complete.result"],
      ["clawchat.attachment.upload.error"],
      ATTACHMENT_UPLOAD_COMPLETE_TIMEOUT_MS,
      ATTACHMENT_CAPABILITY,
      target.bridgeDeviceId,
      target.runtimeType,
    );

    const attachment: OpenClawAttachmentMetadata = {
      id: result.id ?? input.attachmentId,
      workspaceId: thread.workspaceId,
      threadId: thread.id,
      messageId: null,
      bridgeDeviceId: result.bridgeDeviceId,
      filename: result.filename,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      sha256: result.sha256,
      kind: result.kind,
      status: "uploaded",
      storage: "openclaw_local",
      localMediaRef: result.localMediaRef,
      createdAt: result.createdAt ?? new Date().toISOString(),
    };
    return {
      ...attachment,
      provenanceToken: signOpenClawAttachmentProvenance(attachment),
    };
  }

  async cancelOpenClawAttachmentUpload(input: {
    threadId: string;
    userId: string;
    attachmentId: string;
  }) {
    const thread = await this.threadRepo.findOne({
      where: { id: input.threadId },
    });
    if (!thread) {
      throw new NotFoundException(`Thread ${input.threadId} not found`);
    }
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      input.userId,
    );
    const target = await this.resolveAttachmentBridgeTarget(thread.id);
    await this.sendBridgeControlRequest<{
      requestId: string;
      attachmentId: string;
    }>(
      thread.workspaceId,
      "clawchat.attachment.upload.cancel",
      {
        attachmentId: input.attachmentId,
        workspaceId: thread.workspaceId,
        threadId: thread.id,
      },
      ["clawchat.attachment.upload.cancel.result"],
      ["clawchat.attachment.upload.error"],
      ATTACHMENT_UPLOAD_INIT_TIMEOUT_MS,
      ATTACHMENT_CAPABILITY,
      target.bridgeDeviceId,
      target.runtimeType,
    );
    return { success: true, attachmentId: input.attachmentId };
  }

  private async resolveAttachmentBridgeTarget(threadId: string): Promise<{
    runtimeType: "openclaw" | "hermes";
    bridgeDeviceId: string | null;
  }> {
    const agents =
      await this.threadMembershipService.listMemberAgents(threadId);
    const targets = new Map<
      string,
      { runtimeType: "openclaw" | "hermes"; bridgeDeviceId: string | null }
    >();

    for (const agent of agents) {
      const binding = await this.runtimeBindingService.findByAgentId(agent.id);
      if (
        !binding?.isEnabled ||
        (binding.runtimeType !== OPENCLAW_RUNTIME_TYPE &&
          binding.runtimeType !== HERMES_RUNTIME_TYPE)
      ) {
        continue;
      }
      const runtimeType = binding.runtimeType as "openclaw" | "hermes";
      const configuredBridgeDeviceId =
        typeof binding.configMetadata?.bridgeDeviceId === "string"
          ? binding.configMetadata.bridgeDeviceId.trim()
          : "";
      const externalAgentId =
        binding.runtimeExternalAgentId?.trim() ||
        agent.externalId?.trim() ||
        "";
      const liveBridgeDeviceId = externalAgentId
        ? this.eventsGateway.getBridgeDeviceIdForExternalAgent({
            workspaceId: agent.workspaceId,
            externalAgentId,
            runtimeType,
          })
        : null;
      const bridgeDeviceId =
        configuredBridgeDeviceId || liveBridgeDeviceId || null;
      targets.set(`${runtimeType}:${bridgeDeviceId ?? ""}`, {
        runtimeType,
        bridgeDeviceId,
      });
    }

    if (targets.size === 0) {
      return { runtimeType: OPENCLAW_RUNTIME_TYPE, bridgeDeviceId: null };
    }
    if (targets.size > 1) {
      throw new BadRequestException(
        "Attachments require thread agents to share one runtime host.",
      );
    }
    const target = [...targets.values()][0];
    if (target.runtimeType === HERMES_RUNTIME_TYPE && !target.bridgeDeviceId) {
      throw new ServiceUnavailableException(
        "The Hermes agent is missing its runtime host assignment.",
      );
    }
    return target;
  }

  private validateAttachmentUploadInput(input: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    kind: string;
    totalChunks: number;
  }) {
    if (!input.filename?.trim()) {
      throw new BadRequestException("Attachment filename is required");
    }
    if (input.sizeBytes > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        "Attachment exceeds the 100 MB file size limit",
      );
    }
    if (!ATTACHMENT_KIND_VALUES.has(input.kind)) {
      throw new BadRequestException("Attachment kind is not supported");
    }
    const mimeType = input.mimeType?.trim().toLowerCase();
    const allowedMime =
      ALLOWED_ATTACHMENT_MIME_PREFIXES.some((prefix) =>
        mimeType.startsWith(prefix),
      ) || ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType);
    if (!allowedMime) {
      throw new BadRequestException("Attachment MIME type is not supported");
    }
    if (
      input.totalChunks !==
      Math.ceil(input.sizeBytes / ATTACHMENT_CHUNK_SIZE_BYTES)
    ) {
      throw new BadRequestException("Attachment chunk count is invalid");
    }
  }

  // ─── Messages ────────────────────────────────────────────────────────────────

  async postBridgeMessage(
    threadId: string,
    workspaceId: string,
    content: string,
    senderId: string,
    embeddedCard?: object,
    senderName?: string,
    metadata?: Record<string, unknown>,
    options?: {
      preferredAgentId?: string | null;
    },
  ): Promise<MessageEntity> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    const preferredAgent = options?.preferredAgentId?.trim()
      ? await this.agentRepo.findOne({
          where: {
            id: options.preferredAgentId.trim(),
            workspaceId,
          } as any,
        })
      : null;
    const threadMemberAgents =
      await this.threadMembershipService.listMemberAgents(threadId);
    const singleThreadAgent =
      threadMemberAgents.length === 1 ? threadMemberAgents[0] : null;
    const fallbackAgent = preferredAgent ?? singleThreadAgent;

    const resolvedSender = await this.resolveBridgeSender({
      workspaceId,
      senderId,
      senderName,
      preferredAgent: fallbackAgent,
    });
    let resolvedSenderId = resolvedSender.id;
    let resolvedSenderName = resolvedSender.name;

    const isThreadMember = await this.threadMembershipService.isThreadMember(
      threadId,
      resolvedSenderId,
    );
    if (!isThreadMember && fallbackAgent) {
      const preferredIsMember =
        await this.threadMembershipService.isThreadMember(
          threadId,
          fallbackAgent.id,
        );
      if (!preferredIsMember) {
        const existingAgentIds =
          await this.threadMembershipService.listMemberIds(threadId);
        await this.threadMembershipService.syncMemberships(thread, [
          ...existingAgentIds,
          fallbackAgent.id,
        ]);
      }
      resolvedSenderId = fallbackAgent.id;
      resolvedSenderName = fallbackAgent.name;
    } else if (!isThreadMember) {
      throw new ForbiddenException(
        `Bridge sender ${senderId} is not a member of thread ${threadId}`,
      );
    }

    const preparedReply = prepareAgentReplyForStorage({
      rawContent: content,
      responsePresentation: resolvedSender.responsePresentation,
    });
    const saved = await this.messageService.injectMessage(
      threadId,
      {
        content: preparedReply.content,
        contentFormat: preparedReply.contentFormat,
        senderId: resolvedSenderId,
        senderName: resolvedSenderName,
        type: embeddedCard ? "embedded_card" : "text",
        embeddedCard,
        isFromUser: false,
        provenance: MessageProvenance.AGENT,
        metadata: {
          ...preparedReply.metadata,
          ...(metadata ?? {}),
          bridgeSenderId: senderId,
          traceType: "bridge_agent_message",
        },
      },
      { routeToAgents: false },
    );

    const allTeamAgents = threadMemberAgents;
    const stopIds = allTeamAgents.map((a) => a.id);
    if (stopIds.length) {
      this.eventsGateway.emitAgentTyping(threadId, stopIds, false);
    }

    // Agent-to-agent routing: when an agent posts, route the message to all other
    // agents in the thread so they can respond — unless maxAgentTurns is set and reached.
    let agentTurnLimitReached = false;
    if (thread.maxAgentTurns) {
      // Count consecutive agent messages since the last user message
      const recent = await this.messageRepo
        .createQueryBuilder("m")
        .where('m."threadId" = :threadId', { threadId })
        .andWhere('m."threadSessionId" = :threadSessionId', {
          threadSessionId: saved.threadSessionId,
        })
        .orderBy('m."createdAt"', "DESC")
        .take(thread.maxAgentTurns + 1)
        .getMany();
      const turnsSinceUser = recent.findIndex((m) => m.isFromUser);
      const agentTurnCount =
        turnsSinceUser === -1 ? recent.length : turnsSinceUser;
      agentTurnLimitReached = agentTurnCount >= thread.maxAgentTurns;
    }

    const recentMessages = await this.messageRepo
      .createQueryBuilder("m")
      .where('m."threadId" = :threadId', { threadId })
      .andWhere('m."threadSessionId" = :threadSessionId', {
        threadSessionId: saved.threadSessionId,
      })
      .andWhere("m.id != :newId", { newId: saved.id })
      .orderBy('m."createdAt"', "DESC")
      .take(20)
      .getMany();
    const chronologicalRecentMessages = recentMessages.reverse();
    const targetAgents = allTeamAgents.filter(
      (a) =>
        a.id !== resolvedSenderId &&
        (!this.isClaudeCodeAgent(a) ||
          this.isExplicitlyTargetedBridgeAgent(saved.content, a)),
    );
    if (targetAgents.length && !agentTurnLimitReached) {
      const outboundContext = await this.messageService.buildOutboundContext(
        threadId,
        saved,
      );
      const recentMessagesPayload = chronologicalRecentMessages.map(
        (message) => ({
          senderName: message.senderName,
          senderId: message.senderId,
          content: message.content,
          contentFormat:
            message.contentFormat ?? MESSAGE_CONTENT_FORMAT_MARKDOWN,
          timestamp: message.createdAt,
          isFromUser: message.isFromUser,
          provenance: message.provenance,
        }),
      );
      const runtimeBindings =
        await this.runtimeDispatchCoordinator.resolveEligibleBindings(
          targetAgents.map((agent) => agent.id),
        );
      const runtimeBindingByAgentId = new Map(
        runtimeBindings.map((binding) => [binding.agentId, binding]),
      );
      const runtimeTargetAgents = targetAgents.filter((agent) =>
        runtimeBindingByAgentId.has(agent.id),
      );
      const bridgeOnlyTargetAgents = targetAgents.filter(
        (agent) => !runtimeBindingByAgentId.has(agent.id),
      );

      for (const agent of runtimeTargetAgents) {
        const runtimeBinding = runtimeBindingByAgentId.get(agent.id);
        if (!runtimeBinding) continue;

        const runtimeThreadSession =
          await this.runtimeDispatchCoordinator.resolveRuntimeThreadSession({
            runtimeBinding,
            threadId,
            threadSessionId: saved.threadSessionId,
            agentId: agent.id,
          });
        const timeoutMs = this.resolveRuntimeTimeoutMs(runtimeBinding);
        const isBridgeBackedRuntime =
          runtimeBinding.capabilities?.bridgeBacked === true;
        const dispatch = await this.runtimeDispatchCoordinator.queueDispatch({
          workspaceId: thread.workspaceId,
          threadId,
          threadSessionId: saved.threadSessionId,
          messageId: saved.id,
          agentId: agent.id,
          runtimeBinding,
          runtimeThreadSession,
          timeoutAt: new Date(Date.now() + timeoutMs),
        });

        void this.runtimeDispatchCoordinator
          .executeDispatch({
            runtimeBinding,
            runtimeThreadSession,
            dispatch,
            agent,
            inputText: saved.content,
            recentMessages: this.shouldSendRuntimeRecentMessages(runtimeBinding)
              ? recentMessagesPayload
              : [],
            dispatchMetadata: {
              targetExternalId: this.resolveBridgeExternalId(agent),
              agentName: agent.name,
              senderId: resolvedSenderId,
              senderName: resolvedSenderName,
              userId: resolvedSenderId,
              isFromAgent: true,
              attachments: saved.attachments ?? [],
              ...buildRuntimeResponsePresentationContext(
                agent.responsePresentation,
              ),
              ...outboundContext,
            },
            timeoutMs,
            persistFinalReply: async (finalText, metadata) => {
              const prepared = prepareAgentReplyForStorage({
                rawContent: finalText,
                responsePresentation: agent.responsePresentation,
              });
              return this.messageService.injectMessage(
                threadId,
                {
                  senderId: agent.id,
                  senderName: agent.name,
                  senderAvatarUrl: agent.avatarUrl ?? null,
                  content: prepared.content,
                  contentFormat: prepared.contentFormat,
                  provenance: MessageProvenance.AGENT,
                  isFromUser: false,
                  metadata: {
                    runtimeType: runtimeBinding.runtimeType,
                    runtimeDispatchId: dispatch.id,
                    ...prepared.metadata,
                    ...(metadata ?? {}),
                  },
                },
                { routeToAgents: false },
              );
            },
            onSettled: isBridgeBackedRuntime
              ? undefined
              : async () => {
                  this.eventsGateway.emitAgentTyping(
                    threadId,
                    [agent.id],
                    false,
                  );
                },
          })
          .catch(() => {
            if (!isBridgeBackedRuntime) {
              this.eventsGateway.emitAgentTyping(threadId, [agent.id], false);
            }
          });
      }

      const bridgeOnlyTargets = bridgeOnlyTargetAgents.reduce<
        Array<{ externalId: string; responsePresentation?: string | null }>
      >((acc, a) => {
        const externalId = this.resolveBridgeExternalId(a);
        if (externalId) {
          acc.push({
            externalId,
            responsePresentation: a.responsePresentation,
          });
        }
        return acc;
      }, []);

      for (const group of this.groupBridgeTargetsByPresentation(
        bridgeOnlyTargets,
      )) {
        this.eventsGateway.emitToBridgeAgents(
          thread.workspaceId,
          group.externalIds,
          "agent.dispatch",
          {
            threadId,
            threadSessionId: saved.threadSessionId,
            messageId: saved.id,
            content: saved.content,
            contentFormat:
              saved.contentFormat ?? MESSAGE_CONTENT_FORMAT_MARKDOWN,
            userId: resolvedSenderId,
            senderName: resolvedSenderName,
            workspaceId: thread.workspaceId,
            isFromAgent: true,
            attachments: saved.attachments ?? [],
            recentMessages: recentMessagesPayload,
            ...buildRuntimeResponsePresentationContext(
              group.responsePresentation,
            ),
            ...outboundContext,
          },
        );
      }

      this.eventsGateway.emitAgentTyping(
        threadId,
        targetAgents.map((a) => a.id),
        true,
      );
    }

    return saved;
  }

  private async resolveBridgeSender(input: {
    workspaceId: string;
    senderId: string;
    senderName?: string;
    preferredAgent: AgentEntity | null;
  }): Promise<{
    id: string;
    name: string;
    responsePresentation?: string | null;
  }> {
    const { workspaceId, senderId, senderName, preferredAgent } = input;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        senderId,
      );
    const knownAgent = isUuid
      ? await this.agentRepo.findOne({
          where: { id: senderId, workspaceId } as any,
        })
      : null;
    if (knownAgent) {
      return {
        id: knownAgent.id,
        name: knownAgent.name,
        responsePresentation: knownAgent.responsePresentation,
      };
    }

    const byExternalId =
      (await this.agentRepo.findOne({
        where: [{ externalId: senderId, workspaceId } as any],
      })) ??
      (await this.agentRepo
        .createQueryBuilder("agent")
        .where("agent.workspaceId = :workspaceId", { workspaceId })
        .andWhere("agent.description LIKE :pattern", {
          pattern: `%External ID: ${senderId}`,
        })
        .getOne());

    if (byExternalId) {
      return {
        id: byExternalId.id,
        name: byExternalId.name,
        responsePresentation: byExternalId.responsePresentation,
      };
    }

    if (preferredAgent) {
      return {
        id: preferredAgent.id,
        name: preferredAgent.name,
        responsePresentation: preferredAgent.responsePresentation,
      };
    }

    throw new ForbiddenException(
      `Unknown bridge sender: ${senderName || senderId}`,
    );
  }

  private groupBridgeTargetsByPresentation<
    T extends { externalId: string; responsePresentation?: string | null },
  >(targets: T[]) {
    const groups = new Map<
      string,
      { responsePresentation: string; externalIds: string[] }
    >();
    for (const target of targets) {
      const key =
        target.responsePresentation === "html_native"
          ? "html_native"
          : "standard";
      const group = groups.get(key) ?? {
        responsePresentation: key,
        externalIds: [],
      };
      group.externalIds.push(target.externalId);
      groups.set(key, group);
    }
    return Array.from(groups.values());
  }

  private resolveRuntimeTimeoutMs(binding: {
    configMetadata?: Record<string, unknown>;
  }): number {
    const configuredTimeout =
      typeof binding.configMetadata?.timeoutMs === "number"
        ? binding.configMetadata.timeoutMs
        : null;
    return configuredTimeout && configuredTimeout > 0
      ? configuredTimeout
      : DEFAULT_RUNTIME_TIMEOUT_MS;
  }

  private shouldSendRuntimeRecentMessages(binding: {
    runtimeType?: string | null;
    adapterKind?: string | null;
    capabilities?: Record<string, unknown> | null;
    configMetadata?: Record<string, unknown> | null;
  }) {
    if (!this.isHermesBridgeRuntimeBinding(binding)) {
      return true;
    }
    return binding.configMetadata?.sendRecentMessagesToHermesBridge === true;
  }

  private isHermesBridgeRuntimeBinding(binding: {
    runtimeType?: string | null;
    adapterKind?: string | null;
    capabilities?: Record<string, unknown> | null;
  }) {
    if (binding.runtimeType !== HERMES_RUNTIME_TYPE) {
      return false;
    }
    const adapterKind = binding.adapterKind?.trim().toLowerCase();
    return (
      adapterKind === HERMES_ADAPTER_KIND ||
      adapterKind === "bridge" ||
      binding.capabilities?.bridgeBacked === true
    );
  }

  async assertBridgeDeviceExternalAgentBinding(input: {
    workspaceId: string;
    bridgeDeviceId: string;
    externalAgentId?: string | null;
    runtimeType?: string | null;
  }) {
    const workspaceId = input.workspaceId?.trim();
    const bridgeDeviceId = input.bridgeDeviceId?.trim();
    const externalAgentId = input.externalAgentId?.trim();
    if (!workspaceId || !bridgeDeviceId || !externalAgentId) {
      throw new ForbiddenException(
        "Bridge device is not authorized for this external agent",
      );
    }

    const authorized =
      this.eventsGateway.isBridgeDeviceRegisteredForExternalAgent({
        workspaceId,
        bridgeDeviceId,
        externalAgentId,
        runtimeType: input.runtimeType,
      });
    if (!authorized) {
      throw new ForbiddenException(
        "Bridge device is not authorized for this external agent",
      );
    }
  }

  async assertBridgeDeviceRuntimeDispatchBinding(input: {
    workspaceId: string;
    bridgeDeviceId: string;
    bridgeRuntimeType: string;
    dispatch: {
      id: string;
      workspaceId: string;
      agentId: string;
      runtimeBindingId: string;
      runtimeHostId?: string | null;
      assignmentEpoch?: string | number;
    };
    runtimeBinding: {
      id: string;
      workspaceId: string;
      agentId: string;
      runtimeType: string;
      runtimeHostId?: string | null;
      assignmentEpoch?: string | number;
      adapterKind?: string | null;
      capabilities?: Record<string, unknown> | null;
    } | null;
  }) {
    await this.assertWorkspaceScope(
      input.workspaceId,
      input.dispatch.workspaceId,
    );

    const { runtimeBinding } = input;
    if (!runtimeBinding) {
      throw new ForbiddenException(
        "Runtime dispatch is not bound to an authorized bridge runtime",
      );
    }
    await this.assertWorkspaceScope(
      input.workspaceId,
      runtimeBinding.workspaceId,
    );
    if (
      runtimeBinding.id !== input.dispatch.runtimeBindingId ||
      runtimeBinding.agentId !== input.dispatch.agentId ||
      !this.isBridgeBackedRuntimeBinding(runtimeBinding)
    ) {
      throw new ForbiddenException(
        "Runtime dispatch is not bound to an authorized bridge runtime",
      );
    }
    if (
      !input.bridgeRuntimeType ||
      input.bridgeRuntimeType.trim().toLowerCase() !==
        runtimeBinding.runtimeType.trim().toLowerCase()
    ) {
      throw new ForbiddenException(
        "Bridge device runtime does not own this dispatch",
      );
    }
    if (
      input.dispatch.runtimeHostId &&
      runtimeBinding.runtimeHostId !== input.dispatch.runtimeHostId
    ) {
      throw new ForbiddenException("Runtime dispatch ownership has changed");
    }
    if (
      String(input.dispatch.assignmentEpoch ?? "1") !==
      String(runtimeBinding.assignmentEpoch ?? "1")
    ) {
      throw new ForbiddenException(
        "Runtime dispatch assignment epoch is stale",
      );
    }

    const agent = await this.agentRepo.findOne({
      where: {
        id: input.dispatch.agentId,
        workspaceId: input.workspaceId,
      } as any,
    });
    const externalAgentId = agent ? this.resolveBridgeExternalId(agent) : null;
    await this.assertBridgeDeviceExternalAgentBinding({
      workspaceId: input.workspaceId,
      bridgeDeviceId: input.bridgeDeviceId,
      externalAgentId,
      runtimeType: runtimeBinding.runtimeType,
    });
  }

  private isBridgeBackedRuntimeBinding(binding: {
    runtimeType?: string | null;
    adapterKind?: string | null;
    capabilities?: Record<string, unknown> | null;
  }) {
    const runtimeType = binding.runtimeType?.trim().toLowerCase();
    return (
      runtimeType === OPENCLAW_RUNTIME_TYPE ||
      this.isHermesBridgeRuntimeBinding(binding) ||
      binding.capabilities?.bridgeBacked === true
    );
  }

  private resolveBridgeExternalId(agent: {
    externalId?: string | null;
    description?: string | null;
  }): string | null {
    if (agent.externalId) {
      return agent.externalId;
    }
    const match = agent.description?.match(/External ID:\s*(\S+)/);
    return match?.[1] ?? null;
  }

  // ─── Tasks ───────────────────────────────────────────────────────────────────

  async createOrUpdateTaskFromBridge(
    workspaceId: string,
    payload: BridgeTaskPayload,
  ): Promise<TaskEntity> {
    await this.assertWorkspaceScope(workspaceId, payload.workspaceId);

    // Resolve agent internal ID
    const agentId = await this.getAgentIdMapping(
      payload.externalAgentId,
      workspaceId,
    );
    const taskKey = this.buildExternalCacheKey(workspaceId, payload.externalId);

    if (taskKey && this.taskExternalToInternal.has(taskKey)) {
      const internalId = this.taskExternalToInternal.get(taskKey)!;
      await this.taskRepo.update({ id: internalId, workspaceId } as any, {
        title: payload.title,
        description: payload.description || payload.title,
        assignedAgentId: agentId,
        status: payload.status,
        completedAt: payload.completedAt
          ? new Date(payload.completedAt)
          : undefined,
        budgetUsed: payload.cost || 0,
      });
      const updated = await this.taskRepo.findOne({
        where: { id: internalId, workspaceId } as any,
      });
      if (updated) {
        return updated;
      }
      this.taskExternalToInternal.delete(taskKey);
    }

    const task = this.taskRepo.create({
      title: payload.title,
      description: payload.description || payload.title,
      status: payload.status,
      workspaceId,
      assignedAgentId: agentId,
      completedAt: payload.completedAt
        ? new Date(payload.completedAt)
        : undefined,
      budgetUsed: payload.cost || 0,
    });
    const saved = await this.taskRepo.save(task);
    if (taskKey) {
      this.taskExternalToInternal.set(taskKey, saved.id);
    }
    return saved;
  }

  async createRunRecord(taskId: string, agentId: string): Promise<RunEntity> {
    const run = this.runRepo.create({
      taskId,
      agentId,
      status: "running",
      startedAt: new Date(),
    });
    const saved = await this.runRepo.save(run);
    await this.taskRepo.update(taskId, {
      status: "running",
      runCount: () => '"runCount" + 1',
      lastRunAt: new Date(),
      lastError: null,
    });
    return saved;
  }

  async addRunEvent(
    runId: string,
    type: string,
    content: string,
  ): Promise<RunEventEntity> {
    const event = this.runEventRepo.create({
      runId,
      type,
      content,
      timestamp: new Date(),
    });
    const saved = await this.runEventRepo.save(event);
    await this.runRepo.increment({ id: runId }, "eventsCount", 1);
    return saved;
  }

  async completeRun(
    runId: string,
    status: string,
    error?: string,
  ): Promise<void> {
    const run = await this.runRepo.findOne({ where: { id: runId } });
    await this.runRepo.update(runId, {
      status,
      completedAt: new Date(),
      errorMessage: error,
    });
    if (run?.taskId) {
      await this.taskRepo.update(run.taskId, {
        status: status === "success" ? "completed" : "failed",
        completedAt: new Date(),
        lastError: error ?? null,
      });
    }
  }

  // ─── Work Logs ───────────────────────────────────────────────────────────────

  async removeAgentFromThread(
    threadId: string,
    agentId: string,
  ): Promise<{ threadId: string; agentIds: string[] }> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new Error(`Thread ${threadId} not found`);
    const existing = await this.threadMembershipService.listMemberIds(threadId);
    const updated = existing.filter((id) => id !== agentId);
    const final = await this.threadMembershipService.syncMemberships(
      thread,
      updated,
    );
    return { threadId, agentIds: final };
  }

  async resetThreadAgentIds(
    threadId: string,
    agentIds: string[] | null,
  ): Promise<{ threadId: string; agentIds: string[] }> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new Error(`Thread ${threadId} not found`);
    const normalizedAgentIds =
      await this.threadMembershipService.syncMemberships(thread, agentIds);
    return { threadId, agentIds: normalizedAgentIds };
  }

  async fixAgentDescription(
    agentId: string,
    description: string,
  ): Promise<{ id: string; description: string }> {
    await this.agentRepo.query(
      `UPDATE agents SET description = $1 WHERE id = $2`,
      [description, agentId],
    );
    this.agentExternalToInternal.forEach((internalId, externalId) => {
      if (internalId === agentId)
        this.agentExternalToInternal.delete(externalId);
    });
    return { id: agentId, description };
  }

  async addWorkLog(
    agentId: string,
    action: string,
    details: string,
    taskId?: string,
    runId?: string,
  ): Promise<WorkLogEntity> {
    const log = this.workLogRepo.create({
      agentId,
      taskId,
      runId,
      action,
      details,
      timestamp: new Date(),
    });
    return this.workLogRepo.save(log);
  }

  async assertWorkspaceScope(
    expectedWorkspaceId: string,
    actualWorkspaceId: string,
  ) {
    if (expectedWorkspaceId !== actualWorkspaceId) {
      await this.auditLogService.record({
        actorType: "bridge_device",
        actorId: null,
        workspaceId: expectedWorkspaceId,
        eventType: "security.cross_workspace_access.denied",
        metadata: {
          expectedWorkspaceId,
          actualWorkspaceId,
        },
      });
      throw new ForbiddenException(
        "Bridge device is not authorized for this workspace",
      );
    }
  }

  async assertThreadInWorkspace(threadId: string, workspaceId: string) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }
    await this.assertWorkspaceScope(workspaceId, thread.workspaceId);
    return thread;
  }

  async assertConnectionInWorkspace(connectionId: string, workspaceId: string) {
    const connection = await this.connectionRepo.findOne({
      where: { id: connectionId },
    });
    if (!connection) {
      throw new NotFoundException(`Connection ${connectionId} not found`);
    }
    await this.assertWorkspaceScope(workspaceId, connection.workspaceId);
    return connection;
  }

  async assertAgentInWorkspace(agentId: string, workspaceId: string) {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }
    await this.assertWorkspaceScope(workspaceId, agent.workspaceId);
    return agent;
  }

  async assertTaskAndAgentInWorkspace(
    taskId: string,
    agentId: string,
    workspaceId: string,
  ) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }
    await this.assertWorkspaceScope(workspaceId, task.workspaceId);
    await this.assertAgentInWorkspace(agentId, workspaceId);
    return task;
  }

  async assertRunInWorkspace(runId: string, workspaceId: string) {
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }
    if (run.taskId) {
      const task = await this.taskRepo.findOne({ where: { id: run.taskId } });
      if (!task) {
        throw new NotFoundException(`Task ${run.taskId} not found`);
      }
      await this.assertWorkspaceScope(workspaceId, task.workspaceId);
    }
    return run;
  }

  async assertProvisioningJobInWorkspace(jobId: string, workspaceId: string) {
    const job = await this.provisioningJobRepo.findOne({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException(`Provisioning job ${jobId} not found`);
    }
    await this.assertWorkspaceScope(workspaceId, job.workspaceId);
    return job;
  }

  private normalizeAgentStatus(status?: string): string {
    switch ((status || "").trim().toLowerCase()) {
      case "active":
      case "online":
      case "available":
      case "on_duty":
        return "on_duty";
      case "offline":
      case "off_duty":
        return "off_duty";
      case "busy":
      case "paused":
      case "idle":
      case "error":
        return status!.trim().toLowerCase();
      default:
        return "idle";
    }
  }

  private buildAgentDescription(
    description: string | undefined,
    externalId: string,
    isBridgeAgent: boolean,
  ): string {
    const cleanedDescription = (description || "")
      .replace(/\s*External ID:\s*\S+\s*$/i, "")
      .trim()
      .replace(/\.\s*$/, "");

    const prefix = isBridgeAgent ? "[Bridge] " : "";
    const body = cleanedDescription
      ? `${prefix}${cleanedDescription}.`
      : prefix.trim();
    return `${body.trim()} External ID: ${externalId}`.trim();
  }

  private async findActiveEnrollmentByCode(code: string) {
    const codeHash = this.bridgeCredentials.hashOpaqueSecret(
      code.trim().toUpperCase(),
    );
    const enrollment = await this.bridgeEnrollmentRepo.findOne({
      where: {
        codeHash,
        status: BridgeEnrollmentStatus.ACTIVE,
      },
      select: [
        "id",
        "workspaceId",
        "createdByUserId",
        "codeHash",
        "deviceLabel",
        "status",
        "expiresAt",
        "usedAt",
      ],
    });

    if (!enrollment) {
      return null;
    }

    if (enrollment.expiresAt.getTime() <= Date.now()) {
      enrollment.status = BridgeEnrollmentStatus.EXPIRED;
      await this.bridgeEnrollmentRepo.save(enrollment);
      return null;
    }

    return enrollment;
  }

  private issueBridgeTokens(device: {
    id: string;
    workspaceId: string;
    devicePublicId: string;
    credentialVersion?: number;
  }) {
    return this.bridgeCredentials.issueTokens(device);
  }

  private async rotateBridgeCredentialAndIssueTokens(
    device: BridgeDeviceEntity,
    metadata: BridgeDeviceMetadata,
    compatibility: {
      runtimeType: string | null;
      hostType: string | null;
      enabledCapabilities: string[];
    },
    eventType:
      | "bridge.device.auth.success"
      | "bridge.device.credential_rotated",
    requestContext?: AuditLogRequestContext,
  ) {
    const result = await this.bridgeCredentials.rotateAndIssueTokens(
      device,
      { ...metadata, capabilities: compatibility.enabledCapabilities },
      compatibility,
      eventType,
      requestContext,
    );
    return { ...result, device: this.serializeBridgeDevice(result.device) };
  }

  private assertStableBridgeIdentity(
    device: BridgeDeviceEntity,
    compatibility: {
      runtimeType: string | null;
      hostType: string | null;
    },
  ) {
    this.bridgeCredentials.assertStableIdentity(device, compatibility);
  }

  private rejectReplayedBridgeCredential(
    device: Pick<
      BridgeDeviceEntity,
      "id" | "devicePublicId" | "workspaceId" | "status" | "revokedAt"
    >,
    requestContext?: AuditLogRequestContext,
  ): Promise<never> {
    return this.bridgeCredentials.rejectReplay(device, requestContext);
  }

  private serializeBridgeDevice(
    device: BridgeDeviceEntity,
    connectedDeviceIds?: Set<string>,
  ) {
    const compatibility = evaluateBridgeCompatibility({
      runtimeType: device.runtimeType,
      hostType: device.hostType,
      pluginVersion: device.pluginVersion,
      runtimeVersion: device.openCoreVersion,
      apiContractVersion: BRIDGE_API_CONTRACT,
      websocketContractVersion: BRIDGE_WEBSOCKET_CONTRACT,
      capabilities: device.capabilities ?? [],
    });
    const health =
      device.status === BridgeDeviceStatus.REVOKED || device.revokedAt
        ? "revoked"
        : connectedDeviceIds?.has(device.id)
          ? "online"
          : "offline";
    return {
      id: device.id,
      workspaceId: device.workspaceId,
      label: device.label,
      devicePublicId: device.devicePublicId,
      status: device.status,
      capabilities: device.capabilities ?? [],
      openCoreVersion: device.openCoreVersion ?? null,
      pluginVersion: device.pluginVersion ?? null,
      runtimeType: device.runtimeType ?? null,
      hostType: device.hostType ?? null,
      health,
      compatibility: {
        compatible: compatibility.compatible,
        code: compatibility.code,
        release: compatibility.release,
        releaseStatus: compatibility.releaseStatus,
        level: compatibility.level,
        operatingMode: compatibility.operatingMode,
        verifiedRuntime: compatibility.verifiedRuntime,
        enabledCapabilities: compatibility.enabledCapabilities,
        disabledCapabilities: compatibility.disabledCapabilities,
        warnings: compatibility.warnings,
        runtimePolicy: compatibility.runtimePolicy,
      },
      credentialVersion: device.credentialVersion ?? 1,
      credentialRotatedAt: device.credentialRotatedAt ?? null,
      lastSeenAt: device.lastSeenAt ?? null,
      revokedAt: device.revokedAt ?? null,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }

  private assertBridgeCompatibility(input: BridgeDeviceMetadata) {
    const compatibility = evaluateBridgeCompatibility({
      runtimeType: input.runtimeType,
      hostType: input.hostType,
      pluginVersion: input.pluginVersion,
      runtimeVersion: input.openCoreVersion,
      apiContractVersion: input.apiContractVersion,
      websocketContractVersion: input.websocketContractVersion,
      capabilities: input.capabilities,
    });
    if (!compatibility.compatible) {
      throw new HttpException(
        {
          statusCode: BRIDGE_UPGRADE_REQUIRED_STATUS,
          code: compatibility.code,
          message:
            "Bridge, runtime, host, or protocol version is not supported by this Relay release",
          compatibility,
        },
        BRIDGE_UPGRADE_REQUIRED_STATUS,
      );
    }
    if (
      !Array.isArray(input.capabilities) ||
      !input.capabilities.includes(BRIDGE_ROTATING_CREDENTIAL_CAPABILITY)
    ) {
      throw new HttpException(
        {
          statusCode: BRIDGE_UPGRADE_REQUIRED_STATUS,
          code: "BRIDGE_ROTATING_CREDENTIALS_REQUIRED",
          message:
            "Upgrade the bridge runtime to a build that durably rotates device credentials.",
          compatibility,
        },
        BRIDGE_UPGRADE_REQUIRED_STATUS,
      );
    }
    return compatibility;
  }

  checkCompatibility(input: BridgeDeviceMetadata) {
    return evaluateBridgeCompatibility({
      runtimeType: input.runtimeType,
      hostType: input.hostType,
      pluginVersion: input.pluginVersion,
      runtimeVersion: input.openCoreVersion,
      apiContractVersion: input.apiContractVersion,
      websocketContractVersion: input.websocketContractVersion,
      capabilities: input.capabilities,
    });
  }

  private isClaudeCodeAgent(agent?: Pick<AgentEntity, "source"> | null) {
    return agent?.source === "claude_code";
  }

  private isExplicitlyTargetedBridgeAgent(
    content: string,
    agent: Pick<AgentEntity, "name" | "externalId">,
  ) {
    const tokens = Array.from(content.matchAll(/@([A-Za-z0-9._/-]+)/g)).map(
      (match) => match[1].trim().toLowerCase(),
    );
    if (!tokens.length) return false;
    const normalizedName = agent.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const candidates = new Set(
      [agent.externalId, agent.name, normalizedName]
        .filter(Boolean)
        .map((value) => value!.trim().toLowerCase()),
    );
    return tokens.some((token) => candidates.has(token));
  }

  private hasAgentExternalMapping(
    agent: Pick<AgentEntity, "externalId" | "description">,
  ) {
    if (agent.externalId?.trim()) {
      return true;
    }

    return /External ID:\s*\S+/i.test(agent.description ?? "");
  }

  private generateBridgeCode() {
    return randomBytes(6).toString("hex").toUpperCase();
  }

  private normalizeBridgeCapabilities(capabilities: unknown) {
    return normalizeServerAuthorizedBridgeCapabilities(capabilities);
  }
}
