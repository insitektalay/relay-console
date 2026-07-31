import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = { name: string; inputSchema: JsonObject };

export const REMEMBER_THE_MILK_READ_TOOLS = [
  "rtm_get_task",
  "rtm_list_tasks",
  "rtm_get_list",
  "rtm_list_lists",
  "rtm_list_permissions",
  "rtm_list_tags",
  "rtm_list_notes",
  "rtm_list_locations",
  "rtm_get_reminder",
  "rtm_list_reminders",
  "rtm_list_contacts",
  "rtm_get_script",
  "rtm_list_scripts",
  "rtm_get_settings",
  "rtm_get_timezone",
  "rtm_get_language",
] as const;

export const REMEMBER_THE_MILK_MANAGE_TOOLS = [
  "rtm_add_task",
  "rtm_update_task",
  "rtm_complete_task",
  "rtm_uncomplete_task",
  "rtm_postpone_task",
  "rtm_trash_task",
  "rtm_untrash_task",
  "rtm_assign_task",
  "rtm_unassign_task",
  "rtm_batch_complete",
  "rtm_batch_delete",
  "rtm_batch_move",
  "rtm_batch_tag",
  "rtm_batch_update",
  "rtm_add_list",
  "rtm_update_list",
  "rtm_delete_list",
  "rtm_share_list",
  "rtm_unshare_list",
  "rtm_create_tag",
  "rtm_update_tag",
  "rtm_delete_tag",
  "rtm_add_tag_to_task",
  "rtm_remove_tag_from_task",
  "rtm_add_note",
  "rtm_update_note",
  "rtm_delete_note",
  "rtm_create_location",
  "rtm_update_location",
  "rtm_delete_location",
  "rtm_assign_location",
  "rtm_create_reminder",
  "rtm_update_reminder",
  "rtm_delete_reminder",
  "rtm_add_contact",
  "rtm_create_script",
  "rtm_update_script",
  "rtm_delete_script",
  "rtm_run_script",
  "rtm_run_script_ephemeral",
  "rtm_update_settings",
  "rtm_undo_transaction",
] as const;

