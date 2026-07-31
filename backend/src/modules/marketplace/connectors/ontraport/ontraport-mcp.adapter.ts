import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = { name: string; inputSchema: JsonObject };
export type OntraportCredentials = { appId: string; apiKey: string };

export const ONTRAPORT_READ_TOOLS = [
  "get_objects",
  "list_allowed_object_types",
  "get_object_meta",
  "count_objects",
  "get_account_info",
  "get_groups",
  "get_subscribers",
  "get_contact_log",
  "get_automation_log",
  "get_recent_messages",
  "get_recent_notes",
  "get_recent_tasks",
  "get_task_form_requirements",
  "get_scheduled_broadcasts",
  "get_landing_page_url",
  "build_api_condition",
  "get_invoices",
  "get_purchases",
  "get_payments",
  "get_failed_transactions",
  "validate_offer",
] as const;

export const ONTRAPORT_MANAGE_TOOLS = [
  "saveorupdate_object",
  "create_object",
  "update_object",
  "delete_object",
  "delete_objects",
  "manage_tags",
  "manage_subscriptions",
  "manage_relationships",
  "assign_task",
  "complete_task",
  "cancel_task",
  "reschedule_task",
  "pause_unpause_objects",
  "create_invoice",
  "update_invoice",
  "pay_invoice",
  "process_transaction",
  "log_offline_purchase",
  "log_offline_transaction",
  "mark_transaction_paid",
  "rerun_transaction",
  "refund_transaction",
  "void_transaction",
  "write_off_transaction",
  "cancel_subscription",
  "convert_transaction",
  "send_invoice",
  "update_order",
] as const;

export class OntraportMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class OntraportMcpAdapter {
  async health(credentials: OntraportCredentials) {
    return this.withSession(credentials, async (session) => {
      const tools = await this.listTools(credentials, session);
      for (const required of [
        "list_allowed_object_types",
        "get_objects",
        "get_account_info",
      ]) {
        if (!tools.some((tool) => tool.name === required)) {
          throw new OntraportMcpError(
            "provider_validation_error",
            `Ontraport MCP did not expose the documented ${required} tool with a valid object schema.`,
          );
        }
      }
      await this.callAllowed(
        credentials,
        { toolName: "get_account_info", arguments: {} },
        new Set<string>(ONTRAPORT_READ_TOOLS),
        session,
      );
      return {
        toolCount: tools.length,
        documentedCoreVerified: true,
        identityVerified: true,
      };
    });
  }

  callRead(credentials: OntraportCredentials, input: JsonObject) {
    return this.callAllowed(
      credentials,
      input,
      new Set<string>(ONTRAPORT_READ_TOOLS),
    );
  }

  callManage(credentials: OntraportCredentials, input: JsonObject) {
    return this.callAllowed(
      credentials,
      input,
      new Set<string>(ONTRAPORT_MANAGE_TOOLS),
    );
  }

  private async callAllowed(
    credentials: OntraportCredentials,
    input: JsonObject,
    allowed: Set<string>,
    existingSession?: Session,
  ) {
    const toolName = this.requiredString(input.toolName, "toolName", 120);
    if (!allowed.has(toolName)) {
      throw new OntraportMcpError(
        "policy_blocked",
        `Ontraport MCP tool ${toolName} is not allowed by this Relay action.`,
        403,
      );
    }
    const args = this.object(input.arguments);
    this.rejectCredentialFields(args);
    if (Buffer.byteLength(JSON.stringify(args)) > 1_000_000) {
      throw new OntraportMcpError(
        "provider_validation_error",
        "Ontraport MCP arguments exceed 1 MB.",
      );
    }
    const invoke = async (session: Session) => {
      const tool = (await this.listTools(credentials, session)).find(
        (candidate) => candidate.name === toolName,
      );
      if (!tool) {
        throw new OntraportMcpError(
          "provider_validation_error",
          `Ontraport MCP did not expose ${toolName} with a valid object schema.`,
        );
      }
      const result = this.object(
        await this.rpc(credentials, session, "tools/call", {
          name: tool.name,
          arguments: args,
        }),
      );
      if (result.isError === true) {
        throw new OntraportMcpError(
          "provider_validation_error",
          `Ontraport MCP ${toolName} failed.`,
        );
      }
      return this.redactAndBound(result);
    };
    return existingSession
      ? invoke(existingSession)
      : this.withSession(credentials, invoke);
  }

