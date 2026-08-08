import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { createHash } from "crypto";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BridgeService } from "./bridge.service";
import {
  AgentEntity,
  AgentProvisioningJobEntity,
  ApprovalEntity,
  BridgeDeviceEntity,
  BridgeDeviceStatus,
  BridgeEnrollmentEntity,
  DepartmentEntity,
  MessageEntity,
  OpenClawConnectionEntity,
  RunEntity,
  RunEventEntity,
  TaskEntity,
  TeamEntity,
  ThreadEntity,
  WorkspaceEntity,
  WorkLogEntity,
} from "../../entities";
import { BridgeControlCoordinatorService } from "../../gateways/bridge-control-coordinator.service";
import { BridgeControlBusService } from "../../gateways/bridge-control-bus.service";
import { EventsGateway } from "../../gateways/events.gateway";
import { MessageService } from "../message/message.service";
import { ThreadMembershipService } from "../thread/thread-membership.service";
import { EncryptionService } from "../security/encryption.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { RuntimeBindingService } from "../runtime/runtime-binding.service";
import { RuntimeDispatchCoordinator } from "../runtime/runtime-dispatch-coordinator.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { BRIDGE_TOKEN_ISSUER } from "./bridge-token-policy";

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((input) => ({ ...input })),
    save: jest.fn().mockImplementation((input) => Promise.resolve(input)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    increment: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    }),
    ...overrides,
  };
}

function hashOpaqueSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function compatibleHermesMetadata(overrides: Record<string, unknown> = {}) {
  const overrideCapabilities = Array.isArray(overrides.capabilities)
    ? overrides.capabilities
    : [];
  return {
    runtimeType: "hermes",
    hostType: "macos-launchd",
    pluginVersion: "0.3.0-rc.2",
    openCoreVersion: "v2026.7.7.2",
    apiContractVersion: "v2",
    websocketContractVersion: "bridge.v1",
    ...overrides,
    capabilities: [
      "clawchat.bridge.rotating_credentials.v1",
      ...overrideCapabilities,
    ],
  };
}

function compatibleOpenClawMetadata(overrides: Record<string, unknown> = {}) {
  const overrideCapabilities = Array.isArray(overrides.capabilities)
    ? overrides.capabilities
    : [];
  return {
    runtimeType: "openclaw",
    hostType: "macos-launchd",
    pluginVersion: "2026.7.31-rc.1",
    openCoreVersion: "v2026.6.11",
    apiContractVersion: "v2",
    websocketContractVersion: "bridge.v1",
    ...overrides,
    capabilities: [
      "clawchat.bridge.rotating_credentials.v1",
      ...overrideCapabilities,
    ],
  };
}

function bridgeAccessClaims(overrides: Record<string, unknown> = {}) {
  return {
    sub: "device-1",
    did: "device-1",
    dpid: "bdev_public",
    workspaceId: "ws-1",
    kind: "bridge_device",
    role: "bridge_device",
    tokenUse: "bridge_access",
    aud: "relay-bridge-api",
    jti: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    cv: 1,
    ...overrides,
  };
}

async function buildService() {
  const connectionRepo = makeRepoMock();
  const bridgeDeviceRepo = makeRepoMock();
  const bridgeEnrollmentRepo = makeRepoMock();
  const provisioningJobRepo = makeRepoMock();
  const workspaceRepo = makeRepoMock();
  const agentRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue({
      id: "agent-main",
      name: "The Distressed Dad Bot",
      workspaceId: "ws-1",
      externalId: "main",
      description: "External ID: main",
    }),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: "agent-main",
        name: "The Distressed Dad Bot",
        description: "External ID: main",
      }),
    }),
  });
  const messageRepo = makeRepoMock();
  const taskRepo = makeRepoMock();
  const approvalRepo = makeRepoMock();
  const runRepo = makeRepoMock();
  const runEventRepo = makeRepoMock();
  const workLogRepo = makeRepoMock();
  const threadRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue({
      id: "thread-1",
      workspaceId: "ws-1",
      maxAgentTurns: null,
    }),
  });
  const teamRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(null),
  });
  const departmentRepo = makeRepoMock({
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
  });
  const eventsGateway = {
    emitAgentTyping: jest.fn(),
    emitToBridgeAgents: jest.fn(),
    disconnectBridgeDevice: jest.fn(),
    hasHermesBridgeWorkspaceCapability: jest.fn().mockReturnValue(false),
    hasBridgeControlSubscribers: jest.fn().mockReturnValue(false),
    emitToHermesBridgeWorkspace: jest.fn(),
    emitToBridgeControls: jest.fn(),
    isBridgeDeviceRegisteredForExternalAgent: jest.fn().mockReturnValue(true),
    getBridgeDeviceIdForExternalAgent: jest.fn().mockReturnValue(null),
    getWorkspaceBridgeRuntime: jest.fn().mockReturnValue({
      connectedBridgeDeviceCount: 0,
      bridgeControlSubscriberCount: 0,
      liveRegisteredAgentCount: 0,
      liveRegisteredExternalAgentIds: [],
    }),
    getConnectedBridgeDeviceIds: jest.fn().mockReturnValue(new Set()),
  };
  const messageService = {
    injectMessage: jest.fn().mockResolvedValue({
      id: "message-1",
      content: "reply",
      threadSessionId: "session-1",
    }),
    buildOutboundContext: jest.fn().mockResolvedValue({}),
  };
  const bridgeControlCoordinator = {
    registerRequest: jest.fn(),
    resolveFromBridgeMessage: jest.fn(),
  };
  const bridgeControlBus = {
    resolveRemoteSubscriber: jest.fn().mockResolvedValue(null),
    publishControlRequest: jest.fn().mockResolvedValue(false),
  };
  const encryptionService = {
    encryptString: jest.fn().mockReturnValue({
      ciphertext: "cipher",
      iv: "iv",
      authTag: "tag",
      keyVersion: "v1",
    }),
    decryptString: jest
      .fn()
      .mockReturnValue("decrypted-localappconnector-bearer"),
  };
  const auditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue("jwt-token"),
    verifyAsync: jest.fn().mockResolvedValue(bridgeAccessClaims()),
  };
  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        JWT_SECRET: "jwt-secret",
        JWT_WS_SECRET: "ws-secret",
        BRIDGE_ACCESS_EXPIRES_IN: "15m",
        BRIDGE_WS_EXPIRES_IN: "5m",
        BRIDGE_ACCESS_EXPIRED_GRACE_IN: "2m",
      };
      return values[key];
    }),
  };
  const threadMembershipService = {
    isThreadMember: jest.fn(),
    listMemberAgents: jest.fn().mockResolvedValue([
      {
        id: "agent-main",
        name: "The Distressed Dad Bot",
        description: "External ID: main",
      },
      {
        id: "agent-gapminer",
        name: "GapMiner",
        description: "External ID: gapminer",
      },
    ]),
    listMemberIds: jest
      .fn()
      .mockResolvedValue(["agent-main", "agent-gapminer"]),
    syncMemberships: jest.fn(),
  };
  const runtimeBindingService = {
    upsertByAgentId: jest.fn().mockResolvedValue(undefined),
    findByAgentId: jest.fn().mockResolvedValue(null),
  };
  const runtimeDispatchCoordinator = {
    resolveEligibleBindings: jest.fn().mockResolvedValue([]),
    resolveRuntimeThreadSession: jest.fn(),
    queueDispatch: jest.fn(),
    executeDispatch: jest.fn().mockResolvedValue(undefined),
  };
  const workspaceMembershipService = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue({}),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      BridgeService,
      {
        provide: getRepositoryToken(OpenClawConnectionEntity),
        useValue: connectionRepo,
      },
      {
        provide: getRepositoryToken(BridgeDeviceEntity),
        useValue: bridgeDeviceRepo,
      },
      {
        provide: getRepositoryToken(BridgeEnrollmentEntity),
        useValue: bridgeEnrollmentRepo,
      },
      {
        provide: getRepositoryToken(AgentProvisioningJobEntity),
        useValue: provisioningJobRepo,
      },
      { provide: getRepositoryToken(WorkspaceEntity), useValue: workspaceRepo },
      { provide: getRepositoryToken(AgentEntity), useValue: agentRepo },
      { provide: getRepositoryToken(MessageEntity), useValue: messageRepo },
      { provide: getRepositoryToken(TaskEntity), useValue: taskRepo },
      { provide: getRepositoryToken(ApprovalEntity), useValue: approvalRepo },
      { provide: getRepositoryToken(RunEntity), useValue: runRepo },
      { provide: getRepositoryToken(RunEventEntity), useValue: runEventRepo },
      { provide: getRepositoryToken(WorkLogEntity), useValue: workLogRepo },
      { provide: getRepositoryToken(ThreadEntity), useValue: threadRepo },
      { provide: getRepositoryToken(TeamEntity), useValue: teamRepo },
      {
        provide: getRepositoryToken(DepartmentEntity),
        useValue: departmentRepo,
      },
      { provide: EventsGateway, useValue: eventsGateway },
      {
        provide: BridgeControlCoordinatorService,
        useValue: bridgeControlCoordinator,
      },
      { provide: BridgeControlBusService, useValue: bridgeControlBus },
      { provide: MessageService, useValue: messageService },
      { provide: ThreadMembershipService, useValue: threadMembershipService },
      { provide: RuntimeBindingService, useValue: runtimeBindingService },
      {
        provide: RuntimeDispatchCoordinator,
        useValue: runtimeDispatchCoordinator,
      },
      {
        provide: WorkspaceMembershipService,
        useValue: workspaceMembershipService,
      },
      { provide: EncryptionService, useValue: encryptionService },
      { provide: AuditLogService, useValue: auditLogService },
      { provide: JwtService, useValue: jwtService },
      { provide: ConfigService, useValue: configService },
    ],
  }).compile();

  return {
    service: module.get(BridgeService),
    threadMembershipService,
    eventsGateway,
    connectionRepo,
    bridgeEnrollmentRepo,
    bridgeDeviceRepo,
    agentRepo,
    workspaceRepo,
    jwtService,
    messageRepo,
    taskRepo,
    approvalRepo,
    threadRepo,
    teamRepo,
    departmentRepo,
    messageService,
    runtimeDispatchCoordinator,
    runtimeBindingService,
    encryptionService,
    bridgeControlCoordinator,
    auditLogService,
  };
}

