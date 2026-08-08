import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Repository } from "typeorm";
import {
  AgentEntity,
  AgentDocumentationInstallEntity,
  AgentDocumentationVersionEntity,
  ApplicationDocumentationPackEntity,
  ApplicationDocumentationVersionEntity,
  DocumentationGenerationProposalEntity,
  DocumentationProposalFileEntity,
  LinkedApplicationEntity,
  MarketplaceConnectionEntity,
  MarketplaceGeneratedPackEntity,
  MarketplaceInstallEntity,
  MarketplacePackGenerationJobEntity,
  MarketplacePackQualityScoreEntity,
  MarketplacePackReviewEntity,
  MarketplacePackSourceEntity,
  ScheduledThreadMessageEntity,
  ThreadEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
  WorkspaceMemberRole,
} from "../../entities";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  AGENT_DOCS_COMPILER_VERSION,
  AGENT_DOCS_PACK_PATH,
} from "../agent-documentation/agent-documentation.constants";
import {
  sha256,
  slugify,
} from "../agent-documentation/agent-documentation.utils";
import { AgentDocumentationInstallService } from "../agent-documentation/services/agent-documentation-install.service";
import { DocumentationPackSyncService } from "../agent-documentation/services/documentation-pack-sync.service";
import { AgentService } from "../agent/agent.service";
import {
  BridgeService,
  MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
  MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY,
  MARKETPLACE_LOCAL_REPO_DOCS_WRITE_CAPABILITY,
  MARKETPLACE_LOCAL_APP_AGENT_API_SETUP_CAPABILITY,
  type MarketplaceReadLocalRepoDocsResponsePayload,
  type MarketplaceHermesSkillInstallRequestPayload,
  type MarketplaceHermesSkillInstallResponsePayload,
  type MarketplaceLocalAppAgentApiSetupResponsePayload,
  type MarketplaceLocalAppCampaignPayload,
} from "../bridge/bridge.service";
import { EncryptionService } from "../security/encryption.service";
import { RuntimeBindingService } from "../runtime/runtime-binding.service";
import {
  MARKETPLACE_CATALOG,
  MARKETPLACE_CATEGORY_LABELS,
} from "./catalog/marketplace-catalog";
import { type MarketplaceAppDefinition } from "./catalog/marketplace-catalog.types";
import { canonicalMarketplaceProviderSlug } from "./catalog/marketplace-provider-aliases";
import {
  compileGithubHermesPack,
  compileGithubOpenClawPack,
} from "./packs/github/github.pack";
import {
  compileStripeHermesPack,
  compileStripeOpenClawPack,
} from "./packs/stripe/stripe.pack";
import {
  compileCanonicalHermesPack,
  compileCanonicalOpenClawPack,
} from "./packs/canonical-pack";
import {
  compileGeneratedMarketplacePack,
  generateDraftPackForApp,
} from "./pack-factory/generated-pack-compiler";
import { generateMarketplacePackCoverageReport } from "./pack-factory/batch-generate";
import { generateDraftPackFromConfig } from "./pack-factory/generator";
import { evaluateGeneratedPackReviewGate } from "./pack-factory/review-gate";
import { buildPackFactoryConfigFromApp } from "./pack-factory/source-model";
import { importDocsSources } from "./pack-factory/docs-source-importer";
import { importOpenApiSource } from "./pack-factory/openapi-importer";
import {
  type MarketplaceExtractedSourceModel,
  type MarketplaceGeneratedPack,
  type MarketplacePackFactoryConfig,
  type MarketplacePackSource,
} from "./pack-factory/types";
import {
  ConfigureLocalAppConnectorOpenClawDto,
  AutoConnectLocalAppDto,
  CreateMarketplaceConnectionDto,
  CreateLocalMarketplaceAppDto,
  ImportMarketplacePackSourcesDto,
  InstallMarketplaceAppDto,
  PreviewMarketplacePackDto,
  UpdateLocalMarketplaceAppDto,
  ApplyLocalRepoDocsProposalDto,
  UpdateMarketplacePackSourcesDto,
  UpdateMarketplaceConnectionDto,
  UpdateMarketplaceInstallDto,
} from "./dto/marketplace.dto";
import { type MarketplaceInstallRole } from "./marketplace-install-role";
import { ScheduledMessageStatus } from "../../entities/scheduled-thread-message.entity";
import {
  findMarketplaceRole,
  normalizeMarketplaceRoleManifest,
  roleManifestForApp,
  type MarketplaceRoleManifest,
} from "./role-manifest";
import {
  defaultLocalAppAutonomyPolicy,
  hasBlanketNoExternalConflict,
  localAppAutonomySelectedCapabilities,
  normalizeLocalAppAutonomyPolicy,
  renderLocalAppAutonomyPolicyMarkdown,
  type LocalAppAutonomyPolicy,
} from "./local-app-autonomy.policy";
import { resolveLocalAppRuntimeProfile } from "./local-app-runtime-profile";
import {
  applyMarketplaceBetaGateMetadata,
  assertMarketplaceBetaGateAllowed,
  evaluateMarketplaceBetaGate,
  getMarketplaceBetaGateConfig,
} from "./marketplace-beta-gate";
import { isMarketplaceAppPublished } from "./marketplace-publication-gate";
import {
  MARKETPLACE_RELEASE_MANIFEST_SUMMARY,
  applyMarketplaceReleaseMetadata,
} from "./marketplace-release-policy";
import {
  DANGEROUS_POLICY_ACKNOWLEDGEMENT_VERSION,
  DANGEROUS_POLICY_PRESERVED_INVARIANTS,
  isDangerouslySkipPermissionsPolicy,
} from "./marketplace-permission-policy";
import { encodeMarketplaceCredentialEnvelope } from "./marketplace-credential-envelope";
import { normalizeMarketplaceCredentials } from "./marketplace-credential-policy";

type PackFile = {
  relativePath: string;
  content: string;
  classification: string;
  refreshPolicy: string;
};

function hasCanonicalPack(app: MarketplaceAppDefinition) {
  return app.packQuality.level === "curated" || app.slug === "jotform";
}

type MarketplaceInstallSaveInput = Pick<
  MarketplaceInstallEntity,
  | "workspaceId"
  | "appSlug"
  | "connectionId"
  | "agentId"
  | "packId"
  | "agentDocumentationInstallId"
  | "role"
  | "selectedCapabilities"
  | "installStatus"
  | "driftStatus"
  | "lastInstalledAt"
  | "metadata"
>;

type LocalRepoDiscovery = {
  docsSourcePath: string;
  repoPath?: string;
  sourceHostType?: string;
  sourceHostId?: string | null;
  bridgeDeviceId?: string | null;
  files: Array<{
    relativePath: string;
    absolutePath: string;
    content: string;
    hash: string;
  }>;
  sourceHash: string;
  manifest?: Record<string, unknown>;
  rolesManifest?: Record<string, unknown>;
  roleManifest?: MarketplaceRoleManifest;
  config?: Record<string, unknown>;
  openApiSpecPath?: string;
  endpointsPath?: string;
  auditorDocsAvailable?: boolean;
  workerFileCount?: number;
  auditorFileCount?: number;
  managerDocsAvailable?: boolean;
  managerFileCount?: number;
  apiFileCount?: number;
  bridgeReturnedFileCount?: number;
  bridgeReturnedWorkerFileCount?: number;
  bridgeReturnedAuditorFileCount?: number;
  bridgeReturnedManagerFileCount?: number;
  bridgeReturnedApiFileCount?: number;
  bridgeReturnedFilePaths?: string[];
  gitCommit?: string | null;
  gitBranch?: string | null;
  dirtyState?: boolean | null;
  dirtyFiles?: string[] | null;
  warnings: string[];
};

type LocalRepoRoleKey = "worker" | "manager" | "auditor";
type LocalRepoDocumentationAutomationMode =
  | "manual_review"
  | "auto_apply_safe"
  | "auto_apply_full";

type LocalRepoCapabilityMap = {
  appPurpose: string;
  majorWorkflows: string[];
  screensPages: string[];
  endpoints: string[];
  entitiesDataModel: string[];
  jobsWorkers: string[];
  integrations: string[];
  agentOperableTasks: string[];
  managerResponsibilities: string[];
  workerResponsibilities: string[];
  auditorResponsibilities: string[];
  risksApprovalGates: string[];
  failureModes: string[];
  verificationSteps: string[];
  changedSignals: Array<{ kind: string; path: string; detail: string }>;
};

type LocalAppRuntimeConnectionMetadata = {
  [key: string]: unknown;
  sourceHostType?: string | null;
  sourceHostId?: string | null;
  bridgeDeviceId?: string | null;
  runtimeBindingId?: string | null;
  sourceHostLabel?: string | null;
  runtimeType?: string | null;
  localRepoPath?: string | null;
  appSlug?: string | null;
  localAppUrl?: string | null;
  localApiUrl?: string | null;
  convexSiteUrl?: string | null;
  allowRuntimeHostStart?: boolean;
  lifecycleApprovalPolicy?: string | null;
  lifecycle?: Record<string, unknown>;
  runtimeProfile?: Record<string, unknown> | null;
  autonomyPolicy?: LocalAppAutonomyPolicy;
  localappconnectorCampaignId?: string | null;
  localappconnectorCampaignName?: string | null;
  localappconnectorOpenClawBaseUrl?: string | null;
  localappconnectorOpenClawConnectionId?: string | null;
  localappconnectorOpenClawStatus?: Record<string, unknown> | null;
  localappconnectorPolicySync?: Record<string, unknown> | null;
};

type LocalAppConnectorPolicySyncResult = {
  status: "synced" | "unsynced" | "failed" | "skipped";
  message: string;
  campaignId: string | null;
  campaignName: string | null;
  clawchatMode: string;
  localappconnectorMode: string | null;
  lastSyncAt: string;
  mismatch: boolean;
  getPolicyResult?: unknown;
  updatePolicyResult?: unknown;
  explainEffectivePolicyResult?: unknown;
  errorCode?: string | null;
};

export type MarketplaceCatalogPageQuery = {
  query?: string | null;
  category?: string | null;
  sourceType?: string | null;
  cursor?: string | null;
  limit?: number | string | null;
};

type MarketplaceCatalogCursor = {
  offset: number;
  scope: string;
};