  private async withSession<T>(
    credentials: OntraportCredentials,
    operation: (session: Session) => Promise<T>,
  ) {
    this.validateCredentials(credentials);
    const session: Session = { requestId: 1 };
    const initialized = this.object(
      await this.rpc(credentials, session, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "Relay Console Railway", version: "1.0" },
      }),
    );
    if (!this.object(initialized.capabilities).tools) {
      throw new OntraportMcpError(
        "provider_validation_error",
        "Ontraport MCP did not advertise tool support.",
      );
    }
    await this.notify(credentials, session, "notifications/initialized", {});
    return operation(session);
  }

  private async listTools(credentials: OntraportCredentials, session: Session) {
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 4; page += 1) {
      const result = this.object(
        await this.rpc(
          credentials,
          session,
          "tools/list",
          cursor ? { cursor } : {},
        ),
      );
      for (const item of Array.isArray(result.tools) ? result.tools : []) {
        const tool = this.object(item);
        const name = this.string(tool.name);
        const inputSchema = this.object(tool.inputSchema);
        if (
          !name ||
          inputSchema.type !== "object" ||
          tools.some((candidate) => candidate.name === name)
        )
          continue;
        tools.push({ name: name.slice(0, 200), inputSchema });
        if (tools.length >= 100) return tools;
      }
      cursor = this.string(result.nextCursor);
      if (!cursor) break;
    }
    return tools;
  }

  private async rpc(
    credentials: OntraportCredentials,
    session: Session,
    method: string,
    params: JsonObject,
  ) {
    const id = session.requestId++;
    const response = await this.request(credentials, session, {
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 5_000_000) {
      throw new OntraportMcpError(
        "provider_validation_error",
        "Ontraport MCP response exceeds 5 MB.",
      );
    }
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload) {
      throw new OntraportMcpError(
        "provider_unavailable",
        "Ontraport MCP returned an empty response.",
        502,
      );
    }
    if (payload.error) {
      throw new OntraportMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ??
          "Ontraport MCP request failed.",
      );
    }
    return payload.result;
  }

  private async notify(
    credentials: OntraportCredentials,
    session: Session,
    method: string,
    params: JsonObject,
  ) {
    await this.request(credentials, session, {
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  private async request(
    credentials: OntraportCredentials,
    session: Session,
    body: JsonObject,
  ) {
    try {
      const response = await safeConnectorFetch("https://mcp.ontraport.com", {
        method: "POST",
        headers: {
          "Api-Appid": credentials.appId,
          "Api-Key": credentials.apiKey,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-06-18",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
          ...(session.id ? { "Mcp-Session-Id": session.id } : {}),
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) session.id = sessionId;
      if (response.status === 401) {
        throw new OntraportMcpError(
          "credential_missing",
          "Ontraport rejected the App ID or API key.",
          401,
        );
      }
      if (response.status === 403) {
        throw new OntraportMcpError(
          "insufficient_scope",
          "Ontraport denied this MCP capability.",
          403,
        );
      }
      if (response.status === 429) {
        throw new OntraportMcpError(
          "provider_rate_limited",
          "Ontraport MCP rate limit reached.",
          429,
        );
      }
      if (!response.ok && response.status !== 202 && response.status !== 204) {
        throw new OntraportMcpError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `Ontraport MCP returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof OntraportMcpError) throw error;
      throw new OntraportMcpError(
        "provider_unavailable",
        "Ontraport MCP could not be reached.",
        502,
      );
    }
  }

  private validateCredentials(credentials: OntraportCredentials) {
    this.requiredString(credentials.appId, "Ontraport App ID", 1_000);
    this.requiredString(credentials.apiKey, "Ontraport API key", 10_000);
  }

  private payloads(value: string): JsonObject[] {
    if (!value.trim()) return [];
    const values = value.includes("data:")
      ? value
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
      : [value];
    return values.flatMap((item) => {
      try {
        return [this.object(JSON.parse(item))];
      } catch {
        return [];
      }
    });
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12) {
      throw new OntraportMcpError(
        "policy_blocked",
        "Ontraport MCP arguments are too deeply nested.",
        403,
      );
    }
    if (Array.isArray(value)) {
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|password|credential|authorization|api.?key|api.?appid|cookie)/i.test(
          key,
        )
      ) {
        throw new OntraportMcpError(
          "policy_blocked",
          `Credential-bearing argument ${key} is not allowed.`,
          403,
        );
      }
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value
        .slice(0, 500)
        .map((item) => this.redactAndBound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?key|api.?appid|cookie)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redactAndBound(item, depth + 1),
        ]),
    );
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw new OntraportMcpError(
        "provider_validation_error",
        `${name} is required and must be at most ${max} characters.`,
      );
    }
    return value.trim();
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private string(value: unknown) {
    return typeof value === "string" ? value : undefined;
  }
}
