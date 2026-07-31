import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  MessageEntity,
  MessageProvenance,
  ThreadEntity,
  ThreadSessionEntity,
} from "../../entities";

export const TEAM_RELAY_DEFAULT_REPLY_LIMIT = 50;
export const TEAM_RELAY_REPLY_LIMIT_PRESETS = [
  25, 50, 100, 200, 400, 800, 1500, 3000, 5000, 10000,
] as const;

export function normalizeTeamRelayReplyLimit(value: number) {
  if (!Number.isFinite(value)) return TEAM_RELAY_DEFAULT_REPLY_LIMIT;
  return Math.min(100_000, Math.max(1, Math.trunc(value)));
}

@Injectable()
export class ThreadSessionService {
  constructor(
    @InjectRepository(ThreadSessionEntity)
    private readonly threadSessionRepo: Repository<ThreadSessionEntity>,

    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,

    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
  ) {}

  async ensureActiveSession(
    thread: ThreadEntity,
  ): Promise<ThreadSessionEntity> {
    if (thread.activeSessionId) {
      const existing = await this.threadSessionRepo.findOne({
        where: { id: thread.activeSessionId, threadId: thread.id },
      });
      if (existing?.status === "active") {
        return existing;
      }
    }

    const current = await this.threadSessionRepo.findOne({
      where: { threadId: thread.id, status: "active" },
      order: { sequenceNumber: "DESC" },
    });

    if (current) {
      await this.threadRepo.update(thread.id, { activeSessionId: current.id });
      thread.activeSessionId = current.id;
      return current;
    }

    const sequenceNumber = await this.getNextSequenceNumber(thread.id);
    const created = await this.threadSessionRepo.save(
      this.threadSessionRepo.create({
        threadId: thread.id,
        sequenceNumber,
        status: "active",
        startedAt: new Date(),
        endedAt: null,
        relayRunState: "running",
        relayPauseReason: null,
        relayCatchUpCursors: {},
        relayReplyLimit: normalizeTeamRelayReplyLimit(
          thread.maxAgentTurns ?? TEAM_RELAY_DEFAULT_REPLY_LIMIT,
        ),
      }),
    );

    await this.threadRepo.update(thread.id, { activeSessionId: created.id });
    thread.activeSessionId = created.id;
    return created;
  }

  async getActiveSession(threadId: string): Promise<ThreadSessionEntity> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    return this.ensureActiveSession(thread);
  }

  async findThreadSession(
    threadId: string,
    threadSessionId: string,
  ): Promise<ThreadSessionEntity | null> {
    return this.threadSessionRepo.findOne({
      where: { id: threadSessionId, threadId },
    });
  }

  async updateRelayControls(
    session: ThreadSessionEntity,
    input: {
      runState: "running" | "paused";
      pauseReason: "manual" | "reply_limit" | null;
      replyLimit?: number;
    },
  ) {
    session.relayRunState = input.runState;
    session.relayPauseReason = input.pauseReason;
    if (input.replyLimit !== undefined) {
      session.relayReplyLimit = normalizeTeamRelayReplyLimit(input.replyLimit);
    }
    return this.threadSessionRepo.save(session);
  }

  async countAgentReplies(threadId: string, threadSessionId: string) {
    return this.messageRepo.count({
      where: {
        threadId,
        threadSessionId,
        provenance: MessageProvenance.AGENT,
      },
    });
  }

  async updateRelayCatchUpCursor(
    session: ThreadSessionEntity,
    agentId: string,
    cursor: { messageId: string; createdAt: string },
  ) {
    session.relayCatchUpCursors = {
      ...(session.relayCatchUpCursors ?? {}),
      [agentId]: cursor,
    };
    return this.threadSessionRepo.save(session);
  }

  async createInitialSession(threadId: string): Promise<ThreadSessionEntity> {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    const session = await this.threadSessionRepo.save(
      this.threadSessionRepo.create({
        threadId,
        sequenceNumber: 1,
        status: "active",
        startedAt: new Date(),
        endedAt: null,
        relayRunState: "running",
        relayPauseReason: null,
        relayCatchUpCursors: {},
        relayReplyLimit: normalizeTeamRelayReplyLimit(
          thread.maxAgentTurns ?? TEAM_RELAY_DEFAULT_REPLY_LIMIT,
        ),
      }),
    );

    await this.threadRepo.update(threadId, { activeSessionId: session.id });
    return session;
  }

  async wrapUpActiveSession(thread: ThreadEntity) {
    const activeSession = await this.ensureActiveSession(thread);
    activeSession.status = "wrapped_up";
    activeSession.endedAt = new Date();
    await this.threadSessionRepo.save(activeSession);

    const nextSession = await this.threadSessionRepo.save(
      this.threadSessionRepo.create({
        threadId: thread.id,
        sequenceNumber: activeSession.sequenceNumber + 1,
        status: "active",
        startedAt: new Date(),
        endedAt: null,
        relayRunState: "running",
        relayPauseReason: null,
        relayCatchUpCursors: {},
        relayReplyLimit: normalizeTeamRelayReplyLimit(
          thread.maxAgentTurns ?? TEAM_RELAY_DEFAULT_REPLY_LIMIT,
        ),
      }),
    );

    thread.activeSessionId = nextSession.id;
    await this.threadRepo.save(thread);

    return { wrappedSession: activeSession, activeSession: nextSession };
  }

  private async getNextSequenceNumber(threadId: string): Promise<number> {
    const latest = await this.threadSessionRepo.findOne({
      where: { threadId },
      order: { sequenceNumber: "DESC" },
    });
    return (latest?.sequenceNumber ?? 0) + 1;
  }
}
