import { createHash } from "node:crypto";
import type { MarketplaceConnectorExecutorRequest } from "../types";

export const CONNECTOR_EXECUTION_APPROVAL_CONTEXT_VERSION = 2 as const;
export const CONNECTOR_EXECUTION_APPROVAL_PURPOSE =
  "marketplace_connector_execution" as const;

export type ConnectorExecutionApprovalContext = {
  version: typeof CONNECTOR_EXECUTION_APPROVAL_CONTEXT_VERSION;
  purpose: typeof CONNECTOR_EXECUTION_APPROVAL_PURPOSE;
  provider: string;
  connectionId: string;
  action: string;
  toolName: string;
  requestingAgentId: string;
  dispatchId: string;
  payloadSha256: string;
  contextSha256: string;
};

export function buildConnectorExecutionApprovalContext(
  input: MarketplaceConnectorExecutorRequest,
  action: string,
  provider: string,
): ConnectorExecutionApprovalContext {
  const exactAction = {
    version: CONNECTOR_EXECUTION_APPROVAL_CONTEXT_VERSION,
    purpose: CONNECTOR_EXECUTION_APPROVAL_PURPOSE,
    provider,
    connectionId: input.connectionId,
    action,
    toolName: input.toolName,
    requestingAgentId: input.agentId,
    payloadSha256: connectorExecutionPayloadSha256(input.input),
  };
  return {
    ...exactAction,
    dispatchId: input.dispatchId,
    contextSha256: createHash("sha256")
      .update(canonicalJson(exactAction), "utf8")
      .digest("hex"),
  };
}

export function connectorExecutionPayloadSha256(
  input: Record<string, unknown>,
): string {
  const payload = connectorExecutionPayload(input);
  return createHash("sha256")
    .update(canonicalJson(payload), "utf8")
    .digest("hex");
}

export function connectorExecutionPayload(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const { approvalId: _approvalId, ...payload } = input;
  return payload;
}

export function connectorExecutionPayloadReview(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return redactSensitiveValues(
    canonicalValue(connectorExecutionPayload(input)),
  ) as Record<string, unknown>;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function canonicalValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) =>
      entry === undefined ? null : canonicalValue(entry),
    );
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const canonical: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (
        entry === undefined ||
        typeof entry === "function" ||
        typeof entry === "symbol"
      ) {
        continue;
      }
      canonical[key] = canonicalValue(entry);
    }
    return canonical;
  }
  return null;
}

function redactSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(
    value as Record<string, unknown>,
  )) {
    result[key] = isSensitiveKey(key)
      ? "[REDACTED]"
      : redactSensitiveValues(entry);
  }
  return result;
}

function isSensitiveKey(key: string): boolean {
  return /(?:authorization|cookie|credential|password|secret|token|api[_-]?key)/i.test(
    key,
  );
}
