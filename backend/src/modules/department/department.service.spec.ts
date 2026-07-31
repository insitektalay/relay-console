import { BadRequestException } from "@nestjs/common";
import { DepartmentService } from "./department.service";

const createRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn((value) => value),
  save: jest.fn(async (value) => value),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

function createService() {
  const deptRepo = createRepo();
  const teamRepo = createRepo();
  const agentRepo = createRepo();
  const taskRepo = createRepo();
  const approvalRepo = createRepo();
  const incidentRepo = createRepo();
  const alertRepo = createRepo();
  const companyRepo = createRepo();
  const resourceAccessService = {
    ensureWorkspaceAdminAccess: jest.fn(),
    ensureDepartmentAdminAccess: jest.fn(),
    getCompanyWorkspaceId: jest.fn(),
    getDepartmentWorkspaceId: jest.fn(),
    assertCompanyInWorkspace: jest.fn(),
    assertAgentInWorkspace: jest.fn(),
  };

  const service = new DepartmentService(
    deptRepo as any,
    teamRepo as any,
    agentRepo as any,
    taskRepo as any,
    approvalRepo as any,
    incidentRepo as any,
    alertRepo as any,
    companyRepo as any,
    resourceAccessService as any,
  );

  return { service, deptRepo, resourceAccessService };
}

describe("DepartmentService hierarchy workspace validation", () => {
  it("rejects a department company outside the requested workspace", async () => {
    const { service, deptRepo, resourceAccessService } = createService();
    resourceAccessService.assertCompanyInWorkspace.mockRejectedValue(
      new BadRequestException("Company does not belong to this workspace"),
    );

    await expect(
      service.create(
        {
          name: "Finance",
          workspaceId: "workspace-1",
          companyId: "company-other-workspace",
        },
        "user-1",
      ),
    ).rejects.toThrow("Company does not belong to this workspace");

    expect(
      resourceAccessService.ensureWorkspaceAdminAccess,
    ).not.toHaveBeenCalled();
    expect(deptRepo.save).not.toHaveBeenCalled();
  });

  it("rejects a department head agent outside the department workspace", async () => {
    const { service, deptRepo, resourceAccessService } = createService();
    resourceAccessService.assertAgentInWorkspace.mockRejectedValue(
      new BadRequestException(
        "Department head agent does not belong to this workspace",
      ),
    );

    await expect(
      service.create(
        {
          name: "Support",
          workspaceId: "workspace-1",
          headAgentId: "agent-other-workspace",
        },
        "user-1",
      ),
    ).rejects.toThrow(
      "Department head agent does not belong to this workspace",
    );

    expect(deptRepo.save).not.toHaveBeenCalled();
  });
});
