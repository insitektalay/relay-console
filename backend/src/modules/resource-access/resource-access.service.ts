import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  AgentEntity,
  AlertEntity,
  ApprovalEntity,
  CompanyEntity,
  DepartmentEntity,
  IncidentEntity,
  MeetingNoteEntity,
  MeetingRulePackEntity,
  MeetingSessionEntity,
  PermissionPolicyEntity,
  ReportSnapshotEntity,
  RunEntity,
  ScheduledThreadMessageEntity,
  TaskEntity,
  TeamEntity,
  TeamMemoryItemEntity,
  ThreadEntity,
  ThreadWrapUpReportEntity,
  WorkLogEntity,
} from "../../entities";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";

@Injectable()
export class ResourceAccessService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(AlertEntity)
    private readonly alertRepo: Repository<AlertEntity>,
    @InjectRepository(ApprovalEntity)
    private readonly approvalRepo: Repository<ApprovalEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(DepartmentEntity)
    private readonly departmentRepo: Repository<DepartmentEntity>,
    @InjectRepository(IncidentEntity)
    private readonly incidentRepo: Repository<IncidentEntity>,
    @InjectRepository(MeetingNoteEntity)
    private readonly meetingNoteRepo: Repository<MeetingNoteEntity>,
    @InjectRepository(MeetingRulePackEntity)
    private readonly meetingRulePackRepo: Repository<MeetingRulePackEntity>,
    @InjectRepository(MeetingSessionEntity)
    private readonly meetingRepo: Repository<MeetingSessionEntity>,
    @InjectRepository(PermissionPolicyEntity)
    private readonly permissionPolicyRepo: Repository<PermissionPolicyEntity>,
    @InjectRepository(ReportSnapshotEntity)
    private readonly reportRepo: Repository<ReportSnapshotEntity>,
    @InjectRepository(RunEntity)
    private readonly runRepo: Repository<RunEntity>,
    @InjectRepository(ScheduledThreadMessageEntity)
    private readonly scheduledMessageRepo: Repository<ScheduledThreadMessageEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    @InjectRepository(TeamEntity)
    private readonly teamRepo: Repository<TeamEntity>,
    @InjectRepository(TeamMemoryItemEntity)
    private readonly teamMemoryRepo: Repository<TeamMemoryItemEntity>,
    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,
    @InjectRepository(ThreadWrapUpReportEntity)
    private readonly wrapUpRepo: Repository<ThreadWrapUpReportEntity>,
    @InjectRepository(WorkLogEntity)
    private readonly workLogRepo: Repository<WorkLogEntity>,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
  ) {}

  async ensureWorkspaceAccess(workspaceId: string, userId: string) {
    return this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      userId,
    );
  }

  async ensureWorkspaceAdminAccess(workspaceId: string, userId: string) {
    return this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      workspaceId,
      userId,
    );
  }

  async ensureAgentAccess(agentId: string, userId: string) {
    const agent = await this.agentRepo.findOne({
      where: { id: agentId } as any,
    });
    if (!agent?.workspaceId) throw new NotFoundException("Agent not found");
    await this.ensureWorkspaceAccess(agent.workspaceId, userId);
    return agent;
  }

  async ensureAgentAdminAccess(agentId: string, userId: string) {
    const agent = await this.agentRepo.findOne({
      where: { id: agentId } as any,
    });
    if (!agent?.workspaceId) throw new NotFoundException("Agent not found");
    await this.ensureWorkspaceAdminAccess(agent.workspaceId, userId);
    return agent;
  }

  async ensureTaskAccess(taskId: string, userId: string) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException("Task not found");
    await this.ensureWorkspaceAccess(task.workspaceId, userId);
    return task;
  }

  async ensureTaskAdminAccess(taskId: string, userId: string) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException("Task not found");
    await this.ensureWorkspaceAdminAccess(task.workspaceId, userId);
    return task;
  }

  async ensureRunAccess(runId: string, userId: string) {
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) throw new NotFoundException("Run not found");
    const task = await this.taskRepo.findOne({ where: { id: run.taskId } });
    if (!task) throw new NotFoundException("Run task not found");
    await this.ensureWorkspaceAccess(task.workspaceId, userId);
    return { run, task };
  }

  async ensureApprovalAccess(id: string, userId: string) {
    const approval = await this.approvalRepo.findOne({ where: { id } });
    if (!approval) throw new NotFoundException("Approval not found");
    await this.ensureWorkspaceAccess(approval.workspaceId, userId);
    return approval;
  }

  async ensureIncidentAccess(id: string, userId: string) {
    const incident = await this.incidentRepo.findOne({ where: { id } });
    if (!incident) throw new NotFoundException("Incident not found");
    await this.ensureWorkspaceAccess(incident.workspaceId, userId);
    return incident;
  }

  async ensureAlertAccess(id: string, userId: string) {
    const alert = await this.alertRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException("Alert not found");
    await this.ensureWorkspaceAccess(alert.workspaceId, userId);
    return alert;
  }

  async ensureReportAccess(id: string, userId: string) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException("Report not found");
    await this.ensureWorkspaceAccess(report.workspaceId, userId);
    return report;
  }

  async ensureWrapUpAccess(id: string, userId: string) {
    const report = await this.wrapUpRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException("Wrap-up report not found");
    await this.ensureWorkspaceAccess(report.workspaceId, userId);
    return report;
  }

  async ensureMeetingAccess(id: string, userId: string) {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException("Meeting not found");
    await this.ensureWorkspaceAccess(meeting.workspaceId, userId);
    return meeting;
  }

  async ensureMeetingNoteAccess(id: string, userId: string) {
    const note = await this.meetingNoteRepo.findOne({ where: { id } });
    if (!note) throw new NotFoundException("Meeting note not found");
    await this.ensureWorkspaceAccess(note.workspaceId, userId);
    return note;
  }

  async ensureMeetingRulePackAccess(id: string, userId: string) {
    const pack = await this.meetingRulePackRepo.findOne({ where: { id } });
    if (!pack) throw new NotFoundException("Rule pack not found");
    await this.ensureWorkspaceAccess(pack.workspaceId, userId);
    return pack;
  }

  async ensureScheduledMessageAccess(id: string, userId: string) {
    const scheduled = await this.scheduledMessageRepo.findOne({
      where: { id },
    });
    if (!scheduled) throw new NotFoundException("Scheduled message not found");
    await this.ensureWorkspaceAccess(scheduled.workspaceId, userId);
    return scheduled;
  }

  async ensurePermissionPolicyAccess(id: string, userId: string) {
    const policy = await this.permissionPolicyRepo.findOne({ where: { id } });
    if (!policy) throw new NotFoundException("Permission policy not found");
    await this.ensureWorkspaceAccess(policy.workspaceId, userId);
    return policy;
  }

  async ensurePermissionPolicyAdminAccess(id: string, userId: string) {
    const policy = await this.permissionPolicyRepo.findOne({ where: { id } });
    if (!policy) throw new NotFoundException("Permission policy not found");
    await this.ensureWorkspaceAdminAccess(policy.workspaceId, userId);
    return policy;
  }

  async ensureCompanyAccess(id: string, userId: string) {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException("Company not found");
    await this.ensureWorkspaceAccess(company.workspaceId, userId);
    return company;
  }

  async ensureCompanyAdminAccess(id: string, userId: string) {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException("Company not found");
    await this.ensureWorkspaceAdminAccess(company.workspaceId, userId);
    return company;
  }

  async getCompanyWorkspaceId(id: string) {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company?.workspaceId) throw new NotFoundException("Company not found");
    return company.workspaceId;
  }

  async getAgentWorkspaceId(id: string) {
    const agent = await this.agentRepo.findOne({ where: { id } as any });
    if (!agent?.workspaceId) throw new NotFoundException("Agent not found");
    return agent.workspaceId;
  }

  async assertCompanyInWorkspace(id: string, workspaceId: string) {
    const actualWorkspaceId = await this.getCompanyWorkspaceId(id);
    if (actualWorkspaceId !== workspaceId) {
      throw new BadRequestException(
        "Company does not belong to this workspace",
      );
    }
  }

  async assertDepartmentInWorkspace(id: string, workspaceId: string) {
    const actualWorkspaceId = await this.getDepartmentWorkspaceId(id);
    if (actualWorkspaceId !== workspaceId) {
      throw new BadRequestException(
        "Department does not belong to this workspace",
      );
    }
  }

  async assertTeamInWorkspace(id: string, workspaceId: string) {
    const actualWorkspaceId = await this.getTeamWorkspaceId(id);
    if (actualWorkspaceId !== workspaceId) {
      throw new BadRequestException("Team does not belong to this workspace");
    }
  }

  async assertAgentInWorkspace(
    id: string,
    workspaceId: string,
    label = "Agent",
  ) {
    const actualWorkspaceId = await this.getAgentWorkspaceId(id);
    if (actualWorkspaceId !== workspaceId) {
      throw new BadRequestException(
        `${label} does not belong to this workspace`,
      );
    }
  }

  async ensureDepartmentAccess(id: string, userId: string) {
    const workspaceId = await this.getDepartmentWorkspaceId(id);
    await this.ensureWorkspaceAccess(workspaceId, userId);
    const department = await this.departmentRepo.findOne({ where: { id } });
    if (!department) throw new NotFoundException("Department not found");
    return department;
  }

  async ensureDepartmentAdminAccess(id: string, userId: string) {
    const workspaceId = await this.getDepartmentWorkspaceId(id);
    await this.ensureWorkspaceAdminAccess(workspaceId, userId);
    const department = await this.departmentRepo.findOne({ where: { id } });
    if (!department) throw new NotFoundException("Department not found");
    return department;
  }

  async ensureTeamAccess(id: string, userId: string) {
    const workspaceId = await this.getTeamWorkspaceId(id);
    await this.ensureWorkspaceAccess(workspaceId, userId);
    const team = await this.teamRepo.findOne({ where: { id } });
    if (!team) throw new NotFoundException("Team not found");
    return team;
  }

  async ensureTeamAdminAccess(id: string, userId: string) {
    const workspaceId = await this.getTeamWorkspaceId(id);
    await this.ensureWorkspaceAdminAccess(workspaceId, userId);
    const team = await this.teamRepo.findOne({ where: { id } });
    if (!team) throw new NotFoundException("Team not found");
    return team;
  }

  async ensureTeamMemoryAccess(id: string, userId: string) {
    const item = await this.teamMemoryRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException("Memory item not found");
    const workspaceId = await this.getTeamWorkspaceId(item.teamId);
    await this.ensureWorkspaceAccess(workspaceId, userId);
    return item;
  }

  async ensureThreadAccess(id: string, userId: string) {
    const thread = await this.threadRepo.findOne({ where: { id } });
    if (!thread?.workspaceId) throw new NotFoundException("Thread not found");
    await this.ensureWorkspaceAccess(thread.workspaceId, userId);
    return thread;
  }

  async ensureWorkLogAccess(id: string, userId: string) {
    const log = await this.workLogRepo.findOne({ where: { id } });
    if (!log) throw new NotFoundException("Work log not found");

    if (log.taskId) {
      await this.ensureTaskAccess(log.taskId, userId);
      return log;
    }

    if (log.agentId) {
      await this.ensureAgentAccess(log.agentId, userId);
      return log;
    }

    if (log.runId) {
      await this.ensureRunAccess(log.runId, userId);
      return log;
    }

    throw new NotFoundException("Work log scope could not be resolved");
  }

  async getDepartmentWorkspaceId(id: string) {
    const department = await this.departmentRepo
      .createQueryBuilder("department")
      .leftJoinAndSelect("department.company", "company")
      .where("department.id = :id", { id })
      .getOne();

    const workspaceId =
      department?.workspaceId ?? department?.company?.workspaceId ?? null;
    if (!department || !workspaceId) {
      throw new NotFoundException("Department not found");
    }

    return workspaceId;
  }

  async getTeamWorkspaceId(id: string) {
    const team = await this.teamRepo
      .createQueryBuilder("team")
      .leftJoinAndSelect("team.department", "department")
      .leftJoinAndSelect("department.company", "company")
      .where("team.id = :id", { id })
      .getOne();

    const workspaceId =
      team?.department?.workspaceId ??
      team?.department?.company?.workspaceId ??
      null;
    if (!team || !workspaceId) {
      throw new NotFoundException("Team not found");
    }

    return workspaceId;
  }
}
