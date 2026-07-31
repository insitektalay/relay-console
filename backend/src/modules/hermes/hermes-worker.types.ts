import {
  RuntimeDocumentReferenceContract,
  RuntimeTodoTask,
} from "../runtime/runtime.types";

export interface HermesWorkerRunRequest {
  dispatchId: string;
  runtimeSessionId: string;
  inputText: string;
  workspaceKey: string;
  model?: string | null;
  enabledToolsets?: string[];
  disabledToolsets?: string[];
  defaultSkills?: string[];
  correlationId?: string | null;
  timeoutMs: number;
  configMetadata?: Record<string, unknown>;
  marketplaceRuntimeContext?: unknown;
  marketplaceTools?: Array<Record<string, unknown>>;
  availableMarketplaceTools?: Array<Record<string, unknown>>;
  responsePresentation?: string;
  expectedContentFormat?: string;
  responseContract?: Record<string, unknown>;
  responseFormatContract?: string;
  runtimeInstruction?: string;
  systemInstruction?: string;
  documentReferenceContract?: RuntimeDocumentReferenceContract;
}

export type HermesWorkerEvent =
  | {
      type: "dispatch.accepted";
      dispatchId: string;
      runtimeRunId: string;
      metadata?: Record<string, unknown>;
    }
  | { type: "run.started"; dispatchId: string; runtimeRunId: string }
  | { type: "run.delta"; dispatchId: string; seq: number; text: string }
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
      references?: Array<{
        uri: string;
        title?: string | null;
        kind?: string | null;
        source?: string | null;
      }>;
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
      references?: Array<{
        uri: string;
        title?: string | null;
        kind?: string | null;
        source?: string | null;
      }>;
    }
  | {
      type: "run.completed";
      dispatchId: string;
      finalText: string;
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

export interface HermesWorkerHealth {
  status: string;
  implementation: string;
  authEnabled: boolean;
  workspaceIsolation: string;
  activeRuns: number;
  maxActiveRuns: number;
  storageUsedBytes: number;
}
