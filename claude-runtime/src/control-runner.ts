import { RuntimeConfig } from "./config";
import { Logger } from "./logger";
import { runClaudeStructuredPrompt } from "./claude-cli";
import { HostOperations } from "./host-operations";
import {
  assertSafeRuntimeId,
  resolveRegisteredRepoPath,
} from "./path-policy";
import {
  MAX_ERROR_DETAIL_BYTES,
  boundedRedactedText,
} from "./output-security";

type ControlReply = (type: string, data: Record<string, unknown>) => void;

export class ControlRunner {
  private readonly logger = new Logger("control");
  private readonly hostOperations: HostOperations;

  constructor(private readonly config: RuntimeConfig) {
    this.hostOperations = new HostOperations(config);
  }

  async handleEvent(
    eventType: string,
    payload: Record<string, unknown>,
    reply: ControlReply,
  ) {
    const requestId =
      typeof payload.requestId === "string" ? payload.requestId : null;
    if (!requestId) {
      return false;
    }
    assertSafeRuntimeId(requestId, "requestId");

    if (eventType.startsWith("clawchat.host.")) {
      try {
        const result = await this.hostOperations.handle(eventType, payload);
        reply(`${eventType}.result`, { requestId, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`${eventType} failed: ${message}`);
        reply(`${eventType}.error`, { requestId, error: message });
      }
      return true;
    }

    if (eventType !== "claude.cli.structured_prompt") return false;

    try {
      const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
      const schema =
        payload.schema && typeof payload.schema === "object"
          ? (payload.schema as Record<string, unknown>)
          : null;
      if (!prompt.trim() || !schema) {
        throw new Error(
          "Structured prompt request is missing prompt or schema",
        );
      }
      if (Buffer.byteLength(prompt, "utf8") > 256 * 1024) {
        throw new Error("Structured prompt exceeds the 256 KiB limit");
      }
      if (Buffer.byteLength(JSON.stringify(schema), "utf8") > 256 * 1024) {
        throw new Error("Structured prompt schema exceeds the 256 KiB limit");
      }
      const repoPath = await this.resolveRepoPath(payload);

      const result = await runClaudeStructuredPrompt({
        repoPath,
        prompt,
        schema,
        claudeCommand:
          this.config.structuredPromptCommand ?? this.config.claudeCommand,
        model:
          typeof payload.model === "string" &&
          payload.model.trim().length <= 100
            ? payload.model.trim()
            : undefined,
        timeoutMs:
          typeof payload.timeoutMs === "number" &&
          payload.timeoutMs >= 1000 &&
          payload.timeoutMs <= 30 * 60 * 1000
            ? Math.round(payload.timeoutMs)
            : (this.config.dispatchTimeoutSeconds ?? 1200) * 1000,
        runtimeCommandRiskAcceptance: this.config.runtimeCommandRiskAcceptance,
        maxTurns:
          typeof payload.maxTurns === "number" &&
          payload.maxTurns >= 1 &&
          payload.maxTurns <= 20
            ? Math.round(payload.maxTurns)
            : 8,
      });

      reply("claude.cli.structured_prompt.result", {
        requestId,
        output: result.output,
        model: result.model ?? null,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? "Unknown error");
      const safeMessage = boundedRedactedText(
        message,
        MAX_ERROR_DETAIL_BYTES,
      );
      this.logger.error(`structured prompt failed: ${safeMessage}`);
      reply("claude.cli.structured_prompt.error", {
        requestId,
        error: safeMessage,
      });
    }

    return true;
  }

  private async resolveRepoPath(payload: Record<string, unknown>) {
    if ("cwd" in payload) {
      throw new Error("Remote cwd is not accepted; use a registered repoKey");
    }
    const resolved = await resolveRegisteredRepoPath(
      this.config,
      payload.repoKey,
    );
    return resolved.canonicalPath;
  }
}

export function controlCapabilities(config: RuntimeConfig) {
  const capabilities = ["claude.cli.structured_prompt"];
  if (
    config.managedAgentHosts?.some(
      (entry) =>
        entry.workspacePath && entry.allowWorkspaceQuarantine === true,
    )
  ) {
    capabilities.push("clawchat.host.agent_workspace_purge");
  }
  if (
    config.managedAgentHosts?.some((entry) => entry.schedulerCommand?.length)
  ) {
    capabilities.push("clawchat.host.scheduler_maintenance");
  }
  if (config.managedAgentHosts?.some((entry) => entry.cronCommand?.length)) {
    capabilities.push("clawchat.host.cron_management");
  }
  return capabilities;
}
