import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import {
  MessageEntity,
  ThreadEntity,
  ThreadReadStateEntity,
  ThreadWrapUpReportEntity,
} from "../../entities";
import { ThreadMembershipService } from "./thread-membership.service";
import { ThreadWrapUpService } from "./thread-wrap-up.service";
import { ThreadSessionService } from "./thread-session.service";
import { ThreadRuntimeLifecycleService } from "./thread-runtime-lifecycle.service";
import {
  RUNTIME_STRUCTURED_JOB_PROVIDER,
  RuntimeStructuredJobService,
} from "../runtime/runtime-structured-job.service";
import { ResourceAccessService } from "../resource-access/resource-access.service";

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((input) => ({ ...input })),
    save: jest
      .fn()
      .mockImplementation((input) =>
        Promise.resolve({ id: "report-1", ...input }),
      ),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function flushBackgroundWork() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function buildService() {
  const threadRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue({
      id: "thread-1",
      title: "GapMiner Team",
      type: "team",
      workspaceId: "ws-1",
      teamId: "team-1",
      status: "active",
      agentIds: ["agent-1"],
    }),
  });
  const messageRepo = makeRepoMock({
    find: jest.fn().mockResolvedValue([
      {
        id: "message-1",
        threadId: "thread-1",
        senderId: "user-1",
        senderName: "Alex",
        content: "We found the root cause and GapMiner will patch it.",
        type: "text",
        provenance: "user",
        isFromUser: true,
        createdAt: new Date("2026-03-25T17:00:00.000Z"),
      },
    ]),
  });
  const wrapUpReportRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((input) =>
      Promise.resolve({
        id: "report-1",
        createdAt: new Date("2026-03-25T17:05:00.000Z"),
        updatedAt: new Date("2026-03-25T17:05:00.000Z"),
        ...input,
      }),
    ),
  });
  const threadMembershipService = {
    listMemberAgents: jest.fn().mockResolvedValue([
      {
        id: "agent-1",
        name: "GapMiner",
        role: "Lead Investigator",
        externalId: "gapminer",
      },
    ]),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "WRAP_UP_STRUCTURED_JOB_MODEL") return "gpt-5.5";
      return undefined;
    }),
  };
  const runtimeStructuredJobService = {
    runStructuredJob: jest.fn().mockResolvedValue({
      model: "gpt-5.5",
      runtimeType: "openclaw",
      agentId: "agent-1",
      externalAgentId: "gapminer",
      job: { id: "job-1" },
      output: {
        reportTldr:
          "The team confirmed the root cause, agreed on a patch, and identified production verification as the next risk.",
        overview:
          "GapMiner and Alex confirmed the root cause and agreed on a patch.",
        overviewTldr:
          "GapMiner and Alex aligned on the issue and the immediate fix.",
        participantSummaries: [
          {
            speaker: "Alex",
            role: "user",
            summary: "Asked the team to confirm the issue and next action.",
          },
        ],
        whoSaidWhatTldr:
          "Alex asked for confirmation and GapMiner took ownership of the fix.",
        discoveries: ["The root cause was confirmed in the thread."],
        discoveriesTldr: "The core discovery was confirmation of the root cause.",
        completedActions: ["The issue was investigated."],
        completedActionsTldr: "The investigation work was completed.",
        outstandingWork: ["Apply the patch and verify it in production."],
        outstandingWorkTldr:
          "The patch still needs to be applied and checked in production.",
        commitments: [
          {
            owner: "GapMiner",
            commitment: "Patch the issue and report back.",
          },
        ],
        commitmentsTldr: "GapMiner committed to patching the issue.",
        risks: ["Production verification is still pending."],
        risksTldr: "The main risk is unverified production behavior.",
        nextSteps: ["Ship the patch and validate the result."],
        nextStepsTldr: "Ship the patch, then validate it.",
        timeline: [
          {
            speaker: "Alex",
            timestamp: "2026-03-25T17:00:00.000Z",
            summary: "Confirmed the issue and aligned on the fix.",
          },
        ],
        timelineTldr:
          "The key moment was the confirmation of the issue and fix path.",
      },
    }),
  };
  const readStateRepo = makeRepoMock();
  const threadSessionService = {
    ensureActiveSession: jest.fn().mockResolvedValue({
      id: "session-1",
      threadId: "thread-1",
      sequenceNumber: 1,
      status: "active",
    }),
    wrapUpActiveSession: jest.fn().mockResolvedValue({
      wrappedSession: {
        id: "session-1",
        threadId: "thread-1",
        sequenceNumber: 1,
        status: "wrapped_up",
      },
      activeSession: {
        id: "session-2",
        threadId: "thread-1",
        sequenceNumber: 2,
        status: "active",
      },
    }),
  };
  const resourceAccessService = {
    ensureWrapUpAccess: jest.fn(),
    ensureWorkspaceAccess: jest.fn().mockResolvedValue({
      workspace: { id: "ws-1" },
      role: "owner",
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ThreadWrapUpService,
      { provide: getRepositoryToken(ThreadEntity), useValue: threadRepo },
      { provide: getRepositoryToken(MessageEntity), useValue: messageRepo },
      {
        provide: getRepositoryToken(ThreadWrapUpReportEntity),
        useValue: wrapUpReportRepo,
      },
      {
        provide: getRepositoryToken(ThreadReadStateEntity),
        useValue: readStateRepo,
      },
      { provide: ThreadMembershipService, useValue: threadMembershipService },
      { provide: ThreadSessionService, useValue: threadSessionService },
      { provide: ConfigService, useValue: configService },
      {
        provide: RuntimeStructuredJobService,
        useValue: runtimeStructuredJobService,
      },
      {
        provide: ResourceAccessService,
        useValue: resourceAccessService,
      },
      {
        provide: ThreadRuntimeLifecycleService,
        useValue: {
          closeThreadSessionsForThread: jest.fn().mockResolvedValue(undefined),
        },
      },
    ],
  }).compile();

  return {
    service: module.get(ThreadWrapUpService),
    threadRepo,
    wrapUpReportRepo,
    readStateRepo,
    threadSessionService,
    runtimeStructuredJobService,
    resourceAccessService,
  };
}

