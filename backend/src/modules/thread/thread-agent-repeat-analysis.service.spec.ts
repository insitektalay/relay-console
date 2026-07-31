import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ThreadAgentRepeatAnalysisService } from "./thread-agent-repeat-analysis.service";
import { ClaudeCliService } from "../claude/claude-cli.service";

describe("ThreadAgentRepeatAnalysisService", () => {
  async function buildService() {
    const claudeCliService = {
      runStructuredPrompt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreadAgentRepeatAnalysisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case "CLAUDE_CODE_ANALYTICS_TIMEOUT_MS":
                  return "180000";
                case "CLAUDE_CODE_ANALYTICS_MAX_TURNS":
                  return "8";
                case "CLAUDE_CODE_ANALYTICS_SOFT_TIMEOUT_MS":
                  return "4000";
                default:
                  return null;
              }
            }),
          },
        },
        { provide: ClaudeCliService, useValue: claudeCliService },
      ],
    }).compile();

    return {
      service: module.get(ThreadAgentRepeatAnalysisService),
      claudeCliService,
    };
  }

  it("materializes semantic repeat groups from Claude CLI message IDs", async () => {
    const { service, claudeCliService } = await buildService();
    claudeCliService.runStructuredPrompt.mockResolvedValue({
      output: {
        groups: [
          {
            messageIds: ["m2", "m1", "m3"],
          },
        ],
      },
      model: "claude-test",
    });

    const result = await service.analyze({
      thread: {
        id: "thread-1",
        title: "PageJourney Guys",
        type: "team",
        workspaceId: "ws-1",
      } as any,
      sessions: [
        {
          threadSessionId: "session-1",
          sequenceNumber: 1,
          status: "active",
          firstMessageAt: "2026-04-16T10:00:00.000Z",
          lastMessageAt: "2026-04-16T10:04:00.000Z",
          agentMessageCount: 4,
          messages: [
            {
              id: "m1",
              createdAt: "2026-04-16T10:00:00.000Z",
              senderId: "agent-1",
              senderName: "Elliot",
              content: "I already checked the bundle.",
            },
            {
              id: "m2",
              createdAt: "2026-04-16T10:01:00.000Z",
              senderId: "agent-2",
              senderName: "Page",
              content: "I've already checked that bundle.",
            },
            {
              id: "m3",
              createdAt: "2026-04-16T10:04:00.000Z",
              senderId: "agent-1",
              senderName: "Elliot",
              content: "That bundle is already checked on my side.",
            },
            {
              id: "m4",
              createdAt: "2026-04-16T10:05:00.000Z",
              senderId: "agent-1",
              senderName: "Elliot",
              content: "Now I'm comparing the diff.",
            },
          ],
        },
      ],
    });

    expect(claudeCliService.runStructuredPrompt).toHaveBeenCalledTimes(1);
    expect(result.get("session-1")).toEqual({
      status: "ready",
      errorMessage: null,
      repeatedAgentMessageCount: 2,
      repeatedCrossAgentMessageCount: 2,
      agentRepeatGroupCount: 1,
      repeatedAgentMessageGroups: [
        {
          representativeMessage: "I already checked the bundle.",
          occurrenceCount: 3,
          repeatedCount: 2,
          senderCount: 2,
          senderNames: ["Elliot", "Page"],
          firstMessageAt: "2026-04-16T10:00:00.000Z",
          lastMessageAt: "2026-04-16T10:04:00.000Z",
        },
      ],
    });
  });

  it("returns explicit failed analyses when Claude CLI fails", async () => {
    const { service, claudeCliService } = await buildService();
    claudeCliService.runStructuredPrompt.mockRejectedValue(new Error("bridge offline"));

    const result = await service.analyze({
      thread: {
        id: "thread-1",
        title: "PageJourney Guys",
        type: "team",
        workspaceId: "ws-1",
      } as any,
      sessions: [
        {
          threadSessionId: "session-1",
          sequenceNumber: 1,
          status: "active",
          firstMessageAt: "2026-04-16T10:00:00.000Z",
          lastMessageAt: "2026-04-16T10:00:00.000Z",
          agentMessageCount: 1,
          messages: [
            {
              id: "m1",
              createdAt: "2026-04-16T10:00:00.000Z",
              senderId: "agent-1",
              senderName: "Elliot",
              content: "Checking now.",
            },
          ],
        },
      ],
    });

    expect(result.get("session-1")).toEqual({
      status: "failed",
      errorMessage: "Claude CLI agent repeat analysis failed: bridge offline",
      repeatedAgentMessageCount: 0,
      repeatedCrossAgentMessageCount: 0,
      agentRepeatGroupCount: 0,
      repeatedAgentMessageGroups: [],
    });
  });

  it("fails only the affected session when one Claude CLI call errors", async () => {
    const { service, claudeCliService } = await buildService();
    claudeCliService.runStructuredPrompt
      .mockResolvedValueOnce({
        output: {
          groups: [
            {
              messageIds: ["m1", "m2"],
            },
          ],
        },
        model: "claude-test",
      })
      .mockRejectedValueOnce(new Error("bridge offline"));

    const result = await service.analyze({
      thread: {
        id: "thread-1",
        title: "PageJourney Guys",
        type: "team",
        workspaceId: "ws-1",
      } as any,
      sessions: [
        {
          threadSessionId: "session-1",
          sequenceNumber: 2,
          status: "active",
          firstMessageAt: "2026-04-16T10:00:00.000Z",
          lastMessageAt: "2026-04-16T10:01:00.000Z",
          agentMessageCount: 2,
          messages: [
            {
              id: "m1",
              createdAt: "2026-04-16T10:00:00.000Z",
              senderId: "agent-1",
              senderName: "Elliot",
              content: "I already checked the bundle.",
            },
            {
              id: "m2",
              createdAt: "2026-04-16T10:01:00.000Z",
              senderId: "agent-2",
              senderName: "Nathan",
              content: "I've already checked that bundle.",
            },
          ],
        },
        {
          threadSessionId: "session-2",
          sequenceNumber: 1,
          status: "wrapped_up",
          firstMessageAt: "2026-04-16T09:00:00.000Z",
          lastMessageAt: "2026-04-16T09:00:00.000Z",
          agentMessageCount: 1,
          messages: [
            {
              id: "m3",
              createdAt: "2026-04-16T09:00:00.000Z",
              senderId: "agent-1",
              senderName: "Elliot",
              content: "Checking now.",
            },
          ],
        },
      ],
    });

    expect(claudeCliService.runStructuredPrompt).toHaveBeenCalledTimes(2);
    expect(result.get("session-1")?.status).toBe("ready");
    expect(result.get("session-2")).toEqual({
      status: "failed",
      errorMessage: "Claude CLI agent repeat analysis failed: bridge offline",
      repeatedAgentMessageCount: 0,
      repeatedCrossAgentMessageCount: 0,
      agentRepeatGroupCount: 0,
      repeatedAgentMessageGroups: [],
    });
  });
});