type LocalAppAutoConnectResult = {
  status: "connected" | "action_required" | "partial" | "failed";
  message: string;
  app: MarketplaceAppDefinition;
  connectionId: string | null;
  checklist: {
    sourceHostReachable: boolean;
    localAppReachable: boolean;
    agentApiRouteReachable: boolean;
    agentApiKeyConfigured: boolean;
    bearerStoredEncrypted: boolean;
    authenticatedAgentApiCallPassed: boolean;
    campaignDiscovered: boolean;
    campaignMapped: boolean;
    policySynced: boolean;
    docsRefreshed: boolean;
    agentPacksInstalled: boolean;
    toolDescriptorSentToHermes: boolean;
    neededToolsCaptured: boolean;
  };
  campaigns: MarketplaceLocalAppCampaignPayload[];
  selectedCampaign: MarketplaceLocalAppCampaignPayload | null;
  policySync:
    | LocalAppConnectorPolicySyncResult
    | Record<string, unknown>
    | null;
  installResults: Array<Record<string, unknown>>;
  neededToolsSummary: Record<string, unknown> | null;
  userActionRequired: string | null;
  diagnostics: Record<string, unknown>;
};

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);
  private autoDocSyncRunning = false;
  private readonly localRepoReadSyncRunning = new Set<string>();
  private readonly localRepoAgentDocsRefreshRunning = new Set<string>();
  private readonly localRepoDocumentationAutomationRunning = new Set<string>();

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly auditLogService: AuditLogService,
    private readonly syncService: DocumentationPackSyncService,
    private readonly installService: AgentDocumentationInstallService,
    private readonly agentService: AgentService,
    private readonly bridgeService: BridgeService,
    private readonly runtimeBindingService: RuntimeBindingService,
    @InjectRepository(MarketplaceConnectionEntity)
    private readonly connectionRepo: Repository<MarketplaceConnectionEntity>,
    @InjectRepository(MarketplaceInstallEntity)
    private readonly marketplaceInstallRepo: Repository<MarketplaceInstallEntity>,
    @InjectRepository(MarketplacePackGenerationJobEntity)
    private readonly generationJobRepo: Repository<MarketplacePackGenerationJobEntity>,
    @InjectRepository(MarketplaceGeneratedPackEntity)
    private readonly generatedPackRepo: Repository<MarketplaceGeneratedPackEntity>,
    @InjectRepository(MarketplacePackSourceEntity)
    private readonly packSourceRepo: Repository<MarketplacePackSourceEntity>,
    @InjectRepository(MarketplacePackQualityScoreEntity)
    private readonly packQualityScoreRepo: Repository<MarketplacePackQualityScoreEntity>,
    @InjectRepository(MarketplacePackReviewEntity)
    private readonly packReviewRepo: Repository<MarketplacePackReviewEntity>,
    @InjectRepository(LinkedApplicationEntity)
    private readonly linkedApplicationRepo: Repository<LinkedApplicationEntity>,
    @InjectRepository(ApplicationDocumentationPackEntity)
    private readonly packRepo: Repository<ApplicationDocumentationPackEntity>,
    @InjectRepository(AgentDocumentationInstallEntity)
    private readonly agentDocumentationInstallRepo: Repository<AgentDocumentationInstallEntity>,
    @InjectRepository(ApplicationDocumentationVersionEntity)
    private readonly appDocVersionRepo: Repository<ApplicationDocumentationVersionEntity>,
    @InjectRepository(AgentDocumentationVersionEntity)
    private readonly agentDocVersionRepo: Repository<AgentDocumentationVersionEntity>,
    @InjectRepository(DocumentationGenerationProposalEntity)
    private readonly documentationProposalRepo: Repository<DocumentationGenerationProposalEntity>,
    @InjectRepository(DocumentationProposalFileEntity)
    private readonly documentationProposalFileRepo: Repository<DocumentationProposalFileEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(ScheduledThreadMessageEntity)
    private readonly scheduledMessageRepo: Repository<ScheduledThreadMessageEntity>,
    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly workspaceMemberRepo: Repository<WorkspaceMemberEntity>,
  ) {}

  async listCatalog(workspaceId: string, userId?: string | null) {
    if (userId) {
      void this.syncInstalledLocalRepoDocsForWorkspace(
        workspaceId,
        userId,
        "catalog_read",
      ).catch((error) => {
        this.logger.warn(
          `Marketplace catalog local repo docs sync skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }
    const betaGateConfig = getMarketplaceBetaGateConfig();
    const localApps = (await this.listLocalMarketplaceApps(workspaceId)).map(
      (app) =>
        applyMarketplaceBetaGateMetadata(
          applyMarketplaceReleaseMetadata(app),
          betaGateConfig,
        ),
    );
    const staticApps = this.staticCatalog(betaGateConfig);
    const visibleLocalApps = localApps.filter(
      (app) =>
        !evaluateMarketplaceBetaGate(app, betaGateConfig).hiddenFromCatalog,
    );
    return {
      releaseManifest: MARKETPLACE_RELEASE_MANIFEST_SUMMARY,
      categories: this.catalogCategories(staticApps),
      apps: staticApps,
      workspaceApps: visibleLocalApps,
    };
  }

  async listCatalogPage(
    workspaceId: string,
    query: MarketplaceCatalogPageQuery = {},
    userId?: string | null,
  ) {
    if (userId) {
      void this.syncInstalledLocalRepoDocsForWorkspace(
        workspaceId,
        userId,
        "catalog_read",
      ).catch((error) => {
        this.logger.warn(
          `Marketplace catalog local repo docs sync skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }
    const betaGateConfig = getMarketplaceBetaGateConfig();
    const localApps = (await this.listLocalMarketplaceApps(workspaceId))
      .map((app) =>
        applyMarketplaceBetaGateMetadata(
          applyMarketplaceReleaseMetadata(app),
          betaGateConfig,
        ),
      )
      .filter(
        (app) =>
          !evaluateMarketplaceBetaGate(app, betaGateConfig).hiddenFromCatalog,
      );
    return this.paginateCatalog(
      [...this.staticCatalog(betaGateConfig), ...localApps],
      query,
    );
  }

  listPublicCatalogPage(query: MarketplaceCatalogPageQuery = {}) {
    return this.paginateCatalog(
      this.staticCatalog(getMarketplaceBetaGateConfig()),
      query,
    );
  }

  getPublicApp(slug: string) {
    const canonicalSlug = canonicalMarketplaceProviderSlug(slug);
    const app = this.staticCatalog(getMarketplaceBetaGateConfig()).find(
      (entry) => entry.slug === canonicalSlug,
    );
    if (!app) throw new NotFoundException("Marketplace app not found");
    return app;
  }

  listPublicCatalog() {
    const betaGateConfig = getMarketplaceBetaGateConfig();
    const apps = this.staticCatalog(betaGateConfig);
    return {
      releaseManifest: MARKETPLACE_RELEASE_MANIFEST_SUMMARY,
      categories: this.catalogCategories(apps),
      apps,
    };
  }

  private paginateCatalog(
    sourceApps: MarketplaceAppDefinition[],
    query: MarketplaceCatalogPageQuery,
  ) {
    const search = String(query.query ?? "")
      .trim()
      .toLocaleLowerCase()
      .slice(0, 120);
    const category = String(query.category ?? "").trim();
    const sourceType = String(query.sourceType ?? "").trim();
    const parsedLimit = Number(query.limit ?? 50);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 100)
        : 50;
    const cursorScope = [
      search,
      category.toLocaleLowerCase(),
      sourceType.toLocaleLowerCase(),
    ].join("\u0000");
    const offset = this.decodeCatalogCursor(query.cursor, cursorScope);
    const uniqueApps = [
      ...new Map(sourceApps.map((app) => [app.slug, app])).values(),
    ].sort(
      (left, right) =>
        left.name.localeCompare(right.name, undefined, {
          sensitivity: "base",
        }) || left.slug.localeCompare(right.slug),
    );
    const filtered = uniqueApps.filter((app) => {
      const categoryLabel =
        MARKETPLACE_CATEGORY_LABELS[app.category] ??
        app.category
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
      if (
        category &&
        app.category.toLocaleLowerCase() !== category.toLocaleLowerCase() &&
        categoryLabel.toLocaleLowerCase() !== category.toLocaleLowerCase()
      ) {
        return false;
      }
      if (sourceType && app.sourceType !== sourceType) return false;
      if (!search) return true;
      return [
        app.name,
        app.slug,
        app.category,
        app.agentUseSummary,
        app.description,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search);
    });
    if (offset > filtered.length) {
      throw new BadRequestException(
        "Marketplace catalog cursor is out of range",
      );
    }
    const page = filtered.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return {
      releaseManifest: MARKETPLACE_RELEASE_MANIFEST_SUMMARY,
      categories: this.catalogCategories(uniqueApps),
      apps: page.map((app) => this.catalogSummary(app)),
      pageInfo: {
        totalCount: filtered.length,
        limit,
        hasNextPage: nextOffset < filtered.length,
        nextCursor:
          nextOffset < filtered.length
            ? this.encodeCatalogCursor({
                offset: nextOffset,
                scope: cursorScope,
              })
            : null,
      },
    };
  }

  private catalogSummary(
    app: MarketplaceAppDefinition,
  ): MarketplaceAppDefinition {
    return {
      ...app,
      // Catalogue pages carry the fields needed to render and filter rows.
      // The existing /catalog/:slug endpoint remains the authority for the
      // larger capability, policy, runtime and source-detail collections.
      capabilities: [],
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [],
      approvalProfiles: [],
      runtimeSupport: [],
      roleManifest: undefined,
      sourceMetadata: undefined,
    };
  }

  private encodeCatalogCursor(cursor: MarketplaceCatalogCursor): string {
    return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
  }

  private decodeCatalogCursor(
    cursor: string | null | undefined,
    expectedScope: string,
  ): number {
    if (!cursor) return 0;
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, "base64url").toString("utf8"),
      ) as Partial<MarketplaceCatalogCursor>;
      if (
        typeof parsed.offset !== "number" ||
        !Number.isSafeInteger(parsed.offset) ||
        parsed.offset < 0 ||
        parsed.scope !== expectedScope
      ) {
        throw new Error("invalid offset");
      }
      return parsed.offset;
    } catch {
      throw new BadRequestException("Marketplace catalog cursor is invalid");
    }
  }

  private staticCatalog(betaGateConfig = getMarketplaceBetaGateConfig()) {
    return MARKETPLACE_CATALOG.filter(isMarketplaceAppPublished)
      .map((app) =>
        applyMarketplaceBetaGateMetadata(
          applyMarketplaceReleaseMetadata({
            ...app,
            roleManifest: roleManifestForApp(app),
          }),
          betaGateConfig,
        ),
      )
      .filter(
        (app) =>
          app.release?.connectEligible === true &&
          !evaluateMarketplaceBetaGate(app, betaGateConfig).hiddenFromCatalog,
      );
  }

  private catalogCategories(apps: MarketplaceAppDefinition[]) {
    return [...new Set(apps.map((app) => app.category))].sort().map((id) => ({
      id,
      label:
        MARKETPLACE_CATEGORY_LABELS[id] ??
        id
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
    }));
  }

  async getApp(workspaceId: string, slug: string, userId?: string | null) {
    if (userId) {
      await this.syncInstalledLocalRepoDocsIfChanged(
        workspaceId,
        slug,
        userId,
        "app_read",
      );
    }
    return this.resolveMarketplaceApp(workspaceId, slug);
  }

  async createLocalApp(
    workspaceId: string,
    userId: string,
    dto: CreateLocalMarketplaceAppDto,
  ) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("Local app name is required");
    const repoPath = dto.repoPath.trim();
    if (!repoPath) throw new BadRequestException("Repo path is required");
    const autonomyPolicy = normalizeLocalAppAutonomyPolicy(
      dto.autonomyPolicy ?? defaultLocalAppAutonomyPolicy(),
    );
    this.assertDangerousPolicyAcknowledged(
      autonomyPolicy.mode,
      dto.acknowledgeDangerouslySkipPermissions,
    );
    const sourceHost = await this.resolveLocalRepoSourceHost(workspaceId, dto);
    const baseSlug = slugify(name);
    const slug = await this.nextLocalAppSlug(workspaceId, baseSlug);
    const docsSourcePath = this.normalizeLocalRepoDocsSourcePath(
      dto.docsSourcePath,
    );
    const localRepoMetadata: Record<string, unknown> = {
      sourceType: "local_repo",
      sourceHostType: sourceHost.sourceHostType,
      sourceHostId: sourceHost.sourceHostId,
      bridgeDeviceId: sourceHost.bridgeDeviceId,
      runtimeBindingId: sourceHost.runtimeBindingId,
      sourceHostLabel: sourceHost.sourceHostLabel,
      runtimeType: sourceHost.runtimeType,
      localAppUrl: dto.localAppUrl?.trim() || null,
      localApiUrl: dto.localApiUrl?.trim() || null,
      openApiSpecPath: dto.openApiSpecPath?.trim() || null,
      docsSourcePath,
      documentationAutomationMode: this.normalizeDocumentationAutomationMode(
        dto.documentationAutomationMode,
      ),
      autonomyPolicy,
      ...this.dangerousPolicyAcknowledgementMetadata(
        autonomyPolicy.mode,
        userId,
      ),
      lifecycle: this.sanitizeLocalAppLifecycleMetadata(dto.lifecycle),
      localappconnectorCampaignId:
        dto.localappconnectorCampaignId?.trim() || null,
      localappconnectorCampaignName:
        dto.localappconnectorCampaignName?.trim() || null,
    };
    localRepoMetadata.runtimeProfile = resolveLocalAppRuntimeProfile({
      appSlug: slug,
      appName: name,
      repoPath,
      metadata: {
        ...localRepoMetadata,
        runtimeProfile:
          dto.runtimeProfile && typeof dto.runtimeProfile === "object"
            ? dto.runtimeProfile
            : undefined,
      },
    });
    const linked = await this.linkedApplicationRepo.save(
      this.linkedApplicationRepo.create({
        workspaceId,
        createdByUserId: userId,
        name,
        slug,
        repoPath,
        repoKey: null,
        generatedDocsPath: AGENT_DOCS_PACK_PATH,
        frameworkMetadata: {
          sourceType: "local_repo",
          sourceHostType: sourceHost.sourceHostType,
          runtimeType: sourceHost.runtimeType,
        },
        apiStyleMetadata: {
          ...localRepoMetadata,
        },
        agentOperableStatus: "pending_scan",
        documentationPackStatus: "not_generated",
        metadata: {
          ...localRepoMetadata,
          marketplaceSlug: slug,
        },
      }),
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.local_app.created",
      resourceType: "marketplace_app",
      resourceId: slug,
      metadata: {
        appSlug: slug,
        linkedApplicationId: linked.id,
        docsSourcePath,
        sourceHostType: sourceHost.sourceHostType,
        sourceHostId: sourceHost.sourceHostId,
      },
    });
    return linked;
  }

  async updateLocalApp(
    workspaceId: string,
    appSlug: string,
    userId: string,
    dto: UpdateLocalMarketplaceAppDto,
  ) {
    const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
    const requestedAutonomyPolicy =
      dto.autonomyPolicy !== undefined
        ? normalizeLocalAppAutonomyPolicy(dto.autonomyPolicy)
        : null;
    if (requestedAutonomyPolicy) {
      this.assertDangerousPolicyAcknowledged(
        requestedAutonomyPolicy.mode,
        dto.acknowledgeDangerouslySkipPermissions,
      );
    }
    const sourceHost = dto.sourceHostType
      ? await this.resolveLocalRepoSourceHost(workspaceId, {
          sourceHostType: dto.sourceHostType,
          sourceHostId: dto.sourceHostId ?? undefined,
          bridgeDeviceId: dto.bridgeDeviceId ?? undefined,
          runtimeBindingId: dto.runtimeBindingId ?? undefined,
          sourceHostLabel: dto.sourceHostLabel ?? undefined,
          runtimeType: dto.runtimeType ?? undefined,
        })
      : null;
    if (dto.repoPath !== undefined) {
      const repoPath = dto.repoPath.trim();
      if (!repoPath) throw new BadRequestException("Repo path is required");
      linked.repoPath = repoPath;
    }
    const nextMetadata: Record<string, unknown> = {
      ...linked.metadata,
      sourceType: "local_repo",
      ...(sourceHost ?? {}),
      ...(dto.localAppUrl !== undefined
        ? { localAppUrl: dto.localAppUrl?.trim() || null }
        : {}),
      ...(dto.localApiUrl !== undefined
        ? { localApiUrl: dto.localApiUrl?.trim() || null }
        : {}),
      ...(dto.openApiSpecPath !== undefined
        ? { openApiSpecPath: dto.openApiSpecPath?.trim() || null }
        : {}),
      ...(dto.docsSourcePath !== undefined
        ? {
            docsSourcePath: this.normalizeLocalRepoDocsSourcePath(
              dto.docsSourcePath,
            ),
          }
        : {}),
      ...(dto.lifecycle !== undefined
        ? { lifecycle: this.sanitizeLocalAppLifecycleMetadata(dto.lifecycle) }
        : {}),
      ...(dto.runtimeProfile !== undefined
        ? {
            runtimeProfile:
              dto.runtimeProfile && typeof dto.runtimeProfile === "object"
                ? dto.runtimeProfile
                : null,
          }
        : {}),
      ...(dto.localappconnectorCampaignId !== undefined
        ? {
            localappconnectorCampaignId:
              dto.localappconnectorCampaignId?.trim() || null,
          }
        : {}),
      ...(dto.localappconnectorCampaignName !== undefined
        ? {
            localappconnectorCampaignName:
              dto.localappconnectorCampaignName?.trim() || null,
          }
        : {}),
      ...(dto.documentationAutomationMode !== undefined
        ? {
            documentationAutomationMode:
              this.normalizeDocumentationAutomationMode(
                dto.documentationAutomationMode,
              ),
          }
        : {}),
      ...(dto.autonomyPolicy !== undefined
        ? {
            autonomyPolicy: requestedAutonomyPolicy,
            ...this.dangerousPolicyAcknowledgementMetadata(
              requestedAutonomyPolicy?.mode,
              userId,
            ),
          }
        : {}),
    };
    nextMetadata.runtimeProfile = resolveLocalAppRuntimeProfile({
      appSlug: linked.slug,
      appName: linked.name,
      repoPath: linked.repoPath,
      metadata: nextMetadata,
      apiStyleMetadata: linked.apiStyleMetadata,
    });
    const previousAutonomyPolicy = this.getLocalAppAutonomyPolicy(linked);
    linked.metadata = nextMetadata;
    linked.apiStyleMetadata = {
      ...linked.apiStyleMetadata,
      ...nextMetadata,
    };
    linked.frameworkMetadata = {
      ...linked.frameworkMetadata,
      sourceType: "local_repo",
      ...(sourceHost
        ? {
            sourceHostType: sourceHost.sourceHostType,
            runtimeType: sourceHost.runtimeType,
          }
        : {}),
    };
    linked.documentationPackStatus = "pending_review";
    if (sourceHost) {
      linked.agentOperableStatus = "pending_scan";
    }
    await this.linkedApplicationRepo.save(linked);
    const nextAutonomyPolicy = this.getLocalAppAutonomyPolicy(linked);
    if (previousAutonomyPolicy.mode !== nextAutonomyPolicy.mode) {
      await this.pauseConflictingScheduledMessagesForLocalApp(
        workspaceId,
        appSlug,
        nextAutonomyPolicy,
      );
    }
    if (dto.documentationAutomationMode !== undefined) {
      await this.runLocalRepoDocumentationAutomationIfEnabled(
        workspaceId,
        appSlug,
        userId,
        "settings_update",
      );
    }
    if (dto.autonomyPolicy !== undefined) {
      await this.syncLocalAppConnectorCampaignPolicyForLinkedApp(
        workspaceId,
        linked,
        {
          policy: nextAutonomyPolicy,
          reason: "autonomy_policy_update",
        },
      );
      await this.refreshInstalledAgentDocs(workspaceId, appSlug, userId, {
        trigger: "autonomy_policy_update",
      });
    }
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.local_app.source_host_updated",
      resourceType: "marketplace_app",
      resourceId: appSlug,
      metadata: {
        appSlug,
        linkedApplicationId: linked.id,
        sourceHost,
      },
    });
    return this.listCatalog(workspaceId, userId);
  }

  async listLocalRepoSourceHosts(workspaceId: string) {
    return this.bridgeService.listMarketplaceLocalRepoSourceHosts(workspaceId);
  }

  private async nextLocalAppSlug(workspaceId: string, baseSlug: string) {
    const normalized = `local-${baseSlug || "app"}`.slice(0, 120);
    let candidate = normalized;
    let suffix = 2;
    while (
      MARKETPLACE_CATALOG.some((app) => app.slug === candidate) ||
      (await this.linkedApplicationRepo.findOne({
        where: { workspaceId, slug: candidate },
      }))
    ) {
      candidate = `${normalized}-${suffix}`.slice(0, 120);
      suffix += 1;
    }
    return candidate;
  }

  private async resolveLocalRepoSourceHost(
    workspaceId: string,
    input: {
      sourceHostType?: string;
      sourceHostId?: string | null;
      bridgeDeviceId?: string | null;
      runtimeBindingId?: string | null;
      sourceHostLabel?: string | null;
      runtimeType?: string | null;
    },
  ) {
    const sourceHostType = String(input.sourceHostType ?? "").trim();
    if (
      !["openclaw_bridge", "hermes_bridge", "runtime_host"].includes(
        sourceHostType,
      )
    ) {
      throw new BadRequestException(
        "Select a source host for this local repo app",
      );
    }
    const bridgeDeviceId =
      input.bridgeDeviceId?.trim() || input.sourceHostId?.trim() || "";
    if (!bridgeDeviceId) {
      throw new BadRequestException(
        "Select a connected OpenClaw/Hermes source host",
      );
    }
    const hosts =
      await this.bridgeService.listMarketplaceLocalRepoSourceHosts(workspaceId);
    const host = hosts.find(
      (item) =>
        item.bridgeDeviceId === bridgeDeviceId || item.id === bridgeDeviceId,
    );
    if (
      !host ||
      host.status !== "available" ||
      !host.supportsLocalRepoDocsRead
    ) {
      throw new BadRequestException(
        "Selected source host is not an online paired runtime with local repository read capability",
      );
    }
    return {
      sourceHostType: host.type,
      sourceHostId: host.id,
      bridgeDeviceId: host.bridgeDeviceId ?? bridgeDeviceId,
      runtimeBindingId: input.runtimeBindingId ?? host.runtimeBindingId ?? null,
      sourceHostLabel: input.sourceHostLabel?.trim() || host.label,
      runtimeType: input.runtimeType ?? host.runtimeType ?? null,
    };
  }

  private async resolveMarketplaceApp(
    workspaceId: string,
    slug: string,
  ): Promise<MarketplaceAppDefinition> {
    const canonicalSlug = canonicalMarketplaceProviderSlug(slug);
    const staticApp = MARKETPLACE_CATALOG.find(
      (item) => item.slug === canonicalSlug,
    );
    if (staticApp) {
      return applyMarketplaceBetaGateMetadata(
        applyMarketplaceReleaseMetadata({
          ...staticApp,
          roleManifest: roleManifestForApp(staticApp),
        }),
      );
    }
    const linked = await this.getLocalLinkedApplication(
      workspaceId,
      canonicalSlug,
    );
    return applyMarketplaceBetaGateMetadata(
      applyMarketplaceReleaseMetadata(
        this.localLinkedApplicationToMarketplaceApp(linked),
      ),
    );
  }

  private assertMarketplaceAppAvailableForBeta(app: MarketplaceAppDefinition) {
    assertMarketplaceBetaGateAllowed(app);
    if (app.availability !== "available") {
      if (app.availability === "unsupported") {
        throw new BadRequestException(
          `${app.name} cannot be connected because the provider does not publish a supported direct account API or remote MCP service.`,
        );
      }
      throw new BadRequestException(
        `${app.name} is coming soon. Connection, installation, and agent actions are unavailable until the provider approves Relay's production integration.`,
      );
    }
  }

  private async listLocalMarketplaceApps(workspaceId: string) {
    const linked = await this.linkedApplicationRepo.find({
      where: { workspaceId },
      order: { updatedAt: "DESC" },
    });
    return linked
      .filter((item) => this.isLocalLinkedApplication(item))
      .map((item) => this.localLinkedApplicationToMarketplaceApp(item));
  }

  private async getLocalLinkedApplication(
    workspaceId: string,
    appSlug: string,
  ) {
    const linked = await this.linkedApplicationRepo.findOne({
      where: { workspaceId, slug: appSlug },
    });
    if (!linked || !this.isLocalLinkedApplication(linked)) {
      throw new NotFoundException("Marketplace app not found");
    }
    return linked;
  }

  private isLocalLinkedApplication(linked: LinkedApplicationEntity) {
    const metadata = linked.metadata ?? {};
    const sourceType = String(
      metadata.sourceType ?? linked.frameworkMetadata?.sourceType ?? "",
    );
    if (sourceType === "marketplace_app") return false;
    if (sourceType === "local_repo") return true;
    return Boolean(
      linked.repoPath && !linked.repoPath.startsWith("marketplace://"),
    );
  }

  private localLinkedApplicationToMarketplaceApp(
    linked: LinkedApplicationEntity,
  ): MarketplaceAppDefinition {
    const metadata = linked.metadata ?? {};
    const apiMetadata = linked.apiStyleMetadata ?? {};
    const autonomyPolicy = this.getLocalAppAutonomyPolicy(linked);
    const runtimeProfile = resolveLocalAppRuntimeProfile({
      appSlug: linked.slug,
      appName: linked.name,
      repoPath: linked.repoPath,
      metadata,
      apiStyleMetadata: apiMetadata,
    });
    const sourceMetadata = {
      linkedApplicationId: linked.id,
      repoPath: linked.repoPath,
      currentGitCommit: linked.currentGitCommit,
      dirtyState: linked.dirtyState,
      lastScannedAt: linked.lastScannedAt?.toISOString() ?? null,
      documentationPackStatus: linked.documentationPackStatus,
      agentOperableStatus: linked.agentOperableStatus,
      localAppUrl: metadata.localAppUrl ?? apiMetadata.localAppUrl ?? null,
      localApiUrl: metadata.localApiUrl ?? apiMetadata.localApiUrl ?? null,
      openApiSpecPath:
        metadata.openApiSpecPath ?? apiMetadata.openApiSpecPath ?? null,
      docsSourcePath: this.normalizeLocalRepoDocsSourcePath(
        metadata.docsSourcePath ?? apiMetadata.docsSourcePath,
      ),
      sourceHostType:
        metadata.sourceHostType ?? apiMetadata.sourceHostType ?? null,
      sourceHostId: metadata.sourceHostId ?? apiMetadata.sourceHostId ?? null,
      bridgeDeviceId:
        metadata.bridgeDeviceId ?? apiMetadata.bridgeDeviceId ?? null,
      runtimeBindingId:
        metadata.runtimeBindingId ?? apiMetadata.runtimeBindingId ?? null,
      sourceHostLabel:
        metadata.sourceHostLabel ?? apiMetadata.sourceHostLabel ?? null,
      runtimeType: metadata.runtimeType ?? apiMetadata.runtimeType ?? null,
      lifecycle: metadata.lifecycle ?? apiMetadata.lifecycle ?? {},
      runtimeProfile,
      auditorDocsAvailable:
        metadata.auditorDocsAvailable ??
        apiMetadata.auditorDocsAvailable ??
        false,
      auditorFileCount:
        metadata.auditorFileCount ?? apiMetadata.auditorFileCount ?? 0,
      managerDocsAvailable:
        metadata.managerDocsAvailable ??
        apiMetadata.managerDocsAvailable ??
        false,
      managerFileCount:
        metadata.managerFileCount ?? apiMetadata.managerFileCount ?? 0,
      sourceHostConfigured: Boolean(
        metadata.sourceHostType ?? apiMetadata.sourceHostType,
      ),
      sourceHash: metadata.sourceHash ?? null,
      sourceChanged: metadata.sourceChanged ?? false,
      roleManifest:
        metadata.roleManifest ??
        apiMetadata.roleManifest ??
        normalizeMarketplaceRoleManifest({
          appSlug: linked.slug,
          appName: linked.name,
        }),
      autonomyPolicy,
    };
    const persistedRoleManifest =
      this.objectOrNull(metadata.roleManifest) ??
      this.objectOrNull(apiMetadata.roleManifest);
    const roleManifest =
      persistedRoleManifest && Array.isArray(persistedRoleManifest.roles)
        ? (persistedRoleManifest as MarketplaceRoleManifest)
        : normalizeMarketplaceRoleManifest({
            appSlug: linked.slug,
            appName: linked.name,
          });
    return {
      slug: linked.slug,
      name: linked.name,
      sourceType: "local_repo",
      category: "developer",
      description: `Local repo app linked from ${linked.repoPath}.`,
      agentUseSummary:
        "Operate this local/custom app using its ClawChat documentation source, API metadata, and reviewed generated pack.",
      connectionTypes: ["local_repo"],
      credentialRequirements: [],
      webhookRequirements: [],
      approvalProfile: "local_repo_conservative",
      approvalProfiles: [
        {
          id: "local_repo_conservative",
          label: "Local repo conservative",
          description:
            autonomyPolicy.mode === "dangerously_skip_permissions"
              ? "Autonomous external execution follows configured tool policy, evidence requirements, and hard stops."
              : autonomyPolicy.mode === "internal_write"
                ? "Read, draft, and internal app writes are allowed. External effects remain approval-gated or disabled."
                : "Read and draft by default. Writes, publishing, destructive changes, and external effects require approval.",
          defaultSelected: true,
          allowedActions: [
            {
              id: "read_local_app",
              label: "Read local app state",
              description:
                "Read documented local app API state and repo-supplied docs.",
            },
            {
              id: "draft_local_change",
              label: "Draft local changes",
              description:
                "Prepare proposed API calls, content changes, or repo updates for review.",
            },
          ],
          approvalRequiredActions: [
            {
              id: "call_write_api",
              label: "Call write APIs",
              description:
                "Write API calls or state-changing local app operations require approval.",
            },
            {
              id: "publish_or_deploy",
              label: "Publish or deploy",
              description:
                "Publishing, deployment, or externally visible changes require approval.",
            },
          ],
          blockedActions: [
            {
              id: "bypass_local_permissions",
              label: "Bypass permissions",
              description:
                "Bypassing app auth, workspace policy, or sharing controls is blocked.",
            },
            {
              id: "destructive_bulk_action",
              label: "Destructive bulk action",
              description:
                "Bulk deletion or irreversible destructive actions are blocked.",
            },
          ],
        },
      ],
      riskLevel: "medium",
      capabilities: [
        {
          id: "read",
          label: "Read",
          description: "Read documented local app data and API state.",
          defaultEnabled: true,
        },
        {
          id: "draft",
          label: "Draft",
          description:
            "Draft local app actions or documentation-backed updates.",
          defaultEnabled: true,
        },
        {
          id: "write_internal",
          label: "Write internal",
          description:
            "Perform configured internal local app write operations.",
          defaultEnabled: true,
        },
        {
          id: "write",
          label: "Legacy write",
          description:
            "Compatibility alias for write_internal on local repo apps.",
          defaultEnabled: false,
        },
        {
          id: "browser_external",
          label: "Browser navigation",
          description: "Use configured browser navigation for external work.",
          defaultEnabled:
            autonomyPolicy.external.browserNavigation !== "disabled",
        },
        {
          id: "external_search",
          label: "External search",
          description: "Use configured external search APIs or tools.",
          defaultEnabled: autonomyPolicy.external.externalSearch !== "disabled",
        },
        {
          id: "form_fill",
          label: "Form fill",
          description:
            "Fill public forms according to current autonomy policy.",
          defaultEnabled: autonomyPolicy.external.publicFormFill !== "disabled",
        },
        {
          id: "form_submit",
          label: "Form submit",
          description:
            "Submit public forms according to current autonomy policy.",
          defaultEnabled:
            autonomyPolicy.external.publicFormSubmit !== "disabled",
        },
        {
          id: "email_draft",
          label: "Email draft",
          description:
            "Draft email outreach using configured identity and evidence rules.",
          defaultEnabled: autonomyPolicy.external.emailDraft !== "disabled",
        },
        {
          id: "email_send",
          label: "Email send",
          description:
            "Send email using configured sender identity when policy allows.",
          defaultEnabled: autonomyPolicy.external.emailSend !== "disabled",
        },
        {
          id: "account_create",
          label: "Account creation",
          description:
            "Create external accounts only when policy and configured tools allow.",
          defaultEnabled:
            autonomyPolicy.external.accountCreation !== "disabled",
        },
        {
          id: "credential_use",
          label: "Credential use",
          description: "Use configured credentials without exposing secrets.",
          defaultEnabled: autonomyPolicy.external.credentialUse !== "disabled",
        },
        {
          id: "external_publish",
          label: "External publishing",
          description:
            "Publish externally only when policy and configured tools allow.",
          defaultEnabled:
            autonomyPolicy.external.externalPublishing !== "disabled",
        },
        {
          id: "lifecycle_contacted_submitted",
          label: "Contacted/submitted lifecycle",
          description:
            "Mark contacted/submitted only after real action evidence exists.",
          defaultEnabled:
            autonomyPolicy.lifecycleStatus.markContacted !== "disabled" ||
            autonomyPolicy.lifecycleStatus.markSubmitted !== "disabled",
        },
        {
          id: "lifecycle_live_indexed",
          label: "Live/indexed lifecycle",
          description:
            "Mark live/indexed only after verification evidence exists.",
          defaultEnabled:
            autonomyPolicy.lifecycleStatus.markLive !== "disabled" ||
            autonomyPolicy.lifecycleStatus.markIndexed !== "disabled",
        },
        {
          id: "backlink_verify",
          label: "Backlink verification",
          description: "Verify backlink/live state using configured tools.",
          defaultEnabled:
            autonomyPolicy.external.backlinkVerification !== "disabled",
        },
        {
          id: "index_check",
          label: "Index checking",
          description: "Check indexed state using configured tools.",
          defaultEnabled: autonomyPolicy.external.indexChecking !== "disabled",
        },
      ],
      allowedActions: [
        {
          id: "read_local_app",
          label: "Read local app",
          description:
            "Read documented local app state where permission exists.",
        },
        {
          id: "draft_local_change",
          label: "Draft local change",
          description: "Prepare proposed changes for review.",
        },
      ],
      approvalRequiredActions: [
        {
          id: "call_write_api",
          label: "Call write API",
          description: "Write or side-effecting API calls require approval.",
        },
        {
          id: "update_installed_docs",
          label: "Update installed docs",
          description:
            "Updating installed agent docs requires pack review and approval.",
        },
      ],
      blockedActions: [
        {
          id: "expose_secrets",
          label: "Expose secrets",
          description:
            "Exposing local credentials, tokens, or private keys is blocked.",
        },
        {
          id: "destructive_bulk_action",
          label: "Destructive bulk action",
          description: "Bulk destructive local app actions are blocked.",
        },
      ],
      providerDocsUrl: "",
      providerWebsiteUrl: "",
      runtimeSupport: [
        {
          format: "openclaw",
          installSupport: "installable",
          label: "OpenClaw",
          description:
            "Installs reviewed local app docs into OpenClaw library and router files.",
        },
        {
          format: "hermes",
          installSupport: "installable",
          label: "Hermes",
          description:
            "Installs a reviewed local app Hermes skill-router pack.",
        },
      ],
      roleManifest,
      availability: "available",
      packQuality: {
        level:
          linked.documentationPackStatus === "generated"
            ? "generated_reviewed"
            : "generated_draft",
        publicationStatus:
          linked.documentationPackStatus === "generated"
            ? "published"
            : "review_needed",
        label: "Local repo pack",
        description:
          "Workspace-local app pack generated from a linked repo source. Review updates before install.",
        confidence:
          linked.documentationPackStatus === "generated" ? "medium" : "low",
        reviewed: linked.documentationPackStatus === "generated",
        source: "local_repo",
      },
      sourceMetadata,
    };
  }

  async updatePack(workspaceId: string, appSlug: string, userId: string) {
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    if (app.sourceType === "local_repo") {
      const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
      const automationMode = this.getDocumentationAutomationMode(linked);
      if (automationMode !== "manual_review") {
        await this.runLocalRepoDocumentationAutomation(
          workspaceId,
          appSlug,
          userId,
          "update_pack",
          { forceAnalyze: true },
        );
        return this.getGeneratedPackDetail(workspaceId, appSlug);
      }
      const sourceHostType = String(
        linked.metadata?.sourceHostType ??
          linked.apiStyleMetadata?.sourceHostType ??
          "",
      );
      if (
        !["openclaw_bridge", "hermes_bridge", "runtime_host"].includes(
          sourceHostType,
        )
      ) {
        throw new BadRequestException(
          "A paired OpenClaw, Hermes, or runtime host is required. Reconfigure this local repository source before continuing.",
        );
      }
      const detail = await this.refreshLocalRepoGeneratedPack(
        workspaceId,
        linked,
        userId,
        {
          action: "update_pack",
          reviewStatus: "needs_manual_review",
        },
      );
      await this.auditLogService.record({
        actorType: "user",
        actorId: userId,
        workspaceId,
        eventType: "marketplace.local_app.update_pack_requested",
        resourceType: "marketplace_app",
        resourceId: appSlug,
        metadata: { appSlug, linkedApplicationId: linked.id },
      });
      return detail;
    }
    if (hasCanonicalPack(app)) {
      await this.auditLogService.record({
        actorType: "user",
        actorId: userId,
        workspaceId,
        eventType: "marketplace.external_provider.update_pack_checked",
        resourceType: "marketplace_app",
        resourceId: app.slug,
        metadata: {
          appSlug: app.slug,
          sourceType: app.sourceType,
          detection: "best_effort_static_canonical_pack",
        },
      });
      return this.previewPack(workspaceId, userId, {
        appSlug,
        runtimeFormat: "openclaw",
      });
    }
    return this.rerunGeneratedPack(workspaceId, appSlug, userId);
  }

  async refreshInstalledAgentDocs(
    workspaceId: string,
    appSlug: string,
    userId: string,
    options: { trigger?: string } = {},
  ) {
    this.assertMarketplaceAppAvailableForBeta(
      await this.resolveMarketplaceApp(workspaceId, appSlug),
    );
    const refreshKey = `${workspaceId}:${appSlug}`;
    if (
      !options.trigger?.startsWith("auto_") &&
      !options.trigger?.includes("proposal")
    ) {
      const automationResult =
        await this.runLocalRepoDocumentationAutomationIfEnabled(
          workspaceId,
          appSlug,
          userId,
          options.trigger ?? "manual_agent_docs_refresh",
          { forceAnalyze: true },
        );
      if (automationResult?.refreshResult)
        return automationResult.refreshResult;
    }
    if (this.localRepoAgentDocsRefreshRunning.has(refreshKey)) {
      throw new BadRequestException(
        "Agent documentation refresh is already running for this app.",
      );
    }
    this.localRepoAgentDocsRefreshRunning.add(refreshKey);
    try {
      const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
      const sourceHostType = String(
        linked.metadata?.sourceHostType ??
          linked.apiStyleMetadata?.sourceHostType ??
          "",
      );
      if (
        !["openclaw_bridge", "hermes_bridge", "runtime_host"].includes(
          sourceHostType,
        )
      ) {
        throw new BadRequestException(
          "A paired OpenClaw, Hermes, or runtime host is required. Reconfigure this local repository source before continuing.",
        );
      }

      const existingInstalls = await this.marketplaceInstallRepo.find({
        where: { workspaceId, appSlug },
        order: { updatedAt: "DESC" },
      });
      const activeInstalls = existingInstalls.filter(
        (install) => install.installStatus !== "removed",
      );
      if (!activeInstalls.length) {
        throw new BadRequestException(
          "Install this app to at least one agent before refreshing agent docs.",
        );
      }

      await this.refreshLocalRepoGeneratedPack(workspaceId, linked, userId, {
        action: "refresh_agent_docs",
        reviewStatus: "approved",
        trigger: options.trigger ?? "manual_agent_docs_refresh",
      });

      const pack = await this.getMutableGeneratedPack(workspaceId, appSlug);
      pack.qualityLevel = "generated_reviewed";
      pack.publicationStatus = "published";
      pack.reviewStatus = "approved";
      pack.confidence = pack.confidence === "low" ? "medium" : pack.confidence;
      await this.generatedPackRepo.save(pack);

      const currentLinked = await this.getLocalLinkedApplication(
        workspaceId,
        appSlug,
      );
      const appDocVersion = await this.recordApplicationDocumentationVersion({
        workspaceId,
        appSlug,
        linkedApplicationId: currentLinked.id,
        generatedPack: pack,
        userId,
        trigger: options.trigger ?? "manual_agent_docs_refresh",
        status: "published",
      });
      currentLinked.documentationPackStatus = "generated";
      currentLinked.metadata = {
        ...currentLinked.metadata,
        sourceChanged: false,
        lastPublishedPackId: pack.id,
        lastPublishedAt: new Date().toISOString(),
        lastAgentDocsRefreshAt: new Date().toISOString(),
        currentDocumentationVersionId: appDocVersion.id,
        currentDocumentationVersion: appDocVersion.version,
      };
      await this.linkedApplicationRepo.save(currentLinked);

      await this.recordGeneratedPackReview(
        workspaceId,
        appSlug,
        userId,
        "auto_publish_agent_docs",
        "Refreshed local repo docs and published the agent documentation pack automatically.",
        { sourceType: "local_repo", generatedPackId: pack.id },
      );
      const publishedDetail = await this.getGeneratedPackDetail(
        workspaceId,
        appSlug,
      );

      const refreshedInstalls: MarketplaceInstallEntity[] = [];
      for (const install of this.latestActiveMarketplaceInstallsByTarget(
        activeInstalls,
      )) {
        const runtimeFormat = this.readInstallRuntimeFormat(install);
        const metadata = install.metadata ?? {};
        const result = await this.install(workspaceId, userId, {
          appSlug,
          connectionId: install.connectionId ?? undefined,
          selectedCapabilities: install.selectedCapabilities,
          approvalProfileId:
            typeof metadata.approvalProfileId === "string"
              ? metadata.approvalProfileId
              : undefined,
          runtimeFormat,
          agentIds: [install.agentId],
          role: install.role,
          libraryTargetFolder:
            typeof metadata.libraryTargetFolder === "string"
              ? metadata.libraryTargetFolder
              : `marketplace/${appSlug}`,
          targetMode: "existing_agents",
          acknowledgeGeneratedDraftRisk: true,
        });
        refreshedInstalls.push(...result.installs);
      }
      await this.recordAgentDocumentationVersionsForInstalls(
        workspaceId,
        appSlug,
        refreshedInstalls,
        appDocVersion.id,
        userId,
        options.trigger ?? "manual_agent_docs_refresh",
      );

      await this.auditLogService.record({
        actorType: "user",
        actorId: userId,
        workspaceId,
        eventType: "marketplace.agent_docs.refreshed",
        resourceType: "marketplace_app",
        resourceId: appSlug,
        metadata: {
          appSlug,
          generatedPackId: pack.id,
          applicationDocumentationVersionId: appDocVersion.id,
          applicationDocumentationVersion: appDocVersion.version,
          refreshedInstallIds: refreshedInstalls.map((install) => install.id),
        },
      });

      return {
        app: await this.resolveMarketplaceApp(workspaceId, appSlug),
        generatedPack: publishedDetail,
        installs: refreshedInstalls,
        status: "current",
        message: "Agent documentation refreshed.",
      };
    } finally {
      this.localRepoAgentDocsRefreshRunning.delete(refreshKey);
    }
  }

  private async ensureLocalRepoDocsReadyForInstall(
    workspaceId: string,
    userId: string,
    app: MarketplaceAppDefinition,
    role: string,
  ) {
    if (app.sourceType !== "local_repo") return app;
    const refreshKey = `${workspaceId}:${app.slug}`;
    if (this.localRepoAgentDocsRefreshRunning.has(refreshKey)) return app;
    const source = (app.sourceMetadata ?? {}) as Record<string, unknown>;
    const manifestRole = findMarketplaceRole(app, role);
    const needsAutomaticPreparation =
      source.sourceChanged === true ||
      !manifestRole ||
      manifestRole.installable !== true;
    if (!needsAutomaticPreparation) return app;

    const linked = await this.getLocalLinkedApplication(workspaceId, app.slug);
    const sourceHostType = String(
      linked.metadata?.sourceHostType ??
        linked.apiStyleMetadata?.sourceHostType ??
        "",
    );
    if (!sourceHostType) return app;

    const existingInstalls = await this.marketplaceInstallRepo.find({
      where: { workspaceId, appSlug: app.slug },
      order: { updatedAt: "DESC" },
    });
    const activeInstalls = existingInstalls.filter(
      (install) => install.installStatus !== "removed",
    );
    if (activeInstalls.length) {
      await this.refreshInstalledAgentDocs(workspaceId, app.slug, userId, {
        trigger: "automatic_install_prepare",
      });
      return this.resolveMarketplaceApp(workspaceId, app.slug);
    }

    await this.refreshLocalRepoGeneratedPack(workspaceId, linked, userId, {
      action: "automatic_install_prepare",
      reviewStatus: "approved",
      trigger: "automatic_install_prepare",
    });
    const pack = await this.getMutableGeneratedPack(workspaceId, app.slug);
    pack.qualityLevel = "generated_reviewed";
    pack.publicationStatus = "published";
    pack.reviewStatus = "approved";
    pack.confidence = pack.confidence === "low" ? "medium" : pack.confidence;
    await this.generatedPackRepo.save(pack);
    const currentLinked = await this.getLocalLinkedApplication(
      workspaceId,
      app.slug,
    );
    const appDocVersion = await this.recordApplicationDocumentationVersion({
      workspaceId,
      appSlug: app.slug,
      linkedApplicationId: currentLinked.id,
      generatedPack: pack,
      userId,
      trigger: "automatic_install_prepare",
      status: "published",
    });
    currentLinked.documentationPackStatus = "generated";
    currentLinked.metadata = {
      ...currentLinked.metadata,
      sourceChanged: false,
      lastPublishedPackId: pack.id,
      lastPublishedAt: new Date().toISOString(),
      lastAgentDocsRefreshAt: new Date().toISOString(),
      currentDocumentationVersionId: appDocVersion.id,
      currentDocumentationVersion: appDocVersion.version,
    };
    await this.linkedApplicationRepo.save(currentLinked);
    return this.resolveMarketplaceApp(workspaceId, app.slug);
  }

  async getDocumentationHistory(
    workspaceId: string,
    appSlug: string,
    userId?: string | null,
  ) {
    if (userId) {
      await this.syncInstalledLocalRepoDocsIfChanged(
        workspaceId,
        appSlug,
        userId,
        "history_read",
      );
    }
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    const [applicationVersions, agentVersions] = await Promise.all([
      this.appDocVersionRepo.find({
        where: { workspaceId, appSlug },
        order: { version: "DESC" },
      }),
      this.agentDocVersionRepo.find({
        where: { workspaceId, appSlug },
        order: { createdAt: "DESC" },
      }),
    ]);
    const latestApplicationVersion = applicationVersions[0] ?? null;
    const latestAgentByTarget = new Map<
      string,
      AgentDocumentationVersionEntity
    >();
    for (const version of agentVersions) {
      const key = `${version.agentId}:${version.role}`;
      if (!latestAgentByTarget.has(key)) latestAgentByTarget.set(key, version);
    }
    return {
      app,
      applicationVersions,
      agentVersions,
      current: {
        applicationVersion: latestApplicationVersion,
        agentVersions: Array.from(latestAgentByTarget.values()),
      },
    };
  }

  async getLocalRepoDocumentationStatus(
    workspaceId: string,
    appSlug: string,
    userId?: string | null,
  ) {
    if (userId) {
      await this.syncInstalledLocalRepoDocsIfChanged(
        workspaceId,
        appSlug,
        userId,
        "status_read",
      );
    }
    const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    const [
      generatedPack,
      applicationVersions,
      agentVersions,
      installs,
      agents,
      proposals,
    ] = await Promise.all([
      this.generatedPackRepo.findOne({ where: { workspaceId, appSlug } }),
      this.appDocVersionRepo.find({
        where: { workspaceId, appSlug },
        order: { version: "DESC" },
        take: 10,
      }),
      this.agentDocVersionRepo.find({
        where: { workspaceId, appSlug },
        order: { createdAt: "DESC" },
        take: 100,
      }),
      this.marketplaceInstallRepo.find({
        where: { workspaceId, appSlug },
        order: { updatedAt: "DESC" },
      }),
      this.agentRepo.find({ where: { workspaceId } }),
      this.documentationProposalRepo.find({
        where: {
          workspaceId,
          linkedApplicationId: linked.id,
          mode: "local_repo_app_analysis",
        },
        order: { updatedAt: "DESC" },
        take: 5,
      }),
    ]);
    const latestProposal = proposals[0] ?? null;
    const latestProposalFiles = latestProposal
      ? await this.documentationProposalFileRepo.find({
          where: { workspaceId, proposalId: latestProposal.id },
          order: { relativePath: "ASC" },
        })
      : [];
    const localRepoDiscovery =
      generatedPack?.metadata?.localRepoDiscovery &&
      typeof generatedPack.metadata.localRepoDiscovery === "object"
        ? (generatedPack.metadata.localRepoDiscovery as Record<string, unknown>)
        : {};
    const generated = generatedPack
      ? this.readGeneratedPack(generatedPack)
      : null;
    const canonicalSources = generated?.canonicalSources ?? {};
    const latestApplicationVersion = applicationVersions[0] ?? null;
    const latestAgentByTarget = new Map<
      string,
      AgentDocumentationVersionEntity
    >();
    for (const version of agentVersions) {
      const key = `${version.agentId}:${version.role}`;
      if (!latestAgentByTarget.has(key)) latestAgentByTarget.set(key, version);
    }
    const activeInstalls =
      this.latestActiveMarketplaceInstallsByTarget(installs);
    const roleCoverage = this.buildLocalRepoRoleCoverage({
      app,
      discovery: localRepoDiscovery,
      canonicalSources,
      hermesFiles: generated
        ? this.previewPersistedGeneratedPack(app, generated, "hermes").files
        : [],
      installs: activeInstalls,
      agentVersions: Array.from(latestAgentByTarget.values()),
    });
    const sourceDiagnostics = this.buildLocalRepoSourceDiagnostics(
      linked,
      localRepoDiscovery,
      roleCoverage,
    );
    return {
      app,
      automation: {
        mode: this.getDocumentationAutomationMode(linked),
        lastRun: linked.metadata?.lastDocumentationAutomationRun ?? null,
      },
      sourceDiagnostics,
      roleCoverage,
      canonicalDocs: {
        currentVersion: latestApplicationVersion,
        versionCount: applicationVersions.length,
        generatedCanonicalFileCount: Object.keys(canonicalSources).length,
        sourceDiff: latestApplicationVersion?.sourceDiff ?? null,
        statusLabel: latestApplicationVersion
          ? this.sourceDiffHasChanges(latestApplicationVersion.sourceDiff)
            ? "App docs changed"
            : "Checked; app docs unchanged"
          : "No app docs version recorded",
      },
      generatedPack: generatedPack
        ? {
            id: generatedPack.id,
            reviewStatus: generatedPack.reviewStatus,
            publicationStatus: generatedPack.publicationStatus,
            qualityLevel: generatedPack.qualityLevel,
            generatedRuntimeFileCountByRole:
              roleCoverage.runtimeFileCountByRole,
          }
        : null,
      agentInstalls: activeInstalls.map((install) => {
        const version =
          latestAgentByTarget.get(`${install.agentId}:${install.role}`) ?? null;
        const agent = agents.find((item) => item.id === install.agentId);
        const installedFileCount = Array.isArray(version?.workspaceFileManifest)
          ? version.workspaceFileManifest.length
          : 0;
        return {
          installId: install.id,
          agentId: install.agentId,
          agentName: agent?.name ?? "Assigned agent",
          role: install.role,
          hasRealDocumentationVersion: Boolean(
            version?.agentDocumentationInstallId,
          ),
          agentDocumentationInstallId: install.agentDocumentationInstallId,
          currentVersion: version,
          installedFileCount,
          statusLabel: version
            ? this.countManifestChanges(version.fileChanges) > 0
              ? "Agent-installed docs changed"
              : `Checked against app docs${latestApplicationVersion ? ` v${latestApplicationVersion.version}` : ""}; installed files unchanged`
            : "This role has no installed docs yet",
        };
      }),
      appAnalysis: {
        latestProposal: latestProposal
          ? {
              ...latestProposal,
              files: latestProposalFiles,
            }
          : null,
        proposals,
      },
      bridgeContract: {
        readCapability: MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY,
        writeCapability: MARKETPLACE_LOCAL_REPO_DOCS_WRITE_CAPABILITY,
      },
    };
  }

  async analyzeLocalRepoDocumentation(
    workspaceId: string,
    appSlug: string,
    userId: string | null,
    options: {
      automationMode?: LocalRepoDocumentationAutomationMode;
      autoGenerated?: boolean;
      noUserReviewRequired?: boolean;
      trigger?: string;
    } = {},
  ) {
    const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
    const discovery = await this.discoverLocalRepoSource(linked);
    const analysisFiles = await this.readLocalRepoAnalysisFiles(
      linked,
      discovery,
    );
    const capabilityMap = this.extractLocalRepoCapabilityMap(
      linked,
      discovery,
      analysisFiles,
    );
    const comparison = this.compareCapabilityMapToLocalRepoDocs(
      capabilityMap,
      discovery,
    );
    const proposals = this.buildLocalRepoDocumentationProposalFiles(
      linked,
      discovery,
      capabilityMap,
      comparison,
    );
    const proposal = await this.documentationProposalRepo.save(
      this.documentationProposalRepo.create({
        workspaceId,
        linkedApplicationId: linked.id,
        packId: null,
        mode: "local_repo_app_analysis",
        status: proposals.length
          ? options.autoGenerated
            ? "auto_generated"
            : "pending_review"
          : "no_changes",
        summaries: [
          {
            title: "App analysis complete",
            message: proposals.length
              ? `Generated ${proposals.length} reviewable .clawchat documentation update proposals.`
              : "No concrete .clawchat documentation updates were needed.",
          },
        ],
        conflicts: [],
        reviewNotes: comparison.findings.map((finding) => ({
          path: finding.path ?? null,
          severity: finding.severity,
          message: finding.message,
        })),
        suggestedApplyActions: proposals.map((file) => ({
          path: file.relativePath,
          action: file.previousContent === null ? "create" : "update",
          rationale: file.metadata.rationale,
        })),
        compilerInputMetadata: {
          sourceHostType: discovery.sourceHostType,
          repoPath: discovery.repoPath ?? linked.repoPath,
          docsSourcePath: discovery.docsSourcePath,
          sourceHash: discovery.sourceHash,
          gitCommit: discovery.gitCommit ?? null,
          gitBranch: discovery.gitBranch ?? null,
          dirtyState: discovery.dirtyState ?? null,
          analyzedFileCount: analysisFiles.length,
          analysisHash: this.localRepoAnalysisFingerprint(analysisFiles),
          trigger: options.trigger ?? "manual_analysis",
        },
        compilerOutputMetadata: {
          capabilityMap,
          comparison,
          autoGenerated: options.autoGenerated === true,
          noUserReviewRequired: options.noUserReviewRequired === true,
          automationMode: options.automationMode ?? "manual_review",
          bridgeContract: {
            read: "marketplace.readLocalRepoDocs",
            apply: "marketplace.applyLocalRepoDocs",
            writeCapability: MARKETPLACE_LOCAL_REPO_DOCS_WRITE_CAPABILITY,
          },
        },
        createdByUserId: userId,
      }),
    );
    const files = await this.documentationProposalFileRepo.save(
      proposals.map((file) =>
        this.documentationProposalFileRepo.create({
          workspaceId,
          proposalId: proposal.id,
          relativePath: file.relativePath,
          previousContent: file.previousContent,
          updatedContent: file.updatedContent,
          previousHash:
            file.previousContent === null ? null : sha256(file.previousContent),
          updatedHash: sha256(file.updatedContent),
          classification: file.classification,
          refreshPolicy: file.refreshPolicy,
          conflictStatus: "none",
          requiresManualReview:
            options.noUserReviewRequired === true ? false : true,
          applyStatus: "pending",
          metadata: {
            ...file.metadata,
            autoGenerated: options.autoGenerated === true,
            noUserReviewRequired: options.noUserReviewRequired === true,
            automationMode: options.automationMode ?? "manual_review",
          },
        }),
      ),
    );
    return { ...proposal, files };
  }

  async getLocalRepoDocumentationProposal(
    workspaceId: string,
    appSlug: string,
    proposalId: string,
  ) {
    const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
    const proposal = await this.documentationProposalRepo.findOne({
      where: { id: proposalId, workspaceId, linkedApplicationId: linked.id },
    });
    if (!proposal)
      throw new NotFoundException(
        "Local repo documentation proposal not found",
      );
    const files = await this.documentationProposalFileRepo.find({
      where: { workspaceId, proposalId },
      order: { relativePath: "ASC" },
    });
    return { ...proposal, files };
  }

  async applyLocalRepoDocumentationProposal(
    workspaceId: string,
    appSlug: string,
    proposalId: string,
    userId: string,
    dto: ApplyLocalRepoDocsProposalDto,
  ) {
    const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
    const proposal = await this.getLocalRepoDocumentationProposal(
      workspaceId,
      appSlug,
      proposalId,
    );
    const proposalFiles = (proposal.files ??
      []) as DocumentationProposalFileEntity[];
    const approvedIds = new Set(
      dto.approvedFileIds?.length
        ? dto.approvedFileIds
        : proposalFiles
            .filter((file) => file.applyStatus === "pending")
            .map((file) => file.id),
    );
    const rejectedIds = new Set(dto.rejectedFileIds ?? []);
    const approvedFiles = proposalFiles.filter((file) =>
      approvedIds.has(file.id),
    );
    if (!approvedFiles.length && !rejectedIds.size) {
      throw new BadRequestException(
        "Select at least one proposed file to approve or reject.",
      );
    }
    for (const file of approvedFiles)
      this.assertLocalRepoProposalPath(file.relativePath);
    const discovery = await this.discoverLocalRepoSource(linked);
    await this.applyLocalRepoProposalFiles(linked, discovery, approvedFiles);
    if (approvedFiles.length) {
      await this.documentationProposalFileRepo.update(
        { id: In(approvedFiles.map((file) => file.id)) },
        { applyStatus: "applied" },
      );
    }
    if (rejectedIds.size) {
      await this.documentationProposalFileRepo.update(
        { id: In(Array.from(rejectedIds)) },
        { applyStatus: "rejected" },
      );
    }
    const remaining = await this.documentationProposalFileRepo.count({
      where: { workspaceId, proposalId, applyStatus: "pending" },
    });
    await this.documentationProposalRepo.update(proposalId, {
      status: remaining ? "partially_applied" : "applied",
      compilerOutputMetadata: {
        ...(proposal.compilerOutputMetadata ?? {}),
        lastAppliedAt: new Date().toISOString(),
        appliedFileCount: approvedFiles.length,
        rejectedFileCount: rejectedIds.size,
      },
    });
    const refreshResult = approvedFiles.length
      ? await this.refreshInstalledAgentDocs(workspaceId, appSlug, userId, {
          trigger: "approved_local_repo_docs_proposal",
        })
      : null;
    return {
      proposal: await this.getLocalRepoDocumentationProposal(
        workspaceId,
        appSlug,
        proposalId,
      ),
      appliedFiles: approvedFiles.map((file) => file.relativePath),
      rejectedFileIds: Array.from(rejectedIds),
      refresh: refreshResult,
      status: "applied",
    };
  }

  private async runLocalRepoDocumentationAutomationIfEnabled(
    workspaceId: string,
    appSlug: string,
    userId: string | null,
    trigger: string,
    options: { forceAnalyze?: boolean } = {},
  ) {
    const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
    if (this.getDocumentationAutomationMode(linked) === "manual_review")
      return null;
    return this.runLocalRepoDocumentationAutomation(
      workspaceId,
      appSlug,
      userId,
      trigger,
      options,
    );
  }

  private async runLocalRepoDocumentationAutomation(
    workspaceId: string,
    appSlug: string,
    userId: string | null,
    trigger: string,
    options: { forceAnalyze?: boolean } = {},
  ) {
    const key = `${workspaceId}:${appSlug}`;
    if (this.localRepoDocumentationAutomationRunning.has(key)) return null;
    this.localRepoDocumentationAutomationRunning.add(key);
    const startedAt = new Date().toISOString();
    let linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
    const automationMode = this.getDocumentationAutomationMode(linked);
    const runMetadata: Record<string, unknown> = {
      status: "running",
      startedAt,
      trigger,
      automationMode,
    };
    try {
      if (automationMode === "manual_review") return null;
      const beforeDiscovery = await this.discoverLocalRepoSource(linked);
      const analysisFiles = await this.readLocalRepoAnalysisFiles(
        linked,
        beforeDiscovery,
      );
      const analysisHash = this.localRepoAnalysisFingerprint(analysisFiles);
      const previousAnalysisHash =
        typeof linked.metadata?.lastDocumentationAnalysisHash === "string"
          ? linked.metadata.lastDocumentationAnalysisHash
          : null;
      const sourceHashChanged =
        linked.metadata?.sourceHash !== beforeDiscovery.sourceHash;
      const analysisChanged = previousAnalysisHash !== analysisHash;
      if (!options.forceAnalyze && !sourceHashChanged && !analysisChanged) {
        const skipped = {
          ...runMetadata,
          status: "skipped",
          reason: "source_and_analysis_unchanged",
          finishedAt: new Date().toISOString(),
          sourceHash: beforeDiscovery.sourceHash,
          analysisHash,
          sourceCommit: beforeDiscovery.gitCommit ?? null,
        };
        await this.updateLocalRepoAutomationMetadata(linked, skipped, {
          lastDocumentationAnalysisHash: analysisHash,
        });
        return { status: "skipped", run: skipped };
      }

      const proposal = await this.analyzeLocalRepoDocumentation(
        workspaceId,
        appSlug,
        userId,
        {
          automationMode,
          autoGenerated: true,
          noUserReviewRequired: true,
          trigger,
        },
      );
      const proposalFiles = (
        (proposal.files ?? []) as DocumentationProposalFileEntity[]
      ).filter((file) => file.applyStatus === "pending");
      this.assertAutoApplyAllowed(
        automationMode,
        beforeDiscovery,
        proposalFiles,
      );
      let appliedFiles: DocumentationProposalFileEntity[] = [];
      if (proposalFiles.length) {
        await this.applyLocalRepoProposalFiles(
          linked,
          beforeDiscovery,
          proposalFiles,
        );
        const afterDiscovery = await this.discoverLocalRepoSource(linked);
        this.assertAppliedFilesPresent(afterDiscovery, proposalFiles);
        appliedFiles = proposalFiles;
        await this.documentationProposalFileRepo.update(
          { id: In(appliedFiles.map((file) => file.id)) },
          { applyStatus: "applied" },
        );
      }
      await this.documentationProposalRepo.update(proposal.id, {
        status: "auto_applied",
        compilerOutputMetadata: {
          ...(proposal.compilerOutputMetadata ?? {}),
          autoApplied: true,
          appliedBySystem: true,
          noUserReviewRequired: true,
          automationMode,
          appliedAt: new Date().toISOString(),
          appliedFileCount: appliedFiles.length,
          appliedFiles: appliedFiles.map((file) => ({
            path: file.relativePath,
            previousHash: file.previousHash,
            updatedHash: file.updatedHash,
          })),
        },
      });
      const refreshResult = await this.refreshInstalledAgentDocs(
        workspaceId,
        appSlug,
        userId ?? "",
        {
          trigger: `auto_${trigger}`,
        },
      );
      linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
      const latestVersion =
        linked.metadata?.currentDocumentationVersion ??
        refreshResult.app.sourceMetadata?.currentDocumentationVersion ??
        null;
      const finished = {
        ...runMetadata,
        status: "auto_applied",
        finishedAt: new Date().toISOString(),
        sourceCommit: beforeDiscovery.gitCommit ?? null,
        sourceBranch: beforeDiscovery.gitBranch ?? null,
        dirtyBefore: beforeDiscovery.dirtyState ?? null,
        dirtyFilesBefore: beforeDiscovery.dirtyFiles ?? null,
        filesAnalyzed: analysisFiles.length,
        docsGenerated: proposalFiles.length,
        filesAutoApplied: appliedFiles.map((file) => ({
          path: file.relativePath,
          previousHash: file.previousHash,
          updatedHash: file.updatedHash,
        })),
        proposalId: proposal.id,
        canonicalDocsVersion: latestVersion,
        generatedPackStatus:
          refreshResult.generatedPack?.publicationStatus ?? null,
        agentInstallsUpdated:
          refreshResult.installs?.map((install) => ({
            id: install.id,
            agentId: install.agentId,
            role: install.role,
            agentDocumentationInstallId: install.agentDocumentationInstallId,
          })) ?? [],
        warnings: beforeDiscovery.warnings,
      };
      await this.updateLocalRepoAutomationMetadata(linked, finished, {
        lastDocumentationAnalysisHash: analysisHash,
      });
      await this.auditLogService.record({
        actorType: userId ? "user" : "system",
        actorId: userId,
        workspaceId,
        eventType: "marketplace.local_repo_docs.auto_applied",
        resourceType: "marketplace_app",
        resourceId: appSlug,
        metadata: finished,
      });
      return { status: "auto_applied", run: finished, refreshResult };
    } catch (error) {
      const failed = {
        ...runMetadata,
        status: "blocked",
        finishedAt: new Date().toISOString(),
        reason: error instanceof Error ? error.message : String(error),
      };
      await this.updateLocalRepoAutomationMetadata(linked, failed);
      await this.auditLogService.record({
        actorType: userId ? "user" : "system",
        actorId: userId,
        workspaceId,
        eventType: "marketplace.local_repo_docs.auto_apply_blocked",
        resourceType: "marketplace_app",
        resourceId: appSlug,
        metadata: failed,
      });
      this.logger.warn(
        `Local repo docs automation blocked for ${workspaceId}/${appSlug}: ${failed.reason}`,
      );
      return { status: "blocked", run: failed };
    } finally {
      this.localRepoDocumentationAutomationRunning.delete(key);
    }
  }

  private assertAutoApplyAllowed(
    automationMode: LocalRepoDocumentationAutomationMode,
    discovery: LocalRepoDiscovery,
    files: DocumentationProposalFileEntity[],
  ) {
    if (automationMode === "manual_review") {
      throw new BadRequestException(
        "Documentation automation is set to manual review.",
      );
    }
    if (!discovery.bridgeDeviceId) {
      throw new BadRequestException(
        "source host unavailable: no bridge device selected",
      );
    }
    for (const file of files) {
      this.assertLocalRepoProposalPath(file.relativePath);
      if (!file.relativePath.startsWith(".clawchat/")) {
        throw new BadRequestException("proposal contains non-.clawchat writes");
      }
      const blocked = [".env", "node_modules/", "dist/", "build/", ".next/"];
      if (blocked.some((part) => file.relativePath.includes(part))) {
        throw new BadRequestException(`unsafe file path: ${file.relativePath}`);
      }
    }
    if (discovery.dirtyState === true) {
      const dirtyFiles = discovery.dirtyFiles;
      if (!Array.isArray(dirtyFiles)) {
        return;
      }
      const proposed = new Set(
        files.map((file) => this.normalizeDirtyPath(file.relativePath)),
      );
      const overlapping = dirtyFiles
        .map((path) => this.normalizeDirtyPath(path))
        .filter(
          (path) => proposed.has(path) || proposed.has(`.clawchat/${path}`),
        );
      if (overlapping.length) {
        throw new BadRequestException(
          `repo dirty conflict: dirty files overlap proposed docs writes (${overlapping.join(", ")})`,
        );
      }
    }
  }

  private assertAppliedFilesPresent(
    discovery: LocalRepoDiscovery,
    files: DocumentationProposalFileEntity[],
  ) {
    const byPath = new Map(
      discovery.files.map((file) => [
        `.clawchat/${file.relativePath}`,
        file.hash,
      ]),
    );
    const mismatches = files.filter(
      (file) => byPath.get(file.relativePath) !== file.updatedHash,
    );
    if (mismatches.length) {
      throw new BadRequestException(
        `generated docs failed validation: ${mismatches.map((file) => file.relativePath).join(", ")}`,
      );
    }
  }

  private async updateLocalRepoAutomationMetadata(
    linked: LinkedApplicationEntity,
    run: Record<string, unknown>,
    extra: Record<string, unknown> = {},
  ) {
    linked.metadata = {
      ...linked.metadata,
      ...extra,
      lastDocumentationAutomationRun: run,
      lastDocumentationAutomationAt: new Date().toISOString(),
    };
    linked.apiStyleMetadata = {
      ...linked.apiStyleMetadata,
      ...linked.metadata,
    };
    await this.linkedApplicationRepo.save(linked);
  }

  private normalizeDocumentationAutomationMode(
    value: unknown,
  ): LocalRepoDocumentationAutomationMode {
    return value === "auto_apply_safe" || value === "auto_apply_full"
      ? value
      : "manual_review";
  }

  private getDocumentationAutomationMode(
    linked: LinkedApplicationEntity,
  ): LocalRepoDocumentationAutomationMode {
    return this.normalizeDocumentationAutomationMode(
      linked.metadata?.documentationAutomationMode ??
        linked.apiStyleMetadata?.documentationAutomationMode,
    );
  }

  private getLocalAppAutonomyPolicy(
    linked:
      | LinkedApplicationEntity
      | {
          metadata?: Record<string, unknown>;
          apiStyleMetadata?: Record<string, unknown>;
        },
  ): LocalAppAutonomyPolicy {
    return normalizeLocalAppAutonomyPolicy(
      linked.metadata?.autonomyPolicy ??
        linked.apiStyleMetadata?.autonomyPolicy,
    );
  }

  async syncLocalAppConnectorCampaignPolicy(
    workspaceId: string,
    appSlug: string,
    userId: string,
    input?: { campaignId?: string | null; campaignName?: string | null },
  ) {
    const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
    if (input?.campaignId !== undefined || input?.campaignName !== undefined) {
      linked.metadata = {
        ...(linked.metadata ?? {}),
        ...(input.campaignId !== undefined
          ? { localappconnectorCampaignId: input.campaignId?.trim() || null }
          : {}),
        ...(input.campaignName !== undefined
          ? {
              localappconnectorCampaignName: input.campaignName?.trim() || null,
            }
          : {}),
      };
      linked.apiStyleMetadata = {
        ...(linked.apiStyleMetadata ?? {}),
        ...linked.metadata,
      };
      await this.linkedApplicationRepo.save(linked);
    }
    const result = await this.syncLocalAppConnectorCampaignPolicyForLinkedApp(
      workspaceId,
      linked,
      {
        policy: this.getLocalAppAutonomyPolicy(linked),
        reason: "manual_sync",
      },
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.localappconnector_policy.sync_requested",
      resourceType: "marketplace_app",
      resourceId: appSlug,
      metadata: {
        appSlug,
        result,
      },
    });
    return result;
  }

  async configureLocalAppConnectorOpenClaw(
    workspaceId: string,
    appSlug: string,
    userId: string,
    input: ConfigureLocalAppConnectorOpenClawDto,
  ) {
    const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
    if (!this.isLocalAppConnectorApp(linked.slug, linked.name)) {
      throw new BadRequestException(
        "This OpenClaw configuration is only available for LocalAppConnector local apps.",
      );
    }
    const baseUrl = input.openclawBaseUrl.trim().replace(/\/+$/, "");
    if (!baseUrl) {
      throw new BadRequestException("OpenClaw base URL is required.");
    }
    const existingConnectionId =
      this.stringOrNull(
        linked.metadata?.localappconnectorOpenClawConnectionId,
      ) ??
      this.stringOrNull(
        linked.apiStyleMetadata?.localappconnectorOpenClawConnectionId,
      );
    const connection =
      await this.bridgeService.configureWorkspaceOpenClawConnection({
        workspaceId,
        connectionId: existingConnectionId,
        instanceUrl: baseUrl,
        apiKey: input.bearerKey,
        useMockMode: false,
        actorUserId: userId,
      });
    const status = {
      connected: true,
      useMockMode: connection.useMockMode,
      hasBearerKey:
        Boolean(input.bearerKey?.trim()) || Boolean(existingConnectionId),
      checkedAt: new Date().toISOString(),
    };
    linked.metadata = {
      ...(linked.metadata ?? {}),
      localappconnectorOpenClawBaseUrl: baseUrl,
      localappconnectorOpenClawConnectionId: connection.id,
      localappconnectorOpenClawStatus: status,
      ...(input.campaignId !== undefined
        ? { localappconnectorCampaignId: input.campaignId?.trim() || null }
        : {}),
      ...(input.campaignName !== undefined
        ? { localappconnectorCampaignName: input.campaignName?.trim() || null }
        : {}),
    };
    linked.apiStyleMetadata = {
      ...(linked.apiStyleMetadata ?? {}),
      ...linked.metadata,
    };
    await this.linkedApplicationRepo.save(linked);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.localappconnector_openclaw.configured",
      resourceType: "marketplace_app",
      resourceId: appSlug,
      metadata: {
        appSlug,
        baseUrl,
        connectionId: connection.id,
        campaignId: linked.metadata.localappconnectorCampaignId ?? null,
        campaignName: linked.metadata.localappconnectorCampaignName ?? null,
        bearerKeyUpdated: Boolean(input.bearerKey?.trim()),
      },
    });
    return this.listCatalog(workspaceId, userId);
  }

  async autoConnectLocalApp(
    workspaceId: string,
    appSlug: string,
    userId: string,
    input: AutoConnectLocalAppDto,
  ): Promise<LocalAppAutoConnectResult> {
    const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
    if (!this.isLocalAppConnectorApp(linked.slug, linked.name)) {
      throw new BadRequestException(
        "One-click Agent API setup is currently available for LocalAppConnector local apps.",
      );
    }
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    const policy = normalizeLocalAppAutonomyPolicy({
      ...(input.autonomyPolicy ?? this.getLocalAppAutonomyPolicy(linked)),
      ...(input.autonomyMode ? { mode: input.autonomyMode } : {}),
    });
    this.assertDangerousPolicyAcknowledged(
      policy.mode,
      input.acknowledgeDangerouslySkipPermissions,
    );
    const approvalProfileId = this.resolveApprovalProfileId(
      app,
      input.approvalProfileId?.trim() || undefined,
      input.acknowledgeDangerouslySkipPermissions,
    );
    linked.metadata = {
      ...(linked.metadata ?? {}),
      autonomyPolicy: policy,
      ...this.dangerousPolicyAcknowledgementMetadata(policy.mode, userId),
      ...(input.sourceHostId ? { sourceHostId: input.sourceHostId } : {}),
    };
    linked.apiStyleMetadata = {
      ...(linked.apiStyleMetadata ?? {}),
      ...linked.metadata,
    };
    await this.linkedApplicationRepo.save(linked);
    await this.pauseConflictingScheduledMessagesForLocalApp(
      workspaceId,
      appSlug,
      policy,
    );

    const source = {
      ...(linked.apiStyleMetadata ?? {}),
      ...(linked.metadata ?? {}),
    };
    const agentApiBaseUrl = this.deriveLocalAppConnectorAgentApiBaseUrl(source);
    const setup = await this.bridgeService.setupMarketplaceLocalAppAgentApi(
      workspaceId,
      {
        appSlug,
        appName: linked.name,
        sourceHostId: this.stringOrNull(source.sourceHostId),
        bridgeDeviceId: this.stringOrNull(source.bridgeDeviceId),
        sourceHostType: this.stringOrNull(source.sourceHostType),
        runtimeType: this.stringOrNull(source.runtimeType),
        localAppUrl: this.stringOrNull(source.localAppUrl),
        localApiUrl: this.stringOrNull(source.localApiUrl),
        agentApiBaseUrl,
        legacyRouteNamespace: "/api/openclaw",
        desiredCampaignId:
          input.campaignId?.trim() ||
          this.stringOrNull(source.localappconnectorCampaignId),
        desiredCampaignName:
          input.campaignName?.trim() ||
          this.stringOrNull(source.localappconnectorCampaignName),
        autonomyPolicy: policy,
      },
    );

    const campaigns = this.normalizeLocalAppCampaigns(setup.campaigns ?? []);
    const selectedCampaign = this.selectLocalAppCampaign(
      campaigns,
      setup,
      input,
    );
    const existingConnectionId =
      this.resolveLocalAppConnectorOpenClawConnectionId(linked);
    const bearer =
      typeof setup.bearerKey === "string" ? setup.bearerKey.trim() : "";
    const connection =
      bearer || agentApiBaseUrl
        ? await this.bridgeService.configureWorkspaceOpenClawConnection({
            workspaceId,
            connectionId: existingConnectionId,
            instanceUrl: setup.agentApiBaseUrl?.trim() || agentApiBaseUrl,
            apiKey: bearer || null,
            useMockMode: false,
            actorUserId: userId,
          })
        : null;

    const hasStoredBearer = Boolean(bearer || existingConnectionId);
    const baseUrl = setup.agentApiBaseUrl?.trim() || agentApiBaseUrl;
    const campaignMapped = Boolean(selectedCampaign?.id);
    linked.metadata = {
      ...(linked.metadata ?? {}),
      autonomyPolicy: policy,
      localappconnectorOpenClawBaseUrl: baseUrl || null,
      localappconnectorOpenClawConnectionId:
        connection?.id ?? existingConnectionId ?? null,
      localappconnectorOpenClawStatus: {
        connected: Boolean(connection),
        useMockMode: false,
        hasBearerKey: hasStoredBearer,
        checkedAt: new Date().toISOString(),
        label: "LocalAppConnector Agent API",
        legacyRouteNamespace: "/api/openclaw",
        source: "bridge_auto_connect",
        sourceHostReachable: setup.sourceHostReachable === true,
        localAppReachable: setup.localAppReachable === true,
        agentApiRouteReachable: setup.agentApiRouteReachable === true,
        authenticatedSettingsStatus: setup.authenticatedSettingsStatus ?? null,
        hermesCredentialAttached: false,
      },
      localappconnectorCampaigns: campaigns,
      ...(selectedCampaign
        ? {
            localappconnectorCampaignId: selectedCampaign.id,
            localappconnectorCampaignName: selectedCampaign.name,
            localappconnectorCampaign: selectedCampaign,
          }
        : {}),
    };
    linked.apiStyleMetadata = {
      ...(linked.apiStyleMetadata ?? {}),
      ...linked.metadata,
    };
    await this.linkedApplicationRepo.save(linked);

    if (!campaignMapped) {
      const result = this.buildLocalAppAutoConnectResult({
        status: "action_required",
        message:
          campaigns.length > 1
            ? "Multiple LocalAppConnector campaigns were found. Select one campaign, then continue the connection."
            : "No LocalAppConnector campaign was found. Create or select a campaign before installing agent packs.",
        app: await this.resolveMarketplaceApp(workspaceId, appSlug),
        connectionId: connection?.id ?? existingConnectionId ?? null,
        setup,
        campaigns,
        selectedCampaign: null,
        policySync: null,
        installResults: [],
        docsRefreshed: false,
        agentPacksInstalled: false,
        toolDescriptorSentToHermes: false,
        userActionRequired:
          campaigns.length > 1
            ? "select_campaign"
            : "create_or_select_campaign",
        bearerStoredEncrypted: hasStoredBearer,
      });
      await this.auditLogService.record({
        actorType: "user",
        actorId: userId,
        workspaceId,
        eventType:
          "marketplace.localappconnector_agent_api.auto_connect.action_required",
        resourceType: "marketplace_app",
        resourceId: appSlug,
        metadata: {
          appSlug,
          campaignCount: campaigns.length,
          bearerStoredEncrypted: hasStoredBearer,
        },
      });
      return result;
    }

    const policySync = this.normalizeBridgePolicySyncResult(
      setup.policySync,
      selectedCampaign,
      policy,
    );
    await this.persistLocalAppConnectorPolicySyncResult(linked, policySync);

    let docsRefreshed = false;
    const installResults: Array<Record<string, unknown>> = [];
    try {
      await this.updatePack(workspaceId, appSlug, userId);
      docsRefreshed = true;
    } catch (error) {
      installResults.push({
        status: "failed",
        stage: "docs_refresh",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const selectedCapabilities = localAppAutonomySelectedCapabilities(policy);
    const marketplaceConnection =
      await this.ensureLocalAppMarketplaceConnection(
        workspaceId,
        userId,
        await this.resolveMarketplaceApp(workspaceId, appSlug),
        selectedCapabilities,
      );
    const packInstallResults = await this.installSelectedLocalAppAgents({
      workspaceId,
      userId,
      appSlug,
      connectionId: marketplaceConnection.id,
      selectedCapabilities,
      approvalProfileId,
      acknowledgeDangerouslySkipPermissions:
        input.acknowledgeDangerouslySkipPermissions,
      workerAgentIds: input.workerAgentIds ?? [],
      managerAgentId: input.managerAgentId,
      auditorAgentId: input.auditorAgentId,
    });
    installResults.push(...packInstallResults);
    const agentPacksInstalled = packInstallResults.some(
      (result) =>
        result.status === "installed" || Array.isArray(result.installs),
    );
    const toolDescriptorSentToHermes = agentPacksInstalled && hasStoredBearer;
    const status =
      policySync.status === "synced" && docsRefreshed && agentPacksInstalled
        ? "connected"
        : "partial";

    const result = this.buildLocalAppAutoConnectResult({
      status,
      message:
        status === "connected"
          ? "LocalAppConnector Agent API connected, campaign policy synced, and agent packs installed."
          : "LocalAppConnector Agent API setup finished with follow-up required. Check diagnostics before using the app.",
      app: await this.resolveMarketplaceApp(workspaceId, appSlug),
      connectionId: marketplaceConnection.id,
      setup,
      campaigns,
      selectedCampaign,
      policySync,
      installResults,
      docsRefreshed,
      agentPacksInstalled,
      toolDescriptorSentToHermes,
      userActionRequired: status === "connected" ? null : "review_diagnostics",
      bearerStoredEncrypted: hasStoredBearer,
    });
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType:
        "marketplace.localappconnector_agent_api.auto_connect.completed",
      resourceType: "marketplace_app",
      resourceId: appSlug,
      metadata: {
        appSlug,
        status,
        connectionId: marketplaceConnection.id,
        campaignId: selectedCampaign.id,
        policySyncStatus: policySync.status,
        docsRefreshed,
        agentPacksInstalled,
        toolDescriptorSentToHermes,
      },
    });
    return result;
  }

  private async syncLocalAppConnectorCampaignPolicyForLinkedApp(
    workspaceId: string,
    linked: LinkedApplicationEntity,
    input: { policy: LocalAppAutonomyPolicy; reason: string },
  ): Promise<LocalAppConnectorPolicySyncResult> {
    if (!this.isLocalAppConnectorApp(linked.slug, linked.name)) {
      return {
        status: "skipped",
        message: "Not a LocalAppConnector local app.",
        campaignId: null,
        campaignName: null,
        clawchatMode: input.policy.mode,
        localappconnectorMode: null,
        lastSyncAt: new Date().toISOString(),
        mismatch: false,
      };
    }
    const campaign = this.resolveLocalAppConnectorCampaign(linked);
    if (!campaign.campaignId && !campaign.campaignName) {
      const result: LocalAppConnectorPolicySyncResult = {
        status: "unsynced",
        message:
          "ClawChat mode set, but LocalAppConnector campaign policy not synced. Select a LocalAppConnector campaign and sync once.",
        campaignId: null,
        campaignName: null,
        clawchatMode: input.policy.mode,
        localappconnectorMode: null,
        lastSyncAt: new Date().toISOString(),
        mismatch: true,
      };
      await this.persistLocalAppConnectorPolicySyncResult(linked, result);
      return result;
    }
    if (!campaign.campaignId) {
      const result: LocalAppConnectorPolicySyncResult = {
        status: "unsynced",
        message:
          "ClawChat mode set, but LocalAppConnector campaign policy not synced. Select a LocalAppConnector campaign ID and sync again.",
        campaignId: null,
        campaignName: campaign.campaignName,
        clawchatMode: input.policy.mode,
        localappconnectorMode: null,
        lastSyncAt: new Date().toISOString(),
        mismatch: true,
      };
      await this.persistLocalAppConnectorPolicySyncResult(linked, result);
      return result;
    }

    const payload = {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      mode: this.mapClawChatModeToLocalAppConnectorMode(input.policy.mode),
      clawchatAutonomyPolicy: input.policy,
      hardStops: input.policy.hardStops,
      evidenceRequired: input.policy.evidenceRequired,
      source: "clawchat",
      reason: input.reason,
    };

    try {
      const getPolicy = await this.bridgeService.callOpenClawOperation({
        workspaceId,
        operation: "autonomy.get_policy",
        connectionId: this.resolveLocalAppConnectorOpenClawConnectionId(linked),
        payload: {
          campaignId: campaign.campaignId,
        },
      });
      const updatePolicy = await this.bridgeService.callOpenClawOperation({
        workspaceId,
        operation: "autonomy.update_policy",
        connectionId: this.resolveLocalAppConnectorOpenClawConnectionId(linked),
        payload: {
          policy: this.toLocalAppConnectorAutonomyPolicy(payload, input.policy),
        },
      });
      const explainPolicy = await this.bridgeService.callOpenClawOperation({
        workspaceId,
        operation: "autonomy.explain_effective_policy",
        connectionId: this.resolveLocalAppConnectorOpenClawConnectionId(linked),
        payload: {
          campaignId: campaign.campaignId,
        },
      });
      const localappconnectorMode =
        this.extractPolicyMode(explainPolicy.data) ??
        this.extractPolicyMode(updatePolicy.data) ??
        payload.mode;
      const result: LocalAppConnectorPolicySyncResult = {
        status: "synced",
        message:
          "LocalAppConnector campaign policy synced from ClawChat autonomy mode.",
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        clawchatMode: input.policy.mode,
        localappconnectorMode,
        lastSyncAt: new Date().toISOString(),
        mismatch: localappconnectorMode !== payload.mode,
        getPolicyResult: getPolicy.data,
        updatePolicyResult: updatePolicy.data,
        explainEffectivePolicyResult: explainPolicy.data,
      };
      await this.persistLocalAppConnectorPolicySyncResult(linked, result);
      return result;
    } catch (error) {
      const result: LocalAppConnectorPolicySyncResult = {
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "LocalAppConnector campaign policy sync failed.",
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        clawchatMode: input.policy.mode,
        localappconnectorMode: null,
        lastSyncAt: new Date().toISOString(),
        mismatch: true,
        errorCode:
          typeof (error as { response?: { statusCode?: unknown } })?.response
            ?.statusCode === "number"
            ? String(
                (error as { response: { statusCode: number } }).response
                  .statusCode,
              )
            : null,
      };
      await this.persistLocalAppConnectorPolicySyncResult(linked, result);
      return result;
    }
  }

  private async persistLocalAppConnectorPolicySyncResult(
    linked: LinkedApplicationEntity,
    result: LocalAppConnectorPolicySyncResult,
  ) {
    linked.metadata = {
      ...(linked.metadata ?? {}),
      localappconnectorCampaignId: result.campaignId,
      localappconnectorCampaignName: result.campaignName,
      localappconnectorPolicySync: result,
    };
    linked.apiStyleMetadata = {
      ...(linked.apiStyleMetadata ?? {}),
      localappconnectorCampaignId: result.campaignId,
      localappconnectorCampaignName: result.campaignName,
      localappconnectorPolicySync: result,
    };
    await this.linkedApplicationRepo.save(linked);
  }

  private isLocalAppConnectorApp(appSlug: string, appName?: string | null) {
    const normalized = `${appSlug} ${appName ?? ""}`.toLowerCase();
    return normalized.includes("localappconnector");
  }

  private resolveLocalAppConnectorCampaign(linked: LinkedApplicationEntity) {
    const metadata = {
      ...(linked.apiStyleMetadata ?? {}),
      ...(linked.metadata ?? {}),
    };
    const campaign =
      this.objectOrNull(metadata.localappconnectorCampaign) ??
      this.objectOrNull(metadata.campaign) ??
      this.objectOrNull(metadata.campaignMapping) ??
      {};
    return {
      campaignId:
        this.stringOrNull(metadata.localappconnectorCampaignId) ??
        this.stringOrNull(metadata.campaignId) ??
        this.stringOrNull(campaign.id) ??
        this.stringOrNull(campaign.campaignId),
      campaignName:
        this.stringOrNull(metadata.localappconnectorCampaignName) ??
        this.stringOrNull(metadata.campaignName) ??
        this.stringOrNull(campaign.name) ??
        this.stringOrNull(campaign.campaignName),
    };
  }

  private mapClawChatModeToLocalAppConnectorMode(mode: string) {
    if (mode === "supervised_external") return "supervised_external";
    if (mode === "internal_write") return "internal_write";
    if (mode === "custom_policy") return "custom_policy";
    if (mode === "dangerously_skip_permissions")
      return "dangerously_skip_permissions";
    return "safe_default";
  }

  private resolveLocalAppConnectorOpenClawConnectionId(
    linked: LinkedApplicationEntity,
  ) {
    return (
      this.stringOrNull(
        linked.metadata?.localappconnectorOpenClawConnectionId,
      ) ??
      this.stringOrNull(
        linked.apiStyleMetadata?.localappconnectorOpenClawConnectionId,
      )
    );
  }

  private deriveLocalAppConnectorAgentApiBaseUrl(
    source: Record<string, unknown>,
  ) {
    const explicit =
      this.stringOrNull(source.localappconnectorOpenClawBaseUrl) ??
      this.stringOrNull(source.agentApiBaseUrl);
    const candidate =
      explicit ??
      this.stringOrNull(source.localApiUrl) ??
      this.stringOrNull(source.localAppUrl);
    if (!candidate) {
      throw new BadRequestException(
        "LocalAppConnector Agent API base URL could not be derived. Set the local app URL or Agent API base URL in Advanced.",
      );
    }
    try {
      const url = new URL(candidate);
      return `${url.protocol}//${url.host}`;
    } catch {
      return candidate.trim().replace(/\/+$/, "");
    }
  }

  private normalizeLocalAppCampaigns(
    campaigns: MarketplaceLocalAppCampaignPayload[],
  ): MarketplaceLocalAppCampaignPayload[] {
    return campaigns
      .map((campaign) => ({
        id: String(campaign.id ?? "").trim(),
        name: String(campaign.name ?? "").trim(),
        slug: this.stringOrNull(campaign.slug),
        status: this.stringOrNull(campaign.status),
        metadata:
          campaign.metadata && typeof campaign.metadata === "object"
            ? campaign.metadata
            : undefined,
      }))
      .filter((campaign) => campaign.id && campaign.name);
  }

  private selectLocalAppCampaign(
    campaigns: MarketplaceLocalAppCampaignPayload[],
    setup: MarketplaceLocalAppAgentApiSetupResponsePayload,
    input: AutoConnectLocalAppDto,
  ): MarketplaceLocalAppCampaignPayload | null {
    const requestedId = input.campaignId?.trim();
    const requestedName = input.campaignName?.trim();
    if (requestedId) {
      return campaigns.find((campaign) => campaign.id === requestedId) ?? null;
    }
    if (setup.selectedCampaign?.id) {
      return {
        id: setup.selectedCampaign.id,
        name: setup.selectedCampaign.name,
        slug: setup.selectedCampaign.slug ?? null,
        status: setup.selectedCampaign.status ?? null,
        metadata: setup.selectedCampaign.metadata,
      };
    }
    if (requestedName) {
      const normalized = requestedName.toLowerCase();
      const named = campaigns.find(
        (campaign) =>
          campaign.name.toLowerCase() === normalized ||
          campaign.slug?.toLowerCase() === normalized,
      );
      if (named) return named;
    }
    const active = campaigns.filter((campaign) =>
      ["active", "running", "enabled"].includes(
        String(campaign.status ?? "active").toLowerCase(),
      ),
    );
    if (active.length === 1) return active[0];
    if (!active.length && campaigns.length === 1) return campaigns[0];
    return null;
  }

  private normalizeBridgePolicySyncResult(
    raw: Record<string, unknown> | null | undefined,
    campaign: MarketplaceLocalAppCampaignPayload,
    policy: LocalAppAutonomyPolicy,
  ): LocalAppConnectorPolicySyncResult {
    const expectedMode = this.mapClawChatModeToLocalAppConnectorMode(
      policy.mode,
    );
    const localappconnectorMode = this.extractPolicyMode(raw) ?? expectedMode;
    const status =
      raw && String(raw.status ?? "synced") !== "failed"
        ? "synced"
        : "unsynced";
    return {
      status,
      message:
        status === "synced"
          ? "LocalAppConnector campaign policy synced from ClawChat autonomy mode."
          : "ClawChat mode set, but LocalAppConnector campaign policy not synced by the runtime host.",
      campaignId: campaign.id,
      campaignName: campaign.name,
      clawchatMode: policy.mode,
      localappconnectorMode: status === "synced" ? localappconnectorMode : null,
      lastSyncAt: new Date().toISOString(),
      mismatch: status !== "synced" || localappconnectorMode !== expectedMode,
      updatePolicyResult: raw ?? null,
    };
  }

  private async ensureLocalAppMarketplaceConnection(
    workspaceId: string,
    userId: string,
    app: MarketplaceAppDefinition,
    selectedCapabilities: string[],
  ) {
    const existing = await this.connectionRepo.findOne({
      where: { workspaceId, appSlug: app.slug, status: "ready" },
      order: { updatedAt: "DESC" },
    });
    const encrypted = this.encryptCredentials({});
    const connection =
      existing ??
      this.connectionRepo.create({
        workspaceId,
        appSlug: app.slug,
        createdByUserId: userId,
      });
    connection.displayName = `${app.name} Agent API`;
    connection.environment = "default";
    connection.authType = "local_agent_api";
    connection.credentialNames = ["localappconnector_agent_api_bearer"];
    connection.secretCiphertext = encrypted.ciphertext;
    connection.secretIv = encrypted.iv;
    connection.secretAuthTag = encrypted.authTag;
    connection.secretKeyVersion = encrypted.keyVersion;
    connection.selectedCapabilities = this.normalizeCapabilities(
      app,
      selectedCapabilities,
    );
    connection.status = "ready";
    connection.lastValidatedAt = new Date();
    connection.metadata = this.buildConnectionMetadata(app, {
      ...(app.sourceMetadata ?? {}),
      autonomyPolicy: app.sourceMetadata?.autonomyPolicy,
      agentApiConnectionLabel: "LocalAppConnector Agent API",
      legacyRouteNamespace: "/api/openclaw",
    });
    connection.updatedByUserId = userId;
    return this.connectionRepo.save(connection);
  }

  private async installSelectedLocalAppAgents(input: {
    workspaceId: string;
    userId: string;
    appSlug: string;
    connectionId: string;
    selectedCapabilities: string[];
    approvalProfileId?: string;
    acknowledgeDangerouslySkipPermissions?: boolean;
    workerAgentIds: string[];
    managerAgentId?: string | null;
    auditorAgentId?: string | null;
  }): Promise<Array<Record<string, unknown>>> {
    const targets: Array<{ agentId: string; role: MarketplaceInstallRole }> = [
      ...input.workerAgentIds.map((agentId) => ({ agentId, role: "worker" })),
      ...(input.managerAgentId
        ? [{ agentId: input.managerAgentId, role: "manager" }]
        : []),
      ...(input.auditorAgentId
        ? [{ agentId: input.auditorAgentId, role: "auditor" }]
        : []),
    ];
    const deduped = new Map<
      string,
      { agentId: string; role: MarketplaceInstallRole }
    >();
    for (const target of targets) {
      if (target.agentId?.trim()) {
        deduped.set(`${target.agentId}:${target.role}`, target);
      }
    }
    if (!deduped.size) {
      return [
        {
          status: "failed",
          stage: "install",
          message:
            "Select at least one agent before installing LocalAppConnector.",
        },
      ];
    }
    const results: Array<Record<string, unknown>> = [];
    for (const target of deduped.values()) {
      try {
        const agent = await this.agentService.findOne(
          target.agentId,
          input.userId,
        );
        const runtimeType = this.resolveAgentRuntimeType(agent as AgentEntity);
        const runtimeFormat = runtimeType === "hermes" ? "hermes" : "openclaw";
        const result = await this.install(input.workspaceId, input.userId, {
          appSlug: input.appSlug,
          connectionId: input.connectionId,
          selectedCapabilities: input.selectedCapabilities,
          approvalProfileId: input.approvalProfileId,
          runtimeFormat,
          agentIds: [target.agentId],
          role: target.role,
          libraryTargetFolder: `marketplace/${input.appSlug}`,
          targetMode: "existing_agents",
          acknowledgeGeneratedDraftRisk: true,
          acknowledgeDangerouslySkipPermissions:
            input.acknowledgeDangerouslySkipPermissions,
        });
        results.push({
          status: result.status ?? "installed",
          stage: "install",
          agentId: target.agentId,
          role: target.role,
          runtimeFormat: result.runtimeFormat,
          installCount: result.installs.length,
          message:
            "message" in result && typeof result.message === "string"
              ? result.message
              : null,
          requiredCapability:
            "requiredCapability" in result &&
            typeof result.requiredCapability === "string"
              ? result.requiredCapability
              : null,
        });
      } catch (error) {
        results.push({
          status: "failed",
          stage: "install",
          agentId: target.agentId,
          role: target.role,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }

  private buildLocalAppAutoConnectResult(input: {
    status: LocalAppAutoConnectResult["status"];
    message: string;
    app: MarketplaceAppDefinition;
    connectionId: string | null;
    setup: MarketplaceLocalAppAgentApiSetupResponsePayload;
    campaigns: MarketplaceLocalAppCampaignPayload[];
    selectedCampaign: MarketplaceLocalAppCampaignPayload | null;
    policySync:
      | LocalAppConnectorPolicySyncResult
      | Record<string, unknown>
      | null;
    installResults: Array<Record<string, unknown>>;
    docsRefreshed: boolean;
    agentPacksInstalled: boolean;
    toolDescriptorSentToHermes: boolean;
    userActionRequired: string | null;
    bearerStoredEncrypted: boolean;
  }): LocalAppAutoConnectResult {
    const authenticatedStatus = Number(
      input.setup.authenticatedSettingsStatus ?? 0,
    );
    const checklist = {
      sourceHostReachable: input.setup.sourceHostReachable === true,
      localAppReachable: input.setup.localAppReachable === true,
      agentApiRouteReachable: input.setup.agentApiRouteReachable === true,
      agentApiKeyConfigured: input.setup.agentApiKeyConfigured === true,
      bearerStoredEncrypted: input.bearerStoredEncrypted,
      authenticatedAgentApiCallPassed:
        authenticatedStatus >= 200 && authenticatedStatus < 300,
      campaignDiscovered: input.campaigns.length > 0,
      campaignMapped: Boolean(input.selectedCampaign),
      policySynced:
        input.policySync &&
        typeof input.policySync === "object" &&
        input.policySync.status === "synced",
      docsRefreshed: input.docsRefreshed,
      agentPacksInstalled: input.agentPacksInstalled,
      toolDescriptorSentToHermes: input.toolDescriptorSentToHermes,
      neededToolsCaptured: false,
    };
    const { bearerKey: _bearerKey, ...safeSetup } = input.setup;
    return {
      status: input.status,
      message: input.message,
      app: input.app,
      connectionId: input.connectionId,
      checklist,
      campaigns: input.campaigns,
      selectedCampaign: input.selectedCampaign,
      policySync: input.policySync,
      installResults: input.installResults,
      neededToolsSummary: null,
      userActionRequired: input.userActionRequired,
      diagnostics: {
        setup: safeSetup,
        bridgeCapability: MARKETPLACE_LOCAL_APP_AGENT_API_SETUP_CAPABILITY,
        agentApiTerminology: "LocalAppConnector Agent API",
        legacyRouteNamespace: "/api/openclaw",
        bearerMaterialReturnedToFrontend: false,
        hermesCredentialAttached: false,
      },
    };
  }

  private toLocalAppConnectorAutonomyPolicy(
    payload: {
      campaignId: string | null;
      mode: string;
      reason: string;
    },
    policy: LocalAppAutonomyPolicy,
  ) {
    const external = policy.external;
    const lifecycle = policy.lifecycleStatus;
    return {
      campaignId: payload.campaignId,
      mode: payload.mode,
      allowInternalWrites:
        policy.internal.writeInternalRecords ||
        policy.internal.updateInternalStatuses ||
        policy.internal.createTasks ||
        policy.internal.updateTasks,
      allowOutreachSend: external.emailSend === "allowed",
      allowPublicFormSubmit: external.publicFormSubmit === "allowed",
      allowAccountCreation: external.accountCreation === "allowed",
      allowEmailSend: external.emailSend === "allowed",
      allowExternalPublish: external.externalPublishing === "allowed",
      allowContactedStatusUpdate:
        lifecycle.markContacted === "allowed_with_evidence",
      allowSubmittedStatusUpdate:
        lifecycle.markSubmitted === "allowed_with_evidence",
      allowLiveStatusUpdate: lifecycle.markLive === "allowed_with_evidence",
      allowIndexedStatusUpdate:
        lifecycle.markIndexed === "allowed_with_evidence",
      allowPayment: false,
      allowCaptchaHandling: false,
      allowCredentialUse: external.credentialUse === "allowed",
      requireEvidenceForExternalActions: policy.evidenceRequired,
      requireEvidenceForLifecycleStatus: policy.evidenceRequired,
      hardStopPaymentUnlessExplicit: policy.hardStops.payments,
      hardStopCaptchaBypass: policy.hardStops.captchaBypass,
      hardStopSecretExposure: policy.hardStops.exposeSecrets,
      hardStopDestructiveDataLoss: policy.hardStops.destructiveDataLoss,
      hardStopLegalCommitmentUnlessExplicit: policy.hardStops.legalCommitments,
      notes: `Synced from ClawChat (${payload.reason}). Missing tools must be reported as tool unavailable, not not allowed.`,
    };
  }

  private extractPolicyMode(value: unknown): string | null {
    const object = this.objectOrNull(value);
    if (!object) return null;
    return (
      this.stringOrNull(object.mode) ??
      this.stringOrNull(object.policyMode) ??
      this.stringOrNull(object.autonomyMode) ??
      this.extractPolicyMode(object.policy) ??
      this.extractPolicyMode(object.effectivePolicy)
    );
  }

  private async pauseConflictingScheduledMessagesForLocalApp(
    workspaceId: string,
    appSlug: string,
    policy: LocalAppAutonomyPolicy,
  ) {
    if (
      policy.mode !== "dangerously_skip_permissions" ||
      policy.staleContextPolicy !== "current_policy_supersedes_old_chat"
    ) {
      return;
    }
    const installs = await this.marketplaceInstallRepo.find({
      where: { workspaceId, appSlug, installStatus: "installed" },
    });
    const agentIds = new Set(installs.map((install) => install.agentId));
    if (!agentIds.size) return;
    const threads = await this.threadRepo.find({ where: { workspaceId } });
    const threadIds = threads
      .filter(
        (thread) =>
          Array.isArray(thread.agentIds) &&
          thread.agentIds.some((agentId) => agentIds.has(agentId)),
      )
      .map((thread) => thread.id);
    if (!threadIds.length) return;
    const scheduled = await this.scheduledMessageRepo.find({
      where: {
        workspaceId,
        threadId: In(threadIds),
        status: ScheduledMessageStatus.PENDING,
      },
    });
    const conflicting = scheduled.filter((message) =>
      hasBlanketNoExternalConflict(message.contentMarkdown),
    );
    for (const message of conflicting) {
      message.status = ScheduledMessageStatus.CANCELLED;
      message.metadata = {
        ...(message.metadata ?? {}),
        autonomyModeSnapshot: policy.mode,
        policyConflict: true,
        conflictReason:
          "Cancelled because scheduled text blanket-blocked external actions while current policy permits autonomous external execution.",
        cancelledByAutonomyPolicyAt: new Date().toISOString(),
      };
    }
    if (conflicting.length) {
      await this.scheduledMessageRepo.save(conflicting);
    }
  }

  private normalizeDirtyPath(path: string) {
    return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "");
  }

  private buildLocalRepoSourceDiagnostics(
    linked: LinkedApplicationEntity,
    discovery: Record<string, unknown>,
    roleCoverage: Record<string, unknown>,
  ) {
    const configuredSourceHostType = String(
      linked.metadata?.sourceHostType ??
        linked.apiStyleMetadata?.sourceHostType ??
        "",
    );
    const configuredSourcePath = linked.repoPath;
    const lastReadRepoPath = String(discovery.repoPath ?? configuredSourcePath);
    const sourceHostMismatch = Boolean(
      lastReadRepoPath &&
      configuredSourcePath &&
      lastReadRepoPath !== configuredSourcePath,
    );
    const warnings: string[] = Array.isArray(discovery.warnings)
      ? discovery.warnings.map(String)
      : [];
    if (sourceHostMismatch) {
      warnings.push(
        `Production is reading ${lastReadRepoPath}, not ${configuredSourcePath}.`,
      );
    }
    const roleCoverageByRole =
      roleCoverage && typeof roleCoverage === "object"
        ? ((roleCoverage as Record<string, unknown>).roles as
            | Array<Record<string, unknown>>
            | undefined)
        : [];
    for (const role of roleCoverageByRole ?? []) {
      const roleName = String(role.role ?? "");
      if (role.expected === true && Number(role.sourceDocCount ?? 0) === 0) {
        warnings.push(`Source host did not return expected ${roleName} docs.`);
      }
      if (
        role.hasInstalledAgent === true &&
        role.hasRealDocumentationVersion !== true
      ) {
        warnings.push(`This role has no installed docs yet: ${roleName}.`);
      }
    }
    if (!discovery.gitCommit) {
      warnings.push(
        "Source host repo may be stale: no source commit was returned.",
      );
    }
    return {
      configuredSourceHostType,
      configuredSourceHostId: linked.metadata?.sourceHostId ?? null,
      configuredSourcePath,
      docsSourcePath:
        discovery.docsSourcePath ??
        linked.metadata?.docsSourcePath ??
        ".clawchat/",
      bridgeSourceHostUsed:
        discovery.sourceHostType ??
        linked.metadata?.sourceHostType ??
        configuredSourceHostType,
      bridgeDeviceId:
        discovery.bridgeDeviceId ?? linked.metadata?.bridgeDeviceId ?? null,
      lastReadRepoPath,
      lastSourceCommit: discovery.gitCommit ?? linked.currentGitCommit ?? null,
      lastSourceBranch:
        discovery.gitBranch ?? linked.metadata?.gitBranch ?? null,
      dirtyState: discovery.dirtyState ?? linked.dirtyState ?? null,
      lastReadTimestamp:
        discovery.lastReadAt ??
        linked.metadata?.lastDiscoveredAt ??
        linked.lastScannedAt ??
        null,
      rolesManifestPresent: Boolean(
        discovery.rolesManifest ?? discovery.roleManifest,
      ),
      workerDocsCount: Number(discovery.workerFileCount ?? 0),
      managerDocsCount: Number(discovery.managerFileCount ?? 0),
      auditorDocsCount: Number(discovery.auditorFileCount ?? 0),
      apiDocsCount: Number(discovery.apiFileCount ?? 0),
      generatedCanonicalFileCount: Number(
        (roleCoverage as { generatedCanonicalFileCount?: number })
          .generatedCanonicalFileCount ?? 0,
      ),
      generatedRuntimeFileCountByRole:
        (roleCoverage as { runtimeFileCountByRole?: Record<string, number> })
          .runtimeFileCountByRole ?? {},
      installedFileCountPerAgent:
        (
          roleCoverage as {
            installedFileCountPerAgent?: Array<Record<string, unknown>>;
          }
        ).installedFileCountPerAgent ?? [],
      sourceHostMismatch,
      staleRepoWarning: warnings.some((warning) => warning.includes("stale")),
      missingExpectedRoleDocWarnings: warnings.filter((warning) =>
        warning.includes("Source host did not return expected"),
      ),
      warnings,
    };
  }

  private buildLocalRepoRoleCoverage(input: {
    app: MarketplaceAppDefinition;
    discovery: Record<string, unknown>;
    canonicalSources: Record<string, string>;
    hermesFiles: PackFile[];
    installs: MarketplaceInstallEntity[];
    agentVersions: AgentDocumentationVersionEntity[];
  }) {
    const roles = input.app.roleManifest?.roles?.length
      ? input.app.roleManifest.roles
      : roleManifestForApp(input.app).roles;
    const versionByAgentRole = new Map(
      input.agentVersions.map((version) => [
        `${version.agentId}:${version.role}`,
        version,
      ]),
    );
    const runtimeFileCountByRole: Record<string, number> = {
      worker: 0,
      manager: 0,
      auditor: 0,
    };
    for (const file of input.hermesFiles) {
      const path = file.relativePath;
      if (path.includes("-manager-router/"))
        runtimeFileCountByRole.manager += 1;
      else if (path.includes("-auditor-router/"))
        runtimeFileCountByRole.auditor += 1;
      else runtimeFileCountByRole.worker += 1;
    }
    const canonicalCountByRole: Record<string, number> = {
      worker: 0,
      manager: 0,
      auditor: 0,
    };
    for (const path of Object.keys(input.canonicalSources)) {
      if (path.startsWith("manager/")) canonicalCountByRole.manager += 1;
      else if (path.startsWith("auditor/")) canonicalCountByRole.auditor += 1;
      else canonicalCountByRole.worker += 1;
    }
    const sourceDocCountByRole: Record<string, number> = {
      worker: Number(input.discovery.workerFileCount ?? 0),
      manager: Number(input.discovery.managerFileCount ?? 0),
      auditor: Number(input.discovery.auditorFileCount ?? 0),
    };
    const installedFileCountPerAgent = input.installs.map((install) => {
      const version = versionByAgentRole.get(
        `${install.agentId}:${install.role}`,
      );
      return {
        agentId: install.agentId,
        role: install.role,
        marketplaceInstallId: install.id,
        agentDocumentationInstallId: install.agentDocumentationInstallId,
        installedFileCount: Array.isArray(version?.workspaceFileManifest)
          ? version.workspaceFileManifest.length
          : 0,
        hasRealDocumentationVersion: Boolean(
          version?.agentDocumentationInstallId,
        ),
      };
    });
    return {
      rolesManifest: input.app.roleManifest ?? null,
      roles: roles.map((role) => {
        const roleInstalls = input.installs.filter(
          (install) => install.role === role.role,
        );
        return {
          role: role.role,
          label: role.label,
          expected: role.installable || role.required,
          docsSourcePath: role.docsSourcePath,
          sourceDocCount: sourceDocCountByRole[role.role] ?? 0,
          canonicalDocCount: canonicalCountByRole[role.role] ?? 0,
          runtimeFileCount: runtimeFileCountByRole[role.role] ?? 0,
          installedAgentCount: roleInstalls.length,
          hasInstalledAgent: roleInstalls.length > 0,
          hasRealDocumentationVersion: roleInstalls.some((install) =>
            Boolean(
              versionByAgentRole.get(`${install.agentId}:${install.role}`)
                ?.agentDocumentationInstallId,
            ),
          ),
          installable: role.installable,
          notInstallableReason: role.notInstallableReason,
        };
      }),
      generatedCanonicalFileCount: Object.keys(input.canonicalSources).length,
      canonicalFileCountByRole: canonicalCountByRole,
      runtimeFileCountByRole,
      sourceDocCountByRole,
      installedFileCountPerAgent,
    };
  }

  private async saveUniqueActiveMarketplaceInstall(
    input: MarketplaceInstallSaveInput,
  ): Promise<MarketplaceInstallEntity> {
    try {
      return await this.saveUniqueActiveMarketplaceInstallInTransaction(input);
    } catch (error) {
      if (!this.isActiveMarketplaceInstallUniqueViolation(error)) throw error;
      return this.saveUniqueActiveMarketplaceInstallInTransaction(input);
    }
  }

  private async saveUniqueActiveMarketplaceInstallInTransaction(
    input: MarketplaceInstallSaveInput,
  ): Promise<MarketplaceInstallEntity> {
    return this.marketplaceInstallRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(MarketplaceInstallEntity);
      const runtimeFormat = this.readInstallRuntimeFormatFromMetadata(
        input.metadata,
      );
      const existingActive = await repo
        .createQueryBuilder("install")
        .setLock("pessimistic_write")
        .where(`install."workspaceId" = :workspaceId`, {
          workspaceId: input.workspaceId,
        })
        .andWhere(`install."appSlug" = :appSlug`, { appSlug: input.appSlug })
        .andWhere(`install."agentId" = :agentId`, { agentId: input.agentId })
        .andWhere(`install."role" = :role`, { role: input.role })
        .andWhere(`install."installStatus" <> :removedStatus`, {
          removedStatus: "removed",
        })
        .andWhere(
          `COALESCE(install.metadata ->> 'runtimeFormat', 'openclaw') = :runtimeFormat`,
          {
            runtimeFormat,
          },
        )
        .getMany();
      const [current, ...duplicates] =
        this.sortMarketplaceInstallsForActiveTarget(existingActive);

      if (duplicates.length) {
        const supersededAt = new Date().toISOString();
        await repo.save(
          duplicates.map((install) => {
            install.installStatus = "removed";
            install.driftStatus = "superseded";
            install.metadata = {
              ...(install.metadata ?? {}),
              supersededByActiveInstallUniqueness: true,
              supersededAt,
            };
            return install;
          }),
        );
      }

      const install = current ?? repo.create(input);
      Object.assign(install, input);
      return repo.save(install);
    });
  }

  private isActiveMarketplaceInstallUniqueViolation(error: unknown) {
    const record = error as {
      code?: string;
      constraint?: string;
      detail?: string;
      driverError?: {
        code?: string;
        constraint?: string;
        detail?: string;
      };
    };
    const code = record?.code ?? record?.driverError?.code;
    if (code !== "23505") return false;
    const target = [
      record?.constraint,
      record?.detail,
      record?.driverError?.constraint,
      record?.driverError?.detail,
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
    return target.includes("idx_marketplace_installs_active_target_unique");
  }

  private latestActiveMarketplaceInstallsByTarget(
    installs: MarketplaceInstallEntity[],
  ) {
    const latest = new Map<string, MarketplaceInstallEntity>();
    for (const install of this.sortMarketplaceInstallsForActiveTarget(
      installs,
    )) {
      if (install.installStatus === "removed") continue;
      const key = this.marketplaceInstallActiveTargetKey(install);
      if (!latest.has(key)) latest.set(key, install);
    }
    return Array.from(latest.values());
  }

  private marketplaceInstallActiveTargetKey(
    install: Pick<
      MarketplaceInstallEntity,
      "workspaceId" | "appSlug" | "agentId" | "role" | "metadata"
    >,
  ) {
    const runtimeFormat = this.readInstallRuntimeFormatFromMetadata(
      install.metadata,
    );
    return `${install.workspaceId}:${install.appSlug}:${install.agentId}:${install.role}:${runtimeFormat}`;
  }

  private sortMarketplaceInstallsForActiveTarget(
    installs: MarketplaceInstallEntity[],
  ) {
    return [...installs].sort((left, right) => {
      const statusPriority =
        this.marketplaceInstallStatusPriority(left.installStatus) -
        this.marketplaceInstallStatusPriority(right.installStatus);
      if (statusPriority !== 0) return statusPriority;
      const updatedDelta =
        this.marketplaceInstallTimestamp(right.updatedAt) -
        this.marketplaceInstallTimestamp(left.updatedAt);
      if (updatedDelta !== 0) return updatedDelta;
      const createdDelta =
        this.marketplaceInstallTimestamp(right.createdAt) -
        this.marketplaceInstallTimestamp(left.createdAt);
      if (createdDelta !== 0) return createdDelta;
      return String(right.id ?? "").localeCompare(String(left.id ?? ""));
    });
  }

  private marketplaceInstallStatusPriority(status: string | null | undefined) {
    switch (status) {
      case "installed":
        return 0;
      case "requested":
        return 1;
      case "failed":
        return 2;
      default:
        return 3;
    }
  }

  private marketplaceInstallTimestamp(value: Date | string | null | undefined) {
    if (!value) return 0;
    const timestamp =
      value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private sourceDiffHasChanges(sourceDiff: unknown) {
    if (!sourceDiff || typeof sourceDiff !== "object") return false;
    const diff = sourceDiff as Record<string, unknown>;
    return ["addedPaths", "changedPaths", "removedPaths"].some(
      (key) => Array.isArray(diff[key]) && (diff[key] as unknown[]).length > 0,
    );
  }

  private countManifestChanges(fileChanges: unknown) {
    if (!fileChanges || typeof fileChanges !== "object") return 0;
    const changes = fileChanges as Record<string, unknown>;
    return ["added", "changed", "removed"].reduce(
      (sum, key) =>
        sum +
        (Array.isArray(changes[key]) ? (changes[key] as unknown[]).length : 0),
      0,
    );
  }

  private async readLocalRepoAnalysisFiles(
    linked: LinkedApplicationEntity,
    discovery: LocalRepoDiscovery,
  ) {
    const metadata = linked.metadata ?? {};
    const sourceHostType = String(
      metadata.sourceHostType ?? linked.apiStyleMetadata?.sourceHostType ?? "",
    );
    const includeGlobs = [
      "package.json",
      "app/**/*.{ts,tsx,js,jsx,md,mdx}",
      "pages/**/*.{ts,tsx,js,jsx}",
      "src/**/*.{ts,tsx,js,jsx,md,mdx}",
      "components/**/*.{ts,tsx,js,jsx}",
      "lib/**/*.{ts,tsx,js,jsx}",
      "server/**/*.{ts,tsx,js,jsx}",
      "backend/**/*.{ts,tsx,js,jsx,py,rb,go,rs}",
      "convex/**/*.{ts,tsx,js}",
      "prisma/**/*.{prisma,sql}",
      "supabase/**/*.{sql,ts,js}",
      "db/**/*.{sql,ts,js}",
      "jobs/**/*.{ts,tsx,js,jsx,py}",
      "workers/**/*.{ts,tsx,js,jsx,py}",
      "routes/**/*.{ts,tsx,js,jsx,py,rb}",
      "api/**/*.{ts,tsx,js,jsx,py,rb}",
    ];
    if (
      !["openclaw_bridge", "hermes_bridge", "runtime_host"].includes(
        sourceHostType,
      )
    ) {
      throw new BadRequestException(
        "This source must be migrated to a paired runtime host before repository analysis.",
      );
    }
    const bridgeDeviceId = String(
      metadata.bridgeDeviceId ?? metadata.sourceHostId ?? "",
    ).trim();
    const response = await this.bridgeService.readMarketplaceLocalRepoDocs(
      linked.workspaceId,
      {
        sourceHostId: String(metadata.sourceHostId ?? bridgeDeviceId),
        bridgeDeviceId,
        sourceHostType,
        runtimeType: String(
          metadata.runtimeType ?? linked.apiStyleMetadata?.runtimeType ?? "",
        ),
        repoPath: discovery.repoPath ?? linked.repoPath,
        docsSourcePath: ".",
        includeGlobs,
      },
      45_000,
    );
    return (response.files ?? [])
      .filter((file) => this.isAllowedLocalRepoAnalysisPath(file.relativePath))
      .slice(0, 160)
      .map((file) => ({
        relativePath: file.relativePath.replace(/\\/g, "/").replace(/^\/+/, ""),
        content: file.content.slice(0, 20_000),
        hash: file.sha256 || sha256(file.content),
      }));
  }

  private isAllowedLocalRepoAnalysisPath(relativePath: string) {
    const path = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (path.includes("..")) return false;
    if (path.startsWith(".clawchat/")) return false;
    if (/(^|\/)(node_modules|\.git|\.next|dist|build|coverage)\//.test(path))
      return false;
    if (path === "package.json") return true;
    return /\.(ts|tsx|js|jsx|py|rb|go|rs|prisma|sql|md|mdx)$/.test(path);
  }

  private extractLocalRepoCapabilityMap(
    linked: LinkedApplicationEntity,
    discovery: LocalRepoDiscovery,
    analysisFiles: Array<{
      relativePath: string;
      content: string;
      hash: string;
    }>,
  ): LocalRepoCapabilityMap {
    const screens = new Set<string>();
    const endpoints = new Set<string>();
    const entities = new Set<string>();
    const jobs = new Set<string>();
    const integrations = new Set<string>();
    const workflows = new Set<string>();
    const risks = new Set<string>();
    const verification = new Set<string>();
    const changedSignals: Array<{
      kind: string;
      path: string;
      detail: string;
    }> = [];
    for (const file of analysisFiles) {
      const path = file.relativePath;
      const content = file.content;
      if (/(^|\/)(app|pages|screens|components)\//.test(path)) {
        screens.add(path);
        changedSignals.push({
          kind: "screen_or_page",
          path,
          detail: this.describePathSignal(path),
        });
      }
      if (
        /(^|\/)(api|routes|controllers)\//.test(path) ||
        /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/.test(
          content,
        ) ||
        /router\.(get|post|put|patch|delete)\(/.test(content)
      ) {
        endpoints.add(path);
        changedSignals.push({
          kind: "api_endpoint",
          path,
          detail: this.describePathSignal(path),
        });
      }
      if (
        /(^|\/)(schema|schemas|models|entities|prisma|db|supabase)\//.test(
          path,
        ) ||
        /\b(model|interface|type|class)\s+[A-Z][A-Za-z0-9]+/.test(content)
      ) {
        entities.add(path);
      }
      if (
        /(^|\/)(jobs|workers|queues|cron|tasks)\//.test(path) ||
        /@Cron|queue|worker|schedule/i.test(content)
      ) {
        jobs.add(path);
      }
      if (
        /stripe|github|railway|openai|supabase|convex|postgres|gmail|slack|vercel/i.test(
          content,
        )
      ) {
        const match = content.match(
          /stripe|github|railway|openai|supabase|convex|postgres|gmail|slack|vercel/i,
        );
        integrations.add(match?.[0].toLowerCase() ?? path);
      }
      if (
        /workflow|approval|status|pipeline|queue|handoff|review|publish|deploy/i.test(
          content,
        )
      ) {
        workflows.add(path);
      }
      if (
        /delete|archive|publish|deploy|payment|token|secret|permission|approve|destructive|bulk/i.test(
          content,
        )
      ) {
        risks.add(path);
      }
      if (
        /test|spec|verify|health|status|lint|build/i.test(path) ||
        /success|failed|error/i.test(content)
      ) {
        verification.add(path);
      }
    }
    const workflowNames = [...workflows]
      .slice(0, 20)
      .map((path) => this.describePathSignal(path));
    const autonomyPolicy = this.getLocalAppAutonomyPolicy(linked);
    return {
      appPurpose:
        typeof discovery.manifest?.description === "string"
          ? discovery.manifest.description
          : `Operate ${linked.name} from its local repository and installed ClawChat agent docs.`,
      majorWorkflows: workflowNames.length
        ? workflowNames
        : [
            "Inspect app state, execute safe operational tasks, verify the result, and report the outcome.",
          ],
      screensPages: [...screens].slice(0, 30),
      endpoints: [...endpoints].slice(0, 30),
      entitiesDataModel: [...entities].slice(0, 30),
      jobsWorkers: [...jobs].slice(0, 20),
      integrations: [...integrations].slice(0, 20),
      agentOperableTasks: [
        "Read current app state before taking action.",
        "Use documented screens, APIs, entities, and workflows rather than generic assumptions.",
        autonomyPolicy.mode === "dangerously_skip_permissions"
          ? "Execute configured internal and external actions when matching tools are available, evidence is recorded, and no hard stop applies."
          : autonomyPolicy.mode === "internal_write"
            ? "Execute configured internal app writes; classify missing external tools separately from prohibited actions."
            : "Prepare or execute safe operational changes only within the app's documented approval gates.",
      ],
      managerResponsibilities: [
        "Route work to available roles from roles_manifest.json.",
        "Decompose user requests into concrete worker/auditor tasks.",
        autonomyPolicy.mode === "dangerously_skip_permissions"
          ? "Apply current autonomy policy, route hard stops, and keep execution moving when tools and evidence are available."
          : "Hold approval gates for destructive, publishing, deployment, permission, and external-commitment actions.",
      ],
      workerResponsibilities: [
        "Operate documented screens, APIs, workflows, and data entities.",
        autonomyPolicy.mode === "dangerously_skip_permissions"
          ? "Make configured internal/external actions, then verify and record evidence truthfully."
          : "Make safe reads and approved writes, then verify the result.",
      ],
      auditorResponsibilities: [
        "Review work against real app capabilities, approval gates, and verification evidence.",
        "Flag stale docs, invented capabilities, unsafe writes, and missing checks.",
      ],
      risksApprovalGates: [...risks].slice(0, 20),
      failureModes: [
        "Source host path points at a stale clone.",
        "Role docs omit a real screen, endpoint, workflow, entity, job, or approval gate.",
        "Agent executes a generic instruction not grounded in this app.",
      ],
      verificationSteps: [...verification].slice(0, 20),
      changedSignals,
    };
  }

  private compareCapabilityMapToLocalRepoDocs(
    capabilityMap: LocalRepoCapabilityMap,
    discovery: LocalRepoDiscovery,
  ) {
    const docsText = discovery.files
      .map((file) => `${file.relativePath}\n${file.content}`)
      .join("\n\n");
    const findings: Array<{
      severity: string;
      path?: string | null;
      message: string;
    }> = [];
    const requireDoc = (role: LocalRepoRoleKey, count: number) => {
      if (count === 0) {
        findings.push({
          severity: "error",
          path: `.clawchat/${role === "worker" ? "agent" : role}-docs-source/`,
          message: `Missing ${role} docs for a role that should receive operational app instructions.`,
        });
      }
    };
    requireDoc("worker", discovery.workerFileCount ?? 0);
    requireDoc("manager", discovery.managerFileCount ?? 0);
    requireDoc("auditor", discovery.auditorFileCount ?? 0);
    if (!discovery.rolesManifest) {
      findings.push({
        severity: "error",
        path: ".clawchat/roles_manifest.json",
        message:
          "roles_manifest.json is missing, so role coverage cannot be treated as source-of-truth.",
      });
    }
    const signals = [
      ...capabilityMap.screensPages,
      ...capabilityMap.endpoints,
      ...capabilityMap.entitiesDataModel,
      ...capabilityMap.jobsWorkers,
    ].slice(0, 25);
    const missingSignals = signals.filter(
      (signal) => !docsText.includes(signal),
    );
    if (missingSignals.length) {
      findings.push({
        severity: "warning",
        path: ".clawchat/",
        message: `Docs do not reference real app surfaces: ${missingSignals.slice(0, 8).join(", ")}`,
      });
    }
    const abstractSignals = discovery.files
      .filter((file) => file.relativePath.endsWith(".md"))
      .filter((file) => {
        const content = file.content.toLowerCase();
        const hasConcreteSurface = signals.some((signal) =>
          file.content.includes(signal),
        );
        return (
          !hasConcreteSurface &&
          /operate|workflow|approval|task|agent/.test(content)
        );
      })
      .map((file) => file.relativePath);
    if (abstractSignals.length) {
      findings.push({
        severity: "warning",
        path: ".clawchat/",
        message: `Some docs are policy-like but not operationally grounded: ${abstractSignals.slice(0, 8).join(", ")}`,
      });
    }
    return {
      findings,
      missingSignals,
      abstractDocs: abstractSignals,
      needsProposal: findings.length > 0,
    };
  }

  private buildLocalRepoDocumentationProposalFiles(
    linked: LinkedApplicationEntity,
    discovery: LocalRepoDiscovery,
    capabilityMap: LocalRepoCapabilityMap,
    comparison: {
      findings: Array<{
        severity: string;
        path?: string | null;
        message: string;
      }>;
    },
  ) {
    const existing = new Map(
      discovery.files.map((file) => [
        `.clawchat/${file.relativePath}`,
        file.content,
      ]),
    );
    const roleManifest = this.renderOperationalRolesManifest(linked, discovery);
    const desiredFiles = new Map<
      string,
      { content: string; classification: string; rationale: string }
    >([
      [
        ".clawchat/roles_manifest.json",
        {
          content: roleManifest,
          classification: "role_manifest",
          rationale:
            "Make worker, manager, and auditor role coverage explicit and source-of-truth.",
        },
      ],
      [
        ".clawchat/agent-docs-source/APP_OPERATION.md",
        {
          content: this.renderOperationalRoleDoc(
            "worker",
            linked,
            capabilityMap,
          ),
          classification: "worker_operational_docs",
          rationale:
            "Ground worker/operator docs in real screens, APIs, entities, workflows, tools, approval gates, and verification steps.",
        },
      ],
      [
        ".clawchat/manager-docs-source/APP_OPERATION.md",
        {
          content: this.renderOperationalRoleDoc(
            "manager",
            linked,
            capabilityMap,
          ),
          classification: "manager_operational_docs",
          rationale:
            "Give manager agents concrete delegation, routing, approval, and verification responsibilities for this app.",
        },
      ],
      [
        ".clawchat/auditor-docs-source/APP_OPERATION.md",
        {
          content: this.renderOperationalRoleDoc(
            "auditor",
            linked,
            capabilityMap,
          ),
          classification: "auditor_operational_docs",
          rationale:
            "Give auditor agents concrete review checks against actual app surfaces and approval gates.",
        },
      ],
      [
        ".clawchat/agent-docs-source/CAPABILITY_MAP.md",
        {
          content: this.renderCapabilityMapDoc(linked, capabilityMap),
          classification: "api_capability_map",
          rationale:
            "Document extracted app capabilities so SKILL.md/reference compilation has operational source material.",
        },
      ],
      [
        ".clawchat/agent-docs-source/APPROVAL_GATES.md",
        {
          content: this.renderApprovalGatesDoc(linked, capabilityMap),
          classification: "approval_gates",
          rationale:
            "Make approval and safety rules concrete for worker, manager, and auditor docs.",
        },
      ],
      [
        ".clawchat/agent-docs-source/VERIFICATION.md",
        {
          content: this.renderVerificationDoc(linked, capabilityMap),
          classification: "verification",
          rationale:
            "Require agents to verify app actions using real checks and report evidence.",
        },
      ],
      [
        ".clawchat/agent-docs-source/TROUBLESHOOTING.md",
        {
          content: this.renderTroubleshootingDoc(linked, capabilityMap),
          classification: "troubleshooting",
          rationale:
            "Document failure modes caused by stale source hosts, missing docs, and app/runtime errors.",
        },
      ],
    ]);
    const files: Array<{
      relativePath: string;
      previousContent: string | null;
      updatedContent: string;
      classification: string;
      refreshPolicy: string;
      metadata: Record<string, unknown>;
    }> = [];
    for (const [relativePath, desired] of desiredFiles) {
      const previousContent = existing.get(relativePath) ?? null;
      if (previousContent === desired.content) continue;
      files.push({
        relativePath,
        previousContent,
        updatedContent: desired.content,
        classification: desired.classification,
        refreshPolicy: "review_required",
        metadata: {
          rationale: desired.rationale,
          comparisonFindings: comparison.findings,
          generatedFromCapabilityMap: true,
        },
      });
    }
    return files;
  }

  private renderOperationalRolesManifest(
    linked: LinkedApplicationEntity,
    discovery: LocalRepoDiscovery,
  ) {
    const existingRoles = Array.isArray(discovery.rolesManifest?.roles)
      ? discovery.rolesManifest.roles
      : [];
    const byRole = new Map<string, Record<string, unknown>>();
    for (const role of existingRoles) {
      if (
        role &&
        typeof role === "object" &&
        typeof (role as Record<string, unknown>).role === "string"
      ) {
        byRole.set(
          String((role as Record<string, unknown>).role),
          role as Record<string, unknown>,
        );
      }
    }
    const ensure = (
      role: LocalRepoRoleKey,
      label: string,
      purpose: string,
      docsSourcePath: string,
      readOnly: boolean,
    ) => ({
      ...(byRole.get(role) ?? {}),
      role,
      label,
      purpose,
      docsSourcePath,
      runtimeOutputPath: `.clawchat/agent-docs/${role}/`,
      readOnly,
      canWrite: !readOnly,
      installable: true,
      required: role === "worker",
      installAfterSetup: role === "worker",
      approvalRequiredFor: [
        "destructive data changes",
        "publishing or deployment",
        "permission or configuration changes",
        "external commitments",
      ],
      blockedActions: ["expose secrets", "invent unsupported app capabilities"],
    });
    return `${JSON.stringify(
      {
        appSlug: linked.slug,
        appName: linked.name,
        generatedBy: "clawchat_local_repo_app_analysis",
        roles: [
          ensure(
            "worker",
            "Worker / Operator",
            "Operate the documented app workflows after checking real app state.",
            ".clawchat/agent-docs-source/",
            false,
          ),
          ensure(
            "manager",
            "Manager",
            "Route work across available roles, manage approvals, and keep tasks moving.",
            ".clawchat/manager-docs-source/",
            false,
          ),
          ensure(
            "auditor",
            "Auditor",
            "Review work for correctness, safety, stale docs, and evidence quality.",
            ".clawchat/auditor-docs-source/",
            true,
          ),
        ],
      },
      null,
      2,
    )}\n`;
  }

  private renderOperationalRoleDoc(
    role: LocalRepoRoleKey,
    linked: LinkedApplicationEntity,
    capabilityMap: LocalRepoCapabilityMap,
  ) {
    const responsibilities =
      role === "manager"
        ? capabilityMap.managerResponsibilities
        : role === "auditor"
          ? capabilityMap.auditorResponsibilities
          : capabilityMap.workerResponsibilities;
    return [
      `# ${linked.name} ${role} operational guide`,
      "",
      renderLocalAppAutonomyPolicyMarkdown(
        this.getLocalAppAutonomyPolicy(linked),
      ),
      "",
      "## What this app is for",
      capabilityMap.appPurpose,
      "",
      "## Role responsibility",
      ...responsibilities.map((item) => `- ${item}`),
      "",
      "## Step-by-step operating procedure",
      "1. Read roles_manifest.json and confirm this role is available for the requested task.",
      "2. Identify the relevant screens, APIs, workflows, entities, jobs, and integrations from this guide.",
      "3. Inspect current app state before taking action.",
      this.getLocalAppAutonomyPolicy(linked).mode ===
      "dangerously_skip_permissions"
        ? "4. Apply the current autonomy policy: proceed with configured external actions when tools are available, evidence can be recorded, and no hard stop applies."
        : "4. Stop for approval before any destructive, publishing, deployment, permission, external-commitment, bulk, payment, token, or secret-related action.",
      "5. Execute only the documented safe action or approved change.",
      "6. Verify success using the verification section and report exact evidence back to the user.",
      "",
      "## Screens and pages",
      ...this.markdownList(capabilityMap.screensPages),
      "",
      "## APIs and endpoints",
      ...this.markdownList(capabilityMap.endpoints),
      "",
      "## Entities and data model",
      ...this.markdownList(capabilityMap.entitiesDataModel),
      "",
      "## Jobs and workers",
      ...this.markdownList(capabilityMap.jobsWorkers),
      "",
      "## Workflows",
      ...this.markdownList(capabilityMap.majorWorkflows),
      "",
      "## Integrations",
      ...this.markdownList(capabilityMap.integrations),
      "",
      "## Tools and actions this role can use",
      ...this.markdownList(capabilityMap.agentOperableTasks),
      "",
      "## Requires approval",
      ...this.markdownList(capabilityMap.risksApprovalGates),
      "",
      "## Must never do",
      "- Do not invent screens, APIs, workflows, entities, roles, or source paths that are not documented or visible in the app.",
      "- Do not expose credentials, tokens, private keys, or user-private data.",
      "- Do not treat a stale source-host clone as current without telling the user.",
      "",
      "## Common failure modes",
      ...this.markdownList(capabilityMap.failureModes),
      "",
      "## Verification",
      ...this.markdownList(capabilityMap.verificationSteps),
      "",
      "## Report back to the user",
      "- State what was inspected, what changed, what was not changed, what approval was used, and how success was verified.",
      "",
    ].join("\n");
  }

  private renderCapabilityMapDoc(
    linked: LinkedApplicationEntity,
    capabilityMap: LocalRepoCapabilityMap,
  ) {
    return [
      `# ${linked.name} capability map`,
      "",
      "This file is generated from local app analysis and should be reviewed before apply.",
      "",
      renderLocalAppAutonomyPolicyMarkdown(
        this.getLocalAppAutonomyPolicy(linked),
      ),
      "",
      "## Purpose",
      capabilityMap.appPurpose,
      "",
      "## Screens/pages",
      ...this.markdownList(capabilityMap.screensPages),
      "",
      "## Endpoints",
      ...this.markdownList(capabilityMap.endpoints),
      "",
      "## Entities/data model",
      ...this.markdownList(capabilityMap.entitiesDataModel),
      "",
      "## Jobs/workers",
      ...this.markdownList(capabilityMap.jobsWorkers),
      "",
      "## Integrations",
      ...this.markdownList(capabilityMap.integrations),
      "",
      "## App change signals",
      ...this.markdownList(
        capabilityMap.changedSignals.map(
          (signal) => `${signal.kind}: ${signal.path} - ${signal.detail}`,
        ),
      ),
      "",
    ].join("\n");
  }

  private renderApprovalGatesDoc(
    linked: LinkedApplicationEntity,
    capabilityMap: LocalRepoCapabilityMap,
  ) {
    const policy = this.getLocalAppAutonomyPolicy(linked);
    return [
      `# ${linked.name} approval gates`,
      "",
      renderLocalAppAutonomyPolicyMarkdown(policy),
      "",
      policy.mode === "dangerously_skip_permissions"
        ? "Agents may perform configured external actions when tools are available and evidence is recorded. They must stop only for hard stops, unavailable required tools, missing credentials/identity, or actions not enabled by current policy."
        : "Agents must stop and request explicit approval before these actions:",
      ...this.markdownList([
        "destructive data changes",
        "publishing or deployment",
        "permission, role, or configuration changes",
        "bulk actions",
        "external commitments",
        "payment, billing, account, token, secret, or credential changes",
        ...capabilityMap.risksApprovalGates,
      ]),
      "",
      "Approval requests must name the exact screen/API/workflow/entity, expected impact, rollback expectation, and verification step.",
      "",
    ].join("\n");
  }

  private renderVerificationDoc(
    linked: LinkedApplicationEntity,
    capabilityMap: LocalRepoCapabilityMap,
  ) {
    return [
      `# ${linked.name} verification`,
      "",
      "After acting, verify with the most specific available evidence:",
      ...this.markdownList([
        "read the changed record or app state again",
        "check status screens or API responses",
        "check job/worker completion state when a background action was involved",
        "check audit/log/error output when available",
        ...capabilityMap.verificationSteps,
      ]),
      "",
      "Reports must include the verification source, observed value, and any unresolved uncertainty.",
      "",
    ].join("\n");
  }

  private renderTroubleshootingDoc(
    linked: LinkedApplicationEntity,
    capabilityMap: LocalRepoCapabilityMap,
  ) {
    return [
      `# ${linked.name} troubleshooting`,
      "",
      "Use these checks when docs, source host, or runtime behavior looks wrong:",
      ...this.markdownList(capabilityMap.failureModes),
      "- Confirm the source host repo path is the expected machine/path.",
      "- Confirm roles_manifest.json exists and includes only roles backed by real docs.",
      "- Confirm worker, manager, and auditor source docs were returned by the bridge.",
      "- Confirm app docs version changed only when source/generated content changed.",
      "- Confirm installed agent file manifests changed before claiming agent docs changed.",
      "",
    ].join("\n");
  }

  private markdownList(items: string[]) {
    const unique = [...new Set(items.filter(Boolean))].slice(0, 40);
    return unique.length
      ? unique.map((item) => `- ${item}`)
      : ["- Not detected yet; inspect the app before acting."];
  }

  private describePathSignal(path: string) {
    return (
      path
        .replace(/\.(tsx|ts|jsx|js|py|rb|go|rs|md|mdx|sql|prisma)$/i, "")
        .replace(/(^|\/)(page|route|index)$/g, "")
        .replace(/[\/_-]+/g, " ")
        .trim() || path
    );
  }

  private assertLocalRepoProposalPath(relativePath: string) {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized.startsWith(".clawchat/")) {
      throw new BadRequestException(
        `Proposal path must stay under .clawchat/: ${relativePath}`,
      );
    }
    const inner = normalized.slice(".clawchat/".length);
    if (!this.isAllowedLocalRepoSourcePath(inner)) {
      throw new BadRequestException(
        `Proposal path is not an allowed local repo docs path: ${relativePath}`,
      );
    }
  }

  private async applyLocalRepoProposalFiles(
    linked: LinkedApplicationEntity,
    discovery: LocalRepoDiscovery,
    files: DocumentationProposalFileEntity[],
  ) {
    const sourceHostType = String(
      linked.metadata?.sourceHostType ??
        linked.apiStyleMetadata?.sourceHostType ??
        "",
    );
    if (
      !["openclaw_bridge", "hermes_bridge", "runtime_host"].includes(
        sourceHostType,
      )
    ) {
      throw new BadRequestException(
        "This source must be migrated to a paired runtime host before documentation can be written.",
      );
    }
    const bridgeDeviceId = String(
      linked.metadata?.bridgeDeviceId ?? linked.metadata?.sourceHostId ?? "",
    ).trim();
    const response = await this.bridgeService.applyMarketplaceLocalRepoDocs(
      linked.workspaceId,
      {
        sourceHostId: String(linked.metadata?.sourceHostId ?? bridgeDeviceId),
        bridgeDeviceId,
        sourceHostType,
        runtimeType: String(
          linked.metadata?.runtimeType ??
            linked.apiStyleMetadata?.runtimeType ??
            "",
        ),
        repoPath: discovery.repoPath ?? linked.repoPath,
        docsSourcePath: discovery.docsSourcePath,
        files: files.map((file) => {
          const docsRelativePath = file.relativePath.replace(
            /^\.clawchat\//,
            "",
          );
          return {
            relativePath: file.relativePath,
            path: file.relativePath,
            docsRelativePath,
            expectedPreviousHash: file.previousHash,
            expectedPreviousSha256: file.previousHash,
            updatedContent: file.updatedContent,
            content: file.updatedContent,
            updatedHash: file.updatedHash,
            sha256: file.updatedHash,
            updatedSha256: file.updatedHash,
          };
        }),
      },
      45_000,
    );
    const applyErrors = response.errors ?? [];
    const applyConflicts = response.conflicts ?? [];
    const applySucceeded =
      response.status === "applied" ||
      (response.status === "ok" &&
        applyErrors.length === 0 &&
        applyConflicts.length === 0);
    if (!applySucceeded) {
      const details = applyConflicts.length ? applyConflicts : applyErrors;
      throw new BadRequestException(
        `Documentation apply failed: ${
          details.length
            ? JSON.stringify(details)
            : JSON.stringify({
                status: response.status,
                writtenFiles: response.writtenFiles ?? [],
                repoPath: response.repoPath ?? null,
              })
        }`,
      );
    }
  }

  private async syncInstalledLocalRepoDocsForWorkspace(
    workspaceId: string,
    userId: string | null,
    trigger: string,
  ) {
    const linkedApps = await this.linkedApplicationRepo.find({
      where: { workspaceId },
      order: { updatedAt: "DESC" },
    });
    for (const linked of linkedApps) {
      if (!this.isLocalLinkedApplication(linked)) continue;
      const appSlug = String(linked.metadata?.marketplaceSlug ?? linked.slug);
      await this.syncInstalledLocalRepoDocsIfChanged(
        workspaceId,
        appSlug,
        userId,
        trigger,
      );
    }
  }

  private async syncInstalledLocalRepoDocsIfChanged(
    workspaceId: string,
    appSlug: string,
    userId: string | null,
    trigger: string,
  ) {
    if (MARKETPLACE_CATALOG.some((item) => item.slug === appSlug)) return;
    const key = `${workspaceId}:${appSlug}`;
    if (this.localRepoReadSyncRunning.has(key)) return;
    this.localRepoReadSyncRunning.add(key);
    try {
      const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
      const sourceHostType = String(
        linked.metadata?.sourceHostType ??
          linked.apiStyleMetadata?.sourceHostType ??
          "",
      );
      if (!sourceHostType) return;

      const activeInstalls = await this.marketplaceInstallRepo.find({
        where: { workspaceId, appSlug },
      });
      if (
        !activeInstalls.some((install) => install.installStatus !== "removed")
      )
        return;

      const actorUserId =
        userId ?? (await this.resolveDocumentationSyncActorUserId(linked));
      if (!actorUserId) {
        this.logger.warn(
          `Skipping read-triggered documentation sync for ${workspaceId}/${appSlug}: no workspace actor found`,
        );
        return;
      }

      const discovery = await this.discoverLocalRepoSource(linked);
      if (this.getDocumentationAutomationMode(linked) !== "manual_review") {
        await this.runLocalRepoDocumentationAutomation(
          workspaceId,
          appSlug,
          actorUserId,
          `automatic_${trigger}_docs_changed`,
        );
        return;
      }
      const previousHash = String(linked.metadata?.sourceHash ?? "");
      await this.updateLocalRepoAutoSyncCheckMetadata(
        workspaceId,
        linked.id,
        discovery.sourceHash,
      );
      if (previousHash && previousHash === discovery.sourceHash) return;

      await this.refreshInstalledAgentDocs(workspaceId, appSlug, actorUserId, {
        trigger: `automatic_${trigger}_docs_changed`,
      });
    } catch (error) {
      this.logger.warn(
        `Read-triggered documentation sync failed for ${workspaceId}/${appSlug}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.localRepoReadSyncRunning.delete(key);
    }
  }

  @Cron("0 6 * * *")
  async runAutomaticLocalRepoDocumentationSync() {
    if (this.autoDocSyncRunning) return;
    this.autoDocSyncRunning = true;
    try {
      const linkedApps = await this.linkedApplicationRepo.find();
      for (const linked of linkedApps) {
        const appSlug = String(linked.metadata?.marketplaceSlug ?? linked.slug);
        const sourceHostType = String(
          linked.metadata?.sourceHostType ??
            linked.apiStyleMetadata?.sourceHostType ??
            "",
        );
        if (!appSlug || !sourceHostType) continue;
        const activeInstalls = await this.marketplaceInstallRepo.find({
          where: { workspaceId: linked.workspaceId, appSlug },
        });
        if (
          !activeInstalls.some((install) => install.installStatus !== "removed")
        ) {
          continue;
        }
        const actorUserId =
          await this.resolveDocumentationSyncActorUserId(linked);
        if (!actorUserId) {
          this.logger.warn(
            `Skipping automatic documentation sync for ${linked.workspaceId}/${appSlug}: no workspace actor found`,
          );
          continue;
        }
        try {
          const discovery = await this.discoverLocalRepoSource(linked);
          if (this.getDocumentationAutomationMode(linked) !== "manual_review") {
            await this.runLocalRepoDocumentationAutomation(
              linked.workspaceId,
              appSlug,
              actorUserId,
              "automatic_repo_docs_changed",
            );
            continue;
          }
          const previousHash = String(linked.metadata?.sourceHash ?? "");
          await this.updateLocalRepoAutoSyncCheckMetadata(
            linked.workspaceId,
            linked.id,
            discovery.sourceHash,
          );
          if (previousHash && previousHash === discovery.sourceHash) continue;
          await this.refreshInstalledAgentDocs(
            linked.workspaceId,
            appSlug,
            actorUserId,
            {
              trigger: "automatic_repo_docs_changed",
            },
          );
        } catch (error) {
          this.logger.warn(
            `Automatic documentation sync failed for ${linked.workspaceId}/${appSlug}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } finally {
      this.autoDocSyncRunning = false;
    }
  }

  async listConnections(workspaceId: string, appSlug?: string) {
    const where = appSlug ? { workspaceId, appSlug } : { workspaceId };
    const connections = await this.connectionRepo.find({
      where,
      order: { updatedAt: "DESC" },
    });
    return connections.map((connection) => this.toConnectionView(connection));
  }

  async createConnection(
    workspaceId: string,
    userId: string,
    dto: CreateMarketplaceConnectionDto,
  ) {
    const app = await this.resolveMarketplaceApp(workspaceId, dto.appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    const displayName = dto.displayName.trim();
    if (!displayName) throw new BadRequestException("Display name is required");
    const authType =
      dto.authType?.trim() || app.connectionTypes[0] || "api_key";
    const normalizedCredentials = normalizeMarketplaceCredentials(
      app,
      authType,
      dto.credentials ?? {},
    );
    const encrypted = this.encryptCredentials(
      normalizedCredentials.credentials,
      { workspaceId, appSlug: app.slug },
    );
    const selectedCapabilities = this.normalizeCapabilities(
      app,
      dto.selectedCapabilities,
    );
    const connectionMetadata = this.buildConnectionMetadata(app, dto.metadata);
    const requiresProviderVerification = app.sourceType !== "local_repo";
    const saved = await this.connectionRepo.save(
      this.connectionRepo.create({
        workspaceId,
        appSlug: app.slug,
        displayName,
        environment: dto.environment?.trim() || "default",
        authType,
        executionAuthority: "railway",
        credentialNames: normalizedCredentials.credentialNames,
        secretCiphertext: encrypted.ciphertext,
        secretIv: encrypted.iv,
        secretAuthTag: encrypted.authTag,
        secretKeyVersion: encrypted.keyVersion,
        selectedCapabilities,
        status: requiresProviderVerification ? "unverified" : "ready",
        lastValidatedAt: requiresProviderVerification ? null : new Date(),
        metadata: this.withNativeApiKeyMetadata(
          app,
          {
            ...connectionMetadata,
            connectionVerification: {
              catalogStatus: "documentation_reviewed",
              customerStatus: requiresProviderVerification
                ? "checking"
                : "customer_connected",
              relayVerified: app.release?.liveVerified === true,
              networkPolicy: "connector_fixed_provider_egress",
              arbitraryProviderUrlsAllowed: false,
              retainUnverifiedCredentials:
                dto.retainUnverifiedCredentials === true,
            },
          },
          selectedCapabilities,
        ),
        createdByUserId: userId,
        updatedByUserId: userId,
      }),
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.connection.created",
      resourceType: "marketplace_connection",
      resourceId: saved.id,
      metadata: {
        appSlug: app.slug,
        environment: saved.environment,
        selectedCapabilities,
      },
    });
    return this.toConnectionView(saved);
  }

  async updateConnection(
    workspaceId: string,
    connectionId: string,
    userId: string,
    dto: UpdateMarketplaceConnectionDto,
  ) {
    const connection = await this.getConnectionEntity(
      workspaceId,
      connectionId,
    );
    const app = await this.resolveMarketplaceApp(
      workspaceId,
      connection.appSlug,
    );
    this.assertMarketplaceAppAvailableForBeta(app);
    if (dto.displayName !== undefined)
      connection.displayName = dto.displayName.trim();
    if (dto.environment !== undefined)
      connection.environment = dto.environment.trim() || "default";
    if (dto.selectedCapabilities !== undefined) {
      connection.selectedCapabilities = this.normalizeCapabilities(
        app,
        dto.selectedCapabilities,
      );
    }
    if (dto.metadata !== undefined) {
      connection.metadata = this.withNativeApiKeyMetadata(
        app,
        this.buildConnectionMetadata(app, dto.metadata),
        connection.selectedCapabilities,
      );
    }
    if (dto.credentials !== undefined) {
      const normalizedCredentials = normalizeMarketplaceCredentials(
        app,
        connection.authType,
        dto.credentials,
      );
      const encrypted = this.encryptCredentials(
        normalizedCredentials.credentials,
        connection,
      );
      connection.credentialNames = normalizedCredentials.credentialNames;
      connection.secretCiphertext = encrypted.ciphertext;
      connection.secretIv = encrypted.iv;
      connection.secretAuthTag = encrypted.authTag;
      connection.secretKeyVersion = encrypted.keyVersion;
      connection.status =
        app.sourceType === "local_repo" ? "ready" : "unverified";
      connection.lastValidatedAt =
        app.sourceType === "local_repo" ? new Date() : null;
      connection.lastErrorCode = null;
      connection.lastErrorMessage = null;
      connection.metadata = {
        ...(connection.metadata ?? {}),
        connectionVerification: {
          catalogStatus: "documentation_reviewed",
          customerStatus:
            app.sourceType === "local_repo" ? "customer_connected" : "checking",
          relayVerified: app.release?.liveVerified === true,
          networkPolicy: "connector_fixed_provider_egress",
          arbitraryProviderUrlsAllowed: false,
          retainUnverifiedCredentials: dto.retainUnverifiedCredentials === true,
        },
      };
    }
    connection.updatedByUserId = userId;
    const saved = await this.connectionRepo.save(connection);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.connection.updated",
      resourceType: "marketplace_connection",
      resourceId: saved.id,
      metadata: {
        appSlug: saved.appSlug,
        selectedCapabilities: saved.selectedCapabilities,
      },
    });
    return this.toConnectionView(saved);
  }

  async reconcileConnectionVerification(
    workspaceId: string,
    connectionId: string,
    userId: string,
    result: {
      status: string;
      tokenValid: boolean;
      errorCode?: string | null;
      networkPolicy?: "connector_fixed_provider_egress" | "no_provider_egress";
    },
    retainUnverifiedCredentials: boolean,
  ) {
    const connection = await this.getConnectionEntity(
      workspaceId,
      connectionId,
    );
    const verified = result.status === "ready" && result.tokenValid === true;
    const noSafeProbe =
      result.status === "ready" && result.tokenValid === false;
    let customerStatus:
      | "customer_connected"
      | "configured_unverified"
      | "credentials_rejected";

    if (verified) {
      customerStatus = "customer_connected";
      connection.status = "ready";
      connection.lastValidatedAt = new Date();
      connection.lastErrorCode = null;
      connection.lastErrorMessage = null;
    } else if (noSafeProbe && retainUnverifiedCredentials) {
      customerStatus = "configured_unverified";
      // Bounded tools may run, but the UI must keep the unverified label until
      // a provider operation succeeds. Arbitrary provider calls remain absent.
      connection.status = "ready";
      connection.lastValidatedAt = null;
      connection.lastErrorCode = "configured_unverified";
      connection.lastErrorMessage =
        "The provider offers no harmless credential probe. The first bounded operation will verify this connection.";
    } else {
      customerStatus = "credentials_rejected";
      connection.credentialNames = [];
      connection.secretCiphertext = null;
      connection.secretIv = null;
      connection.secretAuthTag = null;
      connection.secretKeyVersion = null;
      connection.status = "needs_credentials";
      connection.lastValidatedAt = null;
      connection.lastErrorCode = this.safeCredentialVerificationErrorCode(
        result.errorCode,
      );
      connection.lastErrorMessage =
        noSafeProbe && !retainUnverifiedCredentials
          ? "The provider has no harmless verification probe, so Relay deleted the encrypted credential. Confirm retention to save it as configured but unverified."
          : "The provider did not accept this connection. Relay deleted the encrypted credential; check the credential and try again.";
    }
    connection.metadata = {
      ...(connection.metadata ?? {}),
      connectionVerification: {
        catalogStatus: "documentation_reviewed",
        customerStatus,
        relayVerified: false,
        networkPolicy:
          result.networkPolicy ?? "connector_fixed_provider_egress",
        arbitraryProviderUrlsAllowed: false,
        credentialRetained: customerStatus !== "credentials_rejected",
        checkedAt: new Date().toISOString(),
      },
    };
    connection.updatedByUserId = userId;
    const saved = await this.connectionRepo.save(connection);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.connection.verification.completed",
      resourceType: "marketplace_connection",
      resourceId: saved.id,
      metadata: {
        appSlug: saved.appSlug,
        customerStatus,
        credentialRetained: customerStatus !== "credentials_rejected",
      },
    });
    return this.toConnectionView(saved);
  }

  async disconnectConnection(
    workspaceId: string,
    connectionId: string,
    userId: string,
  ) {
    const connection = await this.getConnectionEntity(
      workspaceId,
      connectionId,
    );
    connection.secretCiphertext = null;
    connection.secretIv = null;
    connection.secretAuthTag = null;
    connection.secretKeyVersion = null;
    connection.credentialNames = [];
    connection.status = "needs_credentials";
    connection.lastValidatedAt = null;
    connection.lastErrorCode = "credentials_disconnected";
    connection.lastErrorMessage =
      "The encrypted credential copy was deleted. Rotate or revoke the credential with the provider.";
    connection.updatedByUserId = userId;
    const saved = await this.connectionRepo.save(connection);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.connection.credentials_deleted",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        appSlug: connection.appSlug,
        encryptedCredentialDeleted: true,
      },
    });
    return this.toConnectionView(saved);
  }

  async deleteConnection(
    workspaceId: string,
    connectionId: string,
    userId: string,
  ) {
    const connection = await this.getConnectionEntity(
      workspaceId,
      connectionId,
    );
    const installs = await this.marketplaceInstallRepo.find({
      where: { workspaceId, connectionId },
    });
    const removedAt = new Date().toISOString();
    for (const install of installs) {
      install.connectionId = null;
      install.installStatus = "removed";
      install.driftStatus = "unconfigured";
      install.metadata = {
        ...(install.metadata ?? {}),
        removedAt,
        removedByUserId: userId,
        removalReason: "connection_deleted",
        runtimeCleanup: "not_performed",
        runtimeCleanupNote:
          "ClawChat removed the Railway assignment. Runtime files and local skill folders were not deleted.",
      };
      await this.marketplaceInstallRepo.save(install);
      await this.auditLogService.record({
        actorType: "user",
        actorId: userId,
        workspaceId,
        eventType: "marketplace.install.unconfigured",
        resourceType: "marketplace_install",
        resourceId: install.id,
        metadata: {
          appSlug: install.appSlug,
          agentId: install.agentId,
          removalReason: "connection_deleted",
        },
      });
    }
    await this.connectionRepo.remove(connection);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.connection.deleted",
      resourceType: "marketplace_connection",
      resourceId: connection.id,
      metadata: {
        appSlug: connection.appSlug,
        encryptedCredentialDeleted: true,
        removedInstallIds: installs.map((install) => install.id),
      },
    });
    return {
      id: connection.id,
      appSlug: connection.appSlug,
      deleted: true,
      removedInstallIds: installs.map((install) => install.id),
    };
  }

  private safeCredentialVerificationErrorCode(value?: string | null) {
    const allowed = new Set([
      "credential_missing",
      "token_expired",
      "insufficient_scope",
      "provider_rate_limited",
      "provider_unavailable",
      "provider_validation_error",
    ]);
    return value && allowed.has(value) ? value : "provider_validation_error";
  }

  async listInstalls(workspaceId: string) {
    return this.marketplaceInstallRepo.find({
      where: { workspaceId },
      order: { updatedAt: "DESC" },
    });
  }

  async removeInstall(workspaceId: string, installId: string, userId: string) {
    const install = await this.marketplaceInstallRepo.findOne({
      where: { id: installId, workspaceId },
    });
    if (!install) throw new NotFoundException("Marketplace install not found");
    install.installStatus = "removed";
    install.driftStatus = "unconfigured";
    install.metadata = {
      ...(install.metadata ?? {}),
      removedAt: new Date().toISOString(),
      removedByUserId: userId,
      runtimeCleanup: "not_performed",
      runtimeCleanupNote:
        "ClawChat install state was unconfigured. Runtime files/skills were not removed by this action.",
    };
    const saved = await this.marketplaceInstallRepo.save(install);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.install.unconfigured",
      resourceType: "marketplace_install",
      resourceId: saved.id,
      metadata: {
        appSlug: saved.appSlug,
        agentId: saved.agentId,
        role: saved.role,
        runtimeCleanup: "not_performed",
      },
    });
    return saved;
  }

  async listGeneratedPacks(workspaceId: string) {
    await this.ensureGeneratedPackRecords(workspaceId);
    const packs = await this.generatedPackRepo.find({
      where: [{ workspaceId }, { workspaceId: IsNull() }],
      order: { updatedAt: "DESC" },
    });
    return packs.map((pack) => this.toGeneratedPackSummary(pack));
  }

  async generatedPackCoverage(workspaceId: string) {
    await this.ensureGeneratedPackRecords(workspaceId);
    const report = generateMarketplacePackCoverageReport(MARKETPLACE_CATALOG);
    const persisted = await this.generatedPackRepo.find({
      where: [{ workspaceId }, { workspaceId: IsNull() }],
    });
    const bySlug = new Map(persisted.map((pack) => [pack.appSlug, pack]));
    return {
      ...report,
      apps: report.apps.map((item) => {
        const pack = bySlug.get(item.slug);
        return pack
          ? {
              ...item,
              qualityLevel: pack.qualityLevel,
              publicationStatus: pack.publicationStatus,
              score: pack.qualityScore,
              confidence: pack.confidence,
              missingSections: pack.missingSections,
              warnings: pack.warnings,
              reviewStatus: pack.reviewStatus,
            }
          : item;
      }),
    };
  }

  async getGeneratedPackDetail(workspaceId: string, appSlug: string) {
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    if (hasCanonicalPack(app)) {
      throw new BadRequestException(
        `${app.name} is a curated pack and is not managed by generated-pack review.`,
      );
    }
    const pack = await this.ensureGeneratedPackRecord(workspaceId, app);
    const [sources, qualityScores, reviews, jobs] = await Promise.all([
      this.packSourceRepo.find({
        where: { workspaceId, appSlug },
        order: { updatedAt: "DESC" },
      }),
      this.packQualityScoreRepo.find({
        where: { workspaceId, appSlug },
        order: { createdAt: "DESC" },
        take: 10,
      }),
      this.packReviewRepo.find({
        where: { workspaceId, appSlug },
        order: { createdAt: "DESC" },
        take: 20,
      }),
      this.generationJobRepo.find({
        where: { workspaceId, appSlug },
        order: { createdAt: "DESC" },
        take: 10,
      }),
    ]);
    const generatedPack = this.readGeneratedPack(pack);
    const packMetadata = pack.metadata as {
      sourceIngestion?: Record<string, unknown>;
      sourceDiff?: Record<string, unknown>;
      importedSourceModel?: MarketplaceExtractedSourceModel;
    };
    const reviewGate = evaluateGeneratedPackReviewGate(app, generatedPack);
    return {
      ...this.toGeneratedPackSummary(pack),
      generatedPack,
      reviewGate,
      sourceIngestion: packMetadata.sourceIngestion,
      sourceDiff: packMetadata.sourceDiff,
      extractedSourceModel:
        packMetadata.importedSourceModel ?? generatedPack.extractedSourceModel,
      sources,
      qualityScores,
      reviews,
      jobs,
      openclawPreview: this.previewPersistedGeneratedPack(
        app,
        generatedPack,
        "openclaw",
      ),
      hermesPreview: this.previewPersistedGeneratedPack(
        app,
        generatedPack,
        "hermes",
      ),
    };
  }

  async rerunGeneratedPack(
    workspaceId: string,
    appSlug: string,
    userId: string,
  ) {
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    if (hasCanonicalPack(app)) {
      throw new BadRequestException(
        `${app.name} is curated and cannot be regenerated by the factory.`,
      );
    }
    const job = await this.generationJobRepo.save(
      this.generationJobRepo.create({
        workspaceId,
        appSlug,
        status: "running",
        inputConfig: this.buildPackConfigFromPersistedMetadata(
          await this.ensureGeneratedPackRecord(workspaceId, app),
          app,
        ) as unknown as Record<string, unknown>,
        startedByUserId: userId,
        startedAt: new Date(),
      }),
    );
    try {
      const currentPack = await this.ensureGeneratedPackRecord(
        workspaceId,
        app,
      );
      const generated = generateDraftPackFromConfig(
        this.buildPackConfigFromPersistedMetadata(currentPack, app),
      );
      const pack = await this.upsertGeneratedPack(workspaceId, app, generated);
      job.status = "completed";
      job.completedAt = new Date();
      job.resultSummary = {
        generatedPackId: pack.id,
        qualityScore: pack.qualityScore,
        confidence: pack.confidence,
      };
      await this.generationJobRepo.save(job);
      await this.recordGeneratedPackReview(
        workspaceId,
        appSlug,
        userId,
        "rerun_generation",
        "Factory generation rerun.",
      );
      return this.getGeneratedPackDetail(workspaceId, appSlug);
    } catch (error) {
      job.status = "failed";
      job.completedAt = new Date();
      job.errorMessage =
        error instanceof Error ? error.message : "Generation failed";
      await this.generationJobRepo.save(job);
      throw error;
    }
  }

  async updateGeneratedPackSources(
    workspaceId: string,
    appSlug: string,
    userId: string,
    dto: UpdateMarketplacePackSourcesDto,
  ) {
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    if (hasCanonicalPack(app)) {
      throw new BadRequestException(
        `${app.name} is curated and cannot be overwritten by generated sources.`,
      );
    }
    const config = this.buildPackConfigFromSourceDto(app, dto);
    const generated = generateDraftPackFromConfig(config);
    await this.upsertGeneratedPack(workspaceId, app, generated);
    await this.recordGeneratedPackReview(
      workspaceId,
      appSlug,
      userId,
      "update_sources",
      "Updated generated pack source configuration.",
      {
        docs: dto.docs ?? {},
        knownObjects: dto.knownObjects ?? [],
        highRiskActions: dto.highRiskActions ?? [],
        commonWorkflows: dto.commonWorkflows ?? [],
      },
    );
    return this.getGeneratedPackDetail(workspaceId, appSlug);
  }

  async previewGeneratedPackSourceImport(
    workspaceId: string,
    appSlug: string,
    dto: ImportMarketplacePackSourcesDto,
  ) {
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    if (hasCanonicalPack(app)) {
      throw new BadRequestException(
        `${app.name} is curated and cannot be overwritten by generated sources.`,
      );
    }
    await this.ensureGeneratedPackRecord(workspaceId, app);
    return this.importSourceModelFromDto(app, dto);
  }

  async importGeneratedPackSources(
    workspaceId: string,
    appSlug: string,
    userId: string,
    dto: ImportMarketplacePackSourcesDto,
  ) {
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    if (hasCanonicalPack(app)) {
      throw new BadRequestException(
        `${app.name} is curated and cannot be overwritten by generated sources.`,
      );
    }
    const before = await this.ensureGeneratedPackRecord(workspaceId, app);
    const beforeScore = before.qualityScore;
    const sourceModel = await this.importSourceModelFromDto(app, dto);
    const config = this.buildPackConfigFromSourceDto(app, dto, sourceModel);
    const generated = generateDraftPackFromConfig(config);
    await this.upsertGeneratedPack(workspaceId, app, generated, {
      sourceConfig: config,
      importedSourceModel: sourceModel,
      sourceIngestion: {
        importedAt: sourceModel.extractedAt,
        errors: sourceModel.ingestionErrors,
        coverage: sourceModel.coverage,
        improvedSections: this.diffCoverageSections(
          this.readGeneratedPack(before).extractedSourceModel?.coverage,
          sourceModel.coverage,
        ),
        beforeScore,
        afterScore: generated.quality.score,
      },
    });
    await this.recordGeneratedPackReview(
      workspaceId,
      appSlug,
      userId,
      "import_sources",
      "Imported provider source material and regenerated draft pack.",
      {
        sourceUrls: sourceModel.sourceUrls,
        coverage: sourceModel.coverage,
        ingestionErrors: sourceModel.ingestionErrors,
        beforeScore,
        afterScore: generated.quality.score,
      },
    );
    return this.getGeneratedPackDetail(workspaceId, appSlug);
  }

  async recordGeneratedPackReview(
    workspaceId: string,
    appSlug: string,
    userId: string,
    action: string,
    notes?: string | null,
    metadata: Record<string, unknown> = {},
  ) {
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    if (hasCanonicalPack(app)) {
      throw new BadRequestException(
        `${app.name} is curated and does not use generated-pack review.`,
      );
    }
    const pack = await this.ensureGeneratedPackRecord(workspaceId, app);
    const review = await this.packReviewRepo.save(
      this.packReviewRepo.create({
        workspaceId,
        appSlug,
        generatedPackId: pack.id,
        action,
        notes: notes?.trim() || null,
        metadata,
        reviewerUserId: userId,
      }),
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: `marketplace.generated_pack.${action}`,
      resourceType: "marketplace_generated_pack",
      resourceId: pack.id,
      metadata: { appSlug, notes: notes ?? null, ...metadata },
    });
    return review;
  }

  async promoteGeneratedPack(
    workspaceId: string,
    appSlug: string,
    userId: string,
    notes?: string | null,
  ) {
    const pack = await this.getMutableGeneratedPack(workspaceId, appSlug);
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    const generatedPack = this.readGeneratedPack(pack);
    const reviewGate = evaluateGeneratedPackReviewGate(app, generatedPack);
    const canPromoteWithManualReview =
      app.sourceType === "local_repo" &&
      reviewGate.outcome === "needs_manual_review";
    if (!reviewGate.passed && !canPromoteWithManualReview) {
      await this.recordGeneratedPackReview(
        workspaceId,
        appSlug,
        userId,
        "promotion_blocked_by_review_gate",
        notes,
        {
          reviewGate,
        },
      );
      throw new BadRequestException(
        `Generated pack is not ready for promotion: ${reviewGate.blockingReasons.join("; ")}`,
      );
    }
    pack.qualityLevel = "generated_reviewed";
    pack.publicationStatus = "review_needed";
    pack.reviewStatus = "human_reviewed";
    pack.confidence = pack.confidence === "low" ? "medium" : pack.confidence;
    await this.generatedPackRepo.save(pack);
    await this.recordGeneratedPackReview(
      workspaceId,
      appSlug,
      userId,
      "promote_generated_reviewed",
      notes,
      {
        reviewGate,
        manualReviewAccepted: canPromoteWithManualReview,
      },
    );
    return this.getGeneratedPackDetail(workspaceId, appSlug);
  }

  async publishGeneratedPack(
    workspaceId: string,
    appSlug: string,
    userId: string,
    notes?: string | null,
  ) {
    const pack = await this.getMutableGeneratedPack(workspaceId, appSlug);
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    if (pack.qualityLevel !== "generated_reviewed") {
      throw new BadRequestException(
        "Promote the generated pack to generated_reviewed before publishing.",
      );
    }
    pack.publicationStatus = "published";
    pack.reviewStatus = "approved";
    await this.generatedPackRepo.save(pack);
    if (app.sourceType === "local_repo") {
      const linked = await this.getLocalLinkedApplication(workspaceId, appSlug);
      linked.documentationPackStatus = "generated";
      linked.metadata = {
        ...linked.metadata,
        sourceChanged: false,
        lastPublishedPackId: pack.id,
        lastPublishedAt: new Date().toISOString(),
      };
      await this.linkedApplicationRepo.save(linked);
    }
    await this.recordGeneratedPackReview(
      workspaceId,
      appSlug,
      userId,
      "publish",
      notes,
    );
    return this.getGeneratedPackDetail(workspaceId, appSlug);
  }

  async rejectGeneratedPack(
    workspaceId: string,
    appSlug: string,
    userId: string,
    notes?: string | null,
  ) {
    this.assertMarketplaceAppAvailableForBeta(
      await this.resolveMarketplaceApp(workspaceId, appSlug),
    );
    const pack = await this.getMutableGeneratedPack(workspaceId, appSlug);
    pack.publicationStatus = "blocked";
    pack.reviewStatus = "rejected";
    await this.generatedPackRepo.save(pack);
    await this.recordGeneratedPackReview(
      workspaceId,
      appSlug,
      userId,
      "reject",
      notes,
    );
    return this.getGeneratedPackDetail(workspaceId, appSlug);
  }

  async markGeneratedPackNeedsManualReview(
    workspaceId: string,
    appSlug: string,
    userId: string,
    notes?: string | null,
  ) {
    this.assertMarketplaceAppAvailableForBeta(
      await this.resolveMarketplaceApp(workspaceId, appSlug),
    );
    const pack = await this.getMutableGeneratedPack(workspaceId, appSlug);
    pack.publicationStatus = "review_needed";
    pack.reviewStatus = "needs_manual_review";
    await this.generatedPackRepo.save(pack);
    await this.recordGeneratedPackReview(
      workspaceId,
      appSlug,
      userId,
      "needs_manual_review",
      notes,
    );
    return this.getGeneratedPackDetail(workspaceId, appSlug);
  }

  async previewPack(
    workspaceId: string,
    userId: string,
    dto: PreviewMarketplacePackDto,
  ) {
    const app = await this.resolveMarketplaceApp(workspaceId, dto.appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    const selectedCapabilities = this.normalizeCapabilities(
      app,
      dto.selectedCapabilities,
    );
    const runtimeFormat = this.resolveRuntimeFormat(app, dto.runtimeFormat);
    const connection = dto.connectionId
      ? await this.getConnectionEntity(workspaceId, dto.connectionId)
      : null;
    if (connection && connection.appSlug !== app.slug) {
      throw new BadRequestException(
        "Connection belongs to a different marketplace app",
      );
    }
    const preview = await this.buildCompiledPreview(workspaceId, {
      app,
      runtimeFormat,
      libraryTargetFolder: `marketplace/${app.slug}`,
      selectedCapabilities,
      approvalProfileId: dto.approvalProfileId,
      connection,
    });
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.runtime_format.selected",
      resourceType: "marketplace_app",
      resourceId: app.slug,
      metadata: {
        appSlug: app.slug,
        runtimeFormat,
      },
    });
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.approval_profile.selected",
      resourceType: "marketplace_app",
      resourceId: app.slug,
      metadata: {
        appSlug: app.slug,
        approvalProfileId: preview.approvalProfileId,
      },
    });
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.pack.previewed",
      resourceType: "marketplace_app",
      resourceId: app.slug,
      metadata: {
        appSlug: app.slug,
        runtimeFormat,
        approvalProfileId: preview.approvalProfileId,
        connectionId: connection?.id ?? null,
        selectedCapabilities,
      },
    });
    return {
      appSlug: app.slug,
      runtimeFormat,
      approvalProfileId: preview.approvalProfileId,
      selectedCapabilities,
      metadata: preview.metadata,
      files: preview.files,
    };
  }

  async install(
    workspaceId: string,
    userId: string,
    dto: InstallMarketplaceAppDto,
  ) {
    let app = await this.resolveMarketplaceApp(workspaceId, dto.appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    const installRole = this.normalizeInstallRole(dto.role);
    app = await this.ensureLocalRepoDocsReadyForInstall(
      workspaceId,
      userId,
      app,
      installRole,
    );
    const approvalProfileId = this.resolveApprovalProfileId(
      app,
      dto.approvalProfileId,
      dto.acknowledgeDangerouslySkipPermissions,
    );
    const selectedCapabilities = this.normalizeCapabilities(
      app,
      dto.selectedCapabilities,
    );
    const connection = dto.connectionId
      ? await this.getConnectionEntity(workspaceId, dto.connectionId)
      : null;
    if (connection && connection.appSlug !== app.slug) {
      throw new BadRequestException(
        "Connection belongs to a different marketplace app",
      );
    }
    const installMetadata = {
      ...this.buildMarketplaceInstallMetadata(
        app.slug,
        connection,
        dto.outlookSenderEmail,
      ),
      ...this.dangerousPolicyAcknowledgementMetadata(approvalProfileId, userId),
    };
    const runtimeFormat = this.resolveRuntimeFormat(app, dto.runtimeFormat);
    this.assertRuntimeInstallable(app, runtimeFormat);
    this.assertRoleDefined(app, installRole);
    const libraryTargetFolder =
      dto.libraryTargetFolder?.trim() || `marketplace/${app.slug}`;
    const targetMode = dto.targetMode ?? "existing_agents";
    await this.assertGeneratedDraftInstallAllowed(
      workspaceId,
      app,
      dto.acknowledgeGeneratedDraftRisk,
    );

    const workspaceAgents = await this.resolveInstallAgents(
      workspaceId,
      userId,
      dto,
      targetMode,
      app,
    );
    if (!workspaceAgents.length) {
      throw new BadRequestException("Select at least one target agent");
    }

    if (runtimeFormat === "openclaw") {
      const nonOpenClawAgent = workspaceAgents.find(
        (agent) => this.resolveAgentRuntimeType(agent) !== "openclaw",
      );
      const availability = nonOpenClawAgent
        ? {
            available: false,
            message:
              "Select an OpenClaw agent before installing an OpenClaw marketplace app.",
          }
        : await this.bridgeService.openClawMarketplaceInstallAvailability(
            workspaceId,
            workspaceAgents.map((agent) => ({
              name: agent.name,
              externalId: agent.externalId,
            })),
          );
      if (!availability.available) {
        await this.auditLogService.record({
          actorType: "user",
          actorId: userId,
          workspaceId,
          eventType: "marketplace.openclaw_install.unavailable",
          resourceType: "marketplace_app",
          resourceId: app.slug,
          metadata: {
            appSlug: app.slug,
            runtimeFormat,
            targetMode,
            role: installRole,
            agentIds: workspaceAgents.map((agent) => agent.id),
            reason: availability.message,
          },
        });
        return {
          app,
          pack: null,
          syncedFiles: [],
          installs: [],
          runtimeFormat,
          status: "unavailable",
          message: availability.message,
          requiredCapability: null,
          bridgeRequest: null,
          bridgeResponse: null,
          createdAgent: null,
        };
      }
    }

    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.install.target.selected",
      resourceType: "marketplace_app",
      resourceId: app.slug,
      metadata: {
        appSlug: app.slug,
        targetMode,
        runtimeFormat,
        role: installRole,
        agentIds: workspaceAgents.map((agent) => agent.id),
      },
    });

    if (runtimeFormat === "hermes") {
      return this.installHermesPack({
        workspaceId,
        userId,
        app,
        connection,
        selectedCapabilities,
        approvalProfileId,
        targetMode,
        workspaceAgents,
        role: installRole,
        outlookSenderEmail: dto.outlookSenderEmail,
      });
    }

    const linkedApp = await this.ensureLinkedMarketplaceApplication(
      workspaceId,
      userId,
      app,
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.install.started",
      resourceType: "marketplace_app",
      resourceId: app.slug,
      metadata: {
        appSlug: app.slug,
        runtimeFormat,
        targetMode,
        role: installRole,
        agentIds: workspaceAgents.map((agent) => agent.id),
      },
    });
    const previewFiles = await this.buildOpenClawPackFiles(
      workspaceId,
      app,
      selectedCapabilities,
      approvalProfileId,
      connection,
      libraryTargetFolder,
    );
    const compiled = await this.ensureLocalRepoRoleRuntimeOutputFromSource(
      workspaceId,
      app,
      installRole,
      runtimeFormat,
      {
        runtimeFormat,
        approvalProfileId,
        files: previewFiles,
        metadata: {},
      },
    );
    const files = compiled.files;
    this.assertRoleRuntimeOutputAvailable(
      app,
      installRole,
      runtimeFormat,
      files,
    );
    const pack = await this.createPack(workspaceId, linkedApp, app, files, {
      connectionId: connection?.id ?? null,
      selectedCapabilities,
      approvalProfileId,
      runtimeFormat,
      targetMode,
    });
    const sync = await this.syncService.syncToLibrary(
      workspaceId,
      pack.id,
      libraryTargetFolder,
    );
    const installed = [];
    for (const agent of workspaceAgents) {
      const runtimeType = this.resolveAgentRuntimeType(agent);
      if (runtimeType !== "openclaw") {
        throw new BadRequestException(
          `Agent ${agent.name} uses runtime ${runtimeType}; only OpenClaw install is supported right now.`,
        );
      }
      const agentInstall = await this.installService.install(workspaceId, {
        packId: pack.id,
        agentId: agent.id,
        role: installRole,
      });
      const marketplaceInstall = await this.saveUniqueActiveMarketplaceInstall({
        workspaceId,
        appSlug: app.slug,
        connectionId: connection?.id ?? null,
        agentId: agent.id,
        packId: pack.id,
        agentDocumentationInstallId: agentInstall.install.id,
        role: installRole,
        selectedCapabilities,
        installStatus: "installed",
        driftStatus: "current",
        lastInstalledAt: new Date(),
        metadata: {
          ...installMetadata,
          installedFiles: agentInstall.installedFiles,
          libraryTargetFolder: sync.pack.libraryTargetFolder,
          runtimeFormat,
          role: installRole,
          approvalProfileId,
        },
      });
      installed.push(marketplaceInstall);
    }
    const currentApplicationVersion = await this.appDocVersionRepo.findOne({
      where: { workspaceId, appSlug: app.slug },
      order: { version: "DESC" },
    });
    await this.recordAgentDocumentationVersionsForInstalls(
      workspaceId,
      app.slug,
      installed,
      currentApplicationVersion?.id ?? null,
      userId,
      "agent_install",
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.pack.generated",
      resourceType: "marketplace_pack",
      resourceId: pack.id,
      metadata: {
        appSlug: app.slug,
        runtimeFormat,
        approvalProfileId,
        connectionId: connection?.id ?? null,
        selectedCapabilities,
      },
    });
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.install.completed",
      resourceType: "marketplace_app",
      resourceId: app.slug,
      metadata: {
        appSlug: app.slug,
        runtimeFormat,
        targetMode,
        role: installRole,
        packId: pack.id,
        installIds: installed.map((entry) => entry.id),
      },
    });
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.app.installed",
      resourceType: "marketplace_app",
      resourceId: app.slug,
      metadata: {
        appSlug: app.slug,
        connectionId: connection?.id ?? null,
        packId: pack.id,
        agentIds: workspaceAgents.map((agent) => agent.id),
        role: installRole,
        selectedCapabilities,
        runtimeFormat,
        approvalProfileId,
        dangerousPolicyAcknowledged:
          isDangerouslySkipPermissionsPolicy(approvalProfileId),
        targetMode,
      },
    });
    return {
      app,
      pack,
      syncedFiles: sync.syncedFiles,
      installs: installed,
      runtimeFormat,
      status: "installed",
      createdAgent:
        targetMode === "activate_new_agent"
          ? (workspaceAgents[0] ?? null)
          : null,
    };
  }

  private async installHermesPack(input: {
    workspaceId: string;
    userId: string;
    app: MarketplaceAppDefinition;
    connection: MarketplaceConnectionEntity | null;
    selectedCapabilities: string[];
    approvalProfileId: string;
    targetMode: "existing_agents" | "activate_new_agent";
    workspaceAgents: Array<
      AgentEntity & {
        runtimeBinding?: {
          runtimeType?: string | null;
          capabilities?: Record<string, unknown> | null;
        } | null;
      }
    >;
    role: MarketplaceInstallRole;
    outlookSenderEmail?: string;
  }) {
    const {
      workspaceId,
      userId,
      app,
      connection,
      selectedCapabilities,
      approvalProfileId,
      targetMode,
      workspaceAgents,
    } = input;
    const role = this.normalizeInstallRole(input.role);
    const runtimeFormat = "hermes" as const;
    const resolvedApprovalProfileId = approvalProfileId;
    const installMetadata = this.buildMarketplaceInstallMetadata(
      app.slug,
      connection,
      input.outlookSenderEmail,
    );
    Object.assign(
      installMetadata,
      this.dangerousPolicyAcknowledgementMetadata(
        resolvedApprovalProfileId,
        userId,
      ),
    );
    const bridgeCapabilityAvailable =
      this.bridgeService.hasHermesMarketplaceSkillInstallCapability(
        workspaceId,
      );
    const nonHermesAgent = workspaceAgents.find(
      (agent) => this.resolveAgentRuntimeType(agent) !== "hermes",
    );
    if (nonHermesAgent || !bridgeCapabilityAvailable) {
      const message = nonHermesAgent
        ? "Select a Hermes agent before installing a Hermes marketplace skill."
        : "Hermes bridge is not currently connected with marketplaceHermesSkillInstall support.";
      await this.auditLogService.record({
        actorType: "user",
        actorId: userId,
        workspaceId,
        eventType: "marketplace.hermes_install.unavailable",
        resourceType: "marketplace_app",
        resourceId: app.slug,
        metadata: {
          appSlug: app.slug,
          runtimeFormat,
          targetMode,
          role,
          requiredCapability: MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
          bridgeCapabilityAvailable,
          agentIds: workspaceAgents.map((agent) => agent.id),
          unavailableAgentId: nonHermesAgent?.id ?? null,
          agentRuntimeCapabilities: workspaceAgents.map((agent) => ({
            agentId: agent.id,
            runtimeType: this.resolveAgentRuntimeType(agent),
            hasMarketplaceHermesSkillInstall: this.hasRuntimeCapability(
              agent,
              MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
            ),
          })),
          approvalProfileId: resolvedApprovalProfileId,
          selectedCapabilities,
        },
      });
      return {
        app,
        pack: null,
        syncedFiles: [],
        installs: [],
        runtimeFormat,
        status: "unavailable",
        message,
        requiredCapability: MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
        bridgeRequest: null,
        bridgeResponse: null,
        createdAgent: null,
      };
    }

    const linkedApp = await this.ensureLinkedMarketplaceApplication(
      workspaceId,
      userId,
      app,
    );
    const compiledPreview = await this.buildCompiledPreview(workspaceId, {
      app,
      runtimeFormat,
      libraryTargetFolder: `marketplace/${app.slug}`,
      selectedCapabilities,
      approvalProfileId,
      connection,
    });
    const compiled = await this.ensureLocalRepoRoleRuntimeOutputFromSource(
      workspaceId,
      app,
      role,
      runtimeFormat,
      compiledPreview,
    );
    this.assertRoleRuntimeOutputAvailable(
      app,
      role,
      runtimeFormat,
      compiled.files,
    );
    const pack = await this.createPack(
      workspaceId,
      linkedApp,
      app,
      compiled.files,
      {
        connectionId: connection?.id ?? null,
        selectedCapabilities,
        approvalProfileId: compiled.approvalProfileId,
        runtimeFormat,
        targetMode,
      },
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.pack.generated",
      resourceType: "marketplace_pack",
      resourceId: pack.id,
      metadata: {
        appSlug: app.slug,
        runtimeFormat,
        approvalProfileId: compiled.approvalProfileId,
        connectionId: connection?.id ?? null,
        role,
        selectedCapabilities,
      },
    });

    const installed: MarketplaceInstallEntity[] = [];
    let lastBridgeRequest: MarketplaceHermesSkillInstallRequestPayload | null =
      null;
    let lastBridgeResponse: MarketplaceHermesSkillInstallResponsePayload | null =
      null;
    for (const agent of workspaceAgents) {
      const pendingInstall = await this.saveUniqueActiveMarketplaceInstall({
        workspaceId,
        appSlug: app.slug,
        connectionId: connection?.id ?? null,
        agentId: agent.id,
        packId: pack.id,
        agentDocumentationInstallId: null,
        role,
        selectedCapabilities,
        installStatus: "requested",
        driftStatus: "unknown",
        lastInstalledAt: null,
        metadata: {
          ...installMetadata,
          runtimeFormat,
          role,
          approvalProfileId: compiled.approvalProfileId,
          requiredCapability: MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
        },
      });
      const bridgePayload = this.buildHermesSkillInstallBridgeRequest({
        workspaceId,
        agent,
        app,
        marketplaceInstallId: pendingInstall.id,
        approvalProfileId: compiled.approvalProfileId,
        selectedCapabilities,
        connection,
        files: compiled.files,
        role: pendingInstall.role,
      });
      await this.auditLogService.record({
        actorType: "user",
        actorId: userId,
        workspaceId,
        eventType: "marketplace.hermes_install.requested",
        resourceType: "marketplace_install",
        resourceId: pendingInstall.id,
        metadata: {
          appSlug: app.slug,
          runtimeFormat,
          agentId: agent.id,
          role,
          connectionId: connection?.id ?? null,
          approvalProfileId: compiled.approvalProfileId,
          selectedCapabilities,
          requiredCapability: MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
          requestType: "marketplace.installHermesSkill",
          fileCount: bridgePayload.files.length,
          targetRoot: bridgePayload.targetRoot,
        },
      });

      try {
        const bridgeResult =
          await this.bridgeService.installMarketplaceHermesSkill(
            workspaceId,
            bridgePayload,
          );
        lastBridgeRequest = bridgeResult.request;
        lastBridgeResponse = bridgeResult.response;
        if (bridgeResult.response.status !== "installed") {
          pendingInstall.installStatus = bridgeResult.response.status;
          pendingInstall.metadata = {
            ...pendingInstall.metadata,
            bridgeResponse: this.sanitizeBridgeResponseForMetadata(
              bridgeResult.response,
            ),
          };
          await this.marketplaceInstallRepo.save(pendingInstall);
          await this.auditLogService.record({
            actorType: "user",
            actorId: userId,
            workspaceId,
            eventType: "marketplace.hermes_install.failed",
            resourceType: "marketplace_install",
            resourceId: pendingInstall.id,
            metadata: {
              appSlug: app.slug,
              runtimeFormat,
              agentId: agent.id,
              role,
              status: bridgeResult.response.status,
              error: bridgeResult.response.error ?? null,
            },
          });
          return {
            app,
            pack,
            syncedFiles: [],
            installs: installed,
            runtimeFormat,
            status: "failed",
            message:
              bridgeResult.response.error?.message ||
              "Hermes bridge rejected marketplace skill install.",
            requiredCapability: MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
            bridgeRequest: lastBridgeRequest,
            bridgeResponse: lastBridgeResponse,
            createdAgent: null,
          };
        }
        pendingInstall.installStatus = "installed";
        pendingInstall.driftStatus = "current";
        const installedAt = new Date();
        pendingInstall.lastInstalledAt = installedAt;
        const workspaceFileManifest = bridgePayload.files.map((file) => ({
          filename: `${bridgePayload.targetRoot}/${file.relativePath}`,
          path: `${bridgePayload.targetRoot}/${file.relativePath}`,
          sourcePath: file.relativePath,
          hash: file.sha256,
          classification:
            file.relativePath === "SKILL.md"
              ? "generated_workspace_router"
              : file.relativePath.endsWith("roles_manifest.json")
                ? "generated_role_manifest"
                : "generated_app_capability_docs",
        }));
        const agentDocumentationInstall =
          await this.agentDocumentationInstallRepo.save(
            this.agentDocumentationInstallRepo.create({
              workspaceId,
              agentId: agent.id,
              packId: pack.id,
              role,
              installedBlueprintVersions: [],
              workspaceFileManifest,
              localOverrides: {},
              installStatus: "installed",
              driftStatus: "current",
              lastInstalledAt: installedAt,
              metadata: {
                runtimeFormat,
                marketplaceInstallId: pendingInstall.id,
                skillName: bridgePayload.skillName,
                targetRoot: bridgePayload.targetRoot,
                installedFiles: bridgeResult.response.installedFiles,
              },
            }),
          );
        pendingInstall.agentDocumentationInstallId =
          agentDocumentationInstall.id;
        pendingInstall.metadata = {
          ...pendingInstall.metadata,
          installedFiles: bridgeResult.response.installedFiles,
          skippedFiles: bridgeResult.response.skippedFiles ?? [],
          bridgeCapabilities: bridgeResult.response.bridgeCapabilities ?? [],
          targetRoot: bridgePayload.targetRoot,
          skillName: bridgePayload.skillName,
        };
        const savedInstall =
          await this.marketplaceInstallRepo.save(pendingInstall);
        await this.markHermesDefaultSkillInstalled({
          agent,
          skillName: bridgePayload.skillName,
          appSlug: app.slug,
          role,
          marketplaceInstallId: savedInstall.id,
          targetRoot: bridgePayload.targetRoot,
        });
        installed.push(savedInstall);
        await this.auditLogService.record({
          actorType: "user",
          actorId: userId,
          workspaceId,
          eventType: "marketplace.hermes_install.completed",
          resourceType: "marketplace_install",
          resourceId: savedInstall.id,
          metadata: {
            appSlug: app.slug,
            runtimeFormat,
            agentId: agent.id,
            role,
            installedFiles: bridgeResult.response.installedFiles,
            bridgeCapabilities: bridgeResult.response.bridgeCapabilities ?? [],
          },
        });
      } catch (error) {
        pendingInstall.installStatus = "failed";
        pendingInstall.metadata = {
          ...pendingInstall.metadata,
          errorMessage:
            error instanceof Error ? error.message : "Hermes install failed",
        };
        await this.marketplaceInstallRepo.save(pendingInstall);
        await this.auditLogService.record({
          actorType: "user",
          actorId: userId,
          workspaceId,
          eventType: "marketplace.hermes_install.failed",
          resourceType: "marketplace_install",
          resourceId: pendingInstall.id,
          metadata: {
            appSlug: app.slug,
            runtimeFormat,
            agentId: agent.id,
            role,
            errorMessage:
              error instanceof Error ? error.message : "Hermes install failed",
          },
        });
        return {
          app,
          pack,
          syncedFiles: [],
          installs: installed,
          runtimeFormat,
          status: "failed",
          message:
            error instanceof Error ? error.message : "Hermes install failed",
          requiredCapability: MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
          bridgeRequest: lastBridgeRequest,
          bridgeResponse: lastBridgeResponse,
          createdAgent: null,
        };
      }
    }

    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.install.completed",
      resourceType: "marketplace_app",
      resourceId: app.slug,
      metadata: {
        appSlug: app.slug,
        runtimeFormat,
        targetMode,
        role,
        packId: pack.id,
        installIds: installed.map((entry) => entry.id),
      },
    });
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.app.installed",
      resourceType: "marketplace_app",
      resourceId: app.slug,
      metadata: {
        appSlug: app.slug,
        connectionId: connection?.id ?? null,
        packId: pack.id,
        agentIds: workspaceAgents.map((agent) => agent.id),
        role,
        selectedCapabilities,
        runtimeFormat,
        approvalProfileId: compiled.approvalProfileId,
        dangerousPolicyAcknowledged: isDangerouslySkipPermissionsPolicy(
          compiled.approvalProfileId,
        ),
        targetMode,
      },
    });
    return {
      app,
      pack,
      syncedFiles: [],
      installs: installed,
      runtimeFormat,
      status: "installed",
      message: "Hermes skill installed by bridge.",
      requiredCapability: MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY,
      bridgeRequest: lastBridgeRequest,
      bridgeResponse: lastBridgeResponse,
      createdAgent: null,
    };
  }

  async updateInstall(
    workspaceId: string,
    userId: string,
    installId: string,
    dto: UpdateMarketplaceInstallDto,
  ) {
    const install = await this.marketplaceInstallRepo.findOne({
      where: { id: installId, workspaceId },
    });
    if (!install) throw new NotFoundException("Marketplace install not found");
    const app = await this.resolveMarketplaceApp(workspaceId, install.appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    const connection = install.connectionId
      ? await this.getConnectionEntity(workspaceId, install.connectionId)
      : null;
    if (dto.selectedCapabilities !== undefined) {
      install.selectedCapabilities = this.normalizeCapabilities(
        app,
        dto.selectedCapabilities,
      );
    }
    const metadataPatch: Record<string, unknown> = {
      ...(dto.metadata ?? {}),
    };
    if (dto.approvalProfileId !== undefined) {
      const approvalProfileId = this.resolveApprovalProfileId(
        app,
        dto.approvalProfileId,
        dto.acknowledgeDangerouslySkipPermissions,
      );
      metadataPatch.approvalProfileId = approvalProfileId;
      Object.assign(
        metadataPatch,
        this.dangerousPolicyAcknowledgementMetadata(approvalProfileId, userId),
      );
    }
    if (dto.outlookSenderEmail !== undefined) {
      if (install.appSlug !== "outlook") {
        throw new BadRequestException(
          "Sender identities are only supported for Outlook installs",
        );
      }
      Object.assign(
        metadataPatch,
        this.buildMarketplaceInstallMetadata(
          install.appSlug,
          connection,
          dto.outlookSenderEmail,
        ),
      );
    }
    install.metadata = {
      ...(install.metadata ?? {}),
      ...metadataPatch,
    };
    const saved = await this.marketplaceInstallRepo.save(install);
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      workspaceId,
      eventType: "marketplace.install.updated",
      resourceType: "marketplace_install",
      resourceId: saved.id,
      metadata: {
        appSlug: saved.appSlug,
        connectionId: saved.connectionId,
        selectedCapabilities: saved.selectedCapabilities,
        approvalProfileId: saved.metadata?.approvalProfileId ?? null,
        dangerousPolicyAcknowledged: isDangerouslySkipPermissionsPolicy(
          saved.metadata?.approvalProfileId,
        ),
        outlookSenderIdentity: saved.metadata?.outlookSenderIdentity ?? null,
      },
    });
    return saved;
  }

  private async markHermesDefaultSkillInstalled(input: {
    agent: AgentEntity;
    skillName: string;
    appSlug: string;
    role: MarketplaceInstallRole;
    marketplaceInstallId: string;
    targetRoot: string;
  }) {
    const skillName = input.skillName.trim();
    if (!skillName) return;

    const binding = await this.runtimeBindingService.findByAgentId(
      input.agent.id,
    );
    if (!binding || binding.runtimeType?.trim().toLowerCase() !== "hermes") {
      return;
    }

    const existingDefaultSkills = Array.isArray(
      binding.configMetadata?.defaultSkills,
    )
      ? binding.configMetadata.defaultSkills
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
    const defaultSkills = Array.from(
      new Set([...existingDefaultSkills, skillName]),
    );
    const existingInstalledSkills =
      binding.configMetadata?.installedMarketplaceSkills &&
      typeof binding.configMetadata.installedMarketplaceSkills === "object" &&
      !Array.isArray(binding.configMetadata.installedMarketplaceSkills)
        ? (binding.configMetadata.installedMarketplaceSkills as Record<
            string,
            unknown
          >)
        : {};

    await this.runtimeBindingService.upsertByAgentId(input.agent.id, {
      workspaceId: binding.workspaceId,
      runtimeType: binding.runtimeType,
      adapterKind: binding.adapterKind,
      routingMode: binding.routingMode,
      workspaceRoot: binding.workspaceRoot,
      repoKey: binding.repoKey,
      isEnabled: binding.isEnabled,
      healthStatus: binding.healthStatus,
      capabilities: binding.capabilities,
      configMetadata: {
        ...(binding.configMetadata ?? {}),
        defaultSkills,
        installedMarketplaceSkills: {
          ...existingInstalledSkills,
          [`${input.appSlug}:${input.role}`]: {
            appSlug: input.appSlug,
            role: input.role,
            skillName,
            targetRoot: input.targetRoot,
            marketplaceInstallId: input.marketplaceInstallId,
            installedAt: new Date().toISOString(),
          },
        },
      },
    });
  }

  private buildConnectionMetadata(
    app: MarketplaceAppDefinition,
    input: Record<string, unknown> | undefined,
  ): LocalAppRuntimeConnectionMetadata {
    if (app.sourceType !== "local_repo") {
      return this.sanitizeConnectionMetadata(input);
    }
    const source = app.sourceMetadata ?? {};
    const metadata = this.sanitizeConnectionMetadata({
      ...source,
      ...(input ?? {}),
      appSlug: app.slug,
    });
    return {
      ...metadata,
      localRepoPath:
        metadata.localRepoPath ?? this.stringOrNull(source.repoPath),
      localAppUrl:
        metadata.localAppUrl ?? this.stringOrNull(source.localAppUrl),
      localApiUrl:
        metadata.localApiUrl ?? this.stringOrNull(source.localApiUrl),
      sourceHostType:
        metadata.sourceHostType ?? this.stringOrNull(source.sourceHostType),
      sourceHostId:
        metadata.sourceHostId ?? this.stringOrNull(source.sourceHostId),
      bridgeDeviceId:
        metadata.bridgeDeviceId ?? this.stringOrNull(source.bridgeDeviceId),
      runtimeBindingId:
        metadata.runtimeBindingId ?? this.stringOrNull(source.runtimeBindingId),
      sourceHostLabel:
        metadata.sourceHostLabel ?? this.stringOrNull(source.sourceHostLabel),
      runtimeType:
        metadata.runtimeType ?? this.stringOrNull(source.runtimeType),
      lifecycle:
        metadata.lifecycle ??
        this.sanitizeLocalAppLifecycleMetadata(
          source.lifecycle && typeof source.lifecycle === "object"
            ? (source.lifecycle as Record<string, unknown>)
            : undefined,
        ),
      runtimeProfile: resolveLocalAppRuntimeProfile({
        appSlug: app.slug,
        appName: app.name,
        repoPath: this.stringOrNull(source.repoPath),
        metadata: source,
        connectionMetadata: metadata,
      }),
      autonomyPolicy: normalizeLocalAppAutonomyPolicy(
        metadata.autonomyPolicy ?? source.autonomyPolicy,
      ),
      localappconnectorCampaignId:
        metadata.localappconnectorCampaignId ??
        this.stringOrNull(source.localappconnectorCampaignId),
      localappconnectorCampaignName:
        metadata.localappconnectorCampaignName ??
        this.stringOrNull(source.localappconnectorCampaignName),
      localappconnectorOpenClawBaseUrl:
        metadata.localappconnectorOpenClawBaseUrl ??
        this.stringOrNull(source.localappconnectorOpenClawBaseUrl),
      localappconnectorOpenClawConnectionId:
        metadata.localappconnectorOpenClawConnectionId ??
        this.stringOrNull(source.localappconnectorOpenClawConnectionId),
      localappconnectorOpenClawStatus:
        metadata.localappconnectorOpenClawStatus &&
        typeof metadata.localappconnectorOpenClawStatus === "object"
          ? (metadata.localappconnectorOpenClawStatus as Record<
              string,
              unknown
            >)
          : source.localappconnectorOpenClawStatus &&
              typeof source.localappconnectorOpenClawStatus === "object"
            ? (source.localappconnectorOpenClawStatus as Record<
                string,
                unknown
              >)
            : null,
      localappconnectorPolicySync:
        metadata.localappconnectorPolicySync &&
        typeof metadata.localappconnectorPolicySync === "object"
          ? (metadata.localappconnectorPolicySync as Record<string, unknown>)
          : null,
    };
  }

  private withNativeApiKeyMetadata(
    app: MarketplaceAppDefinition,
    metadata: LocalAppRuntimeConnectionMetadata,
    selectedCapabilities: string[],
  ): LocalAppRuntimeConnectionMetadata {
    if (app.slug === "mem") {
      return {
        ...metadata,
        appSlug: app.slug,
        provider: "mem",
        connectorStandardVersion: "v1",
        authType: "api_key",
        accountLabel: metadata.accountLabel ?? "Mem API key",
        keyStatus: metadata.keyStatus ?? "stored",
        lastHealthCheck: metadata.lastHealthCheck ?? null,
        enabledCapabilities: selectedCapabilities,
      } as LocalAppRuntimeConnectionMetadata;
    }
    if (app.slug === "nimbus-note") {
      return {
        ...metadata,
        appSlug: app.slug,
        provider: "fusebase",
        connectorStandardVersion: "v1",
        authType: "mcp",
        accountLabel: metadata.accountLabel ?? "FuseBase MCP",
        keyStatus: metadata.keyStatus ?? "stored",
        lastHealthCheck: metadata.lastHealthCheck ?? null,
        enabledCapabilities: selectedCapabilities,
      } as LocalAppRuntimeConnectionMetadata;
    }
    if (app.slug === "sinch-mailjet")
      return {
        ...metadata,
        appSlug: app.slug,
        provider: "sinch-mailjet",
        connectorStandardVersion: "v1",
        authType: "api_key",
        accountLabel: metadata.accountLabel ?? "Mailjet account",
        keyStatus: metadata.keyStatus ?? "stored",
        lastHealthCheck: metadata.lastHealthCheck ?? null,
        enabledCapabilities: selectedCapabilities,
      } as LocalAppRuntimeConnectionMetadata;
    if (app.slug === "brevo")
      return {
        ...metadata,
        appSlug: app.slug,
        provider: "brevo",
        connectorStandardVersion: "v1",
        authType: "api_key",
        accountLabel: metadata.accountLabel ?? "Brevo account",
        keyStatus: metadata.keyStatus ?? "stored",
        lastHealthCheck: metadata.lastHealthCheck ?? null,
        enabledCapabilities: selectedCapabilities,
      } as LocalAppRuntimeConnectionMetadata;
    if (app.slug === "sparkpost") {
      return {
        ...metadata,
        appSlug: app.slug,
        provider: "sparkpost",
        connectorStandardVersion: "v1",
        authType: "api_key",
        accountLabel: metadata.accountLabel ?? "SparkPost account",
        keyStatus: metadata.keyStatus ?? "stored",
        lastHealthCheck: metadata.lastHealthCheck ?? null,
        enabledCapabilities: selectedCapabilities,
      } as LocalAppRuntimeConnectionMetadata;
    }
    if (app.slug === "resend") {
      return {
        ...metadata,
        appSlug: app.slug,
        provider: "resend",
        connectorStandardVersion: "v1",
        authType: "api_key",
        accountLabel: metadata.accountLabel ?? "Resend account",
        keyStatus: metadata.keyStatus ?? "stored",
        lastHealthCheck: metadata.lastHealthCheck ?? null,
        enabledCapabilities: selectedCapabilities,
      } as LocalAppRuntimeConnectionMetadata;
    }
    if (app.slug === "postmark") {
      return {
        ...metadata,
        appSlug: app.slug,
        provider: "postmark",
        connectorStandardVersion: "v1",
        authType: "api_key",
        accountLabel: metadata.accountLabel ?? "Postmark server",
        keyStatus: metadata.keyStatus ?? "stored",
        lastHealthCheck: metadata.lastHealthCheck ?? null,
        enabledCapabilities: selectedCapabilities,
      } as LocalAppRuntimeConnectionMetadata;
    }
    if (app.slug === "sendgrid") {
      return {
        ...metadata,
        appSlug: app.slug,
        provider: "sendgrid",
        connectorStandardVersion: "v1",
        authType: "api_key",
        accountLabel: metadata.accountLabel ?? "SendGrid account",
        keyStatus: metadata.keyStatus ?? "stored",
        lastHealthCheck: metadata.lastHealthCheck ?? null,
        enabledCapabilities: selectedCapabilities,
      } as LocalAppRuntimeConnectionMetadata;
    }
    if (app.slug === "mailgun") {
      return {
        ...metadata,
        appSlug: app.slug,
        provider: "mailgun",
        connectorStandardVersion: "v1",
        authType: "api_key",
        accountLabel: metadata.accountLabel ?? "Mailgun domain",
        keyStatus: metadata.keyStatus ?? "stored",
        lastHealthCheck: metadata.lastHealthCheck ?? null,
        enabledCapabilities: selectedCapabilities,
      } as LocalAppRuntimeConnectionMetadata;
    }
    if (app.slug === "dataforseo") {
      return {
        ...metadata,
        appSlug: app.slug,
        provider: "dataforseo",
        connectorStandardVersion: "v1",
        authType: "api_key",
        accountLabel: metadata.accountLabel ?? "DataForSEO Basic Auth",
        keyStatus: metadata.keyStatus ?? "stored",
        baseUrl:
          metadata.baseUrl ??
          metadata.DATAFORSEO_BASE_URL ??
          "https://api.dataforseo.com",
        lastHealthCheck: metadata.lastHealthCheck ?? null,
        enabledCapabilities: selectedCapabilities,
        usage: metadata.usage ?? {
          limits: {
            serpDepth: 50,
            backlinkLimit: 50,
            backlinkVerifyLimit: 20,
          },
        },
      } as LocalAppRuntimeConnectionMetadata;
    }
    if (app.slug !== "exa-search") return metadata;
    return {
      ...metadata,
      appSlug: app.slug,
      provider: "exa-search",
      connectorStandardVersion: "v1",
      authType: "api_key",
      accountLabel: metadata.accountLabel ?? "Exa API key",
      keyStatus: metadata.keyStatus ?? "stored",
      lastHealthCheck: metadata.lastHealthCheck ?? null,
      enabledCapabilities: selectedCapabilities,
      usage: metadata.usage ?? {
        limits: {
          searchQps: 10,
          contentsQps: 100,
          answerQps: 10,
        },
      },
    } as LocalAppRuntimeConnectionMetadata;
  }

  private sanitizeConnectionMetadata(
    input?: Record<string, unknown>,
  ): LocalAppRuntimeConnectionMetadata {
    const lifecycle = this.sanitizeLocalAppLifecycleMetadata(
      input?.lifecycle && typeof input.lifecycle === "object"
        ? (input.lifecycle as Record<string, unknown>)
        : undefined,
    );
    return {
      sourceHostType: this.stringOrNull(input?.sourceHostType),
      sourceHostId: this.stringOrNull(input?.sourceHostId),
      bridgeDeviceId: this.stringOrNull(input?.bridgeDeviceId),
      runtimeBindingId: this.stringOrNull(input?.runtimeBindingId),
      sourceHostLabel: this.stringOrNull(input?.sourceHostLabel),
      runtimeType: this.stringOrNull(input?.runtimeType),
      localRepoPath:
        this.stringOrNull(input?.localRepoPath) ??
        this.stringOrNull(input?.repoPath),
      appSlug: this.stringOrNull(input?.appSlug),
      localAppUrl: this.stringOrNull(input?.localAppUrl),
      localApiUrl: this.stringOrNull(input?.localApiUrl),
      convexSiteUrl: this.stringOrNull(input?.convexSiteUrl),
      allowRuntimeHostStart: input?.allowRuntimeHostStart === true,
      lifecycleApprovalPolicy:
        this.stringOrNull(input?.lifecycleApprovalPolicy) ??
        this.stringOrNull(input?.approvalPolicy),
      lifecycle,
      runtimeProfile: resolveLocalAppRuntimeProfile({
        appSlug: this.stringOrNull(input?.appSlug),
        repoPath:
          this.stringOrNull(input?.localRepoPath) ??
          this.stringOrNull(input?.repoPath),
        metadata: input,
      }),
      autonomyPolicy: normalizeLocalAppAutonomyPolicy(input?.autonomyPolicy),
      localappconnectorCampaignId: this.stringOrNull(
        input?.localappconnectorCampaignId,
      ),
      localappconnectorCampaignName: this.stringOrNull(
        input?.localappconnectorCampaignName,
      ),
      localappconnectorOpenClawBaseUrl: this.stringOrNull(
        input?.localappconnectorOpenClawBaseUrl,
      ),
      localappconnectorOpenClawConnectionId: this.stringOrNull(
        input?.localappconnectorOpenClawConnectionId,
      ),
      localappconnectorOpenClawStatus:
        input?.localappconnectorOpenClawStatus &&
        typeof input.localappconnectorOpenClawStatus === "object"
          ? (input.localappconnectorOpenClawStatus as Record<string, unknown>)
          : null,
      localappconnectorPolicySync:
        input?.localappconnectorPolicySync &&
        typeof input.localappconnectorPolicySync === "object"
          ? (input.localappconnectorPolicySync as Record<string, unknown>)
          : null,
    };
  }

  private extractLifecycleMetadataFromClawchatConfig(
    config?: Record<string, unknown>,
  ) {
    if (!config) return null;
    const runtime =
      this.objectOrNull(config.localRuntime) ??
      this.objectOrNull(config.runtime) ??
      this.objectOrNull(config.appRuntime) ??
      {};
    const commands =
      this.objectOrNull(config.commands) ??
      this.objectOrNull(runtime.commands) ??
      {};
    return this.sanitizeLocalAppLifecycleMetadata({
      checkCommand:
        this.stringOrNull(runtime.checkCommand) ??
        this.stringOrNull(commands.check) ??
        this.stringOrNull(commands.status),
      startCommand:
        this.stringOrNull(runtime.startCommand) ??
        this.stringOrNull(commands.start) ??
        this.stringOrNull(commands.dev),
      stopCommand:
        this.stringOrNull(runtime.stopCommand) ??
        this.stringOrNull(commands.stop),
      restartCommand:
        this.stringOrNull(runtime.restartCommand) ??
        this.stringOrNull(commands.restart),
      checkCommandRef:
        this.stringOrNull(runtime.checkCommandRef) ??
        this.stringOrNull(runtime.checkRef),
      startCommandRef:
        this.stringOrNull(runtime.startCommandRef) ??
        this.stringOrNull(runtime.startRef),
      restartCommandRef:
        this.stringOrNull(runtime.restartCommandRef) ??
        this.stringOrNull(runtime.restartRef),
      allowRuntimeHostStart:
        runtime.allowStart === true ||
        runtime.allowRuntimeHostStart === true ||
        config.allowRuntimeHostStart === true,
      approvalPolicy:
        this.stringOrNull(runtime.approvalPolicy) ??
        this.stringOrNull(config.lifecycleApprovalPolicy),
      requiresApprovalToStart:
        runtime.requiresApprovalToStart ?? config.requiresApprovalToStart,
    });
  }

  private sanitizeLocalAppLifecycleMetadata(
    input?: Record<string, unknown> | null,
  ) {
    if (!input) return {};
    const lifecycle: Record<string, unknown> = {};
    const stringFields = [
      "checkCommand",
      "startCommand",
      "stopCommand",
      "restartCommand",
      "checkCommandRef",
      "startCommandRef",
      "stopCommandRef",
      "restartCommandRef",
      "statusUrl",
      "healthUrl",
      "approvalPolicy",
    ];
    for (const field of stringFields) {
      const value = this.stringOrNull(input[field]);
      if (value) lifecycle[field] = value;
    }
    if (input.allowRuntimeHostStart === true || input.allowStart === true) {
      lifecycle.allowRuntimeHostStart = true;
    }
    if (input.requiresApprovalToStart !== undefined) {
      lifecycle.requiresApprovalToStart =
        input.requiresApprovalToStart !== false;
    }
    return lifecycle;
  }

  private stringOrNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private objectOrNull(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private async ensureLinkedMarketplaceApplication(
    workspaceId: string,
    userId: string,
    app: MarketplaceAppDefinition,
  ) {
    if (app.sourceType === "local_repo") {
      return this.getLocalLinkedApplication(workspaceId, app.slug);
    }
    const slug = `marketplace-${app.slug}`;
    const existing = await this.linkedApplicationRepo.findOne({
      where: { workspaceId, slug },
    });
    if (existing) return existing;
    return this.linkedApplicationRepo.save(
      this.linkedApplicationRepo.create({
        workspaceId,
        createdByUserId: userId,
        name: app.name,
        slug,
        repoPath: `marketplace://${app.slug}`,
        repoKey: null,
        generatedDocsPath: AGENT_DOCS_PACK_PATH,
        currentGitCommit: `marketplace:${app.slug}`,
        dirtyState: false,
        frameworkMetadata: { sourceType: "external_provider" },
        apiStyleMetadata: {
          sourceType: "external_provider",
          providerDocsUrl: app.providerDocsUrl,
        },
        agentOperableStatus: "marketplace_ready",
        documentationPackStatus: "generated",
        metadata: {
          sourceType: "external_provider",
          marketplaceSlug: app.slug,
        },
      }),
    );
  }

  private async createPack(
    workspaceId: string,
    linkedApp: LinkedApplicationEntity,
    app: MarketplaceAppDefinition,
    files: PackFile[],
    metadata: Record<string, unknown>,
  ) {
    const manifest = files.map((file) => ({
      path: file.relativePath,
      hash: sha256(file.content),
      classification: file.classification,
      refreshPolicy: file.refreshPolicy,
    }));
    return this.packRepo.save(
      this.packRepo.create({
        workspaceId,
        linkedApplicationId: linkedApp.id,
        packPath: AGENT_DOCS_PACK_PATH,
        blueprintVersionSet: [
          { systemKey: "marketplace-operating-pack", version: "1.0.0" },
        ],
        compilerVersion: `${AGENT_DOCS_COMPILER_VERSION}+marketplace`,
        repoCommit: `marketplace:${app.slug}`,
        repoDirtyState: false,
        packHash: sha256(JSON.stringify(manifest)),
        generatedFileManifest: manifest,
        reviewStatus: "applied",
        syncStatus: "not_synced",
        metadata: {
          ...metadata,
          sourceType: app.sourceType,
          marketplaceSlug: app.slug,
          linkedApplicationId: linkedApp.id,
          roleManifest: app.roleManifest ?? roleManifestForApp(app),
          marketplaceFiles: files.map((file) => ({
            path: file.relativePath,
            content: file.content,
          })),
        },
      }),
    );
  }

  private async recordApplicationDocumentationVersion(input: {
    workspaceId: string;
    appSlug: string;
    linkedApplicationId: string | null;
    generatedPack: MarketplaceGeneratedPackEntity;
    userId: string | null;
    trigger: string;
    status: string;
  }) {
    const latest = await this.appDocVersionRepo.findOne({
      where: { workspaceId: input.workspaceId, appSlug: input.appSlug },
      order: { version: "DESC" },
    });
    const metadata = input.generatedPack.metadata ?? {};
    const localRepoDiscovery =
      metadata.localRepoDiscovery &&
      typeof metadata.localRepoDiscovery === "object"
        ? (metadata.localRepoDiscovery as Record<string, unknown>)
        : {};
    const sourceFiles = Array.isArray(localRepoDiscovery.files)
      ? (localRepoDiscovery.files as Array<Record<string, unknown>>)
      : [];
    const generatedPack = this.readGeneratedPack(input.generatedPack);
    const canonicalSources =
      generatedPack?.canonicalSources &&
      typeof generatedPack.canonicalSources === "object"
        ? generatedPack.canonicalSources
        : {};
    const generatedFiles = Object.entries(canonicalSources).map(
      ([path, content]) => ({
        path,
        hash: sha256(String(content)),
      }),
    );
    const sourceHash =
      typeof localRepoDiscovery.sourceHash === "string"
        ? localRepoDiscovery.sourceHash
        : null;
    const packHash = sha256(
      JSON.stringify(input.generatedPack.generatedPack ?? {}),
    );
    if (
      latest &&
      sourceHash &&
      latest.sourceHash === sourceHash &&
      this.documentationFileFingerprint(latest.generatedFiles) ===
        this.documentationFileFingerprint(generatedFiles)
    ) {
      return latest;
    }
    return this.appDocVersionRepo.save(
      this.appDocVersionRepo.create({
        workspaceId: input.workspaceId,
        appSlug: input.appSlug,
        linkedApplicationId: input.linkedApplicationId,
        generatedPackId: input.generatedPack.id,
        version: (latest?.version ?? 0) + 1,
        sourceHash,
        packHash,
        sourceFiles,
        generatedFiles,
        sourceDiff:
          metadata.sourceDiff && typeof metadata.sourceDiff === "object"
            ? (metadata.sourceDiff as Record<string, unknown>)
            : {},
        status: input.status,
        trigger: input.trigger,
        createdByUserId: input.userId,
        metadata: {
          generatedAt:
            input.generatedPack.generatedAt?.toISOString?.() ??
            input.generatedPack.generatedAt,
          publicationStatus: input.generatedPack.publicationStatus,
          reviewStatus: input.generatedPack.reviewStatus,
          qualityLevel: input.generatedPack.qualityLevel,
          docsSourcePath:
            typeof localRepoDiscovery.docsSourcePath === "string"
              ? localRepoDiscovery.docsSourcePath
              : null,
        },
      }),
    );
  }

  private documentationFileFingerprint(
    files: Array<Record<string, unknown>> | null | undefined,
  ) {
    const normalized = (Array.isArray(files) ? files : [])
      .map((file) => ({
        path: typeof file.path === "string" ? file.path : "",
        hash: typeof file.hash === "string" ? file.hash : "",
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
    return sha256(JSON.stringify(normalized));
  }

  private localRepoAnalysisFingerprint(
    files: Array<{ relativePath: string; hash: string }> | null | undefined,
  ) {
    const normalized = (Array.isArray(files) ? files : [])
      .map((file) => ({
        path: file.relativePath,
        hash: file.hash,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
    return sha256(JSON.stringify(normalized));
  }

  private async recordAgentDocumentationVersionsForInstalls(
    workspaceId: string,
    appSlug: string,
    installs: MarketplaceInstallEntity[],
    applicationDocumentationVersionId: string | null,
    userId: string | null,
    trigger: string,
  ) {
    for (const install of installs) {
      const agentInstall = install.agentDocumentationInstallId
        ? await this.agentDocumentationInstallRepo.findOne({
            where: {
              id: install.agentDocumentationInstallId,
              workspaceId,
            },
          })
        : null;
      const workspaceFileManifest = agentInstall?.workspaceFileManifest ?? [];
      const latest = await this.agentDocVersionRepo.findOne({
        where: {
          workspaceId,
          appSlug,
          agentId: install.agentId,
          role: install.role,
        },
        order: { version: "DESC" },
      });
      const fileChanges = this.diffWorkspaceFileManifest(
        latest?.workspaceFileManifest ?? [],
        workspaceFileManifest,
      );
      if (
        latest &&
        this.countManifestChanges(fileChanges) === 0 &&
        latest.applicationDocumentationVersionId ===
          applicationDocumentationVersionId
      ) {
        install.metadata = {
          ...install.metadata,
          currentAgentDocumentationVersionId: latest.id,
          currentAgentDocumentationVersion: latest.version,
          currentApplicationDocumentationVersionId:
            applicationDocumentationVersionId,
          lastAgentDocumentationCheck: {
            checkedAt: new Date().toISOString(),
            status: "checked_unchanged",
            trigger,
          },
        };
        await this.marketplaceInstallRepo.save(install);
        continue;
      }
      const saved = await this.agentDocVersionRepo.save(
        this.agentDocVersionRepo.create({
          workspaceId,
          appSlug,
          agentId: install.agentId,
          role: install.role,
          marketplaceInstallId: install.id,
          agentDocumentationInstallId:
            install.agentDocumentationInstallId ?? null,
          applicationDocumentationVersionId,
          packId: install.packId,
          version: (latest?.version ?? 0) + 1,
          status: install.installStatus,
          workspaceFileManifest,
          fileChanges,
          trigger,
          installedByUserId: userId,
          installedAt: install.lastInstalledAt ?? new Date(),
          metadata: {
            driftStatus: install.driftStatus,
            runtimeFormat: install.metadata?.runtimeFormat ?? null,
            selectedCapabilities: install.selectedCapabilities,
          },
        }),
      );
      install.metadata = {
        ...install.metadata,
        currentAgentDocumentationVersionId: saved.id,
        currentAgentDocumentationVersion: saved.version,
        currentApplicationDocumentationVersionId:
          applicationDocumentationVersionId,
      };
      await this.marketplaceInstallRepo.save(install);
    }
  }

  private diffWorkspaceFileManifest(
    previous: Array<Record<string, unknown>>,
    next: Array<Record<string, unknown>>,
  ) {
    const keyFor = (entry: Record<string, unknown>) =>
      String(entry.filename ?? entry.path ?? entry.sourcePath ?? "");
    const previousByKey = new Map<string, Record<string, unknown>>();
    for (const entry of previous) {
      const key = keyFor(entry);
      if (key) previousByKey.set(key, entry);
    }
    const nextByKey = new Map<string, Record<string, unknown>>();
    for (const entry of next) {
      const key = keyFor(entry);
      if (key) nextByKey.set(key, entry);
    }
    const added: string[] = [];
    const changed: string[] = [];
    const removed: string[] = [];
    const unchanged: string[] = [];
    for (const [key, entry] of nextByKey) {
      const old = previousByKey.get(key);
      if (!old) {
        added.push(key);
        continue;
      }
      if (String(old.hash ?? "") === String(entry.hash ?? "")) {
        unchanged.push(key);
      } else {
        changed.push(key);
      }
    }
    for (const key of previousByKey.keys()) {
      if (!nextByKey.has(key)) removed.push(key);
    }
    return { added, changed, removed, unchanged };
  }

  private async resolveDocumentationSyncActorUserId(
    linked: LinkedApplicationEntity,
  ) {
    if (linked.createdByUserId) return linked.createdByUserId;
    const workspace = await this.workspaceRepo.findOne({
      where: { id: linked.workspaceId },
    });
    if (workspace?.ownerId) return workspace.ownerId;
    const member = await this.workspaceMemberRepo.findOne({
      where: [
        { workspaceId: linked.workspaceId, role: WorkspaceMemberRole.OWNER },
        { workspaceId: linked.workspaceId, role: WorkspaceMemberRole.ADMIN },
      ],
      order: { createdAt: "ASC" },
    });
    return member?.userId ?? null;
  }

  private async updateLocalRepoAutoSyncCheckMetadata(
    workspaceId: string,
    linkedApplicationId: string,
    sourceHash: string,
  ) {
    const linked = await this.linkedApplicationRepo.findOne({
      where: { id: linkedApplicationId, workspaceId },
    });
    if (!linked) return;
    linked.metadata = {
      ...linked.metadata,
      lastAutoDocumentationSyncCheckAt: new Date().toISOString(),
      lastAutoDocumentationSyncSeenSourceHash: sourceHash,
    };
    await this.linkedApplicationRepo.save(linked);
  }

  private async buildOpenClawPackFiles(
    workspaceId: string,
    app: MarketplaceAppDefinition,
    selectedCapabilities: string[],
    approvalProfileId: string | undefined,
    connection: MarketplaceConnectionEntity | null,
    libraryTargetFolder: string,
  ): Promise<PackFile[]> {
    if (app.slug === "github") {
      return compileGithubOpenClawPack({
        app,
        selectedCapabilities,
        approvalProfileId,
        connection: connection
          ? {
              displayName: connection.displayName,
              environment: connection.environment,
              authType: connection.authType,
            }
          : null,
        libraryTargetFolder,
      }).files;
    }
    if (app.slug === "stripe") {
      return compileStripeOpenClawPack({
        app,
        selectedCapabilities,
        approvalProfileId,
        connection: connection
          ? {
              displayName: connection.displayName,
              environment: connection.environment,
              authType: connection.authType,
            }
          : null,
        libraryTargetFolder,
      }).files;
    }
    if (hasCanonicalPack(app)) {
      return compileCanonicalOpenClawPack({
        app,
        selectedCapabilities,
        approvalProfileId,
        connection: connection
          ? {
              displayName: connection.displayName,
              environment: connection.environment,
              authType: connection.authType,
            }
          : null,
        libraryTargetFolder,
      }).files;
    }
    const pack = await this.getPersistedGeneratedPackForCompile(
      workspaceId,
      app,
    );
    return compileGeneratedMarketplacePack({
      app,
      pack,
      runtimeFormat: "openclaw",
      selectedCapabilities,
      approvalProfileId,
      connection: connection
        ? {
            displayName: connection.displayName,
            environment: connection.environment,
            authType: connection.authType,
          }
        : null,
      libraryTargetFolder,
    }).files;
  }

  private buildHermesSkillInstallBridgeRequest(input: {
    workspaceId: string;
    agent: AgentEntity;
    app: MarketplaceAppDefinition;
    marketplaceInstallId: string;
    approvalProfileId: string;
    selectedCapabilities: string[];
    connection: MarketplaceConnectionEntity | null;
    files: PackFile[];
    role: MarketplaceInstallRole;
  }): Omit<MarketplaceHermesSkillInstallRequestPayload, "requestId"> {
    const sourceSkillName =
      input.role === "auditor"
        ? `${input.app.slug}-auditor-router`
        : input.role === "manager"
          ? `${input.app.slug}-manager-router`
          : `${input.app.slug}-router`;
    const skillName =
      input.role === "auditor"
        ? `${input.app.slug}-auditor-router`
        : input.role === "manager"
          ? `${input.app.slug}-manager-router`
          : `${input.app.slug}-router`;
    const targetRoot = `skills/${skillName}`;
    const sourceRoot = `skills/${sourceSkillName}`;
    return {
      type: "marketplace.installHermesSkill",
      workspaceId: input.workspaceId,
      agentId: input.agent.externalId?.trim() || input.agent.id,
      appSlug: input.app.slug,
      marketplaceInstallId: input.marketplaceInstallId,
      runtimeFormat: "hermes",
      skillName,
      targetRoot,
      approvalProfileId: input.approvalProfileId,
      selectedCapabilities: input.selectedCapabilities,
      connection: {
        id: input.connection?.id ?? null,
        displayName: input.connection?.displayName ?? null,
        environment: input.connection?.environment ?? null,
        authType: input.connection?.authType ?? null,
      },
      files: input.files
        .filter((file) => file.relativePath.startsWith(`${sourceRoot}/`))
        .map((file) => {
          const sourcePrefix = `${sourceRoot}/`;
          const relativePath = file.relativePath.slice(sourcePrefix.length);
          const content =
            relativePath === "SKILL.md"
              ? file.content.replace(/^name:\s*.+$/m, `name: ${skillName}`)
              : file.content;
          return {
            relativePath,
            content,
            sha256: sha256(content),
          };
        }),
      policy: {
        overwrite: "managed_files_only",
        removeStaleManagedFiles: false,
      },
      metadata: {
        generatedBy: "clawchat-marketplace",
        packVersion: "1.0.0",
        canonicalPackSlug: input.app.slug,
        generatedAt: new Date().toISOString(),
        autonomyPolicy: normalizeLocalAppAutonomyPolicy(
          input.app.sourceMetadata?.autonomyPolicy,
        ),
      },
    };
  }

  private hasRuntimeCapability(
    agent: AgentEntity & {
      runtimeBinding?: { capabilities?: Record<string, unknown> | null } | null;
    },
    capability: string,
  ) {
    const bindingCapabilities = agent.runtimeBinding?.capabilities ?? {};
    const agentCapabilities = Array.isArray(
      (agent as AgentEntity & { capabilities?: unknown }).capabilities,
    )
      ? ((agent as AgentEntity & { capabilities?: string[] }).capabilities ??
        [])
      : [];
    return (
      bindingCapabilities[capability] === true ||
      agentCapabilities.includes(capability)
    );
  }

  private sanitizeBridgeResponseForMetadata(
    response: MarketplaceHermesSkillInstallResponsePayload,
  ) {
    return {
      requestId: response.requestId,
      status: response.status,
      agentId: response.agentId,
      appSlug: response.appSlug,
      installedFiles: response.installedFiles,
      skippedFiles: response.skippedFiles ?? [],
      bridgeCapabilities: response.bridgeCapabilities ?? [],
      error: response.error ?? null,
    };
  }

  private async ensureGeneratedPackRecords(workspaceId: string) {
    const generatedApps = MARKETPLACE_CATALOG.filter(
      (app) => !hasCanonicalPack(app),
    );
    await Promise.all(
      generatedApps.map((app) =>
        this.ensureGeneratedPackRecord(workspaceId, app),
      ),
    );
  }

  private async ensureGeneratedPackRecord(
    workspaceId: string,
    app: MarketplaceAppDefinition,
  ) {
    const scopedWorkspaceId =
      app.sourceType === "external_provider" ? null : workspaceId;
    const existing = await this.generatedPackRepo.findOne({
      where: {
        workspaceId: scopedWorkspaceId === null ? IsNull() : scopedWorkspaceId,
        appSlug: app.slug,
      },
    });
    if (existing) return existing;
    const generated = generateDraftPackForApp(app);
    return this.upsertGeneratedPack(workspaceId, app, generated);
  }

  private async upsertGeneratedPack(
    workspaceId: string,
    app: MarketplaceAppDefinition,
    generated: MarketplaceGeneratedPack,
    metadata: Record<string, unknown> = {},
  ) {
    const scopedWorkspaceId =
      app.sourceType === "external_provider" ? null : workspaceId;
    const existing = await this.generatedPackRepo.findOne({
      where: {
        workspaceId: scopedWorkspaceId === null ? IsNull() : scopedWorkspaceId,
        appSlug: app.slug,
      },
    });
    const pack =
      existing ??
      this.generatedPackRepo.create({
        workspaceId: scopedWorkspaceId,
        appSlug: app.slug,
      });
    pack.name = app.name;
    pack.category = app.category;
    pack.riskLevel = app.riskLevel;
    pack.qualityLevel = generated.qualityLevel as "generated_draft";
    pack.publicationStatus = generated.publicationStatus as "review_needed";
    pack.reviewStatus = generated.quality.reviewStatus;
    pack.confidence = generated.quality.confidence;
    pack.qualityScore = generated.quality.score;
    pack.missingSections = generated.quality.missingSections;
    pack.warnings = generated.quality.warnings;
    pack.officialDocsCoverage = generated.quality.officialDocsCoverage;
    pack.highRiskActionsDetected = generated.quality.highRiskActionsDetected;
    pack.sourceUrls = generated.sourceUrls;
    pack.generatedPack = generated as unknown as Record<string, unknown>;
    pack.generatedAt = new Date(generated.generatedAt);
    pack.metadata = {
      source: "pack_factory",
      reviewRequired: true,
      roleManifest:
        generated.roleManifest ?? app.roleManifest ?? roleManifestForApp(app),
      ...metadata,
    };
    const saved = await this.generatedPackRepo.save(pack);
    if (scopedWorkspaceId !== null) {
      await this.packSourceRepo.delete({ workspaceId, appSlug: app.slug });
    }
    if (scopedWorkspaceId !== null && generated.sources.length) {
      await this.packSourceRepo.save(
        generated.sources.map((source) =>
          this.packSourceRepo.create({
            workspaceId,
            appSlug: app.slug,
            generatedPackId: saved.id,
            kind: source.kind,
            url: source.url ?? null,
            filePath: source.filePath ?? null,
            title: source.title ?? null,
            notes: source.notes ?? null,
            official: source.official,
            metadata: source.ingestion as unknown as Record<string, unknown>,
          }),
        ),
      );
    }
    await this.packQualityScoreRepo.save(
      this.packQualityScoreRepo.create({
        workspaceId,
        appSlug: app.slug,
        generatedPackId: saved.id,
        score: generated.quality.score,
        confidence: generated.quality.confidence,
        missingSections: generated.quality.missingSections,
        warnings: generated.quality.warnings,
        officialDocsCoverage: generated.quality.officialDocsCoverage,
        highRiskActionsDetected: generated.quality.highRiskActionsDetected,
        reviewStatus: generated.quality.reviewStatus,
      }),
    );
    return saved;
  }

  private buildPackConfigFromSourceDto(
    app: MarketplaceAppDefinition,
    dto: UpdateMarketplacePackSourcesDto,
    importedSourceModel?: MarketplaceExtractedSourceModel,
  ): MarketplacePackFactoryConfig {
    const base = buildPackFactoryConfigFromApp(app);
    const docs = {
      ...base.docs,
      ...(dto.docs ?? {}),
    };
    const importDto = dto as ImportMarketplacePackSourcesDto;
    if (importDto.apiDocsUrl) docs.apiOverview = importDto.apiDocsUrl;
    if (importDto.authDocsUrl) docs.auth = importDto.authDocsUrl;
    if (importDto.scopesDocsUrl) docs.scopes = importDto.scopesDocsUrl;
    if (importDto.rateLimitDocsUrl)
      docs.rateLimits = importDto.rateLimitDocsUrl;
    if (importDto.webhookDocsUrl) docs.webhooks = importDto.webhookDocsUrl;
    if (importDto.openApiSpecUrl) docs.openApiSpec = importDto.openApiSpecUrl;
    return {
      ...base,
      docs,
      knownObjects: dto.knownObjects?.length
        ? dto.knownObjects
        : base.knownObjects,
      highRiskActions: dto.highRiskActions?.length
        ? dto.highRiskActions
        : base.highRiskActions,
      commonWorkflows: dto.commonWorkflows?.length
        ? dto.commonWorkflows
        : base.commonWorkflows,
      manuallySuppliedNotes: [
        ...(base.manuallySuppliedNotes ?? []),
        ...(dto.manuallySuppliedNotes ?? []),
        ...(importDto.manualMarkdown ? [importDto.manualMarkdown] : []),
      ],
      importedSourceModel,
    };
  }

  private buildPackConfigFromPersistedMetadata(
    entity: MarketplaceGeneratedPackEntity,
    app: MarketplaceAppDefinition,
  ): MarketplacePackFactoryConfig {
    const metadata = entity.metadata as {
      sourceConfig?: MarketplacePackFactoryConfig;
      importedSourceModel?: MarketplaceExtractedSourceModel;
    };
    if (metadata.sourceConfig) {
      return {
        ...metadata.sourceConfig,
        importedSourceModel:
          metadata.importedSourceModel ??
          metadata.sourceConfig.importedSourceModel,
      };
    }
    const generated = this.readGeneratedPack(entity);
    return {
      ...buildPackFactoryConfigFromApp(app),
      importedSourceModel: generated.extractedSourceModel,
    };
  }

  private async importSourceModelFromDto(
    app: MarketplaceAppDefinition,
    dto: ImportMarketplacePackSourcesDto,
  ) {
    if (dto.openApiSpecUrl && dto.openApiSpecContent) {
      throw new BadRequestException(
        "Supply either openApiSpecUrl or openApiSpecContent, not both.",
      );
    }
    const config = this.buildPackConfigFromSourceDto(app, dto);
    const docs = config.docs ?? {};
    const docSources: MarketplacePackSource[] = [
      docs.apiOverview
        ? {
            kind: "official_api_docs",
            url: docs.apiOverview,
            title: `${app.name} API overview`,
            official: true,
          }
        : null,
      docs.auth
        ? {
            kind: "auth_docs",
            url: docs.auth,
            title: `${app.name} authentication docs`,
            official: true,
          }
        : null,
      docs.scopes
        ? {
            kind: "auth_docs",
            url: docs.scopes,
            title: `${app.name} scopes or permission docs`,
            official: true,
          }
        : null,
      docs.rateLimits
        ? {
            kind: "official_api_docs",
            url: docs.rateLimits,
            title: `${app.name} rate limit docs`,
            official: true,
          }
        : null,
      docs.webhooks
        ? {
            kind: "webhook_docs",
            url: docs.webhooks,
            title: `${app.name} webhook or event docs`,
            official: true,
          }
        : null,
      dto.manualMarkdown
        ? {
            kind: "manual_notes",
            title: `${app.name} manually supplied source notes`,
            notes: dto.manualMarkdown,
            official: false,
          }
        : null,
      ...(dto.manuallySuppliedNotes ?? []).map(
        (notes): MarketplacePackSource => ({
          kind: "manual_notes",
          title: `${app.name} manually supplied note`,
          notes,
          official: false,
        }),
      ),
    ].filter((source): source is MarketplacePackSource => Boolean(source));
    const sourceModel = await importDocsSources(docSources);
    if (dto.openApiSpecUrl || dto.openApiSpecContent || docs.openApiSpec) {
      try {
        const openApiModel = await importOpenApiSource({
          kind: "openapi_spec",
          url: dto.openApiSpecUrl ?? docs.openApiSpec,
          notes: dto.openApiSpecContent,
          title: `${app.name} OpenAPI spec`,
          official: !dto.openApiSpecContent,
        });
        return this.mergeSourceModels(sourceModel, openApiModel);
      } catch (error) {
        return {
          ...sourceModel,
          ingestionErrors: [
            ...sourceModel.ingestionErrors,
            {
              source:
                dto.openApiSpecUrl ??
                (dto.openApiSpecContent ? "Inline OpenAPI content" : null) ??
                docs.openApiSpec ??
                "OpenAPI spec",
              error:
                error instanceof Error
                  ? error.message
                  : "OpenAPI import failed.",
            },
          ],
          warnings: [...sourceModel.warnings, "OpenAPI import failed."],
        };
      }
    }
    return sourceModel;
  }

  private async refreshLocalRepoGeneratedPack(
    workspaceId: string,
    linked: LinkedApplicationEntity,
    userId: string,
    options: { action: string; reviewStatus: string; trigger?: string },
  ) {
    const discovery = await this.discoverLocalRepoSource(linked);
    const app = {
      ...this.localLinkedApplicationToMarketplaceApp(linked),
      roleManifest: discovery.roleManifest,
    };
    const existing = await this.generatedPackRepo.findOne({
      where: { workspaceId, appSlug: app.slug },
    });
    const previousPack = existing ? this.readGeneratedPack(existing) : null;
    const sourceModel = this.sanitizeLocalRepoExtractedSourceModel(
      await this.importLocalRepoSourceModel(app, discovery),
    );
    const sourceNotes = discovery.files
      .filter((file) => file.relativePath.endsWith(".md"))
      .map(
        (file) =>
          `# ${file.relativePath}\n\n${this.sanitizeLocalRepoSourceContent(file.content)}`,
      );
    const config: MarketplacePackFactoryConfig = {
      appSlug: app.slug,
      name: app.name,
      category: app.category,
      riskLevel: app.riskLevel,
      providerUrl: String(app.sourceMetadata?.localAppUrl ?? ""),
      docs: {
        openApiSpec: discovery.openApiSpecPath,
      },
      authTypes: ["local_repo"],
      knownObjects: sourceModel.objects,
      highRiskActions: [
        "write API calls",
        "publishing/deployment",
        "destructive data changes",
        "permission or configuration changes",
      ],
      commonWorkflows: sourceModel.workflowSignals,
      manuallySuppliedNotes: [
        `Local repo path: ${linked.repoPath}`,
        `Docs source path: ${discovery.docsSourcePath}`,
        ...sourceNotes,
      ],
      importedSourceModel: sourceModel,
      existingApp: app,
    };
    const generated = generateDraftPackFromConfig(config);
    generated.canonicalSources = {
      ...generated.canonicalSources,
      ...this.buildLocalRepoCanonicalSources(discovery),
    };
    generated.roleManifest = discovery.roleManifest;
    this.applyLocalRepoQualitySignals(generated, discovery);
    generated.qualityLevel = "generated_draft";
    generated.publicationStatus = "review_needed";
    generated.quality.reviewStatus = "not_reviewed";
    const sourceDiff = this.diffGeneratedCanonicalSources(
      previousPack?.canonicalSources,
      generated.canonicalSources,
    );
    const saved = await this.upsertGeneratedPack(workspaceId, app, generated, {
      source: "local_repo",
      sourceType: "local_repo",
      linkedApplicationId: linked.id,
      sourceConfig: config,
      importedSourceModel: sourceModel,
      localRepoDiscovery: {
        docsSourcePath: discovery.docsSourcePath,
        repoPath: discovery.repoPath ?? linked.repoPath,
        sourceHostType: discovery.sourceHostType ?? null,
        sourceHostId: discovery.sourceHostId ?? null,
        bridgeDeviceId: discovery.bridgeDeviceId ?? null,
        sourceHash: discovery.sourceHash,
        fileCount: discovery.files.length,
        auditorDocsAvailable: discovery.auditorDocsAvailable === true,
        workerFileCount: discovery.workerFileCount ?? 0,
        auditorFileCount: discovery.auditorFileCount ?? 0,
        managerDocsAvailable: discovery.managerDocsAvailable === true,
        managerFileCount: discovery.managerFileCount ?? 0,
        apiFileCount: discovery.apiFileCount ?? 0,
        bridgeReturnedFileCount:
          discovery.bridgeReturnedFileCount ?? discovery.files.length,
        bridgeReturnedWorkerFileCount:
          discovery.bridgeReturnedWorkerFileCount ??
          discovery.workerFileCount ??
          0,
        bridgeReturnedAuditorFileCount:
          discovery.bridgeReturnedAuditorFileCount ??
          discovery.auditorFileCount ??
          0,
        bridgeReturnedManagerFileCount:
          discovery.bridgeReturnedManagerFileCount ??
          discovery.managerFileCount ??
          0,
        bridgeReturnedApiFileCount:
          discovery.bridgeReturnedApiFileCount ?? discovery.apiFileCount ?? 0,
        bridgeReturnedFilePaths: discovery.bridgeReturnedFilePaths ?? null,
        gitCommit: discovery.gitCommit ?? null,
        gitBranch: discovery.gitBranch ?? null,
        dirtyState: discovery.dirtyState ?? null,
        files: discovery.files.map((file) => ({
          relativePath: file.relativePath,
          hash: file.hash,
        })),
        manifest: discovery.manifest ?? null,
        rolesManifest: discovery.rolesManifest ?? null,
        roleManifest: discovery.roleManifest,
        config: discovery.config ?? null,
        warnings: discovery.warnings,
      },
      sourceDiff,
      reviewRequired: true,
      updateMode: "review_first",
    });
    saved.reviewStatus =
      options.reviewStatus as MarketplaceGeneratedPackEntity["reviewStatus"];
    saved.publicationStatus = "review_needed";
    await this.generatedPackRepo.save(saved);
    linked.metadata = {
      ...linked.metadata,
      sourceType: "local_repo",
      marketplaceSlug: app.slug,
      sourceHash: discovery.sourceHash,
      sourceChanged: Boolean(
        sourceDiff.addedPaths.length ||
        sourceDiff.changedPaths.length ||
        sourceDiff.removedPaths.length,
      ),
      lastDiscoveredAt: new Date().toISOString(),
      lastDocumentationSyncTrigger: options.trigger ?? options.action,
      auditorDocsAvailable: discovery.auditorDocsAvailable === true,
      workerFileCount: discovery.workerFileCount ?? 0,
      auditorFileCount: discovery.auditorFileCount ?? 0,
      managerDocsAvailable: discovery.managerDocsAvailable === true,
      managerFileCount: discovery.managerFileCount ?? 0,
      apiFileCount: discovery.apiFileCount ?? 0,
      roleManifest: discovery.roleManifest,
      docsSourcePath: discovery.docsSourcePath,
      sourceHostType:
        discovery.sourceHostType ?? linked.metadata?.sourceHostType,
      sourceHostId:
        discovery.sourceHostId ?? linked.metadata?.sourceHostId ?? null,
      bridgeDeviceId:
        discovery.bridgeDeviceId ?? linked.metadata?.bridgeDeviceId ?? null,
      currentGitCommit: discovery.gitCommit ?? linked.currentGitCommit ?? null,
      gitBranch: discovery.gitBranch ?? linked.metadata?.gitBranch ?? null,
      dirtyState: discovery.dirtyState ?? linked.dirtyState ?? false,
      openApiSpecPath:
        linked.metadata?.openApiSpecPath ?? discovery.openApiSpecPath ?? null,
      lifecycle: this.sanitizeLocalAppLifecycleMetadata({
        ...(this.extractLifecycleMetadataFromClawchatConfig(discovery.config) ??
          {}),
        ...(linked.metadata?.lifecycle &&
        typeof linked.metadata.lifecycle === "object"
          ? (linked.metadata.lifecycle as Record<string, unknown>)
          : {}),
      }),
    };
    if (discovery.gitCommit !== undefined)
      linked.currentGitCommit = discovery.gitCommit;
    if (discovery.dirtyState !== undefined && discovery.dirtyState !== null) {
      linked.dirtyState = discovery.dirtyState;
    }
    linked.documentationPackStatus = "pending_review";
    await this.linkedApplicationRepo.save(linked);
    await this.recordGeneratedPackReview(
      workspaceId,
      app.slug,
      userId,
      options.action,
      "Local repo source ingested into a review-first generated Marketplace pack.",
      {
        sourceType: "local_repo",
        sourceHash: discovery.sourceHash,
        changedPaths: sourceDiff.changedPaths,
        addedPaths: sourceDiff.addedPaths,
        removedPaths: sourceDiff.removedPaths,
      },
    );
    return this.getGeneratedPackDetail(workspaceId, app.slug);
  }

  private buildLocalRepoCanonicalSources(discovery: LocalRepoDiscovery) {
    const sources: Record<string, string> = {};
    const localSourceFiles = new Map(
      discovery.files.map((file) => [file.relativePath, file]),
    );
    const directMappings: Array<[string, string]> = [
      ["agent-docs-source/workflow.md", "workflow.md"],
      ["agent-docs-source/auth.md", "auth.md"],
      ["agent-docs-source/permissions.md", "permissions.md"],
      ["agent-docs-source/safe_actions.md", "safe_actions.md"],
      ["agent-docs-source/api.md", "api/overview.md"],
      ["api/endpoints.md", "api/endpoints.md"],
      ["agent-docs-source/data_model.md", "data_model.md"],
      ["agent-docs-source/jobs_and_workers.md", "jobs_and_workers.md"],
      ["agent-docs-source/local_runtime.md", "local_runtime.md"],
      ["agent-docs-source/troubleshooting.md", "troubleshooting.md"],
    ];

    for (const [sourcePath, canonicalPath] of directMappings) {
      const file = localSourceFiles.get(sourcePath);
      if (!file) continue;
      sources[canonicalPath] = this.renderLocalRepoCanonicalSource(
        file.relativePath,
        file.hash,
        file.content,
      );
    }

    for (const file of discovery.files) {
      if (
        !file.relativePath.startsWith("agent-docs-source/workflows/") ||
        !file.relativePath.endsWith(".md")
      ) {
        continue;
      }
      const workflowPath = file.relativePath.replace(
        /^agent-docs-source\//,
        "",
      );
      sources[workflowPath] = this.renderLocalRepoCanonicalSource(
        file.relativePath,
        file.hash,
        file.content,
      );
    }

    for (const file of discovery.files) {
      if (
        !file.relativePath.startsWith("api/") ||
        !file.relativePath.endsWith(".md") ||
        file.relativePath === "api/endpoints.md"
      ) {
        continue;
      }
      sources[file.relativePath] = this.renderLocalRepoCanonicalSource(
        file.relativePath,
        file.hash,
        file.content,
      );
    }

    for (const file of discovery.files) {
      if (
        !file.relativePath.startsWith("auditor-docs-source/") ||
        !file.relativePath.endsWith(".md")
      ) {
        continue;
      }
      const auditorPath = file.relativePath.replace(
        /^auditor-docs-source\//,
        "",
      );
      sources[`auditor/${auditorPath}`] = this.renderLocalRepoCanonicalSource(
        file.relativePath,
        file.hash,
        file.content,
      );
    }

    for (const file of discovery.files) {
      if (
        !file.relativePath.startsWith("manager-docs-source/") ||
        !file.relativePath.endsWith(".md")
      ) {
        continue;
      }
      const managerPath = file.relativePath.replace(
        /^manager-docs-source\//,
        "",
      );
      sources[`manager/${managerPath}`] = this.renderLocalRepoCanonicalSource(
        file.relativePath,
        file.hash,
        file.content,
      );
    }

    sources["local_repo_source.md"] = [
      "# Local Repo Source Coverage",
      "",
      "This generated Marketplace pack was built from local_repo `.clawchat/` source material.",
      "",
      `- Docs source path: ${discovery.docsSourcePath}`,
      `- Source fingerprint: ${discovery.sourceHash}`,
      `- Source files discovered: ${discovery.files.length}`,
      `- Auditor docs available: ${discovery.auditorDocsAvailable === true ? "yes" : "no"}`,
      `- Auditor source files discovered: ${discovery.auditorFileCount ?? 0}`,
      `- Manager docs available: ${discovery.managerDocsAvailable === true ? "yes" : "no"}`,
      `- Manager source files discovered: ${discovery.managerFileCount ?? 0}`,
      "",
      "## Files",
      "",
      ...discovery.files.map((file) => `- ${file.relativePath} (${file.hash})`),
      "",
      "## Review Policy",
      "",
      "- Treat this pack as review-first until a human reviewer publishes it.",
      "- Prefer repo-supplied `.clawchat/` doctrine over generic generated fallback text.",
      "- Do not expose local environment values, API keys, tokens, private keys, webhook secret values, or credentials.",
    ].join("\n");
    if (discovery.roleManifest) {
      sources["roles_manifest.json"] = JSON.stringify(
        discovery.roleManifest,
        null,
        2,
      );
      sources["roles.md"] = this.renderRolesMarkdown(discovery.roleManifest);
    }

    return sources;
  }

  private renderRolesMarkdown(roleManifest: MarketplaceRoleManifest) {
    return [
      "# Marketplace Roles",
      "",
      ...roleManifest.roles.flatMap((role) => [
        `## ${role.label}`,
        "",
        role.purpose,
        "",
        `- Role id: ${role.role}`,
        `- Source: ${role.source}`,
        `- Docs source path: ${role.docsSourcePath ?? "not declared"}`,
        `- Runtime output path: ${role.runtimeOutputPath ?? "not available"}`,
        `- Installable: ${role.installable ? "yes" : "no"}`,
        ...(role.notInstallableReason
          ? [`- Not installable reason: ${role.notInstallableReason}`]
          : []),
        "",
      ]),
    ].join("\n");
  }

  private renderLocalRepoCanonicalSource(
    relativePath: string,
    hash: string,
    content: string,
  ) {
    return [
      `<!-- Source: local_repo .clawchat/${relativePath}; sha256: ${hash} -->`,
      "",
      this.sanitizeLocalRepoSourceContent(content),
    ].join("\n");
  }

  private sanitizeLocalRepoSourceContent(content: string) {
    return content
      .replace(
        /-----BEGIN [A-Z ]*(?:PRIVATE KEY|SECRET KEY)[\s\S]*?-----END [A-Z ]*(?:PRIVATE KEY|SECRET KEY)-----/g,
        "[REDACTED_PRIVATE_KEY]",
      )
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, "Bearer [REDACTED]")
      .replace(
        /\b(x-[a-z0-9-]*secret[a-z0-9-]*)\s*:\s*([^\n]+)/gi,
        "$1: [REDACTED]",
      )
      .replace(
        /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|DATABASE_URL)[A-Z0-9_]*)\s*[:=]\s*["']?([^"'\n`]+)/g,
        "$1=[REDACTED]",
      )
      .replace(
        /\b(sk|rk|pk)_(live|test|restricted)_[A-Za-z0-9_]+/gi,
        "[REDACTED_API_KEY]",
      );
  }

  private applyLocalRepoQualitySignals(
    generated: MarketplaceGeneratedPack,
    discovery: LocalRepoDiscovery,
  ) {
    if (!discovery.files.length) return;
    generated.extractedSourceModel = generated.extractedSourceModel
      ? this.sanitizeLocalRepoExtractedSourceModel(
          generated.extractedSourceModel,
        )
      : generated.extractedSourceModel;
    generated.canonicalSources = Object.fromEntries(
      Object.entries(generated.canonicalSources).map(([path, content]) => [
        path,
        this.sanitizeLocalRepoSourceContent(content),
      ]),
    );
    generated.sources = discovery.files.map((file) => ({
      kind: file.relativePath.endsWith("openapi.json")
        ? "openapi_spec"
        : file.relativePath.endsWith("app_manifest.json") ||
            file.relativePath.endsWith("roles_manifest.json") ||
            file.relativePath.endsWith("clawchat.config.json")
          ? "local_repo_manifest"
          : "local_repo_docs",
      filePath: file.absolutePath,
      title: `.clawchat/${file.relativePath}`,
      official: false,
      ingestion: {
        status: "imported",
        importedAt: generated.generatedAt,
        contentType: file.relativePath.endsWith(".json")
          ? "application/json"
          : "text/markdown",
        contentLength: file.content.length,
        contentHash: file.hash,
      },
    }));
    generated.sourceUrls = [];
    generated.quality.confidence = "medium";
    generated.quality.warnings = [
      ...new Set([
        ...generated.quality.warnings.filter(
          (warning) => !/source coverage|official|missing/i.test(warning),
        ),
        "Generated from local_repo .clawchat source files. Review before publishing or installing.",
        ...discovery.warnings,
      ]),
    ];
    generated.quality.missingSections =
      generated.quality.missingSections.filter(
        (section) => !/official/i.test(section),
      );
    generated.quality.officialDocsCoverage = {
      ...generated.quality.officialDocsCoverage,
      apiOverview:
        generated.quality.officialDocsCoverage.apiOverview ||
        discovery.files.some((file) =>
          [
            "agent-docs-source/api.md",
            "api/endpoints.md",
            "api/openapi.json",
          ].includes(file.relativePath),
        ),
      auth:
        generated.quality.officialDocsCoverage.auth ||
        discovery.files.some(
          (file) => file.relativePath === "agent-docs-source/auth.md",
        ),
      scopes:
        generated.quality.officialDocsCoverage.scopes ||
        discovery.files.some(
          (file) => file.relativePath === "agent-docs-source/permissions.md",
        ),
    };
  }

  private sanitizeLocalRepoExtractedSourceModel(
    model: MarketplaceExtractedSourceModel,
  ): MarketplaceExtractedSourceModel {
    const sanitize = (value: string) =>
      this.sanitizeLocalRepoSourceContent(value);
    return {
      ...model,
      sourceSummaries: model.sourceSummaries.map((summary) => ({
        ...summary,
        signals: summary.signals.map(sanitize),
      })),
      scopeSignals: model.scopeSignals.map(sanitize),
      rateLimitSignals: model.rateLimitSignals.map(sanitize),
      webhookSignals: model.webhookSignals.map(sanitize),
      workflowSignals: model.workflowSignals.map(sanitize),
      safetySignals: model.safetySignals.map(sanitize),
      exampleSignals: model.exampleSignals.map(sanitize),
      highRiskSignals: model.highRiskSignals.map(sanitize),
      warnings: model.warnings.map(sanitize),
      ingestionErrors: model.ingestionErrors.map((error) => ({
        ...error,
        source: sanitize(error.source),
        error: sanitize(error.error),
      })),
    };
  }

  private async importLocalRepoSourceModel(
    app: MarketplaceAppDefinition,
    discovery: LocalRepoDiscovery,
  ): Promise<MarketplaceExtractedSourceModel> {
    const docsSources: MarketplacePackSource[] = discovery.files.map(
      (file) => ({
        kind: file.relativePath.endsWith("openapi.json")
          ? "openapi_spec"
          : file.relativePath.endsWith("app_manifest.json") ||
              file.relativePath.endsWith("roles_manifest.json") ||
              file.relativePath.endsWith("clawchat.config.json")
            ? "local_repo_manifest"
            : "local_repo_docs",
        filePath: file.absolutePath,
        title: `${app.name} ${file.relativePath}`,
        notes: file.content,
        official: false,
        ingestion: {
          status: "imported",
          importedAt: new Date().toISOString(),
          contentType: file.relativePath.endsWith(".json")
            ? "application/json"
            : "text/markdown",
          contentLength: file.content.length,
          contentHash: file.hash,
        },
      }),
    );
    const docsModel = await importDocsSources(
      docsSources.map((source) => ({
        ...source,
        text: source.notes,
      })),
      {
        maxSources: 64,
        maxInlineSourceBytes: 400_000,
        maxTotalInlineBytes: 2 * 1024 * 1024,
      },
    );
    if (!discovery.openApiSpecPath) return docsModel;
    try {
      const openApiFile = discovery.files.find(
        (file) => file.relativePath === "api/openapi.json",
      );
      if (!openApiFile?.content) {
        throw new Error("Discovered OpenAPI file content is unavailable.");
      }
      const openApiModel = await importOpenApiSource({
        kind: "openapi_spec",
        notes: openApiFile.content,
        title: `${app.name} OpenAPI spec`,
        official: false,
      });
      return this.mergeSourceModels(docsModel, openApiModel);
    } catch (error) {
      return {
        ...docsModel,
        ingestionErrors: [
          ...docsModel.ingestionErrors,
          {
            source: discovery.openApiSpecPath,
            error:
              error instanceof Error ? error.message : "OpenAPI import failed.",
          },
        ],
        warnings: [...docsModel.warnings, "OpenAPI import failed."],
      };
    }
  }

  private async discoverLocalRepoSource(
    linked: LinkedApplicationEntity,
  ): Promise<LocalRepoDiscovery> {
    const metadata = linked.metadata ?? {};
    const sourceHostType = String(
      metadata.sourceHostType ?? linked.apiStyleMetadata?.sourceHostType ?? "",
    );
    if (
      !["openclaw_bridge", "hermes_bridge", "runtime_host"].includes(
        sourceHostType,
      )
    ) {
      throw new BadRequestException(
        "A paired OpenClaw, Hermes, or runtime host is required. Reconfigure this local repository source before continuing.",
      );
    }
    return this.discoverRemoteLocalRepoSource(linked, sourceHostType);
  }

  private async discoverRemoteLocalRepoSource(
    linked: LinkedApplicationEntity,
    sourceHostType: string,
  ): Promise<LocalRepoDiscovery> {
    const metadata = linked.metadata ?? {};
    const docsSourcePath = this.normalizeLocalRepoDocsSourcePath(
      metadata.docsSourcePath,
    );
    const bridgeDeviceId = String(
      metadata.bridgeDeviceId ?? metadata.sourceHostId ?? "",
    ).trim();
    if (!bridgeDeviceId) {
      throw new BadRequestException(
        "Source host not selected. Select a connected OpenClaw/Hermes host before updating this local repo pack.",
      );
    }
    const response = await this.bridgeService.readMarketplaceLocalRepoDocs(
      linked.workspaceId,
      {
        sourceHostId: String(metadata.sourceHostId ?? bridgeDeviceId),
        bridgeDeviceId,
        sourceHostType,
        runtimeType: String(
          metadata.runtimeType ?? linked.apiStyleMetadata?.runtimeType ?? "",
        ),
        repoPath: linked.repoPath,
        docsSourcePath,
        includeGlobs: [
          ".clawchat/app_manifest.json",
          ".clawchat/roles_manifest.json",
          ".clawchat/clawchat.config.json",
          ".clawchat/api/openapi.json",
          ".clawchat/api/endpoints.md",
          ".clawchat/api/*.md",
          ".clawchat/api/**/*.md",
          ".clawchat/agent-docs-source/*.md",
          ".clawchat/agent-docs-source/**/*.md",
          ".clawchat/auditor-docs-source/*.md",
          ".clawchat/auditor-docs-source/**/*.md",
          ".clawchat/manager-docs-source/*.md",
          ".clawchat/manager-docs-source/**/*.md",
        ],
      },
    );
    return this.localRepoDiscoveryFromBridgeResponse(
      linked,
      response,
      sourceHostType,
      bridgeDeviceId,
    );
  }

  private localRepoDiscoveryFromBridgeResponse(
    linked: LinkedApplicationEntity,
    response: MarketplaceReadLocalRepoDocsResponsePayload,
    sourceHostType: string,
    bridgeDeviceId: string,
  ): LocalRepoDiscovery {
    if (response.status !== "ok") {
      throw new BadRequestException(
        response.errors?.[0] ||
          "This repo path is on a runtime host that is not currently reachable. Select a connected OpenClaw/Hermes host or sync the repo to this machine.",
      );
    }
    const docsSourcePath = this.normalizeLocalRepoDocsSourcePath(
      response.docsSourcePath || linked.metadata?.docsSourcePath,
    );
    const docsSourcePrefix = docsSourcePath
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "");
    const bridgeReturnedFiles = (response.files ?? []).map((file) => ({
      ...file,
      relativePath: this.normalizeBridgeLocalRepoSourcePath(
        file.relativePath,
        docsSourcePrefix,
      ),
    }));
    const files = bridgeReturnedFiles
      .filter((file) => this.isAllowedLocalRepoSourcePath(file.relativePath))
      .map((file) => ({
        relativePath: file.relativePath.replace(/\\/g, "/"),
        absolutePath: `${response.repoPath.replace(/\/+$/, "")}/${docsSourcePath.replace(/^\/+|\/+$/g, "")}/${file.relativePath.replace(/^\/+/, "")}`,
        content: file.content,
        hash: file.sha256 || sha256(file.content),
      }));
    if (!files.length) {
      throw new BadRequestException(
        "No .clawchat source files were returned from the selected runtime host. Update Pack did not generate fallback docs.",
      );
    }
    const manifest = this.parseJsonFile(
      files.find((file) => file.relativePath === "app_manifest.json"),
    );
    const rolesManifest = this.parseJsonFile(
      files.find((file) => file.relativePath === "roles_manifest.json"),
    );
    const config = this.parseJsonFile(
      files.find((file) => file.relativePath === "clawchat.config.json"),
    );
    const openApiSpecPath = files.find(
      (file) => file.relativePath === "api/openapi.json",
    )?.absolutePath;
    const endpointsPath = files.find(
      (file) => file.relativePath === "api/endpoints.md",
    )?.absolutePath;
    const auditorFileCount = files.filter((file) =>
      file.relativePath.startsWith("auditor-docs-source/"),
    ).length;
    const managerFileCount = files.filter((file) =>
      file.relativePath.startsWith("manager-docs-source/"),
    ).length;
    const workerFileCount = files.filter((file) =>
      file.relativePath.startsWith("agent-docs-source/"),
    ).length;
    const apiFileCount = files.filter((file) =>
      file.relativePath.startsWith("api/"),
    ).length;
    const bridgeReturnedFilePaths = bridgeReturnedFiles.map(
      (file) => file.relativePath,
    );
    const bridgeReturnedWorkerFileCount = bridgeReturnedFilePaths.filter(
      (relativePath) => relativePath.startsWith("agent-docs-source/"),
    ).length;
    const bridgeReturnedAuditorFileCount = bridgeReturnedFilePaths.filter(
      (relativePath) => relativePath.startsWith("auditor-docs-source/"),
    ).length;
    const bridgeReturnedManagerFileCount = bridgeReturnedFilePaths.filter(
      (relativePath) => relativePath.startsWith("manager-docs-source/"),
    ).length;
    const bridgeReturnedApiFileCount = bridgeReturnedFilePaths.filter(
      (relativePath) => relativePath.startsWith("api/"),
    ).length;
    const sourceHash = sha256(
      JSON.stringify(
        files
          .map((file) => ({ path: file.relativePath, hash: file.hash }))
          .sort((left, right) => left.path.localeCompare(right.path)),
      ),
    );
    return {
      docsSourcePath,
      repoPath: response.repoPath || linked.repoPath,
      sourceHostType,
      sourceHostId: String(linked.metadata?.sourceHostId ?? bridgeDeviceId),
      bridgeDeviceId,
      files,
      sourceHash,
      manifest,
      rolesManifest,
      roleManifest: this.buildLocalRepoRoleManifest(
        linked,
        files,
        manifest,
        rolesManifest,
      ),
      config,
      openApiSpecPath,
      endpointsPath,
      workerFileCount,
      auditorDocsAvailable: auditorFileCount > 0,
      auditorFileCount,
      managerDocsAvailable: managerFileCount > 0,
      managerFileCount,
      apiFileCount,
      bridgeReturnedFileCount: bridgeReturnedFiles.length,
      bridgeReturnedWorkerFileCount,
      bridgeReturnedAuditorFileCount,
      bridgeReturnedManagerFileCount,
      bridgeReturnedApiFileCount,
      bridgeReturnedFilePaths,
      gitCommit: response.gitCommit ?? null,
      gitBranch: response.gitBranch ?? null,
      dirtyState: this.normalizeLocalRepoDirtyState(response.dirtyState),
      dirtyFiles: Array.isArray(response.dirtyFiles)
        ? response.dirtyFiles.map(String)
        : null,
      warnings: [
        ...(response.missingFiles ?? []).map(
          (file) => `Missing local source file: ${file}`,
        ),
        ...(response.errors ?? []),
      ],
    };
  }

  private normalizeLocalRepoDirtyState(value: unknown): boolean | null {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (
        ["dirty", "modified", "changed", "true", "yes", "1"].includes(
          normalized,
        )
      ) {
        return true;
      }
      if (["clean", "false", "no", "0", ""].includes(normalized)) {
        return false;
      }
    }
    return null;
  }

  private isAllowedLocalRepoSourcePath(relativePath: string) {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (normalized.includes("..")) return false;
    if (normalized === "app_manifest.json") return true;
    if (normalized === "roles_manifest.json") return true;
    if (normalized === "clawchat.config.json") return true;
    if (normalized === "api/openapi.json") return true;
    if (normalized.startsWith("api/") && normalized.endsWith(".md"))
      return true;
    if (
      normalized.startsWith("agent-docs-source/") &&
      normalized.endsWith(".md")
    ) {
      return true;
    }
    if (
      normalized.startsWith("auditor-docs-source/") &&
      normalized.endsWith(".md")
    ) {
      const auditorRelative = normalized.replace(/^auditor-docs-source\//, "");
      const allowedAuditorFiles = new Set([
        "SOUL.md",
        "IDENTITY.md",
        "APP_CONTEXT.md",
        "REVIEW_RULES.md",
        "OUTPUT_FORMAT.md",
        "WRITEBACK.md",
        "TRACKER.md",
        "WORKFLOW.md",
      ]);
      return (
        allowedAuditorFiles.has(auditorRelative) ||
        auditorRelative.endsWith(".md")
      );
    }
    if (
      normalized.startsWith("manager-docs-source/") &&
      normalized.endsWith(".md")
    ) {
      const managerRelative = normalized.replace(/^manager-docs-source\//, "");
      const allowedManagerFiles = new Set([
        "SOUL.md",
        "IDENTITY.md",
        "APP_CONTEXT.md",
        "ROLE_MANAGEMENT.md",
        "DELEGATION_RULES.md",
        "APPROVAL_GATES.md",
        "AUDIT_HANDLING.md",
        "OUTPUT_FORMAT.md",
        "TRACKER.md",
        "WORKFLOW.md",
      ]);
      return (
        allowedManagerFiles.has(managerRelative) ||
        managerRelative.endsWith(".md")
      );
    }
    return false;
  }

  private normalizeBridgeLocalRepoSourcePath(
    relativePath: string,
    docsSourcePrefix: string,
  ) {
    let normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (docsSourcePrefix && normalized.startsWith(`${docsSourcePrefix}/`)) {
      normalized = normalized.slice(docsSourcePrefix.length + 1);
    }
    if (normalized.startsWith(".clawchat/")) {
      normalized = normalized.slice(".clawchat/".length);
    }
    return normalized;
  }

  private normalizeLocalRepoDocsSourcePath(value: unknown) {
    const normalized =
      typeof value === "string" ? value.trim().replace(/\\/g, "/") : "";
    if (!normalized) return ".clawchat/";
    const withoutTrailingSlash = normalized.replace(/\/+$/g, "");
    if (!withoutTrailingSlash.endsWith("/clawchat.config.json"))
      return normalized;
    const parent = withoutTrailingSlash.slice(
      0,
      -"/clawchat.config.json".length,
    );
    return parent ? `${parent}/` : "./";
  }

  private parseJsonFile(file?: LocalRepoDiscovery["files"][number]) {
    if (!file) return undefined;
    try {
      return JSON.parse(file.content) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  private buildLocalRepoRoleManifest(
    linked: LinkedApplicationEntity,
    files: LocalRepoDiscovery["files"],
    appManifest?: Record<string, unknown>,
    rolesManifest?: Record<string, unknown>,
  ) {
    const explicitRoles = Array.isArray(rolesManifest?.roles)
      ? rolesManifest.roles
      : Array.isArray(appManifest?.roles)
        ? appManifest.roles
        : undefined;
    return normalizeMarketplaceRoleManifest({
      appSlug: linked.slug,
      appName: linked.name,
      explicitRoles,
      hasWorkerDocs: files.some((file) =>
        file.relativePath.startsWith("agent-docs-source/"),
      ),
      hasAuditorDocs: files.some((file) =>
        file.relativePath.startsWith("auditor-docs-source/"),
      ),
      hasManagerDocs: files.some((file) =>
        file.relativePath.startsWith("manager-docs-source/"),
      ),
    });
  }

  private diffGeneratedCanonicalSources(
    before: Record<string, string> | undefined,
    after: Record<string, string>,
  ) {
    const beforeMap = before ?? {};
    const beforePaths = new Set(Object.keys(beforeMap));
    const afterPaths = new Set(Object.keys(after));
    const addedPaths = [...afterPaths].filter((path) => !beforePaths.has(path));
    const removedPaths = [...beforePaths].filter(
      (path) => !afterPaths.has(path),
    );
    const changedPaths = [...afterPaths].filter(
      (path) => beforePaths.has(path) && beforeMap[path] !== after[path],
    );
    return {
      addedPaths,
      removedPaths,
      changedPaths,
      hasChanges:
        addedPaths.length > 0 ||
        removedPaths.length > 0 ||
        changedPaths.length > 0,
    };
  }

  private mergeSourceModels(
    left: MarketplaceExtractedSourceModel,
    right: MarketplaceExtractedSourceModel,
  ): MarketplaceExtractedSourceModel {
    return {
      ...left,
      extractedAt: new Date().toISOString(),
      sourceUrls: [...new Set([...left.sourceUrls, ...right.sourceUrls])],
      sourceSummaries: [...left.sourceSummaries, ...right.sourceSummaries],
      coverage: {
        apiOverview: left.coverage.apiOverview || right.coverage.apiOverview,
        auth: left.coverage.auth || right.coverage.auth,
        scopes: left.coverage.scopes || right.coverage.scopes,
        rateLimits: left.coverage.rateLimits || right.coverage.rateLimits,
        webhooks: left.coverage.webhooks || right.coverage.webhooks,
        errors: left.coverage.errors || right.coverage.errors,
        endpoints: left.coverage.endpoints || right.coverage.endpoints,
        objects: left.coverage.objects || right.coverage.objects,
        safetyPolicy: left.coverage.safetyPolicy || right.coverage.safetyPolicy,
        workflows: left.coverage.workflows || right.coverage.workflows,
        examples: left.coverage.examples || right.coverage.examples,
        officialSources:
          left.coverage.officialSources || right.coverage.officialSources,
      },
      objects: [...new Set([...left.objects, ...right.objects])],
      authTypes: [...new Set([...left.authTypes, ...right.authTypes])],
      scopeSignals: [...new Set([...left.scopeSignals, ...right.scopeSignals])],
      rateLimitSignals: [
        ...new Set([...left.rateLimitSignals, ...right.rateLimitSignals]),
      ],
      webhookSignals: [
        ...new Set([...left.webhookSignals, ...right.webhookSignals]),
      ],
      endpoints: [...left.endpoints, ...right.endpoints],
      endpointFamilies: [...left.endpointFamilies, ...right.endpointFamilies],
      workflowSignals: [
        ...new Set([...left.workflowSignals, ...right.workflowSignals]),
      ],
      safetySignals: [
        ...new Set([...left.safetySignals, ...right.safetySignals]),
      ],
      exampleSignals: [
        ...new Set([...left.exampleSignals, ...right.exampleSignals]),
      ],
      highRiskSignals: [
        ...new Set([...left.highRiskSignals, ...right.highRiskSignals]),
      ],
      missingSections: [
        ...new Set([...left.missingSections, ...right.missingSections]),
      ],
      warnings: [...new Set([...left.warnings, ...right.warnings])],
      ingestionErrors: [...left.ingestionErrors, ...right.ingestionErrors],
    };
  }

  private diffCoverageSections(
    before: MarketplaceExtractedSourceModel["coverage"] | undefined,
    after: MarketplaceExtractedSourceModel["coverage"],
  ) {
    return Object.entries(after)
      .filter(([key, value]) => value && !before?.[key as keyof typeof after])
      .map(([key]) => key);
  }

  private async getMutableGeneratedPack(workspaceId: string, appSlug: string) {
    const app = await this.resolveMarketplaceApp(workspaceId, appSlug);
    this.assertMarketplaceAppAvailableForBeta(app);
    if (hasCanonicalPack(app)) {
      throw new BadRequestException(`${app.name} is curated and protected.`);
    }
    return this.ensureGeneratedPackRecord(workspaceId, app);
  }

  private readGeneratedPack(entity: MarketplaceGeneratedPackEntity) {
    return entity.generatedPack as unknown as MarketplaceGeneratedPack;
  }

  private readInstallRuntimeFormat(
    install: MarketplaceInstallEntity,
  ): "openclaw" | "hermes" {
    return this.readInstallRuntimeFormatFromMetadata(install.metadata);
  }

  private readInstallRuntimeFormatFromMetadata(
    metadata?: Record<string, unknown> | null,
  ): "openclaw" | "hermes" {
    const runtimeFormat = String(metadata?.runtimeFormat ?? "openclaw");
    return runtimeFormat === "hermes" ? "hermes" : "openclaw";
  }

  private async getPersistedGeneratedPackForCompile(
    workspaceId: string,
    app: MarketplaceAppDefinition,
  ) {
    if (hasCanonicalPack(app)) return undefined;
    const entity = await this.ensureGeneratedPackRecord(workspaceId, app);
    const generated = this.readGeneratedPack(entity);
    generated.qualityLevel = entity.qualityLevel;
    generated.publicationStatus = entity.publicationStatus;
    generated.quality = {
      ...generated.quality,
      score: entity.qualityScore,
      confidence: entity.confidence,
      missingSections: entity.missingSections,
      warnings: entity.warnings,
      officialDocsCoverage:
        entity.officialDocsCoverage as MarketplaceGeneratedPack["quality"]["officialDocsCoverage"],
      highRiskActionsDetected: entity.highRiskActionsDetected,
      reviewStatus:
        entity.reviewStatus === "approved"
          ? "approved"
          : entity.reviewStatus === "human_reviewed"
            ? "human_reviewed"
            : entity.reviewStatus === "ai_reviewed"
              ? "ai_reviewed"
              : entity.reviewStatus === "rejected"
                ? "rejected"
                : "not_reviewed",
    };
    const canonicalSources = generated.canonicalSources ?? {};
    generated.roleManifest = normalizeMarketplaceRoleManifest({
      appSlug: app.slug,
      appName: app.name,
      explicitRoles: generated.roleManifest?.roles?.length
        ? generated.roleManifest.roles
        : app.roleManifest?.roles,
      hasWorkerDocs:
        Object.keys(canonicalSources).some(
          (path) =>
            !path.startsWith("auditor/") && !path.startsWith("manager/"),
        ) || app.roleManifest?.roles?.some((role) => role.role === "worker"),
      hasAuditorDocs:
        Object.keys(canonicalSources).some((path) =>
          path.startsWith("auditor/"),
        ) || app.roleManifest?.roles?.some((role) => role.role === "auditor"),
      hasManagerDocs:
        Object.keys(canonicalSources).some((path) =>
          path.startsWith("manager/"),
        ) || app.roleManifest?.roles?.some((role) => role.role === "manager"),
    });
    return generated;
  }

  private previewPersistedGeneratedPack(
    app: MarketplaceAppDefinition,
    pack: MarketplaceGeneratedPack,
    runtimeFormat: "openclaw" | "hermes",
  ) {
    const selectedCapabilities = app.capabilities
      .filter((capability) => capability.defaultEnabled)
      .map((capability) => capability.id);
    return compileGeneratedMarketplacePack({
      app,
      pack,
      runtimeFormat,
      selectedCapabilities,
      approvalProfileId: app.approvalProfile,
      connection: null,
      libraryTargetFolder: `marketplace/${app.slug}`,
    });
  }

  private toGeneratedPackSummary(pack: MarketplaceGeneratedPackEntity) {
    return {
      id: pack.id,
      workspaceId: pack.workspaceId,
      scope: pack.workspaceId ? "workspace" : "global",
      appSlug: pack.appSlug,
      name: pack.name,
      category: pack.category,
      riskLevel: pack.riskLevel,
      qualityLevel: pack.qualityLevel,
      publicationStatus: pack.publicationStatus,
      reviewStatus: pack.reviewStatus,
      confidence: pack.confidence,
      qualityScore: pack.qualityScore,
      missingSections: pack.missingSections,
      warnings: pack.warnings,
      officialDocsCoverage: pack.officialDocsCoverage,
      highRiskActionsDetected: pack.highRiskActionsDetected,
      sourceUrls: pack.sourceUrls,
      generatedAt: pack.generatedAt.toISOString(),
      createdAt: pack.createdAt.toISOString(),
      updatedAt: pack.updatedAt.toISOString(),
    };
  }

  private async assertGeneratedDraftInstallAllowed(
    workspaceId: string,
    app: MarketplaceAppDefinition,
    acknowledged?: boolean,
  ) {
    if (hasCanonicalPack(app)) return;
    const pack = await this.ensureGeneratedPackRecord(workspaceId, app);
    if (
      app.sourceType === "local_repo" &&
      pack.publicationStatus !== "published"
    ) {
      throw new BadRequestException(
        `${app.name} local repo pack has pending review changes. Publish the reviewed pack before installing or reinstalling.`,
      );
    }
    const highRisk = app.riskLevel === "high" || app.riskLevel === "critical";
    const draftOrBlocked =
      pack.qualityLevel === "generated_draft" ||
      pack.publicationStatus !== "published";
    if (
      pack.reviewStatus === "rejected" ||
      pack.publicationStatus === "blocked"
    ) {
      throw new BadRequestException(
        `${app.name} generated pack is rejected or blocked.`,
      );
    }
    if (highRisk && draftOrBlocked && !acknowledged) {
      throw new BadRequestException(
        `${app.name} is a high-risk generated draft pack. Review or explicitly acknowledge the generated-pack risk before installing.`,
      );
    }
  }

  private assertDangerousPolicyAcknowledged(
    policyId: unknown,
    acknowledged: boolean | undefined,
  ) {
    if (!isDangerouslySkipPermissionsPolicy(policyId)) return;
    if (acknowledged === true) return;
    throw new BadRequestException(
      "Dangerously skip permissions is an advanced policy that removes Relay per-action approval. Explicitly acknowledge the warning before activating it; workspace and connection ownership, provider-granted authority, selected capabilities, blocked actions, request bounds, rate limits, audit evidence, and secret non-exposure still apply.",
    );
  }

  private resolveApprovalProfileId(
    app: MarketplaceAppDefinition,
    requestedProfileId: string | undefined,
    dangerousPolicyAcknowledged: boolean | undefined,
  ) {
    if (requestedProfileId !== undefined && !requestedProfileId.trim()) {
      throw new BadRequestException("Approval profile id is required");
    }
    const approvalProfileId =
      requestedProfileId?.trim() ||
      app.approvalProfiles.find((item) => item.defaultSelected)?.id ||
      app.approvalProfile;
    if (
      !app.approvalProfiles.some((profile) => profile.id === approvalProfileId)
    ) {
      throw new BadRequestException(
        `Approval profile ${approvalProfileId} is not available for ${app.name}`,
      );
    }
    this.assertDangerousPolicyAcknowledged(
      approvalProfileId,
      dangerousPolicyAcknowledged,
    );
    return approvalProfileId;
  }

  private dangerousPolicyAcknowledgementMetadata(
    policyId: unknown,
    userId: string,
  ): Record<string, unknown> {
    if (!isDangerouslySkipPermissionsPolicy(policyId)) return {};
    return {
      dangerousPolicyAcknowledged: true,
      dangerousPolicyAcknowledgedAt: new Date().toISOString(),
      dangerousPolicyAcknowledgedByUserId: userId,
      dangerousPolicyAcknowledgementVersion:
        DANGEROUS_POLICY_ACKNOWLEDGEMENT_VERSION,
      dangerousPolicyPreservedInvariants: [
        ...DANGEROUS_POLICY_PRESERVED_INVARIANTS,
      ],
    };
  }

  private async buildCompiledPreview(
    workspaceId: string,
    input: {
      app: MarketplaceAppDefinition;
      runtimeFormat: "openclaw" | "hermes";
      libraryTargetFolder: string;
      selectedCapabilities: string[];
      approvalProfileId?: string;
      connection: MarketplaceConnectionEntity | null;
    },
  ) {
    if (input.app.slug === "github") {
      const compilerInput = {
        app: input.app,
        selectedCapabilities: input.selectedCapabilities,
        approvalProfileId: input.approvalProfileId,
        connection: input.connection
          ? {
              displayName: input.connection.displayName,
              environment: input.connection.environment,
              authType: input.connection.authType,
            }
          : null,
        libraryTargetFolder: input.libraryTargetFolder,
      };
      return input.runtimeFormat === "hermes"
        ? compileGithubHermesPack(compilerInput)
        : compileGithubOpenClawPack(compilerInput);
    }
    if (input.app.slug === "stripe") {
      const compilerInput = {
        app: input.app,
        selectedCapabilities: input.selectedCapabilities,
        approvalProfileId: input.approvalProfileId,
        connection: input.connection
          ? {
              displayName: input.connection.displayName,
              environment: input.connection.environment,
              authType: input.connection.authType,
            }
          : null,
        libraryTargetFolder: input.libraryTargetFolder,
      };
      return input.runtimeFormat === "hermes"
        ? compileStripeHermesPack(compilerInput)
        : compileStripeOpenClawPack(compilerInput);
    }
    if (hasCanonicalPack(input.app)) {
      const compilerInput = {
        app: input.app,
        selectedCapabilities: input.selectedCapabilities,
        approvalProfileId: input.approvalProfileId,
        connection: input.connection
          ? {
              displayName: input.connection.displayName,
              environment: input.connection.environment,
              authType: input.connection.authType,
            }
          : null,
        libraryTargetFolder: input.libraryTargetFolder,
      };
      return input.runtimeFormat === "hermes"
        ? compileCanonicalHermesPack(compilerInput)
        : compileCanonicalOpenClawPack(compilerInput);
    }
    const pack = await this.getPersistedGeneratedPackForCompile(
      workspaceId,
      input.app,
    );
    const compiled = compileGeneratedMarketplacePack({
      app: input.app,
      pack,
      runtimeFormat: input.runtimeFormat,
      selectedCapabilities: input.selectedCapabilities,
      approvalProfileId: input.approvalProfileId,
      connection: input.connection
        ? {
            displayName: input.connection.displayName,
            environment: input.connection.environment,
            authType: input.connection.authType,
          }
        : null,
      libraryTargetFolder: input.libraryTargetFolder,
    });
    return this.ensureLocalRepoRoleRuntimeOutput({
      app: input.app,
      pack,
      runtimeFormat: input.runtimeFormat,
      libraryTargetFolder: input.libraryTargetFolder,
      compiled,
    });
  }

  private ensureLocalRepoRoleRuntimeOutput(input: {
    app: MarketplaceAppDefinition;
    pack: MarketplaceGeneratedPack;
    runtimeFormat: "openclaw" | "hermes";
    libraryTargetFolder: string;
    compiled: ReturnType<typeof compileGeneratedMarketplacePack>;
  }) {
    if (input.app.sourceType !== "local_repo") return input.compiled;
    const files = [...input.compiled.files];
    const appendRoleFallback = (role: "manager" | "auditor") => {
      const canonicalEntries = Object.entries(
        input.pack.canonicalSources ?? {},
      ).filter(([path]) => path.startsWith(`${role}/`) && path.endsWith(".md"));
      if (!canonicalEntries.length) return;
      if (input.runtimeFormat === "hermes") {
        const skillRoot =
          role === "manager"
            ? `skills/${input.app.slug}-manager-router`
            : `skills/${input.app.slug}-auditor-router`;
        if (files.some((file) => file.relativePath.startsWith(`${skillRoot}/`)))
          return;
        files.push({
          relativePath: `${skillRoot}/SKILL.md`,
          content: this.renderLocalRepoHermesRoleSkill(input.app, role),
          classification: "generated_workspace_router",
          refreshPolicy: "regenerate_allowed",
        });
        for (const [sourcePath, content] of canonicalEntries) {
          files.push({
            relativePath: `${skillRoot}/references/${this.localRepoRoleReferenceFilename(sourcePath, role)}`,
            content,
            classification:
              role === "manager"
                ? "generated_manager_docs"
                : "generated_auditor_docs",
            refreshPolicy: "regenerate_allowed",
          });
        }
        files.push({
          relativePath: `${skillRoot}/references/roles_manifest.json`,
          content: JSON.stringify(
            input.pack.roleManifest ??
              input.app.roleManifest ??
              roleManifestForApp(input.app),
            null,
            2,
          ),
          classification: "generated_role_manifest",
          refreshPolicy: "regenerate_allowed",
        });
        return;
      }
      const workspaceRoot = `${AGENT_DOCS_PACK_PATH}/workspace_files/${role}`;
      if (
        files.some((file) => file.relativePath.startsWith(`${workspaceRoot}/`))
      )
        return;
      files.push(
        {
          relativePath: `${workspaceRoot}/AGENTS.md`,
          content: this.renderLocalRepoOpenClawRoleRouter(
            input.app,
            role,
            input.libraryTargetFolder,
          ),
          classification: "generated_workspace_router",
          refreshPolicy: "install_only",
        },
        {
          relativePath: `${workspaceRoot}/WORKFLOW.md`,
          content: this.renderLocalRepoOpenClawRoleWorkflow(
            input.app,
            role,
            input.libraryTargetFolder,
          ),
          classification: "generated_workspace_router",
          refreshPolicy: "install_only",
        },
      );
    };
    appendRoleFallback("manager");
    appendRoleFallback("auditor");
    return { ...input.compiled, files };
  }

  private renderLocalRepoHermesRoleSkill(
    app: MarketplaceAppDefinition,
    role: "manager" | "auditor",
  ) {
    const skillName =
      role === "manager"
        ? `${app.slug}-manager-router`
        : `${app.slug}-auditor-router`;
    const title = role === "manager" ? "Manager Router" : "Auditor Router";
    const purpose =
      role === "manager"
        ? "Coordinate app roles, approval gates, delegation, and audit handling using the app-specific manager references."
        : "Review app work independently using the app-specific auditor references.";
    return [
      "---",
      `name: ${skillName}`,
      `description: ${purpose}`,
      "version: 1.0.0",
      "---",
      "",
      `# ${app.name} ${title}`,
      "",
      purpose,
      "",
      "Before acting, load the relevant files in `references/` and follow the app-specific doctrine there.",
    ].join("\n");
  }

  private renderLocalRepoOpenClawRoleRouter(
    app: MarketplaceAppDefinition,
    role: "manager" | "auditor",
    libraryTargetFolder: string,
  ) {
    return [
      `# ${app.name} ${role === "manager" ? "Manager" : "Auditor"} Router`,
      "",
      `Load library/${libraryTargetFolder}/${role}/ before acting.`,
      "Follow the app-specific role doctrine and do not substitute worker instructions for this role.",
    ].join("\n");
  }

  private renderLocalRepoOpenClawRoleWorkflow(
    app: MarketplaceAppDefinition,
    role: "manager" | "auditor",
    libraryTargetFolder: string,
  ) {
    return [
      `# ${app.name} ${role === "manager" ? "Manager" : "Auditor"} Workflow`,
      "",
      `Use library/${libraryTargetFolder}/${role}/ as the source of truth for this role.`,
      "Load role manifest and role-specific references before producing output.",
    ].join("\n");
  }

  private localRepoRoleReferenceFilename(
    sourcePath: string,
    role: "manager" | "auditor",
  ) {
    const relative = sourcePath
      .replace(new RegExp(`^${role}/`), "")
      .replace(/\\/g, "/")
      .replace(/[^A-Za-z0-9._/-]+/g, "_")
      .replace(/^\/+/, "");
    const filename =
      relative.split("/").filter(Boolean).join("__") || "reference.md";
    return filename.endsWith(".md") ? filename : `${filename}.md`;
  }

  private async ensureLocalRepoRoleRuntimeOutputFromSource(
    workspaceId: string,
    app: MarketplaceAppDefinition,
    role: string,
    runtimeFormat: "openclaw" | "hermes",
    compiled: ReturnType<typeof compileGeneratedMarketplacePack>,
  ) {
    const normalizedRole = this.normalizeInstallRole(role);
    if (
      app.sourceType !== "local_repo" ||
      !["manager", "auditor"].includes(normalizedRole) ||
      this.hasRoleRuntimeOutput(
        app,
        normalizedRole,
        runtimeFormat,
        compiled.files,
      )
    ) {
      return compiled;
    }

    const linked = await this.getLocalLinkedApplication(workspaceId, app.slug);
    const discovery = await this.discoverLocalRepoSource(linked);
    const roleSourcePrefix =
      normalizedRole === "manager"
        ? "manager-docs-source/"
        : "auditor-docs-source/";
    const roleFiles = discovery.files.filter(
      (file) =>
        file.relativePath.startsWith(roleSourcePrefix) &&
        file.relativePath.endsWith(".md"),
    );

    const files = [...compiled.files];
    if (runtimeFormat === "hermes") {
      const skillRoot =
        normalizedRole === "manager"
          ? `skills/${app.slug}-manager-router`
          : `skills/${app.slug}-auditor-router`;
      files.push({
        relativePath: `${skillRoot}/SKILL.md`,
        content: this.renderLocalRepoHermesRoleSkill(
          app,
          normalizedRole as "manager" | "auditor",
        ),
        classification: "generated_workspace_router",
        refreshPolicy: "regenerate_allowed",
      });
      for (const file of roleFiles) {
        const sourcePath = `${normalizedRole}/${file.relativePath.slice(roleSourcePrefix.length)}`;
        files.push({
          relativePath: `${skillRoot}/references/${this.localRepoRoleReferenceFilename(
            sourcePath,
            normalizedRole as "manager" | "auditor",
          )}`,
          content: file.content,
          classification:
            normalizedRole === "manager"
              ? "generated_manager_docs"
              : "generated_auditor_docs",
          refreshPolicy: "regenerate_allowed",
        });
      }
      files.push({
        relativePath: `${skillRoot}/references/roles_manifest.json`,
        content: JSON.stringify(
          discovery.roleManifest ?? app.roleManifest ?? roleManifestForApp(app),
          null,
          2,
        ),
        classification: "generated_role_manifest",
        refreshPolicy: "regenerate_allowed",
      });
      return { ...compiled, files };
    }

    const workspaceRoot = `${AGENT_DOCS_PACK_PATH}/workspace_files/${normalizedRole}`;
    files.push(
      {
        relativePath: `${workspaceRoot}/AGENTS.md`,
        content: this.renderLocalRepoOpenClawRoleRouter(
          app,
          normalizedRole as "manager" | "auditor",
          `marketplace/${app.slug}`,
        ),
        classification: "generated_workspace_router",
        refreshPolicy: "install_only",
      },
      {
        relativePath: `${workspaceRoot}/WORKFLOW.md`,
        content: this.renderLocalRepoOpenClawRoleWorkflow(
          app,
          normalizedRole as "manager" | "auditor",
          `marketplace/${app.slug}`,
        ),
        classification: "generated_workspace_router",
        refreshPolicy: "install_only",
      },
    );
    return { ...compiled, files };
  }

  private hasRoleRuntimeOutput(
    app: MarketplaceAppDefinition,
    role: string,
    runtimeFormat: "openclaw" | "hermes",
    files: PackFile[],
  ) {
    return runtimeFormat === "hermes"
      ? files.some((file) =>
          file.relativePath.startsWith(this.hermesSourceRoot(app, role)),
        )
      : files.some((file) =>
          file.relativePath.includes(`/workspace_files/${role}/`),
        );
  }

  private normalizeCapabilities(
    app: MarketplaceAppDefinition,
    input?: string[],
  ) {
    const valid = new Set(app.capabilities.map((capability) => capability.id));
    const defaults = app.capabilities
      .filter((capability) => capability.defaultEnabled)
      .map((capability) => capability.id);
    const selected = input?.length ? input : defaults;
    const withAliases =
      app.sourceType === "local_repo" && selected.includes("write")
        ? [...selected, "write_internal"]
        : selected;
    return [
      ...new Set(withAliases.filter((capability) => valid.has(capability))),
    ];
  }

  private normalizeInstallRole(role: string) {
    return String(role ?? "")
      .trim()
      .toLowerCase();
  }

  private assertRoleDefined(app: MarketplaceAppDefinition, role: string) {
    const normalizedRole = role?.trim();
    if (!normalizedRole)
      throw new BadRequestException("Marketplace install role is required");
    const manifestRole = findMarketplaceRole(app, normalizedRole);
    if (
      app.sourceType === "local_repo" &&
      ["worker", "operator", "auditor", "manager"].includes(normalizedRole)
    ) {
      return;
    }
    if (!manifestRole) {
      throw new BadRequestException(
        `Marketplace app ${app.name} does not define role \`${normalizedRole}\`.`,
      );
    }
    if (!manifestRole.installable) {
      throw new BadRequestException(
        manifestRole.notInstallableReason ??
          `No runtime output is available for role \`${normalizedRole}\`.`,
      );
    }
  }

  private assertRoleRuntimeOutputAvailable(
    app: MarketplaceAppDefinition,
    role: string,
    runtimeFormat: "openclaw" | "hermes",
    files: PackFile[],
  ) {
    const hasOutput = this.hasRoleRuntimeOutput(
      app,
      role,
      runtimeFormat,
      files,
    );
    if (!hasOutput) {
      throw new BadRequestException(
        `No runtime output is available for role \`${role}\`.`,
      );
    }
  }

  private hermesSourceRoot(app: MarketplaceAppDefinition, role: string) {
    return role === "auditor"
      ? `skills/${app.slug}-auditor-router/`
      : role === "manager"
        ? `skills/${app.slug}-manager-router/`
        : `skills/${app.slug}-router/`;
  }

  private encryptCredentials(
    credentials: Record<string, string>,
    binding?: Pick<MarketplaceConnectionEntity, "workspaceId" | "appSlug">,
  ) {
    return this.encryptionService.encryptString(
      binding
        ? encodeMarketplaceCredentialEnvelope(binding, credentials)
        : JSON.stringify(credentials),
    );
  }

  private resolveRuntimeFormat(
    app: MarketplaceAppDefinition,
    runtimeFormat?: string | null,
  ) {
    const fallback = app.runtimeSupport[0]?.format ?? "openclaw";
    const requested = runtimeFormat?.trim() as
      | "openclaw"
      | "hermes"
      | undefined;
    if (!requested) return fallback;
    if (!app.runtimeSupport.some((item) => item.format === requested)) {
      throw new BadRequestException(
        `${app.name} does not support runtime format ${requested}`,
      );
    }
    return requested;
  }

  private assertRuntimeInstallable(
    app: MarketplaceAppDefinition,
    runtimeFormat: "openclaw" | "hermes",
  ) {
    const support = app.runtimeSupport.find(
      (item) => item.format === runtimeFormat,
    );
    if (support?.installSupport !== "installable") {
      throw new BadRequestException(
        support?.description ||
          `${app.name} cannot be installed to ${runtimeFormat}.`,
      );
    }
  }

  private async resolveInstallAgents(
    workspaceId: string,
    userId: string,
    dto: InstallMarketplaceAppDto,
    targetMode: "existing_agents" | "activate_new_agent",
    app: MarketplaceAppDefinition,
  ) {
    if (targetMode === "activate_new_agent") {
      const runtimeType =
        dto.newAgentRuntimeType?.trim().toLowerCase() || "openclaw";
      if (runtimeType !== "openclaw") {
        throw new BadRequestException(
          "New marketplace agents currently install directly only to OpenClaw. Hermes is preview-only for now.",
        );
      }
      const createdAgent = await this.agentService.create(
        {
          name: dto.newAgentName?.trim() || `${app.name} Operator`,
          workspaceId,
          role: dto.newAgentRole?.trim() || `${app.name} marketplace operator`,
          source: runtimeType,
          description: `Marketplace-created ${app.name} operator agent. Uses the installed ${app.name} operating pack and approval policy.`,
          runtimeBinding: {
            runtimeType: "openclaw",
          },
        } as any,
        userId,
      );
      await this.auditLogService.record({
        actorType: "user",
        actorId: userId,
        workspaceId,
        eventType: "marketplace.agent.activated",
        resourceType: "agent",
        resourceId: createdAgent.id,
        metadata: {
          runtimeType,
          source: "marketplace",
          marketplaceAppSlug: dto.appSlug,
        },
      });
      return [createdAgent];
    }

    const agentIds = dto.agentIds ?? [];
    if (!agentIds.length) {
      throw new BadRequestException("At least one existing agent is required");
    }
    const agents = await this.agentRepo.findByIds(agentIds);
    const workspaceAgents = agents.filter(
      (agent) => agent.workspaceId === workspaceId,
    );
    if (workspaceAgents.length !== agentIds.length) {
      throw new BadRequestException(
        "One or more selected agents were not found",
      );
    }
    return Promise.all(
      workspaceAgents.map((agent) =>
        this.agentService.findOne(agent.id, userId),
      ),
    );
  }

  private resolveAgentRuntimeType(
    agent: AgentEntity & {
      runtimeBinding?: { runtimeType?: string | null } | null;
    },
  ) {
    return (
      agent.runtimeBinding?.runtimeType?.trim().toLowerCase() ||
      agent.source?.trim().toLowerCase() ||
      "manual"
    );
  }

  private async getConnectionEntity(workspaceId: string, connectionId: string) {
    const connection = await this.connectionRepo.findOne({
      where: { id: connectionId, workspaceId },
    });
    if (!connection)
      throw new NotFoundException("Marketplace connection not found");
    if (connection.executionAuthority !== "railway") {
      throw new ForbiddenException(
        "MARKETPLACE_EXECUTION_AUTHORITY_SWIFT_NO_FALLBACK",
      );
    }
    return connection;
  }

  private toConnectionView(connection: MarketplaceConnectionEntity) {
    return {
      id: connection.id,
      workspaceId: connection.workspaceId,
      appSlug: connection.appSlug,
      displayName: connection.displayName,
      environment: connection.environment,
      authType: connection.authType,
      executionAuthority: connection.executionAuthority ?? "railway",
      credentialNames: connection.credentialNames,
      selectedCapabilities: connection.selectedCapabilities,
      status: connection.status,
      lastValidatedAt: connection.lastValidatedAt?.toISOString() ?? null,
      lastErrorCode: connection.lastErrorCode,
      lastErrorMessage: connection.lastErrorMessage,
      metadata: connection.metadata,
      createdByUserId: connection.createdByUserId,
      updatedByUserId: connection.updatedByUserId,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    };
  }

  private buildMarketplaceInstallMetadata(
    appSlug: string,
    connection: MarketplaceConnectionEntity | null,
    outlookSenderEmail?: string | null,
  ) {
    if (appSlug !== "outlook") return {};
    const requestedEmail =
      this.stringOrNull(outlookSenderEmail)?.toLowerCase() ??
      this.stringOrNull(
        connection?.metadata?.primaryMailboxAddress,
      )?.toLowerCase() ??
      null;
    if (!requestedEmail) return {};
    const identity = this.outlookSenderIdentityFromConnection(
      connection,
      requestedEmail,
    );
    return {
      outlookSenderIdentity: identity,
    };
  }

  private outlookSenderIdentityFromConnection(
    connection: MarketplaceConnectionEntity | null,
    email: string,
  ) {
    const identities = Array.isArray(connection?.metadata?.senderIdentities)
      ? (connection!.metadata.senderIdentities as Array<
          Record<string, unknown>
        >)
      : Array.isArray(connection?.metadata?.approvedSenderIdentities)
        ? (connection!.metadata.approvedSenderIdentities as Array<
            Record<string, unknown>
          >)
        : [];
    const found = identities.find(
      (identity) => this.stringOrNull(identity.email)?.toLowerCase() === email,
    );
    if (found) {
      return {
        id: this.stringOrNull(found.id) ?? `alias:${email}`,
        email,
        displayName: this.stringOrNull(found.displayName),
        type: this.stringOrNull(found.type) ?? "unknown_unverified",
        validationStatus:
          this.stringOrNull(found.validationStatus) ??
          (found.verified === true ? "verified" : "unverified"),
        lastValidatedAt: this.stringOrNull(found.lastValidatedAt) ?? null,
        allowedForConnection:
          found.allowedForConnection !== false &&
          found.approvedForAgents !== false,
        adminUrl:
          this.stringOrNull(found.adminUrl) ??
          "https://admin.exchange.microsoft.com/#/mailboxes",
      };
    }
    return {
      id: `missing:${email}`,
      email,
      displayName: null,
      type: "missing",
      validationStatus: "missing",
      lastValidatedAt: new Date().toISOString(),
      allowedForConnection: false,
      adminUrl: "https://admin.exchange.microsoft.com/#/mailboxes",
    };
  }
}