describe("BridgeService", () => {
  it("fails closed instead of signing a bridge websocket token with the main JWT secret", async () => {
    const { service, jwtService } = await buildService();
    const configService = (service as any).bridgeCredentials.config;
    configService.get.mockImplementation((key: string) =>
      key === "JWT_SECRET" ? "main-jwt-secret" : undefined,
    );

    await expect(
      (service as any).issueBridgeTokens({
        id: "device-1",
        workspaceId: "ws-1",
        devicePublicId: "bdev-1",
        credentialVersion: 1,
      }),
    ).rejects.toThrow("JWT_WS_SECRET_MISSING");
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  describe("bridge runtime authority", () => {
    it("explains when an OpenClaw marketplace target is not live in this workspace", async () => {
      const { service, eventsGateway } = await buildService();

      await expect(
        service.openClawMarketplaceInstallAvailability("ws-1", [
          { name: "Luca Signoff", externalId: "luca_signoff" },
        ]),
      ).resolves.toEqual({
        available: false,
        message:
          "Luca Signoff's OpenClaw runtime is not connected to this Railway workspace. Start or reconnect the OpenClaw bridge for this workspace, then try again.",
      });

      eventsGateway.getWorkspaceBridgeRuntime.mockReturnValueOnce({
        connectedBridgeDeviceCount: 1,
        bridgeControlSubscriberCount: 1,
        liveRegisteredAgentCount: 1,
        liveRegisteredExternalAgentIds: ["luca_signoff"],
      });
      eventsGateway.hasBridgeControlSubscribers.mockReturnValueOnce(true);
      await expect(
        service.openClawMarketplaceInstallAvailability("ws-1", [
          { name: "Luca Signoff", externalId: "luca_signoff" },
        ]),
      ).resolves.toEqual({ available: true, message: null });
    });

    it("requires live bridge device registration for external agents", async () => {
      const { service, eventsGateway } = await buildService();

      await expect(
        service.assertBridgeDeviceExternalAgentBinding({
          workspaceId: "ws-1",
          bridgeDeviceId: "device-1",
          externalAgentId: "main",
          runtimeType: "openclaw",
        }),
      ).resolves.toBeUndefined();

      expect(
        eventsGateway.isBridgeDeviceRegisteredForExternalAgent,
      ).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        bridgeDeviceId: "device-1",
        externalAgentId: "main",
        runtimeType: "openclaw",
      });

      eventsGateway.isBridgeDeviceRegisteredForExternalAgent.mockReturnValueOnce(
        false,
      );
      await expect(
        service.assertBridgeDeviceExternalAgentBinding({
          workspaceId: "ws-1",
          bridgeDeviceId: "device-1",
          externalAgentId: "main",
          runtimeType: "openclaw",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("binds runtime dispatch postbacks to workspace, binding, agent, and bridge device", async () => {
      const { service, eventsGateway } = await buildService();

      await service.assertBridgeDeviceRuntimeDispatchBinding({
        workspaceId: "ws-1",
        bridgeDeviceId: "device-1",
        bridgeRuntimeType: "openclaw",
        dispatch: {
          id: "dispatch-1",
          workspaceId: "ws-1",
          agentId: "agent-main",
          runtimeBindingId: "binding-1",
        },
        runtimeBinding: {
          id: "binding-1",
          workspaceId: "ws-1",
          agentId: "agent-main",
          runtimeType: "openclaw",
          capabilities: { bridgeBacked: true },
        },
      });

      expect(
        eventsGateway.isBridgeDeviceRegisteredForExternalAgent,
      ).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        bridgeDeviceId: "device-1",
        externalAgentId: "main",
        runtimeType: "openclaw",
      });
    });

    it("rejects a registered bridge device from a different runtime family", async () => {
      const { service, eventsGateway } = await buildService();

      await expect(
        service.assertBridgeDeviceRuntimeDispatchBinding({
          workspaceId: "ws-1",
          bridgeDeviceId: "device-1",
          bridgeRuntimeType: "hermes",
          dispatch: {
            id: "dispatch-1",
            workspaceId: "ws-1",
            agentId: "agent-main",
            runtimeBindingId: "binding-1",
          },
          runtimeBinding: {
            id: "binding-1",
            workspaceId: "ws-1",
            agentId: "agent-main",
            runtimeType: "claude_code",
            capabilities: { bridgeBacked: true },
          },
        }),
      ).rejects.toThrow("Bridge device runtime does not own this dispatch");
      expect(
        eventsGateway.isBridgeDeviceRegisteredForExternalAgent,
      ).not.toHaveBeenCalled();
    });

    it("allows an enrolled Relay Console device to load tools for its registered cross-runtime agent", async () => {
      const { service, eventsGateway } = await buildService();

      await service.assertBridgeDeviceAgentMarketplaceBinding({
        workspaceId: "ws-1",
        bridgeDeviceId: "device-1",
        devicePublicId: "bdev-public-1",
        agentId: "agent-main",
        runtimeBinding: {
          id: "binding-1",
          workspaceId: "ws-1",
          agentId: "agent-main",
          runtimeType: "openclaw",
          capabilities: { bridgeBacked: true },
        },
      });

      expect(
        eventsGateway.isBridgeDeviceRegisteredForExternalAgent,
      ).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        bridgeDeviceId: "device-1",
        externalAgentId: "main",
        runtimeType: undefined,
      });
    });

    it("allows a Relay Console device to load tools for its published cross-runtime agent", async () => {
      const { service, eventsGateway } = await buildService();

      await service.assertBridgeDeviceAgentMarketplaceBinding({
        workspaceId: "ws-1",
        bridgeDeviceId: "device-1",
        devicePublicId: "bdev-public-1",
        agentId: "agent-main",
        runtimeBinding: {
          id: "binding-1",
          workspaceId: "ws-1",
          agentId: "agent-main",
          runtimeType: "openclaw",
          capabilities: { bridgeBacked: true },
          configMetadata: {
            runtimeHostKind: "relay_console_swift",
            devicePublicId: "bdev-public-1",
          },
        },
      });

      expect(
        eventsGateway.isBridgeDeviceRegisteredForExternalAgent,
      ).not.toHaveBeenCalled();
    });

    it("rejects a Relay Console device that does not own the published agent", async () => {
      const { service, eventsGateway } = await buildService();
      eventsGateway.isBridgeDeviceRegisteredForExternalAgent.mockReturnValue(
        false,
      );

      await expect(
        service.assertBridgeDeviceAgentMarketplaceBinding({
          workspaceId: "ws-1",
          bridgeDeviceId: "device-1",
          devicePublicId: "other-bdev-public-id",
          agentId: "agent-main",
          runtimeBinding: {
            id: "binding-1",
            workspaceId: "ws-1",
            agentId: "agent-main",
            runtimeType: "openclaw",
            capabilities: { bridgeBacked: true },
            configMetadata: {
              runtimeHostKind: "relay_console_swift",
              devicePublicId: "bdev-public-1",
            },
          },
        }),
      ).rejects.toThrow(
        "Bridge device is not authorized for this external agent",
      );
    });

    it("scopes bridge task cache keys by workspace", async () => {
      const { service, taskRepo } = await buildService();
      taskRepo.save
        .mockResolvedValueOnce({
          id: "task-ws-1",
          workspaceId: "ws-1",
          status: "open",
        })
        .mockResolvedValueOnce({
          id: "task-ws-2",
          workspaceId: "ws-2",
          status: "open",
        });
      taskRepo.findOne.mockResolvedValueOnce({
        id: "task-ws-1",
        workspaceId: "ws-1",
        status: "done",
      });

      await service.createOrUpdateTaskFromBridge("ws-1", {
        workspaceId: "ws-1",
        externalId: "shared-task",
        externalAgentId: "main",
        title: "Workspace 1 task",
        status: "open",
      });
      await service.createOrUpdateTaskFromBridge("ws-2", {
        workspaceId: "ws-2",
        externalId: "shared-task",
        externalAgentId: "main",
        title: "Workspace 2 task",
        status: "open",
      });
      const updated = await service.createOrUpdateTaskFromBridge("ws-1", {
        workspaceId: "ws-1",
        externalId: "shared-task",
        externalAgentId: "main",
        title: "Workspace 1 task",
        status: "done",
      });

      expect(taskRepo.save).toHaveBeenCalledTimes(2);
      expect(taskRepo.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ workspaceId: "ws-1" }),
      );
      expect(taskRepo.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ workspaceId: "ws-2" }),
      );
      expect(taskRepo.update).toHaveBeenCalledWith(
        { id: "task-ws-1", workspaceId: "ws-1" },
        expect.objectContaining({ status: "done" }),
      );
      expect(updated).toEqual(
        expect.objectContaining({ id: "task-ws-1", workspaceId: "ws-1" }),
      );
    });
  });

  describe("OpenClaw attachments", () => {
    it("routes a Hermes agent attachment to its assigned bridge host", async () => {
      const {
        service,
        eventsGateway,
        runtimeBindingService,
        threadMembershipService,
      } = await buildService();
      eventsGateway.hasBridgeControlSubscribers.mockReturnValue(true);
      threadMembershipService.listMemberAgents.mockResolvedValue([
        { id: "agent-hermes" },
      ]);
      runtimeBindingService.findByAgentId.mockResolvedValue({
        isEnabled: true,
        runtimeType: "hermes",
        configMetadata: { bridgeDeviceId: "device-hermes" },
      });
      const requestSpy = jest
        .spyOn(service as any, "sendBridgeControlRequest")
        .mockResolvedValue({
          id: "attachment-1",
          bridgeDeviceId: "device-hermes",
          filename: "brief.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1234,
          sha256: "hash-1",
          kind: "document",
          localMediaRef: "openclaw://device-1/attachment-1",
          createdAt: "2026-06-20T19:00:00.000Z",
        });

      const result = await service.completeOpenClawAttachmentUpload({
        threadId: "thread-1",
        userId: "user-1",
        attachmentId: "attachment-1",
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: "attachment-1",
          workspaceId: "ws-1",
          threadId: "thread-1",
          status: "uploaded",
          storage: "openclaw_local",
          provenanceToken: expect.any(String),
        }),
      );
      expect(requestSpy).toHaveBeenCalledWith(
        "ws-1",
        "clawchat.attachment.upload.complete",
        expect.objectContaining({
          attachmentId: "attachment-1",
          threadId: "thread-1",
        }),
        ["clawchat.attachment.upload.complete.result"],
        ["clawchat.attachment.upload.error"],
        expect.any(Number),
        "clawchat.attachments.local_media",
        "device-hermes",
        "hermes",
      );
    });

    it("uses the live Hermes socket host when persisted binding metadata is stale", async () => {
      const {
        service,
        eventsGateway,
        runtimeBindingService,
        threadMembershipService,
      } = await buildService();
      threadMembershipService.listMemberAgents.mockResolvedValue([
        {
          id: "agent-hermes",
          workspaceId: "ws-1",
          externalId: "sunburnt_dude",
        },
      ]);
      runtimeBindingService.findByAgentId.mockResolvedValue({
        isEnabled: true,
        runtimeType: "hermes",
        runtimeExternalAgentId: null,
        configMetadata: {
          compatibilitySource: "hermes_bridge_registration",
        },
      });
      eventsGateway.getBridgeDeviceIdForExternalAgent.mockReturnValue(
        "device-live",
      );
      const requestSpy = jest
        .spyOn(service as any, "sendBridgeControlRequest")
        .mockResolvedValue({
          id: "attachment-1",
          bridgeDeviceId: "device-live",
          filename: "image.png",
          mimeType: "image/png",
          sizeBytes: 1234,
          sha256: "hash-1",
          kind: "image",
          localMediaRef: "/attachments/image.png",
          createdAt: "2026-07-31T08:00:00.000Z",
        });

      await service.completeOpenClawAttachmentUpload({
        threadId: "thread-1",
        userId: "user-1",
        attachmentId: "attachment-1",
      });

      expect(
        eventsGateway.getBridgeDeviceIdForExternalAgent,
      ).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        externalAgentId: "sunburnt_dude",
        runtimeType: "hermes",
      });
      expect(requestSpy).toHaveBeenCalledWith(
        "ws-1",
        "clawchat.attachment.upload.complete",
        expect.any(Object),
        expect.any(Array),
        expect.any(Array),
        expect.any(Number),
        "clawchat.attachments.local_media",
        "device-live",
        "hermes",
      );
    });

    it("rejects attachments when thread agents use different runtime hosts", async () => {
      const { service, runtimeBindingService, threadMembershipService } =
        await buildService();
      threadMembershipService.listMemberAgents.mockResolvedValue([
        { id: "agent-one" },
        { id: "agent-two" },
      ]);
      runtimeBindingService.findByAgentId
        .mockResolvedValueOnce({
          isEnabled: true,
          runtimeType: "hermes",
          configMetadata: { bridgeDeviceId: "device-one" },
        })
        .mockResolvedValueOnce({
          isEnabled: true,
          runtimeType: "hermes",
          configMetadata: { bridgeDeviceId: "device-two" },
        });

      await expect(
        service.completeOpenClawAttachmentUpload({
          threadId: "thread-1",
          userId: "user-1",
          attachmentId: "attachment-1",
        }),
      ).rejects.toThrow(
        "Attachments require thread agents to share one runtime host.",
      );
    });
  });

  describe("workspace file path containment", () => {
    it("normalizes safe OpenClaw library folders and filenames before dispatch", async () => {
      const { service } = await buildService();
      const requestSpy = jest
        .spyOn(service as any, "sendBridgeLibraryRequest")
        .mockResolvedValue({
          folder: "docs/nested",
          written: ["AGENTS.md"],
          createdFolder: false,
        });

      await service.writeLibraryFiles("ws-1", "docs//nested", [
        {
          filename: "AGENTS.md",
          content: "# Agent",
          contentEncoding: "utf8",
        },
      ]);

      expect(requestSpy).toHaveBeenCalledWith(
        "ws-1",
        "library.write",
        {
          folder: "docs/nested",
          files: [
            expect.objectContaining({
              filename: "AGENTS.md",
              content: "# Agent",
            }),
          ],
        },
        ["library.write.result"],
        60_000,
      );
    });

    it("allows generated JSON metadata in the OpenClaw documentation library", async () => {
      const { service } = await buildService();
      const requestSpy = jest
        .spyOn(service as any, "sendBridgeLibraryRequest")
        .mockResolvedValue({
          folder: "marketplace/amplitude",
          written: ["roles_manifest.json"],
          createdFolder: false,
        });

      await service.writeLibraryFiles("ws-1", "marketplace/amplitude", [
        {
          filename: "roles_manifest.json",
          content: "{}",
          contentEncoding: "utf8",
        },
      ]);

      expect(requestSpy).toHaveBeenCalledWith(
        "ws-1",
        "library.write",
        expect.objectContaining({
          files: [expect.objectContaining({ filename: "roles_manifest.json" })],
        }),
        ["library.write.result"],
        60_000,
      );
    });

    it("keeps arbitrary JSON blocked from OpenClaw agent workspaces", async () => {
      const { service } = await buildService();
      const requestSpy = jest.spyOn(service as any, "sendBridgeControlRequest");

      await expect(
        service.writeAgentWorkspaceFiles("ws-1", "agent-1", "", [
          { filename: "secrets.json", content: "{}" },
        ]),
      ).rejects.toThrow("Enter a markdown, env, or PNG filename");

      expect(requestSpy).not.toHaveBeenCalled();
    });

    it.each([
      ["relative traversal folder", "../secrets"],
      ["encoded traversal folder", "%2e%2e/secrets"],
      ["absolute folder", "/etc"],
      ["windows separator folder", "docs\\secrets"],
    ])("rejects unsafe OpenClaw library %s", async (_label, folder) => {
      const { service } = await buildService();
      const requestSpy = jest.spyOn(service as any, "sendBridgeLibraryRequest");

      await expect(service.listLibrary("ws-1", folder)).rejects.toThrow();

      expect(requestSpy).not.toHaveBeenCalled();
    });

    it.each([
      ["relative traversal filename", "../AGENTS.md"],
      ["encoded traversal filename", "%2e%2e%2fAGENTS.md"],
      ["absolute filename", "/AGENTS.md"],
      ["windows separator filename", "folder\\AGENTS.md"],
    ])("rejects unsafe OpenClaw library %s", async (_label, filename) => {
      const { service } = await buildService();
      const requestSpy = jest.spyOn(service as any, "sendBridgeLibraryRequest");

      await expect(
        service.readLibraryFile("ws-1", "docs", filename),
      ).rejects.toThrow();

      expect(requestSpy).not.toHaveBeenCalled();
    });

    it("rejects recursive OpenClaw library root folder deletion", async () => {
      const { service } = await buildService();
      const requestSpy = jest.spyOn(service as any, "sendBridgeLibraryRequest");

      await expect(service.deleteLibraryFolder("ws-1", "")).rejects.toThrow();

      expect(requestSpy).not.toHaveBeenCalled();
    });

    it("rejects unsafe Hermes workspace paths and filenames before dispatch", async () => {
      const { service } = await buildService();
      jest
        .spyOn(service as any, "requireHermesWorkspaceTarget")
        .mockResolvedValue({
          externalAgentId: "hermes-agent",
        });
      const requestSpy = jest.spyOn(
        service as any,
        "sendHermesWorkspaceRequest",
      );

      await expect(
        service.readHermesWorkspaceFile(
          "ws-1",
          "agent-1",
          "project",
          "/%2e%2e/secrets",
          "AGENTS.md",
        ),
      ).rejects.toThrow();
      await expect(
        service.deleteHermesWorkspaceFile(
          "ws-1",
          "agent-1",
          "project",
          "/docs",
          "../AGENTS.md",
        ),
      ).rejects.toThrow();

      expect(requestSpy).not.toHaveBeenCalled();
    });
  });

  it("returns a structured setup error instead of calling user-local LocalAppConnector from Railway", async () => {
    const { service, connectionRepo } = await buildService();
    connectionRepo.findOne.mockResolvedValue({
      id: "openclaw-connection-1",
      workspaceId: "ws-1",
      instanceUrl: "http://localhost:3052",
      apiKeyCiphertext: "cipher",
      apiKeyIv: "iv",
      apiKeyAuthTag: "tag",
      apiKeyKeyVersion: "v1",
      status: "connected",
      updatedAt: new Date(),
    });

    await expect(
      service.callLocalAppConnectorAgentApi({
        workspaceId: "ws-1",
        connectionId: "openclaw-connection-1",
        method: "GET",
        path: "settings",
        contractVersion: "2026-03-18",
        sourceHostId: "bridge-1",
        sourceHostType: "hermes_bridge",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "source_host_proxy_required",
        details: expect.objectContaining({
          executionMode: "source_host_proxy",
          outboundTarget:
            "http://localhost:3052/api/openclaw/settings?contractVersion=2026-03-18",
          sourceHostId: "bridge-1",
          sourceHostType: "hermes_bridge",
        }),
      }),
    });
  });

  it("executes local LocalAppConnector Agent API calls through the Hermes source-host bridge", async () => {
    const { service, connectionRepo, eventsGateway, bridgeControlCoordinator } =
      await buildService();
    connectionRepo.findOne.mockResolvedValue({
      id: "openclaw-connection-1",
      workspaceId: "ws-1",
      instanceUrl: "http://localhost:3052",
      apiKeyCiphertext: "cipher",
      apiKeyIv: "iv",
      apiKeyAuthTag: "tag",
      apiKeyKeyVersion: "v1",
      status: "connected",
      updatedAt: new Date(),
    });
    eventsGateway.hasHermesBridgeWorkspaceCapability.mockReturnValue(true);
    bridgeControlCoordinator.registerRequest.mockResolvedValue({
      type: "marketplace.localAppAgentApiRequest.result",
      data: {
        requestId: "request-1",
        status: "ok",
        httpStatus: 200,
        body: { data: { settings: true } },
        headers: { "content-type": "application/json" },
      },
    });

    const result = await service.callLocalAppConnectorAgentApi({
      workspaceId: "ws-1",
      connectionId: "openclaw-connection-1",
      method: "GET",
      path: "/api/openclaw/settings",
      contractVersion: "2026-03-18",
      sourceHostId: "bridge-1",
      sourceHostType: "hermes_bridge",
      appSlug: "local-localappconnector",
      linkedAppId: "linked-1",
    });

    expect(result).toEqual({
      ok: true,
      status: 200,
      endpoint:
        "http://localhost:3052/api/openclaw/settings?contractVersion=2026-03-18",
      data: { data: { settings: true } },
    });
    expect(eventsGateway.emitToHermesBridgeWorkspace).toHaveBeenCalledWith(
      "ws-1",
      "marketplace.localAppAgentApiRequest",
      expect.objectContaining({
        appSlug: "local-localappconnector",
        linkedAppId: "linked-1",
        baseUrl: "http://localhost:3052",
        endpoint:
          "http://localhost:3052/api/openclaw/settings?contractVersion=2026-03-18",
        method: "GET",
        path: "settings",
        headers: { "content-type": "application/json" },
        credential: expect.objectContaining({
          type: "bearer",
          authorizationHeader: "Bearer decrypted-localappconnector-bearer",
          tokenExposure: "bridge_only",
        }),
        bridgeOnlyCredential: expect.objectContaining({
          type: "bearer",
          authorizationHeader: "Bearer decrypted-localappconnector-bearer",
          tokenExposure: "bridge_only",
        }),
        bridgeOnlyBearerCredential: expect.objectContaining({
          authorizationHeader: "Bearer decrypted-localappconnector-bearer",
          tokenExposure: "bridge_only",
        }),
      }),
      "clawchat.marketplace.tools",
      "bridge-1",
    );
    expect(JSON.stringify(result)).not.toContain(
      "decrypted-localappconnector-bearer",
    );
  });

  it("requests source-host runtime recovery before local LocalAppConnector Agent API calls when approved", async () => {
    const {
      service,
      connectionRepo,
      eventsGateway,
      bridgeControlCoordinator,
      approvalRepo,
    } = await buildService();
    connectionRepo.findOne.mockResolvedValue({
      id: "openclaw-connection-1",
      workspaceId: "ws-1",
      instanceUrl: "http://localhost:3052",
      apiKeyCiphertext: "cipher",
      apiKeyIv: "iv",
      apiKeyAuthTag: "tag",
      apiKeyKeyVersion: "v1",
      status: "connected",
      updatedAt: new Date(),
    });
    eventsGateway.hasHermesBridgeWorkspaceCapability.mockImplementation(
      (_workspaceId: string, capability: string) =>
        capability === "clawchat.marketplace.tools" ||
        capability === "localAppRuntimeRecovery",
    );
    approvalRepo.findOne.mockResolvedValue({
      id: "approval-1",
      workspaceId: "ws-1",
      status: "approved",
      resolvedAt: new Date(),
      resolvedByUserId: "admin-1",
      expiresAt: new Date(Date.now() + 60_000),
      metadata: {
        provider: "registered_local_app_runtime",
        action: "localApp.ensureRunning",
        appSlug: "local-localappconnector",
        linkedAppId: "linked-1",
        sourceHostId: "bridge-1",
        sourceHostType: "hermes_bridge",
        requestingAgentId: "agent-1",
        startCommand: "pnpm dev",
      },
    });
    bridgeControlCoordinator.registerRequest
      .mockResolvedValueOnce({
        type: "localApp.ensureRunning.result",
        data: {
          requestId: "runtime-request-1",
          status: "already_running",
          appReachable: true,
          backendReachable: true,
        },
      })
      .mockResolvedValueOnce({
        type: "marketplace.localAppAgentApiRequest.result",
        data: {
          requestId: "request-1",
          status: "ok",
          httpStatus: 200,
          body: { data: { settings: true } },
        },
      });

    await service.callLocalAppConnectorAgentApi({
      workspaceId: "ws-1",
      connectionId: "openclaw-connection-1",
      method: "GET",
      path: "settings",
      sourceHostId: "bridge-1",
      sourceHostType: "hermes_bridge",
      appSlug: "local-localappconnector",
      linkedAppId: "linked-1",
      runtimeProfile: {
        repoPath: "/home/example/repos/LocalAppConnector",
        appUrl: "http://localhost:3052",
        agentApiUrl: "http://localhost:3052/api/openclaw",
        startCommand: "pnpm dev",
        healthCheckUrl: "http://localhost:3052",
        backendHealthCheckUrl: "http://localhost:3210",
        autoStartAllowed: true,
        hardStopConditions: ["install", "migration", "reset"],
        expectedPorts: [3052, 3210],
        sourceHostId: "bridge-1",
      },
      runtimeRecoveryApprovalId: "approval-1",
      agentId: "agent-1",
      dispatchId: "dispatch-1",
    });

    expect(eventsGateway.emitToHermesBridgeWorkspace).toHaveBeenNthCalledWith(
      1,
      "ws-1",
      "localApp.ensureRunning",
      expect.objectContaining({
        appSlug: "local-localappconnector",
        linkedAppId: "linked-1",
        input: { approvalId: "approval-1" },
        runtimeProfile: expect.objectContaining({
          repoPath: "/home/example/repos/LocalAppConnector",
          startCommand: "pnpm dev",
          autoStartAllowed: true,
          hardStopConditions: expect.arrayContaining([
            "install",
            "migration",
            "reset",
          ]),
        }),
      }),
      "localAppRuntimeRecovery",
      "bridge-1",
    );
    expect(eventsGateway.emitToHermesBridgeWorkspace).toHaveBeenNthCalledWith(
      2,
      "ws-1",
      "marketplace.localAppAgentApiRequest",
      expect.objectContaining({
        runtimeProfile: expect.objectContaining({
          healthCheckUrl: "http://localhost:3052",
          backendHealthCheckUrl: "http://localhost:3210",
        }),
        runtimeRecovery: expect.objectContaining({
          action: "localApp.ensureRunning",
          approvalRequired: true,
          approvalId: "approval-1",
          autoStartAllowed: true,
          bridgeActions: expect.arrayContaining(["localApp.start"]),
        }),
      }),
      "clawchat.marketplace.tools",
      "bridge-1",
    );
  });

  it("disables automatic source-host runtime recovery without an approved approval", async () => {
    const { service, connectionRepo, eventsGateway, bridgeControlCoordinator } =
      await buildService();
    connectionRepo.findOne.mockResolvedValue({
      id: "openclaw-connection-1",
      workspaceId: "ws-1",
      instanceUrl: "http://localhost:3052",
      apiKeyCiphertext: "cipher",
      apiKeyIv: "iv",
      apiKeyAuthTag: "tag",
      apiKeyKeyVersion: "v1",
      status: "connected",
      updatedAt: new Date(),
    });
    eventsGateway.hasHermesBridgeWorkspaceCapability.mockImplementation(
      (_workspaceId: string, capability: string) =>
        capability === "clawchat.marketplace.tools" ||
        capability === "localAppRuntimeRecovery",
    );
    bridgeControlCoordinator.registerRequest.mockResolvedValue({
      type: "marketplace.localAppAgentApiRequest.result",
      data: {
        requestId: "request-1",
        status: "ok",
        httpStatus: 200,
        body: { data: { settings: true } },
      },
    });

    await service.callLocalAppConnectorAgentApi({
      workspaceId: "ws-1",
      connectionId: "openclaw-connection-1",
      method: "GET",
      path: "settings",
      sourceHostId: "bridge-1",
      sourceHostType: "hermes_bridge",
      appSlug: "local-localappconnector",
      linkedAppId: "linked-1",
      runtimeProfile: {
        repoPath: "/home/example/repos/LocalAppConnector",
        appUrl: "http://localhost:3052",
        agentApiUrl: "http://localhost:3052/api/openclaw",
        startCommand: "pnpm dev",
        healthCheckUrl: "http://localhost:3052",
        backendHealthCheckUrl: "http://localhost:3210",
        autoStartAllowed: true,
        hardStopConditions: ["install", "migration", "reset"],
        expectedPorts: [3052, 3210],
        sourceHostId: "bridge-1",
      },
    });

    expect(eventsGateway.emitToHermesBridgeWorkspace).toHaveBeenCalledTimes(1);
    expect(eventsGateway.emitToHermesBridgeWorkspace).toHaveBeenCalledWith(
      "ws-1",
      "marketplace.localAppAgentApiRequest",
      expect.objectContaining({
        runtimeRecovery: expect.objectContaining({
          action: "localApp.ensureRunning",
          approvalRequired: true,
          approvalId: null,
          autoStartAllowed: false,
          bridgeActions: ["localApp.getRuntimeStatus"],
          disabledReason: "approval_required_for_runtime_recovery",
        }),
      }),
      "clawchat.marketplace.tools",
      "bridge-1",
    );
  });

  it("executes local app runtime start only with an approved scoped approval", async () => {
    const { service, eventsGateway, bridgeControlCoordinator, approvalRepo } =
      await buildService();
    eventsGateway.hasHermesBridgeWorkspaceCapability.mockReturnValue(true);
    approvalRepo.findOne.mockResolvedValue({
      id: "approval-1",
      workspaceId: "ws-1",
      status: "approved",
      resolvedAt: new Date(),
      resolvedByUserId: "admin-1",
      expiresAt: new Date(Date.now() + 60_000),
      metadata: {
        provider: "registered_local_app_runtime",
        action: "localApp.start",
        appSlug: "local-localappconnector",
        linkedAppId: "linked-1",
        sourceHostId: "bridge-1",
        sourceHostType: "hermes_bridge",
        requestingAgentId: "agent-1",
        startCommand: "pnpm dev",
      },
    });
    bridgeControlCoordinator.registerRequest.mockResolvedValue({
      type: "localApp.start.result",
      data: {
        requestId: "runtime-request-1",
        status: "started",
        started: true,
      },
    });

    const result = await service.executeLocalAppRuntimeTool({
      workspaceId: "ws-1",
      appSlug: "local-localappconnector",
      linkedAppId: "linked-1",
      sourceHostId: "bridge-1",
      sourceHostType: "hermes_bridge",
      agentId: "agent-1",
      dispatchId: "dispatch-1",
      toolName: "localApp.start",
      input: { approvalId: "approval-1" },
      runtimeProfile: {
        repoPath: "/home/example/repos/LocalAppConnector",
        appUrl: "http://localhost:3052",
        agentApiUrl: "http://localhost:3052/api/openclaw",
        startCommand: "pnpm dev",
        healthCheckUrl: "http://localhost:3052",
        backendHealthCheckUrl: "http://localhost:3210",
        autoStartAllowed: true,
        hardStopConditions: ["install", "migration", "reset"],
        expectedPorts: [3052, 3210],
        sourceHostId: "bridge-1",
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        action: "localApp.start",
        status: "started",
        started: true,
      }),
    );
    expect(approvalRepo.findOne).toHaveBeenCalledWith({
      where: { id: "approval-1", workspaceId: "ws-1" },
    });
    expect(eventsGateway.emitToHermesBridgeWorkspace).toHaveBeenCalledWith(
      "ws-1",
      "localApp.start",
      expect.objectContaining({
        appSlug: "local-localappconnector",
        linkedAppId: "linked-1",
        input: { approvalId: "approval-1" },
      }),
      "localAppRuntimeRecovery",
      "bridge-1",
    );
  });

  it("rejects local app runtime start when approval is missing or not scoped", async () => {
    const { service, eventsGateway, approvalRepo } = await buildService();
    eventsGateway.hasHermesBridgeWorkspaceCapability.mockReturnValue(true);
    const runtimeProfile = {
      repoPath: "/home/example/repos/LocalAppConnector",
      appUrl: "http://localhost:3052",
      agentApiUrl: "http://localhost:3052/api/openclaw",
      startCommand: "pnpm dev",
      healthCheckUrl: "http://localhost:3052",
      backendHealthCheckUrl: "http://localhost:3210",
      autoStartAllowed: true,
      hardStopConditions: ["install", "migration", "reset"],
      expectedPorts: [3052, 3210],
      sourceHostId: "bridge-1",
    };

    await expect(
      service.executeLocalAppRuntimeTool({
        workspaceId: "ws-1",
        appSlug: "local-localappconnector",
        linkedAppId: "linked-1",
        sourceHostId: "bridge-1",
        sourceHostType: "hermes_bridge",
        agentId: "agent-1",
        toolName: "localApp.start",
        input: {},
        runtimeProfile,
      }),
    ).rejects.toThrow(ForbiddenException);

    approvalRepo.findOne.mockResolvedValue({
      id: "approval-1",
      workspaceId: "ws-1",
      status: "approved",
      resolvedAt: new Date(),
      resolvedByUserId: "admin-1",
      expiresAt: new Date(Date.now() + 60_000),
      metadata: {
        provider: "registered_local_app_runtime",
        action: "localApp.start",
        appSlug: "other-app",
        linkedAppId: "linked-1",
        sourceHostId: "bridge-1",
        requestingAgentId: "agent-1",
      },
    });
    await expect(
      service.executeLocalAppRuntimeTool({
        workspaceId: "ws-1",
        appSlug: "local-localappconnector",
        linkedAppId: "linked-1",
        sourceHostId: "bridge-1",
        sourceHostType: "hermes_bridge",
        agentId: "agent-1",
        toolName: "localApp.start",
        input: { approvalId: "approval-1" },
        runtimeProfile,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("requires approved scoped approval for direct local app ensure-running", async () => {
    const { service, eventsGateway, bridgeControlCoordinator, approvalRepo } =
      await buildService();
    eventsGateway.hasHermesBridgeWorkspaceCapability.mockReturnValue(true);
    approvalRepo.findOne.mockResolvedValue({
      id: "approval-1",
      workspaceId: "ws-1",
      status: "approved",
      resolvedAt: new Date(),
      resolvedByUserId: "admin-1",
      expiresAt: new Date(Date.now() + 60_000),
      metadata: {
        provider: "registered_local_app_runtime",
        action: "localApp.ensureRunning",
        appSlug: "local-localappconnector",
        linkedAppId: "linked-1",
        sourceHostId: "bridge-1",
        sourceHostType: "hermes_bridge",
        requestingAgentId: "agent-1",
        startCommand: "pnpm dev",
      },
    });
    bridgeControlCoordinator.registerRequest.mockResolvedValue({
      type: "localApp.ensureRunning.result",
      data: {
        requestId: "runtime-request-1",
        status: "already_running",
        appReachable: true,
      },
    });

    await expect(
      service.executeLocalAppRuntimeTool({
        workspaceId: "ws-1",
        appSlug: "local-localappconnector",
        linkedAppId: "linked-1",
        sourceHostId: "bridge-1",
        sourceHostType: "hermes_bridge",
        agentId: "agent-1",
        toolName: "localApp.ensureRunning",
        input: { approvalId: "approval-1" },
        runtimeProfile: {
          repoPath: "/home/example/repos/LocalAppConnector",
          appUrl: "http://localhost:3052",
          agentApiUrl: "http://localhost:3052/api/openclaw",
          startCommand: "pnpm dev",
          healthCheckUrl: "http://localhost:3052",
          backendHealthCheckUrl: "http://localhost:3210",
          autoStartAllowed: true,
          hardStopConditions: ["install", "migration", "reset"],
          expectedPorts: [3052, 3210],
          sourceHostId: "bridge-1",
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        action: "localApp.ensureRunning",
        status: "already_running",
      }),
    );
  });

  it("maps source-host LocalAppConnector 401 responses to localappconnector_auth_failed", async () => {
    const { service, connectionRepo, eventsGateway, bridgeControlCoordinator } =
      await buildService();
    connectionRepo.findOne.mockResolvedValue({
      id: "openclaw-connection-1",
      workspaceId: "ws-1",
      instanceUrl: "http://localhost:3052",
      apiKeyCiphertext: "cipher",
      apiKeyIv: "iv",
      apiKeyAuthTag: "tag",
      apiKeyKeyVersion: "v1",
      status: "connected",
      updatedAt: new Date(),
    });
    eventsGateway.hasHermesBridgeWorkspaceCapability.mockReturnValue(true);
    bridgeControlCoordinator.registerRequest.mockResolvedValue({
      type: "marketplace.localAppAgentApiRequest.result",
      data: {
        requestId: "request-1",
        status: "ok",
        httpStatus: 401,
        body: { error: "Missing bearer token" },
      },
    });

    await expect(
      service.callLocalAppConnectorAgentApi({
        workspaceId: "ws-1",
        connectionId: "openclaw-connection-1",
        method: "GET",
        path: "settings",
        sourceHostId: "bridge-1",
        sourceHostType: "hermes_bridge",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "localappconnector_auth_failed",
      }),
    });
  });

  it("rejects invalid LocalAppConnector Agent API targets before proxying", async () => {
    const { service, connectionRepo } = await buildService();
    connectionRepo.findOne.mockResolvedValue({
      id: "openclaw-connection-1",
      workspaceId: "ws-1",
      instanceUrl: "file:///tmp/localappconnector",
      apiKeyCiphertext: "cipher",
      apiKeyIv: "iv",
      apiKeyAuthTag: "tag",
      apiKeyKeyVersion: "v1",
      status: "connected",
      updatedAt: new Date(),
    });

    await expect(
      service.callLocalAppConnectorAgentApi({
        workspaceId: "ws-1",
        connectionId: "openclaw-connection-1",
        method: "GET",
        path: "settings",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "source_host_rejected_target",
      }),
    });
  });

  it("proxies non-local LocalAppConnector Agent API calls with the stored bearer without returning the token", async () => {
    const { service, connectionRepo } = await buildService();
    connectionRepo.findOne.mockResolvedValue({
      id: "openclaw-connection-1",
      workspaceId: "ws-1",
      instanceUrl: "https://localappconnector.example.com",
      apiKeyCiphertext: "cipher",
      apiKeyIv: "iv",
      apiKeyAuthTag: "tag",
      apiKeyKeyVersion: "v1",
      status: "connected",
      updatedAt: new Date(),
    });
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ data: { ok: true } })),
    } as any);

    const result = await service.callLocalAppConnectorAgentApi({
      workspaceId: "ws-1",
      connectionId: "openclaw-connection-1",
      method: "GET",
      path: "settings",
      contractVersion: "2026-03-18",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "https://localappconnector.example.com/api/openclaw/settings?contractVersion=2026-03-18",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer decrypted-localappconnector-bearer",
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain(
      "decrypted-localappconnector-bearer",
    );
    fetchMock.mockRestore();
  });

  it("rejects bridge senders that are not explicit thread members", async () => {
    const { service, threadMembershipService } = await buildService();
    threadMembershipService.isThreadMember.mockResolvedValue(false);

    await expect(
      service.postBridgeMessage("thread-1", "ws-1", "hello", "main"),
    ).rejects.toThrow(ForbiddenException);
  });

  it("uses the runtime dispatch target agent when the bridge sender id is not resolvable", async () => {
    const { service, agentRepo, threadMembershipService, messageService } =
      await buildService();

    agentRepo.findOne.mockImplementation(async (input: any) => {
      const where = input?.where;
      if (Array.isArray(where)) {
        const first = where[0];
        if (first?.externalId === "mystery" && first?.workspaceId === "ws-1") {
          return null;
        }
      }
      if (where?.id === "agent-nathan" && where?.workspaceId === "ws-1") {
        return {
          id: "agent-nathan",
          name: "Nathan Guide",
          workspaceId: "ws-1",
          externalId: "nathan_guide",
        };
      }
      return null;
    });
    agentRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });
    threadMembershipService.isThreadMember.mockImplementation(
      async (_threadId: string, agentId: string) => agentId === "agent-nathan",
    );

    await service.postBridgeMessage(
      "thread-1",
      "ws-1",
      "hello",
      "mystery",
      undefined,
      undefined,
      undefined,
      { preferredAgentId: "agent-nathan" },
    );

    expect(messageService.injectMessage).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        senderId: "agent-nathan",
        senderName: "Nathan Guide",
      }),
      { routeToAgents: false },
    );
  });

  it("falls back to the sole thread agent when a single-agent direct thread gets an unknown sender id", async () => {
    const { service, agentRepo, threadMembershipService, messageService } =
      await buildService();

    agentRepo.findOne.mockImplementation(async (input: any) => {
      const where = input?.where;
      if (Array.isArray(where)) {
        const first = where[0];
        if (first?.externalId === "mystery" && first?.workspaceId === "ws-1") {
          return null;
        }
      }
      return null;
    });
    agentRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "agent-nathan",
        name: "Nathan Guide",
        externalId: "nathan_guide",
        source: "openclaw",
      },
    ]);
    threadMembershipService.isThreadMember.mockImplementation(
      async (_threadId: string, agentId: string) => agentId === "agent-nathan",
    );

    await service.postBridgeMessage("thread-1", "ws-1", "hello", "mystery");

    expect(messageService.injectMessage).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        senderId: "agent-nathan",
        senderName: "Nathan Guide",
      }),
      { routeToAgents: false },
    );
  });

  it("repairs thread membership for the runtime dispatch target agent before posting", async () => {
    const {
      service,
      agentRepo,
      threadMembershipService,
      threadRepo,
      messageService,
    } = await buildService();

    threadRepo.findOne.mockResolvedValue({
      id: "thread-1",
      workspaceId: "ws-1",
      agentIds: ["agent-main", "agent-gapminer"],
      maxAgentTurns: null,
    });
    agentRepo.findOne.mockImplementation(async (input: any) => {
      const where = input?.where;
      if (Array.isArray(where)) {
        const first = where[0];
        if (
          first?.externalId === "nathan_guide" &&
          first?.workspaceId === "ws-1"
        ) {
          return {
            id: "agent-nathan",
            name: "Nathan Guide",
            workspaceId: "ws-1",
            externalId: "nathan_guide",
          };
        }
      }
      if (where?.id === "agent-nathan" && where?.workspaceId === "ws-1") {
        return {
          id: "agent-nathan",
          name: "Nathan Guide",
          workspaceId: "ws-1",
          externalId: "nathan_guide",
        };
      }
      return null;
    });
    threadMembershipService.isThreadMember.mockResolvedValue(false);

    await service.postBridgeMessage(
      "thread-1",
      "ws-1",
      "hello",
      "nathan_guide",
      undefined,
      undefined,
      undefined,
      { preferredAgentId: "agent-nathan" },
    );

    expect(threadMembershipService.syncMemberships).toHaveBeenCalledWith(
      expect.objectContaining({ id: "thread-1" }),
      ["agent-main", "agent-gapminer", "agent-nathan"],
    );
    expect(messageService.injectMessage).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        senderId: "agent-nathan",
        senderName: "Nathan Guide",
      }),
      { routeToAgents: false },
    );
  });

  it("re-dispatches agent replies only to the other explicit thread members", async () => {
    const { service, threadMembershipService, eventsGateway } =
      await buildService();
    threadMembershipService.isThreadMember.mockResolvedValue(true);

    await service.postBridgeMessage("thread-1", "ws-1", "hello", "main");

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["gapminer"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-1",
        threadSessionId: "session-1",
        content: "reply",
        isFromAgent: true,
      }),
    );
  });

  it("routes runtime-backed agent replies through runtime dispatch correlation", async () => {
    const {
      service,
      threadMembershipService,
      eventsGateway,
      runtimeDispatchCoordinator,
    } = await buildService();
    threadMembershipService.isThreadMember.mockResolvedValue(true);
    runtimeDispatchCoordinator.resolveEligibleBindings.mockResolvedValue([
      {
        id: "binding-gapminer",
        workspaceId: "ws-1",
        agentId: "agent-gapminer",
        runtimeType: "openclaw",
        capabilities: { bridgeBacked: true },
        configMetadata: {},
      },
    ]);
    runtimeDispatchCoordinator.resolveRuntimeThreadSession.mockResolvedValue({
      id: "runtime-session-gapminer",
      runtimeSessionId: "openclaw:agent-gapminer:session-1",
    });
    runtimeDispatchCoordinator.queueDispatch.mockResolvedValue({
      id: "dispatch-gapminer",
      workspaceId: "ws-1",
      threadId: "thread-1",
      threadSessionId: "session-1",
      messageId: "message-1",
      agentId: "agent-gapminer",
      correlationId: null,
    });

    await service.postBridgeMessage("thread-1", "ws-1", "hello", "main");

    expect(runtimeDispatchCoordinator.queueDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        threadId: "thread-1",
        threadSessionId: "session-1",
        messageId: "message-1",
        agentId: "agent-gapminer",
      }),
    );
    expect(runtimeDispatchCoordinator.executeDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        inputText: "reply",
        dispatch: expect.objectContaining({ id: "dispatch-gapminer" }),
        dispatchMetadata: expect.objectContaining({
          targetExternalId: "gapminer",
          senderId: "agent-main",
          isFromAgent: true,
        }),
      }),
    );
    expect(eventsGateway.emitToBridgeAgents).not.toHaveBeenCalled();
  });

  it("routes worker bridge replies to the other shared team agents", async () => {
    const {
      service,
      agentRepo,
      threadRepo,
      teamRepo,
      threadMembershipService,
      messageService,
      eventsGateway,
    } = await buildService();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-1",
      workspaceId: "ws-1",
      type: "team",
      teamId: "team-1",
      maxAgentTurns: null,
    });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      leadAgentId: "agent-manager",
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "agent-manager",
        name: "Execution Optimizer",
        externalId: "execution_optimizer",
        source: "openclaw",
      },
      {
        id: "agent-worker",
        name: "Targeting & Maintenance",
        externalId: "targeting_maintenance",
        source: "openclaw",
      },
      {
        id: "agent-other",
        name: "Research Support",
        externalId: "research_support",
        source: "openclaw",
      },
    ]);
    agentRepo.findOne.mockImplementation(async (input: any) => {
      const where = input?.where;
      if (Array.isArray(where)) {
        const externalId = where[0]?.externalId;
        if (externalId === "targeting_maintenance") {
          return {
            id: "agent-worker",
            name: "Targeting & Maintenance",
            workspaceId: "ws-1",
            externalId,
          };
        }
      }
      return null;
    });
    threadMembershipService.isThreadMember.mockResolvedValue(true);
    messageService.injectMessage.mockResolvedValueOnce({
      id: "message-1",
      content: "Targeting check complete.",
      threadSessionId: "session-1",
    });

    await service.postBridgeMessage(
      "thread-1",
      "ws-1",
      "Targeting check complete.",
      "targeting_maintenance",
    );

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["execution_optimizer", "research_support"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-1",
        threadSessionId: "session-1",
        content: "Targeting check complete.",
        isFromAgent: true,
      }),
    );
    expect(eventsGateway.emitAgentTyping).toHaveBeenLastCalledWith(
      "thread-1",
      ["agent-manager", "agent-other"],
      true,
    );
  });

  it("keeps worker bridge mentions visible to the other shared team agents", async () => {
    const {
      service,
      agentRepo,
      threadRepo,
      teamRepo,
      threadMembershipService,
      messageService,
      eventsGateway,
    } = await buildService();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-1",
      workspaceId: "ws-1",
      type: "team",
      teamId: "team-1",
      maxAgentTurns: null,
    });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      leadAgentId: "agent-manager",
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "agent-manager",
        name: "Execution Optimizer",
        externalId: "execution_optimizer",
        source: "openclaw",
      },
      {
        id: "agent-worker",
        name: "Targeting & Maintenance",
        externalId: "targeting_maintenance",
        source: "openclaw",
      },
      {
        id: "agent-other",
        name: "Research Support",
        externalId: "research_support",
        source: "openclaw",
      },
    ]);
    agentRepo.findOne.mockImplementation(async (input: any) => {
      const where = input?.where;
      if (Array.isArray(where)) {
        const externalId = where[0]?.externalId;
        if (externalId === "targeting_maintenance") {
          return {
            id: "agent-worker",
            name: "Targeting & Maintenance",
            workspaceId: "ws-1",
            externalId,
          };
        }
      }
      return null;
    });
    threadMembershipService.isThreadMember.mockResolvedValue(true);
    messageService.injectMessage.mockResolvedValueOnce({
      id: "message-1",
      content: "@research_support sanity-check this in thread.",
      threadSessionId: "session-1",
    });

    await service.postBridgeMessage(
      "thread-1",
      "ws-1",
      "@research_support sanity-check this in thread.",
      "targeting_maintenance",
    );

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["execution_optimizer", "research_support"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-1",
        threadSessionId: "session-1",
        content: "@research_support sanity-check this in thread.",
        isFromAgent: true,
      }),
    );
    expect(eventsGateway.emitAgentTyping).toHaveBeenLastCalledWith(
      "thread-1",
      ["agent-manager", "agent-other"],
      true,
    );
  });

  it("routes manager bridge mentions through the shared team thread", async () => {
    const {
      service,
      agentRepo,
      threadRepo,
      teamRepo,
      threadMembershipService,
      messageService,
      eventsGateway,
    } = await buildService();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-1",
      workspaceId: "ws-1",
      type: "team",
      teamId: "team-1",
      maxAgentTurns: null,
    });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      leadAgentId: "agent-manager",
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "agent-manager",
        name: "Execution Optimizer",
        externalId: "execution_optimizer",
        source: "openclaw",
      },
      {
        id: "agent-worker",
        name: "Targeting & Maintenance",
        externalId: "targeting_maintenance",
        source: "openclaw",
      },
      {
        id: "agent-other",
        name: "Research Support",
        externalId: "research_support",
        source: "openclaw",
      },
    ]);
    agentRepo.findOne.mockImplementation(async (input: any) => {
      const where = input?.where;
      if (Array.isArray(where)) {
        const externalId = where[0]?.externalId;
        if (externalId === "execution_optimizer") {
          return {
            id: "agent-manager",
            name: "Execution Optimizer",
            workspaceId: "ws-1",
            externalId,
          };
        }
      }
      return null;
    });
    threadMembershipService.isThreadMember.mockResolvedValue(true);
    messageService.injectMessage.mockResolvedValueOnce({
      id: "message-1",
      content: "@targeting_maintenance proceed.",
      threadSessionId: "session-1",
    });

    await service.postBridgeMessage(
      "thread-1",
      "ws-1",
      "@targeting_maintenance proceed.",
      "execution_optimizer",
    );

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["targeting_maintenance", "research_support"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-1",
        threadSessionId: "session-1",
        content: "@targeting_maintenance proceed.",
        isFromAgent: true,
      }),
    );
    expect(eventsGateway.emitAgentTyping).toHaveBeenLastCalledWith(
      "thread-1",
      ["agent-worker", "agent-other"],
      true,
    );
  });

  it("routes a manager bridge follow-up to naturally named workers for visible discussion", async () => {
    const {
      service,
      agentRepo,
      threadRepo,
      teamRepo,
      messageRepo,
      threadMembershipService,
      messageService,
      eventsGateway,
    } = await buildService();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-1",
      workspaceId: "ws-1",
      type: "team",
      teamId: "team-1",
      maxAgentTurns: null,
    });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      leadAgentId: "agent-manager",
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "agent-manager",
        name: "Oscar Frame",
        externalId: "oscar_frame",
        source: "openclaw",
      },
      {
        id: "agent-worker",
        name: "Story Wells",
        externalId: "story_wells",
        source: "openclaw",
      },
    ]);
    agentRepo.findOne.mockImplementation(async (input: any) => {
      const where = input?.where;
      if (Array.isArray(where)) {
        const externalId = where[0]?.externalId;
        if (externalId === "oscar_frame") {
          return {
            id: "agent-manager",
            name: "Oscar Frame",
            workspaceId: "ws-1",
            externalId,
          };
        }
      }
      return null;
    });
    threadMembershipService.isThreadMember.mockResolvedValue(true);
    messageService.injectMessage.mockResolvedValueOnce({
      id: "message-1",
      content: "I'll inspect the existing docs and bring Story in.",
      threadSessionId: "session-1",
    });
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
            "I want a back-and-forth discussion between Oscar Frame and Story Wells. Oscar, take the lead.",
          isFromUser: true,
          createdAt: new Date(),
        },
      ]),
    });

    await service.postBridgeMessage(
      "thread-1",
      "ws-1",
      "I'll inspect the existing docs and bring Story in.",
      "oscar_frame",
    );

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["story_wells"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-1",
        threadSessionId: "session-1",
        content: "I'll inspect the existing docs and bring Story in.",
        isFromAgent: true,
      }),
    );
    expect(eventsGateway.emitAgentTyping).toHaveBeenLastCalledWith(
      "thread-1",
      ["agent-worker"],
      true,
    );
  });

  it("routes manager bridge messages that name a worker through the shared team thread", async () => {
    const {
      service,
      agentRepo,
      threadRepo,
      teamRepo,
      threadMembershipService,
      messageService,
      eventsGateway,
    } = await buildService();
    threadRepo.findOne.mockResolvedValue({
      id: "thread-1",
      workspaceId: "ws-1",
      type: "team",
      teamId: "team-1",
      maxAgentTurns: null,
    });
    teamRepo.findOne.mockResolvedValue({
      id: "team-1",
      leadAgentId: "agent-manager",
    });
    threadMembershipService.listMemberAgents.mockResolvedValue([
      {
        id: "agent-manager",
        name: "Execution Optimizer",
        externalId: "execution_optimizer",
        source: "openclaw",
      },
      {
        id: "agent-worker",
        name: "Targeting & Maintenance",
        externalId: "targeting_maintenance",
        source: "openclaw",
      },
    ]);
    agentRepo.findOne.mockImplementation(async (input: any) => {
      const where = input?.where;
      if (Array.isArray(where)) {
        const externalId = where[0]?.externalId;
        if (externalId === "execution_optimizer") {
          return {
            id: "agent-manager",
            name: "Execution Optimizer",
            workspaceId: "ws-1",
            externalId,
          };
        }
      }
      return null;
    });
    threadMembershipService.isThreadMember.mockResolvedValue(true);
    messageService.injectMessage.mockResolvedValueOnce({
      id: "message-1",
      content: "Targeting & Maintenance - proceed.",
      threadSessionId: "session-1",
    });

    await service.postBridgeMessage(
      "thread-1",
      "ws-1",
      "Targeting & Maintenance - proceed.",
      "execution_optimizer",
    );

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["targeting_maintenance"],
      "agent.dispatch",
      expect.objectContaining({
        threadId: "thread-1",
        threadSessionId: "session-1",
        content: "Targeting & Maintenance - proceed.",
        isFromAgent: true,
      }),
    );
  });

  it("reports connected when live agent chat is available without saved connection rows", async () => {
    const {
      service,
      connectionRepo,
      bridgeDeviceRepo,
      agentRepo,
      eventsGateway,
    } = await buildService();

    connectionRepo.find.mockResolvedValue([]);
    bridgeDeviceRepo.find.mockResolvedValue([
      {
        id: "device-1",
        workspaceId: "ws-1",
        status: "active",
        revokedAt: null,
      },
    ]);
    agentRepo.find.mockResolvedValue([
      {
        id: "agent-main",
        externalId: "main",
        description: "External ID: main",
      },
    ]);
    eventsGateway.getWorkspaceBridgeRuntime.mockReturnValue({
      connectedBridgeDeviceCount: 1,
      bridgeControlSubscriberCount: 1,
      liveRegisteredAgentCount: 1,
      liveRegisteredExternalAgentIds: ["main"],
    });

    const status = await service.getPublicWorkspaceIntegrationStatus("ws-1");

    expect(status.status).toBe("connected");
    expect(status.isConfigured).toBe(true);
    expect(status.isOnline).toBe(true);
    expect(status.hasLiveAgents).toBe(true);
    expect(status.isChatRoutable).toBe(true);
  });

  it("reports not configured when the workspace has no integration evidence", async () => {
    const { service, connectionRepo, bridgeDeviceRepo, agentRepo } =
      await buildService();

    connectionRepo.find.mockResolvedValue([]);
    bridgeDeviceRepo.find.mockResolvedValue([]);
    agentRepo.find.mockResolvedValue([]);

    const status = await service.getPublicWorkspaceIntegrationStatus("ws-1");

    expect(status.status).toBe("not_configured");
    expect(status.isConfigured).toBe(false);
    expect(status.needsAttention).toBe(false);
  });

  it("reports offline when setup exists but no bridge runtime is online", async () => {
    const { service, connectionRepo, bridgeDeviceRepo, agentRepo } =
      await buildService();

    connectionRepo.find.mockResolvedValue([
      {
        id: "conn-1",
        workspaceId: "ws-1",
      },
    ]);
    bridgeDeviceRepo.find.mockResolvedValue([
      {
        id: "device-1",
        workspaceId: "ws-1",
        status: "active",
        revokedAt: null,
      },
    ]);
    agentRepo.find.mockResolvedValue([
      {
        id: "agent-main",
        externalId: "main",
        description: "External ID: main",
      },
    ]);

    const status = await service.getPublicWorkspaceIntegrationStatus("ws-1");

    expect(status.status).toBe("offline");
    expect(status.isConfigured).toBe(true);
    expect(status.isOnline).toBe(false);
    expect(status.needsAttention).toBe(true);
  });

  it("rejects expired enrollment codes", async () => {
    const { service, bridgeEnrollmentRepo } = await buildService();

    bridgeEnrollmentRepo.findOne.mockResolvedValue({
      id: "enroll-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      codeHash: "hash",
      deviceLabel: "Local Core",
      status: "active",
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
    });

    await expect(
      service.redeemEnrollment("EXPIRED", { pluginVersion: "1.0.0" }),
    ).rejects.toThrow(UnauthorizedException);

    expect(bridgeEnrollmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "expired" }),
    );
  });

  it("prevents reused enrollment codes from being redeemed twice", async () => {
    const {
      service,
      bridgeEnrollmentRepo,
      bridgeDeviceRepo,
      workspaceRepo,
      jwtService,
    } = await buildService();

    const activeEnrollment: any = {
      id: "enroll-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      codeHash: "hash",
      deviceLabel: "Local Core",
      status: "active",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };

    bridgeEnrollmentRepo.findOne.mockImplementation(async () =>
      activeEnrollment.status === "active" ? activeEnrollment : null,
    );
    bridgeEnrollmentRepo.save.mockImplementation(async (input: any) => {
      Object.assign(activeEnrollment, input);
      return input;
    });
    workspaceRepo.findOne.mockResolvedValue({
      id: "ws-1",
      name: "Workspace One",
    });
    bridgeDeviceRepo.save.mockImplementation(async (input: any) => ({
      id: "device-1",
      devicePublicId: "bdev_public",
      status: "active",
      capabilities: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    }));
    jwtService.signAsync.mockResolvedValue("bridge-jwt");

    await service.redeemEnrollment("PAIRME", compatibleHermesMetadata());

    await expect(
      service.redeemEnrollment("PAIRME", compatibleHermesMetadata()),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("does not mint a device when an enrollment code is concurrently consumed", async () => {
    const {
      service,
      bridgeEnrollmentRepo,
      bridgeDeviceRepo,
      workspaceRepo,
      jwtService,
      auditLogService,
    } = await buildService();

    bridgeEnrollmentRepo.findOne.mockResolvedValue({
      id: "enroll-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      codeHash: "hash",
      deviceLabel: "Local Core",
      status: "active",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    workspaceRepo.findOne.mockResolvedValue({
      id: "ws-1",
      name: "Workspace One",
    });
    bridgeEnrollmentRepo.update.mockResolvedValue({ affected: 0 });

    await expect(
      service.redeemEnrollment("PAIRME", compatibleHermesMetadata()),
    ).rejects.toThrow(UnauthorizedException);

    expect(bridgeDeviceRepo.save).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "bridge.enrollment.failed",
        resourceType: "bridge_enrollment",
        resourceId: "enroll-1",
        metadata: { reason: "already_used" },
      }),
    );
  });

  it("revokes an older active pairing when the same runtime host pairs again", async () => {
    const {
      service,
      bridgeEnrollmentRepo,
      bridgeDeviceRepo,
      workspaceRepo,
      eventsGateway,
      auditLogService,
    } = await buildService();

    bridgeEnrollmentRepo.findOne.mockResolvedValue({
      id: "enroll-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      codeHash: "hash",
      deviceLabel: "Office Mac · Hermes Agent bridge",
      hostInstallationId: "relayhost_11111111-1111-4111-8111-111111111111",
      status: "active",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    workspaceRepo.findOne.mockResolvedValue({
      id: "ws-1",
      name: "Workspace One",
    });
    bridgeDeviceRepo.find.mockResolvedValue([
      {
        id: "device-old",
        workspaceId: "ws-1",
        label: "Office Mac · Hermes Agent bridge",
        runtimeType: "hermes",
        hostType: "macos-launchd",
        status: BridgeDeviceStatus.ACTIVE,
        revokedAt: null,
      },
    ]);
    bridgeDeviceRepo.save.mockImplementation(async (input: any) => ({
      id: "device-new",
      devicePublicId: "bdev_public",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    }));

    await service.redeemEnrollment("PAIRME", compatibleHermesMetadata());

    expect(bridgeDeviceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        hostInstallationId:
          "relayhost_11111111-1111-4111-8111-111111111111",
        adapterRole: "runtime",
      }),
    );

    expect(bridgeDeviceRepo.find).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        hostInstallationId:
          "relayhost_11111111-1111-4111-8111-111111111111",
        adapterRole: "runtime",
        runtimeType: "hermes",
        hostType: "macos-launchd",
        status: BridgeDeviceStatus.ACTIVE,
      },
    });
    expect(bridgeDeviceRepo.update).toHaveBeenCalledWith("device-old", {
      status: BridgeDeviceStatus.REVOKED,
      revokedAt: expect.any(Date),
    });
    expect(eventsGateway.disconnectBridgeDevice).toHaveBeenCalledWith(
      "device-old",
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "bridge_device",
        actorId: "device-new",
        workspaceId: "ws-1",
        eventType: "bridge.device.superseded",
        resourceType: "bridge_device",
        resourceId: "device-old",
        metadata: expect.objectContaining({
          replacementDeviceId: "device-new",
          runtimeType: "hermes",
          hostType: "macos-launchd",
        }),
      }),
    );
  });

  it("persists only server-authorized bridge capabilities while redeeming enrollment codes", async () => {
    const {
      service,
      bridgeEnrollmentRepo,
      bridgeDeviceRepo,
      workspaceRepo,
      jwtService,
    } = await buildService();

    bridgeEnrollmentRepo.findOne.mockResolvedValue({
      id: "enroll-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      codeHash: "hash",
      deviceLabel: "Local Core",
      status: "active",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    bridgeEnrollmentRepo.update.mockResolvedValue({ affected: 1 });
    workspaceRepo.findOne.mockResolvedValue({
      id: "ws-1",
      name: "Workspace One",
    });
    bridgeDeviceRepo.save.mockImplementation(async (input: any) => ({
      id: "device-1",
      devicePublicId: "bdev_public",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    }));
    jwtService.signAsync.mockResolvedValue("bridge-jwt");

    await service.redeemEnrollment(
      "PAIRME",
      compatibleHermesMetadata({
        capabilities: [
          " clawchat.runtime.hermes ",
          "",
          "clawchat.runtime.hermes",
          "localAppRuntimeRecovery",
          "unapproved.local.file_delete",
        ] as any,
      }),
    );

    expect(bridgeEnrollmentRepo.update).toHaveBeenCalledWith(
      { id: "enroll-1", status: "active" },
      expect.objectContaining({
        status: "used",
        usedAt: expect.any(Date),
      }),
    );
    expect(bridgeDeviceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilities: ["clawchat.runtime.hermes", "localAppRuntimeRecovery"],
      }),
    );
  });

  it("persists only server-authorized bridge capabilities during device auth", async () => {
    const { service, bridgeDeviceRepo, jwtService } = await buildService();

    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      label: "Local Core",
      devicePublicId: "bdev_public",
      credentialHash: hashOpaqueSecret("device-token"),
      status: "active",
      capabilities: ["localAppRuntimeRecovery"],
      pluginVersion: "0.3.0-rc.2",
      openCoreVersion: "v2026.7.7.2",
      runtimeType: "hermes",
      hostType: "macos-launchd",
      credentialVersion: 1,
      lastSeenAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    jwtService.signAsync.mockResolvedValue("bridge-jwt");

    const result = await service.authenticateDevice(
      "bdev_public",
      "device-token",
      compatibleHermesMetadata({
        capabilities: [
          " clawchat.runtime.hermes ",
          "unapproved.local.file_delete",
          "marketplaceLocalRepoDocsRead",
          "clawchat.runtime.hermes",
        ],
      }),
    );

    expect(result.credentials).toEqual({
      devicePublicId: "bdev_public",
      deviceToken: expect.any(String),
    });
    expect(result.credentials.deviceToken).not.toBe("device-token");
    expect(bridgeDeviceRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "device-1",
        credentialHash: hashOpaqueSecret("device-token"),
        status: BridgeDeviceStatus.ACTIVE,
      }),
      expect.objectContaining({
        pluginVersion: "0.3.0-rc.2",
        capabilities: [
          "clawchat.runtime.hermes",
          "marketplaceLocalRepoDocsRead",
        ],
      }),
    );
  });

  it("prevents a paired device from changing runtime or host identity during authentication", async () => {
    const { service, bridgeDeviceRepo, jwtService } = await buildService();

    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      label: "Hermes host",
      devicePublicId: "bdev_public",
      credentialHash: hashOpaqueSecret("device-token"),
      status: "active",
      capabilities: ["clawchat.runtime.hermes", "clawchat.relay_host.v1"],
      hostInstallationId: "relayhost_11111111-1111-4111-8111-111111111111",
      adapterRole: "host",
      pluginVersion: "0.3.0-rc.2",
      openCoreVersion: "v2026.7.7.2",
      runtimeType: "hermes",
      hostType: "macos-launchd",
      credentialVersion: 1,
      lastSeenAt: null,
      revokedAt: null,
    });

    await expect(
      service.authenticateDevice(
        "bdev_public",
        "device-token",
        compatibleOpenClawMetadata(),
      ),
    ).rejects.toThrow(
      "Bridge runtime or host identity cannot change after enrollment",
    );
    expect(bridgeDeviceRepo.update).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it("preflights missing runtime metadata in restricted safe mode", async () => {
    const { service } = await buildService();

    expect(
      service.checkCompatibility({
        ...compatibleHermesMetadata({
          capabilities: [
            "clawchat.runtime.hermes",
            "clawchat.runtime.structured_jobs",
          ],
        }),
        openCoreVersion: undefined,
      }),
    ).toMatchObject({
      compatible: true,
      level: "compatible",
      operatingMode: "safe",
      enabledCapabilities: ["clawchat.runtime.hermes"],
      disabledCapabilities: ["clawchat.runtime.structured_jobs"],
      warnings: expect.arrayContaining(["BRIDGE_RUNTIME_VERSION_UNKNOWN"]),
    });
  });

  it("refuses pre-v2 clients before consuming their device credential", async () => {
    const { service, bridgeDeviceRepo, jwtService } = await buildService();
    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      workspaceId: "ws-1",
      devicePublicId: "bdev_public",
      credentialHash: hashOpaqueSecret("device-token"),
      status: BridgeDeviceStatus.ACTIVE,
      capabilities: [],
      pluginVersion: "0.3.0-rc.2",
      openCoreVersion: "v2026.7.7.2",
      runtimeType: "hermes",
      hostType: "macos-launchd",
      credentialVersion: 1,
      revokedAt: null,
    });

    await expect(
      service.authenticateDevice("bdev_public", "device-token", {
        ...compatibleHermesMetadata(),
        capabilities: ["clawchat.runtime.hermes"],
      }),
    ).rejects.toMatchObject({
      status: 426,
      response: expect.objectContaining({
        code: "BRIDGE_ROTATING_CREDENTIALS_REQUIRED",
      }),
    });
    expect(bridgeDeviceRepo.update).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it("rotates a device credential atomically and invalidates the previous token generation", async () => {
    const {
      service,
      bridgeDeviceRepo,
      jwtService,
      eventsGateway,
      auditLogService,
    } = await buildService();
    const device = {
      id: "device-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      label: "Office Mac",
      devicePublicId: "bdev_public",
      credentialHash: hashOpaqueSecret("old-device-token"),
      status: "active",
      capabilities: ["clawchat.runtime.hermes", "clawchat.relay_host.v1"],
      hostInstallationId: "relayhost_11111111-1111-4111-8111-111111111111",
      adapterRole: "host",
      pluginVersion: "0.3.0-rc.2",
      openCoreVersion: "v2026.7.7.2",
      runtimeType: "hermes",
      hostType: "macos-launchd",
      credentialVersion: 1,
      credentialRotatedAt: null,
      lastSeenAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    bridgeDeviceRepo.findOne.mockResolvedValue(device);
    bridgeDeviceRepo.update.mockResolvedValue({ affected: 1 });
    jwtService.signAsync.mockResolvedValue("rotated-jwt");

    const result = await service.rotateDeviceCredential(
      "bdev_public",
      "old-device-token",
      compatibleHermesMetadata({
        capabilities: ["clawchat.runtime.hermes"],
      }),
    );

    expect(result.credentials.deviceToken).toEqual(expect.any(String));
    expect(result.credentials.deviceToken).not.toBe("old-device-token");
    expect(bridgeDeviceRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "device-1",
        credentialHash: hashOpaqueSecret("old-device-token"),
        status: BridgeDeviceStatus.ACTIVE,
      }),
      expect.objectContaining({
        credentialHash: hashOpaqueSecret(result.credentials.deviceToken),
        previousCredentialHash: hashOpaqueSecret("old-device-token"),
        previousCredentialVersion: 1,
        previousCredentialConsumedAt: expect.any(Date),
        credentialVersion: expect.any(Function),
        credentialRotatedAt: expect.any(Date),
      }),
    );
    expect(eventsGateway.disconnectBridgeDevice).toHaveBeenCalledWith(
      "device-1",
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        cv: 2,
        tokenUse: "bridge_access",
      }),
      expect.objectContaining({
        secret: "jwt-secret",
        expiresIn: 900,
        issuer: BRIDGE_TOKEN_ISSUER,
        audience: "relay-bridge-api",
        algorithm: "HS256",
        jwtid: expect.any(String),
      }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        cv: 2,
        tokenUse: "bridge_websocket",
      }),
      expect.objectContaining({
        secret: "ws-secret",
        expiresIn: 300,
        issuer: BRIDGE_TOKEN_ISSUER,
        audience: "relay-bridge-websocket",
        algorithm: "HS256",
        jwtid: expect.any(String),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "bridge.device.credential_rotated",
        metadata: {
          devicePublicId: "bdev_public",
          credentialVersion: 2,
        },
      }),
    );
    expect(JSON.stringify(auditLogService.record.mock.calls)).not.toContain(
      result.credentials.deviceToken,
    );
  });

  it("revokes the credential family when a consumed device credential is replayed", async () => {
    const { service, bridgeDeviceRepo, eventsGateway, auditLogService } =
      await buildService();
    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      label: "Office Mac",
      devicePublicId: "bdev_public",
      credentialHash: hashOpaqueSecret("current-device-token"),
      previousCredentialHash: hashOpaqueSecret("consumed-device-token"),
      previousCredentialVersion: 1,
      previousCredentialConsumedAt: new Date(),
      status: BridgeDeviceStatus.ACTIVE,
      capabilities: ["clawchat.runtime.hermes"],
      pluginVersion: "0.3.0-rc.2",
      openCoreVersion: "v2026.7.7.2",
      runtimeType: "hermes",
      hostType: "macos-launchd",
      credentialVersion: 2,
      revokedAt: null,
    });

    await expect(
      service.authenticateDevice(
        "bdev_public",
        "consumed-device-token",
        compatibleHermesMetadata(),
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(bridgeDeviceRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "device-1",
        status: BridgeDeviceStatus.ACTIVE,
      }),
      expect.objectContaining({
        status: BridgeDeviceStatus.REVOKED,
        revokedAt: expect.any(Date),
      }),
    );
    expect(eventsGateway.disconnectBridgeDevice).toHaveBeenCalledWith(
      "device-1",
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "bridge.device.credential_replay_detected",
        metadata: { devicePublicId: "bdev_public" },
      }),
    );
  });

  it("revokes the credential family when concurrent refresh loses the atomic claim", async () => {
    const { service, bridgeDeviceRepo, eventsGateway, auditLogService } =
      await buildService();
    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      workspaceId: "ws-1",
      devicePublicId: "bdev_public",
      credentialHash: hashOpaqueSecret("current-device-token"),
      previousCredentialHash: null,
      status: BridgeDeviceStatus.ACTIVE,
      capabilities: ["clawchat.runtime.hermes"],
      pluginVersion: "0.3.0-rc.2",
      openCoreVersion: "v2026.7.7.2",
      runtimeType: "hermes",
      hostType: "macos-launchd",
      credentialVersion: 1,
      revokedAt: null,
    });
    bridgeDeviceRepo.update
      .mockResolvedValueOnce({ affected: 0 })
      .mockResolvedValueOnce({ affected: 1 });

    await expect(
      service.authenticateDevice(
        "bdev_public",
        "current-device-token",
        compatibleHermesMetadata(),
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(bridgeDeviceRepo.update).toHaveBeenCalledTimes(2);
    expect(eventsGateway.disconnectBridgeDevice).toHaveBeenCalledWith(
      "device-1",
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "bridge.device.credential_replay_detected",
      }),
    );
  });

  it("rejects a random device credential without treating an absent replay marker as a server error", async () => {
    const { service, bridgeDeviceRepo } = await buildService();
    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      workspaceId: "ws-1",
      devicePublicId: "bdev_public",
      credentialHash: hashOpaqueSecret("current-device-token"),
      previousCredentialHash: null,
      status: BridgeDeviceStatus.ACTIVE,
      revokedAt: null,
    });

    await expect(
      service.authenticateDevice(
        "bdev_public",
        "random-device-token",
        compatibleHermesMetadata(),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("revokes a bridge device and disconnects its established socket", async () => {
    const { service, bridgeDeviceRepo, eventsGateway, auditLogService } =
      await buildService();
    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      workspaceId: "ws-1",
      devicePublicId: "bdev_public",
      label: "Office Mac",
      status: BridgeDeviceStatus.ACTIVE,
      revokedAt: null,
    });
    bridgeDeviceRepo.update.mockResolvedValue({ affected: 1 });

    await service.revokeBridgeDevice("device-1", "user-1", {
      ipAddress: "203.0.113.10",
      userAgent: "Relay Console",
    });

    expect(bridgeDeviceRepo.update).toHaveBeenCalledWith("device-1", {
      status: BridgeDeviceStatus.REVOKED,
      revokedAt: expect.any(Date),
    });
    expect(eventsGateway.disconnectBridgeDevice).toHaveBeenCalledWith(
      "device-1",
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "user",
        actorId: "user-1",
        workspaceId: "ws-1",
        eventType: "bridge.device.revoked",
        resourceType: "bridge_device",
        resourceId: "device-1",
        ipAddress: "203.0.113.10",
        userAgent: "Relay Console",
        metadata: {
          devicePublicId: "bdev_public",
          label: "Office Mac",
        },
      }),
    );
  });

  it("returns only authorized workspace devices with live health and compatibility", async () => {
    const { service, bridgeDeviceRepo, eventsGateway } = await buildService();
    const base = {
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      devicePublicId: "bdev_public",
      status: "active",
      capabilities: ["clawchat.runtime.hermes", "clawchat.relay_host.v1"],
      hostInstallationId: "relayhost_11111111-1111-4111-8111-111111111111",
      adapterRole: "host",
      pluginVersion: "0.3.0-rc.2",
      openCoreVersion: "v2026.7.7.2",
      runtimeType: "hermes",
      hostType: "macos-launchd",
      credentialVersion: 2,
      credentialRotatedAt: new Date("2026-07-14T12:00:00.000Z"),
      lastSeenAt: new Date("2026-07-14T12:05:00.000Z"),
      revokedAt: null,
      createdAt: new Date("2026-07-14T11:00:00.000Z"),
      updatedAt: new Date("2026-07-14T12:05:00.000Z"),
    };
    const storedDevices = [
      { ...base, id: "device-online", label: "Office Mac" },
      {
        ...base,
        id: "device-revoked",
        label: "Old Mac",
        status: "revoked",
        revokedAt: new Date("2026-07-14T12:10:00.000Z"),
      },
    ];
    bridgeDeviceRepo.find.mockImplementation(({ where }) =>
      Promise.resolve(
        storedDevices.filter(
          (device) => !where.status || device.status === where.status,
        ),
      ),
    );
    eventsGateway.getConnectedBridgeDeviceIds.mockReturnValue(
      new Set(["device-online"]),
    );

    await expect(service.listBridgeDevices("ws-1")).resolves.toEqual([
      expect.objectContaining({
        id: "device-online",
        label: "Office Mac",
        health: "online",
        runtimeType: "hermes",
        hostType: "macos-launchd",
        hostInstallationId: "relayhost_11111111-1111-4111-8111-111111111111",
        hostDisplayName: "Office Mac",
        adapterRole: "host",
        pluginVersion: "0.3.0-rc.2",
        openCoreVersion: "v2026.7.7.2",
        credentialVersion: 2,
        compatibility: expect.objectContaining({
          compatible: true,
          code: null,
        }),
      }),
    ]);
    expect(bridgeDeviceRepo.find).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", status: BridgeDeviceStatus.ACTIVE },
      order: { updatedAt: "DESC" },
    });
  });

  it("offers only active capable bridge devices as marketplace source hosts", async () => {
    const { service, bridgeDeviceRepo, eventsGateway } = await buildService();
    const capable = {
      workspaceId: "ws-1",
      status: BridgeDeviceStatus.ACTIVE,
      revokedAt: null,
      capabilities: ["clawchat.runtime.hermes", "marketplaceLocalRepoDocsRead"],
    };
    bridgeDeviceRepo.find.mockResolvedValue([
      { ...capable, id: "device-online", label: "Online Hermes" },
      { ...capable, id: "device-offline", label: "Offline Hermes" },
      {
        ...capable,
        id: "device-revoked",
        status: BridgeDeviceStatus.REVOKED,
        revokedAt: new Date(),
      },
      {
        ...capable,
        id: "device-incapable",
        capabilities: ["clawchat.runtime.hermes"],
      },
    ]);
    eventsGateway.getConnectedBridgeDeviceIds.mockReturnValue(
      new Set(["device-online", "device-revoked", "device-incapable"]),
    );

    await expect(
      service.listMarketplaceLocalRepoSourceHosts("ws-1"),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "device-online",
        status: "available",
        supportsLocalRepoDocsRead: true,
      }),
      expect.objectContaining({
        id: "device-offline",
        status: "offline",
        supportsLocalRepoDocsRead: true,
      }),
    ]);
  });

  it("rejects access tokens from a previous credential generation", async () => {
    const { service, bridgeDeviceRepo, jwtService } = await buildService();
    jwtService.verifyAsync.mockResolvedValue(bridgeAccessClaims({ cv: 1 }));
    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      devicePublicId: "bdev_public",
      workspaceId: "ws-1",
      runtimeType: "hermes",
      status: "active",
      revokedAt: null,
      credentialVersion: 2,
    });

    await expect(
      service.authenticateBridgeAccessToken("Bearer previous-generation"),
    ).rejects.toThrow("Bridge device credential was rotated");
  });

  it("rejects websocket-family tokens at the bridge HTTP boundary", async () => {
    const { service, bridgeDeviceRepo, jwtService } = await buildService();
    jwtService.verifyAsync.mockResolvedValue(
      bridgeAccessClaims({ tokenUse: "bridge_websocket" }),
    );

    await expect(
      service.authenticateBridgeAccessToken("Bearer websocket-token"),
    ).rejects.toThrow(UnauthorizedException);
    expect(bridgeDeviceRepo.findOne).not.toHaveBeenCalled();
    expect(jwtService.verifyAsync).toHaveBeenCalledWith("websocket-token", {
      secret: "jwt-secret",
      issuer: BRIDGE_TOKEN_ISSUER,
      audience: "relay-bridge-api",
      algorithms: ["HS256"],
    });
  });

  it("rejects a bridge HTTP token with a multi-valued audience claim", async () => {
    const { service, bridgeDeviceRepo, jwtService } = await buildService();
    jwtService.verifyAsync.mockResolvedValue(
      bridgeAccessClaims({ aud: ["relay-bridge-api"] }),
    );

    await expect(
      service.authenticateBridgeAccessToken("Bearer array-audience"),
    ).rejects.toThrow(UnauthorizedException);
    expect(bridgeDeviceRepo.findOne).not.toHaveBeenCalled();
  });

  it("rejects access tokens whose signed device or workspace scope differs from storage", async () => {
    const { service, bridgeDeviceRepo, jwtService } = await buildService();
    jwtService.verifyAsync.mockResolvedValue(
      bridgeAccessClaims({ dpid: "bdev_attacker", workspaceId: "ws-2" }),
    );
    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      devicePublicId: "bdev_public",
      workspaceId: "ws-1",
      runtimeType: "hermes",
      status: "active",
      revokedAt: null,
      credentialVersion: 1,
    });

    await expect(
      service.authenticateBridgeAccessToken("Bearer wrong-scope"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("audits revoked bridge device authentication attempts", async () => {
    const { service, bridgeDeviceRepo, auditLogService } = await buildService();

    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      label: "Local Core",
      devicePublicId: "bdev_public",
      credentialHash: hashOpaqueSecret("device-token"),
      status: "revoked",
      capabilities: [],
      pluginVersion: "1.0.0",
      openCoreVersion: null,
      lastSeenAt: null,
      revokedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.authenticateDevice("bdev_public", "device-token"),
    ).rejects.toThrow(UnauthorizedException);

    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "bridge_device",
        actorId: "device-1",
        workspaceId: "ws-1",
        eventType: "bridge.device.auth.failed",
        resourceType: "bridge_device",
        resourceId: "device-1",
        metadata: {
          reason: "revoked",
          devicePublicId: "bdev_public",
        },
      }),
    );
  });

  it("rejects revoked bridge devices on reconnect", async () => {
    const { service, bridgeDeviceRepo, jwtService } = await buildService();

    jwtService.verifyAsync.mockResolvedValue(bridgeAccessClaims());
    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      devicePublicId: "bdev_public",
      workspaceId: "ws-1",
      status: "revoked",
      revokedAt: new Date(),
    });

    await expect(
      service.authenticateBridgeAccessToken("Bearer reconnect-token"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("accepts recently expired bridge access tokens for active devices", async () => {
    const { service, bridgeDeviceRepo, jwtService } = await buildService();
    const expiredError = new Error("jwt expired");
    expiredError.name = "TokenExpiredError";
    const expiredPayload = bridgeAccessClaims({
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    jwtService.verifyAsync
      .mockRejectedValueOnce(expiredError)
      .mockResolvedValueOnce(expiredPayload);
    bridgeDeviceRepo.findOne.mockResolvedValue({
      id: "device-1",
      devicePublicId: "bdev_public",
      workspaceId: "ws-1",
      runtimeType: "hermes",
      status: "active",
      revokedAt: null,
      credentialVersion: 1,
    });

    await expect(
      service.authenticateBridgeAccessToken("Bearer expired-token"),
    ).resolves.toEqual({
      deviceId: "device-1",
      devicePublicId: "bdev_public",
      workspaceId: "ws-1",
      runtimeType: "hermes",
    });
    expect(jwtService.verifyAsync).toHaveBeenNthCalledWith(1, "expired-token", {
      secret: "jwt-secret",
      issuer: BRIDGE_TOKEN_ISSUER,
      audience: "relay-bridge-api",
      algorithms: ["HS256"],
    });
    expect(jwtService.verifyAsync).toHaveBeenNthCalledWith(
      2,
      "expired-token",
      expect.objectContaining({
        secret: "jwt-secret",
        issuer: BRIDGE_TOKEN_ISSUER,
        audience: "relay-bridge-api",
        algorithms: ["HS256"],
        ignoreExpiration: true,
      }),
    );
  });

  it("rejects bridge access tokens expired beyond the configured grace window", async () => {
    const { service, jwtService } = await buildService();
    const expiredError = new Error("jwt expired");
    expiredError.name = "TokenExpiredError";

    jwtService.verifyAsync
      .mockRejectedValueOnce(expiredError)
      .mockResolvedValueOnce(
        bridgeAccessClaims({
          exp: Math.floor(Date.now() / 1000) - 121,
        }),
      );

    await expect(
      service.authenticateBridgeAccessToken("Bearer very-expired-token"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("blocks bridge devices from operating across workspaces", async () => {
    const { service, threadRepo } = await buildService();

    threadRepo.findOne.mockResolvedValue({
      id: "thread-1",
      workspaceId: "ws-2",
    });

    await expect(
      service.assertThreadInWorkspace("thread-1", "ws-1"),
    ).rejects.toThrow(ForbiddenException);
  });
});
