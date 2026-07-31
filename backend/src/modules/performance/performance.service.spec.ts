import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { CoachingNoteType } from "../../entities/coaching-note.entity";
import { PerformanceService } from "./performance.service";

function createHarness() {
  const metricRepo = { createQueryBuilder: jest.fn() };
  const reviewRepo = {
    create: jest.fn((data) => ({ ...data })),
    insert: jest.fn().mockResolvedValue(undefined),
    findOneByOrFail: jest.fn(async ({ id, agentId }) => ({ id, agentId })),
  };
  const coachingRepo = {
    create: jest.fn((data) => ({ ...data })),
    insert: jest.fn().mockResolvedValue(undefined),
    findOneByOrFail: jest.fn(async ({ id, agentId }) => ({ id, agentId })),
  };
  const agentRepo = { find: jest.fn() };
  const resourceAccessService = {
    ensureAgentAccess: jest.fn().mockResolvedValue({
      id: "agent-a",
      workspaceId: "workspace-a",
    }),
    ensureAgentAdminAccess: jest.fn().mockResolvedValue({
      id: "agent-a",
      workspaceId: "workspace-a",
    }),
    ensureTaskAccess: jest.fn(async (taskId: string) => ({
      id: taskId,
      workspaceId: taskId.endsWith("-b") ? "workspace-b" : "workspace-a",
    })),
    ensureTeamAccess: jest.fn().mockResolvedValue(undefined),
    ensureDepartmentAccess: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PerformanceService(
    metricRepo as any,
    reviewRepo as any,
    coachingRepo as any,
    agentRepo as any,
    {} as any,
    {} as any,
    {} as any,
    resourceAccessService as any,
  );

  return {
    agentRepo,
    coachingRepo,
    metricRepo,
    resourceAccessService,
    reviewRepo,
    service,
  };
}

describe("PerformanceService tenant isolation", () => {
  const reviewDto = {
    period: "weekly",
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-07-08T00:00:00.000Z",
    overallRating: 4,
    summary: "Strong week",
    strengths: ["Accurate"],
    improvements: ["Escalate sooner"],
  };

  it("does not query metrics before agent access succeeds", async () => {
    const { metricRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureAgentAccess.mockRejectedValueOnce(
      new ForbiddenException("agent access denied"),
    );

    await expect(
      service.getAgentMetrics("agent-b", "user-a", "daily"),
    ).rejects.toThrow(ForbiddenException);

    expect(metricRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("does not enumerate team agents before team access succeeds", async () => {
    const { agentRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureTeamAccess.mockRejectedValueOnce(
      new ForbiddenException("team access denied"),
    );

    await expect(
      service.getTeamMetrics("team-b", "user-a", "daily"),
    ).rejects.toThrow(ForbiddenException);

    expect(agentRepo.find).not.toHaveBeenCalled();
  });

  it("requires admin access before creating a review", async () => {
    const { resourceAccessService, reviewRepo, service } = createHarness();
    resourceAccessService.ensureAgentAdminAccess.mockRejectedValueOnce(
      new ForbiddenException("agent access denied"),
    );

    await expect(
      service.createReview("agent-b", reviewDto, "user-a"),
    ).rejects.toThrow(ForbiddenException);

    expect(reviewRepo.create).not.toHaveBeenCalled();
    expect(reviewRepo.insert).not.toHaveBeenCalled();
  });

  it("requires admin access before creating a coaching note", async () => {
    const { coachingRepo, resourceAccessService, service } = createHarness();
    resourceAccessService.ensureAgentAdminAccess.mockRejectedValueOnce(
      new ForbiddenException("agent access denied"),
    );

    await expect(
      service.addCoachingNote(
        "agent-b",
        { content: "Improve retries", type: CoachingNoteType.IMPROVEMENT },
        "user-a",
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(coachingRepo.create).not.toHaveBeenCalled();
    expect(coachingRepo.insert).not.toHaveBeenCalled();
  });

  it("uses insert semantics and server-owned review identity", async () => {
    const { reviewRepo, service } = createHarness();

    await service.createReview(
      "agent-a",
      {
        ...reviewDto,
        id: "attacker-id",
        agentId: "agent-b",
        reviewerId: "attacker-user",
        createdAt: "2000-01-01T00:00:00.000Z",
      } as any,
      "admin-user",
    );

    const inserted = reviewRepo.insert.mock.calls[0][0];
    expect(inserted.id).not.toBe("attacker-id");
    expect(inserted.agentId).toBe("agent-a");
    expect(inserted.reviewerId).toBe("admin-user");
    expect(inserted.createdAt).toBeUndefined();
  });

  it("rejects an invalid review period range before insert", async () => {
    const { reviewRepo, service } = createHarness();

    await expect(
      service.createReview(
        "agent-a",
        {
          ...reviewDto,
          periodEnd: reviewDto.periodStart,
        },
        "admin-user",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(reviewRepo.insert).not.toHaveBeenCalled();
  });

  it("rejects a coaching task in another workspace before insert", async () => {
    const { coachingRepo, service } = createHarness();

    await expect(
      service.addCoachingNote(
        "agent-a",
        {
          content: "Improve retries",
          type: CoachingNoteType.IMPROVEMENT,
          relatedTaskId: "task-b",
        },
        "admin-user",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(coachingRepo.insert).not.toHaveBeenCalled();
  });

  it("uses server-owned coaching identity and insert semantics", async () => {
    const { coachingRepo, service } = createHarness();

    await service.addCoachingNote(
      "agent-a",
      {
        content: "Improve retries",
        type: CoachingNoteType.INSTRUCTION,
        id: "attacker-id",
        agentId: "agent-b",
        authorId: "attacker-user",
      } as any,
      "admin-user",
    );

    const inserted = coachingRepo.insert.mock.calls[0][0];
    expect(inserted.id).not.toBe("attacker-id");
    expect(inserted.agentId).toBe("agent-a");
    expect(inserted.authorId).toBe("admin-user");
  });
});
