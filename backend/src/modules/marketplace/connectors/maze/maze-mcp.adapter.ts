import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = {
  name: string;
  description: string;
  inputSchema: JsonObject;
  annotations: JsonObject;
};
const MUTATION =
  /(^|[_.-])(create|update|edit|delete|remove|publish|write|send|invite|assign|approve|archive|restore|upload|execute|run)([_.-]|$)/i;
const MUTATION_TEXT =
  /\b(create|update|edit|delete|remove|publish|write|send|invite|assign|approve|archive|restore|upload|execute|run)\b/i;

export class MazeMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class MazeMcpAdapter {
  async health(accessToken: string) {
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      const readable = tools.filter((tool) => this.isReadOnly(tool));
      if (!readable.length)
        throw new MazeMcpError(
          "provider_validation_error",
          "Maze MCP exposed no verifiably non-mutating tools.",
        );
      return {
        toolCount: tools.length,
        readableToolCount: readable.length,
        mcpToolsVerified: true,
      };
    });
  }

  async callRead(accessToken: string, input: JsonObject) {
    const toolName = this.requiredString(input.toolName, "toolName", 160);
    if (MUTATION.test(toolName))
      throw new MazeMcpError(
        "policy_blocked",
        `Maze MCP tool ${toolName} appears mutating.`,
        403,
      );
    const args = this.object(input.arguments);
    this.rejectCredentialFields(args);
    if (Buffer.byteLength(JSON.stringify(args)) > 500_000)
      throw new MazeMcpError(
        "provider_validation_error",
        "Maze MCP arguments exceed 500 KB.",
      );
    return this.withSession(accessToken, async (session) => {
      const tool = (await this.listTools(accessToken, session)).find(
        (candidate) => candidate.name === toolName,
      );
      if (!tool || !this.isReadOnly(tool))
        throw new MazeMcpError(
          "policy_blocked",
          `Maze MCP tool ${toolName} is not a verified non-mutating tool.`,
          403,
        );
      const result = this.object(
        await this.rpc(accessToken, session, "tools/call", {
          name: tool.name,
          arguments: args,
        }),
      );
      if (result.isError === true)
        throw new MazeMcpError(
          "provider_validation_error",
          `Maze MCP ${toolName} failed.`,
        );
      return this.redactAndBound(result);
    });
  }

  private isReadOnly(tool: McpTool) {
    if (
      tool.annotations.destructiveHint === true ||
      tool.annotations.readOnlyHint === false
    )
      return false;
    if (tool.annotations.readOnlyHint === true) return true;
    return !MUTATION.test(tool.name) && !MUTATION_TEXT.test(tool.description);
  }

  private async withSession<T>(
    accessToken: string,
    fn: (session: Session) => Promise<T>,
  ) {
    if (!accessToken)
      throw new MazeMcpError(
        "credential_missing",
        "Maze OAuth access token is required.",
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
    if (!this.object(initialized.capabilities).tools)
      throw new MazeMcpError(
        "provider_validation_error",
        "Maze MCP did not advertise tool support.",
      );
    await this.notify(accessToken, session, "notifications/initialized", {});
    return fn(session);
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
        const value = this.object(item);
        const name = this.string(value.name);
        const schema = this.object(value.inputSchema);
        if (
          !name ||
          schema.type !== "object" ||
          tools.some((tool) => tool.name === name)
        )
          continue;
        tools.push({
          name: name.slice(0, 200),
          description: (this.string(value.description) ?? "").slice(0, 2_000),
          inputSchema: schema,
          annotations: this.object(value.annotations),
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
    if (Buffer.byteLength(raw) > 3_000_000)
      throw new MazeMcpError(
        "provider_validation_error",
        "Maze MCP response exceeds 3 MB.",
      );
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload)
      throw new MazeMcpError(
        "provider_unavailable",
        "Maze MCP returned an empty response.",
        502,
      );
    if (payload.error)
      throw new MazeMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ??
          "Maze MCP request failed.",
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
      const response = await safeConnectorFetch("https://connect.maze.co/mcp", {
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
        cache: "no-store",
      });
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) session.id = sessionId;
      if (response.status === 401)
        throw new MazeMcpError(
          "credential_missing",
          "Maze MCP rejected the OAuth token.",
          401,
        );
      if (response.status === 403)
        throw new MazeMcpError(
          "insufficient_scope",
          "Maze MCP denied this capability.",
          403,
        );
      if (response.status === 429)
        throw new MazeMcpError(
          "provider_rate_limited",
          "Maze MCP rate limit reached.",
          429,
        );
      if (!response.ok && response.status !== 202 && response.status !== 204)
        throw new MazeMcpError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `Maze MCP returned HTTP ${response.status}.`,
          response.status,
        );
      return response;
    } catch (error) {
      if (error instanceof MazeMcpError) throw error;
      throw new MazeMcpError(
        "provider_unavailable",
        "Maze MCP could not be reached.",
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
    if (depth > 12)
      throw new MazeMcpError(
        "policy_blocked",
        "Maze MCP arguments are too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) =>
        this.rejectCredentialFields(item, depth + 1),
      );
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(
          key,
        )
      )
        throw new MazeMcpError(
          "policy_blocked",
          `Credential-bearing argument ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value))
      return value
        .slice(0, 200)
        .map((item) => this.redactAndBound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?key|cookie|recording.?url|signed.?url)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redactAndBound(item, depth + 1),
        ]),
    );
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new MazeMcpError(
        "provider_validation_error",
        `${name} is required and must be at most ${max} characters.`,
      );
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
