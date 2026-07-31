import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = { name: string; inputSchema: JsonObject };

export const TRACKINGTIME_READ_TOOLS = [
  "get_me",
  "list_workspaces",
  "list_events",
  "list_company_events",
  "get_event",
  "list_users",
  "get_user",
  "list_user_tasks",
  "list_user_projects",
  "list_user_trackables",
  "list_projects",
  "list_tasks",
  "get_task",
  "list_customers",
] as const;

export const TRACKINGTIME_MANAGE_TOOLS = [
  "create_task",
  "update_task",
  "create_customer",
  "update_customer",
  "create_project",
  "update_project",
  "create_event",
  "update_event",
  "track_task",
  "stop_task",
  "create_custom_field",
  "create_enum_option",
] as const;

export const TRACKINGTIME_DOCUMENTED_TOOL_COUNT = 26;
export const TRACKINGTIME_MCP_SOURCE_SHA256 =
  "5be6eb772030e5d1ccbb3cd1fb45a408356e13263f86837a010b3f9a5bb66105";

export class TrackingTimeMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class TrackingTimeMcpAdapter {
  async health(appPassword: string) {
    return this.withSession(appPassword, async (session) => {
      const tools = await this.listTools(appPassword, session);
      const expected = [
        ...TRACKINGTIME_READ_TOOLS,
        ...TRACKINGTIME_MANAGE_TOOLS,
      ];
      for (const required of expected) {
        if (!tools.some((tool) => tool.name === required)) {
          throw new TrackingTimeMcpError(
            "provider_validation_error",
            `TrackingTime MCP did not expose the documented ${required} tool with a valid object schema.`,
          );
        }
      }
      await this.callAllowed(
        appPassword,
        { toolName: "get_me", arguments: {} },
        new Set<string>(TRACKINGTIME_READ_TOOLS),
        session,
      );
      return {
        toolCount: tools.length,
        documentedToolsVerified: true,
        identityVerified: true,
      };
    });
  }

  callRead(appPassword: string, input: JsonObject) {
    return this.callAllowed(
      appPassword,
      input,
      new Set<string>(TRACKINGTIME_READ_TOOLS),
    );
  }

  callManage(appPassword: string, input: JsonObject) {
    return this.callAllowed(
      appPassword,
      input,
      new Set<string>(TRACKINGTIME_MANAGE_TOOLS),
    );
  }

  private async callAllowed(
    appPassword: string,
    input: JsonObject,
    allowed: Set<string>,
    existingSession?: Session,
  ) {
    const toolName = this.requiredString(input.toolName, "toolName", 120);
    if (!allowed.has(toolName)) {
      throw new TrackingTimeMcpError(
        "policy_blocked",
        `TrackingTime MCP tool ${toolName} is not allowed by this Relay action.`,
        403,
      );
    }
    const args = this.object(input.arguments);
    this.rejectCredentialFields(args);
    if (Buffer.byteLength(JSON.stringify(args)) > 1_000_000) {
      throw new TrackingTimeMcpError(
        "provider_validation_error",
        "TrackingTime MCP arguments exceed 1 MB.",
      );
    }
    const invoke = async (session: Session) => {
      const tool = (await this.listTools(appPassword, session)).find(
        (candidate) => candidate.name === toolName,
      );
      if (!tool) {
        throw new TrackingTimeMcpError(
          "provider_validation_error",
          `TrackingTime MCP did not expose ${toolName} with a valid object schema.`,
        );
      }
      const result = this.object(
        await this.rpc(appPassword, session, "tools/call", {
          name: tool.name,
          arguments: args,
        }),
      );
      if (result.isError === true) {
        throw new TrackingTimeMcpError(
          "provider_validation_error",
          `TrackingTime MCP ${toolName} failed.`,
        );
      }
      return this.redactAndBound(result);
    };
    return existingSession
      ? invoke(existingSession)
      : this.withSession(appPassword, invoke);
  }

  private async withSession<T>(
    appPassword: string,
    operation: (session: Session) => Promise<T>,
  ) {
    if (!appPassword) {
      throw new TrackingTimeMcpError(
        "credential_missing",
        "TrackingTime App Password is required.",
        401,
      );
    }
    const session: Session = { requestId: 1 };
    const initialized = this.object(
      await this.rpc(appPassword, session, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "Relay Console Railway", version: "1.0" },
      }),
    );
    if (!this.object(initialized.capabilities).tools) {
      throw new TrackingTimeMcpError(
        "provider_validation_error",
        "TrackingTime MCP did not advertise tool support.",
      );
    }
    await this.notify(appPassword, session, "notifications/initialized", {});
    return operation(session);
  }

  private async listTools(
    appPassword: string,
    session: Session,
  ): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 4; page += 1) {
      const result = this.object(
        await this.rpc(
          appPassword,
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
        if (tools.length >= 50) return tools;
      }
      cursor = this.string(result.nextCursor);
      if (!cursor) break;
    }
    return tools;
  }

  private async rpc(
    appPassword: string,
    session: Session,
    method: string,
    params: JsonObject,
  ) {
    const id = session.requestId++;
    const response = await this.request(appPassword, session, {
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 5_000_000) {
      throw new TrackingTimeMcpError(
        "provider_validation_error",
        "TrackingTime MCP response exceeds 5 MB.",
      );
    }
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload) {
      throw new TrackingTimeMcpError(
        "provider_unavailable",
        "TrackingTime MCP returned an empty response.",
        502,
      );
    }
    if (payload.error) {
      throw new TrackingTimeMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ??
          "TrackingTime MCP request failed.",
      );
    }
    return payload.result;
  }

  private async notify(
    appPassword: string,
    session: Session,
    method: string,
    params: JsonObject,
  ) {
    await this.request(appPassword, session, {
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  private async request(
    appPassword: string,
    session: Session,
    body: JsonObject,
  ) {
    try {
      const response = await safeConnectorFetch("https://mcp.trackingtime.co/mcp", {
        method: "POST",
        headers: {
          "X-API-Key": appPassword,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-03-26",
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
        throw new TrackingTimeMcpError(
          "credential_missing",
          "TrackingTime rejected the App Password.",
          401,
        );
      }
      if (response.status === 403) {
        throw new TrackingTimeMcpError(
          "insufficient_scope",
          "TrackingTime denied this capability.",
          403,
        );
      }
      if (response.status === 429) {
        throw new TrackingTimeMcpError(
          "provider_rate_limited",
          "TrackingTime rate limit reached.",
          429,
        );
      }
      if (!response.ok && response.status !== 202 && response.status !== 204) {
        throw new TrackingTimeMcpError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `TrackingTime MCP returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof TrackingTimeMcpError) throw error;
      throw new TrackingTimeMcpError(
        "provider_unavailable",
        "TrackingTime MCP could not be reached.",
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
      throw new TrackingTimeMcpError(
        "policy_blocked",
        "TrackingTime MCP arguments are too deeply nested.",
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
        /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(
          key,
        )
      ) {
        throw new TrackingTimeMcpError(
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
    if (Array.isArray(value)) {
      return value
        .slice(0, 500)
        .map((item) => this.redactAndBound(item, depth + 1));
    }
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
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw new TrackingTimeMcpError(
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
