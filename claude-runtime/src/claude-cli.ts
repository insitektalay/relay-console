import * as crypto from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import type { RuntimeCommandRiskAcceptance, RuntimeConfig } from "./config";
import {
  BoundedOutputCapture,
  MAX_ERROR_DETAIL_BYTES,
  boundedRedactedText,
  redactUnknown,
  writeProtectedOutput,
} from "./output-security";

export type ClaudeStructuredResult = {
  status: "completed" | "failed";
  final_reply_markdown: string;
  summary?: string;
  changed_files?: string[];
  tool_calls?: Array<{
    name: "relay_publish_message";
    call_id: string;
    arguments: {
      content: string;
      mentions?: Array<{ agentId: string }>;
    };
  }>;
};

type ClaudeCliEnvelope = {
  structured_output?: Record<string, unknown>;
} & Record<string, unknown>;

type StructuredCommand = {
  kind: "claude" | "codex";
  bin: string;
  baseArgs: string[];
  display: string;
  requiresArgSeparator: boolean;
};

function resolveClaudeCommand(config?: Pick<RuntimeConfig, "claudeCommand">) {
  const configured =
    config?.claudeCommand?.filter((entry) => entry.trim()) ?? [];
  if (configured.length > 0) {
    return {
      kind: isCodexCommand(configured[0])
        ? ("codex" as const)
        : ("claude" as const),
      bin: configured[0],
      baseArgs: configured.slice(1),
      display: configured.join(" "),
      requiresArgSeparator: isNpxLikeCommand(configured[0]),
    };
  }

  return {
    kind: "claude" as const,
    bin: "npx",
    baseArgs: ["@anthropic-ai/claude-code"],
    display: "npx @anthropic-ai/claude-code",
    requiresArgSeparator: true,
  };
}

export function verifyClaudeCliSupport(
  config?: Pick<
    RuntimeConfig,
    "claudeCommand" | "runtimeCommandRiskAcceptance"
  >,
) {
  const command = resolveClaudeCommand(config);
  const riskAccepted = isRuntimeCommandRiskAccepted(
    config?.runtimeCommandRiskAcceptance,
  );
  assertRuntimeCommandBypassAllowed(command, riskAccepted);
  const versionResult = spawnSync(
    command.bin,
    [...command.baseArgs, "--version"],
    {
      encoding: "utf8",
    },
  );
  if (versionResult.status !== 0) {
    throw new Error(
      `Claude CLI is not installed or not executable via "${command.display}"`,
    );
  }

  const helpResult = spawnSync(command.bin, [...command.baseArgs, "--help"], {
    encoding: "utf8",
  });
  if (helpResult.status !== 0) {
    throw new Error(`Claude CLI --help failed via "${command.display}"`);
  }

  const help = helpResult.stdout;
  const requiredFlags = [
    "--session-id",
    "--resume",
    "--json-schema",
    "--output-format",
    "--add-dir",
  ];
  if (riskAccepted) {
    requiredFlags.push("--dangerously-skip-permissions");
  }

  for (const flag of requiredFlags) {
    if (!help.includes(flag)) {
      throw new Error(`Installed Claude CLI is missing required flag ${flag}`);
    }
  }

  return versionResult.stdout.trim();
}

