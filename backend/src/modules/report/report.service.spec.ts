import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ReportService } from "./report.service";

function createHarness() {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  const reportRepo = {
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const resourceAccessService = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
    ensureThreadAccess: jest.fn().mockResolvedValue({
      id: "thread-a",
      workspaceId: "workspace-a",
    }),
    ensureTeamAccess: jest.fn().mockResolvedValue(undefined),
    getTeamWorkspaceId: jest.fn().mockResolvedValue("workspace-a"),
  };
  const service = new ReportService(
    reportRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    reportRepo as any,
    resourceAccessService as any,
  );

  return { queryBuilder, reportRepo, resourceAccessService, service };
}

describe("ReportService wrap-up tenant isolation", () => {
  it("rejects an unauthorized thread before querying wrap-up rows", async () => {
    const { reportRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureThreadAccess.mockRejectedValueOnce(
      new ForbiddenException("workspace access denied"),
    );

    await expect(
      service.findWrapUps({ threadId: "thread-b" }, "user-a"),
    ).rejects.toThrow(ForbiddenException);

    expect(reportRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("always predicates a thread-only query by its authorized workspace", async () => {
    const { queryBuilder, resourceAccessService, service } = createHarness();

    await service.findWrapUps({ threadId: "thread-a" }, "user-a");

    expect(resourceAccessService.ensureThreadAccess).toHaveBeenCalledWith(
      "thread-a",
      "user-a",
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'report."workspaceId" = :workspaceId',
      { workspaceId: "workspace-a" },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'report."threadId" = :threadId',
      { threadId: "thread-a" },
    );
  });

  it("rejects mixed workspace and thread filters before querying rows", async () => {
    const { reportRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureThreadAccess.mockResolvedValueOnce({
      id: "thread-b",
      workspaceId: "workspace-b",
    });

    await expect(
      service.findWrapUps(
        { workspaceId: "workspace-a", threadId: "thread-b" },
        "user-a",
      ),
    ).rejects.toThrow(BadRequestException);

    expect(reportRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
