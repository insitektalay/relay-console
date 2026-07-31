import { ForbiddenException } from "@nestjs/common";
import { AgentService } from "./agent.service";

function createHarness() {
  const agentRepo = {
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const resourceAccessService = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
    ensureWorkspaceAdminAccess: jest.fn().mockResolvedValue(undefined),
    ensureAgentAccess: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AgentService(
    agentRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    resourceAccessService as any,
    {} as any,
    {} as any,
    {} as any,
  );

  return { agentRepo, resourceAccessService, service };
}

describe("AgentService tenant isolation", () => {
  it("does not construct an agent query before workspace access succeeds", async () => {
    const { agentRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureWorkspaceAccess.mockRejectedValueOnce(
      new ForbiddenException("workspace access denied"),
    );

    await expect(
      service.findAll({ workspaceId: "workspace-b" } as any, "user-a"),
    ).rejects.toThrow(ForbiddenException);

    expect(agentRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("does not create an agent before workspace-admin access succeeds", async () => {
    const { agentRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureWorkspaceAdminAccess.mockRejectedValueOnce(
      new ForbiddenException("workspace admin access denied"),
    );

    await expect(
      service.create(
        { workspaceId: "workspace-b", name: "Foreign agent" } as any,
        "user-a",
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(agentRepo.create).not.toHaveBeenCalled();
  });

  it("does not query an agent before resource access succeeds", async () => {
    const { agentRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureAgentAccess.mockRejectedValueOnce(
      new ForbiddenException("agent access denied"),
    );

    await expect(service.findOne("agent-b", "user-a")).rejects.toThrow(
      ForbiddenException,
    );

    expect(agentRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
