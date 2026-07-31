import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CompanyEntity } from "../../entities/company.entity";
import { DepartmentEntity } from "../../entities/department.entity";
import { TeamEntity } from "../../entities/team.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { ManagerRelationshipEntity } from "../../entities/manager-relationship.entity";
import { CreateCompanyDto, UpdateCompanyDto } from "./dto/org.dto";
import { ResourceAccessService } from "../resource-access/resource-access.service";

@Injectable()
export class OrgService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,

    @InjectRepository(DepartmentEntity)
    private readonly deptRepo: Repository<DepartmentEntity>,

    @InjectRepository(TeamEntity)
    private readonly teamRepo: Repository<TeamEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(ManagerRelationshipEntity)
    private readonly managerRepo: Repository<ManagerRelationshipEntity>,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async getOrgChart(workspaceId: string, userId: string) {
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId);
    const [companies, managerRelationships] = await Promise.all([
      this.companyRepo
        .createQueryBuilder("c")
        .where('c."workspaceId" = :workspaceId', { workspaceId })
        .getMany(),
      this.getManagerRelationships(workspaceId),
    ]);

    const companyIds = companies.map((c) => c.id);

    const departments = companyIds.length
      ? await this.deptRepo
          .createQueryBuilder("d")
          .where('d."companyId" IN (:...companyIds)', { companyIds })
          .getMany()
      : [];

    const deptIds = departments.map((d) => d.id);

    const teams = deptIds.length
      ? await this.teamRepo
          .createQueryBuilder("t")
          .where('t."departmentId" IN (:...deptIds)', { deptIds })
          .getMany()
      : [];

    const agents = await this.agentRepo
      .createQueryBuilder("a")
      .where('a."workspaceId" = :workspaceId', { workspaceId })
      .select([
        "a.id",
        "a.name",
        "a.role",
        "a.avatarUrl",
        "a.status",
        "a.teamId",
        "a.departmentId",
        "a.companyId",
        "a.managerId",
      ])
      .getMany();

    return { companies, departments, teams, agents, managerRelationships };
  }

  async getCompanies(workspaceId: string, userId: string) {
    await this.resourceAccessService.ensureWorkspaceAccess(workspaceId, userId);
    return this.companyRepo.find({ where: { workspaceId } });
  }

  async getCompany(id: string, userId: string) {
    await this.resourceAccessService.ensureCompanyAccess(id, userId);
    const company = await this.companyRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.departments", "departments")
      .where("c.id = :id", { id })
      .getOne();

    if (!company) throw new NotFoundException("Company not found");
    return company;
  }

  async createCompany(dto: CreateCompanyDto, userId: string) {
    await this.resourceAccessService.ensureWorkspaceAdminAccess(
      dto.workspaceId,
      userId,
    );
    const company = this.companyRepo.create(dto);
    return this.companyRepo.save(company);
  }

  async updateCompany(id: string, dto: UpdateCompanyDto, userId: string) {
    const company = await this.resourceAccessService.ensureCompanyAdminAccess(
      id,
      userId,
    );
    Object.assign(company, dto);
    return this.companyRepo.save(company);
  }

  async createManagerRelationship(
    managerId: string,
    reportId: string,
    userId: string,
  ) {
    const manager = await this.resourceAccessService.ensureAgentAdminAccess(
      managerId,
      userId,
    );
    const report = await this.resourceAccessService.ensureAgentAdminAccess(
      reportId,
      userId,
    );
    if (manager.workspaceId !== report.workspaceId) {
      throw new BadRequestException(
        "Manager and report must belong to the same workspace",
      );
    }
    const existing = await this.managerRepo.findOne({
      where: { managerId, reportId },
    });
    if (existing) throw new ConflictException("Relationship already exists");

    const rel = this.managerRepo.create({ managerId, reportId });
    return this.managerRepo.save(rel);
  }

  async deleteManagerRelationship(
    managerId: string,
    reportId: string,
    userId: string,
  ) {
    await this.resourceAccessService.ensureAgentAdminAccess(managerId, userId);
    await this.resourceAccessService.ensureAgentAdminAccess(reportId, userId);
    const rel = await this.managerRepo.findOne({
      where: { managerId, reportId },
    });
    if (!rel) throw new NotFoundException("Relationship not found");
    await this.managerRepo.remove(rel);
    return { success: true };
  }

  async getManagerRelationships(workspaceId: string) {
    // Get all agent IDs in this workspace then filter relationships
    const agents = await this.agentRepo
      .createQueryBuilder("a")
      .where('a."workspaceId" = :workspaceId', { workspaceId })
      .select("a.id")
      .getMany();

    const agentIds = agents.map((a) => a.id);
    if (!agentIds.length) return [];

    return this.managerRepo
      .createQueryBuilder("r")
      .where('r."managerId" IN (:...agentIds)', { agentIds })
      .andWhere('r."reportId" IN (:...agentIds)', { agentIds })
      .getMany();
  }
}