export async function runClaudeCommand(input: {
  repoPath: string;
  sessionId: string;
  resume: boolean;
  prompt: string;
  claudeCommand?: string[];
  model?: string;
  timeoutMs: number;
  stdoutPath: string;
  stderrPath: string;
  onStarted?: (pid: number | null) => Promise<void> | void;
  runtimeCommandRiskAcceptance?: RuntimeCommandRiskAcceptance;
  teamPublishAgentIds?: string[];
}) {
  const properties: Record<string, unknown> = {
    status: { type: "string", enum: ["completed", "failed"] },
    final_reply_markdown: { type: "string" },
    summary: { type: "string" },
    changed_files: { type: "array", items: { type: "string" } },
  };
  if (input.teamPublishAgentIds) {
    properties.tool_calls = {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "call_id", "arguments"],
        properties: {
          name: { type: "string", enum: ["relay_publish_message"] },
          call_id: { type: "string", minLength: 1, maxLength: 160 },
          arguments: {
            type: "object",
            additionalProperties: false,
            required: ["content"],
            properties: {
              content: { type: "string", minLength: 1, maxLength: 50_000 },
              mentions: {
                type: "array",
                maxItems: 20,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["agentId"],
                  properties: {
                    agentId: {
                      type: "string",
                      enum: input.teamPublishAgentIds,
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }
  const parsed = await runClaudeStructuredPrompt({
    repoPath: input.repoPath,
    sessionId: input.sessionId,
    resume: input.resume,
    prompt: input.prompt,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["final_reply_markdown", "status"],
      properties,
    },
    claudeCommand: input.claudeCommand,
    model: input.model,
    timeoutMs: input.timeoutMs,
    stdoutPath: input.stdoutPath,
    stderrPath: input.stderrPath,
    onStarted: input.onStarted,
    maxTurns: 20,
    runtimeCommandRiskAcceptance: input.runtimeCommandRiskAcceptance,
  });

  return {
    pid: parsed.pid,
    result: parseClaudeStructuredOutput(
      JSON.stringify({ structured_output: parsed.output }),
    ),
  };
}

export async function runClaudeStructuredPrompt(input: {
  repoPath: string;
  prompt: string;
  schema: Record<string, unknown>;
  claudeCommand?: string[];
  model?: string;
  timeoutMs: number;
  maxTurns?: number;
  sessionId?: string;
  resume?: boolean;
  stdoutPath?: string;
  stderrPath?: string;
  onStarted?: (pid: number | null) => Promise<void> | void;
  runtimeCommandRiskAcceptance?: RuntimeCommandRiskAcceptance;
}) {
  const command = resolveClaudeCommand({
    claudeCommand: input.claudeCommand,
  });
  const prebuiltClaudeArgs =
    command.kind === "claude"
      ? buildClaudeStructuredPromptArgs({
          baseArgs: command.baseArgs,
          requiresArgSeparator: command.requiresArgSeparator,
          prompt: input.prompt,
          resume: input.resume,
          sessionId: input.sessionId,
          schema: input.schema,
          maxTurns: input.maxTurns,
          repoPath: input.repoPath,
          model: input.model,
          runtimeCommandRiskAcceptance: input.runtimeCommandRiskAcceptance,
        })
      : null;
  if (command.kind === "codex") {
    assertRuntimeCommandBypassAllowed(
      command,
      isRuntimeCommandRiskAccepted(input.runtimeCommandRiskAcceptance),
    );
  }

  const stdoutPath =
    input.stdoutPath ??
    path.join(input.repoPath, ".claude-structured.stdout.log");
  const stderrPath =
    input.stderrPath ??
    path.join(input.repoPath, ".claude-structured.stderr.log");

  if (command.kind === "codex") {
    return runCodexStructuredPrompt({
      ...input,
      command,
      stdoutPath,
      stderrPath,
    });
  }

  if (!prebuiltClaudeArgs) {
    throw new Error("Claude structured prompt arguments were not prepared");
  }
  const args = prebuiltClaudeArgs;

  const child = spawn(command.bin, args, {
    cwd: input.repoPath,
    stdio: ["ignore", "pipe", "pipe"],
  });
  await input.onStarted?.(child.pid ?? null);

  const stdoutCapture = new BoundedOutputCapture();
  const stderrCapture = new BoundedOutputCapture();

  child.stdout.on("data", (chunk: Buffer) => {
    if (!stdoutCapture.append(chunk)) child.kill("SIGTERM");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    if (!stderrCapture.append(chunk)) child.kill("SIGTERM");
  });

  const exit = await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
    }, input.timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });

  const stdout = stdoutCapture.text().trim();
  const stderr = stderrCapture.text().trim();
  await Promise.all([
    writeProtectedOutput(stdoutPath, stdout),
    writeProtectedOutput(stderrPath, stderr),
  ]);

  if (
    stdoutCapture.didExceedLimit() ||
    stderrCapture.didExceedLimit()
  ) {
    const error = new Error("Claude CLI exceeded the output limit");
    (error as Error & { code?: string }).code = "output_limit";
    throw error;
  }
  if (exit.signal === "SIGTERM" || exit.signal === "SIGKILL") {
    const error = new Error("Claude CLI timed out");
    (error as Error & { code?: string }).code = "timeout";
    throw error;
  }
  if (exit.code !== 0) {
    throw new Error(
      `Claude CLI failed with exit code ${exit.code ?? "unknown"}: ${boundedRedactedText(
        stderr || stdout,
        MAX_ERROR_DETAIL_BYTES,
      )}`,
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseClaudeGenericStructuredOutput(stdout);
  } catch (caughtError) {
    if (caughtError instanceof Error && "code" in caughtError) {
      throw caughtError;
    }
    const malformedError = new Error("Claude output was not valid JSON");
    (malformedError as Error & { code?: string }).code = "malformed_output";
    throw malformedError;
  }

  return {
    pid: child.pid ?? null,
    output: redactUnknown(parsed),
    model: input.model?.trim() || null,
  };
}

function isNpxLikeCommand(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "npx" || normalized.endsWith("/npx");
}

function isCodexCommand(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "codex" || normalized.endsWith("/codex");
}

async function runCodexStructuredPrompt(input: {
  repoPath: string;
  prompt: string;
  schema: Record<string, unknown>;
  model?: string;
  timeoutMs: number;
  onStarted?: (pid: number | null) => Promise<void> | void;
  command: StructuredCommand;
  stdoutPath: string;
  stderrPath: string;
  runtimeCommandRiskAcceptance?: RuntimeCommandRiskAcceptance;
}) {
  const schemaPath = path.join(
    path.dirname(input.stdoutPath ?? path.join(input.repoPath, ".")),
    `${crypto.randomUUID()}.schema.json`,
  );
  await fs.writeFile(schemaPath, JSON.stringify(input.schema), { mode: 0o600 });

  const args = buildCodexExecArgs({
    baseArgs: input.command.baseArgs,
    repoPath: input.repoPath,
    schemaPath,
    model: input.model,
    prompt: input.prompt,
    runtimeCommandRiskAcceptance: input.runtimeCommandRiskAcceptance,
  });

  try {
    const child = spawn(input.command.bin, args, {
      cwd: input.repoPath,
      stdio: ["ignore", "pipe", "pipe"],
    });
    await input.onStarted?.(child.pid ?? null);

    const stdoutCapture = new BoundedOutputCapture();
    const stderrCapture = new BoundedOutputCapture();

    child.stdout.on("data", (chunk: Buffer) => {
      if (!stdoutCapture.append(chunk)) child.kill("SIGTERM");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (!stderrCapture.append(chunk)) child.kill("SIGTERM");
    });

    const exit = await waitForChild(child, input.timeoutMs);

    const stdout = stdoutCapture.text().trim();
    const stderr = stderrCapture.text().trim();
    await Promise.all([
      writeProtectedOutput(input.stdoutPath, stdout),
      writeProtectedOutput(input.stderrPath, stderr),
    ]);

    if (
      stdoutCapture.didExceedLimit() ||
      stderrCapture.didExceedLimit()
    ) {
      const error = new Error("Codex CLI exceeded the output limit");
      (error as Error & { code?: string }).code = "output_limit";
      throw error;
    }
    if (exit.signal === "SIGTERM" || exit.signal === "SIGKILL") {
      const error = new Error("Codex CLI timed out");
      (error as Error & { code?: string }).code = "timeout";
      throw error;
    }
    if (exit.code !== 0) {
      throw new Error(
        `Codex CLI failed with exit code ${exit.code ?? "unknown"}: ${boundedRedactedText(
          stderr || stdout,
          MAX_ERROR_DETAIL_BYTES,
        )}`,
      );
    }

    return {
      pid: child.pid ?? null,
      output: redactUnknown(parseCodexStructuredOutput(stdout)),
      model: input.model?.trim() || null,
    };
  } finally {
    await fs.rm(schemaPath, { force: true });
  }
}

export function buildClaudeStructuredPromptArgs(input: {
  baseArgs: string[];
  requiresArgSeparator: boolean;
  prompt: string;
  resume?: boolean;
  sessionId?: string;
  schema: Record<string, unknown>;
  maxTurns?: number;
  repoPath: string;
  model?: string;
  runtimeCommandRiskAcceptance?: RuntimeCommandRiskAcceptance;
}) {
  const riskAccepted = isRuntimeCommandRiskAccepted(
    input.runtimeCommandRiskAcceptance,
  );
  const args = sanitizeClaudeStructuredPromptBaseArgs(
    input.baseArgs,
    riskAccepted,
  );
  if (input.requiresArgSeparator) {
    args.push("--");
  }
  args.push(
    "-p",
    input.prompt,
    input.resume ? "--resume" : "--session-id",
    input.sessionId ?? crypto.randomUUID?.() ?? String(Date.now()),
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(input.schema),
    "--max-turns",
    String(input.maxTurns ?? 8),
    "--add-dir",
    input.repoPath,
  );
  if (riskAccepted && !args.includes("--dangerously-skip-permissions")) {
    args.push("--dangerously-skip-permissions");
  }
  if (input.model?.trim()) {
    args.push("--model", input.model.trim());
  }
  return args;
}

export function buildCodexExecArgs(input: {
  baseArgs: string[];
  repoPath: string;
  schemaPath: string;
  model?: string;
  prompt: string;
  runtimeCommandRiskAcceptance?: RuntimeCommandRiskAcceptance;
}) {
  const riskAccepted = isRuntimeCommandRiskAccepted(
    input.runtimeCommandRiskAcceptance,
  );
  const sanitizedBaseArgs = sanitizeCodexExecBaseArgs(
    input.baseArgs,
    riskAccepted,
  );
  const args =
    sanitizedBaseArgs[0] === "exec"
      ? [...sanitizedBaseArgs]
      : ["exec", ...sanitizedBaseArgs];

  if (!args.includes("--sandbox") && !args.includes("-s")) {
    args.push("--sandbox", "workspace-write");
  }
  if (!args.includes("--ask-for-approval") && !args.includes("-a")) {
    args.push("--ask-for-approval", "on-request");
  }
  if (!args.includes("--cd") && !args.includes("-C")) {
    args.push("--cd", input.repoPath);
  }
  if (!args.includes("--skip-git-repo-check")) {
    args.push("--skip-git-repo-check");
  }
  args.push("--output-schema", input.schemaPath, "--json");
  if (input.model?.trim()) {
    args.push("--model", input.model.trim());
  }
  args.push(input.prompt);
  return args;
}

function sanitizeClaudeStructuredPromptBaseArgs(
  baseArgs: string[],
  riskAccepted: boolean,
) {
  const result: string[] = [];
  for (let index = 0; index < baseArgs.length; index += 1) {
    const current = baseArgs[index];
    if (current === "--dangerously-skip-permissions" && !riskAccepted) {
      throw dangerousRuntimeBypassError(
        "Claude --dangerously-skip-permissions",
      );
    }
    result.push(current);
  }
  return result;
}

function sanitizeCodexExecBaseArgs(baseArgs: string[], riskAccepted: boolean) {
  const result: string[] = [];
  for (let index = 0; index < baseArgs.length; index += 1) {
    const current = baseArgs[index];
    if (current === "--ask-for-approval" || current === "-a") {
      const value = baseArgs[index + 1];
      if (value === "never" && !riskAccepted) {
        throw dangerousRuntimeBypassError("Codex --ask-for-approval never");
      }
      result.push(current);
      if (value !== undefined) {
        result.push(value);
        index += 1;
      }
      continue;
    }
    if (current === "--sandbox" || current === "-s") {
      const value = baseArgs[index + 1];
      if (value === "danger-full-access" && !riskAccepted) {
        throw dangerousRuntimeBypassError("Codex --sandbox danger-full-access");
      }
      result.push(current);
      if (value !== undefined) {
        result.push(value);
        index += 1;
      }
      continue;
    }
    result.push(current);
  }
  return result;
}

function assertRuntimeCommandBypassAllowed(
  command: StructuredCommand,
  riskAccepted: boolean,
) {
  if (command.kind === "codex") {
    sanitizeCodexExecBaseArgs(command.baseArgs, riskAccepted);
    return;
  }

  sanitizeClaudeStructuredPromptBaseArgs(command.baseArgs, riskAccepted);
}

export function isRuntimeCommandRiskAccepted(
  riskAcceptance?: RuntimeCommandRiskAcceptance,
) {
  return (
    riskAcceptance?.dangerousBypassAccepted === true &&
    Boolean(riskAcceptance.acceptedBy?.trim()) &&
    Boolean(riskAcceptance.acceptedAt?.trim()) &&
    !Number.isNaN(Date.parse(riskAcceptance.acceptedAt ?? "")) &&
    Boolean(riskAcceptance.reason?.trim())
  );
}

function dangerousRuntimeBypassError(flag: string) {
  return new Error(
    `${flag} requires config.json runtimeCommandRiskAcceptance with dangerousBypassAccepted, acceptedBy, acceptedAt, and reason before beta runtime dispatches may use permission bypass mode.`,
  );
}

function parseCodexStructuredOutput(stdout: string) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith("{")) {
      continue;
    }

    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (
        parsed.type === "item.completed" &&
        parsed.item &&
        typeof parsed.item === "object"
      ) {
        const item = parsed.item as Record<string, unknown>;
        if (
          item.type === "agent_message" &&
          typeof item.text === "string" &&
          item.text.trim()
        ) {
          return parseClaudeGenericStructuredOutput(item.text);
        }
      }
    } catch {
      continue;
    }
  }

  const error = new Error(
    "Codex output did not contain a structured agent message",
  );
  (error as Error & { code?: string }).code = "malformed_output";
  throw error;
}

