import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ThreadEntity } from "../../entities/thread.entity";
import { ClaudeCliService } from "../claude/claude-cli.service";

type AgentSessionMessageEntry = {
  id: string;
  createdAt: string;
  senderId: string | null;
  senderName: string;
  content: string;
};

type AgentSessionAnalysisInput = {
  threadSessionId: string;
  sequenceNumber: number | null;
  status: string | null;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  agentMessageCount: number;
  messages: AgentSessionMessageEntry[];
};

export type AgentSessionRepeatAnalysisResult = {
  status: "ready" | "failed";
  errorMessage: string | null;
  repeatedAgentMessageCount: number;
  repeatedCrossAgentMessageCount: number;
  agentRepeatGroupCount: number;
  repeatedAgentMessageGroups: Array<{
    representativeMessage: string;
    occurrenceCount: number;
    repeatedCount: number;
    senderCount: number;
    senderNames: string[];
    firstMessageAt: string;
    lastMessageAt: string;
  }>;
};

@Injectable()
export class ThreadAgentRepeatAnalysisService {
  constructor(
    private readonly configService: ConfigService,
    private readonly claudeCliService: ClaudeCliService,
  ) {}

  async analyze(input: {
    thread: ThreadEntity;
    sessions: AgentSessionAnalysisInput[];
  }): Promise<Map<string, AgentSessionRepeatAnalysisResult>> {
    const sessionsToAnalyze = input.sessions.filter(
      (session) => session.agentMessageCount > 0 && session.messages.length > 0,
    );

    if (!sessionsToAnalyze.length) {
      return new Map();
    }

    const prioritizedSessions = [...sessionsToAnalyze].sort(compareSessionsForAnalysis);
    const results = new Map<string, AgentSessionRepeatAnalysisResult>();

    for (const session of prioritizedSessions) {
      results.set(
        session.threadSessionId,
        await this.analyzeSession({
          thread: input.thread,
          session,
        }),
      );
    }

    return results;
  }

  private buildPrompt(input: {
    thread: ThreadEntity;
    session: AgentSessionAnalysisInput;
  }) {
    const promptMessages = selectMessagesForPrompt(input.session.messages);

    return [
      "You are analyzing agent-authored messages inside chat sessions.",
      "Your task is to detect semantically repeated agent messages, not just exact text matches.",
      "Group together messages that mean effectively the same thing, even if wording, punctuation, tense, or surrounding filler differs.",
      "Do not group messages when the intent materially changes, when one message corrects another, or when the later message adds a new instruction, result, or state change.",
      "Be conservative. Only group messages when a reasonable human reviewer would say they are substantively the same message.",
      "Return only disjoint groups of duplicated messages. Each group must contain at least 2 message IDs from the same supplied session.",
      "Do not invent IDs. Use only the provided message IDs.",
      "",
      "Thread context:",
      JSON.stringify(
        {
          thread: {
            id: input.thread.id,
            title: input.thread.title,
            type: input.thread.type,
            workspaceId: input.thread.workspaceId,
          },
          session: {
            threadSessionId: input.session.threadSessionId,
            sequenceNumber: input.session.sequenceNumber,
            status: input.session.status,
            firstMessageAt: input.session.firstMessageAt,
            lastMessageAt: input.session.lastMessageAt,
            agentMessageCount: input.session.agentMessageCount,
            analyzedMessageCount: promptMessages.length,
            messages: promptMessages.map((message) => ({
              id: message.id,
              createdAt: message.createdAt,
              senderName: message.senderName,
              content: truncateAnalyticsSnippet(message.content, 320),
            })),
          },
        },
        null,
        2,
      ),
    ].join("\n");
  }

  private buildSchema() {
    return {
      type: "object",
      additionalProperties: false,
      required: ["groups"],
      properties: {
        groups: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["messageIds"],
            properties: {
              messageIds: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    };
  }

  private async analyzeSession(input: {
    thread: ThreadEntity;
    session: AgentSessionAnalysisInput;
  }) {
    try {
      const analyticsTimeoutMs = clampAnalyticsTimeout(
        this.configService.get<string>("CLAUDE_CODE_ANALYTICS_TIMEOUT_MS"),
        28000,
      );
      const analyticsSoftTimeoutMs = clampAnalyticsTimeout(
        this.configService.get<string>("CLAUDE_CODE_ANALYTICS_SOFT_TIMEOUT_MS"),
        25000,
      );
      const response = await promiseWithSoftTimeout(
        this.claudeCliService.runStructuredPrompt<{
          groups?: Array<{
            messageIds?: string[];
          }>;
        }>({
          workspaceId: input.thread.workspaceId,
          prompt: this.buildPrompt(input),
          schema: this.buildSchema(),
          model:
            this.configService.get<string>("CLAUDE_CODE_ANALYTICS_MODEL") || null,
          timeoutMs: analyticsTimeoutMs,
          maxTurns: Number(
            this.configService.get<string>("CLAUDE_CODE_ANALYTICS_MAX_TURNS") ??
              "3",
          ),
        }),
        analyticsSoftTimeoutMs,
        "Claude CLI agent repeat analysis exceeded soft timeout",
      );

      if (!("groups" in response.output)) {
        return buildFailedAnalysis(
          "Claude CLI did not return agent repeat analysis for this session.",
        );
      }

      return buildReadyAnalysis(
        input.session,
        normalizeGroups(response.output.groups),
      );
    } catch (error) {
      return buildFailedAnalysis(
        `Claude CLI agent repeat analysis failed: ${extractErrorMessage(error)}`,
      );
    }
  }
}

function normalizeGroups(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const messageIds = Array.isArray(record.messageIds)
        ? record.messageIds
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
        : [];
      const uniqueMessageIds = [...new Set(messageIds)];
      return uniqueMessageIds.length >= 2 ? { messageIds: uniqueMessageIds } : null;
    })
    .filter((entry): entry is { messageIds: string[] } => Boolean(entry));
}

