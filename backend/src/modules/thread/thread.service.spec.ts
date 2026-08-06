import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ThreadService } from "./thread.service";
import { ThreadEntity } from "../../entities/thread.entity";
import { ThreadReadStateEntity } from "../../entities/thread-read-state.entity";
import { MessageEntity } from "../../entities/message.entity";
import { ThreadSessionEntity } from "../../entities/thread-session.entity";
import { TeamEntity } from "../../entities/team.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { DepartmentEntity } from "../../entities/department.entity";
import { ThreadMembershipService } from "./thread-membership.service";
import { ThreadSessionService } from "./thread-session.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { ThreadRuntimeLifecycleService } from "./thread-runtime-lifecycle.service";
import { ThreadUserMessageAnalysisService } from "./thread-user-message-analysis.service";
import { ThreadAgentRepeatAnalysisService } from "./thread-agent-repeat-analysis.service";

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((input) => input),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    }),
    upsert: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockImplementation((input) => Promise.resolve(input)),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function buildService() {
  const threadRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue({
      id: "thread-b",
      workspaceId: "ws-b",
      title: "Hidden thread",
      participantIds: [],
      agentIds: [],
      status: "active",
    }),
  });
  const readStateRepo = makeRepoMock();
  const messageRepo = makeRepoMock();
  const threadSessionRepo = makeRepoMock({
    find: jest.fn().mockResolvedValue([]),
  });
  const teamRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(null),
  });
  const agentRepo = makeRepoMock();
  const departmentRepo = makeRepoMock();
  const threadMembershipService = {
    hydrateThread: jest.fn().mockImplementation(async (thread) => thread),
    hydrateThreads: jest.fn().mockImplementation(async (threads) => threads),
    listMemberIds: jest.fn().mockResolvedValue([]),
    normalizeAgentIds: jest
      .fn()
      .mockImplementation((agentIds = []) =>
        Array.from(
          new Set(
            agentIds.filter(
              (agentId: unknown): agentId is string =>
                typeof agentId === "string" && agentId.trim().length > 0,
            ),
          ),
        ),
      ),
    syncMemberships: jest.fn().mockResolvedValue(undefined),
  };
  const threadSessionService = {
    createInitialSession: jest.fn().mockResolvedValue(undefined),
    ensureActiveSession: jest.fn().mockResolvedValue({ id: "session-1" }),
  };
  const workspaceMembershipService = {
    ensureWorkspaceAccess: jest
      .fn()
      .mockRejectedValue(new ForbiddenException()),
  };
  const threadUserMessageAnalysisService = {
    analyze: jest.fn().mockResolvedValue(new Map()),
  };
  const threadAgentRepeatAnalysisService = {
    analyze: jest.fn().mockResolvedValue(new Map()),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ThreadService,
      { provide: getRepositoryToken(ThreadEntity), useValue: threadRepo },
      {
        provide: getRepositoryToken(ThreadReadStateEntity),
        useValue: readStateRepo,
      },
      { provide: getRepositoryToken(MessageEntity), useValue: messageRepo },
      {
        provide: getRepositoryToken(ThreadSessionEntity),
        useValue: threadSessionRepo,
      },
      { provide: getRepositoryToken(AgentEntity), useValue: agentRepo },
      { provide: getRepositoryToken(TeamEntity), useValue: teamRepo },
      {
        provide: getRepositoryToken(DepartmentEntity),
        useValue: departmentRepo,
      },
      { provide: ThreadMembershipService, useValue: threadMembershipService },
      { provide: ThreadSessionService, useValue: threadSessionService },
      {
        provide: WorkspaceMembershipService,
        useValue: workspaceMembershipService,
      },
      {
        provide: ThreadUserMessageAnalysisService,
        useValue: threadUserMessageAnalysisService,
      },
      {
        provide: ThreadAgentRepeatAnalysisService,
        useValue: threadAgentRepeatAnalysisService,
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
    service: module.get(ThreadService),
    threadRepo,
    readStateRepo,
    messageRepo,
    threadSessionRepo,
    teamRepo,
    agentRepo,
    departmentRepo,
    threadMembershipService,
    workspaceMembershipService,
    threadUserMessageAnalysisService,
    threadAgentRepeatAnalysisService,
  };
}

