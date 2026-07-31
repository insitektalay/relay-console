import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ForbiddenException } from "@nestjs/common";
import { EventsGateway } from "../../gateways/events.gateway";
import { MessageService } from "./message.service";
import { ThreadMembershipService } from "../thread/thread-membership.service";
import { ThreadSessionService } from "../thread/thread-session.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { ClaudeService } from "../claude/claude.service";
import { RuntimeDispatchCoordinator } from "../runtime/runtime-dispatch-coordinator.service";
import { MessageCondensingService } from "./message-condensing.service";
import { MessageReactionEntity } from "../../entities/message-reaction.entity";
import {
  AgentEntity,
  DepartmentEntity,
  LinkedApplicationEntity,
  MarketplaceConnectionEntity,
  MarketplaceInstallEntity,
  MeetingHardRestriction,
  MeetingRulePackSnapshotEntity,
  MeetingSessionEntity,
  MeetingStatus,
  MessageEntity,
  MessageProvenance,
  TaskEntity,
  TeamEntity,
  ThreadEntity,
} from "../../entities";
import { signOpenClawAttachmentProvenance } from "./message-attachment-provenance";

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    findByIds: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((input) => ({ ...input })),
    save: jest.fn().mockImplementation((input) =>
      Promise.resolve({
        id: "message-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      }),
    ),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    }),
    ...overrides,
  };
}

async function buildService() {
  const messageRepo = makeRepoMock();
  const threadRepo = makeRepoMock({
    findOne: jest
      .fn()
      .mockResolvedValueOnce({
        id: "thread-1",
        workspaceId: "ws-1",
        title: "Thread",
        type: "direct",
        avatarUrl: null,
        participantIds: ["user-1"],
        agentIds: ["agent-1"],
        isPinned: false,
        isMuted: false,
        status: "active",
        teamId: null,
        departmentId: null,
        lastMessage: null,
        maxAgentTurns: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: "thread-1",
        workspaceId: "ws-1",
        title: "Thread",
        type: "direct",
      })
      .mockResolvedValue({
        id: "thread-1",
        workspaceId: "ws-1",
        title: "Thread",
        type: "direct",
        status: "active",
      }),
  });
  const agentRepo = makeRepoMock({
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: "agent-1",
          name: "Atlas",
          description: "External ID: main",
        },
      ]),
    }),
  });
  const teamRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(null),
  });
  const departmentRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
  });
  const meetingRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue({
      id: "meeting-1",
      threadId: "thread-1",
      status: MeetingStatus.ACTIVE,
      briefMarkdown: "Agenda",
      appliedRulePackSnapshotId: "snapshot-1",
      participantsSnapshot: [{ participantId: "user-1" }],
    }),
  });
  const snapshotRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue({
      id: "snapshot-1",
      advisoryRulesMarkdown: "Stay on topic",
      hardRestrictions: [],
    }),
  });
  const taskRepo = makeRepoMock({
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    }),
  });
  const reactionRepo = makeRepoMock();
  const marketplaceInstallRepo = makeRepoMock();
  const marketplaceConnectionRepo = makeRepoMock({
    findByIds: jest.fn().mockResolvedValue([]),
  });
  const linkedApplicationRepo = makeRepoMock();
  const threadMembershipService = {
    listMemberAgents: jest.fn().mockResolvedValue([
      {
        id: "agent-1",
        name: "Atlas",
        description: "External ID: main",
      },
    ]),
  };
  const eventsGateway = {
    emitToScopes: jest.fn(),
    emitToBridgeAgents: jest.fn(),
    emitAgentTyping: jest.fn(),
    emitToThread: jest.fn(),
    getWorkspaceBridgeRuntime: jest.fn().mockReturnValue({
      connectedBridgeDeviceCount: 1,
      bridgeControlSubscriberCount: 1,
      structuredPromptBridgeControlSubscriberCount: 1,
      liveRegisteredAgentCount: 1,
      liveRegisteredExternalAgentIds: ["main"],
    }),
  };
  const threadSessionService = {
    ensureActiveSession: jest.fn().mockResolvedValue({
      id: "session-1",
      threadId: "thread-1",
      sequenceNumber: 1,
      status: "active",
      relayRunState: "running",
      relayPauseReason: null,
      relayReplyLimit: 50,
      relayCatchUpCursors: {},
    }),
    findThreadSession: jest.fn().mockResolvedValue({
      id: "session-1",
      threadId: "thread-1",
      sequenceNumber: 1,
      status: "active",
      relayRunState: "running",
      relayPauseReason: null,
      relayReplyLimit: 50,
      relayCatchUpCursors: {},
    }),
    updateRelayControls: jest
      .fn()
      .mockImplementation(async (session, input) => ({
        ...session,
        relayRunState: input.runState,
        relayPauseReason: input.pauseReason,
        relayReplyLimit: input.replyLimit ?? session.relayReplyLimit ?? 50,
      })),
    countAgentReplies: jest.fn().mockResolvedValue(0),
    updateRelayCatchUpCursor: jest.fn().mockResolvedValue(undefined),
  };

  const runtimeDispatchCoordinator = {
    resolveEligibleBindings: jest.fn().mockResolvedValue([]),
    resolveRuntimeThreadSession: jest.fn(),
    queueDispatch: jest.fn(),
    executeDispatch: jest.fn().mockResolvedValue(undefined),
  };
  const workspaceMembershipService = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue({
      workspace: { id: "ws-1" },
      role: "owner",
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MessageService,
      { provide: getRepositoryToken(MessageEntity), useValue: messageRepo },
      { provide: getRepositoryToken(ThreadEntity), useValue: threadRepo },
      { provide: getRepositoryToken(TeamEntity), useValue: teamRepo },
      {
        provide: getRepositoryToken(DepartmentEntity),
        useValue: departmentRepo,
      },
      { provide: getRepositoryToken(AgentEntity), useValue: agentRepo },
      { provide: getRepositoryToken(TaskEntity), useValue: taskRepo },
      {
        provide: getRepositoryToken(MeetingSessionEntity),
        useValue: meetingRepo,
      },
      {
        provide: getRepositoryToken(MeetingRulePackSnapshotEntity),
        useValue: snapshotRepo,
      },
      {
        provide: getRepositoryToken(MessageReactionEntity),
        useValue: reactionRepo,
      },
      {
        provide: getRepositoryToken(MarketplaceInstallEntity),
        useValue: marketplaceInstallRepo,
      },
      {
        provide: getRepositoryToken(MarketplaceConnectionEntity),
        useValue: marketplaceConnectionRepo,
      },
      {
        provide: getRepositoryToken(LinkedApplicationEntity),
        useValue: linkedApplicationRepo,
      },
      { provide: EventsGateway, useValue: eventsGateway },
      {
        provide: ClaudeService,
        useValue: {
          isClaudeAgent: jest.fn().mockReturnValue(false),
          createDispatch: jest.fn(),
          markDispatchFailed: jest.fn(),
          getBindingByAgentId: jest.fn(),
          isClaudeAgentLive: jest.fn().mockResolvedValue(false),
          findClaudeThreadSession: jest.fn().mockResolvedValue(null),
          getOrCreateClaudeThreadSession: jest.fn(),
        },
      },
      { provide: ThreadMembershipService, useValue: threadMembershipService },
      { provide: ThreadSessionService, useValue: threadSessionService },
      {
        provide: RuntimeDispatchCoordinator,
        useValue: runtimeDispatchCoordinator,
      },
      {
        provide: WorkspaceMembershipService,
        useValue: workspaceMembershipService,
      },
      {
        provide: MessageCondensingService,
        useValue: {
          isSummarizationEnabled: jest.fn().mockReturnValue(false),
          maybeEnqueueSummary: jest.fn().mockResolvedValue(undefined),
        },
      },
    ],
  }).compile();

  return {
    service: module.get(MessageService),
    messageRepo,
    threadRepo,
    reactionRepo,
    teamRepo,
    departmentRepo,
    meetingRepo,
    snapshotRepo,
    eventsGateway,
    threadMembershipService,
    threadSessionService,
    workspaceMembershipService,
    marketplaceInstallRepo,
    marketplaceConnectionRepo,
    linkedApplicationRepo,
    runtimeDispatchCoordinator,
    messageCondensingService: module.get(MessageCondensingService),
  };
}

