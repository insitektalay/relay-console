import * as path from "node:path";
import { Journal } from "./journal";
import { Logger } from "./logger";
import { RailwayClient } from "./railway-client";
import { RuntimeConfig } from "./config";
import { runClaudeCommand } from "./claude-cli";
import {
  assertSafeRuntimeId,
  resolveRegisteredRepoPath,
} from "./path-policy";
import {
  MAX_ERROR_DETAIL_BYTES,
  boundedRedactedText,
  ensureProtectedOutputDirectory,
  rotateProtectedLogs,
  writeProtectedFile,
} from "./output-security";

type DispatchPayload = {
  dispatchId: string;
  threadId: string;
  threadSessionId: string;
  claudeSessionId: string;
  externalAgentId: string;
  agentName?: string;
  senderName: string;
  content: string;
  recentMessages?: Array<{
    senderName: string;
    content: string;
  }>;
  repoKey?: string;
  model?: string | null;
  timeoutSeconds?: number;
  resume?: boolean;
  threadType?: string;
  threadClassification?: string;
  isTeamThread?: boolean;
  threadParticipants?: Array<{ agentId?: string | null }>;
};

export class DispatchRunner {
  private readonly logger = new Logger("runner");
  private readonly repoLocks = new Set<string>();

  constructor(
    private readonly config: RuntimeConfig,
    private readonly railway: RailwayClient,
    private readonly journal: Journal,
    private readonly logsDir: string,
  ) {}

  async reconcileStartup() {
    for (const entry of this.journal.listActive()) {
      this.logger.warn(`reconciling abandoned dispatch ${entry.dispatchId}`);
      await this.railway.postDispatchFailed(entry.dispatchId, {
        errorCode: "runtime_restarted",
        errorMessage: "Claude runtime restarted before the dispatch completed.",
        notifyThread: true,
      });
      await this.journal.remove(entry.dispatchId);
    }
  }