describe("ThreadService", () => {
  it("blocks user A from loading user B thread by guessed id", async () => {
    const { service } = await buildService();

    await expect(service.findOne("thread-b", "user-a")).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("stops a foreign-workspace search before constructing its query", async () => {
    const { service, threadRepo } = await buildService();

    await expect(
      service.searchThreads("ws-b", "user-a", "hidden"),
    ).rejects.toThrow(ForbiddenException);

    expect(threadRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("always constrains an authorized thread search to its explicit workspace", async () => {
    const { service, threadRepo, workspaceMembershipService } =
      await buildService();
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValueOnce(
      undefined,
    );
    threadRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    await service.searchThreads("ws-a", "user-a", "roadmap");

    expect(
      workspaceMembershipService.ensureWorkspaceAccess,
    ).toHaveBeenCalledWith("ws-a", "user-a");
    expect(queryBuilder.where).toHaveBeenCalledWith(
      't."workspaceId" = :workspaceId',
      { workspaceId: "ws-a" },
    );
  });

  it("hydrates unread counts for listed threads in one batched read", async () => {
    const {
      service,
      threadRepo,
      readStateRepo,
      threadMembershipService,
      workspaceMembershipService,
    } = await buildService();
    const pageThreads = [
      {
        id: "thread-1",
        workspaceId: "ws-1",
        title: "First",
        participantIds: [],
        agentIds: [],
        status: "active",
      },
      {
        id: "thread-2",
        workspaceId: "ws-1",
        title: "Second",
        participantIds: [],
        agentIds: [],
        status: "active",
      },
    ];
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([pageThreads, 2]),
    };

    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValue(
      undefined,
    );
    threadRepo.createQueryBuilder.mockReturnValue(qb);
    threadMembershipService.hydrateThreads.mockResolvedValue(pageThreads);
    readStateRepo.find.mockResolvedValue([
      { threadId: "thread-1", unreadCount: 3 },
      { threadId: "thread-2", unreadCount: 0 },
    ]);

    const result = await service.findAll("ws-1", "user-1", {
      page: 1,
      pageSize: 20,
    });

    expect(readStateRepo.find).toHaveBeenCalledTimes(1);
    expect(readStateRepo.findOne).not.toHaveBeenCalled();
    expect(result.data).toEqual([
      expect.objectContaining({ id: "thread-1", unreadCount: 3 }),
      expect.objectContaining({ id: "thread-2", unreadCount: 0 }),
    ]);
  });

  it("recovers legacy direct and team agent identities for conversation avatars", async () => {
    const {
      service,
      threadRepo,
      readStateRepo,
      messageRepo,
      agentRepo,
      threadMembershipService,
      workspaceMembershipService,
    } = await buildService();
    const pageThreads = [
      {
        id: "thread-researcher-jeff",
        workspaceId: "ws-1",
        title: "Researcher Jeff Hermes",
        type: "direct",
        participantIds: [],
        agentIds: [],
        lastMessage: null,
        status: "active",
      },
      {
        id: "thread-relay-console",
        workspaceId: "ws-1",
        title: "Relay Console",
        type: "direct",
        participantIds: [],
        agentIds: [],
        lastMessage: null,
        status: "active",
      },
      {
        id: "thread-todays-team",
        workspaceId: "ws-1",
        title: "Todays Team",
        type: "team",
        participantIds: [],
        agentIds: [],
        lastMessage: null,
        status: "active",
      },
      {
        id: "thread-new-chat",
        workspaceId: "ws-1",
        title: "New chat",
        type: "direct",
        participantIds: [],
        agentIds: [],
        lastMessage: null,
        status: "active",
      },
    ];
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([pageThreads, 4]),
    };

    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValue(
      undefined,
    );
    threadRepo.createQueryBuilder.mockReturnValue(qb);
    threadMembershipService.hydrateThreads.mockResolvedValue(pageThreads);
    readStateRepo.find.mockResolvedValue([]);
    agentRepo.find.mockResolvedValue([
      {
        id: "agent-jeff",
        name: "jeff_hermes",
        externalId: "jeff-hermes",
        avatarUrl: "/avatars/jeff.png",
        teamId: null,
        departmentId: null,
      },
      {
        id: "agent-relay-helper",
        name: "Relay Console Helper",
        externalId: "relay-console-helper",
        avatarUrl: "/avatars/relay.png",
        teamId: null,
        departmentId: null,
      },
      {
        id: "agent-john",
        name: "John Doe",
        externalId: "john-doe",
        avatarUrl: "/avatars/john.png",
        teamId: null,
        departmentId: null,
      },
      {
        id: "agent-chan",
        name: "Chan Hermes",
        externalId: "chan-hermes",
        avatarUrl: "/avatars/chan.png",
        teamId: null,
        departmentId: null,
      },
    ]);
    messageRepo.find.mockResolvedValue([
      {
        id: "message-relay",
        threadId: "thread-relay-console",
        senderId: "agent-relay-helper",
        senderName: "Relay Console Helper",
        senderAvatarUrl: "/avatars/relay.png",
        content: "I opened the Google Docs setup pages.",
        createdAt: new Date("2026-07-21T16:00:00Z"),
      },
      {
        id: "message-team-chan",
        threadId: "thread-todays-team",
        senderId: "agent-chan",
        senderName: "Chan Hermes",
        senderAvatarUrl: "/avatars/chan.png",
        content: "Agreed. This contract is clean.",
        createdAt: new Date("2026-07-21T15:00:00Z"),
      },
      {
        id: "message-team-john",
        threadId: "thread-todays-team",
        senderId: "agent-john",
        senderName: "John Doe",
        senderAvatarUrl: "/avatars/john.png",
        content: "I agree.",
        createdAt: new Date("2026-07-21T14:00:00Z"),
      },
      {
        id: "message-team-user",
        threadId: "thread-todays-team",
        senderId: "user-1",
        senderName: "Alex",
        senderAvatarUrl: null,
        content: "Please check this contract.",
        createdAt: new Date("2026-07-21T13:00:00Z"),
      },
    ]);

    const result = await service.findAll("ws-1", "user-1", {
      page: 1,
      pageSize: 20,
    });

    expect(result.data).toEqual([
      expect.objectContaining({
        id: "thread-researcher-jeff",
        agentIds: ["agent-jeff"],
      }),
      expect.objectContaining({
        id: "thread-relay-console",
        agentIds: ["agent-relay-helper"],
        lastMessage: expect.objectContaining({
          id: "message-relay",
          content: "I opened the Google Docs setup pages.",
          senderId: "agent-relay-helper",
          senderAvatarUrl: "/avatars/relay.png",
        }),
      }),
      expect.objectContaining({
        id: "thread-todays-team",
        agentIds: ["agent-chan", "agent-john"],
      }),
      expect.objectContaining({ id: "thread-new-chat", agentIds: [] }),
    ]);
  });

  it("adds the team lead but not the department head to new team thread memberships", async () => {
    const {
      service,
      threadRepo,
      agentRepo,
      teamRepo,
      departmentRepo,
      threadMembershipService,
      workspaceMembershipService,
    } = await buildService();

    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValue(
      undefined,
    );
    teamRepo.findOne.mockResolvedValue({
      id: "team-target-execute",
      departmentId: "department-seo",
      leadAgentId: "execution_optimizer",
    });
    departmentRepo.findOne.mockResolvedValue({
      id: "department-seo",
      headAgentId: "seo_manager",
    });
    agentRepo.find.mockResolvedValue([
      { id: "targeting_maintenance" },
      { id: "research_worker" },
      { id: "execution_optimizer" },
      { id: "seo_manager" },
    ]);
    threadRepo.create.mockImplementation((input: unknown) => input);
    threadRepo.save.mockImplementation(async (input: any) => ({
      ...input,
      id: "thread-target-execute",
    }));
    threadRepo.findOne.mockResolvedValue({
      id: "thread-target-execute",
      workspaceId: "ws-1",
      title: "Target & Execute",
      type: "team",
      teamId: "team-target-execute",
      agentIds: [
        "targeting_maintenance",
        "research_worker",
        "execution_optimizer",
      ],
      status: "active",
    });

    await service.create(
      {
        title: "Target & Execute",
        workspaceId: "ws-1",
        type: "team",
        teamId: "team-target-execute",
        agentIds: [],
      },
      "user-1",
    );

    expect(threadMembershipService.syncMemberships).toHaveBeenCalledWith(
      expect.objectContaining({ id: "thread-target-execute" }),
      ["targeting_maintenance", "research_worker", "execution_optimizer"],
    );
  });

  it("returns per-session requesting-user analysis metrics in thread analytics", async () => {
    const {
      service,
      threadRepo,
      messageRepo,
      threadSessionRepo,
      workspaceMembershipService,
      threadUserMessageAnalysisService,
      threadAgentRepeatAnalysisService,
    } = await buildService();

    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValue(
      undefined,
    );
    threadRepo.findOne.mockResolvedValue({
      id: "thread-1",
      workspaceId: "ws-1",
      title: "PageJourney Guys",
      type: "team",
      participantIds: [],
      agentIds: ["agent-1"],
      status: "active",
    });
    threadSessionRepo.find.mockResolvedValue([
      {
        id: "session-1",
        threadId: "thread-1",
        sequenceNumber: 1,
        status: "wrapped_up",
        startedAt: new Date("2026-04-16T10:00:00.000Z"),
        endedAt: new Date("2026-04-16T11:00:00.000Z"),
      },
      {
        id: "session-2",
        threadId: "thread-1",
        sequenceNumber: 2,
        status: "active",
        startedAt: new Date("2026-04-16T12:00:00.000Z"),
        endedAt: null,
      },
    ]);
    messageRepo.find.mockResolvedValue([
      {
        id: "m1",
        threadId: "thread-1",
        threadSessionId: "session-1",
        senderId: "agent-1",
        senderName: "Elliot",
        content: "Started the investigation.",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T10:00:00.000Z"),
      },
      {
        id: "m2",
        threadId: "thread-1",
        threadSessionId: "session-1",
        senderId: "user-1",
        senderName: "Alex",
        content: "What's the current state?",
        type: "text",
        provenance: "user",
        isFromUser: true,
        createdAt: new Date("2026-04-16T10:20:00.000Z"),
      },
      {
        id: "m3",
        threadId: "thread-1",
        threadSessionId: "session-1",
        senderId: "agent-1",
        senderName: "Elliot",
        content: "Waiting on one dependency.",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T10:22:00.000Z"),
      },
      {
        id: "m4",
        threadId: "thread-1",
        threadSessionId: "session-2",
        senderId: "agent-1",
        senderName: "Elliot",
        content: "Resumed after wrap-up.",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T12:00:00.000Z"),
      },
      {
        id: "m5",
        threadId: "thread-1",
        threadSessionId: "session-2",
        senderId: "user-1",
        senderName: "Alex",
        content: "Keep going.",
        type: "text",
        provenance: "user",
        isFromUser: true,
        createdAt: new Date("2026-04-16T12:45:00.000Z"),
      },
    ]);
    threadUserMessageAnalysisService.analyze.mockResolvedValue(
      new Map([
        [
          "session-1",
          {
            status: "ready",
            summary: "Mostly status checking after a quiet period.",
            timingInterpretation:
              "This looks like a silence-driven check-in rather than absence.",
            repeatedPatterns: ["Progress checks"],
            oneOffIssues: [],
            dominantIntentLabels: ["Status check"],
            repeatedInstructionShare: 0.4,
            oneOffIssueShare: 0.1,
            silencePromptShare: 0.8,
            clusters: [
              {
                label: "Status check",
                description: "Asks for the latest state of work.",
                messageCount: 1,
                exampleMessages: ["What's the current state?"],
              },
            ],
            errorMessage: null,
          },
        ],
      ]),
    );

    const result = await service.getAnalytics("thread-1", "user-1", {
      activityGapMinutes: 30,
    });

    expect(result.requestingUserMessageCount).toBe(2);
    expect(result.sessionBreakdown[0]).toEqual(
      expect.objectContaining({
        threadSessionId: "session-1",
        requestingUserMessageCount: 1,
        messagesAfterLongSilenceCount: 0,
        medianMinutesSincePreviousAgentMessage: 20,
        requestingUserAnalysis: expect.objectContaining({
          summary: "Mostly status checking after a quiet period.",
        }),
      }),
    );
    expect(result.sessionBreakdown[1]).toEqual(
      expect.objectContaining({
        threadSessionId: "session-2",
        requestingUserMessageCount: 1,
        messagesAfterLongSilenceCount: 1,
        messagesAfterAgentSilenceCount: 1,
        requestingUserAnalysis: null,
      }),
    );
    expect(threadUserMessageAnalysisService.analyze).toHaveBeenCalled();
    expect(threadAgentRepeatAnalysisService.analyze).toHaveBeenCalled();
  });

  it("attributes legacy user messages in single-participant threads to the requesting user", async () => {
    const {
      service,
      threadRepo,
      messageRepo,
      threadSessionRepo,
      workspaceMembershipService,
      threadUserMessageAnalysisService,
      threadAgentRepeatAnalysisService,
    } = await buildService();

    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValue(
      undefined,
    );
    threadRepo.findOne.mockResolvedValue({
      id: "thread-legacy",
      workspaceId: "ws-1",
      title: "PageJourney Guys",
      type: "team",
      participantIds: ["user-1"],
      agentIds: ["agent-1"],
      status: "active",
    });
    threadSessionRepo.find.mockResolvedValue([
      {
        id: "session-1",
        threadId: "thread-legacy",
        sequenceNumber: 1,
        status: "wrapped_up",
        startedAt: new Date("2026-04-16T10:00:00.000Z"),
        endedAt: new Date("2026-04-16T11:00:00.000Z"),
      },
    ]);
    messageRepo.find.mockResolvedValue([
      {
        id: "m1",
        threadId: "thread-legacy",
        threadSessionId: "session-1",
        senderId: "legacy-user-42",
        senderName: "Alex",
        content: "Can you summarise the blockers?",
        type: "text",
        provenance: "user",
        isFromUser: true,
        createdAt: new Date("2026-04-16T10:20:00.000Z"),
      },
    ]);
    threadUserMessageAnalysisService.analyze.mockResolvedValue(
      new Map([
        [
          "session-1",
          {
            status: "ready",
            summary: "Status check",
            timingInterpretation: null,
            repeatedPatterns: [],
            oneOffIssues: [],
            dominantIntentLabels: ["Status check"],
            repeatedInstructionShare: null,
            oneOffIssueShare: null,
            silencePromptShare: null,
            clusters: [],
            errorMessage: null,
          },
        ],
      ]),
    );
    threadAgentRepeatAnalysisService.analyze.mockResolvedValue(new Map());

    const result = await service.getAnalytics("thread-legacy", "user-1", {
      activityGapMinutes: 30,
    });

    expect(result.requestingUserMessageCount).toBe(1);
    expect(result.sessionBreakdown[0]).toEqual(
      expect.objectContaining({
        threadSessionId: "session-1",
        agentMessageCount: 0,
        agentRepeatAnalysisStatus: "not_run",
        agentRepeatAnalysisErrorMessage: null,
        requestingUserMessageCount: 1,
        requestingUserAnalysis: expect.objectContaining({
          summary: "Status check",
        }),
      }),
    );
  });

  it("reports repeated agent messages per session", async () => {
    const {
      service,
      threadRepo,
      messageRepo,
      threadSessionRepo,
      workspaceMembershipService,
      threadUserMessageAnalysisService,
      threadAgentRepeatAnalysisService,
    } = await buildService();

    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValue(
      undefined,
    );
    threadRepo.findOne.mockResolvedValue({
      id: "thread-repeat",
      workspaceId: "ws-1",
      title: "PageJourney Guys",
      type: "team",
      participantIds: ["user-1"],
      agentIds: ["agent-1", "agent-2"],
      status: "active",
    });
    threadSessionRepo.find.mockResolvedValue([
      {
        id: "session-1",
        threadId: "thread-repeat",
        sequenceNumber: 1,
        status: "active",
        startedAt: new Date("2026-04-16T10:00:00.000Z"),
        endedAt: null,
      },
    ]);
    messageRepo.find.mockResolvedValue([
      {
        id: "m1",
        threadId: "thread-repeat",
        threadSessionId: "session-1",
        senderId: "agent-1",
        senderName: "Elliot",
        content: "I've done that already",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T10:00:00.000Z"),
      },
      {
        id: "m2",
        threadId: "thread-repeat",
        threadSessionId: "session-1",
        senderId: "agent-2",
        senderName: "Page",
        content: "I've done that already.",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T10:01:00.000Z"),
      },
      {
        id: "m3",
        threadId: "thread-repeat",
        threadSessionId: "session-1",
        senderId: "agent-1",
        senderName: "Elliot",
        content: "Working on the fix now",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T10:02:00.000Z"),
      },
      {
        id: "m4",
        threadId: "thread-repeat",
        threadSessionId: "session-1",
        senderId: "agent-1",
        senderName: "Elliot",
        content: "Working on the fix now.",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T10:03:00.000Z"),
      },
      {
        id: "m5",
        threadId: "thread-repeat",
        threadSessionId: "session-1",
        senderId: "agent-2",
        senderName: "Page",
        content: "I've done that already!",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T10:04:00.000Z"),
      },
    ]);
    threadUserMessageAnalysisService.analyze.mockResolvedValue(new Map());
    threadAgentRepeatAnalysisService.analyze.mockResolvedValue(
      new Map([
        [
          "session-1",
          {
            status: "ready",
            errorMessage: null,
            repeatedAgentMessageCount: 2,
            repeatedCrossAgentMessageCount: 1,
            agentRepeatGroupCount: 1,
            repeatedAgentMessageGroups: [
              {
                representativeMessage: "I've already done that",
                occurrenceCount: 3,
                repeatedCount: 2,
                senderCount: 2,
                senderNames: ["Elliot", "Page"],
                firstMessageAt: "2026-04-16T10:00:00.000Z",
                lastMessageAt: "2026-04-16T10:04:00.000Z",
              },
            ],
          },
        ],
      ]),
    );

    const result = await service.getAnalytics("thread-repeat", "user-1", {
      activityGapMinutes: 30,
      agentRepeatSessionId: "session-1",
    });

    expect(result.agentMessageCount).toBe(5);
    expect(result.sessionBreakdown[0]).toEqual(
      expect.objectContaining({
        threadSessionId: "session-1",
        agentMessageCount: 5,
        agentRepeatAnalysisStatus: "ready",
        agentRepeatAnalysisErrorMessage: null,
        repeatedAgentMessageCount: 2,
        repeatedCrossAgentMessageCount: 1,
        agentRepeatGroupCount: 1,
      }),
    );
    expect(result.sessionBreakdown[0].repeatedAgentMessageGroups).toEqual([
      expect.objectContaining({
        representativeMessage: "I've already done that",
        occurrenceCount: 3,
        repeatedCount: 2,
        senderCount: 2,
        senderNames: ["Elliot", "Page"],
      }),
    ]);
  });

  it("marks non-targeted sessions as not run and supports targeting a wrapped session explicitly", async () => {
    const {
      service,
      threadRepo,
      messageRepo,
      threadSessionRepo,
      workspaceMembershipService,
      threadUserMessageAnalysisService,
      threadAgentRepeatAnalysisService,
    } = await buildService();

    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValue(
      undefined,
    );
    threadRepo.findOne.mockResolvedValue({
      id: "thread-target-repeat",
      workspaceId: "ws-1",
      title: "PageJourney Guys",
      type: "team",
      participantIds: ["user-1"],
      agentIds: ["agent-1", "agent-2"],
      status: "active",
    });
    threadSessionRepo.find.mockResolvedValue([
      {
        id: "session-1",
        threadId: "thread-target-repeat",
        sequenceNumber: 1,
        status: "wrapped_up",
        startedAt: new Date("2026-04-16T10:00:00.000Z"),
        endedAt: new Date("2026-04-16T10:05:00.000Z"),
      },
      {
        id: "session-2",
        threadId: "thread-target-repeat",
        sequenceNumber: 2,
        status: "active",
        startedAt: new Date("2026-04-16T11:00:00.000Z"),
        endedAt: null,
      },
    ]);
    messageRepo.find.mockResolvedValue([
      {
        id: "m1",
        threadId: "thread-target-repeat",
        threadSessionId: "session-1",
        senderId: "agent-1",
        senderName: "Elliot",
        content: "That fix is already done",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T10:00:00.000Z"),
      },
      {
        id: "m2",
        threadId: "thread-target-repeat",
        threadSessionId: "session-1",
        senderId: "agent-2",
        senderName: "Page",
        content: "That fix has already been done",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T10:01:00.000Z"),
      },
      {
        id: "m3",
        threadId: "thread-target-repeat",
        threadSessionId: "session-2",
        senderId: "agent-1",
        senderName: "Elliot",
        content: "Working on the new issue now",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T11:00:00.000Z"),
      },
    ]);
    threadUserMessageAnalysisService.analyze.mockResolvedValue(new Map());
    threadAgentRepeatAnalysisService.analyze.mockResolvedValue(
      new Map([
        [
          "session-1",
          {
            status: "ready",
            errorMessage: null,
            repeatedAgentMessageCount: 1,
            repeatedCrossAgentMessageCount: 1,
            agentRepeatGroupCount: 1,
            repeatedAgentMessageGroups: [
              {
                representativeMessage: "That fix is already done",
                occurrenceCount: 2,
                repeatedCount: 1,
                senderCount: 2,
                senderNames: ["Elliot", "Page"],
                firstMessageAt: "2026-04-16T10:00:00.000Z",
                lastMessageAt: "2026-04-16T10:01:00.000Z",
              },
            ],
          },
        ],
      ]),
    );

    const result = await service.getAnalytics(
      "thread-target-repeat",
      "user-1",
      {
        activityGapMinutes: 30,
        agentRepeatSessionId: "session-1",
      },
    );

    expect(threadAgentRepeatAnalysisService.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        sessions: [
          expect.objectContaining({
            threadSessionId: "session-1",
            agentMessageCount: 2,
          }),
        ],
      }),
    );
    expect(result.sessionBreakdown[0]).toEqual(
      expect.objectContaining({
        threadSessionId: "session-1",
        agentRepeatAnalysisStatus: "ready",
        repeatedAgentMessageCount: 1,
        agentRepeatGroupCount: 1,
      }),
    );
    expect(result.sessionBreakdown[1]).toEqual(
      expect.objectContaining({
        threadSessionId: "session-2",
        agentRepeatAnalysisStatus: "not_run",
        repeatedAgentMessageCount: 0,
        agentRepeatGroupCount: 0,
      }),
    );
  });

  it("surfaces failed agent repeat analysis instead of silently returning zeroes", async () => {
    const {
      service,
      threadRepo,
      messageRepo,
      threadSessionRepo,
      workspaceMembershipService,
      threadUserMessageAnalysisService,
      threadAgentRepeatAnalysisService,
    } = await buildService();

    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValue(
      undefined,
    );
    threadRepo.findOne.mockResolvedValue({
      id: "thread-repeat-failed",
      workspaceId: "ws-1",
      title: "PageJourney Guys",
      type: "team",
      participantIds: ["user-1"],
      agentIds: ["agent-1"],
      status: "active",
    });
    threadSessionRepo.find.mockResolvedValue([
      {
        id: "session-1",
        threadId: "thread-repeat-failed",
        sequenceNumber: 1,
        status: "active",
        startedAt: new Date("2026-04-16T10:00:00.000Z"),
        endedAt: null,
      },
    ]);
    messageRepo.find.mockResolvedValue([
      {
        id: "m1",
        threadId: "thread-repeat-failed",
        threadSessionId: "session-1",
        senderId: "agent-1",
        senderName: "Elliot",
        content: "Checking the latest bundle now.",
        type: "text",
        provenance: "agent",
        isFromUser: false,
        createdAt: new Date("2026-04-16T10:00:00.000Z"),
      },
    ]);
    threadUserMessageAnalysisService.analyze.mockResolvedValue(new Map());
    threadAgentRepeatAnalysisService.analyze.mockResolvedValue(
      new Map([
        [
          "session-1",
          {
            status: "failed",
            errorMessage: "Claude CLI agent repeat analysis failed: timed out",
            repeatedAgentMessageCount: 0,
            repeatedCrossAgentMessageCount: 0,
            agentRepeatGroupCount: 0,
            repeatedAgentMessageGroups: [],
          },
        ],
      ]),
    );

    const result = await service.getAnalytics(
      "thread-repeat-failed",
      "user-1",
      {
        activityGapMinutes: 30,
        agentRepeatSessionId: "session-1",
      },
    );

    expect(result.sessionBreakdown[0]).toEqual(
      expect.objectContaining({
        threadSessionId: "session-1",
        agentMessageCount: 1,
        agentRepeatAnalysisStatus: "failed",
        agentRepeatAnalysisErrorMessage:
          "Claude CLI agent repeat analysis failed: timed out",
        repeatedAgentMessageCount: 0,
        repeatedCrossAgentMessageCount: 0,
        agentRepeatGroupCount: 0,
        repeatedAgentMessageGroups: [],
      }),
    );
  });
});