describe("ThreadWrapUpService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("blocks user A from fetching user B wrap-up report by guessed thread id", async () => {
    const {
      service,
      threadRepo,
      wrapUpReportRepo,
      resourceAccessService,
    } = await buildService();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-b",
      workspaceId: "ws-b",
    });
    resourceAccessService.ensureWorkspaceAccess.mockRejectedValue(
      new ForbiddenException("You do not have access to this workspace"),
    );

    await expect(
      service.getWrapUpReport("thread-b", "user-a"),
    ).rejects.toThrow(ForbiddenException);
    expect(wrapUpReportRepo.findOne).not.toHaveBeenCalled();
  });

  it("blocks user A from wrapping up user B thread by guessed thread id", async () => {
    const {
      service,
      threadRepo,
      threadSessionService,
      resourceAccessService,
    } = await buildService();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-b",
      workspaceId: "ws-b",
    });
    resourceAccessService.ensureWorkspaceAccess.mockRejectedValue(
      new ForbiddenException("You do not have access to this workspace"),
    );

    await expect(service.wrapUpThread("thread-b", "user-a")).rejects.toThrow(
      ForbiddenException,
    );
    expect(threadSessionService.ensureActiveSession).not.toHaveBeenCalled();
  });

  it("generates a markdown wrap-up report and resets the team thread to a new session", async () => {
    const {
      service,
      threadRepo,
      wrapUpReportRepo,
      readStateRepo,
      threadSessionService,
      runtimeStructuredJobService,
    } = await buildService();
    const result = await service.wrapUpThread("thread-1", "user-1");

    expect(result.status).toBe("active");
    expect(result.activeSessionId).toBe("session-2");
    expect(result.report.status).toBe("generating");
    expect(result.report.markdown).toContain("running in the background");
    expect(result.report.provider).toBe(RUNTIME_STRUCTURED_JOB_PROVIDER);
    expect(wrapUpReportRepo.save).toHaveBeenCalled();
    expect(threadSessionService.wrapUpActiveSession).toHaveBeenCalled();
    expect(readStateRepo.update).toHaveBeenCalledWith(
      { threadId: "thread-1" },
      expect.objectContaining({
        lastReadMessageId: null,
        unreadCount: 0,
      }),
    );
    expect(threadRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "thread-1",
        status: "active",
        lastMessage: null,
      }),
    );
    await flushBackgroundWork();
    expect(runtimeStructuredJobService.runStructuredJob).toHaveBeenCalled();
    expect(runtimeStructuredJobService.runStructuredJob).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: "thread_wrap_up_report_v2",
      }),
    );
    expect(wrapUpReportRepo.update).toHaveBeenCalledWith(
      "report-1",
      expect.objectContaining({
        status: "completed",
        markdown: expect.stringContaining("# GapMiner Team Team Chat Report"),
      }),
    );
    expect(wrapUpReportRepo.update).toHaveBeenCalledWith(
      "report-1",
      expect.objectContaining({
        markdown: expect.stringContaining("## TLDR"),
      }),
    );
    expect(wrapUpReportRepo.update).toHaveBeenCalledWith(
      "report-1",
      expect.objectContaining({
        markdown: expect.stringContaining("**TLDR:**"),
      }),
    );
  });

  it("generates a wrap-up report and resets a direct chat to a new session", async () => {
    const { service, threadRepo, wrapUpReportRepo, threadSessionService } =
      await buildService();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-2",
      title: "GapMiner",
      type: "direct",
      workspaceId: "ws-1",
      status: "active",
      agentIds: ["agent-1"],
    });

    const result = await service.wrapUpThread("thread-2", "user-1");

    expect(result.status).toBe("active");
    expect(result.activeSessionId).toBe("session-2");
    expect(result.report.status).toBe("generating");
    expect(result.report.markdown).toContain("running in the background");
    expect(wrapUpReportRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "GapMiner Direct Chat Report · Session 1",
        teamId: null,
        status: "generating",
      }),
    );
    expect(threadSessionService.wrapUpActiveSession).toHaveBeenCalled();
    await flushBackgroundWork();
    expect(wrapUpReportRepo.update).toHaveBeenCalledWith(
      "report-1",
      expect.objectContaining({
        status: "completed",
        markdown: expect.stringContaining("# GapMiner Direct Chat Report"),
      }),
    );
  });

  it("resumes the reset when a report already exists for the active session", async () => {
    const { service, wrapUpReportRepo, threadSessionService } =
      await buildService();

    wrapUpReportRepo.findOne.mockResolvedValue({
      id: "report-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      threadSessionSequenceNumber: 1,
      workspaceId: "ws-1",
      title: "GapMiner Team Team Chat Report · Session 1",
      fileName: "gapminer-team-cycle-1.md",
      provider: RUNTIME_STRUCTURED_JOB_PROVIDER,
      model: "gpt-5.5",
      markdown: "# Existing report",
      structuredData: {},
      messageCount: 1,
      createdByUserId: "user-1",
      createdAt: new Date("2026-03-25T17:05:00.000Z"),
      updatedAt: new Date("2026-03-25T17:05:00.000Z"),
    });

    const result = await service.wrapUpThread("thread-1", "user-1");

    expect(result.activeSessionId).toBe("session-2");
    expect(result.report.markdown).toBe("# Existing report");
    expect(threadSessionService.wrapUpActiveSession).toHaveBeenCalled();
  });

  it("marks the report failed when runtime structured jobs are unavailable", async () => {
    const { service, runtimeStructuredJobService, wrapUpReportRepo } =
      await buildService();

    runtimeStructuredJobService.runStructuredJob.mockRejectedValue(
      new ServiceUnavailableException(
        "No connected OpenClaw or Hermes runtime agent with structured-job support is available for this workspace",
      ),
    );

    const result = await service.wrapUpThread("thread-1", "user-1");

    expect(result.status).toBe("active");
    expect(result.report.status).toBe("generating");
    expect(wrapUpReportRepo.save).toHaveBeenCalled();
    await flushBackgroundWork();
    expect(wrapUpReportRepo.update).toHaveBeenCalledWith(
      "report-1",
      expect.objectContaining({
        status: "failed",
        errorMessage: expect.stringContaining(
          "No connected OpenClaw or Hermes runtime agent",
        ),
      }),
    );
  });

  it("retries an old failed wrap-up report through runtime structured jobs", async () => {
    const {
      service,
      resourceAccessService,
      wrapUpReportRepo,
      runtimeStructuredJobService,
    } = await buildService();

    const failedReport = {
      id: "report-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      threadSessionSequenceNumber: 5,
      workspaceId: "ws-1",
      title: "GapMiner Team Team Chat Report · Session 5",
      fileName: "gapminer-team-cycle-5.md",
      provider: "claude_code_cli",
      model: "pending",
      status: "failed",
      errorMessage: "No bridge control client",
      markdown: "# Wrap-up report failed",
      structuredData: {},
      messageCount: 1,
      createdByUserId: "user-1",
      createdAt: new Date("2026-03-25T17:05:00.000Z"),
      updatedAt: new Date("2026-03-25T17:05:00.000Z"),
    };

    resourceAccessService.ensureWrapUpAccess.mockResolvedValue(failedReport);
    wrapUpReportRepo.update.mockResolvedValue({ affected: 1 });
    wrapUpReportRepo.findOne.mockResolvedValue({
      ...failedReport,
      provider: RUNTIME_STRUCTURED_JOB_PROVIDER,
      status: "generating",
      errorMessage: null,
      markdown: "Wrap-up report generation is running in the background.",
    });

    const result = await service.retryWrapUpReport("report-1", "user-1");

    expect(result.status).toBe("generating");
    expect(wrapUpReportRepo.update).toHaveBeenCalledWith(
      { id: "report-1", status: "failed" },
      expect.objectContaining({
        provider: RUNTIME_STRUCTURED_JOB_PROVIDER,
        status: "generating",
        model: "pending",
      }),
    );

    await flushBackgroundWork();
    expect(runtimeStructuredJobService.runStructuredJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: "thread_wrap_up_report",
        schemaName: "thread_wrap_up_report_v2",
        metadata: expect.objectContaining({
          reportId: "report-1",
          threadSessionSequenceNumber: 5,
        }),
      }),
    );
  });
});