export class RememberTheMilkMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class RememberTheMilkMcpAdapter {
  async health(accessToken: string) {
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      for (const required of [
        ...REMEMBER_THE_MILK_READ_TOOLS,
        ...REMEMBER_THE_MILK_MANAGE_TOOLS,
      ]) {
        if (!tools.some((tool) => tool.name === required)) {
          throw new RememberTheMilkMcpError(
            "provider_validation_error",
            `Remember The Milk MCP did not expose the documented ${required} tool with a valid object schema.`,
          );
        }
      }
      return {
        toolCount: tools.length,
        documentedToolsVerified: true,
        readToolCount: REMEMBER_THE_MILK_READ_TOOLS.length,
        manageToolCount: REMEMBER_THE_MILK_MANAGE_TOOLS.length,
      };
    });
  }

  callRead(accessToken: string, input: JsonObject) {
    return this.callAllowed(
      accessToken,
      input,
      new Set<string>(REMEMBER_THE_MILK_READ_TOOLS),
    );
  }

  callManage(accessToken: string, input: JsonObject) {
    return this.callAllowed(
      accessToken,
      input,
      new Set<string>(REMEMBER_THE_MILK_MANAGE_TOOLS),
    );
  }

  private async callAllowed(
    accessToken: string,
    input: JsonObject,
    allowed: Set<string>,
  ) {
    const toolName = this.requiredString(input.toolName, "toolName", 120);
    if (!allowed.has(toolName)) {
      throw new RememberTheMilkMcpError(
        "policy_blocked",
        `Remember The Milk MCP tool ${toolName} is not allowed by this Relay action.`,
        403,
      );
    }
    const args = this.object(input.arguments);
    this.rejectCredentialFields(args);
    if (Buffer.byteLength(JSON.stringify(args)) > 1_000_000) {
      throw new RememberTheMilkMcpError(
        "provider_validation_error",
        "Remember The Milk MCP arguments exceed 1 MB.",
      );
    }
    return this.withSession(accessToken, async (session) => {
      const tool = (await this.listTools(accessToken, session)).find(
        (candidate) => candidate.name === toolName,
      );
      if (!tool) {
        throw new RememberTheMilkMcpError(
          "provider_validation_error",
          `Remember The Milk MCP did not expose ${toolName} with a valid object schema.`,
        );
      }
      const result = this.object(
        await this.rpc(accessToken, session, "tools/call", {
          name: tool.name,
          arguments: args,
        }),
      );
      if (result.isError === true) {
        throw new RememberTheMilkMcpError(
          "provider_validation_error",
          `Remember The Milk MCP ${toolName} failed.`,
        );
      }
      return this.redactAndBound(result);
    });
  }

  private async withSession<T>(
    accessToken: string,
    operation: (session: Session) => Promise<T>,
  ) {
    if (!accessToken) {
      throw new RememberTheMilkMcpError(
        "credential_missing",
        "Remember The Milk OAuth access token is required.",
        401,
      );
    }
    const session: Session = { requestId: 1 };
    const initialized = this.object(
      await this.rpc(accessToken, session, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "Relay Console Railway", version: "1.0" },
      }),
    );
    if (!this.object(initialized.capabilities).tools) {
      throw new RememberTheMilkMcpError(
        "provider_validation_error",
        "Remember The Milk MCP did not advertise tool support.",
      );
    }
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
        ) {
          continue;
        }
        tools.push({ name: name.slice(0, 200), inputSchema });
        if (tools.length >= 100) return tools;
      }
      cursor = this.string(result.nextCursor);
      if (!cursor) break;
    }
    return tools;
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
    if (Buffer.byteLength(raw) > 5_000_000) {
      throw new RememberTheMilkMcpError(
        "provider_validation_error",
        "Remember The Milk MCP response exceeds 5 MB.",
      );
    }
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload) {
      throw new RememberTheMilkMcpError(
        "provider_unavailable",
        "Remember The Milk MCP returned an empty response.",
        502,
      );
    }
    if (payload.error) {
      throw new RememberTheMilkMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ??
          "Remember The Milk MCP request failed.",
      );
    }
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
      const response = await safeConnectorFetch("https://www.rememberthemilk.com/mcp", {
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
      if (response.status === 401) {
        throw new RememberTheMilkMcpError(
          "credential_missing",
          "Remember The Milk MCP rejected the OAuth token.",
          401,
        );
      }
      if (response.status === 403) {
        throw new RememberTheMilkMcpError(
          "insufficient_scope",
          "Remember The Milk MCP denied this capability.",
          403,
        );
      }
      if (response.status === 429) {
        throw new RememberTheMilkMcpError(
          "provider_rate_limited",
          "Remember The Milk MCP rate limit reached.",
          429,
        );
      }
      if (!response.ok && response.status !== 202 && response.status !== 204) {
        throw new RememberTheMilkMcpError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `Remember The Milk MCP returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof RememberTheMilkMcpError) throw error;
      throw new RememberTheMilkMcpError(
        "provider_unavailable",
        "Remember The Milk MCP could not be reached.",
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
    if (depth > 8) {
      throw new RememberTheMilkMcpError(
        "provider_validation_error",
        "Remember The Milk MCP arguments are nested too deeply.",
      );
    }
    if (Array.isArray(value)) {
      if (value.length > 500)
        throw new RememberTheMilkMcpError(
          "provider_validation_error",
          "Remember The Milk MCP arrays exceed 500 items.",
        );
      for (const item of value) this.rejectCredentialFields(item, depth + 1);
      return;
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 200)
      throw new RememberTheMilkMcpError(
        "provider_validation_error",
        "Remember The Milk MCP objects exceed 200 fields.",
      );
    for (const [key, child] of entries) {
      if (
        /(token|secret|password|authorization|credential|api[_-]?key)/i.test(
          key,
        )
      ) {
        throw new RememberTheMilkMcpError(
          "provider_validation_error",
          "Credentials cannot be supplied in Remember The Milk MCP arguments.",
        );
      }
      this.rejectCredentialFields(child, depth + 1);
    }
  }

  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 200_000);
    if (Array.isArray(value))
      return value
        .slice(0, 500)
        .map((item) => this.redactAndBound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .filter(
          ([key]) =>
            !/(token|secret|password|authorization|credential|api[_-]?key)/i.test(
              key,
            ),
        )
        .slice(0, 200)
        .map(([key, child]) => [key, this.redactAndBound(child, depth + 1)]),
    );
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private requiredString(value: unknown, label: string, maxLength: number) {
    const result = this.string(value);
    if (!result || result.length > maxLength)
      throw new RememberTheMilkMcpError(
        "provider_validation_error",
        `${label} is required and must be at most ${maxLength} characters.`,
      );
    return result;
  }
}
