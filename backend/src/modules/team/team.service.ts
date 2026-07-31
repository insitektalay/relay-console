import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TeamEntity } from "../../entities/team.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { TaskEntity } from "../../entities/task.entity";
import { ApprovalEntity } from "../../entities/approval.entity";
import { IncidentEntity } from "../../entities/incident.entity";
import { HandoverNoteEntity } from "../../entities/handover-note.entity";
import { PerformanceMetricEntity } from "../../entities/performance-metric.entity";
import { TeamMemoryItemEntity } from "../../entities/team-memory-item.entity";
import { paginate } from "../../common/dto/pagination.dto";
import {
  CreateTeamDto,
  CreateTeamMemoryItemDto,
  TeamAgentQueryDto,
  TeamListQueryDto,
  TeamMemoryQueryDto,
  UpdateTeamDto,
  UpdateTeamMemoryItemDto,
} from "./dto/team.dto";
import { ResourceAccessService } from "../resource-access/resource-access.service";

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly teamRepo: Repository<TeamEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(ApprovalEntity)
    private readonly approvalRepo: Repository<ApprovalEntity>,

    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,

    @InjectRepository(HandoverNoteEntity)
    private readonly handoverRepo: Repository<HandoverNoteEntity>,

    @InjectRepository(PerformanceMetricEntity)
    private readonly metricsRepo: Repository<PerformanceMetricEntity>,

    @InjectRepository(TeamMemoryItemEntity)
    private readonly memoryRepo: Repository<TeamMemoryItemEntity>,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async findAll(
    filters: TeamListQueryDto,
    userId: string,
  ) {
    if (filters.departmentId) {
      await this.resourceAccessService.ensureDepartmentAccess(
        filters.departmentId,
        userId,
      );
      if (filters.workspaceId) {
        const departmentWorkspaceId =
          await this.resourceAccessService.getDepartmentWorkspaceId(
            filters.departmentId,
          );
        if (departmentWorkspaceId !== filters.workspaceId) {
          throw new BadRequestException(
            "workspaceId and departmentId must belong to the same workspace",
          );
        }
        await this.resourceAccessService.ensureWorkspaceAccess(
          filters.workspaceId,
          userId,
        );
      }
    } else if (filters.workspaceId) {
      await this.resourceAccessService.ensureWorkspaceAccess(
        filters.workspaceId,
        userId,
      );
    } else {
      throw new NotFoundException("workspaceId or departmentId is required");
    }

    const qb = this.teamRepo
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.department", "dept")
      .leftJoinAndSelect("dept.company", "company");

    if (filters.departmentId) {
      qb.andWhere('t."departmentId" = :departmentId', {
        departmentId: filters.departmentId,
      });
    } else if (filters.workspaceId) {
      qb.andWhere('company."workspaceId" = :workspaceId', {
        workspaceId: filters.workspaceId,
      });
    }

    const teams = await qb.getMany();

    return Promise.all(
      teams.map(async (team) => {
        const agentCount = await this.agentRepo.count({
          where: { teamId: team.id },
        });
        return { ...team, agentCount };
      }),
    );
  }

  async findOne(id: string, userId: string) {
    await this.resourceAccessService.ensureTeamAccess(id, userId);
    const team = await this.teamRepo
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.department", "dept")
      .leftJoinAndSelect("dept.company", "company")
      .leftJoinAndSelect("t.agents", "agents")
      .where("t.id = :id", { id })
      .getOne();

    if (!team) throw new NotFoundException("Team not found");
    return team;
  }

  async getDashboard(teamId: string, userId: string) {
    const team = await this.findOne(teamId, userId);
    const agentIds = team.agents.map((a) => a.id);

    const [
      runningTasks,
      blockedTasks,
      pendingApprovals,
      recentIncidents,
      recentHandovers,
    ] = await Promise.all([
      this.taskRepo
        .createQueryBuilder("t")
        .where('t."teamId" = :teamId', { teamId })
        .andWhere("t.status = :status", { status: "running" })
        .limit(20)
        .getMany(),
      this.taskRepo
        .createQueryBuilder("t")
        .where('t."teamId" = :teamId', { teamId })
        .andWhere("t.status = :status", { status: "blocked" })
        .limit(20)
        .getMany(),
      this.approvalRepo
        .createQueryBuilder("a")
        .where('a."requestedByAgentId" IN (:...agentIds)', {
          agentIds: agentIds.length ? agentIds : [""],
        })
        .andWhere("a.status = :status", { status: "pending" })
        .orderBy('a."createdAt"', "DESC")
        .limit(10)
        .getMany(),
      this.incidentRepo
        .createQueryBuilder("i")
        .where('i."teamId" = :teamId', { teamId })
        .orderBy('i."createdAt"', "DESC")
        .limit(5)
        .getMany(),
      this.handoverRepo
        .createQueryBuilder("h")
        .where('h."toTeamId" = :teamId', { teamId })
        .orderBy('h."createdAt"', "DESC")
        .limit(5)
        .getMany(),
    ]);

    const perfMetrics = agentIds.length
      ? await this.metricsRepo
          .createQueryBuilder("m")
          .where('m."agentId" IN (:...agentIds)', { agentIds })
          .andWhere("m.period = :period", { period: "daily" })
          .orderBy('m."periodStart"', "DESC")
          .limit(agentIds.length)
          .getMany()
      : [];

    const performanceSummary = perfMetrics.reduce(
      (acc, m) => {
        acc.tasksCompleted += m.tasksCompleted;
        acc.tasksFailed += m.tasksFailed;
        acc.totalMinutesWorked += m.totalMinutesWorked;
        return acc;
      },
      { tasksCompleted: 0, tasksFailed: 0, totalMinutesWorked: 0 },
    );

    return {
      team,
      agents: team.agents,
      runningTasks,
      blockedTasks,
      pendingApprovals,
      recentIncidents,
      recentHandovers,
      performanceSummary,
    };
  }

  async create(dto: CreateTeamDto, userId: string) {
    const department =
      await this.resourceAccessService.ensureDepartmentAdminAccess(
        dto.departmentId,
        userId,
      );
    const workspaceId =
      await this.resourceAccessService.getDepartmentWorkspaceId(
        dto.departmentId,
      );
    const leadAgentId =
      this.optionalId(dto.leadAgentId) ??
      this.optionalId(department.headAgentId);
    if (leadAgentId) {
      await this.resourceAccessService.assertAgentInWorkspace(
        leadAgentId,
        workspaceId,
        "Team lead agent",
      );
    }
    const team = this.teamRepo.create({
      id: randomUUID(),
      name: dto.name,
      departmentId: dto.departmentId,
      leadAgentId,
      description: dto.description ?? null,
      color: dto.color ?? "#30D158",
    });
    await this.teamRepo.insert(team);
    return this.teamRepo.findOneByOrFail({
      id: team.id,
      departmentId: dto.departmentId,
    });
  }

  async update(id: string, dto: UpdateTeamDto, userId: string) {
    const team = await this.resourceAccessService.ensureTeamAdminAccess(
      id,
      userId,
    );
    if (dto.leadAgentId !== undefined) {
      const leadAgentId = this.optionalId(dto.leadAgentId);
      if (leadAgentId) {
        const workspaceId =
          await this.resourceAccessService.getTeamWorkspaceId(id);
        await this.resourceAccessService.assertAgentInWorkspace(
          leadAgentId,
          workspaceId,
          "Team lead agent",
        );
      }
    }
    const patch: Partial<TeamEntity> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.color !== undefined) patch.color = dto.color;
    if (dto.leadAgentId !== undefined) {
      patch.leadAgentId = this.optionalId(dto.leadAgentId);
    }
    if (Object.keys(patch).length > 0) {
      await this.teamRepo.update(
        { id: team.id, departmentId: team.departmentId },
        patch,
      );
    }
    return this.teamRepo.findOneByOrFail({
      id: team.id,
      departmentId: team.departmentId,
    });
  }

  async delete(id: string, userId: string) {
    const team = await this.resourceAccessService.ensureTeamAdminAccess(
      id,
      userId,
    );
    await this.teamRepo.delete({
      id: team.id,
      departmentId: team.departmentId,
    });
    return { success: true };
  }

  async getAgents(
    teamId: string,
    userId: string,
    filters: TeamAgentQueryDto,
  ) {
    await this.resourceAccessService.ensureTeamAccess(teamId, userId);
    const { status, page = 1, pageSize = 20 } = filters;
    const qb = this.agentRepo
      .createQueryBuilder("a")
      .where('a."teamId" = :teamId', { teamId });
    if (status) qb.andWhere("a.status = :status", { status });
    qb.orderBy("a.name", "ASC")
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async getHandovers(
    teamId: string,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    await this.resourceAccessService.ensureTeamAccess(teamId, userId);
    const qb = this.handoverRepo
      .createQueryBuilder("h")
      .where('h."toTeamId" = :teamId', { teamId })
      .orderBy('h."createdAt"', "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  // --- Team Memory ---

  async findMemory(
    teamId: string,
    userId: string,
    filters: TeamMemoryQueryDto,
  ) {
    await this.resourceAccessService.ensureTeamAccess(teamId, userId);
    const { type, search, page = 1, pageSize = 20 } = filters;
    const qb = this.memoryRepo
      .createQueryBuilder("m")
      .where('m."teamId" = :teamId', { teamId });
    if (type) qb.andWhere("m.type = :type", { type });
    if (search)
      qb.andWhere("(m.title ILIKE :s OR m.content ILIKE :s)", {
        s: `%${search}%`,
      });
    qb.orderBy('m."createdAt"', "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async findMemoryItem(teamId: string, id: string, userId: string) {
    await this.resourceAccessService.ensureTeamAccess(teamId, userId);
    return this.findMemoryItemInTeam(teamId, id);
  }

  async createMemoryItem(
    teamId: string,
    dto: CreateTeamMemoryItemDto,
    userId: string,
  ) {
    await this.resourceAccessService.ensureTeamAdminAccess(teamId, userId);
    const item = this.memoryRepo.create({
      id: randomUUID(),
      teamId,
      title: dto.title,
      content: dto.content,
      type: dto.type,
      tags: dto.tags ?? [],
      createdById: userId,
    });
    await this.memoryRepo.insert(item);
    return this.memoryRepo.findOneByOrFail({ id: item.id, teamId });
  }

  async updateMemoryItem(
    teamId: string,
    id: string,
    dto: UpdateTeamMemoryItemDto,
    userId: string,
  ) {
    await this.resourceAccessService.ensureTeamAdminAccess(teamId, userId);
    const item = await this.findMemoryItemInTeam(teamId, id);
    const patch: Partial<TeamMemoryItemEntity> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.content !== undefined) patch.content = dto.content;
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.tags !== undefined) patch.tags = dto.tags;
    if (Object.keys(patch).length > 0) {
      await this.memoryRepo.update(
        { id: item.id, teamId: item.teamId },
        patch,
      );
    }
    return this.memoryRepo.findOneByOrFail({
      id: item.id,
      teamId: item.teamId,
    });
  }

  async deleteMemoryItem(teamId: string, id: string, userId: string) {
    await this.resourceAccessService.ensureTeamAdminAccess(teamId, userId);
    const item = await this.findMemoryItemInTeam(teamId, id);
    await this.memoryRepo.delete({ id: item.id, teamId: item.teamId });
    return { success: true };
  }

  private async findMemoryItemInTeam(teamId: string, id: string) {
    const item = await this.memoryRepo.findOne({ where: { id, teamId } });
    if (!item) throw new NotFoundException("Team memory item not found");
    return item;
  }

  private optionalId(value?: string | null) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}
