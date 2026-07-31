import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { DepartmentEntity } from "../../entities/department.entity";
import { TeamEntity } from "../../entities/team.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { TaskEntity } from "../../entities/task.entity";
import { ApprovalEntity } from "../../entities/approval.entity";
import { IncidentEntity } from "../../entities/incident.entity";
import { AlertEntity } from "../../entities/alert.entity";
import { CompanyEntity } from "../../entities/company.entity";
import { paginate } from "../../common/dto/pagination.dto";
import { CreateDepartmentDto, UpdateDepartmentDto } from "./dto/department.dto";
import { ResourceAccessService } from "../resource-access/resource-access.service";

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(DepartmentEntity)
    private readonly deptRepo: Repository<DepartmentEntity>,

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

    @InjectRepository(AlertEntity)
    private readonly alertRepo: Repository<AlertEntity>,

    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async findAll(
    filters: { workspaceId?: string; companyId?: string },
    userId: string,
  ) {
    if (filters.companyId) {
      await this.resourceAccessService.ensureCompanyAccess(
        filters.companyId,
        userId,
      );
    } else if (filters.workspaceId) {
      await this.resourceAccessService.ensureWorkspaceAccess(
        filters.workspaceId,
        userId,
      );
    } else {
      throw new NotFoundException("workspaceId or companyId is required");
    }

    let relatedCompanies: CompanyEntity[] = [];
    if (filters.companyId) {
      const company = await this.companyRepo.findOne({
        where: { id: filters.companyId },
      });
      if (company) relatedCompanies = [company];
    } else if (filters.workspaceId) {
      relatedCompanies = await this.companyRepo.find({
        where: { workspaceId: filters.workspaceId },
      });
    }

    const relatedCompanyIds = relatedCompanies.map((company) => company.id);
    const where = filters.companyId
      ? [{ companyId: filters.companyId }]
      : [
          { workspaceId: filters.workspaceId },
          ...(relatedCompanyIds.length
            ? [{ companyId: In(relatedCompanyIds) }]
            : []),
        ];

    const depts = await this.deptRepo.find({
      where,
      order: { name: "ASC" },
    });
    const companiesById = new Map(
      relatedCompanies.map((company) => [company.id, company]),
    );

    return Promise.all(
      depts.map(async (dept) => {
        const [teamCount, agentCount] = await Promise.all([
          this.teamRepo.count({ where: { departmentId: dept.id } }),
          this.agentRepo.count({ where: { departmentId: dept.id } }),
        ]);
        return {
          ...dept,
          company: dept.companyId
            ? companiesById.get(dept.companyId)
            : undefined,
          teamCount,
          agentCount,
        };
      }),
    );
  }

  async findOne(id: string, userId: string) {
    await this.resourceAccessService.ensureDepartmentAccess(id, userId);
    const dept = await this.deptRepo
      .createQueryBuilder("d")
      .leftJoinAndSelect("d.company", "company")
      .leftJoinAndSelect("d.teams", "teams")
      .leftJoinAndSelect("teams.agents", "agents")
      .where("d.id = :id", { id })
      .getOne();

    if (!dept) throw new NotFoundException("Department not found");
    return dept;
  }

  async getDashboard(departmentId: string, userId: string) {
    const dept = await this.findOne(departmentId, userId);
    const teamIds = dept.teams.map((t) => t.id);

    const [runningTasks, blockedTasks, pendingApprovals, openIncidents] =
      await Promise.all([
        teamIds.length
          ? this.taskRepo
              .createQueryBuilder("t")
              .where('t."teamId" IN (:...teamIds)', { teamIds })
              .andWhere("t.status = :status", { status: "running" })
              .getMany()
          : [],
        teamIds.length
          ? this.taskRepo
              .createQueryBuilder("t")
              .where('t."teamId" IN (:...teamIds)', { teamIds })
              .andWhere("t.status = :status", { status: "blocked" })
              .getMany()
          : [],
        teamIds.length
          ? this.approvalRepo
              .createQueryBuilder("a")
              .where('a."teamId" IN (:...teamIds)', { teamIds })
              .andWhere("a.status = :status", { status: "pending" })
              .getMany()
          : [],
        this.incidentRepo
          .createQueryBuilder("i")
          .where('i."departmentId" = :departmentId', { departmentId })
          .andWhere("i.status = :status", { status: "open" })
          .orderBy('i."createdAt"', "DESC")
          .limit(10)
          .getMany(),
      ]);

    return {
      department: dept,
      teams: dept.teams,
      runningTasks,
      blockedTasks,
      pendingApprovals,
      openIncidents,
    };
  }

  async getDepartmentInbox(
    departmentId: string,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    await this.resourceAccessService.ensureDepartmentAccess(
      departmentId,
      userId,
    );
    const dept = await this.deptRepo
      .createQueryBuilder("department")
      .leftJoinAndSelect("department.company", "company")
      .where("department.id = :departmentId", { departmentId })
      .getOne();
    if (!dept) throw new NotFoundException("Department not found");
    const workspaceId = dept.workspaceId ?? dept.company?.workspaceId ?? null;
    if (!workspaceId)
      throw new NotFoundException("Department workspace not found");

    const qb = this.alertRepo
      .createQueryBuilder("a")
      .where('a."workspaceId" = :workspaceId', { workspaceId })
      .orderBy('a."createdAt"', "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async create(dto: CreateDepartmentDto, userId: string) {
    let workspaceId = this.optionalId(dto.workspaceId);
    if (!workspaceId && dto.companyId) {
      workspaceId = await this.resourceAccessService.getCompanyWorkspaceId(
        dto.companyId,
      );
    } else if (workspaceId && dto.companyId) {
      await this.resourceAccessService.assertCompanyInWorkspace(
        dto.companyId,
        workspaceId,
      );
    }
    if (!workspaceId) {
      throw new NotFoundException("Department workspace not found");
    }
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      workspaceId,
      userId,
    );
    const headAgentId = this.optionalId(dto.headAgentId);
    if (headAgentId) {
      await this.resourceAccessService.assertAgentInWorkspace(
        headAgentId,
        workspaceId,
        "Department head agent",
      );
    }
    const dept = this.deptRepo.create({ ...dto, workspaceId });
    const saved = await this.deptRepo.save(dept);
    if (saved.headAgentId) {
      await this.syncDepartmentTeamsToManager(saved.id, saved.headAgentId);
    }
    return saved;
  }

  async update(id: string, dto: UpdateDepartmentDto, userId: string) {
    await this.resourceAccessService.ensureDepartmentAdminAccess(id, userId);
    const dept = await this.deptRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException("Department not found");
    if (dto.headAgentId !== undefined) {
      const headAgentId = this.optionalId(dto.headAgentId);
      if (headAgentId) {
        const workspaceId =
          await this.resourceAccessService.getDepartmentWorkspaceId(id);
        await this.resourceAccessService.assertAgentInWorkspace(
          headAgentId,
          workspaceId,
          "Department head agent",
        );
      }
    }
    Object.assign(dept, dto);
    const saved = await this.deptRepo.save(dept);
    if (dto.headAgentId !== undefined) {
      await this.syncDepartmentTeamsToManager(saved.id, saved.headAgentId);
    }
    return saved;
  }

  async delete(id: string, userId: string) {
    await this.resourceAccessService.ensureDepartmentAdminAccess(id, userId);
    const dept = await this.deptRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException("Department not found");
    await this.deptRepo.delete(id);
    return { deleted: true };
  }

  private async syncDepartmentTeamsToManager(
    departmentId: string,
    managerAgentId?: string | null,
  ) {
    await this.teamRepo.update(
      { departmentId },
      { leadAgentId: managerAgentId?.trim() || null },
    );
  }

  private optionalId(value?: string | null) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}
