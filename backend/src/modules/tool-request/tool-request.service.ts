import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  LinkedApplicationEntity,
  MarketplaceConnectionEntity,
  ScheduledThreadMessageEntity,
  TaskEntity,
  ToolRequestEntity,
  type ToolRequestStatus,
} from "../../entities";
import {
  CreateToolRequestDto,
  type ToolRequestCapability,
  TOOL_REQUEST_CAPABILITIES,
} from "./dto/tool-request.dto";
import { MARKETPLACE_CATALOG } from "../marketplace/catalog/marketplace-catalog";
import {
  assertMarketplaceBetaGateAllowed,
  evaluateMarketplaceBetaGate,
} from "../marketplace/marketplace-beta-gate";

const OPEN_STATUSES: ToolRequestStatus[] = [
  "requested",
  "connected",
  "granted",
  "unavailable",
];

const TERMINAL_STATUSES: ToolRequestStatus[] = [
  "ignored",
  "dismissed",
  "resolved",
];

const CAPABILITY_APP_SUGGESTIONS: Record<string, string[]> = {
  browser_navigation: ["browser", "browserbase", "playwright"],
  external_search: ["exa", "serpapi", "google-search", "brave-search"],
  web_search: ["exa", "serpapi", "google-search", "brave-search"],
  prospect_discovery: ["exa", "apollo", "linkedin-sales-navigator"],
  content_extraction: ["exa", "browser", "crawler"],
  research: ["exa", "perplexity", "browser"],
  deep_research: ["exa", "perplexity"],
  evidence_gathering: ["exa", "browser", "crawler"],
  competitor_research: ["exa", "semrush", "ahrefs"],
  backlink_prospecting: ["exa", "ahrefs", "semrush"],
  public_form_fill: ["browser", "browserbase", "playwright"],
  public_form_submit: ["browser", "browserbase", "playwright"],
  email_draft: ["gmail", "outlook", "resend", "smtp"],
  email_send: ["gmail", "outlook", "resend", "smtp"],
  email_read: ["gmail", "outlook"],
  email_reply: ["gmail", "outlook"],
  email_forward: ["gmail", "outlook"],
  account_creation: ["browser", "credential-vault"],
  credential_use: ["credential-vault", "1password"],
  external_publishing: ["wordpress", "webflow", "linkedin", "x"],
  backlink_verification: ["ahrefs", "semrush", "screaming-frog", "crawler"],
  index_checking: ["google-search-console", "serpapi", "crawler"],
  lifecycle_contacted_submitted: ["local-linkcrest"],
  lifecycle_live_indexed: ["local-linkcrest", "crawler"],
  linkcrest_openclaw_tools: ["local-linkcrest"],
  local_app_record_write: ["local-linkcrest"],
  other: [],
};

const CAPABILITY_CATEGORIES: Record<string, string[]> = {
  browser_navigation: ["browser"],
  external_search: ["search"],
  web_search: ["search"],
  prospect_discovery: ["search", "prospecting"],
  content_extraction: ["content_extraction"],
  research: ["research"],
  deep_research: ["research", "approval_required"],
  evidence_gathering: ["research", "evidence"],
  competitor_research: ["research", "competitor"],
  backlink_prospecting: ["seo", "prospecting"],
  public_form_fill: ["browser", "form"],
  public_form_submit: ["browser", "form_submit"],
  email_draft: ["email"],
  email_send: ["email_send"],
  email_read: ["email_read"],
  email_reply: ["email_reply"],
  email_forward: ["email_forward"],
  account_creation: ["account_workflow"],
  credential_use: ["credentials"],
  external_publishing: ["publishing"],
  backlink_verification: ["seo", "crawler", "verification"],
  index_checking: ["seo", "index_check"],
  lifecycle_contacted_submitted: ["local_app_lifecycle"],
  lifecycle_live_indexed: ["local_app_lifecycle", "verification"],
  linkcrest_openclaw_tools: ["local_repo", "openclaw"],
  local_app_record_write: ["local_app_write"],
  other: [],
};

