import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { ThreadEntity } from "../../entities/thread.entity";
import { ThreadReadStateEntity } from "../../entities/thread-read-state.entity";
import { MessageEntity } from "../../entities/message.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { ThreadSessionEntity } from "../../entities/thread-session.entity";
import { TeamEntity } from "../../entities/team.entity";
import { DepartmentEntity } from "../../entities/department.entity";
import { MessageProvenance } from "../../entities/message.entity";
import { paginate } from "../../common/dto/pagination.dto";
import { CreateThreadDto, UpdateThreadDto } from "./dto/thread.dto";
import { ThreadMembershipService } from "./thread-membership.service";
import { ThreadSessionService } from "./thread-session.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { ThreadRuntimeLifecycleService } from "./thread-runtime-lifecycle.service";
import { ThreadUserMessageAnalysisService } from "./thread-user-message-analysis.service";
import { ThreadAgentRepeatAnalysisService } from "./thread-agent-repeat-analysis.service";

const THREAD_LAST_MESSAGE_PREVIEW_LENGTH = 500;
const THREAD_LIST_AVATAR_URL_MAX_LENGTH = 2048;
const LEGACY_THREAD_ROLE_WORDS = new Set([
  "agent",
  "assistant",
  "bot",
  "helper",
  "operator",
  "researcher",
]);

function normalizeLegacyThreadIdentity(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .toLocaleLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !LEGACY_THREAD_ROLE_WORDS.has(token))
    .join(" ");
}

function normalizeThreadListAvatarUrl(avatarUrl: unknown) {
  if (typeof avatarUrl !== "string") return avatarUrl ?? null;
  if (avatarUrl.length <= THREAD_LIST_AVATAR_URL_MAX_LENGTH) return avatarUrl;
  return null;
}

function normalizeThreadLastMessagePreview(lastMessage: unknown) {
  if (!lastMessage || typeof lastMessage !== "object") {
    return lastMessage ?? null;
  }

  const preview = lastMessage as { content?: unknown };
  if (typeof preview.content !== "string") {
    return lastMessage;
  }

  const content =
    preview.content.length > THREAD_LAST_MESSAGE_PREVIEW_LENGTH
      ? `${preview.content.slice(0, THREAD_LAST_MESSAGE_PREVIEW_LENGTH).trimEnd()}...`
      : preview.content;

  return { ...preview, content };
}

function normalizeThreadListItem<T extends { lastMessage?: unknown }>(
  thread: T,
) {
  return {
    ...thread,
    avatarUrl: normalizeThreadListAvatarUrl(
      (thread as { avatarUrl?: unknown }).avatarUrl,
    ),
    lastMessage: normalizeThreadLastMessagePreview(thread.lastMessage),
  };
}

@Injectable()
export class ThreadService {
  constructor(
    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,

    @InjectRepository(ThreadReadStateEntity)
    private readonly readStateRepo: Repository<ThreadReadStateEntity>,

    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,

    @InjectRepository(ThreadSessionEntity)
    private readonly threadSessionRepo: Repository<ThreadSessionEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(TeamEntity)
    private readonly teamRepo: Repository<TeamEntity>,

    @InjectRepository(DepartmentEntity)
    private readonly departmentRepo: Repository<DepartmentEntity>,

    private readonly threadMembershipService: ThreadMembershipService,
    private readonly threadSessionService: ThreadSessionService,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
    private readonly threadRuntimeLifecycleService: ThreadRuntimeLifecycleService,
    private readonly threadUserMessageAnalysisService: ThreadUserMessageAnalysisService,
    private readonly threadAgentRepeatAnalysisService: ThreadAgentRepeatAnalysisService,
  ) {}

  async findAll(
    workspaceId: string,
    userId: string,
    filters: {
      type?: string;
      search?: string;
      pinned?: boolean;
      page?: number;
      pageSize?: number;
    },
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      userId,
    );
    const { type, search, pinned, page = 1, pageSize = 20 } = filters;

    const qb = this.threadRepo
      .createQueryBuilder("t")
      .where('t."workspaceId" = :workspaceId', { workspaceId })
      .andWhere("t.status != :archived", { archived: "archived" });

    if (type) qb.andWhere("t.type = :type", { type });
    if (pinned !== undefined) qb.andWhere('t."isPinned" = :pinned', { pinned });
    if (search) qb.andWhere("t.title ILIKE :search", { search: `%${search}%` });

    qb.orderBy('t."updatedAt"', "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [threads, total] = await qb.getManyAndCount();

    const hydratedThreads =
      await this.threadMembershipService.hydrateThreads(threads);
    const identifiedThreads = await this.enrichLegacyThreadAgentIds(
      workspaceId,
      hydratedThreads,
    );

    const unreadCounts = await this.getUnreadCounts(
      identifiedThreads.map((thread) => thread.id),
      userId,
    );

    const threadsWithUnread = identifiedThreads.map((t) =>
      normalizeThreadListItem({
        ...t,
        unreadCount: unreadCounts.get(t.id) ?? 0,
      }),
    );

    return paginate(threadsWithUnread, total, page, pageSize);
  }

  // Keep backwards compat alias used by old controller
  async findAllByWorkspace(
    workspaceId: string,
    userId: string,
    pagination: any,
  ) {
    return this.findAll(workspaceId, userId, pagination);
  }