function makeSignedOpenClawAttachment(
  overrides: Partial<Record<string, unknown>> = {},
) {
  const attachment = {
    id: "attachment-1",
    workspaceId: "ws-1",
    threadId: "thread-1",
    bridgeDeviceId: "device-1",
    filename: "brief.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1234,
    sha256: "hash-1",
    kind: "document",
    status: "uploaded",
    storage: "openclaw_local",
    localMediaRef: "openclaw://device-1/attachment-1",
    createdAt: "2026-06-20T19:00:00.000Z",
    ...overrides,
  };
  return {
    ...attachment,
    provenanceToken: signOpenClawAttachmentProvenance({
      id: String(attachment.id),
      workspaceId: String(attachment.workspaceId),
      threadId: String(attachment.threadId),
      bridgeDeviceId: String(attachment.bridgeDeviceId),
      filename: String(attachment.filename),
      mimeType: String(attachment.mimeType),
      sizeBytes: Number(attachment.sizeBytes),
      sha256: typeof attachment.sha256 === "string" ? attachment.sha256 : null,
      kind: String(attachment.kind),
      storage: "openclaw_local",
      localMediaRef: String(attachment.localMediaRef),
      createdAt:
        typeof attachment.createdAt === "string" ? attachment.createdAt : null,
    }),
  };
}

