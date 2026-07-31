import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  AgentEntity,
  ThreadAgentMembershipEntity,
  ThreadEntity,
} from "../../entities";

type ThreadLike = Pick<ThreadEntity, "id" | "workspaceId" | "agentIds">;

@Injectable()
export class ThreadMembershipService {
  constructor(
    @InjectRepository(ThreadAgentMembershipEntity)
    private readonly membershipRepo: Repository<ThreadAgentMembershipEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,
  ) {}

  normalizeAgentIds(agentIds?: string[] | null): string[] {
    return Array.from(new Set((agentIds ?? []).filter(Boolean)));
  }

  async listMemberIds(threadId: string): Promise<string[]> {
    const memberships = await this.membershipRepo.find({
      where: { threadId },
      order: { createdAt: "ASC", id: "ASC" },
    });
    return memberships.map((membership) => membership.agentId);
  }

  async listMemberAgents(threadId: string): Promise<AgentEntity[]> {
    return this.agentRepo
      .createQueryBuilder("agent")
      .innerJoin(
        ThreadAgentMembershipEntity,
        "membership",
        'membership."agentId" = agent.id AND membership."threadId" = :threadId',
        { threadId },
      )
      .orderBy('membership."createdAt"', "ASC")
      .addOrderBy("membership.id", "ASC")
      .getMany();
  }

  async isThreadMember(threadId: string, agentId: string): Promise<boolean> {
    const membership = await this.membershipRepo.findOne({
      where: { threadId, agentId },
      select: ["id"],
    });
    return Boolean(membership);
  }

  async syncMemberships(
    thread: Pick<ThreadEntity, "id" | "workspaceId">,
    agentIds?: string[] | null,
  ): Promise<string[]> {
    const normalizedAgentIds = this.normalizeAgentIds(agentIds);

    if (normalizedAgentIds.length) {
      const agents = await this.agentRepo.find({
        where: {
          id: In(normalizedAgentIds),
          workspaceId: thread.workspaceId,
          lifecycleStatus: "active",
        } as any,
        select: ["id"],
      });

      if (agents.length !== normalizedAgentIds.length) {
        const foundIds = new Set(agents.map((agent) => agent.id));
        const missingIds = normalizedAgentIds.filter(
          (agentId) => !foundIds.has(agentId),
        );
        throw new BadRequestException(
          `Invalid thread agent membership: ${missingIds.join(", ")}`,
        );
      }
    }

    const existingMemberships = await this.membershipRepo.find({
      where: { threadId: thread.id },
      select: ["id", "agentId"],
    });
    const existingIds = new Set(
      existingMemberships.map((membership) => membership.agentId),
    );
    const nextIds = new Set(normalizedAgentIds);

    const idsToRemove = existingMemberships
      .filter((membership) => !nextIds.has(membership.agentId))
      .map((membership) => membership.id);
    if (idsToRemove.length) {
      await this.membershipRepo.delete(idsToRemove);
    }

    const membershipsToAdd = normalizedAgentIds
      .filter((agentId) => !existingIds.has(agentId))
      .map((agentId) =>
        this.membershipRepo.create({
          threadId: thread.id,
          agentId,
          addedByUserId: null,
          addedByAgentId: null,
        }),
      );
    if (membershipsToAdd.length) {
      await this.membershipRepo.save(membershipsToAdd);
    }

    await this.threadRepo.update(thread.id, { agentIds: normalizedAgentIds });
    return normalizedAgentIds;
  }

  async hydrateThread<T extends ThreadLike>(thread: T): Promise<T> {
    const membershipAgentIds = await this.listMemberIds(thread.id);
    const agentIds = membershipAgentIds.length
      ? membershipAgentIds
      : this.normalizeAgentIds(thread.agentIds);
    return { ...thread, agentIds };
  }

  async hydrateThreads<T extends ThreadLike>(threads: T[]): Promise<T[]> {
    if (!threads.length) return threads;

    const threadIds = threads.map((thread) => thread.id);
    const memberships = await this.membershipRepo.find({
      where: { threadId: In(threadIds) },
      order: { createdAt: "ASC", id: "ASC" },
      select: ["threadId", "agentId"],
    });

    const membershipMap = new Map<string, string[]>();
    for (const membership of memberships) {
      const current = membershipMap.get(membership.threadId) ?? [];
      current.push(membership.agentId);
      membershipMap.set(membership.threadId, current);
    }

    return threads.map((thread) => {
      const membershipAgentIds = membershipMap.get(thread.id) ?? [];
      return {
        ...thread,
        agentIds: membershipAgentIds.length
          ? membershipAgentIds
          : this.normalizeAgentIds(thread.agentIds),
      };
    });
  }

  async findDirectThreadForParticipant(
    workspaceId: string,
    participantId: string,
  ) {
    return this.threadRepo
      .createQueryBuilder("thread")
      .leftJoin(
        ThreadAgentMembershipEntity,
        "membership",
        'membership."threadId" = thread.id',
      )
      .where('thread."workspaceId" = :workspaceId', { workspaceId })
      .andWhere("thread.type = :type", { type: "direct" })
      .andWhere(
        '(thread."participantIds" @> :participantJson OR membership."agentId" = :participantId)',
        {
          participantJson: JSON.stringify([participantId]),
          participantId,
        },
      )
      .orderBy('thread."updatedAt"', "DESC")
      .getOne();
  }
}
