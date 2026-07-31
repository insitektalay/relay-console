import { BadRequestException } from "@nestjs/common";
import { WorkLogsService } from "./worklogs.service";

function createQueryBuilder() {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[{ id: "log-1" }], 1]),
    getMany: jest.fn().mockResolvedValue([{ id: "log-1" }]),
  };
}

function createHarness() {
  const queryBuilder = createQueryBuilder();
  const workLogRepo = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    create: jest.fn((data) => ({ id: "created-log", ...data })),
    insert: jest.fn().mockResolvedValue(undefined),
  };
  const resourceAccessService = {
    ensureWorkspaceAccess: jest.fn(async (workspaceId: string) => ({
      workspaceId,
    })),
    ensureAgentAccess: jest.fn(async (agentId: string) => ({
      id: agentId,
      workspaceId: agentId.endsWith("-b") ? "workspace-b" : "workspace-a",
    })),
    ensureTaskAccess: jest.fn(async (taskId: string) => ({
      id: taskId,
      workspaceId: taskId.endsWith("-b") ? "workspace-b" : "workspace-a",
    })),
    ensureRunAccess: jest.fn(async (runId: string) => ({
      run: { id: runId, taskId: runId.endsWith("-b") ? "task-b" : "task-a" },
      task: {
        id: runId.endsWith("-b") ? "task-b" : "task-a",
        workspaceId: runId.endsWith("-b") ? "workspace-b" : "workspace-a",
      },
    })),
    getTeamWorkspaceId: jest.fn(async (teamId: string) =>
      teamId.endsWith("-b") ? "workspace-b" : "workspace-a",
    ),
  };

  const service = new WorkLogsService(
    workLogRepo as any,
    resourceAccessService as any,
  );

  return { queryBuilder, resourceAccessService, service, workLogRepo };
}

describe("WorkLogsService", () => {
  it("joins list queries through agent workspace scope", async () => {
    const { queryBuilder, service } = createHarness();

    await service.findAll({ workspaceId: "workspace-a" }, "user-1");

    expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
      "agents",
      "agent_scope",
      'agent_scope.id = wl."agentId"',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'agent_scope."workspaceId" = :scopedWorkspaceId',
      { scopedWorkspaceId: "workspace-a" },
    );
  });

  it("rejects list filters that resolve to multiple workspaces", async () => {
    const { service } = createHarness();

    await expect(
      service.findAll(
        { workspaceId: "workspace-a", agentId: "agent-b" },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("applies team filters through the joined agent scope", async () => {
    const { queryBuilder, service } = createHarness();

    await service.findAll({ teamId: "team-a" }, "user-1");

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'agent_scope."teamId" = :teamId',
      {
        teamId: "team-a",
      },
    );
  });

  it("rejects create payloads with cross-workspace ids before saving", async () => {
    const { service, workLogRepo } = createHarness();

    await expect(
      service.create(
        {
          agentId: "agent-a",
          taskId: "task-b",
          action: "worked",
          details: "details",
        },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(workLogRepo.insert).not.toHaveBeenCalled();
  });

  it("saves create payloads only after all supplied ids share one workspace", async () => {
    const { service, workLogRepo } = createHarness();

    await service.create(
      {
        agentId: "agent-a",
        taskId: "task-a",
        runId: "run-a",
        action: "worked",
        details: "details",
      },
      "user-1",
    );

    expect(workLogRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent-a",
        taskId: "task-a",
        runId: "run-a",
      }),
    );
  });

  it("does not persist client-supplied ids or timestamps even if validation is bypassed", async () => {
    const { service, workLogRepo } = createHarness();

    await service.create(
      {
        agentId: "agent-a",
        action: "worked",
        details: "details",
        id: "attacker-id",
        timestamp: new Date("2000-01-01T00:00:00.000Z"),
      } as any,
      "user-1",
    );

    const inserted = workLogRepo.insert.mock.calls[0][0];
    expect(inserted.id).not.toBe("attacker-id");
    expect(inserted.timestamp.getTime()).toBeGreaterThan(
      new Date("2020-01-01T00:00:00.000Z").getTime(),
    );
  });

  it("rejects oversized metadata before insert", async () => {
    const { service, workLogRepo } = createHarness();

    await expect(
      service.create(
        {
          agentId: "agent-a",
          action: "worked",
          details: "details",
          metadata: { payload: "x".repeat(17 * 1024) },
        },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(workLogRepo.insert).not.toHaveBeenCalled();
  });

  it("scopes task log lookups through the task workspace and joined agent", async () => {
    const { queryBuilder, service } = createHarness();

    await service.getTaskLogs("task-a", "user-1");

    expect(queryBuilder.where).toHaveBeenCalledWith('wl."taskId" = :taskId', {
      taskId: "task-a",
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'agent_scope."workspaceId" = :scopedWorkspaceId',
      { scopedWorkspaceId: "workspace-a" },
    );
  });
});
