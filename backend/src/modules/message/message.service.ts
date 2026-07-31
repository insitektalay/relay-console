import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  AgentEntity,
  LinkedApplicationEntity,
  MarketplaceConnectionEntity,
  MarketplaceInstallEntity,
  MeetingHardRestriction,
  MeetingRulePackSnapshotEntity,
  MeetingSessionEntity,
  MeetingStatus,
  MessageEntity,
  MessageProvenance,
  TaskEntity,
  ThreadEntity,
} from "../../entities";
import { MessageReactionEntity } from "../../entities/message-reaction.entity";
import { RuntimeBindingEntity } from "../../entities/runtime-binding.entity";
import { UserEntity } from "../../entities/user.entity";
import { paginate } from "../../common/dto/pagination.dto";
import { EventsGateway } from "../../gateways/events.gateway";
import { ClaudeService } from "../claude/claude.service";
import { RuntimeDispatchCoordinator } from "../runtime/runtime-dispatch-coordinator.service";
import { ThreadMembershipService } from "../thread/thread-membership.service";
import {
  TEAM_RELAY_DEFAULT_REPLY_LIMIT,
  TEAM_RELAY_REPLY_LIMIT_PRESETS,
  normalizeTeamRelayReplyLimit,
  ThreadSessionService,
} from "../thread/thread-session.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { MessageCondensingService } from "./message-condensing.service";
import {
  MESSAGE_CONTENT_FORMAT_MARKDOWN,
  buildRuntimeResponsePresentationContext,
  prepareAgentReplyForStorage,
} from "./response-presentation";
import {
  OPENCLAW_ATTACHMENT_PROVENANCE_TOKEN_FIELD,
  verifyOpenClawAttachmentProvenance,
} from "./message-attachment-provenance";
import {
  applyApprovalRequiredCapabilitiesToLocalAppPolicy,
  localAppAutonomyRuntimeInstruction,
  localAppPolicyCapabilityForExternalKey,
  localAppPolicyCapabilityForLifecycleKey,
  mergeLocalAppAutonomyPolicies,
  normalizeLocalAppAutonomyPolicy,
} from "../marketplace/local-app-autonomy.policy";
import {
  localAppRuntimeRecoveryDoctrine,
  resolveLocalAppRuntimeProfile,
} from "../marketplace/local-app-runtime-profile";
import { HERMES_NATIVE_BASE_HARNESS_TOOLS } from "../hermes/hermes-native-tools";
import type { MarketplaceConnectorManifest } from "../marketplace/connectors/types";
import { MarketplaceConnectorRegistry } from "../marketplace/connectors/connector-registry";
import { OUTLOOK_CONNECTOR_MANIFEST } from "../marketplace/connectors/outlook/outlook.connector";
import { isDangerouslySkipPermissionsPolicy } from "../marketplace/marketplace-permission-policy";
import {
  buildRuntimeArtifactContract,
  withRuntimeArtifactContract,
} from "./runtime-artifact-contract";
import { withRuntimeAttachmentContext } from "./runtime-attachment-context";

export interface CanonicalMessageInput extends Partial<MessageEntity> {
  content: string;
}

export interface CanonicalMessageOptions {
  routeToAgents?: boolean;
  routeToAgentsAsync?: boolean;
}

const DEFAULT_CLAUDE_TIMEOUT_SECONDS = 60 * 60;
const DEFAULT_RUNTIME_TIMEOUT_MS = 60 * 60 * 1000;
const DEFAULT_RUNTIME_RECENT_MESSAGES_LIMIT = 8;
const DEFAULT_TRIVIAL_RUNTIME_RECENT_MESSAGES_LIMIT = 6;
const MAX_RUNTIME_RECENT_MESSAGES_LIMIT = 20;
const DEFAULT_RUNTIME_RECENT_MESSAGES_CHAR_BUDGET = 14_000;
const DEFAULT_TRIVIAL_RUNTIME_RECENT_MESSAGES_CHAR_BUDGET = 10_000;
const MAX_RUNTIME_RECENT_MESSAGES_CHAR_BUDGET = 50_000;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const THREAD_LAST_MESSAGE_PREVIEW_LENGTH = 500;
const DEFAULT_SHARED_AGENT_TURN_LIMIT = 50;
const HERMES_BROWSER_TOOL_NAMES = [
  "browser_navigate",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_vision",
] as const;

function localAppTool(
  base: Record<string, unknown>,
  name: string,
  functionName: string,
  description: string,
  properties: Record<string, unknown>,
  approvalRequired = false,
) {
  return {
    ...base,
    name,
    functionName,
    aliases: [name, functionName],
    approvalRequired,
    description,
    inputSchema: {
      type: "object",
      properties,
      additionalProperties: false,
    },
  };
}