describe("MessageService", () => {
  it("searches message content only after checking workspace access", async () => {
    const { service, messageRepo, workspaceMembershipService } =
      await buildService();
    const createdAt = new Date("2026-07-16T09:41:00.000Z");
    const queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: "message-github",
            threadId: "thread-jeff",
            senderName: "Jeff Hermes",
            content: "GitHub has been connected.",
            createdAt,
            thread: {
              title: "Jeff Hermes",
              type: "direct",
            },
          },
        ],
        1,
      ]),
    };
    messageRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.searchMessages(
      "ws-1",
      "user-1",
      "  github  ",
      1,
      20,
    );

    expect(
      workspaceMembershipService.ensureWorkspaceAccess,
    ).toHaveBeenCalledWith("ws-1", "user-1");
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "POSITION(LOWER(:query) IN LOWER(m.content)) > 0",
      { query: "github" },
    );
    expect(result).toEqual({
      data: [
        {
          id: "message-github",
          threadId: "thread-jeff",
          threadTitle: "Jeff Hermes",
          senderName: "Jeff Hermes",
          content: "GitHub has been connected.",
          timestamp: createdAt,
          threadType: "direct",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });
  });

  it("does not query messages when workspace access is denied", async () => {
    const { service, messageRepo, workspaceMembershipService } =
      await buildService();
    workspaceMembershipService.ensureWorkspaceAccess.mockRejectedValue(
      new ForbiddenException("You do not have access to this workspace"),
    );

    await expect(
      service.searchMessages("ws-other", "user-1", "github"),
    ).rejects.toThrow(ForbiddenException);
    expect(messageRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("persists a manual pause for the active Railway team relay session", async () => {
    const {
      service,
      threadRepo,
      threadSessionService,
      workspaceMembershipService,
      eventsGateway,
    } = await buildService();
    threadRepo.findOne.mockReset();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-team-1",
      workspaceId: "ws-1",
      type: "team",
      maxAgentTurns: null,
      activeSessionId: "session-1",
    });
    workspaceMembershipService.ensureWorkspaceAccess.mockResolvedValue(
      undefined,
    );
    threadSessionService.ensureActiveSession.mockResolvedValue({
      id: "session-1",
      relayRunState: "running",
      relayPauseReason: null,
      relayReplyLimit: 50,
    });

    const result = await service.pauseTeamRelay("thread-team-1", "user-1");

    expect(threadSessionService.updateRelayControls).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-1" }),
      expect.objectContaining({
        runState: "paused",
        pauseReason: "manual",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        threadId: "thread-team-1",
        runState: "paused",
        pauseReason: "manual",
        replyLimit: 50,
      }),
    );
    expect(eventsGateway.emitToScopes).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "thread-team-1" }),
      "team_relay.update",
      expect.objectContaining({ runState: "paused" }),
    );
  });

  it("holds the relay baton while paused instead of routing an agent follow-up", async () => {
    const { service, messageRepo, threadSessionService } = await buildService();
    threadSessionService.findThreadSession.mockResolvedValue({
      id: "session-1",
      relayRunState: "paused",
      relayPauseReason: "manual",
      relayReplyLimit: 50,
    });
    const message = {
      id: "message-agent-1",
      threadId: "thread-team-1",
      threadSessionId: "session-1",
      provenance: MessageProvenance.AGENT,
      isFromUser: false,
      metadata: null,
    } as MessageEntity;

    const allowed = await (service as any).teamRelayAllowsFollowUp(
      {
        id: "thread-team-1",
        workspaceId: "ws-1",
        type: "team",
        maxAgentTurns: null,
      },
      message,
    );

    expect(allowed).toBe(false);
    expect(messageRepo.update).toHaveBeenCalledWith(
      "message-agent-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          teamRelayRoutingState: "pending",
          teamRelayPauseReason: "manual",
        }),
      }),
    );
  });

  it("pauses and retains the baton when the persisted relay reply limit is reached", async () => {
    const { service, messageRepo, threadSessionService } = await buildService();
    threadSessionService.findThreadSession.mockResolvedValue({
      id: "session-1",
      relayRunState: "running",
      relayPauseReason: null,
      relayReplyLimit: 50,
    });
    threadSessionService.countAgentReplies.mockResolvedValue(50);
    const message = {
      id: "message-agent-6",
      threadId: "thread-team-1",
      threadSessionId: "session-1",
      provenance: MessageProvenance.AGENT,
      isFromUser: false,
      metadata: null,
    } as MessageEntity;

    const allowed = await (service as any).teamRelayAllowsFollowUp(
      {
        id: "thread-team-1",
        workspaceId: "ws-1",
        type: "team",
        maxAgentTurns: null,
      },
      message,
    );

    expect(allowed).toBe(false);
    expect(threadSessionService.updateRelayControls).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-1" }),
      expect.objectContaining({
        runState: "paused",
        pauseReason: "reply_limit",
        replyLimit: 50,
      }),
    );
    expect(messageRepo.update).toHaveBeenCalledWith(
      "message-agent-6",
      expect.objectContaining({
        metadata: expect.objectContaining({
          teamRelayRoutingState: "pending",
          teamRelayPauseReason: "reply_limit",
        }),
      }),
    );
  });

  it("raises an exhausted relay limit and resumes the pending baton", async () => {
    const { service, threadRepo, messageRepo, threadSessionService } =
      await buildService();
    threadRepo.findOne.mockReset();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-team-1",
      workspaceId: "ws-1",
      type: "team",
      maxAgentTurns: null,
      activeSessionId: "session-1",
    });
    threadSessionService.ensureActiveSession.mockResolvedValue({
      id: "session-1",
      relayRunState: "paused",
      relayPauseReason: "reply_limit",
      relayReplyLimit: 50,
    });
    threadSessionService.countAgentReplies.mockResolvedValue(50);
    messageRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    const result = await service.continueTeamRelay("thread-team-1", "user-1");

    expect(threadSessionService.updateRelayControls).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-1" }),
      expect.objectContaining({
        runState: "running",
        pauseReason: null,
        replyLimit: 100,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ runState: "running", replyLimit: 100 }),
    );
  });

  it("blocks user A from reading reactions on user B message by guessed id", async () => {
    const {
      service,
      messageRepo,
      threadRepo,
      reactionRepo,
      workspaceMembershipService,
    } = await buildService();
    messageRepo.findOne.mockResolvedValue({
      id: "message-b",
      threadId: "thread-b",
    });
    threadRepo.findOne.mockReset();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-b",
      workspaceId: "ws-b",
    });
    workspaceMembershipService.ensureWorkspaceAccess.mockRejectedValue(
      new ForbiddenException("You do not have access to this workspace"),
    );

    await expect(service.getReactions("message-b", "user-a")).rejects.toThrow(
      ForbiddenException,
    );
    expect(reactionRepo.find).not.toHaveBeenCalled();
  });

  it("blocks user A from adding a reaction to user B message by guessed id", async () => {
    const {
      service,
      messageRepo,
      threadRepo,
      reactionRepo,
      workspaceMembershipService,
    } = await buildService();
    messageRepo.findOne.mockResolvedValue({
      id: "message-b",
      threadId: "thread-b",
    });
    threadRepo.findOne.mockReset();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-b",
      workspaceId: "ws-b",
    });
    workspaceMembershipService.ensureWorkspaceAccess.mockRejectedValue(
      new ForbiddenException("You do not have access to this workspace"),
    );

    await expect(
      service.addReaction("message-b", "+1", {
        user: { id: "user-a", name: "Alex" } as any,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(reactionRepo.save).not.toHaveBeenCalled();
  });

  it("blocks user A from removing a reaction from user B message by guessed id", async () => {
    const {
      service,
      messageRepo,
      threadRepo,
      reactionRepo,
      workspaceMembershipService,
      eventsGateway,
    } = await buildService();
    messageRepo.findOne.mockResolvedValue({
      id: "message-b",
      threadId: "thread-b",
    });
    threadRepo.findOne.mockReset();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-b",
      workspaceId: "ws-b",
    });
    workspaceMembershipService.ensureWorkspaceAccess.mockRejectedValue(
      new ForbiddenException("You do not have access to this workspace"),
    );

    await expect(
      service.removeReaction("message-b", "+1", "user:user-a", "user-a"),
    ).rejects.toThrow(ForbiddenException);
    expect(reactionRepo.delete).not.toHaveBeenCalled();
    expect(eventsGateway.emitToThread).not.toHaveBeenCalled();
  });

  it("persists provenance and dispatches only to explicit thread members", async () => {
    const { service, messageRepo, eventsGateway } = await buildService();

    await service.create("thread-1", {
      content: "Hello team",
      senderId: "user-1",
      senderName: "Alex",
      isFromUser: true,
      provenance: MessageProvenance.SCHEDULED_INJECTION,
      metadata: { scheduledMessageId: "sched-1" },
    });

    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        threadSessionId: "session-1",
        provenance: MessageProvenance.SCHEDULED_INJECTION,
        metadata: { scheduledMessageId: "sched-1" },
      }),
    );
    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["main"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-1",
        content: "Hello team",
        threadType: "direct",
        chatType: "direct",
        isTeamThread: false,
        isGroupChat: false,
        agentsCanReplyToEachOther: false,
        threadClassification: "direct_chat",
        threadInstruction: "This is a direct chat.",
        threadTitle: "Thread",
        threadAgentCount: 1,
        participantCount: 2,
        threadParticipantAgentIds: ["agent-1"],
        threadParticipants: [
          {
            agentId: "agent-1",
            externalAgentId: "main",
            name: "Atlas",
          },
        ],
      }),
    );
  });

  it("starts a normal conversation immediately in ask-for-approval mode", async () => {
    const { service, eventsGateway } = await buildService();

    await service.create("thread-1", {
      content: "What skills do you have?",
      senderId: "user-1",
      senderName: "Alex",
      isFromUser: true,
      provenance: MessageProvenance.USER,
      metadata: {
        runtimeApprovalMode: "ask_for_approval",
        runtimeDispatchConfirmed: false,
      },
    });

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["main"],
      "agent.dispatch",
      expect.objectContaining({
        content: "What skills do you have?",
        runtimeApprovalMode: "ask_for_approval",
      }),
    );
  });

  it("can return a persisted user message before background agent routing settles", async () => {
    const { service, messageRepo, threadMembershipService } =
      await buildService();
    threadMembershipService.listMemberAgents.mockRejectedValueOnce(
      new Error("runtime routing unavailable"),
    );

    const saved = await service.create(
      "thread-1",
      {
        content: "Send this even if routing is slow.",
        senderId: "user-1",
        senderName: "Alex",
        isFromUser: true,
        provenance: MessageProvenance.USER,
      },
      "user-1",
      { routeToAgentsAsync: true },
    );

    expect(saved.id).toBe("message-1");
    expect(messageRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Send this even if routing is slow.",
      }),
    );
  });

  it("accepts signed OpenClaw attachments and strips client-only provenance before persistence", async () => {
    const { service, messageRepo, threadMembershipService } =
      await buildService();
    threadMembershipService.listMemberAgents.mockResolvedValueOnce([]);
    const attachment = makeSignedOpenClawAttachment({
      extraClientField: "do-not-store",
    });

    await service.create(
      "thread-1",
      {
        content: "Please inspect this attachment.",
        senderId: "user-1",
        senderName: "Alex",
        isFromUser: true,
        provenance: MessageProvenance.USER,
        attachments: [attachment],
      },
      "user-1",
    );

    const createdMessage = messageRepo.create.mock.calls[0][0];
    expect(createdMessage.attachments).toEqual([
      expect.objectContaining({
        id: "attachment-1",
        workspaceId: "ws-1",
        threadId: "thread-1",
        bridgeDeviceId: "device-1",
        localMediaRef: "openclaw://device-1/attachment-1",
        status: "attached",
        storage: "openclaw_local",
      }),
    ]);
    expect(createdMessage.attachments[0]).not.toHaveProperty("provenanceToken");
    expect(createdMessage.attachments[0]).not.toHaveProperty(
      "extraClientField",
    );
  });

  it("surfaces attached image references in runtime text and metadata", async () => {
    const { service, eventsGateway, messageRepo } = await buildService();
    const attachment = makeSignedOpenClawAttachment({
      filename: "screenshot.png",
      mimeType: "image/png",
      kind: "image",
    });
    messageRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          senderName: "Alex",
          senderId: "user-1",
          content: "Earlier image",
          contentFormat: "markdown",
          createdAt: new Date("2026-07-30T14:00:00.000Z"),
          isFromUser: true,
          provenance: MessageProvenance.USER,
          attachments: [
            {
              filename: "earlier.png",
              mimeType: "image/png",
              status: "attached",
              localMediaRef: "openclaw://device-1/attachment-earlier",
            },
          ],
        },
      ]),
    });

    await service.create("thread-1", {
      content: "Can you see and read this image?",
      senderId: "user-1",
      senderName: "Alex",
      isFromUser: true,
      provenance: MessageProvenance.USER,
      attachments: [attachment],
    });

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["main"],
      "agent.dispatch",
      expect.objectContaining({
        content: expect.stringContaining(
          "localMediaRef: openclaw://device-1/attachment-1",
        ),
        runtimeInputContent: expect.stringContaining(
          "screenshot.png (image/png)",
        ),
        attachments: [
          expect.objectContaining({
            filename: "screenshot.png",
            mimeType: "image/png",
            status: "attached",
          }),
        ],
        recentMessages: [
          expect.objectContaining({
            content: expect.stringContaining(
              "localMediaRef: openclaw://device-1/attachment-earlier",
            ),
            attachments: [expect.objectContaining({ filename: "earlier.png" })],
          }),
        ],
      }),
    );
  });

  it("rejects forged OpenClaw attachment local refs and device metadata", async () => {
    const { service, messageRepo } = await buildService();
    const signedAttachment = makeSignedOpenClawAttachment();

    await expect(
      service.create(
        "thread-1",
        {
          content: "forged attachment",
          senderId: "user-1",
          senderName: "Alex",
          isFromUser: true,
          provenance: MessageProvenance.USER,
          attachments: [
            {
              ...signedAttachment,
              bridgeDeviceId: "device-2",
              localMediaRef: "openclaw://device-2/attachment-1",
            },
          ],
        },
        "user-1",
      ),
    ).rejects.toThrow("Attachment provenance could not be verified");
    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it("rejects signed attachments from a different thread", async () => {
    const { service, messageRepo } = await buildService();
    const attachment = makeSignedOpenClawAttachment({ threadId: "thread-2" });

    await expect(
      service.create(
        "thread-1",
        {
          content: "wrong thread",
          senderId: "user-1",
          senderName: "Alex",
          isFromUser: true,
          provenance: MessageProvenance.USER,
          attachments: [attachment],
        },
        "user-1",
      ),
    ).rejects.toThrow("Attachment does not belong to this thread");
    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it("rejects signed attachments from a different workspace", async () => {
    const { service, messageRepo } = await buildService();
    const attachment = makeSignedOpenClawAttachment({ workspaceId: "ws-2" });

    await expect(
      service.create(
        "thread-1",
        {
          content: "wrong workspace",
          senderId: "user-1",
          senderName: "Alex",
          isFromUser: true,
          provenance: MessageProvenance.USER,
          attachments: [attachment],
        },
        "user-1",
      ),
    ).rejects.toThrow("Attachment does not belong to this workspace");
    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it("routes a direct user message to the sole runtime agent even when the binding is explicit-only", async () => {
    const { service, threadMembershipService, runtimeDispatchCoordinator } =
      await buildService();

    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "agent-1",
        name: "Hermes Worker",
        externalId: "hermes_worker",
        avatarUrl: null,
        responsePresentation: "standard",
      },
    ]);
    runtimeDispatchCoordinator.resolveEligibleBindings.mockResolvedValue([
      {
        id: "runtime-binding-1",
        workspaceId: "ws-1",
        agentId: "agent-1",
        runtimeType: "hermes",
        adapterKind: "hermes_bridge",
        routingMode: "explicit_only",
        isEnabled: true,
        capabilities: { bridgeBacked: true },
        configMetadata: {},
      },
    ]);
    runtimeDispatchCoordinator.resolveRuntimeThreadSession.mockResolvedValue({
      id: "runtime-thread-session-1",
      runtimeSessionId: "runtime-session-1",
    });
    runtimeDispatchCoordinator.queueDispatch.mockResolvedValue({
      id: "runtime-dispatch-1",
      workspaceId: "ws-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      messageId: "message-1",
      agentId: "agent-1",
      runtimeBindingId: "runtime-binding-1",
      runtimeThreadSessionId: "runtime-thread-session-1",
      correlationId: null,
    });

    await service.create("thread-1", {
      content: "Can you respond?",
      senderId: "user-1",
      senderName: "Alex",
      isFromUser: true,
      provenance: MessageProvenance.USER,
    });

    expect(runtimeDispatchCoordinator.queueDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        threadId: "thread-1",
        threadSessionId: "session-1",
        messageId: "message-1",
        agentId: "agent-1",
      }),
    );
    expect(runtimeDispatchCoordinator.executeDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        inputText: expect.stringContaining("Can you respond?"),
        dispatch: expect.objectContaining({ id: "runtime-dispatch-1" }),
        agent: expect.objectContaining({ id: "agent-1" }),
      }),
    );
  });

  it("builds non-secret marketplace runtime context for installed local repo apps", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();
    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-1",
        workspaceId: "ws-1",
        appSlug: "local-gapminer",
        connectionId: "connection-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: ["read", "draft"],
        installStatus: "installed",
        metadata: {
          targetRoot: "skills/workflow-router",
          skillName: "workflow-router",
        },
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-1",
        appSlug: "local-gapminer",
        displayName: "GapMiner PC",
        environment: "default",
        authType: "local_repo",
        status: "ready",
        credentialNames: ["api_token"],
        selectedCapabilities: ["read", "draft"],
        metadata: {
          sourceHostType: "hermes_bridge",
          bridgeDeviceId: "pc-bridge",
          runtimeBindingId: "runtime-1",
          runtimeType: "hermes",
          localRepoPath: "/mnt/c/GapMiner",
          localAppUrl: "http://pc-host:3030",
          localApiUrl: "http://pc-host:8787",
          allowRuntimeHostStart: true,
          lifecycle: {
            checkCommandRef: "clawchat.config.json#commands.check",
            startCommandRef: "clawchat.config.json#commands.start",
            approvalPolicy: "approval_required_for_restart",
          },
        },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          slug: "local-gapminer",
          repoPath: "/mnt/c/GapMiner",
          metadata: { localAppUrl: "http://pc-host:3030" },
        },
      ]),
    });

    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
    );

    expect(context.marketplaceRuntimeContext.installedApplications[0]).toEqual(
      expect.objectContaining({
        appSlug: "local-gapminer",
        connectionLayer: expect.objectContaining({
          id: "connection-1",
          hasPrivateCredentials: true,
          metadata: expect.not.objectContaining({
            api_token: expect.anything(),
          }),
        }),
        localRuntimeLayer: expect.objectContaining({
          sourceHostType: "hermes_bridge",
          bridgeDeviceId: "pc-bridge",
          runtimeBindingId: "runtime-1",
          mayStartLocalApp: true,
          runtimeProfile: expect.objectContaining({
            repoPath: "/mnt/c/GapMiner",
            appUrl: "http://pc-host:3030",
            autoStartAllowed: true,
            sourceHostId: "pc-bridge",
          }),
          runtimeRecovery: expect.objectContaining({
            enabled: true,
            bridgeActions: expect.arrayContaining(["localApp.ensureRunning"]),
          }),
          lifecycle: expect.objectContaining({
            checkCommandRef: "clawchat.config.json#commands.check",
            startCommandRef: "clawchat.config.json#commands.start",
          }),
        }),
      }),
    );
  });

  it("exposes installed X connector tools to the selected agent runtime without token values", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-x-1",
        workspaceId: "ws-1",
        appSlug: "x",
        connectionId: "connection-x-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: ["read", "write"],
        installStatus: "installed",
        metadata: { targetRoot: "skills/x-router", skillName: "x-router" },
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-x-1",
        appSlug: "x",
        displayName: "X account",
        environment: "default",
        authType: "oauth2_pkce",
        status: "ready",
        credentialNames: ["x_oauth_tokens"],
        selectedCapabilities: ["read", "write"],
        metadata: {
          appSlug: "x",
          handle: "DangerDrawsO100",
          accessToken: "must-not-leak",
          refreshToken: "must-not-leak",
        },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ slug: "x", metadata: {} }]),
    });

    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
    );

    expect(context.marketplaceRuntimeContext.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "x.getMe",
          functionName: "x_get_me",
          action: "read",
          connectionId: "connection-x-1",
        }),
        expect.objectContaining({
          name: "x.getUserTweets",
          functionName: "x_get_user_tweets",
          action: "read",
        }),
        expect.objectContaining({
          name: "x.postTweet",
          functionName: "x_post_tweet",
          action: "write",
          approvalRequired: true,
        }),
      ]),
    );
    expect(JSON.stringify(context)).not.toContain("must-not-leak");
    expect(JSON.stringify(context)).toContain(
      "/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/x",
    );
  });

  it("exposes installed Jotform connector tools through the generic marketplace runtime path", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-jotform-1",
        workspaceId: "ws-1",
        appSlug: "jotform",
        connectionId: "connection-jotform-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: ["jotform_read", "jotform_manage"],
        installStatus: "installed",
        metadata: {
          targetRoot: "skills/jotform-router",
          skillName: "jotform-router",
        },
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-jotform-1",
        appSlug: "jotform",
        displayName: "Jotform",
        environment: "default",
        authType: "api_key",
        status: "ready",
        credentialNames: ["jotform_api_key"],
        selectedCapabilities: ["jotform_read", "jotform_manage"],
        metadata: {
          appSlug: "jotform",
          apiKey: "must-not-leak",
        },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([{ slug: "jotform", metadata: {} }]),
    });

    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
    );

    expect(context.marketplaceRuntimeContext.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "jotform.read",
          functionName: "jotform_read",
          action: "read",
          approvalRequired: false,
          connectionId: "connection-jotform-1",
        }),
        expect.objectContaining({
          name: "jotform.manage",
          functionName: "jotform_manage",
          action: "write",
          approvalRequired: true,
          connectionId: "connection-jotform-1",
        }),
      ]),
    );
    expect(JSON.stringify(context)).not.toContain("must-not-leak");
    expect(JSON.stringify(context)).toContain(
      "/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/jotform",
    );
  });

  it("keeps X write tools approval-gated under dangerous skip policy", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-x-1",
        workspaceId: "ws-1",
        appSlug: "x",
        connectionId: "connection-x-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: ["read", "write"],
        installStatus: "installed",
        metadata: { approvalProfileId: "dangerously_skip_permissions" },
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-x-1",
        appSlug: "x",
        displayName: "X account",
        environment: "default",
        authType: "oauth2_pkce",
        status: "ready",
        credentialNames: ["x_oauth_tokens"],
        selectedCapabilities: ["read", "write"],
        metadata: {
          tokenStatus: "valid",
          xHandle: "clawchat",
          grantedScopes: [
            "tweet.write",
            "users.read",
            "tweet.read",
            "offline.access",
          ],
        },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ slug: "x", metadata: {} }]),
    });

    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
    );

    for (const toolName of ["x.postTweet", "x.replyToTweet", "x.deleteTweet"]) {
      const tool = context.marketplaceRuntimeContext.tools.find(
        (item: Record<string, unknown>) => item.name === toolName,
      );
      expect(tool).toEqual(expect.objectContaining({ approvalRequired: true }));
      expect((tool.inputSchema as Record<string, unknown>).required).toContain(
        "approvalId",
      );
      expect(String(tool.description).toLowerCase()).not.toContain(
        "without per-action",
      );
    }
  });

  it("adds Hermes native harness tools to marketplace runtime context instead of browser-only availability", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-x-1",
        workspaceId: "ws-1",
        appSlug: "x",
        connectionId: "connection-x-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: ["read", "draft"],
        installStatus: "installed",
        metadata: { targetRoot: "skills/x-router", skillName: "x-router" },
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-x-1",
        appSlug: "x",
        displayName: "X account",
        environment: "default",
        authType: "oauth2_pkce",
        status: "ready",
        credentialNames: ["x_oauth_tokens"],
        selectedCapabilities: ["read", "write"],
        metadata: { tokenStatus: "valid", xHandle: "jungleskellam" },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ slug: "x", metadata: {} }]),
    });

    const nativeRuntimeTools = [
      "memory",
      "session_search",
      "read_file",
      "write_file",
      "patch",
      "terminal",
      "skills_list",
      "skill_view",
      "skill_manage",
      "workspace",
      "cwd",
      "browser_navigate",
    ];
    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
      "dispatch-1",
      nativeRuntimeTools,
    );

    expect(context.marketplaceRuntimeContext.nativeRuntimeTools).toEqual(
      expect.arrayContaining(nativeRuntimeTools),
    );
    expect(context.marketplaceRuntimeContext.availableRuntimeTools).toEqual(
      expect.arrayContaining(nativeRuntimeTools),
    );
    expect(
      context.marketplaceRuntimeContext.installedApplications[0]
        .toolAvailability.nativeRuntimeToolNames,
    ).toEqual(expect.arrayContaining(nativeRuntimeTools));
  });

  it("keeps Social Hermes X posting policy approval-required when approval-gated X tools are exposed", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-x-1",
        workspaceId: "ws-1",
        appSlug: "x",
        connectionId: "connection-x-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: ["read", "draft"],
        installStatus: "installed",
        metadata: { approvalProfileId: "x_safe_operator" },
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-x-1",
        appSlug: "x",
        displayName: "X account",
        environment: "default",
        authType: "oauth2_pkce",
        status: "ready",
        credentialNames: ["x_oauth_tokens"],
        selectedCapabilities: ["read", "draft"],
        metadata: {
          tokenStatus: "valid",
          xHandle: "jungleskellam",
          grantedScopes: [
            "tweet.write",
            "users.read",
            "tweet.read",
            "offline.access",
          ],
        },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ slug: "x", metadata: {} }]),
    });

    const nativeRuntimeTools = [
      "memory",
      "session_search",
      "read_file",
      "write_file",
      "patch",
      "terminal",
      "skills_list",
      "skill_view",
      "skill_manage",
      "workspace",
      "cwd",
    ];
    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
      "dispatch-social",
      nativeRuntimeTools,
    );

    expect(context.marketplaceRuntimeContext.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "x.requestPostApproval" }),
        expect.objectContaining({
          name: "x.postTweet",
          approvalRequired: true,
          platformCapability: "external_publish",
        }),
      ]),
    );
    expect(
      context.marketplaceRuntimeContext.installedApplications[0]
        .selectedCapabilities,
    ).toEqual(
      expect.arrayContaining(["read", "draft", "write", "external_publish"]),
    );
    expect(context.autonomyPolicy.external.externalPublishing).toBe(
      "approval_required",
    );
    expect(context.toolPolicyMatrix.external_publish).toEqual({
      policy: "approval_required",
      tool: "available",
    });
    expect(context.runtimeInstruction).toContain(
      "- externalPublishing: approval_required",
    );
    expect(context.runtimeInstruction).not.toContain(
      "- externalPublishing: disabled",
    );
    expect(context.marketplaceRuntimeContext.nativeRuntimeTools).toEqual(
      expect.arrayContaining(nativeRuntimeTools),
    );
  });

  it("does not expose X side-effect tools for read-only X installs", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-x-readonly",
        workspaceId: "ws-1",
        appSlug: "x",
        connectionId: "connection-x-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: ["read"],
        installStatus: "installed",
        metadata: { approvalProfileId: "x_read_only" },
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-x-1",
        appSlug: "x",
        displayName: "X account",
        environment: "default",
        authType: "oauth2_pkce",
        status: "ready",
        credentialNames: ["x_oauth_tokens"],
        selectedCapabilities: ["read"],
        metadata: {
          tokenStatus: "valid",
          xHandle: "jungleskellam",
          grantedScopes: [
            "tweet.write",
            "users.read",
            "tweet.read",
            "offline.access",
          ],
        },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ slug: "x", metadata: {} }]),
    });

    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
    );
    const toolNames = context.marketplaceRuntimeContext.toolNames;

    expect(toolNames).toEqual(expect.arrayContaining(["x.getMe"]));
    expect(toolNames).not.toContain("x.requestPostApproval");
    expect(toolNames).not.toContain("x.postTweet");
    expect(context.autonomyPolicy.external.externalPublishing).toBe("disabled");
  });

  it("exposes only the bounded Outlook read contract", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-outlook-1",
        workspaceId: "ws-1",
        appSlug: "outlook",
        connectionId: "connection-outlook-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: [
          "mail_folders_list",
          "inbox_messages_list",
          "unread_messages_list",
          "message_get",
        ],
        installStatus: "installed",
        metadata: {},
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-outlook-1",
        appSlug: "outlook",
        displayName: "Outlook",
        environment: "default",
        authType: "oauth2_pkce",
        status: "ready",
        credentialNames: ["outlook_oauth_tokens"],
        selectedCapabilities: [
          "mail_folders_list",
          "inbox_messages_list",
          "unread_messages_list",
          "message_get",
        ],
        metadata: {
          grantedScopes: [
            "openid",
            "profile",
            "email",
            "offline_access",
            "Mail.Read",
          ],
        },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ slug: "outlook", metadata: {} }]),
    });

    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
    );

    expect(context.marketplaceRuntimeContext.toolNames).toEqual([
      "outlook.listMailFolders",
      "outlook.listInboxMessages",
      "outlook.listUnreadMessages",
      "outlook.getMessage",
    ]);
    expect(
      context.marketplaceRuntimeContext.tools.every(
        (tool: Record<string, unknown>) => tool.approvalRequired === false,
      ),
    ).toBe(true);
    expect(context.marketplaceRuntimeContext.toolNames).not.toContain(
      "outlook.sendApprovedEmail",
    );
  });

  it("does not expose unselected Outlook reads in dangerous mode", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-outlook-1",
        workspaceId: "ws-1",
        appSlug: "outlook",
        connectionId: "connection-outlook-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: ["mail_folders_list", "inbox_messages_list"],
        installStatus: "installed",
        metadata: { approvalProfileId: "dangerously_skip_permissions" },
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-outlook-1",
        appSlug: "outlook",
        displayName: "Outlook",
        environment: "default",
        authType: "oauth2_pkce",
        status: "ready",
        credentialNames: ["outlook_oauth_tokens"],
        selectedCapabilities: ["mail_folders_list", "inbox_messages_list"],
        metadata: {
          grantedScopes: [
            "openid",
            "profile",
            "email",
            "offline_access",
            "Mail.Read",
          ],
        },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ slug: "outlook", metadata: {} }]),
    });

    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
    );

    expect(context.marketplaceRuntimeContext.toolNames).toEqual(
      expect.arrayContaining([
        "outlook.listMailFolders",
        "outlook.listInboxMessages",
      ]),
    );
    expect(context.marketplaceRuntimeContext.toolNames).not.toContain(
      "outlook.listUnreadMessages",
    );
    expect(context.marketplaceRuntimeContext.toolNames).not.toContain(
      "outlook.getMessage",
    );
    expect(context.marketplaceRuntimeContext.toolNames).not.toContain(
      "outlook.sendApprovedEmail",
    );
  });

  it("keeps Outlook read tools approval-free in dangerous mode without exposing writes", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-outlook-1",
        workspaceId: "ws-1",
        appSlug: "outlook",
        connectionId: "connection-outlook-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: [
          "mail_folders_list",
          "inbox_messages_list",
          "unread_messages_list",
          "message_get",
        ],
        installStatus: "installed",
        metadata: { approvalProfileId: "dangerously_skip_permissions" },
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-outlook-1",
        appSlug: "outlook",
        displayName: "Outlook",
        environment: "default",
        authType: "oauth2_pkce",
        status: "ready",
        credentialNames: ["outlook_oauth_tokens"],
        selectedCapabilities: [
          "mail_folders_list",
          "inbox_messages_list",
          "unread_messages_list",
          "message_get",
        ],
        metadata: {
          grantedScopes: [
            "openid",
            "profile",
            "email",
            "offline_access",
            "Mail.Read",
          ],
        },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ slug: "outlook", metadata: {} }]),
    });

    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
    );
    const tools = context.marketplaceRuntimeContext.tools;

    for (const toolName of [
      "outlook.listMailFolders",
      "outlook.listInboxMessages",
      "outlook.listUnreadMessages",
      "outlook.getMessage",
    ]) {
      const tool = tools.find(
        (item: Record<string, unknown>) => item.name === toolName,
      );
      expect(tool).toEqual(
        expect.objectContaining({ approvalRequired: false }),
      );
      expect(
        Array.isArray((tool.inputSchema as Record<string, unknown>).required)
          ? (tool.inputSchema as Record<string, unknown>).required
          : [],
      ).not.toContain("approvalId");
    }
    expect(tools.map((tool: Record<string, unknown>) => tool.name)).not.toEqual(
      expect.arrayContaining([
        "outlook.sendApprovedEmail",
        "outlook.reply",
        "outlook.forward",
      ]),
    );
  });

  it("exposes executable LinkCrest Agent API proxy tools without bearer values", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-linkcrest-1",
        workspaceId: "ws-1",
        appSlug: "local-linkcrest",
        connectionId: "connection-linkcrest-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: ["read", "draft", "write_internal", "email_send"],
        installStatus: "installed",
        metadata: {
          targetRoot: "skills/linkcrest-router",
          skillName: "linkcrest-router",
        },
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-linkcrest-1",
        appSlug: "local-linkcrest",
        displayName: "LinkCrest local",
        environment: "default",
        authType: "local_repo",
        status: "ready",
        credentialNames: [],
        selectedCapabilities: ["read", "draft", "write_internal", "email_send"],
        metadata: {
          localApiUrl: "http://localhost:3052/api",
        },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          slug: "local-linkcrest",
          name: "LinkCrest",
          repoPath: "/mnt/c/LinkCrest",
          metadata: {
            linkcrestOpenClawBaseUrl: "http://localhost:3052",
            linkcrestOpenClawConnectionId: "openclaw-connection-1",
            linkcrestOpenClawStatus: { hasBearerKey: true, useMockMode: false },
            linkcrestCampaignId: "campaign-1",
            linkcrestCampaignName: "AI YouTube Channels Backlink Campaign",
          },
        },
      ]),
    });

    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
    );

    expect(context.marketplaceRuntimeContext.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "linkcrest.agentApi",
          functionName: "linkcrest_agent_api",
          aliases: expect.arrayContaining([
            "linkcrest.agentApi",
            "linkcrest_agent_api",
            "linkcrest-agent-api",
            "agentApi",
          ]),
          execution: expect.objectContaining({
            transport: "clawchat_bridge_marketplace_tool",
            credentialAttachment: "server_side_bearer_proxy",
          }),
          credential: expect.objectContaining({
            bearerConfigured: true,
            secretMaterialSentToHermes: false,
          }),
          runtimeProfile: expect.objectContaining({
            repoPath: "/home/alexkerss/repos/LinkCrest",
            appUrl: "http://localhost:3052",
            agentApiUrl: "http://localhost:3052/api/openclaw",
            startCommand: "pnpm dev",
            backendHealthCheckUrl: "http://localhost:3210",
            autoStartAllowed: true,
            expectedPorts: expect.arrayContaining([3052, 3210]),
          }),
          runtimeRecovery: expect.objectContaining({
            enabled: true,
            bridgeActions: expect.arrayContaining(["localApp.ensureRunning"]),
          }),
        }),
      ]),
    );
    expect(context.marketplaceRuntimeContext.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "linkcrest_agent_api" }),
        expect.objectContaining({ name: "linkcrest-agent-api" }),
        expect.objectContaining({ name: "agentApi" }),
      ]),
    );
    expect(JSON.stringify(context)).toContain(
      "/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/local-linkcrest",
    );
    expect(JSON.stringify(context)).toContain(
      "/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/linkcrest-agent-api/local-linkcrest/_runtime-secret/fetch",
    );
    expect(JSON.stringify(context)).not.toContain("Bearer ");
    expect(JSON.stringify(context)).not.toContain("must-not-leak");
  });

  it("does not expose X connector tools when the installed connection is disconnected", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-x-1",
        workspaceId: "ws-1",
        appSlug: "x",
        connectionId: "connection-x-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: ["read", "write"],
        installStatus: "installed",
        metadata: { targetRoot: "skills/x-router", skillName: "x-router" },
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-x-1",
        appSlug: "x",
        displayName: "X account",
        environment: "default",
        authType: "oauth2_pkce",
        status: "needs_credentials",
        credentialNames: ["X_CLIENT_ID"],
        selectedCapabilities: ["read", "write"],
        metadata: { tokenStatus: "disconnected" },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ slug: "x", metadata: {} }]),
    });

    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
    );

    expect(context.marketplaceRuntimeContext.tools).toEqual([]);
    expect(
      context.marketplaceRuntimeContext.installedApplications[0].connectionLayer
        .status,
    ).toBe("needs_credentials");
  });

  it("exposes X connector tools when OAuth metadata says the token is valid", async () => {
    const {
      service,
      marketplaceInstallRepo,
      marketplaceConnectionRepo,
      linkedApplicationRepo,
    } = await buildService();

    marketplaceInstallRepo.find.mockResolvedValue([
      {
        id: "install-x-1",
        workspaceId: "ws-1",
        appSlug: "x",
        connectionId: "connection-x-1",
        agentId: "agent-1",
        role: "worker",
        selectedCapabilities: ["read"],
        installStatus: "installed",
        metadata: {},
      },
    ]);
    marketplaceConnectionRepo.findByIds.mockResolvedValue([
      {
        id: "connection-x-1",
        appSlug: "x",
        displayName: "X account",
        environment: "default",
        authType: "oauth2_pkce",
        status: "unverified",
        credentialNames: ["x_oauth_tokens"],
        selectedCapabilities: ["read"],
        metadata: { tokenStatus: "valid", xHandle: "jungleskellam" },
      },
    ]);
    linkedApplicationRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ slug: "x", metadata: {} }]),
    });

    const context = await (service as any).buildAgentMarketplaceRuntimeContext(
      "ws-1",
      "agent-1",
    );

    expect(context.marketplaceRuntimeContext.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ functionName: "x_get_me" }),
        expect.objectContaining({ functionName: "x_get_user_tweets" }),
      ]),
    );
  });

  it("bounds Hermes runtime recent messages and uses a smaller default for trivial turns", async () => {
    const { service } = await buildService();
    const recentMessages = Array.from({ length: 20 }, (_, index) => ({
      content: `message-${index}`,
    }));
    const runtimeBinding = {
      runtimeType: "hermes",
      configMetadata: {},
    };

    expect(
      (service as any).boundRuntimeRecentMessages(
        recentMessages,
        { content: "hello", attachments: [] },
        runtimeBinding,
      ),
    ).toEqual(recentMessages.slice(-6));
    expect(
      (service as any).boundRuntimeRecentMessages(
        recentMessages,
        {
          content:
            "Please do a more involved task with enough instructions to require normal context.",
          attachments: [],
        },
        runtimeBinding,
      ),
    ).toEqual(recentMessages.slice(-8));
    expect(
      (service as any).boundRuntimeRecentMessages(
        recentMessages,
        { content: "hello", attachments: [] },
        {
          ...runtimeBinding,
          configMetadata: { recentMessagesLimit: 2 },
        },
      ),
    ).toEqual(recentMessages.slice(-2));
  });

  it("does not send recent messages to Hermes bridge runtimes unless explicitly enabled", async () => {
    const { service } = await buildService();
    const recentMessages = Array.from({ length: 20 }, (_, index) => ({
      content: `message-${index}`,
    }));
    const hermesBridgeBinding = {
      runtimeType: "hermes",
      adapterKind: "hermes_bridge",
      capabilities: { bridgeBacked: true },
      configMetadata: {},
    };

    expect(
      (service as any).boundRuntimeRecentMessages(
        recentMessages,
        { content: "hello", attachments: [] },
        hermesBridgeBinding,
      ),
    ).toEqual([]);
    expect(
      (service as any).boundRuntimeRecentMessages(
        recentMessages,
        { content: "hello", attachments: [] },
        {
          ...hermesBridgeBinding,
          configMetadata: { sendRecentMessagesToHermesBridge: true },
        },
      ),
    ).toEqual(recentMessages.slice(-6));
  });

  it("truncates oversized Hermes recent message content within the configured budget", async () => {
    const { service } = await buildService();
    const recentMessages = [
      { content: "older-" + "x".repeat(100) },
      { content: "middle-" + "y".repeat(100) },
      { content: "newest" },
    ];

    const bounded = (service as any).boundRuntimeRecentMessages(
      recentMessages,
      { content: "hello", attachments: [] },
      {
        runtimeType: "hermes",
        configMetadata: {
          recentMessagesLimit: 3,
          recentMessagesCharBudget: 20,
        },
      },
    );

    expect(bounded).toHaveLength(3);
    expect(bounded[2].content).toBe("newest");
    expect(bounded[1].content).toContain("truncated");
    expect(bounded[0].content).toContain("omitted");
    expect(
      bounded.reduce(
        (total: number, message: Record<string, unknown>) =>
          total + String(message.content ?? "").length,
        0,
      ),
    ).toBeLessThan(
      recentMessages.reduce(
        (total, message) => total + message.content.length,
        0,
      ),
    );
  });

  it("blocks non-participants when the meeting snapshot forbids outside messaging", async () => {
    const { service, meetingRepo, snapshotRepo } = await buildService();

    meetingRepo.findOne.mockResolvedValue({
      id: "meeting-1",
      threadId: "thread-1",
      status: MeetingStatus.ACTIVE,
      briefMarkdown: "Agenda",
      appliedRulePackSnapshotId: "snapshot-1",
      participantsSnapshot: [{ participantId: "user-1" }],
    });
    snapshotRepo.findOne.mockResolvedValue({
      id: "snapshot-1",
      advisoryRulesMarkdown: "Stay on topic",
      hardRestrictions: [MeetingHardRestriction.NO_MESSAGE_NON_PARTICIPANTS],
    });

    await expect(
      service.create("thread-1", {
        content: "Let me join late",
        senderId: "outsider-1",
        senderName: "Outsider",
        isFromUser: true,
        provenance: MessageProvenance.USER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("routes team agent mentions to the explicitly mentioned peer agent", async () => {
    const { service, threadRepo, threadMembershipService, eventsGateway } =
      await buildService();

    threadRepo.findOne.mockReset();
    threadRepo.findOne
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Target & Execute",
        type: "team",
        avatarUrl: null,
        participantIds: ["user-1"],
        agentIds: ["agent-1", "agent-2"],
        isPinned: false,
        isMuted: false,
        status: "active",
        teamId: null,
        departmentId: null,
        lastMessage: null,
        maxAgentTurns: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Target & Execute",
        type: "team",
      });

    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "agent-1",
        name: "Execution Optimizer",
        externalId: "execution_optimizer",
      },
      {
        id: "agent-2",
        name: "Claude / RankScope",
        externalId: "claude_rankscope",
      },
    ]);
    (eventsGateway.getWorkspaceBridgeRuntime as jest.Mock).mockReturnValue({
      connectedBridgeDeviceCount: 1,
      bridgeControlSubscriberCount: 1,
      structuredPromptBridgeControlSubscriberCount: 1,
      liveRegisteredAgentCount: 1,
      liveRegisteredExternalAgentIds: ["claude_rankscope"],
    });

    await service.injectMessage(
      "thread-team-1",
      {
        content: "@claude_rankscope can you check this now?",
        senderId: "agent-1",
        senderName: "Execution Optimizer",
        isFromUser: false,
        provenance: MessageProvenance.AGENT,
      },
      {},
    );

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["claude_rankscope"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-team-1",
        content: "@claude_rankscope can you check this now?",
        threadType: "team",
        chatType: "team",
        isTeamThread: true,
        isGroupChat: true,
        agentsCanReplyToEachOther: true,
        threadClassification: "team_chat",
        threadInstruction:
          "This is a team chat. All listed agents are in the same shared thread and may reply to the user and to each other.",
        threadTitle: "Target & Execute",
        threadAgentCount: 2,
        participantCount: 3,
        threadParticipantAgentIds: ["agent-1", "agent-2"],
        threadParticipants: [
          {
            agentId: "agent-1",
            externalAgentId: "execution_optimizer",
            name: "Execution Optimizer",
          },
          {
            agentId: "agent-2",
            externalAgentId: "claude_rankscope",
            name: "Claude / RankScope",
          },
        ],
      }),
    );
    expect(eventsGateway.emitAgentTyping).toHaveBeenCalledWith(
      "thread-team-1",
      ["agent-2"],
      true,
    );
  });

  it("routes an unmentioned team user message to exactly one eligible agent", async () => {
    const {
      service,
      threadRepo,
      teamRepo,
      threadMembershipService,
      eventsGateway,
    } = await buildService();

    threadRepo.findOne.mockReset();
    threadRepo.findOne
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Target & Execute",
        type: "team",
        status: "active",
        teamId: "team-1",
        participantIds: ["user-1"],
        agentIds: ["execution-manager", "targeting-worker"],
        maxAgentTurns: null,
      })
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Target & Execute",
        type: "team",
        teamId: "team-1",
      });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      leadAgentId: "execution-manager",
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "execution-manager",
        name: "Execution Optimizer",
        externalId: "execution_optimizer",
      },
      {
        id: "targeting-worker",
        name: "Targeting & Maintenance",
        externalId: "targeting_maintenance",
      },
    ]);
    (eventsGateway.getWorkspaceBridgeRuntime as jest.Mock).mockReturnValue({
      connectedBridgeDeviceCount: 1,
      bridgeControlSubscriberCount: 1,
      structuredPromptBridgeControlSubscriberCount: 1,
      liveRegisteredAgentCount: 2,
      liveRegisteredExternalAgentIds: [
        "execution_optimizer",
        "targeting_maintenance",
      ],
    });

    const random = jest.spyOn(Math, "random").mockReturnValue(0);
    await service.create("thread-team-1", {
      content: "Please review the targeting backlog.",
      senderId: "user-1",
      senderName: "Alex",
      isFromUser: true,
      provenance: MessageProvenance.USER,
    });

    random.mockRestore();
    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["execution_optimizer"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-team-1",
        content: "Please review the targeting backlog.",
        threadInstruction:
          "This is a team chat. All listed agents are in the same shared thread and may reply to the user and to each other.",
      }),
    );
    expect(eventsGateway.emitAgentTyping).toHaveBeenCalledWith(
      "thread-team-1",
      ["execution-manager"],
      true,
    );
  });

  it("routes an unmentioned visible discussion request to one team agent", async () => {
    const {
      service,
      threadRepo,
      teamRepo,
      threadMembershipService,
      eventsGateway,
    } = await buildService();

    threadRepo.findOne.mockReset();
    threadRepo.findOne
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Youtube Team",
        type: "team",
        status: "active",
        teamId: "team-1",
        participantIds: ["user-1"],
        agentIds: ["oscar-manager", "story-worker"],
        maxAgentTurns: null,
      })
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Youtube Team",
        type: "team",
        teamId: "team-1",
      });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      leadAgentId: "oscar-manager",
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "oscar-manager",
        name: "Oscar Frame",
        externalId: "oscar_frame",
      },
      {
        id: "story-worker",
        name: "Story Wells",
        externalId: "story_wells",
      },
    ]);
    (eventsGateway.getWorkspaceBridgeRuntime as jest.Mock).mockReturnValue({
      connectedBridgeDeviceCount: 1,
      bridgeControlSubscriberCount: 1,
      structuredPromptBridgeControlSubscriberCount: 1,
      liveRegisteredAgentCount: 2,
      liveRegisteredExternalAgentIds: ["oscar_frame", "story_wells"],
    });

    const random = jest.spyOn(Math, "random").mockReturnValue(0);
    await service.create("thread-team-1", {
      content:
        "I want a back-and-forth discussion. Story Wells has ideas here, and Oscar, you take the lead.",
      senderId: "user-1",
      senderName: "Alex",
      isFromUser: true,
      provenance: MessageProvenance.USER,
    });

    random.mockRestore();
    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["oscar_frame"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-team-1",
        content:
          "I want a back-and-forth discussion. Story Wells has ideas here, and Oscar, you take the lead.",
      }),
    );
    expect(eventsGateway.emitAgentTyping).toHaveBeenCalledWith(
      "thread-team-1",
      ["oscar-manager"],
      true,
    );
  });

  it("routes the manager's first visible discussion turn to naturally named workers", async () => {
    const {
      service,
      threadRepo,
      teamRepo,
      messageRepo,
      threadMembershipService,
      eventsGateway,
    } = await buildService();

    threadRepo.findOne.mockReset();
    threadRepo.findOne
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Youtube Team",
        type: "team",
        status: "active",
        teamId: "team-1",
        participantIds: ["user-1"],
        agentIds: ["oscar-manager", "story-worker"],
        maxAgentTurns: null,
      })
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Youtube Team",
        type: "team",
        teamId: "team-1",
      });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      leadAgentId: "oscar-manager",
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "oscar-manager",
        name: "Oscar Frame",
        externalId: "oscar_frame",
      },
      {
        id: "story-worker",
        name: "Story Wells",
        externalId: "story_wells",
      },
    ]);
    messageRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: "user-message-1",
          senderId: "user-1",
          senderName: "Alex",
          content:
            "I want a back-and-forth discussion. Story Wells has ideas here, and Oscar, you take the lead.",
          isFromUser: true,
          provenance: MessageProvenance.USER,
          createdAt: new Date(),
        },
      ]),
    });
    (eventsGateway.getWorkspaceBridgeRuntime as jest.Mock).mockReturnValue({
      connectedBridgeDeviceCount: 1,
      bridgeControlSubscriberCount: 1,
      structuredPromptBridgeControlSubscriberCount: 1,
      liveRegisteredAgentCount: 2,
      liveRegisteredExternalAgentIds: ["oscar_frame", "story_wells"],
    });

    await service.injectMessage(
      "thread-team-1",
      {
        content: "I'll inspect the existing docs and bring Story in.",
        senderId: "oscar-manager",
        senderName: "Oscar Frame",
        isFromUser: false,
        provenance: MessageProvenance.AGENT,
      },
      { routeToAgents: true },
    );

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["story_wells"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-team-1",
        content: "I'll inspect the existing docs and bring Story in.",
      }),
    );
    expect(eventsGateway.emitAgentTyping).toHaveBeenCalledWith(
      "thread-team-1",
      ["story-worker"],
      true,
    );
  });

  it("keeps a user mention visible while dispatching only to that team agent", async () => {
    const {
      service,
      threadRepo,
      teamRepo,
      threadMembershipService,
      eventsGateway,
    } = await buildService();

    threadRepo.findOne.mockReset();
    threadRepo.findOne
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Target & Execute",
        type: "team",
        status: "active",
        teamId: "team-1",
        participantIds: ["user-1"],
        agentIds: ["execution-manager", "targeting-worker"],
        maxAgentTurns: null,
      })
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Target & Execute",
        type: "team",
        teamId: "team-1",
      });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      leadAgentId: "execution-manager",
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "execution-manager",
        name: "Execution Optimizer",
        externalId: "execution_optimizer",
      },
      {
        id: "targeting-worker",
        name: "Targeting & Maintenance",
        externalId: "targeting_maintenance",
      },
    ]);
    (eventsGateway.getWorkspaceBridgeRuntime as jest.Mock).mockReturnValue({
      connectedBridgeDeviceCount: 1,
      bridgeControlSubscriberCount: 1,
      structuredPromptBridgeControlSubscriberCount: 1,
      liveRegisteredAgentCount: 2,
      liveRegisteredExternalAgentIds: [
        "execution_optimizer",
        "targeting_maintenance",
      ],
    });

    await service.create("thread-team-1", {
      content: "@targeting_maintenance check this directly.",
      senderId: "user-1",
      senderName: "Alex",
      isFromUser: true,
      provenance: MessageProvenance.USER,
    });

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["targeting_maintenance"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-team-1",
        content: "@targeting_maintenance check this directly.",
      }),
    );
    expect(eventsGateway.emitAgentTyping).toHaveBeenCalledWith(
      "thread-team-1",
      ["targeting-worker"],
      true,
    );
  });

  it("routes manager mentions only to the mentioned worker", async () => {
    const {
      service,
      threadRepo,
      teamRepo,
      threadMembershipService,
      eventsGateway,
    } = await buildService();

    threadRepo.findOne.mockReset();
    threadRepo.findOne
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Target & Execute",
        type: "team",
        status: "active",
        teamId: "team-1",
        participantIds: ["user-1"],
        agentIds: ["execution-manager", "targeting-worker"],
        maxAgentTurns: null,
      })
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Target & Execute",
        type: "team",
        teamId: "team-1",
      });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      leadAgentId: "execution-manager",
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "execution-manager",
        name: "Execution Optimizer",
        externalId: "execution_optimizer",
      },
      {
        id: "targeting-worker",
        name: "Targeting & Maintenance",
        externalId: "targeting_maintenance",
      },
    ]);
    (eventsGateway.getWorkspaceBridgeRuntime as jest.Mock).mockReturnValue({
      connectedBridgeDeviceCount: 1,
      bridgeControlSubscriberCount: 1,
      structuredPromptBridgeControlSubscriberCount: 1,
      liveRegisteredAgentCount: 2,
      liveRegisteredExternalAgentIds: [
        "execution_optimizer",
        "targeting_maintenance",
      ],
    });

    await service.injectMessage("thread-team-1", {
      content: "@targeting_maintenance proceed with the targeting check.",
      senderId: "execution-manager",
      senderName: "Execution Optimizer",
      isFromUser: false,
      provenance: MessageProvenance.AGENT,
    });

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["targeting_maintenance"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-team-1",
        content: "@targeting_maintenance proceed with the targeting check.",
      }),
    );
    expect(eventsGateway.emitAgentTyping).toHaveBeenCalledWith(
      "thread-team-1",
      ["targeting-worker"],
      true,
    );
  });

  it("routes a worker reply only to the mentioned eligible peer", async () => {
    const {
      service,
      threadRepo,
      teamRepo,
      threadMembershipService,
      eventsGateway,
    } = await buildService();

    threadRepo.findOne.mockReset();
    threadRepo.findOne
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Target & Execute",
        type: "team",
        status: "active",
        teamId: "team-1",
        participantIds: ["user-1"],
        agentIds: ["execution-manager", "targeting-worker", "research-worker"],
        maxAgentTurns: null,
      })
      .mockResolvedValueOnce({
        id: "thread-team-1",
        workspaceId: "ws-1",
        title: "Target & Execute",
        type: "team",
        teamId: "team-1",
      });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      leadAgentId: "execution-manager",
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "execution-manager",
        name: "Execution Optimizer",
        externalId: "execution_optimizer",
      },
      {
        id: "targeting-worker",
        name: "Targeting & Maintenance",
        externalId: "targeting_maintenance",
      },
      {
        id: "research-worker",
        name: "Research Worker",
        externalId: "research_worker",
      },
    ]);
    (eventsGateway.getWorkspaceBridgeRuntime as jest.Mock).mockReturnValue({
      connectedBridgeDeviceCount: 1,
      bridgeControlSubscriberCount: 1,
      structuredPromptBridgeControlSubscriberCount: 1,
      liveRegisteredAgentCount: 3,
      liveRegisteredExternalAgentIds: [
        "execution_optimizer",
        "targeting_maintenance",
        "research_worker",
      ],
    });

    await service.injectMessage("thread-team-1", {
      content: "Done. @research_worker can you sanity-check this?",
      senderId: "targeting-worker",
      senderName: "Targeting & Maintenance",
      isFromUser: false,
      provenance: MessageProvenance.AGENT,
    });

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["research_worker"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-team-1",
        content: "Done. @research_worker can you sanity-check this?",
      }),
    );
    expect(eventsGateway.emitAgentTyping).toHaveBeenCalledWith(
      "thread-team-1",
      ["research-worker"],
      true,
    );
  });

  it("does not re-enqueue condensed summaries when team messages are loaded", async () => {
    const {
      service,
      threadRepo,
      messageRepo,
      messageCondensingService,
      threadSessionService,
    } = await buildService();

    threadRepo.findOne.mockReset();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-team-1",
      workspaceId: "ws-1",
      title: "Target & Execute",
      type: "team",
      status: "active",
    });
    threadSessionService.ensureActiveSession.mockResolvedValue({
      id: "session-1",
      threadId: "thread-team-1",
      sequenceNumber: 1,
      status: "active",
    });
    messageRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: "message-1",
            threadId: "thread-team-1",
            threadSessionId: "session-1",
            senderName: "Atlas",
            content: "Long agent reply",
            provenance: MessageProvenance.AGENT,
            isFromUser: false,
            createdAt: new Date("2026-04-22T12:00:00.000Z"),
          },
        ],
        1,
      ]),
    });

    await service.findAll("thread-team-1", {});

    expect(messageCondensingService.maybeEnqueueSummary).not.toHaveBeenCalled();
  });

  it("surfaces bridge-backed agent offline state instead of silently dropping the dispatch", async () => {
    const { service, eventsGateway, messageRepo } = await buildService();

    (eventsGateway.getWorkspaceBridgeRuntime as jest.Mock).mockReturnValue({
      connectedBridgeDeviceCount: 0,
      bridgeControlSubscriberCount: 0,
      structuredPromptBridgeControlSubscriberCount: 0,
      liveRegisteredAgentCount: 0,
      liveRegisteredExternalAgentIds: [],
    });

    await service.create("thread-1", {
      content: "Hello team",
      senderId: "user-1",
      senderName: "Alex",
      isFromUser: true,
      provenance: MessageProvenance.USER,
    });

    expect(eventsGateway.emitToBridgeAgents).not.toHaveBeenCalled();
    expect(eventsGateway.emitAgentTyping).not.toHaveBeenCalledWith(
      "thread-1",
      ["agent-1"],
      true,
    );
    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        senderName: "System",
        content: "Atlas is offline on the OpenClaw runtime.",
        type: "system",
      }),
    );
  });
});
