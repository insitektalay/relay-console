import { BadRequestException } from "@nestjs/common";
import { OrgService } from "./org.service";

const createRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn((value) => value),
  save: jest.fn(async (value) => value),
  remove: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

function createService() {
  const companyRepo = createRepo();
  const deptRepo = createRepo();
  const teamRepo = createRepo();
  const agentRepo = createRepo();
  const managerRepo = createRepo();
  const resourceAccessService = {
    ensureAgentAdminAccess: jest.fn(),
  };

  const service = new OrgService(
    companyRepo as any,
    deptRepo as any,
    teamRepo as any,
    agentRepo as any,
    managerRepo as any,
    resourceAccessService as any,
  );

  return { service, agentRepo, managerRepo, resourceAccessService };
}

describe("OrgService manager relationship workspace validation", () => {
  it("rejects manager relationships across workspaces", async () => {
    const { service, managerRepo, resourceAccessService } = createService();
    resourceAccessService.ensureAgentAdminAccess.mockImplementation(
      (agentId: string) =>
        Promise.resolve({
          id: agentId,
          workspaceId: agentId === "manager-1" ? "workspace-1" : "workspace-2",
        }),
    );

    await expect(
      service.createManagerRelationship("manager-1", "report-1", "user-1"),
    ).rejects.toThrow(BadRequestException);

    expect(managerRepo.save).not.toHaveBeenCalled();
  });

  it("filters manager relationships to reports inside the requested workspace", async () => {
    const { service, agentRepo, managerRepo } = createService();
    agentRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([{ id: "agent-1" }, { id: "agent-2" }]),
    });
    const relationshipQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    managerRepo.createQueryBuilder.mockReturnValue(relationshipQuery);

    await service.getManagerRelationships("workspace-1");

    expect(relationshipQuery.where).toHaveBeenCalledWith(
      'r."managerId" IN (:...agentIds)',
      { agentIds: ["agent-1", "agent-2"] },
    );
    expect(relationshipQuery.andWhere).toHaveBeenCalledWith(
      'r."reportId" IN (:...agentIds)',
      { agentIds: ["agent-1", "agent-2"] },
    );
  });
});