function buildThreadLastMessagePreview(content: string) {
  if (content.length <= THREAD_LAST_MESSAGE_PREVIEW_LENGTH) {
    return content;
  }

  return `${content.slice(0, THREAD_LAST_MESSAGE_PREVIEW_LENGTH).trimEnd()}...`;
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);
  private readonly marketplaceConnectorRegistry =
    new MarketplaceConnectorRegistry();

  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,

    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,

    @InjectRepository(MeetingSessionEntity)
    private readonly meetingRepo: Repository<MeetingSessionEntity>,

    @InjectRepository(MeetingRulePackSnapshotEntity)
    private readonly meetingRulePackSnapshotRepo: Repository<MeetingRulePackSnapshotEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(MessageReactionEntity)
    private readonly reactionRepo: Repository<MessageReactionEntity>,

    @InjectRepository(MarketplaceInstallEntity)
    private readonly marketplaceInstallRepo: Repository<MarketplaceInstallEntity>,

    @InjectRepository(MarketplaceConnectionEntity)
    private readonly marketplaceConnectionRepo: Repository<MarketplaceConnectionEntity>,

    @InjectRepository(LinkedApplicationEntity)
    private readonly linkedApplicationRepo: Repository<LinkedApplicationEntity>,

    private readonly eventsGateway: EventsGateway,
    @Inject(forwardRef(() => ClaudeService))
    private readonly claudeService: ClaudeService,
    private readonly runtimeDispatchCoordinator: RuntimeDispatchCoordinator,
    private readonly threadMembershipService: ThreadMembershipService,
    private readonly threadSessionService: ThreadSessionService,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
    private readonly messageCondensingService: MessageCondensingService,
  ) {}

  async searchMessages(
    workspaceId: string,
    userId: string,
    query: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      userId,
    );

    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      throw new BadRequestException("Search query is required");
    }

    const qb = this.messageRepo
      .createQueryBuilder("m")
      .innerJoinAndSelect("m.thread", "t")
      .where('t."workspaceId" = :workspaceId', { workspaceId })
      .andWhere("t.status != :archived", { archived: "archived" })
      .andWhere("t.type != :agentToAgent", {
        agentToAgent: "agent_to_agent",
      })
      .andWhere("POSITION(LOWER(:query) IN LOWER(m.content)) > 0", {
        query: normalizedQuery,
      })
      .orderBy('m."createdAt"', "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [messages, total] = await qb.getManyAndCount();
    const results = messages.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      threadTitle: message.thread.title,
      senderName: message.senderName,
      content: message.content,
      timestamp: message.createdAt,
      threadType: message.thread.type,
    }));

    return paginate(results, total, page, pageSize);
  }

  async findAll(
    threadId: string,
    filters: {
      before?: string;
      page?: number;
      pageSize?: number;
      threadSessionId?: string;
    },
    userId?: string,
  ) {
    const { before, page = 1, pageSize = 50, threadSessionId } = filters;
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (userId) {
      await this.workspaceMembershipService.ensureWorkspaceAccess(
        thread.workspaceId,
        userId,
      );
    }
    const targetSession = threadSessionId
      ? await this.threadSessionService.findThreadSession(
          threadId,
          threadSessionId,
        )
      : await this.threadSessionService.ensureActiveSession(thread);

    if (!targetSession) {
      throw new NotFoundException("Thread session not found");
    }

    const qb = this.messageRepo
      .createQueryBuilder("m")
      .where('m."threadId" = :threadId', { threadId })
      .andWhere('m."threadSessionId" = :threadSessionId', {
        threadSessionId: targetSession.id,
      });

    if (before) {
      const beforeDate = await this.resolveBeforeCursor(before);
      if (beforeDate) {
        qb.andWhere('m."createdAt" < :before', { before: beforeDate });
      }
    }

    qb.orderBy('m."createdAt"', "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    const reversed = items.reverse();

    // Bulk-load reactions in a single IN query (AC-R1: no N+1)
    let reactionsMap: Map<string, MessageReactionEntity[]> = new Map();
    if (reversed.length > 0) {
      const messageIds = reversed.map((m) => m.id);
      const reactions = await this.reactionRepo
        .createQueryBuilder("r")
        .where('r."messageId" IN (:...messageIds)', { messageIds })
        .getMany();
      for (const r of reactions) {
        const list = reactionsMap.get(r.messageId) ?? [];
        list.push(r);
        reactionsMap.set(r.messageId, list);
      }
    }

    const itemsWithReactions = reversed.map((msg) => ({
      ...msg,
      reactions: reactionsMap.get(msg.id) ?? [],
    }));

    return paginate(itemsWithReactions, total, page, pageSize);
  }

  async findLatest(
    threadId: string,
    filters: {
      before?: string;
      limit?: number;
    },
    userId?: string,
  ) {
    const limit = Math.min(Math.max(filters.limit ?? 30, 1), 100);
    const thread = await this.threadRepo.findOne({
      where: { id: threadId },
      select: ["id", "workspaceId"],
    });
    if (!thread) throw new NotFoundException("Thread not found");
    if (userId) {
      await this.workspaceMembershipService.ensureWorkspaceAccess(
        thread.workspaceId,
        userId,
      );
    }

    const qb = this.messageRepo
      .createQueryBuilder("m")
      .where('m."threadId" = :threadId', { threadId });

    if (filters.before) {
      const beforeDate = await this.resolveBeforeCursor(filters.before);
      if (beforeDate) {
        qb.andWhere('m."createdAt" < :before', { before: beforeDate });
      }
    }

    const items = await qb
      .orderBy('m."createdAt"', "DESC")
      .take(limit)
      .getMany();

    return items.reverse();
  }

  async findOne(id: string): Promise<MessageEntity> {
    const msg = await this.messageRepo.findOne({ where: { id } });
    if (!msg) throw new NotFoundException(`Message ${id} not found`);
    return msg;
  }

  async routeSynchronizedUserMessage(messageId: string, userId: string) {
    const { message, thread } = await this.ensureMessageThreadAccess(
      messageId,
      userId,
    );
    if (!message.isFromUser || message.provenance !== MessageProvenance.USER) {
      throw new ForbiddenException(
        "Only an authenticated synchronized human message can start a runtime dispatch",
      );
    }
    await this.routeMessageToAgents(thread as ThreadEntity, message);
    return { messageId, dispatched: true };
  }

  async getTeamRelay(threadId: string, userId: string) {
    const { thread, session } = await this.loadTeamRelayContext(
      threadId,
      userId,
    );
    return this.buildTeamRelayState(thread, session);
  }

  async pauseTeamRelay(threadId: string, userId: string) {
    const { thread, session } = await this.loadTeamRelayContext(
      threadId,
      userId,
    );
    const updated = await this.threadSessionService.updateRelayControls(
      session,
      {
        runState: "paused",
        pauseReason: "manual",
      },
    );
    const state = await this.buildTeamRelayState(thread, updated);
    this.emitTeamRelayUpdate(thread, state);
    return state;
  }

  async continueTeamRelay(threadId: string, userId: string) {
    const { thread, session } = await this.loadTeamRelayContext(
      threadId,
      userId,
    );
    const replyCount = await this.threadSessionService.countAgentReplies(
      thread.id,
      session.id,
    );
    const currentLimit = this.resolveTeamRelayReplyLimit(thread, session);
    const replyLimit =
      replyCount >= currentLimit
        ? this.nextTeamRelayReplyLimit(Math.max(replyCount, currentLimit))
        : currentLimit;
    const updated = await this.threadSessionService.updateRelayControls(
      session,
      {
        runState: "running",
        pauseReason: null,
        replyLimit,
      },
    );
    await this.routeLatestPendingTeamRelayMessage(thread, updated.id);
    const state = await this.buildTeamRelayState(thread, updated);
    this.emitTeamRelayUpdate(thread, state);
    return state;
  }

  async setTeamRelayReplyLimit(
    threadId: string,
    userId: string,
    rawReplyLimit: number,
  ) {
    const { thread, session } = await this.loadTeamRelayContext(
      threadId,
      userId,
    );
    const replyLimit = normalizeTeamRelayReplyLimit(rawReplyLimit);
    const replyCount = await this.threadSessionService.countAgentReplies(
      thread.id,
      session.id,
    );
    const manuallyPaused = session.relayPauseReason === "manual";
    const canRun = replyCount < replyLimit && !manuallyPaused;
    const updated = await this.threadSessionService.updateRelayControls(
      session,
      {
        runState: canRun ? "running" : "paused",
        pauseReason: manuallyPaused ? "manual" : canRun ? null : "reply_limit",
        replyLimit,
      },
    );
    if (canRun) {
      await this.routeLatestPendingTeamRelayMessage(thread, updated.id);
    }
    const state = await this.buildTeamRelayState(thread, updated);
    this.emitTeamRelayUpdate(thread, state);
    return state;
  }

  async getReactions(
    messageId: string,
    userId?: string,
  ): Promise<MessageReactionEntity[]> {
    if (userId) {
      await this.ensureMessageThreadAccess(messageId, userId);
    } else {
      await this.findMessageReference(messageId);
    }
    return this.reactionRepo.find({
      where: { messageId },
      order: { createdAt: "ASC" },
    });
  }

  async addReaction(
    messageId: string,
    emoji: string,
    reactor: { user?: UserEntity; agent?: AgentEntity },
  ): Promise<MessageReactionEntity> {
    let reactorId: string;
    let reactorType: string;
    let reactorName: string;
    let userId: string | null = null;
    let agentId: string | null = null;

    let msg: Pick<MessageEntity, "id" | "threadId">;
    if (reactor.user) {
      reactorId = `user:${reactor.user.id}`;
      reactorType = "user";
      reactorName = reactor.user.name;
      userId = reactor.user.id;
      msg = (await this.ensureMessageThreadAccess(messageId, reactor.user.id))
        .message;
    } else if (reactor.agent) {
      reactorId = `agent:${reactor.agent.id}`;
      reactorType = "agent";
      reactorName = reactor.agent.name;
      agentId = reactor.agent.id;
      msg = await this.findMessageReference(messageId);
    } else {
      throw new BadRequestException("Reactor must be a user or agent");
    }

    const existing = await this.reactionRepo.findOne({
      where: { messageId, reactorId, emoji },
    });
    if (existing) {
      throw new ConflictException("Reaction already exists");
    }

    const reaction = await this.reactionRepo.save(
      this.reactionRepo.create({
        messageId,
        userId,
        agentId,
        reactorId,
        reactorType,
        reactorName,
        emoji,
      }),
    );

    this.eventsGateway.emitToThread(msg.threadId, "message.reaction", {
      action: "add",
      messageId,
      reaction: {
        id: reaction.id,
        emoji,
        reactorId,
        reactorType,
        reactorName,
      },
    });

    return reaction;
  }

  async removeReaction(
    messageId: string,
    emoji: string,
    reactorId: string,
    userId?: string,
  ): Promise<void> {
    const msg = userId
      ? (await this.ensureMessageThreadAccess(messageId, userId)).message
      : await this.findMessageReference(messageId);
    const reaction = await this.reactionRepo.findOne({
      where: { messageId, reactorId, emoji },
      select: ["id", "emoji", "reactorId", "reactorType", "reactorName"],
    });
    if (!reaction) {
      throw new NotFoundException("Reaction not found");
    }

    await this.reactionRepo.delete(reaction.id);

    this.eventsGateway.emitToThread(msg.threadId, "message.reaction", {
      action: "remove",
      messageId,
      reaction: {
        id: reaction.id,
        emoji: reaction.emoji,
        reactorId: reaction.reactorId,
        reactorType: reaction.reactorType,
        reactorName: reaction.reactorName,
      },
    });
  }

  async create(
    threadId: string,
    data: CanonicalMessageInput,
    userId?: string,
    options: Pick<CanonicalMessageOptions, "routeToAgentsAsync"> = {},
  ): Promise<MessageEntity> {
    if (userId) {
      const thread = await this.threadRepo.findOne({ where: { id: threadId } });
      if (!thread) throw new NotFoundException("Thread not found");
      await this.workspaceMembershipService.ensureWorkspaceAccess(
        thread.workspaceId,
        userId,
      );
    }
    await this.assertMeetingMessageAllowed(threadId, data, userId);
    return this.createCanonicalMessage(threadId, data, {
      // A conversational reply is not itself a consequential action. The
      // selected runtime approval mode remains in message metadata so runtime
      // tools and external actions can enforce it after the turn starts.
      routeToAgents: data.isFromUser ?? true,
      routeToAgentsAsync: options.routeToAgentsAsync,
    });
  }

  private async assertMeetingMessageAllowed(
    threadId: string,
    data: CanonicalMessageInput,
    userId?: string,
  ) {
    const senderId = data.senderId ?? userId ?? null;
    if (!senderId) return;
    const meeting = await this.meetingRepo.findOne({
      where: { threadId, status: MeetingStatus.ACTIVE },
    });
    if (!meeting?.appliedRulePackSnapshotId) return;
    const snapshot = await this.meetingRulePackSnapshotRepo.findOne({
      where: { id: meeting.appliedRulePackSnapshotId },
    });
    const restricted = snapshot?.hardRestrictions?.includes(
      MeetingHardRestriction.NO_MESSAGE_NON_PARTICIPANTS,
    );
    if (!restricted) return;
    const participantIds = new Set(
      (meeting.participantsSnapshot ?? [])
        .map((participant) => participant.participantId)
        .filter(Boolean),
    );
    if (!participantIds.has(senderId)) {
      throw new ForbiddenException(
        "Only meeting participants can send messages to this meeting thread",
      );
    }
  }

  private async ensureMessageThreadAccess(messageId: string, userId: string) {
    const message = await this.findMessageReference(messageId);
    const thread = await this.threadRepo.findOne({
      where: { id: message.threadId },
      select: ["id", "workspaceId"],
    });
    if (!thread) throw new NotFoundException("Thread not found");
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      userId,
    );
    return { message, thread };
  }

  private async findMessageReference(messageId: string) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      select: ["id", "threadId"],
    });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);
    return message;
  }

  async injectMessage(
    threadId: string,
    data: CanonicalMessageInput,
    options: CanonicalMessageOptions = {},
  ): Promise<MessageEntity> {
    return this.createCanonicalMessage(threadId, data, options);
  }

  async buildOutboundContext(
    threadId: string,
    saved: MessageEntity,
    thread?: ThreadEntity | null,
    memberAgents?: Array<Partial<AgentEntity>>,
  ) {
    const resolvedThread =
      thread ?? (await this.threadRepo.findOne({ where: { id: threadId } }));
    const resolvedAgents =
      memberAgents ??
      (await this.threadMembershipService.listMemberAgents(threadId));
    const threadType = resolvedThread?.type ?? null;
    const isTeamThread = threadType === "team";
    const participantAgentIds = resolvedAgents
      .map((agent) => agent.id)
      .filter((value): value is string => Boolean(value));
    const threadParticipants = resolvedAgents.map((agent) => ({
      agentId: agent.id ?? null,
      externalAgentId:
        agent.externalId?.trim() ||
        agent.description?.match(/External ID:\s*(\S+)/)?.[1] ||
        null,
      name: agent.name ?? null,
    }));
    const participantCount =
      (resolvedThread?.participantIds?.length ?? 0) + threadParticipants.length;
    return {
      threadType,
      threadTitle: resolvedThread?.title ?? null,
      threadTeamId: resolvedThread?.teamId ?? null,
      threadDepartmentId: resolvedThread?.departmentId ?? null,
      threadAgentCount: resolvedAgents.length,
      threadParticipantAgentIds: participantAgentIds,
      threadParticipants,
      participantCount,
      chatType: threadType,
      conversationType: threadType,
      threadKind: threadType,
      isTeamThread,
      isGroupChat: isTeamThread,
      agentsCanReplyToEachOther: isTeamThread,
      threadClassification:
        threadType === "team"
          ? "team_chat"
          : threadType === "department"
            ? "department_chat"
            : threadType === "agent_to_agent"
              ? "agent_to_agent_chat"
              : "direct_chat",
      threadInstruction:
        threadType === "team"
          ? "This is a team chat. All listed agents are in the same shared thread and may reply to the user and to each other."
          : threadType === "department"
            ? "This is a department chat. Treat it as a shared multi-party conversation."
            : threadType === "agent_to_agent"
              ? "This is an agent-to-agent shared thread, not a user-only direct chat."
              : "This is a direct chat.",
      messageProvenance: saved.provenance,
      scheduledMessageId: saved.metadata?.scheduledMessageId ?? null,
    };
  }

  async buildAgentMarketplaceRuntimeContext(
    workspaceId: string,
    agentId: string,
    dispatchId?: string,
    nativeRuntimeToolNames: string[] = [],
  ) {
    const installs = await this.marketplaceInstallRepo.find({
      where: { workspaceId, agentId, installStatus: "installed" },
      order: { updatedAt: "DESC" },
    });
    if (!installs.length) return {};

    const connectionIds = installs
      .map((install) => install.connectionId)
      .filter((value): value is string => Boolean(value));
    const connections = connectionIds.length
      ? await this.marketplaceConnectionRepo.findByIds(connectionIds)
      : [];
    const connectionById = new Map(
      connections.map((connection) => [connection.id, connection]),
    );

    const appSlugs = Array.from(
      new Set(installs.map((install) => install.appSlug)),
    );
    const linkedApps = appSlugs.length
      ? await this.linkedApplicationRepo
          .createQueryBuilder("linked")
          .where('linked."workspaceId" = :workspaceId', { workspaceId })
          .andWhere("linked.slug IN (:...appSlugs)", { appSlugs })
          .getMany()
      : [];
    const linkedAppBySlug = new Map(linkedApps.map((app) => [app.slug, app]));

    const installedApplications = installs.map((install) => {
      const connection = install.connectionId
        ? (connectionById.get(install.connectionId) ?? null)
        : null;
      const linkedApp = linkedAppBySlug.get(install.appSlug) ?? null;
      const appMetadata = linkedApp?.metadata ?? {};
      const connectionMetadata = connection?.metadata ?? {};
      const lifecycle =
        this.objectOrNull(connectionMetadata.lifecycle) ??
        this.objectOrNull(appMetadata.lifecycle) ??
        {};
      const autonomyPolicy = normalizeLocalAppAutonomyPolicy(
        connectionMetadata.autonomyPolicy ?? appMetadata.autonomyPolicy,
      );
      const runtimeProfile = resolveLocalAppRuntimeProfile({
        appSlug: install.appSlug,
        appName: linkedApp?.name ?? null,
        repoPath: linkedApp?.repoPath ?? null,
        metadata: appMetadata,
        apiStyleMetadata: linkedApp?.apiStyleMetadata ?? null,
        connectionMetadata,
      });
      const allowRuntimeHostStart =
        connectionMetadata.allowRuntimeHostStart === true ||
        lifecycle.allowRuntimeHostStart === true ||
        runtimeProfile.autoStartAllowed === true;

      const initialSelectedCapabilities = install.selectedCapabilities ?? [];
      const candidateConnectorTools = this.buildMarketplaceConnectorTools({
        workspaceId,
        appSlug: install.appSlug,
        connection,
        linkedApp,
        selectedCapabilities: initialSelectedCapabilities,
        installMetadata: install.metadata ?? {},
      });
      const effectiveSelectedCapabilities =
        this.resolveMarketplaceRuntimeSelectedCapabilities({
          appSlug: install.appSlug,
          selectedCapabilities: initialSelectedCapabilities,
          connection,
          connectorTools: candidateConnectorTools,
          installMetadata: install.metadata ?? {},
        });
      const connectorTools = this.buildMarketplaceConnectorTools({
        workspaceId,
        appSlug: install.appSlug,
        connection,
        linkedApp,
        selectedCapabilities: effectiveSelectedCapabilities,
        installMetadata: install.metadata ?? {},
      });
      const connectorToolReason =
        install.appSlug === "x" && !connectorTools.length
          ? this.describeXToolEligibility(connection)
          : null;
      const approvalRequiredCapabilities =
        this.approvalRequiredCapabilitiesForTools(connectorTools);
      const effectiveAutonomyPolicy =
        applyApprovalRequiredCapabilitiesToLocalAppPolicy(
          autonomyPolicy,
          approvalRequiredCapabilities,
        );

      return {
        appSlug: install.appSlug,
        installId: install.id,
        role: install.role,
        selectedCapabilities: effectiveSelectedCapabilities,
        configuredSelectedCapabilities: initialSelectedCapabilities,
        installStatus: install.installStatus,
        documentationLayer: {
          installed: true,
          targetRoot:
            this.stringOrNull(install.metadata?.targetRoot) ??
            this.stringOrNull(connectionMetadata.targetRoot),
          defaultSkill:
            this.stringOrNull(install.metadata?.skillName) ??
            this.stringOrNull(connectionMetadata.skillName),
        },
        connectionLayer: connection
          ? {
              id: connection.id,
              displayName: connection.displayName,
              environment: connection.environment,
              authType: connection.authType,
              status: connection.status,
              selectedCapabilities: connection.selectedCapabilities ?? [],
              credentialNames: connection.credentialNames ?? [],
              hasPrivateCredentials: Boolean(
                connection.credentialNames?.length,
              ),
              metadata:
                this.sanitizeConnectionMetadataForDispatch(connectionMetadata),
            }
          : {
              id: null,
              status: "not_selected",
              hasPrivateCredentials: false,
              metadata: {},
            },
        localRuntimeLayer: {
          sourceHostType:
            this.stringOrNull(connectionMetadata.sourceHostType) ??
            this.stringOrNull(appMetadata.sourceHostType),
          sourceHostId:
            this.stringOrNull(connectionMetadata.sourceHostId) ??
            this.stringOrNull(appMetadata.sourceHostId),
          sourceHostLabel:
            this.stringOrNull(connectionMetadata.sourceHostLabel) ??
            this.stringOrNull(appMetadata.sourceHostLabel),
          bridgeDeviceId:
            this.stringOrNull(connectionMetadata.bridgeDeviceId) ??
            this.stringOrNull(appMetadata.bridgeDeviceId),
          runtimeBindingId:
            this.stringOrNull(connectionMetadata.runtimeBindingId) ??
            this.stringOrNull(appMetadata.runtimeBindingId),
          runtimeType:
            this.stringOrNull(connectionMetadata.runtimeType) ??
            this.stringOrNull(appMetadata.runtimeType),
          localRepoPath:
            this.stringOrNull(connectionMetadata.localRepoPath) ??
            linkedApp?.repoPath ??
            null,
          localAppUrl:
            this.stringOrNull(connectionMetadata.localAppUrl) ??
            this.stringOrNull(appMetadata.localAppUrl),
          localApiUrl:
            this.stringOrNull(connectionMetadata.localApiUrl) ??
            this.stringOrNull(appMetadata.localApiUrl),
          convexSiteUrl: this.stringOrNull(connectionMetadata.convexSiteUrl),
          mayStartLocalApp: allowRuntimeHostStart,
          runtimeProfile,
          runtimeRecovery: {
            enabled: runtimeProfile.autoStartAllowed === true,
            trigger: "app_unreachable_before_final_blocker",
            bridgeActions: [
              "localApp.getRuntimeStatus",
              "localApp.ensureRunning",
              "localApp.start",
              "localApp.restart",
            ],
            doctrine: localAppRuntimeRecoveryDoctrine(),
          },
          approvalPolicy:
            this.stringOrNull(connectionMetadata.lifecycleApprovalPolicy) ??
            this.stringOrNull(lifecycle.approvalPolicy) ??
            "approval_required_for_start_or_restart",
          lifecycle,
        },
        autonomyPolicy: effectiveAutonomyPolicy,
        configuredAutonomyPolicy: autonomyPolicy,
        toolAvailability: this.buildLocalAppToolAvailability(
          effectiveSelectedCapabilities,
          effectiveAutonomyPolicy,
          connectorTools,
          nativeRuntimeToolNames,
        ),
        connectorTools,
        connectorToolReason,
      };
    });

    const tools = installedApplications.flatMap(
      (application) => application.connectorTools ?? [],
    );
    this.logger.log(
      JSON.stringify({
        event: "marketplace.runtime_context.built",
        dispatchId: dispatchId ?? null,
        workspaceId,
        agentId,
        installedAppSlugs: installedApplications.map(
          (application) => application.appSlug,
        ),
        connectionIds: installedApplications
          .map((application) => application.connectionLayer?.id)
          .filter(Boolean),
        toolCount: tools.length,
        toolNames: tools.map((tool) => tool.name),
        linkcrestAgentApiDescriptorSent: tools.some((tool) => {
          const name =
            this.stringOrNull(tool.name) ??
            this.stringOrNull(tool.functionName);
          return [
            "linkcrest.agentApi",
            "linkcrest_agent_api",
            "linkcrest-agent-api",
            "agentApi",
          ].includes(name ?? "");
        }),
        linkcrestAgentApiAliasesSent: tools
          .map(
            (tool) =>
              this.stringOrNull(tool.name) ??
              this.stringOrNull(tool.functionName),
          )
          .filter((name): name is string =>
            [
              "linkcrest.agentApi",
              "linkcrest_agent_api",
              "linkcrest-agent-api",
              "agentApi",
            ].includes(name ?? ""),
          ),
        appDiagnostics: installedApplications.map((application) => {
          const metadata =
            application.connectionLayer?.metadata &&
            typeof application.connectionLayer.metadata === "object" &&
            !Array.isArray(application.connectionLayer.metadata)
              ? (application.connectionLayer.metadata as Record<
                  string,
                  unknown
                >)
              : {};
          return {
            appSlug: application.appSlug,
            connectionId: application.connectionLayer?.id ?? null,
            connectionStatus: application.connectionLayer?.status ?? null,
            tokenStatus: this.stringOrNull(metadata.tokenStatus),
            xHandlePresent: Boolean(this.stringOrNull(metadata.xHandle)),
            xUserIdPresent: Boolean(this.stringOrNull(metadata.xUserId)),
            connectorToolReason: application.connectorToolReason ?? null,
            selectedCapabilities: application.selectedCapabilities ?? [],
            runtimeRecoveryEnabled:
              application.localRuntimeLayer?.runtimeProfile
                ?.autoStartAllowed === true,
            runtimeProfileSourceHostId:
              application.localRuntimeLayer?.runtimeProfile?.sourceHostId ??
              null,
            toolsSent: (application.connectorTools ?? []).length,
            linkcrestAgentApiDescriptorSent: (
              application.connectorTools ?? []
            ).some((tool) => {
              const name =
                this.stringOrNull(tool.name) ??
                this.stringOrNull(tool.functionName);
              return [
                "linkcrest.agentApi",
                "linkcrest_agent_api",
                "linkcrest-agent-api",
                "agentApi",
              ].includes(name ?? "");
            }),
            reasonOmitted: this.isLinkCrestApp(application.appSlug)
              ? (application.connectorTools ?? []).some((tool) => {
                  const name =
                    this.stringOrNull(tool.name) ??
                    this.stringOrNull(tool.functionName);
                  return [
                    "linkcrest.agentApi",
                    "linkcrest_agent_api",
                    "linkcrest-agent-api",
                    "agentApi",
                  ].includes(name ?? "");
                })
                ? null
                : "linkcrest_agent_api_descriptor_not_built"
              : null,
          };
        }),
      }),
    );

    const primaryPolicy = mergeLocalAppAutonomyPolicies(
      installedApplications
        .map((application) => application.autonomyPolicy)
        .filter((policy): policy is NonNullable<typeof policy> =>
          Boolean(policy),
        ),
    );
    const primaryToolAvailability = this.mergeLocalAppToolAvailability(
      installedApplications
        .map((application) => application.toolAvailability)
        .filter(Boolean)
        .map((toolAvailability) => toolAvailability as Record<string, unknown>),
    );
    const toolPolicyMatrix = primaryPolicy
      ? this.buildLocalAppToolPolicyMatrix(
          primaryPolicy,
          primaryToolAvailability,
        )
      : undefined;
    const legacyPrimaryPolicy = installedApplications.find(
      (application) => application.autonomyPolicy,
    )?.autonomyPolicy;
    const runtimeInstruction = primaryPolicy
      ? localAppAutonomyRuntimeInstruction(
          primaryPolicy,
          primaryToolAvailability,
        )
      : undefined;
    const compactInstalledApplications = installedApplications.map(
      (application) => {
        const { connectorTools: _connectorTools, ...compact } = application;
        return compact;
      },
    );
    return {
      marketplaceRuntimeContext: {
        agentId,
        installedApplications: compactInstalledApplications,
        tools,
        toolCount: tools.length,
        toolNames: tools
          .map(
            (tool) =>
              this.stringOrNull(tool.name) ??
              this.stringOrNull(tool.functionName),
          )
          .filter((name): name is string => Boolean(name)),
        nativeRuntimeTools: nativeRuntimeToolNames,
        availableRuntimeTools: nativeRuntimeToolNames,
        ...(toolPolicyMatrix ? { toolPolicyMatrix } : {}),
        localAppRuntimeRecovery: {
          doctrine: localAppRuntimeRecoveryDoctrine(),
          bridgeActions: [
            "localApp.getRuntimeStatus",
            "localApp.ensureRunning",
            "localApp.start",
            "localApp.restart",
          ],
        },
      },
      ...(runtimeInstruction
        ? {
            runtimeInstruction,
            systemInstruction: runtimeInstruction,
            autonomyPolicy: primaryPolicy,
            configuredAutonomyPolicy: legacyPrimaryPolicy,
            ...(toolPolicyMatrix ? { toolPolicyMatrix } : {}),
          }
        : {}),
    };
  }

  private resolveMarketplaceRuntimeSelectedCapabilities(input: {
    appSlug: string;
    selectedCapabilities: string[];
    connection: MarketplaceConnectionEntity | null;
    connectorTools: Array<Record<string, unknown>>;
    installMetadata?: Record<string, unknown> | null;
  }) {
    const selected = new Set(input.selectedCapabilities);

    if (
      input.appSlug === "x" &&
      selected.has("draft") &&
      !this.isXReadOnlyPolicy(input.installMetadata, input.connection) &&
      this.xConnectionHasWriteScope(input.connection)
    ) {
      selected.add("write");
      selected.add("external_publish");
    }

    for (const capability of this.approvalRequiredCapabilitiesForTools(
      input.connectorTools,
    )) {
      if (input.selectedCapabilities.includes(capability)) {
        selected.add(capability);
      }
    }

    return Array.from(selected);
  }

  private approvalRequiredCapabilitiesForTools(
    connectorTools: Array<Record<string, unknown>>,
  ) {
    const capabilities = new Set<string>();
    for (const tool of connectorTools) {
      if (tool.approvalRequired !== true) continue;
      for (const key of ["platformCapability", "capability"]) {
        const capability = this.stringOrNull(tool[key]);
        if (capability) capabilities.add(capability);
      }
    }
    return Array.from(capabilities);
  }

  private mergeLocalAppToolAvailability(
    entries: Array<Record<string, unknown>>,
  ) {
    const merged: Record<string, unknown> = {};
    for (const entry of entries) {
      for (const [key, value] of Object.entries(entry)) {
        if (Array.isArray(value)) {
          merged[key] = Array.from(
            new Set([
              ...(Array.isArray(merged[key]) ? (merged[key] as unknown[]) : []),
              ...value,
            ]),
          );
        } else if (typeof value === "boolean") {
          merged[key] = Boolean(merged[key]) || value;
        } else if (merged[key] === undefined) {
          merged[key] = value;
        }
      }
    }
    return merged;
  }

  private buildLocalAppToolPolicyMatrix(
    policy: ReturnType<typeof normalizeLocalAppAutonomyPolicy>,
    toolAvailability: Record<string, unknown>,
  ) {
    const matrix: Record<string, { policy: string; tool: string }> = {};
    for (const [key, value] of Object.entries(policy.external)) {
      const capability = localAppPolicyCapabilityForExternalKey(
        key as keyof typeof policy.external,
      );
      matrix[capability] = {
        policy: value,
        tool: toolAvailability[key] === true ? "available" : "unavailable",
      };
    }
    for (const [key, value] of Object.entries(policy.lifecycleStatus)) {
      const capability = localAppPolicyCapabilityForLifecycleKey(
        key as keyof typeof policy.lifecycleStatus,
      );
      matrix[capability] = {
        policy: value,
        tool:
          toolAvailability[
            key === "markContacted" || key === "markSubmitted"
              ? "lifecycleContactedSubmitted"
              : "lifecycleLiveIndexed"
          ] === true
            ? "available"
            : "unavailable",
      };
    }
    return matrix;
  }

  private isXReadOnlyPolicy(
    installMetadata: Record<string, unknown> | null | undefined,
    connection: MarketplaceConnectionEntity | null,
  ) {
    const approvalProfileId =
      this.stringOrNull(installMetadata?.approvalProfileId) ??
      this.stringOrNull(connection?.metadata?.approvalProfileId);
    return approvalProfileId === "x_read_only";
  }

  private xConnectionHasWriteScope(
    connection: MarketplaceConnectionEntity | null,
  ) {
    const scopes = Array.isArray(connection?.metadata?.grantedScopes)
      ? connection.metadata.grantedScopes
      : [];
    return scopes.includes("tweet.write");
  }

  private buildLocalAppToolAvailability(
    selectedCapabilities: string[],
    policy: ReturnType<typeof normalizeLocalAppAutonomyPolicy>,
    connectorTools: Array<Record<string, unknown>>,
    nativeRuntimeToolNames: string[] = [],
  ) {
    const selected = new Set(selectedCapabilities);
    const toolNames = new Set(
      connectorTools
        .map(
          (tool) =>
            this.stringOrNull(tool.name) ??
            this.stringOrNull(tool.functionName),
        )
        .filter((value): value is string => Boolean(value)),
    );
    for (const toolName of nativeRuntimeToolNames) {
      toolNames.add(toolName);
    }
    const availableByCapability = (capability: string) =>
      selected.has(capability) &&
      (connectorTools.length > 0 || selected.has("write_internal"));
    const hasBrowserRuntimeTools = HERMES_BROWSER_TOOL_NAMES.every((toolName) =>
      toolNames.has(toolName),
    );
    return {
      browserNavigation:
        hasBrowserRuntimeTools ||
        (selected.has("browser_external") &&
          availableByCapability("browser_external")),
      externalSearch: availableByCapability("external_search"),
      publicFormFill:
        hasBrowserRuntimeTools ||
        (selected.has("form_fill") && availableByCapability("form_fill")),
      publicFormSubmit:
        hasBrowserRuntimeTools ||
        (selected.has("form_submit") && availableByCapability("form_submit")),
      emailDraft: availableByCapability("email_draft"),
      emailSend: availableByCapability("email_send"),
      accountCreation: availableByCapability("account_create"),
      credentialUse: availableByCapability("credential_use"),
      externalPublishing: availableByCapability("external_publish"),
      backlinkVerification: availableByCapability("backlink_verify"),
      indexChecking: availableByCapability("index_check"),
      lifecycleContactedSubmitted: selected.has(
        "lifecycle_contacted_submitted",
      ),
      lifecycleLiveIndexed: selected.has("lifecycle_live_indexed"),
      connectorToolNames: Array.from(toolNames),
      nativeRuntimeToolNames,
      policyMode: policy.mode,
    };
  }

  private resolveNativeRuntimeToolNames(
    binding: RuntimeBindingEntity,
  ): string[] {
    if (binding.runtimeType !== "hermes") {
      return [];
    }
    const disabledToolsets = this.stringList(
      binding.configMetadata?.disabledToolsets,
    );
    const explicitlyDisabled =
      disabledToolsets.includes("browser") ||
      binding.capabilities?.browserDisabled === true ||
      binding.capabilities?.browserSupportDisabled === true ||
      binding.configMetadata?.browserDisabled === true ||
      binding.configMetadata?.browserSupportDisabled === true;
    if (explicitlyDisabled) {
      return [];
    }
    const adapterKind = binding.adapterKind?.trim().toLowerCase();
    const bridgeBacked =
      adapterKind === "hermes_bridge" ||
      adapterKind === "bridge" ||
      binding.capabilities?.bridgeBacked === true;
    const browserEnabled =
      bridgeBacked ||
      binding.capabilities?.browserSupport === true ||
      binding.capabilities?.browser === true ||
      this.stringList(binding.configMetadata?.enabledToolsets).includes(
        "browser",
      );
    return [
      ...HERMES_NATIVE_BASE_HARNESS_TOOLS,
      ...(browserEnabled ? [...HERMES_BROWSER_TOOL_NAMES] : []),
    ];
  }

  private boundRuntimeRecentMessages(
    recentMessages: Array<Record<string, unknown>>,
    saved: MessageEntity,
    runtimeBinding: RuntimeBindingEntity,
  ) {
    if (!this.shouldSendRuntimeRecentMessages(runtimeBinding)) {
      return [];
    }

    const configuredLimit = this.numberOrNull(
      runtimeBinding.configMetadata?.recentMessagesLimit,
    );
    const defaultLimit = this.isTrivialRuntimeTurn(saved)
      ? DEFAULT_TRIVIAL_RUNTIME_RECENT_MESSAGES_LIMIT
      : DEFAULT_RUNTIME_RECENT_MESSAGES_LIMIT;
    const limit = Math.max(
      0,
      Math.min(
        MAX_RUNTIME_RECENT_MESSAGES_LIMIT,
        configuredLimit ?? defaultLimit,
      ),
    );
    if (limit <= 0) return [];

    const configuredCharBudget = this.numberOrNull(
      runtimeBinding.configMetadata?.recentMessagesCharBudget,
    );
    const defaultCharBudget = this.isTrivialRuntimeTurn(saved)
      ? DEFAULT_TRIVIAL_RUNTIME_RECENT_MESSAGES_CHAR_BUDGET
      : DEFAULT_RUNTIME_RECENT_MESSAGES_CHAR_BUDGET;
    const charBudget = Math.max(
      0,
      Math.min(
        MAX_RUNTIME_RECENT_MESSAGES_CHAR_BUDGET,
        configuredCharBudget ?? defaultCharBudget,
      ),
    );

    return this.compactRuntimeRecentMessageContent(
      recentMessages.slice(-limit),
      charBudget,
    );
  }

  private shouldSendRuntimeRecentMessages(
    runtimeBinding: RuntimeBindingEntity,
  ) {
    if (!this.isHermesBridgeRuntimeBinding(runtimeBinding)) {
      return true;
    }
    return (
      runtimeBinding.configMetadata?.sendRecentMessagesToHermesBridge === true
    );
  }

  private isHermesBridgeRuntimeBinding(runtimeBinding: RuntimeBindingEntity) {
    if (runtimeBinding.runtimeType !== "hermes") {
      return false;
    }
    const adapterKind = runtimeBinding.adapterKind?.trim().toLowerCase();
    return (
      adapterKind === "hermes_bridge" ||
      adapterKind === "bridge" ||
      runtimeBinding.capabilities?.bridgeBacked === true
    );
  }

  private isTrivialRuntimeTurn(saved: MessageEntity) {
    const content = saved.content.trim();
    const attachments = Array.isArray(saved.attachments)
      ? saved.attachments
      : [];
    return content.length <= 64 && attachments.length === 0;
  }

  private numberOrNull(value: unknown) {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return Math.trunc(value);
  }

  private compactRuntimeRecentMessageContent(
    recentMessages: Array<Record<string, unknown>>,
    charBudget: number,
  ) {
    let remaining = charBudget;
    const compacted = recentMessages.map((message) => ({ ...message }));

    for (let index = compacted.length - 1; index >= 0; index -= 1) {
      const content = compacted[index].content;
      if (typeof content !== "string") continue;

      if (remaining <= 0) {
        compacted[index].content =
          "[older message content omitted by ClawChat recent-message budget]";
        continue;
      }

      if (content.length <= remaining) {
        remaining -= content.length;
        continue;
      }

      const marker = `\n\n[truncated ${content.length - remaining} chars by ClawChat recent-message budget]`;
      const excerptLength = Math.max(0, remaining - marker.length);
      compacted[index].content = `${content.slice(0, excerptLength)}${marker}`;
      remaining = 0;
    }

    return compacted;
  }

  private stringList(value: unknown): string[] {
    return Array.isArray(value)
      ? value
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];
  }

  private buildMarketplaceConnectorTools(input: {
    workspaceId: string;
    appSlug: string;
    connection: MarketplaceConnectionEntity | null;
    linkedApp?: LinkedApplicationEntity | null;
    selectedCapabilities?: string[];
    installMetadata?: Record<string, unknown> | null;
  }) {
    if (input.appSlug !== "x") {
      const manifest = this.marketplaceConnectorRegistry.get(input.appSlug);
      if (manifest) {
        return this.buildStandardConnectorTools(input, manifest);
      }
      return this.buildLocalRepoConnectorTools(input);
    }
    if (!this.isXConnectionUsable(input.connection)) return [];

    const bridgePath = `/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/x`;
    const base = {
      appSlug: "x",
      provider: "x",
      connectionId: input.connection.id,
      workspaceId: input.workspaceId,
      authorizedAccount: {
        xUserId: this.stringOrNull(input.connection.metadata?.xUserId),
        xHandle: this.stringOrNull(input.connection.metadata?.xHandle),
        tokenStatus: this.stringOrNull(input.connection.metadata?.tokenStatus),
      },
      auth: "clawchat_connector_token_proxy",
      tokenExposure: "never_exposed_to_agent",
      execution: {
        transport: "clawchat_bridge_marketplace_tool",
        endpointBasePath: bridgePath,
        requiresBridgeAccessToken: true,
      },
    };

    const selected = new Set(input.selectedCapabilities ?? []);
    const canRead = selected.has("read");
    const canPublish =
      selected.has("write") || selected.has("external_publish");
    const tools = [
      {
        ...base,
        name: "x.getMe",
        functionName: "x_get_me",
        capability: "read",
        platformCapability: "read",
        action: "read",
        description:
          "Read the authorized X account profile for this connection.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        ...base,
        name: "x.getUser",
        functionName: "x_get_user",
        capability: "read",
        platformCapability: "read",
        action: "read",
        description: "Read an X user by id or username.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      {
        ...base,
        name: "x.getTweets",
        functionName: "x_get_tweets",
        capability: "read",
        platformCapability: "read",
        action: "read",
        description: "Read X posts by comma-separated tweet ids.",
        inputSchema: {
          type: "object",
          properties: { ids: { type: "string" } },
          required: ["ids"],
          additionalProperties: false,
        },
      },
      {
        ...base,
        name: "x.getUserTweets",
        functionName: "x_get_user_tweets",
        capability: "read",
        platformCapability: "read",
        action: "read",
        description:
          "Read recent X posts. If xUserId is omitted, read posts for the authorized X account on this connection.",
        inputSchema: {
          type: "object",
          properties: { xUserId: { type: "string" } },
          additionalProperties: false,
        },
      },
      {
        ...base,
        name: "x.getMentions",
        functionName: "x_get_mentions",
        capability: "read",
        platformCapability: "read",
        action: "read",
        description:
          "Read mentions. If xUserId is omitted, read mentions for the authorized X account on this connection.",
        inputSchema: {
          type: "object",
          properties: { xUserId: { type: "string" } },
          additionalProperties: false,
        },
      },
      {
        ...base,
        name: "x.requestPostApproval",
        functionName: "x_request_post_approval",
        capability: "write",
        platformCapability: "external_publish",
        action: "approval_request",
        approvalRequired: false,
        description:
          "Create a pending ClawChat approval request before posting, replying, or deleting on X. Use action post_tweet for new posts, reply for replies, or delete_tweet for deletes. If action is omitted, post_tweet is assumed.",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["post_tweet", "reply", "delete_tweet"],
              default: "post_tweet",
              description:
                "Approval action. Use post_tweet before x_post_tweet.",
            },
            text: {
              type: "string",
              description:
                "Exact text that will be posted or replied with. Must match the write call.",
            },
            mediaIds: {
              type: "array",
              items: { type: "string" },
              description: "Optional X media ids. Must match the write call.",
            },
            replyTargetTweetId: {
              type: "string",
              description: "Required when action is reply.",
            },
            targetTweetId: {
              type: "string",
              description: "Required when action is delete_tweet.",
            },
            policyProfile: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      {
        ...base,
        name: "x.postTweet",
        functionName: "x_post_tweet",
        capability: "write",
        platformCapability: "external_publish",
        action: "write",
        approvalRequired: true,
        description:
          "Post to X only with a matching approved ClawChat approval id.",
        inputSchema: {
          type: "object",
          properties: {
            approvalId: {
              type: "string",
              description:
                "Approved ClawChat approval id returned by x_request_post_approval after user approval.",
            },
            text: {
              type: "string",
              description: "Exact tweet text. Must match the approved request.",
            },
            mediaIds: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["approvalId"],
          additionalProperties: false,
        },
      },
      {
        ...base,
        name: "x.replyToTweet",
        functionName: "x_reply_to_tweet",
        capability: "write",
        platformCapability: "external_publish",
        action: "write",
        approvalRequired: true,
        description:
          "Reply on X only with a matching approved ClawChat approval id.",
        inputSchema: {
          type: "object",
          properties: {
            approvalId: { type: "string" },
            tweetId: {
              type: "string",
              description:
                "Tweet id being replied to. Must match the approved replyTargetTweetId.",
            },
            text: { type: "string" },
            mediaIds: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["approvalId", "tweetId"],
          additionalProperties: false,
        },
      },
      {
        ...base,
        name: "x.deleteTweet",
        functionName: "x_delete_tweet",
        capability: "write",
        platformCapability: "external_publish",
        action: "write",
        approvalRequired: true,
        description:
          "Delete an own X post only with a matching approved ClawChat approval id.",
        inputSchema: {
          type: "object",
          properties: {
            approvalId: { type: "string" },
            tweetId: {
              type: "string",
              description:
                "Own tweet id to delete. Must match the approved targetTweetId.",
            },
          },
          required: ["approvalId", "tweetId"],
          additionalProperties: false,
        },
      },
    ];
    return tools.filter((tool) =>
      tool.action === "read"
        ? canRead
        : tool.action === "approval_request" || tool.action === "write"
          ? canPublish
          : true,
    );
  }

  private buildStandardConnectorTools(
    input: {
      workspaceId: string;
      appSlug: string;
      connection: MarketplaceConnectionEntity | null;
      selectedCapabilities?: string[];
      installMetadata?: Record<string, unknown> | null;
    },
    manifest: MarketplaceConnectorManifest,
  ) {
    if (!input.connection || input.connection.status !== "ready") return [];
    const selected = new Set(
      input.selectedCapabilities ?? input.connection.selectedCapabilities ?? [],
    );
    const skipApprovals = this.isDangerouslySkipPermissionsInstall(
      input.installMetadata,
    );
    const providerGranted =
      manifest.slug === OUTLOOK_CONNECTOR_MANIFEST.slug
        ? new Set(this.outlookProviderGrantedCapabilities(input.connection))
        : null;
    const bridgePath = `/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/${manifest.slug}`;
    const toolStates = manifest.tools.map((tool) => {
      const installSelected =
        selected.has(tool.capability) ||
        selected.has(tool.platformCapability) ||
        (selected.has("write") && tool.capability === "email_draft");
      const providerSelected =
        !providerGranted ||
        providerGranted.has(tool.capability) ||
        providerGranted.has(tool.platformCapability);
      return {
        tool,
        installSelected,
        providerSelected,
        filteredReason: !installSelected
          ? "install_capability_missing"
          : !providerSelected
            ? "provider_scope_missing"
            : null,
      };
    });
    const descriptors = toolStates
      .filter((state) => state.installSelected && state.providerSelected)
      .map(({ tool }) => {
        const approvalSkippable =
          tool.approvalRequired &&
          skipApprovals &&
          this.isDangerouslySkippableStandardConnectorTool(
            manifest.slug,
            tool.name,
          );
        return {
          name: tool.name,
          functionName: tool.functionName,
          aliases: tool.aliases,
          appSlug: manifest.slug,
          provider: manifest.slug,
          connectionId: input.connection!.id,
          workspaceId: input.workspaceId,
          capability: tool.capability,
          platformCapability: tool.platformCapability,
          action: tool.action,
          approvalRequired: tool.approvalRequired && !approvalSkippable,
          description: approvalSkippable
            ? this.dangerouslySkippedConnectorDescription(manifest.slug, tool)
            : tool.description,
          inputSchema: approvalSkippable
            ? this.withoutApprovalIdRequirement(tool.inputSchema)
            : tool.inputSchema,
          auth: "clawchat_connector_token_proxy",
          tokenExposure: "never_exposed_to_agent",
          credential: {
            secretRef: `${manifest.slug}:${input.connection!.id}`,
            secretMaterialSentToHermes: false,
          },
          execution: {
            transport: "clawchat_bridge_marketplace_tool",
            endpointBasePath: bridgePath,
            requiresBridgeAccessToken: true,
            credentialAttachment: "server_side_token_proxy",
          },
        };
      });
    this.logger.log(
      JSON.stringify({
        event: "marketplace.runtime.standard_connector_tools",
        appSlug: manifest.slug,
        connectionId: input.connection.id,
        selectedCapabilities: Array.from(selected),
        providerCapabilities: providerGranted
          ? Array.from(providerGranted)
          : null,
        approvalPolicy: skipApprovals
          ? "dangerously_skip_permissions"
          : "default",
        toolStates: toolStates.map((state) => ({
          name: state.tool.name,
          functionName: state.tool.functionName,
          capability: state.tool.capability,
          platformCapability: state.tool.platformCapability,
          approvalRequired: state.tool.approvalRequired,
          filteredReason: state.filteredReason,
        })),
        finalTools: descriptors.map((tool) => tool.functionName),
      }),
    );
    return descriptors;
  }

  private outlookProviderGrantedCapabilities(
    connection: MarketplaceConnectionEntity,
  ) {
    const granted = new Set(
      this.stringList(connection.metadata?.grantedScopes),
    );
    const capabilities = new Set<string>();
    if (granted.has("Mail.Read")) {
      capabilities.add("mail_folders_list");
      capabilities.add("inbox_messages_list");
      capabilities.add("unread_messages_list");
      capabilities.add("message_get");
    }
    return Array.from(capabilities);
  }

  private isDangerouslySkippableStandardConnectorTool(
    appSlug: string,
    toolName: string,
  ) {
    if (appSlug !== OUTLOOK_CONNECTOR_MANIFEST.slug) return true;
    return new Set([
      "outlook.createMailFolder",
      "outlook.moveMessage",
      "outlook.archiveMessage",
      "outlook.markMessageRead",
      "outlook.applyCategories",
      "outlook.createCategory",
      "outlook.sendApprovedEmail",
      "outlook.reply",
      "outlook.forward",
    ]).has(toolName);
  }

  private dangerouslySkippedConnectorDescription(
    appSlug: string,
    tool: MarketplaceConnectorManifest["tools"][number],
  ) {
    if (appSlug !== OUTLOOK_CONNECTOR_MANIFEST.slug) {
      return `${tool.description} ClawChat per-action approval is skipped by the selected marketplace policy; server-side hard checks still apply.`;
    }
    const hardChecks =
      "ClawChat approval is skipped for this installed agent/app policy. Hard checks still apply: valid Outlook connection, selected install capability, verified sender identity where relevant, Microsoft Graph permissions, server-side token handling, no arbitrary runtime from address, and blocked actions remain blocked.";
    if (tool.name === "outlook.sendApprovedEmail") {
      return `Send an Outlook email or draft using the verified sender identity. ${hardChecks}`;
    }
    if (tool.name === "outlook.reply") {
      return `Reply to a selected Outlook message using the verified sender identity. ${hardChecks}`;
    }
    if (tool.name === "outlook.forward") {
      return `Forward a selected Outlook message using the verified sender identity. ${hardChecks}`;
    }
    return `${tool.description.replace(/approval-gated/gi, "policy-controlled").replace(/approved /gi, "")} ${hardChecks}`;
  }

  private withoutApprovalIdRequirement(schema: Record<string, unknown>) {
    const required = Array.isArray(schema.required)
      ? schema.required.filter((item) => item !== "approvalId")
      : undefined;
    return {
      ...schema,
      ...(required ? { required } : {}),
    };
  }

  private isDangerouslySkipPermissionsInstall(
    installMetadata: Record<string, unknown> | null | undefined,
  ) {
    return (
      isDangerouslySkipPermissionsPolicy(installMetadata?.approvalProfileId) ||
      isDangerouslySkipPermissionsPolicy(installMetadata?.permissionPolicyId)
    );
  }

  private buildLocalRepoConnectorTools(input: {
    workspaceId: string;
    appSlug: string;
    connection: MarketplaceConnectionEntity | null;
    linkedApp?: LinkedApplicationEntity | null;
    selectedCapabilities?: string[];
  }) {
    const capabilities = new Set(input.selectedCapabilities ?? []);
    if (!capabilities.size) return [];
    const bridgePath = `/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/local-repo/${input.appSlug}`;
    const descriptors: Array<Record<string, unknown>> = [];
    const add = (capability: string, name: string, description: string) => {
      if (!capabilities.has(capability)) return;
      descriptors.push({
        name,
        appSlug: input.appSlug,
        provider: "local_repo",
        connectionId: input.connection?.id ?? null,
        workspaceId: input.workspaceId,
        capability,
        description,
        auth: "clawchat_local_repo_runtime_context",
        tokenExposure: "never_exposed_to_agent",
        execution: {
          transport: "clawchat_bridge_marketplace_tool_descriptor",
          endpointBasePath: bridgePath,
          requiresBridgeAccessToken: true,
          descriptorOnly: true,
        },
      });
    };
    add(
      "write_internal",
      "local_repo.writeInternalRecord",
      "Write/update internal local app records through documented app operations.",
    );
    add(
      "form_submit",
      "local_repo.submitPublicForm",
      "Submit public forms when Hermes provides a compatible browser/form tool.",
    );
    add(
      "email_send",
      "local_repo.sendEmail",
      "Send configured email outreach when Hermes provides an email tool and sender identity.",
    );
    add(
      "external_publish",
      "local_repo.publishExternal",
      "Publish externally when a compatible publishing tool is configured.",
    );
    add(
      "backlink_verify",
      "local_repo.verifyBacklink",
      "Verify backlink/live state when a verification tool is configured.",
    );
    add(
      "index_check",
      "local_repo.checkIndex",
      "Check indexed state when an index checking tool is configured.",
    );
    if (this.isLinkCrestApp(input.appSlug, input.linkedApp)) {
      descriptors.push(
        ...this.buildLinkCrestAgentApiTools({
          workspaceId: input.workspaceId,
          appSlug: input.appSlug,
          linkedApp: input.linkedApp ?? null,
          selectedCapabilities: input.selectedCapabilities ?? [],
        }),
      );
    }
    descriptors.push(...this.buildLocalAppRuntimeTools(input));
    return descriptors;
  }

  private buildLocalAppRuntimeTools(input: {
    workspaceId: string;
    appSlug: string;
    connection: MarketplaceConnectionEntity | null;
    linkedApp?: LinkedApplicationEntity | null;
    selectedCapabilities?: string[];
  }) {
    if (!input.linkedApp) return [];
    const metadata = input.linkedApp.metadata ?? {};
    const apiMetadata = input.linkedApp.apiStyleMetadata ?? {};
    const runtimeProfile = resolveLocalAppRuntimeProfile({
      appSlug: input.appSlug,
      appName: input.linkedApp.name,
      repoPath: input.linkedApp.repoPath,
      metadata,
      apiStyleMetadata: apiMetadata,
      connectionMetadata: input.connection?.metadata ?? null,
    });
    const sourceHostType =
      this.stringOrNull(input.connection?.metadata?.sourceHostType) ??
      this.stringOrNull(metadata.sourceHostType) ??
      this.stringOrNull(apiMetadata.sourceHostType);
    const sourceHostId =
      this.stringOrNull(input.connection?.metadata?.sourceHostId) ??
      this.stringOrNull(input.connection?.metadata?.bridgeDeviceId) ??
      this.stringOrNull(metadata.sourceHostId) ??
      this.stringOrNull(metadata.bridgeDeviceId) ??
      this.stringOrNull(apiMetadata.sourceHostId) ??
      this.stringOrNull(apiMetadata.bridgeDeviceId);
    if (
      !runtimeProfile.repoPath &&
      !runtimeProfile.appUrl &&
      !runtimeProfile.healthCheckUrl
    ) {
      return [];
    }
    const endpointBasePath = `/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/${input.appSlug}`;
    const base = {
      appSlug: input.appSlug,
      provider: "registered_local_app_runtime",
      connectionId: input.connection?.id ?? null,
      workspaceId: input.workspaceId,
      capability: "local_app_runtime",
      action: "runtime",
      approvalRequired: false,
      auth: "clawchat_registered_local_app_runtime_proxy",
      tokenExposure: "never_exposed_to_agent",
      runtimeProfile: this.safeRuntimeProfile(runtimeProfile),
      sourceHost: {
        type: sourceHostType,
        id: sourceHostId,
      },
      execution: {
        transport: "clawchat_bridge_marketplace_tool",
        endpointBasePath,
        requiresBridgeAccessToken: true,
        credentialAttachment: "none",
      },
    };
    return [
      localAppTool(
        base,
        "localApp.status",
        "localApp_status",
        "Read registered local app runtime status from the approved source host.",
        {},
      ),
      localAppTool(
        base,
        "localApp.inspectConfig",
        "localApp_inspect_config",
        "Inspect redacted registered local app runtime configuration known to ClawChat.",
        {},
      ),
      localAppTool(
        base,
        "localApp.start",
        "localApp_start",
        "Start the registered local app using its approved package-manager start script only.",
        { approvalId: { type: "string" } },
        true,
      ),
      localAppTool(
        base,
        "localApp.restart",
        "localApp_restart",
        "Restart the registered local app using approved package-manager scripts only.",
        { approvalId: { type: "string" } },
        true,
      ),
      localAppTool(
        base,
        "localApp.healthCheck",
        "localApp_health_check",
        "Run the registered local app health checks from the approved source host.",
        {},
      ),
      localAppTool(
        base,
        "localApp.tailLogs",
        "localApp_tail_logs",
        "Read a short redacted tail of registered local app logs from the approved source host.",
        { lines: { type: "number", minimum: 1, maximum: 200, default: 80 } },
      ),
      localAppTool(
        base,
        "localApp.explainRecoveryFailure",
        "localApp_explain_recovery_failure",
        "Explain why registered local app runtime recovery is blocked or failing.",
        {},
      ),
    ];
  }

  private buildLinkCrestAgentApiTools(input: {
    workspaceId: string;
    appSlug: string;
    linkedApp: LinkedApplicationEntity | null;
    selectedCapabilities: string[];
  }) {
    const metadata = input.linkedApp?.metadata ?? {};
    const apiMetadata = input.linkedApp?.apiStyleMetadata ?? {};
    const runtimeProfile = resolveLocalAppRuntimeProfile({
      appSlug: input.appSlug,
      appName: input.linkedApp?.name ?? null,
      repoPath: input.linkedApp?.repoPath ?? null,
      metadata,
      apiStyleMetadata: apiMetadata,
    });
    const connectionId =
      this.stringOrNull(metadata.linkcrestOpenClawConnectionId) ??
      this.stringOrNull(apiMetadata.linkcrestOpenClawConnectionId);
    const baseUrl =
      this.stringOrNull(metadata.linkcrestOpenClawBaseUrl) ??
      this.stringOrNull(apiMetadata.linkcrestOpenClawBaseUrl) ??
      this.stringOrNull(metadata.localApiUrl) ??
      this.stringOrNull(apiMetadata.localApiUrl);
    const status =
      metadata.linkcrestOpenClawStatus &&
      typeof metadata.linkcrestOpenClawStatus === "object" &&
      !Array.isArray(metadata.linkcrestOpenClawStatus)
        ? (metadata.linkcrestOpenClawStatus as Record<string, unknown>)
        : apiMetadata.linkcrestOpenClawStatus &&
            typeof apiMetadata.linkcrestOpenClawStatus === "object" &&
            !Array.isArray(apiMetadata.linkcrestOpenClawStatus)
          ? (apiMetadata.linkcrestOpenClawStatus as Record<string, unknown>)
          : {};
    const endpointBasePath = `/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/${input.appSlug}`;
    const dedicatedEndpointBasePath = `/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/linkcrest-agent-api/${input.appSlug}`;
    const base = {
      appSlug: input.appSlug,
      provider: "linkcrest_agent_api",
      connectionId,
      workspaceId: input.workspaceId,
      auth: "clawchat_linkcrest_agent_api_proxy",
      tokenExposure: "never_exposed_to_agent",
      credential: {
        bearerConfigured: status.hasBearerKey === true || Boolean(connectionId),
        secretRef: connectionId
          ? `linkcrest-agent-api:${connectionId}`
          : "linkcrest-agent-api:missing",
        secretFetchEndpoint: `${dedicatedEndpointBasePath}/_runtime-secret/fetch`,
        secretMaterialSentToHermes: false,
      },
      linkcrest: {
        baseUrl,
        campaignId:
          this.stringOrNull(metadata.linkcrestCampaignId) ??
          this.stringOrNull(apiMetadata.linkcrestCampaignId),
        campaignName:
          this.stringOrNull(metadata.linkcrestCampaignName) ??
          this.stringOrNull(apiMetadata.linkcrestCampaignName),
        policySync:
          metadata.linkcrestPolicySync &&
          typeof metadata.linkcrestPolicySync === "object" &&
          !Array.isArray(metadata.linkcrestPolicySync)
            ? metadata.linkcrestPolicySync
            : null,
      },
      runtimeProfile,
      runtimeRecovery: {
        enabled: runtimeProfile.autoStartAllowed === true,
        unreachableBehavior:
          "request_source_host_runtime_recovery_before_final_failure",
        bridgeActions: [
          "localApp.getRuntimeStatus",
          "localApp.ensureRunning",
          "localApp.start",
          "localApp.restart",
        ],
        doctrine: localAppRuntimeRecoveryDoctrine(),
      },
      execution: {
        transport: "clawchat_bridge_marketplace_tool",
        endpointBasePath,
        legacyEndpointBasePath: dedicatedEndpointBasePath,
        requiresBridgeAccessToken: true,
        credentialAttachment: "server_side_bearer_proxy",
        localDirectCredential: "fetch_runtime_secret_with_bridge_token",
      },
    };
    const aliases = [
      { name: "linkcrest.agentApi", functionName: "linkcrest_agent_api" },
      { name: "linkcrest_agent_api", functionName: "linkcrest_agent_api" },
      { name: "linkcrest-agent-api", functionName: "linkcrest_agent_api" },
      { name: "agentApi", functionName: "linkcrest_agent_api" },
    ];
    return aliases.map((alias) => ({
      ...base,
      name: alias.name,
      functionName: alias.functionName,
      aliases: aliases.map((entry) => entry.name),
      action: "agent_api",
      capability: "linkcrest_openclaw_tools",
      description:
        "Call the LinkCrest Agent API through ClawChat. ClawChat attaches the stored bearer server-side; never ask for or print the bearer token.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST"], default: "GET" },
          path: {
            type: "string",
            description:
              "Path under /api/openclaw, for example settings, campaigns, tasks, autonomy/get_policy, autonomy/explain_effective_policy, tasks/claim, tasks/complete, tasks/fail, or tasks/route_blocker.",
          },
          query: { type: "object", additionalProperties: true },
          input: { type: "object", additionalProperties: true },
          contractVersion: { type: "string", default: "2026-03-18" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    }));
  }

  private isLinkCrestApp(
    appSlug: string,
    linkedApp?: LinkedApplicationEntity | null,
  ) {
    const haystack =
      `${appSlug} ${linkedApp?.name ?? ""} ${linkedApp?.slug ?? ""}`.toLowerCase();
    return haystack.includes("linkcrest");
  }

  private isXConnectionUsable(connection: MarketplaceConnectionEntity | null) {
    if (!connection) return false;
    if (connection.status === "ready") return true;
    return this.stringOrNull(connection.metadata?.tokenStatus) === "valid";
  }

  private describeXToolEligibility(
    connection: MarketplaceConnectionEntity | null,
  ) {
    if (!connection) return "missing_connection";
    if (connection.status === "ready") return "eligible";
    const tokenStatus = this.stringOrNull(connection.metadata?.tokenStatus);
    if (tokenStatus === "valid") return "eligible_by_valid_token";
    return `connection_not_ready:${connection.status}:token_${tokenStatus ?? "missing"}`;
  }

  private safeRuntimeProfile(
    profile: ReturnType<typeof resolveLocalAppRuntimeProfile>,
  ) {
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

  private sanitizeConnectionMetadataForDispatch(
    metadata: Record<string, unknown>,
  ) {
    return {
      sourceHostType: this.stringOrNull(metadata.sourceHostType),
      sourceHostId: this.stringOrNull(metadata.sourceHostId),
      bridgeDeviceId: this.stringOrNull(metadata.bridgeDeviceId),
      runtimeBindingId: this.stringOrNull(metadata.runtimeBindingId),
      sourceHostLabel: this.stringOrNull(metadata.sourceHostLabel),
      runtimeType: this.stringOrNull(metadata.runtimeType),
      localRepoPath: this.stringOrNull(metadata.localRepoPath),
      appSlug: this.stringOrNull(metadata.appSlug),
      localAppUrl: this.stringOrNull(metadata.localAppUrl),
      localApiUrl: this.stringOrNull(metadata.localApiUrl),
      convexSiteUrl: this.stringOrNull(metadata.convexSiteUrl),
      allowRuntimeHostStart: metadata.allowRuntimeHostStart === true,
      lifecycleApprovalPolicy: this.stringOrNull(
        metadata.lifecycleApprovalPolicy,
      ),
      provider: this.stringOrNull(metadata.provider),
      xUserId: this.stringOrNull(metadata.xUserId),
      xHandle: this.stringOrNull(metadata.xHandle),
      tokenStatus: this.stringOrNull(metadata.tokenStatus),
      grantedScopes: Array.isArray(metadata.grantedScopes)
        ? metadata.grantedScopes.filter((scope) => typeof scope === "string")
        : [],
    };
  }

  private groupBridgeTargetsByPresentation<
    T extends { externalAgentId: string; responsePresentation?: string | null },
  >(targets: T[]) {
    const groups = new Map<
      string,
      { responsePresentation: string; externalAgentIds: string[] }
    >();
    for (const target of targets) {
      const key =
        target.responsePresentation === "html_native"
          ? "html_native"
          : "standard";
      const group = groups.get(key) ?? {
        responsePresentation: key,
        externalAgentIds: [],
      };
      group.externalAgentIds.push(target.externalAgentId);
      groups.set(key, group);
    }
    return Array.from(groups.values());
  }

  private stringOrNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private objectOrNull(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  async update(
    id: string,
    data: Partial<MessageEntity>,
  ): Promise<MessageEntity> {
    const msg = await this.findOne(id);
    Object.assign(msg, data, { isEdited: true });
    return this.messageRepo.save(msg);
  }

  async delete(id: string): Promise<void> {
    await this.messageRepo.delete(id);
  }

  async createEmbeddedCard(
    threadId: string,
    card: any,
    agentId: string,
  ): Promise<MessageEntity> {
    const agent = await this.agentRepo.findOne({
      where: { id: agentId } as any,
    });
    return this.injectMessage(threadId, {
      senderId: agentId,
      senderName: agent?.name || "Agent",
      senderAvatarUrl: agent?.avatarUrl || null,
      content: card.title || "Card",
      type: "embedded_card",
      embeddedCard: card,
      provenance: MessageProvenance.AGENT,
      isFromUser: false,
      metadata: {
        traceType: "embedded_card",
      },
    });
  }

  async sendSystemMessage(
    threadId: string,
    content: string,
  ): Promise<MessageEntity> {
    return this.injectMessage(
      threadId,
      {
        senderId: "system",
        senderName: "System",
        content,
        type: "system",
        provenance: MessageProvenance.MEETING_SYSTEM,
        isFromUser: false,
        metadata: {
          traceType: "system_message",
        },
      },
      { routeToAgents: false },
    );
  }

  private async createCanonicalMessage(
    threadId: string,
    data: CanonicalMessageInput,
    options: CanonicalMessageOptions,
  ): Promise<MessageEntity> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.status === "archived") {
      throw new BadRequestException("Thread is archived");
    }
    const activeSession =
      await this.threadSessionService.ensureActiveSession(thread);

    const provenance =
      data.provenance ??
      (data.isFromUser ? MessageProvenance.USER : MessageProvenance.AGENT);

    const attachments = this.normalizeMessageAttachments(
      data.attachments,
      thread,
    );

    const message = this.messageRepo.create({
      ...data,
      attachments,
      threadId,
      threadSessionId: activeSession.id,
      type: data.type || "text",
      contentFormat: data.contentFormat || MESSAGE_CONTENT_FORMAT_MARKDOWN,
      provenance,
      metadata: data.metadata ?? null,
      isFromUser: data.isFromUser ?? false,
    });
    const saved = await this.messageRepo.save(message);

    await this.threadRepo.update(threadId, {
      lastMessage: {
        id: saved.id,
        content: buildThreadLastMessagePreview(saved.content),
        senderId: saved.senderId,
        senderName: saved.senderName,
        senderAvatarUrl: saved.senderAvatarUrl,
        createdAt: saved.createdAt,
        provenance: saved.provenance,
      },
      updatedAt: new Date(),
    });

    const updatedThread = await this.threadRepo.findOne({
      where: { id: threadId },
    });

    this.eventsGateway.emitToScopes(
      {
        workspaceId: thread.workspaceId,
        threadId: thread.id,
      },
      "message.new",
      saved,
    );

    if (updatedThread) {
      this.eventsGateway.emitToScopes(
        {
          workspaceId: thread.workspaceId,
          threadId: thread.id,
        },
        "thread.update",
        updatedThread,
      );
    }

    await this.syncTaskLifecycleForMessage(thread, saved);

    void this.messageCondensingService.maybeEnqueueSummary(thread, saved);

    const shouldRouteToAgents =
      options.routeToAgents ??
      (saved.isFromUser ||
        (this.isSharedAgentThread(thread) &&
          saved.provenance === MessageProvenance.AGENT));

    if (shouldRouteToAgents) {
      if (options.routeToAgentsAsync) {
        void this.routeMessageToAgents(thread, saved).catch((error) => {
          this.logger.error(
            `Failed to route message ${saved.id} to agents after it was persisted: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      } else {
        await this.routeMessageToAgents(thread, saved);
      }
    } else if (!saved.isFromUser) {
      await this.stopTypingForThread(thread, saved.senderId);
    }

    return saved;
  }

  private async syncTaskLifecycleForMessage(
    thread: ThreadEntity,
    saved: MessageEntity,
  ) {
    const taskId =
      typeof saved.metadata?.taskId === "string" ? saved.metadata.taskId : null;

    if (taskId && saved.isFromUser) {
      await this.taskRepo.update(taskId, {
        status: "dispatched",
        threadId: thread.id,
        dispatchedMessageId: saved.id,
        lastDispatchedAt: saved.createdAt,
        lastError: null,
        cancelledAt: null,
        completedAt: null,
      });
      return;
    }

    if (saved.provenance !== MessageProvenance.AGENT) return;

    const task = await this.taskRepo
      .createQueryBuilder("task")
      .where('task."threadId" = :threadId', { threadId: thread.id })
      .andWhere("task.status IN (:...statuses)", {
        statuses: ["dispatched", "queued"],
      })
      .andWhere('task."lastDispatchedAt" IS NOT NULL')
      .orderBy('task."lastDispatchedAt"', "DESC")
      .getOne();

    if (!task?.lastDispatchedAt) return;

    if (
      new Date(task.lastDispatchedAt).getTime() <= saved.createdAt.getTime()
    ) {
      await this.taskRepo.update(task.id, { status: "running" });
    }
  }

  private normalizeMessageAttachments(
    value: unknown,
    thread: ThreadEntity,
  ): object[] {
    if (value === undefined || value === null) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new BadRequestException("Message attachments must be an array");
    }
    if (value.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      throw new BadRequestException(
        "Messages can include at most 10 attachments",
      );
    }

    return value.map((entry) => {
      if (!entry || typeof entry !== "object") {
        throw new BadRequestException("Message attachment metadata is invalid");
      }
      const attachment = entry as Record<string, unknown>;
      if (attachment.storage !== "openclaw_local") {
        throw new BadRequestException("Unsupported attachment storage");
      }
      const id = this.requiredAttachmentString(attachment, "id");
      const workspaceId = this.requiredAttachmentString(
        attachment,
        "workspaceId",
      );
      const attachmentThreadId = this.requiredAttachmentString(
        attachment,
        "threadId",
      );
      const bridgeDeviceId = this.requiredAttachmentString(
        attachment,
        "bridgeDeviceId",
      );
      const filename = this.requiredAttachmentString(attachment, "filename");
      const mimeType = this.requiredAttachmentString(attachment, "mimeType");
      const kind = this.requiredAttachmentString(attachment, "kind");
      const localMediaRef = this.requiredAttachmentString(
        attachment,
        "localMediaRef",
      );
      const createdAt = this.optionalAttachmentString(attachment, "createdAt");
      const sha256 = this.optionalAttachmentString(attachment, "sha256");
      const provenanceToken = this.requiredAttachmentString(
        attachment,
        OPENCLAW_ATTACHMENT_PROVENANCE_TOKEN_FIELD,
      );
      const sizeBytes =
        typeof attachment.sizeBytes === "number" &&
        Number.isFinite(attachment.sizeBytes) &&
        attachment.sizeBytes >= 0
          ? attachment.sizeBytes
          : null;
      if (sizeBytes === null) {
        throw new BadRequestException(
          "Message attachment metadata is incomplete",
        );
      }
      if (attachmentThreadId !== thread.id) {
        throw new BadRequestException(
          "Attachment does not belong to this thread",
        );
      }
      if (workspaceId !== thread.workspaceId) {
        throw new BadRequestException(
          "Attachment does not belong to this workspace",
        );
      }
      const verified = verifyOpenClawAttachmentProvenance(
        {
          id,
          workspaceId,
          threadId: attachmentThreadId,
          bridgeDeviceId,
          filename,
          mimeType,
          sizeBytes,
          sha256,
          kind,
          storage: "openclaw_local",
          localMediaRef,
          createdAt,
        },
        provenanceToken,
      );
      if (!verified) {
        throw new BadRequestException(
          "Attachment provenance could not be verified",
        );
      }

      return {
        id,
        workspaceId: thread.workspaceId,
        threadId: thread.id,
        messageId: null,
        bridgeDeviceId,
        filename,
        mimeType,
        sizeBytes,
        sha256: sha256 ?? undefined,
        kind,
        status: "attached",
        storage: "openclaw_local",
        localMediaRef,
        createdAt: createdAt ?? undefined,
      };
    });
  }

  private requiredAttachmentString(
    attachment: Record<string, unknown>,
    key: string,
  ) {
    const value = attachment[key];
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(
        "Message attachment metadata is incomplete",
      );
    }
    return value.trim();
  }

  private optionalAttachmentString(
    attachment: Record<string, unknown>,
    key: string,
  ) {
    const value = attachment[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private async routeMessageToAgents(
    thread: ThreadEntity,
    saved: MessageEntity,
  ) {
    if (
      !saved.isFromUser &&
      this.isSharedAgentThread(thread) &&
      !(await this.teamRelayAllowsFollowUp(thread, saved))
    ) {
      await this.stopTypingForThread(thread, saved.senderId);
      return;
    }

    const effectiveAgents = await this.threadMembershipService.listMemberAgents(
      thread.id,
    );
    if (!effectiveAgents.length) return;

    const recentMessages = await this.messageRepo
      .createQueryBuilder("m")
      .where('m."threadId" = :threadId', { threadId: thread.id })
      .andWhere('m."threadSessionId" = :threadSessionId', {
        threadSessionId: saved.threadSessionId,
      })
      .andWhere("m.id != :newId", { newId: saved.id })
      .orderBy('m."createdAt"', "DESC")
      .take(20)
      .getMany();

    const outboundContext = await this.buildOutboundContext(
      thread.id,
      saved,
      thread,
      effectiveAgents,
    );
    let recentMessagesPayload = recentMessages.reverse().map((message) => {
      const attachments = Array.isArray(message.attachments)
        ? message.attachments
        : [];
      return {
        senderName: message.senderName,
        senderId: message.senderId,
        content: withRuntimeAttachmentContext(message.content, attachments),
        contentFormat: message.contentFormat ?? MESSAGE_CONTENT_FORMAT_MARKDOWN,
        timestamp: message.createdAt,
        isFromUser: message.isFromUser,
        provenance: message.provenance,
        attachments,
      };
    });
    const runtimeApprovalMode =
      typeof saved.metadata?.runtimeApprovalMode === "string"
        ? saved.metadata.runtimeApprovalMode
        : "full_access";
    const artifactContract = buildRuntimeArtifactContract(saved);
    const attachmentRuntimeContent = withRuntimeAttachmentContext(
      saved.content,
      saved.attachments,
    );
    const runtimeInputContent = withRuntimeArtifactContract(
      attachmentRuntimeContent,
      artifactContract,
    );

    const mentionedAgentIds = this.resolveMentionedAgentIds(
      saved.content,
      effectiveAgents,
    );
    const routeableAgents = this.resolveSharedThreadRouteableAgents({
      thread,
      saved,
      effectiveAgents,
      mentionedAgentIds,
    });
    const routingMentionedAgentIds = this.isSharedAgentThread(thread)
      ? new Set(routeableAgents.map((agent) => agent.id))
      : mentionedAgentIds;
    if (!routeableAgents.length) {
      if (!saved.isFromUser) {
        await this.stopTypingForThread(thread, saved.senderId);
      }
      return;
    }
    if (this.isSharedAgentThread(thread) && routeableAgents[0]) {
      recentMessagesPayload = await this.buildTeamCatchUpPayload(
        thread,
        saved,
        routeableAgents[0].id,
      );
    }
    const runtimeBindings =
      await this.runtimeDispatchCoordinator.resolveEligibleBindings(
        routeableAgents.map((agent) => agent.id),
      );
    const runtimeBindingByAgentId = new Map(
      runtimeBindings.map((binding) => [binding.agentId, binding]),
    );
    const claudeAgents = routeableAgents.filter((agent) =>
      this.claudeService.isClaudeAgent(agent),
    );
    const runtimeManagedAgents = routeableAgents.filter(
      (agent) =>
        runtimeBindingByAgentId.has(agent.id) &&
        !this.claudeService.isClaudeAgent(agent),
    );
    const nonClaudeAgents = routeableAgents.filter(
      (agent) =>
        !this.claudeService.isClaudeAgent(agent) &&
        !runtimeBindingByAgentId.has(agent.id),
    );
    const mentionedClaudeAgents = claudeAgents.filter(
      (agent) =>
        routingMentionedAgentIds.has(agent.id) && agent.id !== saved.senderId,
    );
    const mentionedRuntimeAgents = runtimeManagedAgents.filter(
      (agent) =>
        routingMentionedAgentIds.has(agent.id) && agent.id !== saved.senderId,
    );
    const mentionedNonClaudeAgentIds = nonClaudeAgents
      .filter(
        (agent) =>
          routingMentionedAgentIds.has(agent.id) && agent.id !== saved.senderId,
      )
      .map((agent) => agent.id);

    if (mentionedClaudeAgents.length > 1) {
      await this.sendSystemMessage(
        thread.id,
        "Ambiguous Claude target. Mention exactly one Claude repo agent.",
      );
    }

    const nonClaudeTargetAgentIds = routingMentionedAgentIds.size
      ? mentionedNonClaudeAgentIds
      : nonClaudeAgents.map((agent) => agent.id);
    const claudeTargetAgents =
      thread.type === "direct" &&
      saved.isFromUser &&
      claudeAgents.length === 1 &&
      nonClaudeAgents.length === 0
        ? [claudeAgents[0]]
        : mentionedClaudeAgents.length === 1
          ? [mentionedClaudeAgents[0]]
          : [];
    const isSingleRuntimeDirectUserMessage =
      thread.type === "direct" &&
      saved.isFromUser &&
      routeableAgents.length === 1 &&
      runtimeManagedAgents.length === 1;
    const runtimeTargetAgents = this.isSharedAgentThread(thread)
      ? runtimeManagedAgents
      : isSingleRuntimeDirectUserMessage
        ? runtimeManagedAgents
        : routingMentionedAgentIds.size
          ? mentionedRuntimeAgents
          : runtimeManagedAgents.filter((agent) => {
              const binding = runtimeBindingByAgentId.get(agent.id);
              return binding?.routingMode === "default_target";
            });

    if (nonClaudeTargetAgentIds.length) {
      const bridgeTargets = nonClaudeTargetAgentIds.reduce<
        Array<{
          agentId: string;
          agentName: string;
          externalAgentId: string;
          responsePresentation?: string | null;
        }>
      >((acc, id) => {
        const agent = routeableAgents.find((entry) => entry.id === id);
        if (!agent) {
          return acc;
        }
        if (agent.externalId) {
          acc.push({
            agentId: agent.id,
            agentName: agent.name,
            externalAgentId: agent.externalId,
            responsePresentation: agent.responsePresentation,
          });
          return acc;
        }
        const match = agent.description?.match(/External ID:\s*(\S+)/);
        if (match?.[1]) {
          acc.push({
            agentId: agent.id,
            agentName: agent.name,
            externalAgentId: match[1],
            responsePresentation: agent.responsePresentation,
          });
        }
        return acc;
      }, []);

      const bridgeRuntime = this.eventsGateway.getWorkspaceBridgeRuntime(
        thread.workspaceId,
      );
      const liveExternalAgentIds = new Set(
        bridgeRuntime.liveRegisteredExternalAgentIds,
      );
      const liveBridgeTargets = bridgeTargets.filter((target) =>
        liveExternalAgentIds.has(target.externalAgentId),
      );

      if (!liveBridgeTargets.length && bridgeTargets.length) {
        const offlineNames = bridgeTargets.map((target) => target.agentName);
        const label =
          offlineNames.length === 1
            ? offlineNames[0]
            : `${offlineNames.slice(0, -1).join(", ")} and ${offlineNames.at(-1)}`;
        await this.sendSystemMessage(
          thread.id,
          `${label} ${offlineNames.length === 1 ? "is" : "are"} offline on the OpenClaw runtime.`,
        );
      }

      if (liveBridgeTargets.length) {
        for (const group of this.groupBridgeTargetsByPresentation(
          liveBridgeTargets,
        )) {
          this.eventsGateway.emitToBridgeAgents(
            thread.workspaceId,
            group.externalAgentIds,
            "agent.dispatch",
            {
              threadId: thread.id,
              threadSessionId: saved.threadSessionId,
              messageId: saved.id,
              content: attachmentRuntimeContent,
              runtimeInputContent,
              contentFormat:
                saved.contentFormat ?? MESSAGE_CONTENT_FORMAT_MARKDOWN,
              userId: saved.senderId,
              senderId: saved.senderId,
              senderName: saved.senderName,
              workspaceId: thread.workspaceId,
              attachments: saved.attachments ?? [],
              runtimeApprovalMode,
              artifactContract,
              recentMessages: recentMessagesPayload,
              ...buildRuntimeResponsePresentationContext(
                group.responsePresentation,
              ),
              ...outboundContext,
            },
          );
        }

        this.eventsGateway.emitAgentTyping(
          thread.id,
          liveBridgeTargets.map((target) => target.agentId),
          true,
        );
      }
    }

    for (const agent of claudeTargetAgents) {
      const binding = await this.claudeService.getBindingByAgentId(agent.id);
      const existingClaudeThreadSession =
        await this.claudeService.findClaudeThreadSession(
          saved.threadSessionId,
          agent.id,
        );
      const claudeThreadSession =
        await this.claudeService.getOrCreateClaudeThreadSession({
          workspaceId: thread.workspaceId,
          threadId: thread.id,
          threadSessionId: saved.threadSessionId,
          agentId: agent.id,
          messageId: saved.id,
        });
      const dispatchOutcome = await this.claudeService.createDispatch({
        workspaceId: thread.workspaceId,
        threadId: thread.id,
        threadSessionId: saved.threadSessionId,
        messageId: saved.id,
        agentId: agent.id,
        timeoutSeconds: DEFAULT_CLAUDE_TIMEOUT_SECONDS,
        claudeThreadSessionId: claudeThreadSession.id,
      });
      if (!dispatchOutcome.created) {
        continue;
      }

      if (!binding || !binding.isEnabled || !agent.externalId) {
        await this.claudeService.markDispatchFailed({
          dispatchId: dispatchOutcome.dispatch.id,
          errorCode: "claude_binding_invalid",
          errorMessage: `${agent.name} is missing a valid Claude binding.`,
        });
        await this.sendSystemMessage(
          thread.id,
          `${agent.name} is not configured correctly for Claude runtime dispatch.`,
        );
        continue;
      }

      const isLive = await this.claudeService.isClaudeAgentLive(
        thread.workspaceId,
        agent.externalId,
      );
      if (!isLive) {
        await this.claudeService.markDispatchFailed({
          dispatchId: dispatchOutcome.dispatch.id,
          errorCode: "runtime_offline",
          errorMessage: `${agent.name} is offline on the local Claude runtime.`,
        });
        await this.sendSystemMessage(
          thread.id,
          `${agent.name} is offline on the local Claude runtime.`,
        );
        continue;
      }

      this.eventsGateway.emitToBridgeAgents(
        thread.workspaceId,
        [agent.externalId],
        "agent.dispatch",
        {
          dispatchId: dispatchOutcome.dispatch.id,
          dispatchKey: dispatchOutcome.dispatch.dispatchKey,
          threadId: thread.id,
          threadSessionId: saved.threadSessionId,
          claudeSessionId: claudeThreadSession.claudeSessionId,
          messageId: saved.id,
          content: attachmentRuntimeContent,
          runtimeInputContent,
          contentFormat: saved.contentFormat ?? MESSAGE_CONTENT_FORMAT_MARKDOWN,
          userId: saved.senderId,
          senderId: saved.senderId,
          senderName: saved.senderName,
          workspaceId: thread.workspaceId,
          agentId: agent.id,
          agentName: agent.name,
          attachments: saved.attachments ?? [],
          runtimeApprovalMode,
          artifactContract,
          timeoutSeconds: DEFAULT_CLAUDE_TIMEOUT_SECONDS,
          model: binding.model ?? agent.modelPrimary ?? null,
          repoKey: binding.repoKey,
          routingMode: binding.routingMode,
          resume: Boolean(existingClaudeThreadSession),
          recentMessages: recentMessagesPayload,
          ...buildRuntimeResponsePresentationContext(
            agent.responsePresentation,
          ),
          ...outboundContext,
        },
        "claude_code",
      );

      this.eventsGateway.emitAgentTyping(thread.id, [agent.id], true);
    }

    for (const agent of runtimeTargetAgents) {
      const runtimeBinding = runtimeBindingByAgentId.get(agent.id);
      if (!runtimeBinding) continue;

      const runtimeThreadSession =
        await this.runtimeDispatchCoordinator.resolveRuntimeThreadSession({
          runtimeBinding,
          threadId: thread.id,
          threadSessionId: saved.threadSessionId,
          agentId: agent.id,
        });
      const timeoutMs = this.resolveRuntimeTimeoutMs(runtimeBinding);
      const isBridgeBackedRuntime =
        runtimeBinding.capabilities?.bridgeBacked === true;
      const dispatch = await this.runtimeDispatchCoordinator.queueDispatch({
        workspaceId: thread.workspaceId,
        threadId: thread.id,
        threadSessionId: saved.threadSessionId,
        messageId: saved.id,
        agentId: agent.id,
        runtimeBinding,
        runtimeThreadSession,
        timeoutAt: new Date(Date.now() + timeoutMs),
      });

      this.eventsGateway.emitAgentTyping(thread.id, [agent.id], true);

      void this.runtimeDispatchCoordinator
        .executeDispatch({
          runtimeBinding,
          runtimeThreadSession,
          dispatch,
          agent,
          inputText: runtimeInputContent,
          recentMessages: this.boundRuntimeRecentMessages(
            recentMessagesPayload,
            saved,
            runtimeBinding,
          ),
          dispatchMetadata: {
            targetExternalId: agent.externalId,
            agentName: agent.name,
            senderId: saved.senderId ?? null,
            senderName: saved.senderName,
            userId: saved.senderId ?? null,
            attachments: saved.attachments ?? [],
            runtimeApprovalMode,
            artifactContract,
            ...buildRuntimeResponsePresentationContext(
              agent.responsePresentation,
            ),
            ...outboundContext,
            ...(await this.buildAgentMarketplaceRuntimeContext(
              thread.workspaceId,
              agent.id,
              dispatch.id,
              this.resolveNativeRuntimeToolNames(runtimeBinding),
            )),
          },
          timeoutMs,
          persistFinalReply: async (finalText, metadata) => {
            const prepared = prepareAgentReplyForStorage({
              rawContent: finalText,
              responsePresentation: agent.responsePresentation,
            });
            return this.injectMessage(
              thread.id,
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
              {
                routeToAgents: this.isSharedAgentThread(thread)
                  ? undefined
                  : false,
              },
            );
          },
          onSettled: isBridgeBackedRuntime
            ? undefined
            : async () => {
                this.eventsGateway.emitAgentTyping(
                  thread.id,
                  [agent.id],
                  false,
                );
              },
        })
        .catch(() => {
          if (!isBridgeBackedRuntime) {
            this.eventsGateway.emitAgentTyping(thread.id, [agent.id], false);
          }
        });
    }
  }

  private resolveRuntimeTimeoutMs(binding: {
    capabilities?: Record<string, unknown>;
    configMetadata?: Record<string, unknown>;
  }): number {
    const configuredTimeout =
      typeof binding.configMetadata?.timeoutMs === "number"
        ? binding.configMetadata.timeoutMs
        : null;
    if (configuredTimeout && configuredTimeout > 0) {
      return configuredTimeout;
    }
    return DEFAULT_RUNTIME_TIMEOUT_MS;
  }

  private async teamRelayAllowsFollowUp(
    thread: ThreadEntity,
    saved: MessageEntity,
  ) {
    const session = await this.threadSessionService.findThreadSession(
      thread.id,
      saved.threadSessionId,
    );
    if (!session) return false;
    if (session.relayRunState === "paused") {
      await this.markTeamRelayMessagePending(
        saved,
        session.relayPauseReason ?? "manual",
      );
      return false;
    }

    const replyLimit = this.resolveTeamRelayReplyLimit(thread, session);
    const replyCount = await this.threadSessionService.countAgentReplies(
      thread.id,
      session.id,
    );
    if (replyCount >= replyLimit) {
      const updated = await this.threadSessionService.updateRelayControls(
        session,
        {
          runState: "paused",
          pauseReason: "reply_limit",
          replyLimit,
        },
      );
      await this.markTeamRelayMessagePending(saved, "reply_limit");
      const state = await this.buildTeamRelayState(thread, updated);
      this.emitTeamRelayUpdate(thread, state);
      return false;
    }
    return true;
  }

  private async loadTeamRelayContext(threadId: string, userId: string) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      userId,
    );
    if (!this.isSharedAgentThread(thread)) {
      throw new BadRequestException(
        "Team relay controls are available only for shared team threads",
      );
    }
    const session = await this.threadSessionService.ensureActiveSession(thread);
    return { thread, session };
  }

  private resolveTeamRelayReplyLimit(
    thread: ThreadEntity,
    session: { relayReplyLimit?: number | null },
  ) {
    return normalizeTeamRelayReplyLimit(
      session.relayReplyLimit ??
        thread.maxAgentTurns ??
        DEFAULT_SHARED_AGENT_TURN_LIMIT ??
        TEAM_RELAY_DEFAULT_REPLY_LIMIT,
    );
  }

  private async buildTeamRelayState(
    thread: ThreadEntity,
    session: {
      id: string;
      relayRunState?: "running" | "paused";
      relayPauseReason?: "manual" | "reply_limit" | null;
      relayReplyLimit?: number | null;
    },
  ) {
    const replyCount = await this.threadSessionService.countAgentReplies(
      thread.id,
      session.id,
    );
    return {
      threadId: thread.id,
      threadSessionId: session.id,
      runState: session.relayRunState ?? "running",
      pauseReason: session.relayPauseReason ?? null,
      replyLimit: this.resolveTeamRelayReplyLimit(thread, session),
      replyCount,
    };
  }

  private nextTeamRelayReplyLimit(current: number) {
    return (
      TEAM_RELAY_REPLY_LIMIT_PRESETS.find((preset) => preset > current) ??
      normalizeTeamRelayReplyLimit(current * 2)
    );
  }

  private async markTeamRelayMessagePending(
    message: MessageEntity,
    reason: "manual" | "reply_limit",
  ) {
    const metadata = {
      ...(message.metadata ?? {}),
      teamRelayRoutingState: "pending",
      teamRelayPauseReason: reason,
    };
    message.metadata = metadata;
    await this.messageRepo.update(message.id, { metadata });
  }

  private async routeLatestPendingTeamRelayMessage(
    thread: ThreadEntity,
    threadSessionId: string,
  ) {
    const pending = await this.messageRepo
      .createQueryBuilder("m")
      .where('m."threadId" = :threadId', { threadId: thread.id })
      .andWhere('m."threadSessionId" = :threadSessionId', { threadSessionId })
      .andWhere("m.provenance = :provenance", {
        provenance: MessageProvenance.AGENT,
      })
      .andWhere(`m.metadata ->> 'teamRelayRoutingState' = 'pending'`)
      .orderBy('m."createdAt"', "DESC")
      .getOne();
    if (!pending) return;

    const routingMetadata = {
      ...(pending.metadata ?? {}),
      teamRelayRoutingState: "routing",
      teamRelayPauseReason: null,
    };
    pending.metadata = routingMetadata;
    await this.messageRepo.update(pending.id, { metadata: routingMetadata });
    try {
      await this.routeMessageToAgents(thread, pending);
      const routedMetadata = {
        ...(pending.metadata ?? {}),
        teamRelayRoutingState: "routed",
      };
      pending.metadata = routedMetadata;
      await this.messageRepo.update(pending.id, { metadata: routedMetadata });
    } catch (error) {
      await this.markTeamRelayMessagePending(pending, "manual");
      throw error;
    }
  }

  private emitTeamRelayUpdate(thread: ThreadEntity, state: object) {
    this.eventsGateway.emitToScopes(
      { workspaceId: thread.workspaceId, threadId: thread.id },
      "team_relay.update",
      state,
    );
  }

  private async stopTypingForThread(thread: ThreadEntity, senderId?: string) {
    const allAgents = await this.threadMembershipService.listMemberAgents(
      thread.id,
    );
    const stopIds = allAgents
      .map((agent) => agent.id)
      .filter((id) => id !== senderId);
    if (stopIds.length) {
      this.eventsGateway.emitAgentTyping(thread.id, stopIds, false);
    }
  }

  private resolveMentionedAgentIds(
    content: string,
    agents: AgentEntity[],
  ): Set<string> {
    const matches = Array.from(content.matchAll(/@([A-Za-z0-9._/-]+)/g));
    if (!matches.length) {
      return new Set();
    }

    const tokens = matches.map((match) => match[1].trim().toLowerCase());
    const mentioned = new Set<string>();
    for (const agent of agents) {
      const candidates = this.getMentionCandidates(agent);
      if (tokens.some((token) => candidates.includes(token))) {
        mentioned.add(agent.id);
      }
    }
    return mentioned;
  }

  private async buildTeamCatchUpPayload(
    thread: ThreadEntity,
    saved: MessageEntity,
    targetAgentId: string,
  ) {
    const session = await this.threadSessionService.findThreadSession(
      thread.id,
      saved.threadSessionId,
    );
    if (!session) return [];
    const cursor = session.relayCatchUpCursors?.[targetAgentId];
    const query = this.messageRepo
      .createQueryBuilder("catchup")
      .where('catchup."threadId" = :threadId', { threadId: thread.id })
      .andWhere('catchup."threadSessionId" = :threadSessionId', {
        threadSessionId: saved.threadSessionId,
      })
      .andWhere("catchup.id != :newId", { newId: saved.id })
      .andWhere('catchup."createdAt" < :currentCreatedAt', {
        currentCreatedAt: saved.createdAt,
      });
    if (cursor?.createdAt) {
      query.andWhere('catchup."createdAt" > :cursorCreatedAt', {
        cursorCreatedAt: new Date(cursor.createdAt),
      });
    }
    const messages = await query
      .orderBy('catchup."createdAt"', "ASC")
      .getMany();
    await this.threadSessionService.updateRelayCatchUpCursor(
      session,
      targetAgentId,
      {
        messageId: saved.id,
        createdAt: saved.createdAt.toISOString(),
      },
    );
    return messages
      .filter((message) => message.senderId !== targetAgentId)
      .map((message) => ({
        senderName: message.senderName,
        senderId: message.senderId,
        content: withRuntimeAttachmentContext(
          message.content,
          message.attachments,
        ),
        contentFormat: message.contentFormat ?? MESSAGE_CONTENT_FORMAT_MARKDOWN,
        timestamp: message.createdAt,
        isFromUser: message.isFromUser,
        provenance: message.provenance,
        attachments: Array.isArray(message.attachments)
          ? message.attachments
          : [],
      }));
  }

  private resolveSharedThreadRouteableAgents(input: {
    thread: ThreadEntity;
    saved: MessageEntity;
    effectiveAgents: AgentEntity[];
    mentionedAgentIds: Set<string>;
  }): AgentEntity[] {
    const { thread, saved, effectiveAgents, mentionedAgentIds } = input;
    if (!this.isSharedAgentThread(thread)) {
      return effectiveAgents;
    }

    const eligible = saved.isFromUser
      ? effectiveAgents
      : effectiveAgents.filter((agent) => agent.id !== saved.senderId);
    if (!eligible.length) return [];
    const mentioned = eligible.find((agent) => mentionedAgentIds.has(agent.id));
    if (mentioned) return [mentioned];
    return [eligible[Math.floor(Math.random() * eligible.length)]];
  }

  private isSharedAgentThread(thread: ThreadEntity | null) {
    return Boolean(
      thread &&
      ["team", "department", "company_meeting", "agent_to_agent"].includes(
        thread.type,
      ),
    );
  }

  private getMentionCandidates(agent: AgentEntity): string[] {
    return Array.from(
      new Set(
        [agent.externalId, agent.name, this.normalizeMentionToken(agent.name)]
          .filter(Boolean)
          .map((value) => value!.trim().toLowerCase()),
      ),
    );
  }

  private normalizeMentionToken(value?: string | null) {
    return (value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private async resolveBeforeCursor(before: string): Promise<Date | null> {
    const asDate = new Date(before);
    if (!Number.isNaN(asDate.getTime())) return asDate;

    const message = await this.messageRepo.findOne({ where: { id: before } });
    return message?.createdAt ?? null;
  }
}
