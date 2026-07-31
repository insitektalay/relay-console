import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = { name: string; inputSchema: JsonObject };
export type PeopleAiCredentials = { clientId: string; clientSecret: string };
export const PEOPLE_AI_READ_OPERATIONS = ["accounts.search"] as const;

export class PeopleAiMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class PeopleAiMcpAdapter {
  async health(credentials: PeopleAiCredentials) {
    return this.withSession(credentials, async (session) => {
      const compatible = this.findCompatibleTool(
        await this.listTools(credentials, session),
      );
      if (!compatible)
        throw new PeopleAiMcpError(
          "provider_validation_error",
          "People.ai MCP no longer matches Relay's pinned find_account schema.",
        );
      return { mcpToolsVerified: true, tools: [compatible.tool.name] };
    });
  }

  async read(
    credentials: PeopleAiCredentials,
    operation: string,
    query: unknown,
  ) {
    if (!PEOPLE_AI_READ_OPERATIONS.includes(operation as never))
      throw new PeopleAiMcpError(
        "policy_blocked",
        "People.ai operation is not in Relay's pinned account-search contract.",
        403,
      );
    const value = this.query(query);
    return this.withSession(credentials, async (session) => {
      const compatible = this.findCompatibleTool(
        await this.listTools(credentials, session),
      );
      if (!compatible)
        throw new PeopleAiMcpError(
          "provider_validation_error",
          "People.ai MCP find_account is missing or its single-string schema changed.",
        );
      const result = this.object(
        await this.rpc(credentials, session, "tools/call", {
          name: compatible.tool.name,
          arguments: { [compatible.argument]: value },
        }),
      );
      if (result.isError === true)
        throw new PeopleAiMcpError(
          "provider_validation_error",
          "People.ai MCP find_account failed.",
        );
      return this.redactAndBound(result);
    });
  }

  private findCompatibleTool(tools: McpTool[]) {
    const tool = tools.find((candidate) => candidate.name === "find_account");
    if (!tool || tool.inputSchema.type !== "object") return null;
    const properties = this.object(tool.inputSchema.properties);
    const required = Array.isArray(tool.inputSchema.required)
      ? tool.inputSchema.required.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
    if (required.length !== 1) return null;
    const argument = required[0];
    if (this.object(properties[argument]).type !== "string") return null;
    return { tool, argument };
  }

  private query(value: unknown) {
    if (
      typeof value !== "string" ||
      value.trim().length < 2 ||
      value.trim().length > 160 ||
      /[\r\n]/.test(value)
    )
      throw new PeopleAiMcpError(
        "provider_validation_error",
        "People.ai account query must contain 2 to 160 characters.",
      );
    return value.trim();
  }

  private async withSession<T>(
    credentials: PeopleAiCredentials,
    fn: (session: Session) => Promise<T>,
  ) {
    this.requireCredentials(credentials);
    const session: Session = { requestId: 1 };
    const initialized = this.object(
      await this.rpc(credentials, session, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "Relay Console Railway", version: "1.0" },
      }),
    );
    if (!this.object(initialized.capabilities).tools)
      throw new PeopleAiMcpError(
        "provider_validation_error",
        "People.ai MCP did not advertise tool support.",
      );
    await this.notify(credentials, session, "notifications/initialized", {});
    return fn(session);
  }

  private async listTools(credentials: PeopleAiCredentials, session: Session) {
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
        const value = this.object(item);
        const name = this.string(value.name);
        const inputSchema = this.object(value.inputSchema);
        if (
          name &&
          inputSchema.type === "object" &&
          !tools.some((tool) => tool.name === name)
        )
          tools.push({ name: name.slice(0, 200), inputSchema });
        if (tools.length >= 100) return tools;
      }
      cursor = this.string(result.nextCursor);
      if (!cursor) break;
    }
    return tools;
  }

  private async rpc(
    credentials: PeopleAiCredentials,
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
    if (Buffer.byteLength(raw) > 2_500_000)
      throw new PeopleAiMcpError(
        "provider_validation_error",
        "People.ai MCP response exceeds 2.5 MB.",
      );
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload)
      throw new PeopleAiMcpError(
        "provider_unavailable",
        "People.ai MCP returned an empty response.",
        502,
      );
    if (payload.error)
      throw new PeopleAiMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ??
          "People.ai MCP request failed.",
      );
    return payload.result;
  }

  private async notify(
    credentials: PeopleAiCredentials,
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
    credentials: PeopleAiCredentials,
    session: Session,
    body: JsonObject,
  ) {
    try {
      const response = await safeConnectorFetch("https://mcp.people.ai/mcp", {
        method: "POST",
        headers: {
          "PAI-Client-Id": credentials.clientId,
          "PAI-Client-Secret": credentials.clientSecret,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-06-18",
          ...(session.id ? { "Mcp-Session-Id": session.id } : {}),
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) session.id = sessionId;
      if (response.status === 401)
        throw new PeopleAiMcpError(
          "credential_missing",
          "People.ai MCP rejected the client credentials.",
          401,
        );
      if (response.status === 403)
        throw new PeopleAiMcpError(
          "insufficient_scope",
          "People.ai MCP denied this capability.",
          403,
        );
      if (response.status === 429)
        throw new PeopleAiMcpError(
          "provider_rate_limited",
          "People.ai MCP rate limit reached.",
          429,
        );
      if (!response.ok && response.status !== 202 && response.status !== 204)
        throw new PeopleAiMcpError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `People.ai MCP returned HTTP ${response.status}.`,
          response.status,
        );
      return response;
    } catch (error) {
      if (error instanceof PeopleAiMcpError) throw error;
      throw new PeopleAiMcpError(
        "provider_unavailable",
        "People.ai MCP could not be reached.",
        502,
      );
    }
  }

  private requireCredentials(credentials: PeopleAiCredentials) {
    for (const value of [credentials.clientId, credentials.clientSecret])
      if (!value || value.length > 16_000 || /[\r\n]/.test(value))
        throw new PeopleAiMcpError(
          "credential_missing",
          "Valid People.ai MCP client credentials are required.",
          401,
        );
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

  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string")
      return value
        .slice(0, 500_000)
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
        .replace(/\+?\d[\d ().-]{7,}\d/g, "[redacted]");
    if (Array.isArray(value))
      return value
        .slice(0, 50)
        .map((item) => this.redactAndBound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?key|cookie|email|phone|address|participant|contact|person|activity|meeting|message|notes?|summary|transcript|body|signed.?url)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redactAndBound(item, depth + 1),
        ]),
    );
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
