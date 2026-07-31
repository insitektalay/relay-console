import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = { name: string; description: string; inputSchema: JsonObject };

export const SLITE_READ_TOOLS = [
  "ask-slite",
  "get-comment-thread-on-note",
  "get-note",
  "get-note-children",
  "get-user",
  "get-user-group",
  "list-channels",
  "list-comment-threads",
  "list-empty-notes-for-knowledge-management",
  "list-inactive-notes-for-knowledge-management",
  "list-notes-for-knowledge-management",
  "list-public-notes-for-knowledge-management",
  "list-recently-edited-notes",
  "list-recently-visited-notes",
  "search-notes",
  "search-user-groups",
  "search-users",
] as const;

export const SLITE_WRITE_TOOLS = [
  "append-blocks",
  "archive-note",
  "create-channel",
  "create-collection",
  "create-comment-thread",
  "create-note",
  "modify-block",
  "modify-range",
  "move-note",
  "remove-blocks",
  "reply-to-comment-thread",
  "resolve-comment-thread",
  "restore-note",
  "set-note-review-state",
  "unresolve-comment-thread",
  "update-channel",
  "update-collection",
  "update-note",
  "verify-note",
] as const;

export class SliteMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class SliteMcpAdapter {
  async health(accessToken: string) {
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      for (const required of ["search-notes", "get-note", "create-note", "update-note"]) {
        if (!tools.some((tool) => tool.name === required)) {
          throw new SliteMcpError(
            "provider_validation_error",
            `Slite MCP did not expose the documented ${required} tool with a valid object schema.`,
          );
        }
      }
      return { toolCount: tools.length, documentedToolsVerified: true };
    });
  }

  async callRead(accessToken: string, input: JsonObject) {
    return this.callAllowed(accessToken, input, new Set<string>(SLITE_READ_TOOLS));
  }

  async callWrite(accessToken: string, input: JsonObject) {
    return this.callAllowed(accessToken, input, new Set<string>(SLITE_WRITE_TOOLS));
  }

  private async callAllowed(
    accessToken: string,
    input: JsonObject,
    allowed: Set<string>,
  ) {
    const toolName = this.requiredString(input.toolName, "toolName", 120);
    if (!allowed.has(toolName)) {
      throw new SliteMcpError(
        "policy_blocked",
        `Slite MCP tool ${toolName} is not allowed by this Relay action.`,
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
        throw new SliteMcpError(
          "provider_validation_error",
          `Slite MCP did not expose ${toolName} with a valid object schema.`,
        );
      }
      const result = this.object(
        await this.rpc(accessToken, session, "tools/call", {
          name: tool.name,
          arguments: args,
        }),
      );
      if (result.isError === true) {
        throw new SliteMcpError(
          "provider_validation_error",
          `Slite MCP ${toolName} failed.`,
        );
      }
      return this.redactAndBound(result);
    });
  }

  private async withSession<T>(
    accessToken: string,
    fn: (session: Session) => Promise<T>,
  ) {
    if (!accessToken) {
      throw new SliteMcpError(
        "credential_missing",
        "Slite OAuth access token is required.",
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
      throw new SliteMcpError(
        "provider_validation_error",
        "Slite MCP did not advertise tool support.",
      );
    }
    await this.notify(accessToken, session, "notifications/initialized", {});
    return fn(session);
  }

  private async listTools(accessToken: string, session: Session): Promise<McpTool[]> {
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
        const schema = this.object(tool.inputSchema);
        if (
          !name ||
          schema.type !== "object" ||
          tools.some((candidate) => candidate.name === name)
        ) continue;
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
    if (Buffer.byteLength(raw) > 3_000_000) {
      throw new SliteMcpError(
        "provider_validation_error",
        "Slite MCP response exceeds 3 MB.",
      );
    }
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload) {
      throw new SliteMcpError(
        "provider_unavailable",
        "Slite MCP returned an empty response.",
        502,
      );
    }
    if (payload.error) {
      throw new SliteMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ?? "Slite MCP request failed.",
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
    await this.request(accessToken, session, { jsonrpc: "2.0", method, params });
  }

  private async request(accessToken: string, session: Session, body: JsonObject) {
    try {
      const response = await safeConnectorFetch("https://api.slite.com/mcp", {
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
      if (response.status === 401) {
        throw new SliteMcpError(
          "credential_missing",
          "Slite MCP rejected the OAuth token.",
          401,
        );
      }
      if (response.status === 403) {
        throw new SliteMcpError(
          "insufficient_scope",
          "Slite MCP denied this capability.",
          403,
        );
      }
      if (response.status === 429) {
        throw new SliteMcpError(
          "provider_rate_limited",
          "Slite MCP rate limit reached.",
          429,
        );
      }
      if (!response.ok && response.status !== 202 && response.status !== 204) {
        throw new SliteMcpError(
          response.status >= 500 ? "provider_unavailable" : "provider_validation_error",
          `Slite MCP returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof SliteMcpError) throw error;
      throw new SliteMcpError(
        "provider_unavailable",
        "Slite MCP could not be reached.",
        502,
      );
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
    if (depth > 12) {
      throw new SliteMcpError(
        "policy_blocked",
        "Slite MCP arguments are too deeply nested.",
        403,
      );
    }
    if (Array.isArray(value)) {
      return value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (/(token|secret|password|credential|authorization|api.?key|cookie)/i.test(key)) {
        throw new SliteMcpError(
          "policy_blocked",
          `Credential-bearing argument ${key} is not allowed.`,
          403,
        );
      }
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private assertBoundedArguments(value: JsonObject) {
    const encoded = JSON.stringify(value);
    if (Buffer.byteLength(encoded) > 1_000_000) {
      throw new SliteMcpError(
        "provider_validation_error",
        "Slite MCP arguments exceed 1 MB.",
      );
    }
  }

  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value)) {
      return value.slice(0, 500).map((item) => this.redactAndBound(item, depth + 1));
    }
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
      throw new SliteMcpError(
        "provider_validation_error",
        `${name} is required and must be at most ${max} characters.`,
      );
    }
    return value.trim();
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as JsonObject
      : {};
  }
  private string(value: unknown) {
    return typeof value === "string" ? value : undefined;
  }
}
