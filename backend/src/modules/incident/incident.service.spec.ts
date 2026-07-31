import { BadRequestException } from "@nestjs/common";
import { IncidentService } from "./incident.service";

function createHarness() {
  const storedIncident = {
    id: "incident-1",
    workspaceId: "workspace-a",
    title: "Existing incident",
    description: "Existing description",
    severity: "medium",
    status: "open",
  };
  const incidentRepo = {
    create: jest.fn((data) => ({ ...data })),
    insert: jest.fn().mockResolvedValue(undefined),
    findOneByOrFail: jest.fn(async ({ id, workspaceId }) => ({
      ...storedIncident,
      id,
      workspaceId,
    })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findAndCount: jest.fn(),
    count: jest.fn(),
  };
  const alertRepo = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (data) => data),
  };
  const resourceAccessService = {
    ensureWorkspaceAccess: jest.fn(async (workspaceId: string) => ({
      workspaceId,
    })),
    ensureIncidentAccess: jest.fn(async () => ({ ...storedIncident })),
    ensureAgentAccess: jest.fn(async (agentId: string) => ({
      id: agentId,
      workspaceId: agentId.endsWith("-b") ? "workspace-b" : "workspace-a",
    })),
    getTeamWorkspaceId: jest.fn(async (teamId: string) =>
      teamId.endsWith("-b") ? "workspace-b" : "workspace-a",
    ),
    ensureTaskAccess: jest.fn(async (taskId: string) => ({
      id: taskId,
      workspaceId: taskId.endsWith("-b") ? "workspace-b" : "workspace-a",
    })),
    ensureRunAccess: jest.fn(async (runId: string) => ({
      run: {
        id: runId,
        taskId: runId.includes("other-task") ? "task-other" : "task-a",
      },
      task: {
        id: "task-a",
        workspaceId: runId.endsWith("-b") ? "workspace-b" : "workspace-a",
      },
    })),
  };
  const service = new IncidentService(
    incidentRepo as any,
    alertRepo as any,
    resourceAccessService as any,
  );

  return {
    alertRepo,
    incidentRepo,
    resourceAccessService,
    service,
  };
}

describe("IncidentService tenant-safe mutations", () => {
  it("uses insert semantics and maps only allowed create fields", async () => {
    const { incidentRepo, service } = createHarness();

    await service.create(
      {
        workspaceId: "workspace-a",
        title: "Database alarm",
        description: "Elevated failures",
        severity: "high",
        agentId: "agent-a",
        id: "attacker-chosen-id",
        status: "resolved",
        createdAt: "2000-01-01T00:00:00.000Z",
      } as any,
      "user-1",
    );

    expect(incidentRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-a",
        title: "Database alarm",
        status: "open",
      }),
    );
    const inserted = incidentRepo.insert.mock.calls[0][0];
    expect(inserted.id).not.toBe("attacker-chosen-id");
    expect(inserted.createdAt).toBeUndefined();
  });

  it("rejects a related resource from another workspace before insert", async () => {
    const { incidentRepo, service } = createHarness();

    await expect(
      service.create(
        {
          workspaceId: "workspace-a",
          title: "Database alarm",
          description: "Elevated failures",
          severity: "high",
          agentId: "agent-b",
        },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(incidentRepo.insert).not.toHaveBeenCalled();
  });

  it("rejects a run that does not belong to the supplied task", async () => {
    const { incidentRepo, service } = createHarness();

    await expect(
      service.create(
        {
          workspaceId: "workspace-a",
          title: "Database alarm",
          description: "Elevated failures",
          severity: "high",
          taskId: "task-a",
          runId: "run-other-task",
        },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(incidentRepo.insert).not.toHaveBeenCalled();
  });

  it("binds updates to the authorized workspace and ignores server-owned fields", async () => {
    const { incidentRepo, service } = createHarness();

    await service.update(
      "incident-1",
      {
        title: "Updated incident",
        workspaceId: "workspace-b",
        status: "resolved",
        resolvedAt: "2000-01-01T00:00:00.000Z",
      } as any,
      "user-1",
    );

    expect(incidentRepo.update).toHaveBeenCalledWith(
      { id: "incident-1", workspaceId: "workspace-a" },
      { title: "Updated incident" },
    );
  });
});
