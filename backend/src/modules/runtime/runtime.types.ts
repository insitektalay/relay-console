import { RuntimeBindingEntity } from "../../entities/runtime-binding.entity";
import { RuntimeThreadSessionEntity } from "../../entities/runtime-thread-session.entity";

export type RuntimeType = "openclaw" | "claude_code" | "hermes";

export interface RuntimeHealth {
  status: "unconfigured" | "ready" | "offline" | "degraded" | "error";
  checkedAt: Date;
  message?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RuntimeCapabilities {
  streamText?: boolean;
  cancelRun?: boolean;
  resumeSession?: boolean;
  toolActivity?: "none" | "coarse" | "rich";
  attachmentsIn?: boolean;
  attachmentsOut?: boolean;
  workspaceExecution?: boolean;
  bridgeBacked?: boolean;
  requiresExternalRuntimePresence?: boolean;
  [key: string]: unknown;
}

export interface RuntimeContextReference {
  uri: string;
  title?: string | null;
  kind?: string | null;
  source?: string | null;
}

export interface RuntimeTodoTask {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

export interface RuntimeDocumentReferenceContract {
  version: 1;
  eventFields: {
    contextReferences: "run.context.references";
    toolReferences: "run.tool.references";
    finalMetadata: "metadata.documentReferences";
  };
  guidance: string[];
}

export const RUNTIME_DOCUMENT_REFERENCE_CONTRACT: RuntimeDocumentReferenceContract =
  {
    version: 1,
    eventFields: {
      contextReferences: "run.context.references",
      toolReferences: "run.tool.references",
      finalMetadata: "metadata.documentReferences",
    },
    guidance: [
      "Record documents passively when they are already loaded or read; do not scan or reread files only for provenance.",
      "For every workspace, memory, library, skill, workflow, or system document consulted, emit a reference with uri plus optional title, kind, and source.",
      "Prefer observed references from tool/file access over agent-declared prose lists.",
    ],
  };

export interface RuntimeDispatchContext {
  dispatchId: string;
  workspaceId: string;
  threadId: string;
  threadSessionId: string;
  messageId: string;
  agentId: string;
  runtimeBindingId: string;
  runtimeHostId: string | null;
  assignmentEpoch: string;
  runtimeThreadSessionId: string;
  runtimeSessionId: string;
  inputText: string;
  recentMessages: Array<Record<string, unknown>>;
  dispatchMetadata?: Record<string, unknown>;
  timeoutMs: number;
  correlationId: string;
}

export type RuntimeEvent =
  | {
      type: "dispatch.accepted";
      dispatchId: string;
      runtimeRunId?: string;
      metadata?: Record<string, unknown>;
    }
  | { type: "run.started"; dispatchId: string; runtimeRunId?: string }
  | { type: "run.delta"; dispatchId: string; seq: number; text: string }
  | {
      type: "run.thinking";
      dispatchId: string;
      seq: number;
      thinking: string;
      kind?: "thinking" | "reasoning";
    }
  | {
      type: "run.status";
      dispatchId: string;
      code: string;
      message: string;
    }
  | {
      type: "run.tool";
      dispatchId: string;
      toolName: string;
      phase: "started" | "updated" | "completed";
      summary?: string;
      tasks?: RuntimeTodoTask[];
      references?: RuntimeContextReference[];
    }
  | {
      type: "run.context";
      dispatchId: string;
      totalTokens: number | null;
      contextTokens: number | null;
      percentUsed: number | null;
      level: "unknown" | "ok" | "warn" | "critical" | "overflow";
      fresh: boolean;
      sessionId?: string;
      model?: string;
      modelProvider?: string;
      references?: RuntimeContextReference[];
    }
  | {
      type: "run.completed";
      dispatchId: string;
      finalText?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "run.failed";
      dispatchId: string;
      code: string;
      message: string;
      retryable: boolean;
    }
  | { type: "run.cancelled"; dispatchId: string };

export interface RuntimeEventSink {
  emit(event: RuntimeEvent): Promise<void>;
}

export interface RuntimeAdapter {
  type: RuntimeType;
  resolveSession(input: {
    binding: RuntimeBindingEntity;
    threadId: string;
    threadSessionId: string;
    agentId: string;
  }): Promise<RuntimeThreadSessionEntity>;
  dispatchTurn(
    input: RuntimeDispatchContext,
    sink: RuntimeEventSink,
  ): Promise<void>;
  cancelDispatch(input: {
    dispatchId: string;
    runtimeSessionId: string;
  }): Promise<void>;
  closeSession(input: {
    runtimeSessionId: string;
    reason?: string;
  }): Promise<void>;
  getHealth(binding: RuntimeBindingEntity): Promise<RuntimeHealth>;
  getCapabilities(binding: RuntimeBindingEntity): Promise<RuntimeCapabilities>;
  normalizeInboundCallback?(payload: unknown): Promise<RuntimeEvent[]>;
}

export interface RuntimeDispatchQueuedPayload {
  workspaceId: string;
  threadId: string;
  threadSessionId: string;
  dispatchId: string;
  messageId?: string | null;
  agentId: string;
  runtimeType: string;
  runtimeBindingId: string;
  runtimeHostId?: string | null;
  assignmentEpoch?: string;
  runtimeThreadSessionId: string;
  timestamp: string;
  draftText?: string | null;
  draftSeq?: number | null;
}

export interface RuntimeParticipantHealthPayload {
  workspaceId: string;
  threadId?: string | null;
  agentId: string;
  runtimeType: string;
  status: string;
  message?: string | null;
  timestamp: string;
}
