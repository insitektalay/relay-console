import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = {
  name: string;
  inputSchema: JsonObject;
  annotations: JsonObject;
};

export const SUNSAMA_READ_TOOLS = [
  "get_backlog_tasks",
  "get_task_by_id",
] as const;
export const SUNSAMA_MANAGE_TOOLS = [
  "add_task_to_channel",
  "append_task_notes",
  "edit_task_estimate",
  "edit_task_notes",
  "timebox_a_task_to_calendar",
] as const;

export class SunsamaMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class SunsamaMcpAdapter {
  async health(accessToken: string) {
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      for (const required of [...SUNSAMA_READ_TOOLS, ...SUNSAMA_MANAGE_TOOLS]) {
        if (!tools.some((tool) => tool.name === required)) {
          throw new SunsamaMcpError(
            "provider_validation_error",
            `Sunsama MCP did not expose ${required} with a valid object schema.`,
          );
        }
      }
      const dailyTaskResourceTemplate = (
        await this.listResourceTemplates(accessToken, session)
      ).find((uriTemplate) => /^sunsama:\/\/tasks\/\{[^}]+\}$/.test(uriTemplate));
      if (!dailyTaskResourceTemplate)
        throw new SunsamaMcpError(
          "provider_validation_error",
          "Sunsama MCP did not expose its daily-task resource template.",
        );
      return {
        toolCount: tools.length,
        documentedToolsVerified: true,
        readToolCount: tools.filter((tool) => this.isReadTool(tool)).length,
        manageToolCount: tools.filter((tool) => !this.isReadTool(tool)).length,
        dailyTaskResourceTemplate,
      };
    });
  }

  callRead(accessToken: string, input: JsonObject) {
    return this.callAllowed(
      accessToken,
      input,
      true,
    );
  }
  callManage(accessToken: string, input: JsonObject) {
    return this.callAllowed(
      accessToken,
      input,
      false,
    );
  }

  readTasksForDay(accessToken: string, input: JsonObject) {
    const date = this.requiredString(input.date, "date", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new SunsamaMcpError(
        "provider_validation_error",
        "date must be a valid ISO calendar date.",
      );
    const [year, month, day] = date.split("-").map(Number);
    const normalized = new Date(
      Date.UTC(year, month - 1, day),
    ).toISOString().slice(0, 10);
    if (normalized !== date)
      throw new SunsamaMcpError(
        "provider_validation_error",
        "date must be a valid ISO calendar date.",
      );
    return this.withSession(accessToken, async (session) => {
      const result = this.object(
        await this.rpc(accessToken, session, "resources/read", {
          uri: `sunsama://tasks/${date}`,
        }),
      );
      return this.redactAndBound(result);
    });
  }

  private async callAllowed(
    accessToken: string,
    input: JsonObject,
    readAction: boolean,
  ) {
    const toolName = this.requiredString(input.toolName, "toolName", 200);
    const args = this.object(input.arguments);
    this.rejectCredentialFields(args);
    if (Buffer.byteLength(JSON.stringify(args)) > 1_000_000)
      throw new SunsamaMcpError(
        "provider_validation_error",
        "Sunsama MCP arguments exceed 1 MB.",
      );
    return this.withSession(accessToken, async (session) => {
      const tool = (await this.listTools(accessToken, session)).find(
        (candidate) => candidate.name === toolName,
      );
      if (!tool)
        throw new SunsamaMcpError(
          "provider_validation_error",
          `Sunsama MCP did not expose ${toolName} with a valid object schema.`,
        );
      if (this.isReadTool(tool) !== readAction)
        throw new SunsamaMcpError(
          "policy_blocked",
          readAction
            ? `Sunsama MCP tool ${toolName} is not provider-declared read-only.`
            : `Sunsama MCP tool ${toolName} belongs to the read action.`,
          403,
        );
      const result = this.object(
        await this.rpc(accessToken, session, "tools/call", {
          name: tool.name,
          arguments: args,
        }),
      );
      if (result.isError === true)
        throw new SunsamaMcpError(
          "provider_validation_error",
          `Sunsama MCP ${toolName} failed.`,
        );
      return this.redactAndBound(result);
    });
  }

  private async withSession<T>(
    accessToken: string,
    operation: (session: Session) => Promise<T>,
  ) {
    if (!accessToken)
      throw new SunsamaMcpError(
        "credential_missing",
        "Sunsama OAuth access token is required.",
        401,
      );
    const session: Session = { requestId: 1 };
    const initialized = this.object(
      await this.rpc(accessToken, session, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "Relay Console Railway", version: "1.0" },
      }),
    );
    const capabilities = this.object(initialized.capabilities);
    if (!capabilities.tools || !capabilities.resources)
      throw new SunsamaMcpError(
        "provider_validation_error",
        "Sunsama MCP did not advertise both tool and resource support.",
      );
    await this.notify(accessToken, session, "notifications/initialized", {});
    return operation(session);
  }

  private async listTools(
    accessToken: string,
    session: Session,
  ): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 4; page += 1) {
      const result = this.object(
        await this.rpc(
          accessToken,
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
        tools.push({
          name: name.slice(0, 200),
          inputSchema,
          annotations: this.object(tool.annotations),
        });
        if (tools.length >= 100) return tools;
      }
      cursor = this.string(result.nextCursor);
      if (!cursor) break;
    }
    return tools;
  }

  private async listResourceTemplates(
    accessToken: string,
    session: Session,
  ): Promise<string[]> {
    const result = this.object(
      await this.rpc(accessToken, session, "resources/templates/list", {}),
    );
    return (Array.isArray(result.resourceTemplates)
      ? result.resourceTemplates
      : []
    )
      .map((item) => this.string(this.object(item).uriTemplate))
      .filter((item): item is string => Boolean(item))
      .slice(0, 100);
  }

  private async rpc(
    accessToken: string,
    session: Session,
    method: string,
    params: JsonObject,
  ) {
    const id = session.requestId++;
    const response = await this.request(accessToken, session, {
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 5_000_000)
      throw new SunsamaMcpError(
        "provider_validation_error",
        "Sunsama MCP response exceeds 5 MB.",
      );
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload)
      throw new SunsamaMcpError(
        "provider_unavailable",
        "Sunsama MCP returned an empty response.",
        502,
      );
    if (payload.error)
      throw new SunsamaMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ??
          "Sunsama MCP request failed.",
      );
    return payload.result;
  }

  private async notify(
    accessToken: string,
    session: Session,
    method: string,
    params: JsonObject,
  ) {
    await this.request(accessToken, session, {
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  private async request(
    accessToken: string,
    session: Session,
    body: JsonObject,
  ) {
    try {
      const response = await safeConnectorFetch("https://api.sunsama.com/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-06-18",
          ...(session.id ? { "Mcp-Session-Id": session.id } : {}),
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) session.id = sessionId;
      if (response.status === 401)
        throw new SunsamaMcpError(
          "credential_missing",
          "Sunsama MCP rejected the OAuth token.",
          401,
        );
      if (response.status === 403)
        throw new SunsamaMcpError(
          "insufficient_scope",
          "Sunsama MCP denied this capability.",
          403,
        );
      if (response.status === 429)
        throw new SunsamaMcpError(
          "provider_rate_limited",
          "Sunsama MCP rate limit reached.",
          429,
        );
      if (!response.ok && response.status !== 202 && response.status !== 204)
        throw new SunsamaMcpError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `Sunsama MCP returned HTTP ${response.status}.`,
          response.status,
        );
      return response;
    } catch (error) {
      if (error instanceof SunsamaMcpError) throw error;
      throw new SunsamaMcpError(
        "provider_unavailable",
        "Sunsama MCP could not be reached.",
        502,
      );
    }
  }

  private payloads(value: string): JsonObject[] {
    if (!value.trim()) return [];
    const values = value.includes("data:")
      ? value
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
      : [value.trim()];
    return values.flatMap((item) => {
      try {
        const parsed = JSON.parse(item) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? [parsed as JsonObject]
          : [];
      } catch {
        return [];
      }
    });
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12)
      throw new SunsamaMcpError(
        "policy_blocked",
        "Sunsama MCP arguments are too deeply nested.",
        403,
      );
    if (Array.isArray(value)) {
      if (value.length > 500)
        throw new SunsamaMcpError(
          "provider_validation_error",
          "Sunsama MCP arrays exceed 500 items.",
        );
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 500)
      throw new SunsamaMcpError(
        "provider_validation_error",
        "Sunsama MCP objects exceed 500 fields.",
      );
    for (const [key, item] of entries) {
      if (
        /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(
          key,
        )
      )
        throw new SunsamaMcpError(
          "policy_blocked",
          `Credential-bearing argument ${key} is not allowed.`,
          403,
        );
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
          /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redactAndBound(item, depth + 1),
        ]),
    );
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new SunsamaMcpError(
        "provider_validation_error",
        `${name} is required and must be at most ${max} characters.`,
      );
    return value.trim();
  }
  private isReadTool(tool: McpTool) {
    if (tool.annotations.readOnlyHint === true) return true;
    return /^(get|list|read|search|find|fetch|query)_/i.test(tool.name);
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
