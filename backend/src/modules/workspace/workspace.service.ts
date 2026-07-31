import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WorkspaceEntity } from "../../entities/workspace.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { ThreadEntity } from "../../entities/thread.entity";
import { TaskEntity } from "../../entities/task.entity";
import {
  PermissionPolicyEntity,
  PermissionScope,
} from "../../entities/permission-policy.entity";
import { ThreadReadStateEntity } from "../../entities/thread-read-state.entity";
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
} from "./dto/create-workspace.dto";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,

    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,

    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,

    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,

    @InjectRepository(PermissionPolicyEntity)
    private readonly permissionRepo: Repository<PermissionPolicyEntity>,

    @InjectRepository(ThreadReadStateEntity)
    private readonly readStateRepo: Repository<ThreadReadStateEntity>,

    private readonly workspaceMembershipService: WorkspaceMembershipService,
  ) {}

  async findAll(userId: string) {
    const workspaces =
      await this.workspaceMembershipService.listUserWorkspaces(userId);

    const results = await Promise.all(
      workspaces.map(async (ws) => {
        const [agentCount, unreadCount] = await Promise.all([
          this.agentRepo.count({ where: { workspaceId: ws.id } }),
          this.readStateRepo
            .createQueryBuilder("rs")
            .innerJoin("threads", "t", 't.id = rs."threadId"')
            .where('t."workspaceId" = :wsId', { wsId: ws.id })
            .andWhere('rs."userId" = :userId', { userId })
            .select('COALESCE(SUM(rs."unreadCount"), 0)', "total")
            .getRawOne()
            .then((r) => parseInt(r?.total ?? "0", 10)),
        ]);
        return { ...ws, agentCount, unreadCount };
      }),
    );

    return {
      data: results,
      total: results.length,
      page: 1,
      pageSize: 100,
      hasMore: false,
    };
  }

  async findOne(id: string, userId: string) {
    const access = await this.workspaceMembershipService.ensureWorkspaceAccess(
      id,
      userId,
    );
    const stats = await this.getStats(id);
    return { ...access.workspace, stats, membershipRole: access.role };
  }

  async ensureAccess(id: string, userId: string) {
    return this.workspaceMembershipService.ensureWorkspaceAccess(id, userId);
  }

  async ensureAdminAccess(id: string, userId: string) {
    return this.workspaceMembershipService.ensureWorkspaceAdminAccess(
      id,
      userId,
    );
  }

  async create(userId: string, dto: CreateWorkspaceDto) {
    const workspace = this.workspaceRepo.create({
      ...dto,
      ownerId: userId,
    });
    const saved = await this.workspaceRepo.save(workspace);
    await this.workspaceMembershipService.ensureOwnerMembership(
      saved.id,
      userId,
    );
    await this.initializeDefaultPolicies(saved.id);
    return saved;
  }

  async update(id: string, userId: string, dto: UpdateWorkspaceDto) {
    const { workspace } =
      await this.workspaceMembershipService.ensureWorkspaceAdminAccess(
        id,
        userId,
      );
    Object.assign(workspace, dto);
    return this.workspaceRepo.save(workspace);
  }

  async getStats(workspaceId: string) {
    const [
      totalAgents,
      activeAgents,
      totalTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      totalThreads,
    ] = await Promise.all([
      this.agentRepo.count({ where: { workspaceId } }),
      this.agentRepo.count({ where: { workspaceId, status: "busy" } }),
      this.taskRepo.count({ where: { workspaceId } }),
      this.taskRepo.count({ where: { workspaceId, status: "running" } }),
      this.taskRepo.count({ where: { workspaceId, status: "completed" } }),
      this.taskRepo.count({ where: { workspaceId, status: "failed" } }),
      this.threadRepo.count({ where: { workspaceId } }),
    ]);

    const successRate =
      totalTasks > 0
        ? Math.round(
            (completedTasks / (completedTasks + failedTasks || 1)) * 100,
          )
        : 0;

    return {
      totalAgents,
      activeAgents,
      totalTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      successRate,
      totalThreads,
    };
  }

  async getUserWorkspaceMemberships(userId: string) {
    return this.workspaceMembershipService.listUserWorkspaces(userId);
  }

  private async initializeDefaultPolicies(workspaceId: string) {
    const defaults = [
      {
        name: "Admin",
        scope: PermissionScope.WORKSPACE,
        permissions: [{ action: "*", effect: "allow" as const }],
      },
      {
        name: "Viewer",
        scope: PermissionScope.WORKSPACE,
        permissions: [
          { action: "read:agents", effect: "allow" as const },
          { action: "read:tasks", effect: "allow" as const },
          { action: "read:reports", effect: "allow" as const },
        ],
      },
    ];
    for (const def of defaults) {
      const policy = this.permissionRepo.create({ ...def, workspaceId });
      await this.permissionRepo.save(policy);
    }
  }
}
