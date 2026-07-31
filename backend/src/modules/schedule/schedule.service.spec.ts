import { ForbiddenException } from "@nestjs/common";
import { SchedulingService } from "./schedule.service";

function createHarness() {
  const scheduleRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const agentRepo = { find: jest.fn() };
  const resourceAccessService = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
    ensureAgentAccess: jest.fn().mockResolvedValue(undefined),
    ensureAgentAdminAccess: jest.fn().mockResolvedValue(undefined),
  };
  const service = new SchedulingService(
    scheduleRepo as any,
    {} as any,
    {} as any,
    agentRepo as any,
    resourceAccessService as any,
  );

  return { agentRepo, resourceAccessService, scheduleRepo, service };
}

describe("SchedulingService tenant isolation", () => {
  it("does not enumerate agents before workspace access succeeds", async () => {
    const { agentRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureWorkspaceAccess.mockRejectedValueOnce(
      new ForbiddenException("workspace access denied"),
    );

    await expect(service.findAll("workspace-b", "user-a")).rejects.toThrow(
      ForbiddenException,
    );

    expect(agentRepo.find).not.toHaveBeenCalled();
  });

  it("does not read a schedule before agent access succeeds", async () => {
    const { resourceAccessService, scheduleRepo, service } = createHarness();
    resourceAccessService.ensureAgentAccess.mockRejectedValueOnce(
      new ForbiddenException("agent access denied"),
    );

    await expect(
      service.findScheduleByAgent("agent-b", "user-a"),
    ).rejects.toThrow(ForbiddenException);

    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
  });

  it("does not update a schedule before agent-admin access succeeds", async () => {
    const { resourceAccessService, scheduleRepo, service } = createHarness();
    resourceAccessService.ensureAgentAdminAccess.mockRejectedValueOnce(
      new ForbiddenException("agent admin access denied"),
    );

    await expect(
      service.createOrUpdate("agent-b", "always_on", [], "UTC", "user-a"),
    ).rejects.toThrow(ForbiddenException);

    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
    expect(scheduleRepo.save).not.toHaveBeenCalled();
  });
});
