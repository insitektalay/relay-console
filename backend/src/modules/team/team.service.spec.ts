import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { TeamMemoryItemType } from "../../entities/team-memory-item.entity";
import { TeamService } from "./team.service";

const createRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn((value) => value),
  save: jest.fn(async (value) => value),
  insert: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  findOneByOrFail: jest.fn(async (criteria) => ({ ...criteria })),
  remove: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

function createService() {
  const teamRepo = createRepo();
  const agentRepo = createRepo();
  const taskRepo = createRepo();
  const approvalRepo = createRepo();
  const incidentRepo = createRepo();
  const handoverRepo = createRepo();
  const metricsRepo = createRepo();
  const memoryRepo = createRepo();
  const resourceAccessService = {
    ensureDepartmentAccess: jest.fn().mockResolvedValue({
      id: "department-1",
    }),
    ensureDepartmentAdminAccess: jest.fn().mockResolvedValue({
      id: "department-1",
      headAgentId: null,
    }),
    ensureTeamAccess: jest.fn().mockResolvedValue({
      id: "team-1",
      departmentId: "department-1",
    }),
    ensureTeamAdminAccess: jest.fn().mockResolvedValue({
      id: "team-1",
      departmentId: "department-1",
    }),
    ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
    getDepartmentWorkspaceId: jest.fn().mockResolvedValue("workspace-1"),
    getTeamWorkspaceId: jest.fn().mockResolvedValue("workspace-1"),
    assertAgentInWorkspace: jest.fn(),
  };
  memoryRepo.findOne.mockImplementation(async ({ where }) =>
    where.id === "memory-1" && where.teamId === "team-1"
      ? {
          id: "memory-1",
          teamId: "team-1",
          title: "Runbook",
          content: "Escalate failures",
          type: TeamMemoryItemType.SOP,
          tags: [],
          createdById: "admin-1",
        }
      : null,
  );
  memoryRepo.findOneByOrFail.mockImplementation(async (criteria) => ({
    ...criteria,
    title: "Runbook",
  }));

  const service = new TeamService(
    teamRepo as any,
    agentRepo as any,
    taskRepo as any,
    approvalRepo as any,
    incidentRepo as any,
    handoverRepo as any,
    metricsRepo as any,
    memoryRepo as any,
    resourceAccessService as any,
  );

  return { memoryRepo, service, teamRepo, resourceAccessService };
}

describe("TeamService hierarchy workspace validation", () => {
  it("rejects a team lead agent outside the department workspace", async () => {
    const { service, teamRepo, resourceAccessService } = createService();
    resourceAccessService.ensureDepartmentAdminAccess.mockResolvedValue({
      id: "department-1",
      headAgentId: null,
    });
    resourceAccessService.getDepartmentWorkspaceId.mockResolvedValue(
      "workspace-1",
    );
    resourceAccessService.assertAgentInWorkspace.mockRejectedValue(
      new BadRequestException(
        "Team lead agent does not belong to this workspace",
      ),
    );

    await expect(
      service.create(
        {
          name: "Escalations",
          departmentId: "department-1",
          leadAgentId: "agent-other-workspace",
        },
        "user-1",
      ),
    ).rejects.toThrow("Team lead agent does not belong to this workspace");

    expect(teamRepo.insert).not.toHaveBeenCalled();
  });

  it("uses insert semantics and server-owned fields for team creation", async () => {
    const { service, teamRepo } = createService();

    await service.create(
      {
        name: "Escalations",
        departmentId: "department-1",
        id: "attacker-id",
        createdAt: new Date("2000-01-01T00:00:00.000Z"),
      } as any,
      "admin-1",
    );

    const inserted = teamRepo.insert.mock.calls[0][0];
    expect(inserted.id).not.toBe("attacker-id");
    expect(inserted.createdAt).toBeUndefined();
    expect(teamRepo.save).not.toHaveBeenCalled();
  });

  it("binds updates to the immutable department and ignores injected ownership", async () => {
    const { service, teamRepo } = createService();

    await service.update(
      "team-1",
      {
        name: "New name",
        departmentId: "department-foreign",
        id: "team-foreign",
      } as any,
      "admin-1",
    );

    expect(teamRepo.update).toHaveBeenCalledWith(
      { id: "team-1", departmentId: "department-1" },
      { name: "New name" },
    );
  });

  it("rejects inconsistent workspace and department list filters", async () => {
    const { service, teamRepo, resourceAccessService } = createService();
    resourceAccessService.getDepartmentWorkspaceId.mockResolvedValueOnce(
      "workspace-2",
    );

    await expect(
      service.findAll(
        { workspaceId: "workspace-1", departmentId: "department-1" },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(teamRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe("TeamService memory mutation authorization", () => {
  const memoryDto = {
    title: "Runbook",
    content: "Escalate failures",
    type: TeamMemoryItemType.SOP,
    tags: ["operations"],
  };

  it("requires team admin access before creating shared memory", async () => {
    const { memoryRepo, resourceAccessService, service } = createService();
    resourceAccessService.ensureTeamAdminAccess.mockRejectedValueOnce(
      new ForbiddenException("admin required"),
    );

    await expect(
      service.createMemoryItem("team-1", memoryDto, "member-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(memoryRepo.insert).not.toHaveBeenCalled();
  });

  it("owns memory identity and creator and uses insert semantics", async () => {
    const { memoryRepo, service } = createService();

    await service.createMemoryItem(
      "team-1",
      {
        ...memoryDto,
        id: "attacker-id",
        teamId: "team-foreign",
        createdById: "attacker-user",
        createdAt: new Date("2000-01-01T00:00:00.000Z"),
      } as any,
      "admin-1",
    );

    const inserted = memoryRepo.insert.mock.calls[0][0];
    expect(inserted.id).not.toBe("attacker-id");
    expect(inserted.teamId).toBe("team-1");
    expect(inserted.createdById).toBe("admin-1");
    expect(inserted.createdAt).toBeUndefined();
  });

  it("returns not found when the route team does not own the item", async () => {
    const { service } = createService();

    await expect(
      service.findMemoryItem("team-2", "memory-1", "user-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates only mutable fields with an item-and-team predicate", async () => {
    const { memoryRepo, service } = createService();

    await service.updateMemoryItem(
      "team-1",
      "memory-1",
      {
        content: "Updated runbook",
        teamId: "team-foreign",
        createdById: "attacker-user",
      } as any,
      "admin-1",
    );

    expect(memoryRepo.update).toHaveBeenCalledWith(
      { id: "memory-1", teamId: "team-1" },
      { content: "Updated runbook" },
    );
  });
});
