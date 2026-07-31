import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RuntimeThreadSessionEntity } from "../../entities/runtime-thread-session.entity";

export interface EnsureRuntimeThreadSessionInput {
  id?: string;
  workspaceId: string;
  threadId: string;
  threadSessionId: string;
  agentId: string;
  runtimeBindingId: string;
  runtimeSessionId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class RuntimeThreadSessionService {
  constructor(
    @InjectRepository(RuntimeThreadSessionEntity)
    private readonly runtimeThreadSessionRepo: Repository<RuntimeThreadSessionEntity>,
  ) {}

  async findByThreadSessionAndAgent(
    threadSessionId: string,
    agentId: string,
  ): Promise<RuntimeThreadSessionEntity | null> {
    return this.runtimeThreadSessionRepo.findOne({
      where: { threadSessionId, agentId },
    });
  }

  async ensure(input: EnsureRuntimeThreadSessionInput) {
    const existing = await this.findByThreadSessionAndAgent(
      input.threadSessionId,
      input.agentId,
    );
    if (existing) {
      if (input.metadata && Object.keys(input.metadata).length) {
        await this.runtimeThreadSessionRepo.update(existing.id, {
          metadata: {
            ...(existing.metadata ?? {}),
            ...input.metadata,
          },
          lastActivityAt: new Date(),
        });
        return (
          (await this.findByThreadSessionAndAgent(
            input.threadSessionId,
            input.agentId,
          )) ?? existing
        );
      }
      return existing;
    }

    return this.runtimeThreadSessionRepo.save(
      this.runtimeThreadSessionRepo.create({
        id: input.id,
        workspaceId: input.workspaceId,
        threadId: input.threadId,
        threadSessionId: input.threadSessionId,
        agentId: input.agentId,
        runtimeBindingId: input.runtimeBindingId,
        runtimeSessionId: input.runtimeSessionId ?? randomUUID(),
        status: "active",
        metadata: input.metadata ?? {},
      }),
    );
  }

  async findById(id: string): Promise<RuntimeThreadSessionEntity | null> {
    return this.runtimeThreadSessionRepo.findOne({ where: { id } });
  }

  async touch(
    id: string,
    data: Partial<RuntimeThreadSessionEntity> = {},
  ): Promise<void> {
    await this.runtimeThreadSessionRepo.update(id, {
      ...data,
      lastActivityAt: data.lastActivityAt ?? new Date(),
    });
  }

  async markError(
    id: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    await this.runtimeThreadSessionRepo.update(id, {
      status: "error",
      lastErrorCode: errorCode,
      lastErrorMessage: errorMessage,
      lastActivityAt: new Date(),
    });
  }

  async closeByThreadSession(
    threadSessionId: string,
    reason?: string,
  ): Promise<void> {
    await this.runtimeThreadSessionRepo
      .createQueryBuilder()
      .update(RuntimeThreadSessionEntity)
      .set({
        status: "closed",
        closedAt: new Date(),
        lastErrorCode: reason ? "session_closed" : undefined,
        lastErrorMessage: reason ?? undefined,
        lastActivityAt: new Date(),
      })
      .where('"threadSessionId" = :threadSessionId', { threadSessionId })
      .andWhere("status != :status", { status: "closed" })
      .execute();
  }

  async closeForThread(input: {
    threadId: string;
    threadSessionId?: string | null;
    agentIds?: string[];
    reason?: string | null;
  }): Promise<void> {
    const qb = this.runtimeThreadSessionRepo
      .createQueryBuilder()
      .update(RuntimeThreadSessionEntity)
      .set({
        status: "closed",
        closedAt: new Date(),
        lastErrorCode: input.reason ? "closed" : undefined,
        lastErrorMessage: input.reason ?? undefined,
        lastActivityAt: new Date(),
      })
      .where('"threadId" = :threadId', { threadId: input.threadId })
      .andWhere("status = :status", { status: "active" });

    if (input.threadSessionId) {
      qb.andWhere('"threadSessionId" = :threadSessionId', {
        threadSessionId: input.threadSessionId,
      });
    }

    if (input.agentIds?.length) {
      qb.andWhere('"agentId" IN (:...agentIds)', { agentIds: input.agentIds });
    }

    await qb.execute();
  }
}
