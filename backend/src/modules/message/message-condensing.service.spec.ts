import { getQueueToken } from "@nestjs/bull";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { EventsGateway } from "../../gateways/events.gateway";
import { MessageEntity, MessageProvenance, ThreadEntity } from "../../entities";
import { MessageCondensingService } from "./message-condensing.service";
import { MessageStructuredSummaryService } from "./message-structured-summary.service";
import {
  CONDENSED_MESSAGE_PROVIDER,
  MESSAGE_CONDENSING_QUEUE,
  getCondensedMessageMetadata,
} from "./message-condensed.types";

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn(),
    save: jest.fn().mockImplementation(async (input) => ({
      updatedAt: new Date("2026-04-22T12:00:00.000Z"),
      ...input,
    })),
    ...overrides,
  };
}

describe("MessageCondensingService", () => {
  async function buildService() {
    const messageRepo = makeRepoMock();
    const queue = {
      add: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case "CONDENSED_TEAM_CHAT_SUMMARIZATION_ENABLED":
            return "true";
          case "CONDENSED_TEAM_CHAT_REALTIME_ENABLED":
            return "true";
          default:
            return null;
        }
      }),
    };
    const eventsGateway = {
      emitToScopes: jest.fn(),
    };
    const messageStructuredSummaryService = {
      hashContent: jest.fn((content: string) => `hash:${content}`),
      condenseMessage: jest.fn().mockResolvedValue({
        text: "Implemented the requested changes.",
        lineCountHint: 1,
        generatedAt: "2026-04-22T12:00:00.000Z",
        provider: CONDENSED_MESSAGE_PROVIDER,
        sourceContentHash: "hash:Full agent response",
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageCondensingService,
        { provide: getRepositoryToken(MessageEntity), useValue: messageRepo },
        {
          provide: getQueueToken(MESSAGE_CONDENSING_QUEUE),
          useValue: queue,
        },
        { provide: ConfigService, useValue: configService },
        { provide: EventsGateway, useValue: eventsGateway },
        {
          provide: MessageStructuredSummaryService,
          useValue: messageStructuredSummaryService,
        },
      ],
    }).compile();

    return {
      service: module.get(MessageCondensingService),
      messageRepo,
      queue,
      eventsGateway,
      messageStructuredSummaryService,
    };
  }

  it("enqueues only eligible team agent messages", async () => {
    const { service, queue } = await buildService();

    await service.maybeEnqueueSummary(
      {
        id: "thread-1",
        workspaceId: "ws-1",
        title: "Team Thread",
        type: "team",
      } as ThreadEntity,
      {
        id: "message-1",
        threadId: "thread-1",
        content: "Full agent response",
        provenance: MessageProvenance.AGENT,
        isFromUser: false,
        metadata: null,
      } as MessageEntity,
    );

    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        messageId: "message-1",
        threadId: "thread-1",
        workspaceId: "ws-1",
        threadTitle: "Team Thread",
        sourceContentHash: "hash:Full agent response",
      }),
      expect.objectContaining({
        attempts: 3,
      }),
    );
  });

  it("writes condensed metadata and emits realtime updates", async () => {
    const { service, messageRepo, eventsGateway } = await buildService();

    messageRepo.findOne.mockResolvedValue({
      id: "message-1",
      threadId: "thread-1",
      senderName: "Atlas",
      content: "Full agent response",
      metadata: { runtimeDispatchId: "dispatch-1" },
    });

    await service.processQueuedMessage(
      {
        messageId: "message-1",
        threadId: "thread-1",
        workspaceId: "ws-1",
        threadTitle: "Team Thread",
        sourceContentHash: "hash:Full agent response",
      },
      0,
    );

    expect(
      getCondensedMessageMetadata(messageRepo.save.mock.calls[0][0].metadata),
    ).toEqual(
      expect.objectContaining({
        text: "Implemented the requested changes.",
        provider: CONDENSED_MESSAGE_PROVIDER,
      }),
    );
    expect(eventsGateway.emitToScopes).toHaveBeenCalledWith(
      {
        workspaceId: "ws-1",
        threadId: "thread-1",
      },
      "message.condensed",
      expect.objectContaining({
        messageId: "message-1",
        threadId: "thread-1",
        condensed: expect.objectContaining({
          text: "Implemented the requested changes.",
        }),
      }),
    );
  });
});