  async findOne(id: string, userId?: string) {
    const thread = await this.threadRepo.findOne({ where: { id } });
    if (!thread) throw new NotFoundException("Thread not found");
    if (userId) {
      await this.workspaceMembershipService.ensureWorkspaceAccess(
        thread.workspaceId,
        userId,
      );
    }
    const hydratedThread =
      await this.threadMembershipService.hydrateThread(thread);
    const [identifiedThread] = await this.enrichLegacyThreadAgentIds(
      thread.workspaceId,
      [hydratedThread],
    );
    const unreadCount = userId ? await this.getUnreadCount(id, userId) : 0;
    return { ...(identifiedThread ?? hydratedThread), unreadCount };
  }

  async create(dto: CreateThreadDto, userId?: string) {
    if (userId) {
      await this.workspaceMembershipService.ensureWorkspaceAccess(
        dto.workspaceId,
        userId,
      );
    }
    const normalizedAgentIds = this.threadMembershipService.normalizeAgentIds(
      dto.agentIds?.length
        ? dto.agentIds
        : await this.resolveDefaultThreadAgentIds(dto),
    );
    const thread = this.threadRepo.create({
      ...dto,
      agentIds: normalizedAgentIds,
      status: "active",
    });
    const saved = await this.threadRepo.save(thread);
    await this.threadSessionService.createInitialSession(saved.id);
    const threadWithSession = await this.threadRepo.findOne({
      where: { id: saved.id },
    });
    await this.threadMembershipService.syncMemberships(
      saved,
      normalizedAgentIds,
    );
    const hydratedThread = await this.threadMembershipService.hydrateThread(
      threadWithSession ?? saved,
    );
    return { ...hydratedThread, unreadCount: 0 };
  }