@Injectable()
export class ToolRequestService {
  constructor(
    @InjectRepository(ToolRequestEntity)
    private readonly toolRequestRepo: Repository<ToolRequestEntity>,
    @InjectRepository(LinkedApplicationEntity)
    private readonly linkedAppRepo: Repository<LinkedApplicationEntity>,
    @InjectRepository(MarketplaceConnectionEntity)
    private readonly connectionRepo: Repository<MarketplaceConnectionEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(ScheduledThreadMessageEntity)
    private readonly scheduledMessageRepo: Repository<ScheduledThreadMessageEntity>,
  ) {}

  async createToolRequest(workspaceId: string, dto: CreateToolRequestDto) {
    if (dto.policyAllowed === false) {
      return {
        created: false,
        request: null,
        reason: "blocked_by_policy",
      };
    }

    const requestedCapability = this.normalizeCapability(dto.requestedCapability);
    const scope = await this.resolveLocalAppToolRequestScope(workspaceId, {
      linkedAppId: dto.linkedAppId,
      appSlug: dto.appSlug,
      campaignId: dto.campaignId,
      campaignName: dto.campaignName,
    });
    const linkedAppId = this.clean(dto.linkedAppId) ?? scope.linkedAppId;
    const appSlug = scope.canonicalAppSlug ?? this.clean(dto.appSlug);
    this.assertToolRequestAppAvailableForBeta(appSlug);
    const suggestedMarketplaceAppSlugs = this.filterBetaUnavailableSuggestions(
      this.normalizeStringArray(
        dto.suggestedMarketplaceAppSlugs ??
          dto.suggestedMarketplaceApps ??
          CAPABILITY_APP_SUGGESTIONS[requestedCapability],
      ),
    );
    const suggestedToolCategories = this.normalizeStringArray(
      dto.suggestedToolCategories ?? CAPABILITY_CATEGORIES[requestedCapability],
    );
    const connectionState = await this.resolveConnectionState(
      workspaceId,
      requestedCapability,
      suggestedMarketplaceAppSlugs,
    );
    const now = new Date();
    const dedupeWhere = {
      linkedAppId,
      appSlugs: scope.appSlugs.length ? scope.appSlugs : [appSlug].filter(Boolean),
      teamId: this.clean(dto.teamId),
      threadId: this.clean(dto.threadId),
      requestedCapability,
      requiredForAction: dto.requiredForAction.trim(),
      campaignId: this.clean(dto.campaignId),
      campaignName: this.clean(dto.campaignName),
      relatedTaskId: this.clean(dto.relatedTaskId),
      relatedRecordType: this.clean(dto.relatedRecordType),
      relatedRecordId: this.clean(dto.relatedRecordId),
    };
    let request = await this.findOpenDuplicate(workspaceId, dedupeWhere);
    if (request) {
      request.reason = dto.reason?.trim() || request.reason;
      request.policyAllowed = dto.policyAllowed ?? true;
      request.toolAvailable =
        dto.toolAvailable ?? connectionState.toolAvailable ?? request.toolAvailable;
      request.toolConnected =
        dto.toolConnected ?? connectionState.toolConnected ?? request.toolConnected;
      request.toolGranted =
        dto.toolGranted ?? connectionState.toolGranted ?? request.toolGranted;
      request.suggestedMarketplaceAppSlugs = suggestedMarketplaceAppSlugs;
      request.suggestedToolCategories = suggestedToolCategories;
      request.requiredEvidenceType =
        this.clean(dto.requiredEvidenceType) ?? request.requiredEvidenceType;
      request.metadata = {
        ...(request.metadata ?? {}),
        ...(dto.metadata ?? {}),
        lastDuplicateSeenAt: now.toISOString(),
      };
      request.lastSeenAt = now;
      request = await this.toolRequestRepo.save(request);
      await this.annotateScheduledContinuation(request);
      return { created: false, request, reason: "deduped" };
    }

    request = this.toolRequestRepo.create({
      workspaceId,
      linkedAppId,
      appSlug,
      teamId: this.clean(dto.teamId),
      threadId: this.clean(dto.threadId),
      campaignId: this.clean(dto.campaignId),
      campaignName: this.clean(dto.campaignName),
      requestingAgentId: this.clean(dto.requestingAgentId ?? dto.agentId),
      requestingAgentName: this.clean(
        dto.requestingAgentName ?? dto.requestingAgentSlug,
      ),
      role: this.clean(dto.role),
      requestedCapability,
      requiredForAction: dto.requiredForAction.trim(),
      reason: dto.reason.trim(),
      relatedTaskId: this.clean(dto.relatedTaskId),
      relatedRecordType: this.clean(dto.relatedRecordType),
      relatedRecordId: this.clean(dto.relatedRecordId),
      autonomyModeAtRequest: this.clean(dto.autonomyModeAtRequest),
      policyAllowed: dto.policyAllowed ?? true,
      toolAvailable: dto.toolAvailable ?? connectionState.toolAvailable,
      toolConnected: dto.toolConnected ?? connectionState.toolConnected,
      toolGranted: dto.toolGranted ?? connectionState.toolGranted,
      suggestedMarketplaceAppSlugs,
      suggestedToolCategories,
      requiredEvidenceType: this.clean(dto.requiredEvidenceType),
      status: connectionState.toolGranted
        ? "granted"
        : connectionState.toolConnected
          ? "connected"
          : "requested",
      metadata: dto.metadata ?? {},
      lastSeenAt: now,
      resolvedAt: null,
    });
    request = await this.toolRequestRepo.save(request);
    await this.annotateScheduledContinuation(request);
    return { created: true, request, reason: "created" };
  }

