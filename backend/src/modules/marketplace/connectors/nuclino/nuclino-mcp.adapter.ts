import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = { name: string; description: string; inputSchema: JsonObject };

export const NUCLINO_READ_TOOLS = [
  "list_teams",
  "list_workspaces",
  "get_workspace",
  "list_items",
  "search_items",
  "get_item",
  "get_file",
] as const;

export const NUCLINO_WRITE_TOOLS = [
  "create_item",
  "update_item",
  "edit_item_content",
  "delete_item",
  "create_field",
  "update_field",
  "delete_field",
] as const;

export class NuclinoMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class NuclinoMcpAdapter {
  async health(accessToken: string) {
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      for (const required of ["list_teams", "search_items", "get_item", "create_item", "update_item"]) {
        if (!tools.some((tool) => tool.name === required)) {
          throw new NuclinoMcpError(
            "provider_validation_error",
            `Nuclino MCP did not expose the documented ${required} tool with a valid object schema.`,
          );
        }
      }
      return { toolCount: tools.length, documentedToolsVerified: true };
    });
  }

  async callRead(accessToken: string, input: JsonObject) {
    return this.callAllowed(accessToken, input, new Set<string>(NUCLINO_READ_TOOLS));
  }

  async callWrite(accessToken: string, input: JsonObject) {
    return this.callAllowed(accessToken, input, new Set<string>(NUCLINO_WRITE_TOOLS));
  }

  private async callAllowed(accessToken: string, input: JsonObject, allowed: Set<string>) {
    const toolName = this.requiredString(input.toolName, "toolName", 120);
    if (!allowed.has(toolName)) {
      throw new NuclinoMcpError(
        "policy_blocked",
        `Nuclino MCP tool ${toolName} is not allowed by this Relay action.`,
        403,
      );
    }
    const args = this.object(input.arguments);
    this.rejectCredentialFields(args);
    this.assertBoundedArguments(args);
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      const tool = tools.find((candidate) => candidate.name === toolName);
      if (!tool) {
        throw new NuclinoMcpError(
          "provider_validation_error",
          `Nuclino MCP did not expose ${toolName} with a valid object schema.`,
        );
      }
      const result = this.object(
        await this.rpc(accessToken, session, "tools/call", { name: tool.name, arguments: args }),
      );
      if (result.isError === true) {
        throw new NuclinoMcpError("provider_validation_error", `Nuclino MCP ${toolName} failed.`);
      }
      return this.redactAndBound(result);
    });
  }

  private async withSession<T>(accessToken: string, fn: (session: Session) => Promise<T>) {
    if (!accessToken) {
      throw new NuclinoMcpError("credential_missing", "Nuclino OAuth access token is required.", 401);
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
      throw new NuclinoMcpError("provider_validation_error", "Nuclino MCP did not advertise tool support.");
    }
    await this.notify(accessToken, session, "notifications/initialized", {});
    return fn(session);
  }

  private async listTools(accessToken: string, session: Session): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 4; page += 1) {
      const result = this.object(
        await this.rpc(accessToken, session, "tools/list", cursor ? { cursor } : {}),
      );
      for (const item of Array.isArray(result.tools) ? result.tools : []) {
        const tool = this.object(item);
        const name = this.string(tool.name);
        const schema = this.object(tool.inputSchema);
        if (!name || schema.type !== "object" || tools.some((candidate) => candidate.name === name)) continue;
        tools.push({
          name: name.slice(0, 200),
          description: (this.string(tool.description) ?? "").slice(0, 2_000),
          inputSchema: schema,
        });
        if (tools.length >= 100) return tools;
      }
      cursor = this.string(result.nextCursor);
      if (!cursor) break;
    }
    return tools;
  }

  private async rpc(accessToken: string, session: Session, method: string, params: JsonObject) {
    const id = session.requestId++;
    const response = await this.request(accessToken, session, { jsonrpc: "2.0", id, method, params });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 3_000_000) {
      throw new NuclinoMcpError("provider_validation_error", "Nuclino MCP response exceeds 3 MB.");
    }
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload) throw new NuclinoMcpError("provider_unavailable", "Nuclino MCP returned an empty response.", 502);
    if (payload.error) {
      throw new NuclinoMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ?? "Nuclino MCP request failed.",
      );
    }
    return payload.result;
  }

  private async notify(accessToken: string, session: Session, method: string, params: JsonObject) {
    await this.request(accessToken, session, { jsonrpc: "2.0", method, params });
  }

  private async request(accessToken: string, session: Session, body: JsonObject) {
    try {
      const response = await safeConnectorFetch("https://api.nuclino.com/mcp", {
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
        signal: AbortSignal.timeout(20_000),
      });
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) session.id = sessionId;
      if (response.status === 401) throw new NuclinoMcpError("credential_missing", "Nuclino MCP rejected the OAuth token.", 401);
      if (response.status === 403) throw new NuclinoMcpError("insufficient_scope", "Nuclino MCP denied this capability.", 403);
      if (response.status === 429) throw new NuclinoMcpError("provider_rate_limited", "Nuclino MCP rate limit reached.", 429);
      if (!response.ok && response.status !== 202 && response.status !== 204) {
        throw new NuclinoMcpError(
          response.status >= 500 ? "provider_unavailable" : "provider_validation_error",
          `Nuclino MCP returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof NuclinoMcpError) throw error;
      throw new NuclinoMcpError("provider_unavailable", "Nuclino MCP could not be reached.", 502);
    }
  }

  private payloads(value: string): JsonObject[] {
    if (!value.trim()) return [];
    const values = value.includes("data:")
      ? value.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim())
      : [value];
    return values.flatMap((item) => {
      try { return [this.object(JSON.parse(item))]; } catch { return []; }
    });
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12) throw new NuclinoMcpError("policy_blocked", "Nuclino MCP arguments are too deeply nested.", 403);
    if (Array.isArray(value)) return value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (/(token|secret|password|credential|authorization|api.?key|cookie)/i.test(key)) {
        throw new NuclinoMcpError("policy_blocked", `Credential-bearing argument ${key} is not allowed.`, 403);
      }
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private assertBoundedArguments(value: JsonObject) {
    if (Buffer.byteLength(JSON.stringify(value)) > 1_000_000) {
      throw new NuclinoMcpError("provider_validation_error", "Nuclino MCP arguments exceed 1 MB.");
    }
  }

  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redactAndBound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject).slice(0, 500).map(([key, item]) => [
        key,
        /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(key)
          ? "[redacted]"
          : this.redactAndBound(item, depth + 1),
      ]),
    );
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw new NuclinoMcpError("provider_validation_error", `${name} is required and must be at most ${max} characters.`);
    }
    return value.trim();
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
  }
  private string(value: unknown) {
    return typeof value === "string" ? value : undefined;
  }
}
