import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Test, TestingModule } from "@nestjs/testing";
import {
  AgentEntity,
  RuntimeBindingEntity,
  RuntimeStructuredJobEntity,
} from "../../entities";
import { EventsGateway } from "../../gateways/events.gateway";
import {
  RUNTIME_STRUCTURED_JOB_CAPABILITY,
  RuntimeStructuredJobService,
} from "./runtime-structured-job.service";

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn().mockImplementation(async (input) => ({
      id: input.id ?? "job-1",
      ...input,
    })),
    update: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((input) => ({ ...input })),
    ...overrides,
  };
}

describe("RuntimeStructuredJobService", () => {
  async function buildService() {
    const jobRepo = makeRepoMock({
      findOne: jest.fn().mockResolvedValue({
        id: "job-1",
        workspaceId: "ws-1",
        status: "running",
      }),
    });
    const agentRepo = makeRepoMock({
      find: jest.fn().mockResolvedValue([
        {
          id: "agent-1",
          workspaceId: "ws-1",
          externalId: "agent-one",
          source: "openclaw",
        },
      ]),
    });
    const runtimeBindingRepo = makeRepoMock({
      find: jest.fn().mockResolvedValue([
        {
          id: "binding-1",
          workspaceId: "ws-1",
          agentId: "agent-1",
          runtimeType: "openclaw",
          isEnabled: true,
          capabilities: {
            [RUNTIME_STRUCTURED_JOB_CAPABILITY]: true,
          },
        },
      ]),
    });
    const eventsGateway = {
      getWorkspaceBridgeRuntime: jest.fn().mockReturnValue({
        liveRegisteredExternalAgentIds: ["agent-one"],
      }),
      getWorkspaceHermesBridgeRuntime: jest.fn().mockReturnValue({
        liveRegisteredExternalAgentIds: [],
      }),
      emitToBridgeAgents: jest.fn(),
      emitToHermesBridgeWorkspace: jest.fn(),
    };
    const configService = {
      get: jest.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuntimeStructuredJobService,
        {
          provide: getRepositoryToken(RuntimeStructuredJobEntity),
          useValue: jobRepo,
        },
        { provide: getRepositoryToken(AgentEntity), useValue: agentRepo },
        {
          provide: getRepositoryToken(RuntimeBindingEntity),
          useValue: runtimeBindingRepo,
        },
        { provide: EventsGateway, useValue: eventsGateway },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    return {
      service: module.get(RuntimeStructuredJobService),
      jobRepo,
      eventsGateway,
    };
  }

  it("dispatches a hidden OpenClaw structured job and resolves the result", async () => {
    const { service, eventsGateway, jobRepo } = await buildService();

    const pending = service.runStructuredJob<{
      text: string;
      lineCountHint: 1;
    }>({
      workspaceId: "ws-1",
      jobType: "condensed_team_chat_message",
      prompt: "Summarize this message",
      schemaName: "condensed_team_chat_message_v1",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["text", "lineCountHint"],
        properties: {
          text: { type: "string" },
          lineCountHint: { type: "integer", enum: [1, 2] },
        },
      },
      metadata: {
        threadId: "thread-1",
        messageId: "message-1",
      },
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(eventsGateway.emitToBridgeAgents).toHaveBeenCalledWith(
      "ws-1",
      ["agent-one"],
      "agent.structured_job",
      expect.objectContaining({
        jobId: "job-1",
        jobType: "condensed_team_chat_message",
        externalAgentId: "agent-one",
      }),
    );

    await service.completeJob({
      jobId: "job-1",
      workspaceId: "ws-1",
      output: {
        text: "Implemented the change.",
        lineCountHint: 1,
      },
      model: "gpt-5.5",
    });

    await expect(pending).resolves.toEqual(
      expect.objectContaining({
        output: {
          text: "Implemented the change.",
          lineCountHint: 1,
        },
        model: "gpt-5.5",
        runtimeType: "openclaw",
      }),
    );
    expect(jobRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        output: {
          text: "Implemented the change.",
          lineCountHint: 1,
        },
      }),
    );
  });
});