  async listToolRequests(
    workspaceId: string,
    filters: {
      linkedAppId?: string;
      appSlug?: string;
      teamId?: string;
      threadId?: string;
      agentId?: string;
      status?: ToolRequestStatus;
      capability?: string;
    },
  ) {
    const scope = await this.resolveLocalAppToolRequestScope(workspaceId, {
      linkedAppId: filters.linkedAppId,
      appSlug: filters.appSlug,
    });
    const baseWhere = {
      workspaceId,
      ...(filters.teamId ? { teamId: filters.teamId } : {}),
      ...(filters.threadId ? { threadId: filters.threadId } : {}),
      ...(filters.agentId ? { requestingAgentId: filters.agentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.capability
        ? { requestedCapability: this.normalizeCapability(filters.capability) }
        : {}),
    };
    const linkedAppIds = Array.from(
      new Set([filters.linkedAppId, scope.linkedAppId].filter(Boolean) as string[]),
    );
    const appSlugs = scope.appSlugs.length
      ? scope.appSlugs
      : filters.appSlug
        ? [filters.appSlug]
        : [];
    const where =
      linkedAppIds.length || appSlugs.length
        ? [
            ...linkedAppIds.map((linkedAppId) => ({ ...baseWhere, linkedAppId })),
            ...(appSlugs.length ? [{ ...baseWhere, appSlug: In(appSlugs) }] : []),
          ]
        : baseWhere;
    const requests = await this.toolRequestRepo.find({
      where: where as any,
      order: { updatedAt: "DESC" },
    });
    return this.dedupeRequestsById(requests);
  }

  async getNeededToolsSummary(workspaceId: string, filters: { appSlug?: string; teamId?: string }) {
    const requests = await this.listToolRequests(workspaceId, {
      ...filters,
    });
    const open = requests.filter((request) => !TERMINAL_STATUSES.includes(request.status));
    const groups = new Map<string, { appSlug: string | null; capability: string; count: number; requests: ToolRequestEntity[] }>();
    for (const request of open) {
      const key = `${request.appSlug ?? "workspace"}:${request.requestedCapability}`;
      const group =
        groups.get(key) ??
        {
          appSlug: request.appSlug,
          capability: request.requestedCapability,
          count: 0,
          requests: [],
        };
      group.count += 1;
      group.requests.push(request);
      groups.set(key, group);
    }
    return {
      totalOpen: open.length,
      groups: Array.from(groups.values()),
    };
  }

  async updateToolRequestStatus(
    workspaceId: string,
    id: string,
    status: ToolRequestStatus,
    resolutionNotes?: string | null,
  ) {
    const request = await this.toolRequestRepo.findOne({ where: { id, workspaceId } });
    if (!request) throw new NotFoundException("Tool request not found");
    request.status = status;
    request.resolutionNotes = resolutionNotes ?? request.resolutionNotes;
    request.resolvedAt = TERMINAL_STATUSES.includes(status) || status === "resolved" ? new Date() : null;
    return this.toolRequestRepo.save(request);
  }

  async resolveToolRequestsFromConnection(input: {
    workspaceId: string;
    appSlug: string;
    selectedCapabilities?: string[];
  }) {
    const requests = await this.toolRequestRepo.find({
      where: {
        workspaceId: input.workspaceId,
        status: In(OPEN_STATUSES),
      },
    });
    const matching = requests.filter((request) =>
      this.connectionCanSatisfy(
        input.appSlug,
        input.selectedCapabilities ?? [],
        request.requestedCapability,
        request.suggestedMarketplaceAppSlugs,
      ),
    );
    for (const request of matching) {
      request.toolConnected = true;
      request.toolAvailable = true;
      request.toolGranted = this.capabilityGranted(
        request.requestedCapability,
        input.selectedCapabilities ?? [],
      );
      request.status = request.toolGranted ? "granted" : "connected";
      request.metadata = {
        ...(request.metadata ?? {}),
        resolvedFromConnectionAt: new Date().toISOString(),
        resolvedFromConnectionAppSlug: input.appSlug,
      };
      await this.toolRequestRepo.save(request);
    }
    return { matched: matching.length };
  }

  private async resolveConnectionState(
    workspaceId: string,
    requestedCapability: string,
    suggestedAppSlugs: string[],
  ) {
    if (suggestedAppSlugs.length === 0) {
      return { toolAvailable: false, toolConnected: false, toolGranted: false };
    }
    const connections = await this.connectionRepo.find({
      where: { workspaceId, appSlug: In(suggestedAppSlugs), status: "ready" },
    });
    const toolConnected = connections.length > 0;
    const toolGranted = connections.some((connection) =>
      this.capabilityGranted(requestedCapability, connection.selectedCapabilities ?? []),
    );
    return { toolAvailable: toolConnected, toolConnected, toolGranted };
  }

  private assertToolRequestAppAvailableForBeta(appSlug: string | null) {
    if (!appSlug) return;
    const staticApp = MARKETPLACE_CATALOG.find((app) => app.slug === appSlug);
    if (staticApp) {
      assertMarketplaceBetaGateAllowed(staticApp);
      return;
    }
    if (this.localAppSlugAliases(appSlug).length) {
      assertMarketplaceBetaGateAllowed({
        slug: appSlug,
        name: appSlug,
        sourceType: "local_repo",
      });
    }
  }

  private filterBetaUnavailableSuggestions(appSlugs: string[]) {
    return appSlugs.filter((appSlug) => {
      const staticApp = MARKETPLACE_CATALOG.find((app) => app.slug === appSlug);
      if (!staticApp) return true;
      return evaluateMarketplaceBetaGate(staticApp).available;
    });
  }

  private connectionCanSatisfy(
    appSlug: string,
    selectedCapabilities: string[],
    requestedCapability: string,
    suggestedAppSlugs: string[],
  ) {
    return (
      suggestedAppSlugs.includes(appSlug) ||
      this.capabilityGranted(requestedCapability, selectedCapabilities)
    );
  }

  private capabilityGranted(requestedCapability: string, selectedCapabilities: string[]) {
    const requestedMatches = this.capabilityAliases(requestedCapability);
    return selectedCapabilities.some((capability) => {
      const normalized = this.normalizeCapability(capability);
      return (
        requestedMatches.has(normalized) ||
        requestedMatches.has(capability) ||
        normalized === requestedCapability ||
        capability === requestedCapability
      );
    });
  }

  private capabilityAliases(capability: string) {
    const normalized = this.normalizeCapability(capability);
    const aliases: Record<string, string[]> = {
      external_search: ["external_search", "web_search", "search"],
      web_search: ["web_search", "external_search", "search"],
      prospect_discovery: ["prospect_discovery", "similar", "search", "external_search"],
      content_extraction: ["content_extraction", "contents"],
      research: ["research", "deep_research", "answer", "search"],
      deep_research: ["deep_research", "research"],
      evidence_gathering: ["evidence_gathering", "answer", "search"],
      competitor_research: ["competitor_research", "research", "search"],
      backlink_prospecting: ["backlink_prospecting", "prospect_discovery", "similar", "search"],
    };
    return new Set([normalized, capability, ...(aliases[normalized] ?? [])]);
  }

  private async findOpenDuplicate(
    workspaceId: string,
    input: {
      linkedAppId: string | null;
      appSlugs: string[];
      teamId: string | null;
      threadId: string | null;
      requestedCapability: string;
      requiredForAction: string;
      campaignId: string | null;
      campaignName: string | null;
      relatedTaskId: string | null;
      relatedRecordType: string | null;
      relatedRecordId: string | null;
    },
  ) {
    const candidates = await this.toolRequestRepo.find({
      where: {
        workspaceId,
        requestedCapability: input.requestedCapability,
        requiredForAction: input.requiredForAction,
        status: In(OPEN_STATUSES),
      },
    });
    return (
      candidates.find((request) => {
        const appMatches =
          (!input.linkedAppId && input.appSlugs.length === 0) ||
          (input.linkedAppId && request.linkedAppId === input.linkedAppId) ||
          (request.appSlug ? input.appSlugs.includes(request.appSlug) : false);
        return (
          appMatches &&
          request.teamId === input.teamId &&
          request.threadId === input.threadId &&
          request.campaignId === input.campaignId &&
          request.campaignName === input.campaignName &&
          request.relatedTaskId === input.relatedTaskId &&
          request.relatedRecordType === input.relatedRecordType &&
          request.relatedRecordId === input.relatedRecordId
        );
      }) ?? null
    );
  }

  private async resolveLocalAppToolRequestScope(
    workspaceId: string,
    input: {
      linkedAppId?: string | null;
      appSlug?: string | null;
      campaignId?: string | null;
      campaignName?: string | null;
    },
  ) {
    const requestedSlug = this.clean(input.appSlug);
    const aliases = this.localAppSlugAliases(requestedSlug);
    let linkedApp: LinkedApplicationEntity | null = null;
    if (input.linkedAppId) {
      linkedApp = await this.linkedAppRepo.findOne({
        where: { id: input.linkedAppId, workspaceId },
      });
    }
    if (!linkedApp && aliases.length) {
      linkedApp = await this.linkedAppRepo.findOne({
        where: aliases.map((slug) => ({ workspaceId, slug })),
      });
    }
    if (!linkedApp && (input.campaignId || input.campaignName)) {
      linkedApp = await this.findLinkedAppByCampaign(workspaceId, {
        campaignId: this.clean(input.campaignId),
        campaignName: this.clean(input.campaignName),
      });
    }
    const appSlugs = Array.from(
      new Set([
        ...aliases,
        ...(linkedApp ? this.localAppSlugAliases(linkedApp.slug) : []),
      ]),
    );
    return {
      linkedAppId: linkedApp?.id ?? null,
      canonicalAppSlug: linkedApp?.slug ?? (requestedSlug === "linkcrest" ? "local-linkcrest" : requestedSlug),
      appSlugs,
    };
  }

  private async findLinkedAppByCampaign(
    workspaceId: string,
    input: { campaignId: string | null; campaignName: string | null },
  ) {
    if (!input.campaignId && !input.campaignName) return null;
    const qb = this.linkedAppRepo
      .createQueryBuilder("linked")
      .where('linked."workspaceId" = :workspaceId', { workspaceId });
    if (input.campaignId && input.campaignName) {
      qb.andWhere(
        '(linked.metadata ->> :campaignIdKey = :campaignId OR linked.metadata ->> :campaignNameKey = :campaignName)',
        {
          campaignIdKey: "linkcrestCampaignId",
          campaignId: input.campaignId,
          campaignNameKey: "linkcrestCampaignName",
          campaignName: input.campaignName,
        },
      );
    } else if (input.campaignId) {
      qb.andWhere('linked.metadata ->> :campaignIdKey = :campaignId', {
        campaignIdKey: "linkcrestCampaignId",
        campaignId: input.campaignId,
      });
    } else {
      qb.andWhere('linked.metadata ->> :campaignNameKey = :campaignName', {
        campaignNameKey: "linkcrestCampaignName",
        campaignName: input.campaignName,
      });
    }
    return qb.getOne();
  }

  private localAppSlugAliases(appSlug: string | null) {
    if (!appSlug) return [];
    const normalized = appSlug.trim();
    const aliases = new Set([normalized]);
    if (normalized === "linkcrest") aliases.add("local-linkcrest");
    if (normalized === "local-linkcrest") aliases.add("linkcrest");
    return Array.from(aliases);
  }

  private dedupeRequestsById(requests: ToolRequestEntity[]) {
    const seen = new Set<string>();
    return requests.filter((request) => {
      if (seen.has(request.id)) return false;
      seen.add(request.id);
      return true;
    });
  }

  private normalizeCapability(value: string): ToolRequestCapability {
    const normalized = value
      .trim()
      .replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
      .replace(/[-.]/g, "_")
      .replace(/^public_form_submission$/, "public_form_submit")
      .replace(/^form_submit$/, "public_form_submit")
      .replace(/^form_fill$/, "public_form_fill")
      .replace(/^email$/, "email_send")
      .replace(/^inbox_read$/, "email_read")
      .replace(/^read_email$/, "email_read")
      .replace(/^reply_email$/, "email_reply")
      .replace(/^forward_email$/, "email_forward")
      .replace(/^external_publish$/, "external_publishing")
      .replace(/^backlink_verify$/, "backlink_verification")
      .replace(/^index_check$/, "index_checking")
      .replace(/^account_create$/, "account_creation")
      .replace(/^browser_external$/, "browser_navigation")
      .replace(/^web$/, "web_search")
      .replace(/^search$/, "external_search")
      .replace(/^exa_search$/, "external_search")
      .replace(/^extract_content$/, "content_extraction")
      .replace(/^get_contents$/, "content_extraction")
      .replace(/^find_similar$/, "prospect_discovery")
      .replace(/^answer$/, "evidence_gathering");
    return TOOL_REQUEST_CAPABILITIES.includes(normalized as ToolRequestCapability)
      ? (normalized as ToolRequestCapability)
      : "other";
  }

  private normalizeStringArray(value?: string[] | null) {
    return Array.from(
      new Set(
        (value ?? [])
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    );
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private async annotateScheduledContinuation(request: ToolRequestEntity) {
    if (!request.relatedTaskId) return;
    const task = await this.taskRepo.findOne({
      where: { id: request.relatedTaskId, workspaceId: request.workspaceId },
    });
    if (!task?.scheduledMessageId) return;
    const scheduled = await this.scheduledMessageRepo.findOne({
      where: { id: task.scheduledMessageId },
    });
    if (!scheduled) return;
    scheduled.metadata = {
      ...(scheduled.metadata ?? {}),
      pendingToolRequestId: request.id,
      pendingToolRequestCapability: request.requestedCapability,
      continuationGuidance:
        `Tool request pending: ${request.requestedCapability}. Continue other available tasks. Resume this action once the tool is connected/granted.`,
    };
    await this.scheduledMessageRepo.save(scheduled);
  }
}