  async update(
    id: string,
    dto: UpdateThreadDto | Partial<ThreadEntity>,
    userId: string,
  ) {
    const thread = await this.threadRepo.findOne({ where: { id } });
    if (!thread) throw new NotFoundException("Thread not found");
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      userId,
    );
    const previousAgentIds =
      await this.threadMembershipService.listMemberIds(id);
    const nextAgentIds =
      "agentIds" in dto
        ? this.threadMembershipService.normalizeAgentIds(dto.agentIds ?? [])
        : null;
    const rest = { ...dto };
    delete (rest as Partial<ThreadEntity>).agentIds;
    Object.assign(thread, rest);
    const saved = await this.threadRepo.save(thread);
    if (nextAgentIds !== null) {
      await this.threadMembershipService.syncMemberships(saved, nextAgentIds);
      const removedAgentIds = previousAgentIds.filter(
        (agentId) => !(nextAgentIds ?? []).includes(agentId),
      );
      if (removedAgentIds.length && saved.activeSessionId) {
        await this.threadRuntimeLifecycleService.closeThreadSessionsForThread({
          threadId: saved.id,
          threadSessionId: saved.activeSessionId,
          agentIds: removedAgentIds,
          reason: "agent_removed_from_thread",
        });
      }
    }
    return this.threadMembershipService.hydrateThread(saved);
  }

  async archive(id: string, userId: string) {
    const thread = await this.threadRepo.findOne({ where: { id } });
    if (!thread) throw new NotFoundException("Thread not found");
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      userId,
    );
    thread.status = "archived";
    const saved = await this.threadRepo.save(thread);
    await this.threadRuntimeLifecycleService.closeThreadSessionsForThread({
      threadId: saved.id,
      reason: "thread_archived",
    });
    return saved;
  }

  async remove(id: string): Promise<void> {
    await this.threadRepo.delete(id);
  }

  async getUnreadCount(threadId: string, userId: string): Promise<number> {
    const state = await this.readStateRepo.findOne({
      where: { threadId, userId },
    });
    return state?.unreadCount ?? 0;
  }

  async getUnreadCounts(
    threadIds: string[],
    userId: string,
  ): Promise<Map<string, number>> {
    const uniqueThreadIds = Array.from(new Set(threadIds.filter(Boolean)));
    if (!uniqueThreadIds.length) {
      return new Map();
    }

    const states = await this.readStateRepo.find({
      where: { threadId: In(uniqueThreadIds), userId },
      select: ["threadId", "unreadCount"],
    });

    return new Map(
      states.map((state) => [state.threadId, state.unreadCount ?? 0]),
    );
  }

  async markAllRead(threadId: string, userId: string) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      userId,
    );
    const activeSession =
      await this.threadSessionService.ensureActiveSession(thread);

    const lastMessage = await this.messageRepo
      .createQueryBuilder("m")
      .where('m."threadId" = :threadId', { threadId })
      .andWhere('m."threadSessionId" = :threadSessionId', {
        threadSessionId: activeSession.id,
      })
      .orderBy('m."createdAt"', "DESC")
      .limit(1)
      .getOne();

    await this.readStateRepo.upsert(
      {
        threadId,
        userId,
        lastReadMessageId: lastMessage?.id,
        unreadCount: 0,
        updatedAt: new Date(),
      },
      { conflictPaths: ["threadId", "userId"] },
    );
    return { success: true };
  }

  async markRead(threadId: string, userId: string, lastReadMessageId?: string) {
    await this.readStateRepo.upsert(
      {
        threadId,
        userId,
        lastReadMessageId,
        unreadCount: 0,
        updatedAt: new Date(),
      },
      { conflictPaths: ["threadId", "userId"] },
    );
  }

  async searchThreads(
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
    const qb = this.threadRepo
      .createQueryBuilder("t")
      .where('t."workspaceId" = :workspaceId', { workspaceId })
      .andWhere("t.title ILIKE :query", { query: `%${query}%` })
      .orderBy('t."updatedAt"', "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    const hydratedItems =
      await this.threadMembershipService.hydrateThreads(items);
    const identifiedItems = await this.enrichLegacyThreadAgentIds(
      workspaceId,
      hydratedItems,
    );
    return paginate(
      identifiedItems.map((thread) => normalizeThreadListItem(thread)),
      total,
      page,
      pageSize,
    );
  }

  async getParticipants(threadId: string, userId: string) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      userId,
    );
    const agentIds = await this.threadMembershipService.listMemberIds(threadId);
    return { participantIds: thread.participantIds, agentIds };
  }

  private async enrichLegacyThreadAgentIds<T extends ThreadEntity>(
    workspaceId: string,
    threads: T[],
  ): Promise<T[]> {
    const unresolved = threads.filter(
      (thread) =>
        !(thread.agentIds ?? []).filter(Boolean).length || !thread.lastMessage,
    );
    if (!unresolved.length) return threads;

    const agents = await this.agentRepo.find({
      where: { workspaceId } as any,
      select: [
        "id",
        "name",
        "externalId",
        "avatarUrl",
        "teamId",
        "departmentId",
      ],
    });
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const messages = await this.messageRepo.find({
      where: { threadId: In(unresolved.map((thread) => thread.id)) },
      select: [
        "id",
        "threadId",
        "senderId",
        "senderName",
        "senderAvatarUrl",
        "content",
        "createdAt",
      ],
      order: { createdAt: "DESC" },
    });
    const latestMessageByThread = new Map<string, MessageEntity>();
    const messageAgentIdsByThread = new Map<string, string[]>();
    for (const message of messages) {
      if (!latestMessageByThread.has(message.threadId)) {
        latestMessageByThread.set(message.threadId, message);
      }
      if (!agentsById.has(message.senderId)) continue;
      const current = messageAgentIdsByThread.get(message.threadId) ?? [];
      if (!current.includes(message.senderId)) current.push(message.senderId);
      messageAgentIdsByThread.set(message.threadId, current);
    }

    return threads.map((thread) => {
      const latestMessage = latestMessageByThread.get(thread.id);
      const enrichedThread =
        !thread.lastMessage && latestMessage
          ? ({
              ...thread,
              lastMessage: {
                id: latestMessage.id,
                content: latestMessage.content,
                senderId: latestMessage.senderId,
                senderName: latestMessage.senderName,
                senderAvatarUrl: latestMessage.senderAvatarUrl,
                createdAt: latestMessage.createdAt,
              },
            } as T)
          : thread;
      if ((enrichedThread.agentIds ?? []).filter(Boolean).length) {
        return enrichedThread;
      }

      const lastSenderId = (
        enrichedThread.lastMessage as { senderId?: unknown } | null
      )?.senderId;
      const lastMessageAgentId =
        typeof lastSenderId === "string" && agentsById.has(lastSenderId)
          ? lastSenderId
          : null;
      const messageAgentIds =
        messageAgentIdsByThread.get(enrichedThread.id) ?? [];

      if (enrichedThread.type !== "direct") {
        const scopedAgentIds = enrichedThread.teamId
          ? agents
              .filter((agent) => agent.teamId === enrichedThread.teamId)
              .map((agent) => agent.id)
          : enrichedThread.departmentId
            ? agents
                .filter(
                  (agent) => agent.departmentId === enrichedThread.departmentId,
                )
                .map((agent) => agent.id)
            : [];
        const recoveredIds = Array.from(
          new Set([
            ...(lastMessageAgentId ? [lastMessageAgentId] : []),
            ...messageAgentIds,
            ...scopedAgentIds,
          ]),
        );
        return recoveredIds.length
          ? ({ ...enrichedThread, agentIds: recoveredIds } as T)
          : enrichedThread;
      }

      const directMessageAgentId = lastMessageAgentId ?? messageAgentIds[0];
      if (directMessageAgentId) {
        return {
          ...enrichedThread,
          agentIds: [directMessageAgentId],
        } as T;
      }

      const threadIdentity = normalizeLegacyThreadIdentity(
        enrichedThread.title,
      );
      if (!threadIdentity || threadIdentity === "new chat") {
        return enrichedThread;
      }
      const titleMatches = agents.filter((agent) =>
        [agent.name, agent.externalId]
          .map(normalizeLegacyThreadIdentity)
          .filter(Boolean)
          .some((identity) => identity === threadIdentity),
      );
      return titleMatches.length === 1
        ? ({ ...enrichedThread, agentIds: [titleMatches[0].id] } as T)
        : enrichedThread;
    });
  }

  private async resolveDefaultThreadAgentIds(
    dto: Pick<
      CreateThreadDto,
      "type" | "workspaceId" | "teamId" | "departmentId"
    >,
  ): Promise<string[]> {
    if (dto.type === "team" && dto.teamId) {
      const team = await this.teamRepo.findOne({
        where: { id: dto.teamId },
        select: ["id", "departmentId", "leadAgentId"],
      });
      const department = team?.departmentId
        ? await this.departmentRepo.findOne({
            where: { id: team.departmentId },
            select: ["id", "headAgentId"],
          })
        : null;
      // Team leads coordinate human-started team conversations and must be
      // present in the thread to receive the first routed turn. Department
      // heads remain excluded unless they are explicitly added.
      const excludedManagerIds = new Set(
        [department?.headAgentId].filter(Boolean),
      );
      const teamAgents = await this.agentRepo.find({
        where: { workspaceId: dto.workspaceId, teamId: dto.teamId } as any,
        select: ["id"],
      });
      return teamAgents
        .map((agent) => agent.id)
        .filter((agentId) => !excludedManagerIds.has(agentId));
    }

    if (dto.type === "department" && dto.departmentId) {
      const department = await this.departmentRepo.findOne({
        where: { id: dto.departmentId },
        select: ["id", "headAgentId"],
      });
      const departmentAgents = await this.agentRepo.find({
        where: {
          workspaceId: dto.workspaceId,
          departmentId: dto.departmentId,
        } as any,
        select: ["id"],
      });
      return departmentAgents
        .map((agent) => agent.id)
        .filter((agentId) => agentId !== department?.headAgentId);
    }

    return [];
  }

  async getAnalytics(
    threadId: string,
    userId: string,
    query: {
      activityGapMinutes?: number;
      agentRepeatSessionId?: string;
    } = {},
  ) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      thread.workspaceId,
      userId,
    );

    const activityGapMinutes = Math.max(1, query.activityGapMinutes ?? 30);
    const gapMs = activityGapMinutes * 60 * 1000;
    const participantIds = normalizeParticipantIds(thread.participantIds);
    const hasSingleRequestingUserParticipant =
      participantIds.length === 1 && participantIds[0] === userId;

    const [messages, sessions] = await Promise.all([
      this.messageRepo.find({
        where: { threadId },
        order: { createdAt: "ASC" },
      }),
      this.threadSessionRepo.find({
        where: { threadId },
        order: { sequenceNumber: "ASC" },
      }),
    ]);

    const sessionStats = new Map<
      string,
      {
        threadSessionId: string;
        sequenceNumber: number | null;
        status: string | null;
        startedAt: string | null;
        endedAt: string | null;
        firstMessageAt: string | null;
        lastMessageAt: string | null;
        messageCount: number;
      }
    >(
      sessions.map((session) => [
        session.id,
        {
          threadSessionId: session.id,
          sequenceNumber: session.sequenceNumber ?? null,
          status: session.status ?? null,
          startedAt: toIsoString(session.startedAt),
          endedAt: toIsoString(session.endedAt),
          firstMessageAt: null,
          lastMessageAt: null,
          messageCount: 0,
        },
      ]),
    );

    const senderStats = new Map<
      string,
      {
        senderKey: string;
        senderId: string | null;
        senderName: string;
        senderKind: "user" | "agent" | "system";
        messageCount: number;
        firstMessageAt: string;
        lastMessageAt: string;
        sessionIds: Set<string>;
      }
    >();
    const agentSessionStats = new Map<
      string,
      {
        threadSessionId: string;
        agentMessageCount: number;
        messages: Array<{
          id: string;
          createdAt: string;
          senderId: string | null;
          senderName: string;
          content: string;
        }>;
      }
    >();
    const requestingUserSessionStats = new Map<
      string,
      {
        threadSessionId: string;
        requestingUserMessageCount: number;
        requestingUserFirstMessageAt: string | null;
        requestingUserLastMessageAt: string | null;
        messageGapMinutes: number[];
        agentGapMinutes: number[];
        messagesAfterLongSilenceCount: number;
        messagesAfterAgentSilenceCount: number;
        messages: Array<{
          id: string;
          createdAt: string;
          content: string;
          minutesSincePreviousMessage: number | null;
          minutesSincePreviousAgentMessage: number | null;
          minutesSincePreviousOwnMessage: number | null;
          agentMessagesSincePreviousOwnMessage: number;
          occurredAfterLongSilence: boolean;
          occurredAfterAgentSilence: boolean;
        }>;
      }
    >();

    const activePeriods: Array<{
      startedAt: string;
      endedAt: string;
      messageCount: number;
      senderKeys: Set<string>;
    }> = [];

    let userMessageCount = 0;
    let agentMessageCount = 0;
    let systemMessageCount = 0;
    let requestingUserMessageCount = 0;
    const lastMessageAtBySession = new Map<string, string>();
    const lastAgentMessageAtBySession = new Map<string, string>();
    const lastRequestingUserMessageAtBySession = new Map<string, string>();
    const agentMessagesSincePreviousRequestingUserBySession = new Map<
      string,
      number
    >();

    let currentPeriod: {
      startedAt: string;
      endedAt: string;
      messageCount: number;
      senderKeys: Set<string>;
      lastTimestampMs: number;
    } | null = null;

    for (const message of messages) {
      const createdAtIso = toIsoString(message.createdAt);
      if (!createdAtIso) {
        continue;
      }

      const timestampMs = new Date(createdAtIso).getTime();
      const senderKind = classifySenderKind(message);
      const senderId = message.senderId ?? null;
      const senderName = message.senderName?.trim() || "Unknown sender";
      const analyticsMessageContent =
        this.normalizeAnalyticsMessageContent(message);
      const senderKey = `${senderKind}:${senderId ?? senderName}`;
      const previousMessageAt = lastMessageAtBySession.get(
        message.threadSessionId,
      );
      const previousAgentMessageAt = lastAgentMessageAtBySession.get(
        message.threadSessionId,
      );
      const previousRequestingUserMessageAt =
        lastRequestingUserMessageAtBySession.get(message.threadSessionId);

      if (senderKind === "user") {
        userMessageCount += 1;
      } else if (senderKind === "agent") {
        agentMessageCount += 1;
        const sessionAgentStats = agentSessionStats.get(
          message.threadSessionId,
        ) ?? {
          threadSessionId: message.threadSessionId,
          agentMessageCount: 0,
          messages: [],
        };
        sessionAgentStats.agentMessageCount += 1;
        sessionAgentStats.messages.push({
          id: message.id,
          createdAt: createdAtIso,
          senderId,
          senderName,
          content: analyticsMessageContent,
        });
        agentSessionStats.set(message.threadSessionId, sessionAgentStats);
      } else {
        systemMessageCount += 1;
      }

      if (
        isRequestingUserMessageForAnalytics(
          message,
          userId,
          hasSingleRequestingUserParticipant,
        )
      ) {
        requestingUserMessageCount += 1;
        const minutesSincePreviousMessage = previousMessageAt
          ? diffMinutes(previousMessageAt, createdAtIso)
          : null;
        const minutesSincePreviousAgentMessage = previousAgentMessageAt
          ? diffMinutes(previousAgentMessageAt, createdAtIso)
          : null;
        const minutesSincePreviousOwnMessage = previousRequestingUserMessageAt
          ? diffMinutes(previousRequestingUserMessageAt, createdAtIso)
          : null;
        const occurredAfterLongSilence =
          minutesSincePreviousMessage !== null &&
          minutesSincePreviousMessage > activityGapMinutes;
        const occurredAfterAgentSilence =
          minutesSincePreviousAgentMessage !== null &&
          minutesSincePreviousAgentMessage > activityGapMinutes;
        const sessionUserStats = requestingUserSessionStats.get(
          message.threadSessionId,
        ) ?? {
          threadSessionId: message.threadSessionId,
          requestingUserMessageCount: 0,
          requestingUserFirstMessageAt: null,
          requestingUserLastMessageAt: null,
          messageGapMinutes: [],
          agentGapMinutes: [],
          messagesAfterLongSilenceCount: 0,
          messagesAfterAgentSilenceCount: 0,
          messages: [],
        };
        sessionUserStats.requestingUserMessageCount += 1;
        sessionUserStats.requestingUserFirstMessageAt ??= createdAtIso;
        sessionUserStats.requestingUserLastMessageAt = createdAtIso;
        if (minutesSincePreviousMessage !== null) {
          sessionUserStats.messageGapMinutes.push(minutesSincePreviousMessage);
        }
        if (minutesSincePreviousAgentMessage !== null) {
          sessionUserStats.agentGapMinutes.push(
            minutesSincePreviousAgentMessage,
          );
        }
        if (occurredAfterLongSilence) {
          sessionUserStats.messagesAfterLongSilenceCount += 1;
        }
        if (occurredAfterAgentSilence) {
          sessionUserStats.messagesAfterAgentSilenceCount += 1;
        }
        sessionUserStats.messages.push({
          id: message.id,
          createdAt: createdAtIso,
          content: analyticsMessageContent,
          minutesSincePreviousMessage,
          minutesSincePreviousAgentMessage,
          minutesSincePreviousOwnMessage,
          agentMessagesSincePreviousOwnMessage:
            agentMessagesSincePreviousRequestingUserBySession.get(
              message.threadSessionId,
            ) ?? 0,
          occurredAfterLongSilence,
          occurredAfterAgentSilence,
        });
        requestingUserSessionStats.set(
          message.threadSessionId,
          sessionUserStats,
        );
        lastRequestingUserMessageAtBySession.set(
          message.threadSessionId,
          createdAtIso,
        );
        agentMessagesSincePreviousRequestingUserBySession.set(
          message.threadSessionId,
          0,
        );
      }

      const existingSender = senderStats.get(senderKey);
      if (existingSender) {
        existingSender.messageCount += 1;
        existingSender.lastMessageAt = createdAtIso;
        existingSender.sessionIds.add(message.threadSessionId);
      } else {
        senderStats.set(senderKey, {
          senderKey,
          senderId,
          senderName,
          senderKind,
          messageCount: 1,
          firstMessageAt: createdAtIso,
          lastMessageAt: createdAtIso,
          sessionIds: new Set([message.threadSessionId]),
        });
      }

      const sessionStat = sessionStats.get(message.threadSessionId) ?? {
        threadSessionId: message.threadSessionId,
        sequenceNumber: null,
        status: null,
        startedAt: null,
        endedAt: null,
        firstMessageAt: null,
        lastMessageAt: null,
        messageCount: 0,
      };

      sessionStat.messageCount += 1;
      sessionStat.firstMessageAt ??= createdAtIso;
      sessionStat.lastMessageAt = createdAtIso;
      sessionStats.set(message.threadSessionId, sessionStat);
      lastMessageAtBySession.set(message.threadSessionId, createdAtIso);
      if (senderKind === "agent") {
        lastAgentMessageAtBySession.set(message.threadSessionId, createdAtIso);
        agentMessagesSincePreviousRequestingUserBySession.set(
          message.threadSessionId,
          (agentMessagesSincePreviousRequestingUserBySession.get(
            message.threadSessionId,
          ) ?? 0) + 1,
        );
      }

      if (!currentPeriod) {
        currentPeriod = {
          startedAt: createdAtIso,
          endedAt: createdAtIso,
          messageCount: 1,
          senderKeys: new Set([senderKey]),
          lastTimestampMs: timestampMs,
        };
        continue;
      }

      if (timestampMs - currentPeriod.lastTimestampMs > gapMs) {
        activePeriods.push({
          startedAt: currentPeriod.startedAt,
          endedAt: currentPeriod.endedAt,
          messageCount: currentPeriod.messageCount,
          senderKeys: currentPeriod.senderKeys,
        });
        currentPeriod = {
          startedAt: createdAtIso,
          endedAt: createdAtIso,
          messageCount: 1,
          senderKeys: new Set([senderKey]),
          lastTimestampMs: timestampMs,
        };
        continue;
      }

      currentPeriod.endedAt = createdAtIso;
      currentPeriod.messageCount += 1;
      currentPeriod.senderKeys.add(senderKey);
      currentPeriod.lastTimestampMs = timestampMs;
    }

    if (currentPeriod) {
      activePeriods.push({
        startedAt: currentPeriod.startedAt,
        endedAt: currentPeriod.endedAt,
        messageCount: currentPeriod.messageCount,
        senderKeys: currentPeriod.senderKeys,
      });
    }

    const firstMessageAt = toIsoString(messages[0]?.createdAt ?? null);
    const lastMessageAt = toIsoString(
      messages[messages.length - 1]?.createdAt ?? null,
    );
    const elapsedMinutes =
      firstMessageAt && lastMessageAt
        ? diffMinutes(firstMessageAt, lastMessageAt)
        : 0;

    const materializedActivePeriods = activePeriods.map((period) => ({
      startedAt: period.startedAt,
      endedAt: period.endedAt,
      messageCount: period.messageCount,
      uniqueSenderCount: period.senderKeys.size,
      durationMinutes: diffMinutes(period.startedAt, period.endedAt),
    }));
    const sortedSessionBreakdown = [...sessionStats.values()].sort(
      (left, right) => {
        const leftSequence = left.sequenceNumber ?? Number.MAX_SAFE_INTEGER;
        const rightSequence = right.sequenceNumber ?? Number.MAX_SAFE_INTEGER;
        return leftSequence - rightSequence;
      },
    );
    const requestingUserAnalysisBySession =
      await this.threadUserMessageAnalysisService.analyze({
        thread,
        activityGapMinutes,
        sessions: sortedSessionBreakdown.map((session) => {
          const userStats = requestingUserSessionStats.get(
            session.threadSessionId,
          );
          return {
            threadSessionId: session.threadSessionId,
            sequenceNumber: session.sequenceNumber,
            status: session.status,
            firstMessageAt: session.firstMessageAt,
            lastMessageAt: session.lastMessageAt,
            requestingUserMessageCount:
              userStats?.requestingUserMessageCount ?? 0,
            messagesAfterLongSilenceCount:
              userStats?.messagesAfterLongSilenceCount ?? 0,
            messagesAfterAgentSilenceCount:
              userStats?.messagesAfterAgentSilenceCount ?? 0,
            medianMinutesSincePreviousMessage: median(
              userStats?.messageGapMinutes ?? [],
            ),
            medianMinutesSincePreviousAgentMessage: median(
              userStats?.agentGapMinutes ?? [],
            ),
            messages: userStats?.messages ?? [],
          };
        }),
      });
    const repeatAnalysisSessions = selectSessionsForAgentRepeatAnalysis(
      sortedSessionBreakdown,
      query.agentRepeatSessionId,
    );
    const agentRepeatAnalysisBySession =
      await this.threadAgentRepeatAnalysisService.analyze({
        thread,
        sessions: repeatAnalysisSessions.map((session) => {
          const agentStats = agentSessionStats.get(session.threadSessionId);
          return {
            threadSessionId: session.threadSessionId,
            sequenceNumber: session.sequenceNumber,
            status: session.status,
            firstMessageAt: session.firstMessageAt,
            lastMessageAt: session.lastMessageAt,
            agentMessageCount: agentStats?.agentMessageCount ?? 0,
            messages: agentStats?.messages ?? [],
          };
        }),
      });

    return {
      threadId: thread.id,
      threadTitle: thread.title,
      threadType: thread.type,
      workspaceId: thread.workspaceId,
      activityGapMinutes,
      totalMessages: messages.length,
      totalSessions: sessionStats.size,
      totalSenders: senderStats.size,
      userMessageCount,
      agentMessageCount,
      systemMessageCount,
      requestingUserMessageCount,
      firstMessageAt,
      lastMessageAt,
      elapsedMinutes,
      activeDurationMinutes: materializedActivePeriods.reduce(
        (sum, period) => sum + period.durationMinutes,
        0,
      ),
      activePeriods: materializedActivePeriods,
      messageCountsBySender: [...senderStats.values()]
        .map((entry) => ({
          senderKey: entry.senderKey,
          senderId: entry.senderId,
          senderName: entry.senderName,
          senderKind: entry.senderKind,
          messageCount: entry.messageCount,
          shareOfMessages:
            messages.length > 0 ? entry.messageCount / messages.length : 0,
          firstMessageAt: entry.firstMessageAt,
          lastMessageAt: entry.lastMessageAt,
          sessionCount: entry.sessionIds.size,
        }))
        .sort((left, right) => {
          if (right.messageCount !== left.messageCount) {
            return right.messageCount - left.messageCount;
          }
          return (
            new Date(right.lastMessageAt).getTime() -
            new Date(left.lastMessageAt).getTime()
          );
        }),
      sessionBreakdown: sortedSessionBreakdown.map((session) => {
        const userStats = requestingUserSessionStats.get(
          session.threadSessionId,
        );
        const agentStats = agentSessionStats.get(session.threadSessionId);
        const agentRepeatAnalysis = agentRepeatAnalysisBySession.get(
          session.threadSessionId,
        ) ?? {
          status: "not_run" as const,
          errorMessage: null,
          repeatedAgentMessageCount: 0,
          repeatedCrossAgentMessageCount: 0,
          agentRepeatGroupCount: 0,
          repeatedAgentMessageGroups: [],
        };
        return {
          ...session,
          agentMessageCount: agentStats?.agentMessageCount ?? 0,
          requestingUserMessageCount:
            userStats?.requestingUserMessageCount ?? 0,
          requestingUserFirstMessageAt:
            userStats?.requestingUserFirstMessageAt ?? null,
          requestingUserLastMessageAt:
            userStats?.requestingUserLastMessageAt ?? null,
          medianMinutesSincePreviousMessage: median(
            userStats?.messageGapMinutes ?? [],
          ),
          medianMinutesSincePreviousAgentMessage: median(
            userStats?.agentGapMinutes ?? [],
          ),
          messagesAfterLongSilenceCount:
            userStats?.messagesAfterLongSilenceCount ?? 0,
          messagesAfterAgentSilenceCount:
            userStats?.messagesAfterAgentSilenceCount ?? 0,
          requestingUserAnalysis:
            requestingUserAnalysisBySession.get(session.threadSessionId) ??
            null,
          agentRepeatAnalysisStatus: agentRepeatAnalysis.status,
          agentRepeatAnalysisErrorMessage: agentRepeatAnalysis.errorMessage,
          repeatedAgentMessageCount:
            agentRepeatAnalysis.repeatedAgentMessageCount,
          repeatedCrossAgentMessageCount:
            agentRepeatAnalysis.repeatedCrossAgentMessageCount,
          agentRepeatGroupCount: agentRepeatAnalysis.agentRepeatGroupCount,
          repeatedAgentMessageGroups:
            agentRepeatAnalysis.repeatedAgentMessageGroups,
        };
      }),
    };
  }

  private normalizeAnalyticsMessageContent(message: MessageEntity) {
    const content = message.content?.trim();
    if (content) {
      return content;
    }
    if (message.type === "embedded_card") {
      return "[Embedded card]";
    }
    return `[${message.type || "message"}]`;
  }

  async getReadState(
    threadId: string,
    userId: string,
  ): Promise<ThreadReadStateEntity | null> {
    return this.readStateRepo.findOne({ where: { threadId, userId } });
  }

  async getAgentWorkCalendar(
    workspaceId: string,
    userId: string,
    query: {
      startDate?: string;
      endDate?: string;
      groupType?: string;
      activityGapMinutes?: number;
      timeZone?: string;
    },
  ) {
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      userId,
    );

    const days = buildDateRange(query.startDate, query.endDate);
    const startDate = days[0];
    const endDate = days[days.length - 1];
    const timeZone = isSupportedTimeZone(query.timeZone)
      ? query.timeZone!
      : "UTC";
    const activityGapMinutes = Math.max(1, query.activityGapMinutes ?? 30);
    const gapMs = activityGapMinutes * 60 * 1000;
    const daySet = new Set(days);
    const queryStart = new Date(`${startDate}T00:00:00.000Z`);
    const queryEnd = new Date(`${endDate}T23:59:59.999Z`);
    queryStart.setUTCDate(queryStart.getUTCDate() - 1);
    queryEnd.setUTCDate(queryEnd.getUTCDate() + 1);

    const agentQb = this.agentRepo
      .createQueryBuilder("agent")
      .leftJoinAndSelect("agent.team", "team")
      .leftJoinAndSelect("team.department", "teamDepartment")
      .where('agent."workspaceId" = :workspaceId', { workspaceId });

    if (query.groupType) {
      agentQb.andWhere('agent."groupType" = :groupType', {
        groupType: query.groupType,
      });
    }

    const agents = await agentQb
      .orderBy('agent."groupType"', "ASC")
      .addOrderBy('agent."name"', "ASC")
      .getMany();
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const agentIds = agents.map((agent) => agent.id);
    const agentDayStats = new Map<
      string,
      {
        totalMs: number;
        sessionKeys: Set<string>;
        messageCount: number;
      }
    >();

    const messages = agentIds.length
      ? await this.messageRepo
          .createQueryBuilder("message")
          .select([
            "message.id",
            "message.threadId",
            "message.senderId",
            "message.createdAt",
          ])
          .innerJoin(ThreadEntity, "thread", 'thread.id = message."threadId"')
          .where('thread."workspaceId" = :workspaceId', { workspaceId })
          .andWhere("thread.status != :archived", { archived: "archived" })
          .andWhere('message."senderId" IN (:...agentIds)', { agentIds })
          .andWhere('message."createdAt" >= :queryStart', { queryStart })
          .andWhere('message."createdAt" <= :queryEnd', { queryEnd })
          .orderBy('message."threadId"', "ASC")
          .addOrderBy('message."createdAt"', "ASC")
          .getMany()
      : [];

    const messagesByThread = new Map<string, MessageEntity[]>();
    for (const message of messages) {
      const threadMessages = messagesByThread.get(message.threadId) ?? [];
      threadMessages.push(message);
      messagesByThread.set(message.threadId, threadMessages);
    }

    for (const [threadId, threadMessages] of messagesByThread.entries()) {
      let period: {
        startedAt: Date;
        endedAt: Date;
        lastAt: Date;
        messages: MessageEntity[];
        agentIds: Set<string>;
      } | null = null;

      const flushPeriod = () => {
        if (!period || !period.agentIds.size) return;
        const periodStartMs = period.startedAt.getTime();
        const periodEndMs = period.endedAt.getTime();
        if (
          Number.isNaN(periodStartMs) ||
          Number.isNaN(periodEndMs) ||
          periodEndMs <= periodStartMs
        ) {
          return;
        }

        for (const agentId of period.agentIds) {
          const agentMessages = period.messages.filter(
            (message) => message.senderId === agentId,
          ).length;
          for (const allocation of allocatePeriodByDay(
            periodStartMs,
            periodEndMs,
            timeZone,
            daySet,
          )) {
            const key = `${agentId}:${allocation.date}`;
            const stat = agentDayStats.get(key) ?? {
              totalMs: 0,
              sessionKeys: new Set<string>(),
              messageCount: 0,
            };
            stat.totalMs += allocation.ms;
            stat.sessionKeys.add(
              `${threadId}:${period.startedAt.toISOString()}`,
            );
            stat.messageCount += agentMessages;
            agentDayStats.set(key, stat);
          }
        }
      };

      for (const message of threadMessages) {
        const createdAt = message.createdAt;
        const createdAtMs = createdAt.getTime();
        if (Number.isNaN(createdAtMs)) continue;

        if (!period) {
          period = {
            startedAt: createdAt,
            endedAt: createdAt,
            lastAt: createdAt,
            messages: [message],
            agentIds: new Set(
              agentsById.has(message.senderId) ? [message.senderId] : [],
            ),
          };
          continue;
        }

        if (createdAtMs - period.lastAt.getTime() > gapMs) {
          flushPeriod();
          period = {
            startedAt: createdAt,
            endedAt: createdAt,
            lastAt: createdAt,
            messages: [message],
            agentIds: new Set(
              agentsById.has(message.senderId) ? [message.senderId] : [],
            ),
          };
          continue;
        }

        period.endedAt = createdAt;
        period.lastAt = createdAt;
        period.messages.push(message);
        if (agentsById.has(message.senderId)) {
          period.agentIds.add(message.senderId);
        }
      }

      flushPeriod();
    }

    return {
      workspaceId,
      startDate,
      endDate,
      timeZone,
      groupType: query.groupType ?? null,
      activityGapMinutes,
      days,
      agents: agents.map((agent) => {
        const daysForAgent = days.map((date) => {
          const stat = agentDayStats.get(`${agent.id}:${date}`);
          return {
            date,
            minutesWorked: stat ? Math.round(stat.totalMs / 60000) : 0,
            sessionCount: stat?.sessionKeys.size ?? 0,
            messageCount: stat?.messageCount ?? 0,
          };
        });
        return {
          agentId: agent.id,
          agentName: agent.name,
          groupType: agent.groupType ?? "personal",
          groupLabel: agent.groupLabel ?? null,
          departmentId: agent.departmentId ?? agent.team?.departmentId ?? null,
          departmentName: agent.team?.department?.name ?? null,
          days: daysForAgent,
          totalMinutesWorked: daysForAgent.reduce(
            (sum, day) => sum + day.minutesWorked,
            0,
          ),
        };
      }),
    };
  }
}