  async handleDispatch(rawPayload: Record<string, unknown>) {
    const payload = rawPayload as unknown as DispatchPayload;
    let dispatchId: string;
    try {
      dispatchId = assertSafeRuntimeId(payload.dispatchId, "dispatchId");
      assertSafeRuntimeId(payload.threadId, "threadId");
      assertSafeRuntimeId(payload.threadSessionId, "threadSessionId");
      assertSafeRuntimeId(payload.claudeSessionId, "claudeSessionId");
      assertSafeRuntimeId(payload.externalAgentId, "externalAgentId");
    } catch (error) {
      this.logger.error(
        boundedRedactedText(
          error instanceof Error ? error.message : "Invalid dispatch payload",
          MAX_ERROR_DETAIL_BYTES,
        ),
      );
      return;
    }
    const agentConfig = this.config.agents.find(
      (entry) => entry.externalAgentId === payload.externalAgentId,
    );
    if (!agentConfig) {
      return;
    }

    const repoKey = payload.repoKey ?? agentConfig.repoKey;
    let repoPath: string;
    let repo: RuntimeConfig["repos"][number];
    try {
      const resolved = await resolveRegisteredRepoPath(this.config, repoKey);
      repo = resolved.repo;
      repoPath = resolved.canonicalPath;
    } catch {
      await this.railway.postDispatchFailed(dispatchId, {
        errorCode: "repo_not_found",
        errorMessage: `No local repo binding exists for repoKey ${repoKey}.`,
        notifyThread: true,
      });
      return;
    }

    if (this.repoLocks.has(repoPath)) {
      this.logger.warn(
        `repo busy for dispatch ${dispatchId}: ${repoKey}`,
      );
      await this.railway.postDispatchFailed(dispatchId, {
        errorCode: "busy",
        errorMessage: `Repo ${repoKey} is already busy with another Claude run.`,
        notifyThread: false,
      });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    await rotateProtectedLogs(this.logsDir);
    const stdoutPath = path.join(
      this.logsDir,
      today,
      `${dispatchId}.stdout.log`,
    );
    const stderrPath = path.join(
      this.logsDir,
      today,
      `${dispatchId}.stderr.log`,
    );
    const metaPath = path.join(
      this.logsDir,
      today,
      `${dispatchId}.meta.json`,
    );

    this.repoLocks.add(repoPath);
    await this.railway.postDispatchStarted(dispatchId);

    try {
      const prompt = this.buildPrompt(payload, repoKey);
      if (Buffer.byteLength(prompt, "utf8") > 256 * 1024) {
        throw new Error("Dispatch prompt exceeds the 256 KiB limit");
      }
      const run = await runClaudeCommand({
        repoPath,
        sessionId: payload.claudeSessionId,
        resume: Boolean(payload.resume),
        prompt,
        model: payload.model ?? agentConfig.model ?? repo.model ?? undefined,
        timeoutMs:
          (payload.timeoutSeconds ??
            this.config.dispatchTimeoutSeconds ??
            1200) * 1000,
        stdoutPath,
        stderrPath,
        runtimeCommandRiskAcceptance: this.config.runtimeCommandRiskAcceptance,
        teamPublishAgentIds: this.isTeamChat(payload)
          ? (payload.threadParticipants ?? [])
              .map((participant) => participant.agentId)
              .filter((agentId): agentId is string => Boolean(agentId))
          : undefined,
        onStarted: async (pid) => {
          await this.journal.add({
            dispatchId,
            threadId: payload.threadId,
            threadSessionId: payload.threadSessionId,
            externalAgentId: payload.externalAgentId,
            repoKey,
            pid,
            startedAt: new Date().toISOString(),
          });
        },
      });

      await ensureProtectedOutputDirectory(path.dirname(metaPath));
      await writeProtectedFile(
        metaPath,
        JSON.stringify(
          {
            dispatchId,
            repoKey,
            result: run.result,
          },
          null,
          2,
        ) + "\n",
      );

      if (this.isTeamChat(payload)) {
        for (const toolCall of run.result.tool_calls ?? []) {
          await this.railway.executeRuntimeTool(
            dispatchId,
            "relay",
            toolCall.name,
            {
              content: toolCall.arguments.content,
              mentions: toolCall.arguments.mentions ?? [],
              callId: toolCall.call_id,
            },
          );
        }
      } else {
        await this.railway.postFinalMessage({
          threadId: payload.threadId,
          threadSessionId: payload.threadSessionId,
          dispatchId,
          senderId: payload.externalAgentId,
          senderName: payload.agentName ?? payload.externalAgentId,
          content: run.result.final_reply_markdown,
          metadata: {
            changedFiles: run.result.changed_files ?? [],
            summary: run.result.summary ?? null,
          },
        });
      }

      await this.railway.postDispatchCompleted(dispatchId, {
        resultSummary: run.result.summary ?? null,
        resultMetadata: {
          changedFiles: run.result.changed_files ?? [],
        },
      });
    } catch (error) {
      const message = boundedRedactedText(
        error instanceof Error
          ? error.message
          : "Unknown Claude runtime failure",
        MAX_ERROR_DETAIL_BYTES,
      );
      const runtimeCode =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : null;
      const status =
        error && typeof error === "object" && "status" in error
          ? Number((error as { status: unknown }).status)
          : null;
      const code = runtimeCode
        ? runtimeCode
        : status === 409 &&
            message.includes("Thread session is no longer active")
          ? "stale_thread_session"
          : message.includes("timed out")
            ? "timeout"
            : "process_crashed";
      await this.railway.postDispatchFailed(dispatchId, {
        errorCode: code,
        errorMessage: message,
        notifyThread: true,
      });
    } finally {
      this.repoLocks.delete(repoPath);
      await this.journal.remove(dispatchId);
    }
  }

  private buildPrompt(payload: DispatchPayload, repoKey: string) {
    const recentMessages = (payload.recentMessages ?? [])
      .slice(-12)
      .map((message) => `- ${message.senderName}: ${message.content}`)
      .join("\n");

    return [
      `You are acting as the ClawChat Claude agent ${payload.externalAgentId}.`,
      `You are operating in the repo bound to repoKey ${repoKey}.`,
      `This is a ClawChat dispatch inside an existing persistent thread session.`,
      `Sender: ${payload.senderName}`,
      `Current request: ${payload.content}`,
      recentMessages ? `Recent thread context:\n${recentMessages}` : "",
      `Do the required coding work in this repo if needed.`,
      this.isTeamChat(payload)
        ? `This is a team chat. Your ordinary final_reply_markdown is not displayed. To publish a visible message, add a relay_publish_message entry to tool_calls with a stable call_id, content, and only the agent IDs that should receive another turn. Omit tool_calls to publish nothing.`
        : `Return a concise user-facing final reply in final_reply_markdown.`,
      `If you changed files, include them in changed_files.`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private isTeamChat(payload: DispatchPayload) {
    return (
      payload.threadType === "team" ||
      payload.threadClassification === "team_chat" ||
      payload.isTeamThread === true
    );
  }
}
