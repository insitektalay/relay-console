import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WorkLogEntity } from "../../entities/work-log.entity";
import { paginate } from "../../common/dto/pagination.dto";
import { ResourceAccessService } from "../resource-access/resource-access.service";
import {
  CreateWorkLogDto,
  WorkLogQueryDto,
} from "./dto/worklogs.dto";

interface InternalWorkLogInput extends CreateWorkLogDto {
  timestamp?: Date;
}

const MAX_METADATA_BYTES = 16 * 1024;

@Injectable()
export class WorkLogsService {
  constructor(
    @InjectRepository(WorkLogEntity)
    private readonly workLogRepo: Repository<WorkLogEntity>,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async findAll(
    filters: WorkLogQueryDto,
    userId: string,
  ) {
    const {
      workspaceId,
      agentId,
      teamId,
      taskId,
      runId,
      from,
      to,
      page = 1,
      pageSize = 20,
    } = filters;
    const scopedWorkspaceId = await this.resolveWorkspaceScope(
      { workspaceId, agentId, teamId, taskId, runId },
      userId,
    );
    const qb = this.workLogRepo.createQueryBuilder("wl");

    qb.innerJoin("agents", "agent_scope", 'agent_scope.id = wl."agentId"');
    qb.andWhere('agent_scope."workspaceId" = :scopedWorkspaceId', {
      scopedWorkspaceId,
    });
    if (agentId) qb.andWhere('wl."agentId" = :agentId', { agentId });
    if (teamId) qb.andWhere('agent_scope."teamId" = :teamId', { teamId });
    if (taskId) qb.andWhere('wl."taskId" = :taskId', { taskId });
    if (runId) qb.andWhere('wl."runId" = :runId', { runId });
    if (from) qb.andWhere("wl.timestamp >= :from", { from: new Date(from) });
    if (to) qb.andWhere("wl.timestamp <= :to", { to: new Date(to) });

    qb.orderBy("wl.timestamp", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async create(
    data: CreateWorkLogDto,
    userId?: string,
  ): Promise<WorkLogEntity> {
    if (!data.agentId) {
      throw new BadRequestException("agentId is required");
    }

    if (userId) {
      await this.resolveWorkspaceScope(
        {
          agentId: data.agentId,
          taskId: data.taskId ?? undefined,
          runId: data.runId ?? undefined,
        },
        userId,
      );
    }
    this.assertMetadataSize(data.metadata);

    const log = this.workLogRepo.create({
      id: randomUUID(),
      agentId: data.agentId,
      taskId: data.taskId ?? null,
      runId: data.runId ?? null,
      action: data.action,
      details: data.details,
      timestamp: new Date(),
      durationMinutes: data.durationMinutes ?? null,
      metadata: data.metadata ?? {},
    });
    await this.workLogRepo.insert(log);
    return log;
  }

  async getAgentLogs(
    agentId: string,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    return this.findAll({ agentId, page, pageSize }, userId);
  }

  async getTaskLogs(taskId: string, userId: string) {
    const task = await this.resourceAccessService.ensureTaskAccess(
      taskId,
      userId,
    );
    return this.workLogRepo
      .createQueryBuilder("wl")
      .innerJoin("agents", "agent_scope", 'agent_scope.id = wl."agentId"')
      .where('wl."taskId" = :taskId', { taskId })
      .andWhere('agent_scope."workspaceId" = :scopedWorkspaceId', {
        scopedWorkspaceId: task.workspaceId,
      })
      .orderBy("wl.timestamp", "DESC")
      .getMany();
  }

  async bulkCreate(items: InternalWorkLogInput[]): Promise<WorkLogEntity[]> {
    const logs = items.map((item) => {
      if (!item.agentId) {
        throw new BadRequestException("agentId is required");
      }
      this.assertMetadataSize(item.metadata);
      return this.workLogRepo.create({
        id: randomUUID(),
        agentId: item.agentId,
        taskId: item.taskId ?? null,
        runId: item.runId ?? null,
        action: item.action,
        details: item.details,
        timestamp: item.timestamp ?? new Date(),
        durationMinutes: item.durationMinutes ?? null,
        metadata: item.metadata ?? {},
      });
    });
    if (logs.length > 0) {
      await this.workLogRepo.insert(logs);
    }
    return logs;
  }

  private assertMetadataSize(metadata?: Record<string, unknown>) {
    if (
      metadata &&
      Buffer.byteLength(JSON.stringify(metadata), "utf8") > MAX_METADATA_BYTES
    ) {
      throw new BadRequestException(
        `metadata must not exceed ${MAX_METADATA_BYTES} bytes`,
      );
    }
  }

  private async resolveWorkspaceScope(
    filters: {
      workspaceId?: string;
      agentId?: string;
      teamId?: string;
      taskId?: string;
      runId?: string;
    },
    userId: string,
  ) {
    let scopedWorkspaceId: string | null = null;

    const addScope = (source: string, workspaceId?: string | null) => {
      if (!workspaceId) {
        throw new BadRequestException(
          `${source} does not resolve to a workspace`,
        );
      }

      if (scopedWorkspaceId && scopedWorkspaceId !== workspaceId) {
        throw new BadRequestException(
          "Work log filters must resolve to one workspace",
        );
      }

      scopedWorkspaceId = workspaceId;
    };

    if (filters.workspaceId) {
      await this.resourceAccessService.ensureWorkspaceAccess(
        filters.workspaceId,
        userId,
      );
      addScope("workspaceId", filters.workspaceId);
    }

    if (filters.agentId) {
      const agent = await this.resourceAccessService.ensureAgentAccess(
        filters.agentId,
        userId,
      );
      addScope("agentId", agent.workspaceId);
    }

    if (filters.teamId) {
      const teamWorkspaceId =
        await this.resourceAccessService.getTeamWorkspaceId(filters.teamId);
      await this.resourceAccessService.ensureWorkspaceAccess(
        teamWorkspaceId,
        userId,
      );
      addScope("teamId", teamWorkspaceId);
    }

    if (filters.taskId) {
      const task = await this.resourceAccessService.ensureTaskAccess(
        filters.taskId,
        userId,
      );
      addScope("taskId", task.workspaceId);
    }

    if (filters.runId) {
      const { task } = await this.resourceAccessService.ensureRunAccess(
        filters.runId,
        userId,
      );
      addScope("runId", task.workspaceId);
    }

    if (!scopedWorkspaceId) {
      throw new BadRequestException("A workspace-scoped filter is required");
    }

    return scopedWorkspaceId;
  }
}