function classifySenderKind(
  message: MessageEntity,
): "user" | "agent" | "system" {
  if (message.isFromUser) {
    return "user";
  }

  if (
    message.senderId === "system" ||
    message.provenance === MessageProvenance.MEETING_SYSTEM
  ) {
    return "system";
  }

  return "agent";
}

function isRequestingUserMessageForAnalytics(
  message: MessageEntity,
  userId: string,
  hasSingleRequestingUserParticipant: boolean,
) {
  if (!message.isFromUser) {
    return false;
  }

  if (message.senderId === userId) {
    return true;
  }

  // Older imported or pre-migration user messages can carry a stale sender id.
  // When the thread only has one human participant, we can safely attribute all
  // user-authored messages in that thread to the requesting user.
  return hasSingleRequestingUserParticipant;
}

function normalizeParticipantIds(participantIds: string[] | null | undefined) {
  return (participantIds ?? []).filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}

function selectSessionsForAgentRepeatAnalysis<
  T extends {
    threadSessionId: string;
    sequenceNumber: number | null;
    status: string | null;
  },
>(sessions: T[], requestedSessionId?: string | null) {
  if (requestedSessionId?.trim()) {
    const requestedSession = sessions.find(
      (session) => session.threadSessionId === requestedSessionId.trim(),
    );
    return requestedSession ? [requestedSession] : [];
  }
  return [];
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function diffMinutes(startedAt: string, endedAt: string): number {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0;
  }
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

function median(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
}

function buildDateRange(startDate?: string, endDate?: string) {
  const today = new Date();
  const defaultStart = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - ((today.getUTCDay() + 6) % 7),
    ),
  );
  const start = parseDateOnly(startDate) ?? defaultStart;
  const requestedEnd = parseDateOnly(endDate);
  const end = requestedEnd ?? new Date(start.getTime() + 6 * 86400000);
  const cappedEnd =
    end.getTime() < start.getTime()
      ? start
      : new Date(Math.min(end.getTime(), start.getTime() + 30 * 86400000));

  const days: string[] = [];
  for (
    let cursor = new Date(start);
    cursor.getTime() <= cappedEnd.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    days.push(toDateOnly(cursor));
  }
  return days.length ? days : [toDateOnly(defaultStart)];
}

function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isSupportedTimeZone(value?: string | null) {
  if (!value?.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function allocatePeriodByDay(
  startedAtMs: number,
  endedAtMs: number,
  timeZone: string,
  allowedDays: Set<string>,
) {
  const allocations = new Map<string, number>();
  let cursor = startedAtMs;
  while (cursor < endedAtMs) {
    const next = Math.min(cursor + 60000, endedAtMs);
    const date = formatDateInTimeZone(new Date(cursor), timeZone);
    if (allowedDays.has(date)) {
      allocations.set(date, (allocations.get(date) ?? 0) + next - cursor);
    }
    cursor = next;
  }
  return [...allocations.entries()].map(([date, ms]) => ({ date, ms }));
}
