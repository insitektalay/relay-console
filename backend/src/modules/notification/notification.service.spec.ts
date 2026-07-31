import { ForbiddenException } from "@nestjs/common";
import { NotificationService } from "./notification.service";

function createHarness() {
  const alertRepo = {
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
  };
  const resourceAccessService = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
    ensureAlertAccess: jest.fn().mockResolvedValue({
      id: "alert-a",
      workspaceId: "workspace-a",
      isRead: false,
    }),
  };
  const service = new NotificationService(
    alertRepo as any,
    resourceAccessService as any,
  );

  return { alertRepo, resourceAccessService, service };
}

describe("NotificationService tenant isolation", () => {
  it("does not list alerts before workspace access succeeds", async () => {
    const { alertRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureWorkspaceAccess.mockRejectedValueOnce(
      new ForbiddenException("workspace access denied"),
    );

    await expect(
      service.findAll({ workspaceId: "workspace-b" }, "user-a"),
    ).rejects.toThrow(ForbiddenException);

    expect(alertRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("does not mark an alert read before resource access succeeds", async () => {
    const { alertRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureAlertAccess.mockRejectedValueOnce(
      new ForbiddenException("alert access denied"),
    );

    await expect(service.markRead("alert-b", "user-a")).rejects.toThrow(
      ForbiddenException,
    );

    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it("does not count alerts before workspace access succeeds", async () => {
    const { alertRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureWorkspaceAccess.mockRejectedValueOnce(
      new ForbiddenException("workspace access denied"),
    );

    await expect(
      service.getUnreadCount("workspace-b", "user-a"),
    ).rejects.toThrow(ForbiddenException);

    expect(alertRepo.count).not.toHaveBeenCalled();
  });
});