function buildReadyAnalysis(
  session: AgentSessionAnalysisInput,
  groups: Array<{ messageIds: string[] }>,
): AgentSessionRepeatAnalysisResult {
  const MAX_EXPOSED_REPEAT_GROUPS = 12;
  const messagesById = new Map(session.messages.map((message) => [message.id, message]));
  const claimedMessageIds = new Set<string>();

  const repeatedAgentMessageGroups = groups
    .map((group) => {
      const materializedMessages = group.messageIds
        .filter((messageId) => {
          if (claimedMessageIds.has(messageId)) {
            return false;
          }
          return messagesById.has(messageId);
        })
        .map((messageId) => messagesById.get(messageId)!)
        .sort(
          (left, right) =>
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        );

      if (materializedMessages.length < 2) {
        return null;
      }

      for (const message of materializedMessages) {
        claimedMessageIds.add(message.id);
      }

      const senderIds = new Set(
        materializedMessages.map(
          (message) => message.senderId?.trim() || message.senderName,
        ),
      );
      const senderNames = [...new Set(materializedMessages.map((message) => message.senderName))]
        .sort((left, right) => left.localeCompare(right));

      return {
        representativeMessage: truncateAnalyticsSnippet(
          materializedMessages[0].content,
          220,
        ),
        occurrenceCount: materializedMessages.length,
        repeatedCount: materializedMessages.length - 1,
        senderCount: senderIds.size,
        senderNames,
        firstMessageAt: materializedMessages[0].createdAt,
        lastMessageAt: materializedMessages[materializedMessages.length - 1].createdAt,
      };
    })
    .filter(
      (
        entry,
      ): entry is AgentSessionRepeatAnalysisResult["repeatedAgentMessageGroups"][number] =>
        Boolean(entry),
    )
    .sort((left, right) => {
      if (right.occurrenceCount !== left.occurrenceCount) {
        return right.occurrenceCount - left.occurrenceCount;
      }
      if (right.senderCount !== left.senderCount) {
        return right.senderCount - left.senderCount;
      }
      return (
        new Date(right.lastMessageAt).getTime() -
        new Date(left.lastMessageAt).getTime()
      );
    })
    .slice(0, MAX_EXPOSED_REPEAT_GROUPS);

  return {
    status: "ready",
    errorMessage: null,
    repeatedAgentMessageCount: repeatedAgentMessageGroups.reduce(
      (sum, group) => sum + group.repeatedCount,
      0,
    ),
    repeatedCrossAgentMessageCount: repeatedAgentMessageGroups.reduce(
      (sum, group) =>
        sum + (group.senderCount > 1 ? group.repeatedCount : 0),
      0,
    ),
    agentRepeatGroupCount: repeatedAgentMessageGroups.length,
    repeatedAgentMessageGroups,
  };
}

function buildFailedAnalysis(message: string): AgentSessionRepeatAnalysisResult {
  return {
    status: "failed",
    errorMessage: message,
    repeatedAgentMessageCount: 0,
    repeatedCrossAgentMessageCount: 0,
    agentRepeatGroupCount: 0,
    repeatedAgentMessageGroups: [],
  };
}

function compareSessionsForAnalysis(
  left: AgentSessionAnalysisInput,
  right: AgentSessionAnalysisInput,
) {
  if (left.status === "active" && right.status !== "active") {
    return -1;
  }
  if (right.status === "active" && left.status !== "active") {
    return 1;
  }
  const leftSequence = left.sequenceNumber ?? Number.MIN_SAFE_INTEGER;
  const rightSequence = right.sequenceNumber ?? Number.MIN_SAFE_INTEGER;
  if (leftSequence !== rightSequence) {
    return rightSequence - leftSequence;
  }
  return left.agentMessageCount - right.agentMessageCount;
}

function selectMessagesForPrompt(messages: AgentSessionMessageEntry[]) {
  const MAX_PROMPT_MESSAGES = 24;
  if (messages.length <= MAX_PROMPT_MESSAGES) {
    return messages;
  }

  return messages.slice(-MAX_PROMPT_MESSAGES);
}

function truncateAnalyticsSnippet(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown Claude CLI error";
}

function clampAnalyticsTimeout(value: string | undefined, ceilingMs: number) {
  const parsed = Number(value ?? ceilingMs);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ceilingMs;
  }
  return Math.min(parsed, ceilingMs);
}

function promiseWithSoftTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
