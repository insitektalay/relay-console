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

const MUTATION_NAME =
  /(^|[_.-])(add|apply|archive|create|delete|destroy|edit|generate|move|overwrite|publish|remove|rename|replace|restore|run|set|tag|transform|update|upload)([_.-]|$)/i;
const MUTATION_TEXT =
  /\b(add|apply|archive|create|delete|destroy|edit|generate|move|overwrite|publish|remove|rename|replace|restore|run|set|tag|transform|update|upload)\b/i;

export class CloudinaryMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class CloudinaryMcpAdapter {
  async health(accessToken: string) {
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      if (!tools.length)
        throw new CloudinaryMcpError(
          "provider_validation_error",
          "Cloudinary Asset Management MCP exposed no tools with valid object schemas.",
        );
      const readToolCount = tools.filter((tool) =>
        this.isReadOnly(tool),
      ).length;
      return {
        toolCount: tools.length,
        readToolCount,
        writeToolCount: tools.length - readToolCount,
        liveToolsVerified: true,
      };
    });
  }

  callRead(accessToken: string, input: JsonObject) {
    return this.callClassified(accessToken, input, true);
  }

  callWrite(accessToken: string, input: JsonObject) {
    return this.callClassified(accessToken, input, false);
  }

  private async callClassified(
    accessToken: string,
    input: JsonObject,
    requireReadOnly: boolean,
  ) {
    const toolName = this.requiredString(input.toolName, "toolName", 200);
    const args = this.object(input.arguments);
    this.rejectCredentialFields(args);
    if (Buffer.byteLength(JSON.stringify(args)) > 1_000_000)
      throw new CloudinaryMcpError(
        "provider_validation_error",
        "Cloudinary MCP arguments exceed 1 MB.",
      );
    return this.withSession(accessToken, async (session) => {
      const tool = (await this.listTools(accessToken, session)).find(
        (candidate) => candidate.name === toolName,
      );
      if (!tool)
        throw new CloudinaryMcpError(
          "provider_validation_error",
          `Cloudinary MCP did not expose ${toolName} with a valid object schema.`,
        );
      const readOnly = this.isReadOnly(tool);
      if (readOnly !== requireReadOnly) {
        throw new CloudinaryMcpError(
          "policy_blocked",
          requireReadOnly
            ? `Cloudinary MCP tool ${toolName} is mutating or unclassified and must use the write action.`
            : `Cloudinary MCP tool ${toolName} is verified as non-mutating and must use the read action.`,
          403,
        );
      }
      const result = this.object(
        await this.rpc(accessToken, session, "tools/call", {
          name: tool.name,
          arguments: args,
        }),
      );
      if (result.isError === true)
        throw new CloudinaryMcpError(
          "provider_validation_error",
          `Cloudinary MCP ${toolName} failed.`,
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
    return (
      !MUTATION_NAME.test(tool.name) && !MUTATION_TEXT.test(tool.description)
    );
  }

  private async withSession<T>(
    accessToken: string,
    fn: (session: Session) => Promise<T>,
  ) {
    if (!accessToken)
      throw new CloudinaryMcpError(
        "credential_missing",
        "Cloudinary OAuth access token is required.",
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
      throw new CloudinaryMcpError(
        "provider_validation_error",
        "Cloudinary MCP did not advertise tool support.",
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
    for (let page = 0; page < 8; page += 1) {
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
        const inputSchema = this.object(value.inputSchema);
        if (
          !name ||
          inputSchema.type !== "object" ||
          tools.some((tool) => tool.name === name)
        )
          continue;
        tools.push({
          name: name.slice(0, 200),
          description: (this.string(value.description) ?? "").slice(0, 4_000),
          inputSchema,
          annotations: this.object(value.annotations),
        });
        if (tools.length >= 200) return tools;
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
    if (Buffer.byteLength(raw) > 5_000_000)
      throw new CloudinaryMcpError(
        "provider_validation_error",
        "Cloudinary MCP response exceeds 5 MB.",
      );
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload)
      throw new CloudinaryMcpError(
        "provider_unavailable",
        "Cloudinary MCP returned an empty response.",
        502,
      );
    if (payload.error)
      throw new CloudinaryMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ??
          "Cloudinary MCP request failed.",
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
      const response = await safeConnectorFetch(
        "https://asset-management.mcp.cloudinary.com/mcp",
        {
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
        },
      );
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) session.id = sessionId;
      if (response.status === 401)
        throw new CloudinaryMcpError(
          "credential_missing",
          "Cloudinary MCP rejected the OAuth token.",
          401,
        );
      if (response.status === 403)
        throw new CloudinaryMcpError(
          "insufficient_scope",
          "Cloudinary MCP denied this capability.",
          403,
        );
      if (response.status === 429)
        throw new CloudinaryMcpError(
          "provider_rate_limited",
          "Cloudinary MCP rate limit reached.",
          429,
        );
      if (!response.ok && response.status !== 202 && response.status !== 204) {
        throw new CloudinaryMcpError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `Cloudinary MCP returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof CloudinaryMcpError) throw error;
      throw new CloudinaryMcpError(
        "provider_unavailable",
        "Cloudinary MCP could not be reached.",
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
      throw new CloudinaryMcpError(
        "policy_blocked",
        "Cloudinary MCP arguments are too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) =>
        this.rejectCredentialFields(item, depth + 1),
      );
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|password|credential|authorization|api.?key|cookie|cloudinary.?url)/i.test(
          key,
        )
      )
        throw new CloudinaryMcpError(
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
        .slice(0, 500)
        .map((item) => this.redactAndBound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?key|cookie|cloudinary.?url)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redactAndBound(item, depth + 1),
        ]),
    );
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new CloudinaryMcpError(
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