function waitForChild(child: ReturnType<typeof spawn>, timeoutMs: number) {
  return new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
}

export function parseClaudeStructuredOutput(
  stdout: string,
): ClaudeStructuredResult {
  const candidate = parseClaudeGenericStructuredOutput(stdout);
  if (
    typeof candidate.final_reply_markdown !== "string" ||
    typeof candidate.status !== "string"
  ) {
    const error = new Error("Claude output did not satisfy expected contract");
    (error as Error & { code?: string }).code = "malformed_output";
    throw error;
  }

  return {
    status: candidate.status as "completed" | "failed",
    final_reply_markdown: candidate.final_reply_markdown,
    summary:
      typeof candidate.summary === "string" ? candidate.summary : undefined,
    changed_files: Array.isArray(candidate.changed_files)
      ? candidate.changed_files.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : undefined,
    tool_calls: Array.isArray(candidate.tool_calls)
      ? candidate.tool_calls.filter(isRelayPublishToolCall)
      : undefined,
  };
}

function isRelayPublishToolCall(value: unknown): value is NonNullable<
  ClaudeStructuredResult["tool_calls"]
>[number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const call = value as Record<string, unknown>;
  if (
    call.name !== "relay_publish_message" ||
    typeof call.call_id !== "string" ||
    !call.arguments ||
    typeof call.arguments !== "object" ||
    Array.isArray(call.arguments)
  ) {
    return false;
  }
  return typeof (call.arguments as Record<string, unknown>).content === "string";
}

export function parseClaudeGenericStructuredOutput(stdout: string) {
  const envelope = JSON.parse(stdout) as ClaudeCliEnvelope;
  const candidate =
    envelope.structured_output && typeof envelope.structured_output === "object"
      ? envelope.structured_output
      : envelope;

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    const error = new Error("Claude output did not satisfy expected contract");
    (error as Error & { code?: string }).code = "malformed_output";
    throw error;
  }

  return candidate;
}
