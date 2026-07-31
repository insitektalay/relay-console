import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = { name: string; inputSchema: JsonObject };

export const FIRSTPROMOTER_READ_OPERATIONS = [
  "company-context.get",
  "dashboard-stats.get",
  "dashboard-trending.get",
  "campaigns.list",
] as const;

const TOOL_BY_OPERATION: Record<
  (typeof FIRSTPROMOTER_READ_OPERATIONS)[number],
  string
> = {
  "company-context.get": "get_company_context",
  "dashboard-stats.get": "get_dashboard_stats",
  "dashboard-trending.get": "get_dashboard_trending",
  "campaigns.list": "list_campaigns",
};

export class FirstPromoterMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class FirstPromoterMcpAdapter {
  async health(accessToken: string) {
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      const verified = Object.values(TOOL_BY_OPERATION).filter((name) =>
        this.findCompatibleTool(tools, name),
      );
      if (verified.length !== Object.keys(TOOL_BY_OPERATION).length)
        throw new FirstPromoterMcpError(
          "provider_validation_error",
          "FirstPromoter MCP no longer matches Relay's four pinned zero-argument read schemas.",
        );
      return { mcpToolsVerified: true, tools: verified };
    });
  }

  async read(accessToken: string, operation: string) {
    if (!FIRSTPROMOTER_READ_OPERATIONS.includes(operation as never))
      throw new FirstPromoterMcpError(
        "policy_blocked",
        "FirstPromoter operation is not in Relay's pinned analytics contract.",
        403,
      );
    const toolName =
      TOOL_BY_OPERATION[
        operation as (typeof FIRSTPROMOTER_READ_OPERATIONS)[number]
      ];
    return this.withSession(accessToken, async (session) => {
      const tool = this.findCompatibleTool(
        await this.listTools(accessToken, session),
        toolName,
      );
      if (!tool)
        throw new FirstPromoterMcpError(
          "provider_validation_error",
          `FirstPromoter MCP tool ${toolName} is missing or its zero-argument schema changed.`,
        );
      const result = this.object(
        await this.rpc(accessToken, session, "tools/call", {
          name: tool.name,
          arguments: {},
        }),
      );
      if (result.isError === true)
        throw new FirstPromoterMcpError(
          "provider_validation_error",
          `FirstPromoter MCP ${toolName} failed.`,
        );
      return this.redactAndBound(result);
    });
  }

  private findCompatibleTool(tools: McpTool[], name: string) {
    return tools.find((tool) => {
      if (tool.name !== name || tool.inputSchema.type !== "object")
        return false;
      const required = Array.isArray(tool.inputSchema.required)
        ? tool.inputSchema.required
        : [];
      return required.length === 0;
    });
  }

  private async withSession<T>(
    accessToken: string,
    fn: (session: Session) => Promise<T>,
  ) {
    if (!accessToken)
      throw new FirstPromoterMcpError(
        "credential_missing",
        "FirstPromoter OAuth access token is required.",
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
      throw new FirstPromoterMcpError(
        "provider_validation_error",
        "FirstPromoter MCP did not advertise tool support.",
      );
    await this.notify(accessToken, session, "notifications/initialized", {});
    return fn(session);
  }

  private async listTools(accessToken: string, session: Session) {
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
    if (Buffer.byteLength(raw) > 2_500_000)
      throw new FirstPromoterMcpError(
        "provider_validation_error",
        "FirstPromoter MCP response exceeds 2.5 MB.",
      );
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload)
      throw new FirstPromoterMcpError(
        "provider_unavailable",
        "FirstPromoter MCP returned an empty response.",
        502,
      );
    if (payload.error)
      throw new FirstPromoterMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ??
          "FirstPromoter MCP request failed.",
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
      const response = await safeConnectorFetch("https://mcp.firstpromoter.com", {
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
        throw new FirstPromoterMcpError(
          "credential_missing",
          "FirstPromoter MCP rejected the OAuth token.",
          401,
        );
      if (response.status === 403)
        throw new FirstPromoterMcpError(
          "insufficient_scope",
          "FirstPromoter MCP denied this capability.",
          403,
        );
      if (response.status === 429)
        throw new FirstPromoterMcpError(
          "provider_rate_limited",
          "FirstPromoter MCP rate limit reached.",
          429,
        );
      if (!response.ok && response.status !== 202 && response.status !== 204)
        throw new FirstPromoterMcpError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `FirstPromoter MCP returned HTTP ${response.status}.`,
          response.status,
        );
      return response;
    } catch (error) {
      if (error instanceof FirstPromoterMcpError) throw error;
      throw new FirstPromoterMcpError(
        "provider_unavailable",
        "FirstPromoter MCP could not be reached.",
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

  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value))
      return value
        .slice(0, 100)
        .map((item) => this.redactAndBound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?key|cookie|email|address|phone|vat|tax|paypal|payout|signed.?url)/i.test(
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
