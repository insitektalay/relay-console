import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = { name: string; inputSchema: JsonObject };

export const ADOBE_ANALYTICS_READ_TOOLS = [
  "describeAa",
  "findCompanies",
  "findReportSuites",
  "findDimensions",
  "findMetrics",
  "findDateRanges",
  "findSegments",
  "findProjects",
  "describeSegment",
  "describeCalculatedMetric",
  "listComponentUsage",
  "listFrequentlyUsedWith",
  "runReport",
] as const;

export class AdobeAnalyticsMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class AdobeAnalyticsMcpAdapter {
  async health(accessToken: string) {
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      for (const required of ADOBE_ANALYTICS_READ_TOOLS) {
        if (!tools.some((tool) => tool.name === required))
          throw new AdobeAnalyticsMcpError(
            "provider_validation_error",
            `Adobe Analytics MCP did not expose documented read tool ${required}.`,
          );
      }
      return {
        toolCount: tools.length,
        documentedReadToolsVerified: true,
        readToolCount: ADOBE_ANALYTICS_READ_TOOLS.length,
      };
    });
  }

  callRead(accessToken: string, input: JsonObject) {
    return this.callAllowed(
      accessToken,
      input,
      new Set<string>(ADOBE_ANALYTICS_READ_TOOLS),
    );
  }

  private async callAllowed(
    accessToken: string,
    input: JsonObject,
    allowed: Set<string>,
  ) {
    const toolName = this.requiredString(input.toolName, "toolName", 120);
    if (!allowed.has(toolName))
      throw new AdobeAnalyticsMcpError(
        "policy_blocked",
        `Adobe Analytics MCP tool ${toolName} is not allowed by this Relay action.`,
        403,
      );
    const args = this.object(input.arguments);
    this.rejectCredentialFields(args);
    if (Buffer.byteLength(JSON.stringify(args)) > 250_000)
      throw new AdobeAnalyticsMcpError(
        "provider_validation_error",
        "Adobe Analytics MCP arguments exceed 250 KB.",
      );
    if (
      toolName === "runReport" &&
      typeof args.limit === "number" &&
      (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100)
    )
      throw new AdobeAnalyticsMcpError(
        "policy_blocked",
        "Adobe Analytics reports are limited to 100 rows.",
        403,
      );
    return this.withSession(accessToken, async (session) => {
      const tool = (await this.listTools(accessToken, session)).find(
        (candidate) => candidate.name === toolName,
      );
      if (!tool)
        throw new AdobeAnalyticsMcpError(
          "provider_validation_error",
          `Adobe Analytics MCP did not expose ${toolName} with a valid object schema.`,
        );
      const result = this.object(
        await this.rpc(accessToken, session, "tools/call", {
          name: tool.name,
          arguments: args,
        }),
      );
      if (result.isError === true)
        throw new AdobeAnalyticsMcpError(
          "provider_validation_error",
          `Adobe Analytics MCP ${toolName} failed.`,
        );
      return this.redactAndBound(result);
    });
  }

  private async withSession<T>(
    accessToken: string,
    fn: (session: Session) => Promise<T>,
  ) {
    if (!accessToken)
      throw new AdobeAnalyticsMcpError(
        "credential_missing",
        "Adobe Analytics OAuth access token is required.",
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
      throw new AdobeAnalyticsMcpError(
        "provider_validation_error",
        "Adobe Analytics MCP did not advertise tool support.",
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
      throw new AdobeAnalyticsMcpError(
        "provider_validation_error",
        "Adobe Analytics MCP response exceeds 5 MB.",
      );
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload)
      throw new AdobeAnalyticsMcpError(
        "provider_unavailable",
        "Adobe Analytics MCP returned an empty response.",
        502,
      );
    if (payload.error)
      throw new AdobeAnalyticsMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ??
          "Adobe Analytics MCP request failed.",
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
      const response = await safeConnectorFetch("https://aa-mcp.adobe.io/mcp", {
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
      if (response.status === 401)
        throw new AdobeAnalyticsMcpError(
          "credential_missing",
          "Adobe Analytics MCP rejected the OAuth token.",
          401,
        );
      if (response.status === 403)
        throw new AdobeAnalyticsMcpError(
          "insufficient_scope",
          "Adobe Analytics MCP denied this capability.",
          403,
        );
      if (response.status === 429)
        throw new AdobeAnalyticsMcpError(
          "provider_rate_limited",
          "Adobe Analytics MCP rate limit reached.",
          429,
        );
      if (!response.ok && response.status !== 202 && response.status !== 204)
        throw new AdobeAnalyticsMcpError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `Adobe Analytics MCP returned HTTP ${response.status}.`,
          response.status,
        );
      return response;
    } catch (error) {
      if (error instanceof AdobeAnalyticsMcpError) throw error;
      throw new AdobeAnalyticsMcpError(
        "provider_unavailable",
        "Adobe Analytics MCP could not be reached.",
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
      throw new AdobeAnalyticsMcpError(
        "provider_validation_error",
        "Adobe Analytics MCP arguments are too deeply nested.",
      );
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (/(token|secret|password|authorization|cookie|credential)/i.test(key))
        throw new AdobeAnalyticsMcpError(
          "policy_blocked",
          "Credential-like fields are not allowed in Adobe Analytics MCP arguments.",
          403,
        );
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private redactAndBound(value: JsonObject) {
    const text = JSON.stringify(value, (key, item) =>
      /(token|secret|password|authorization|cookie|credential)/i.test(key)
        ? "[REDACTED]"
        : item,
    );
    if (Buffer.byteLength(text) > 5_000_000)
      throw new AdobeAnalyticsMcpError(
        "provider_validation_error",
        "Adobe Analytics MCP result exceeds 5 MB.",
      );
    return JSON.parse(text) as JsonObject;
  }

  private requiredString(value: unknown, label: string, max: number) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > max ||
      /[\r\n]/.test(value)
    )
      throw new AdobeAnalyticsMcpError(
        "provider_validation_error",
        `${label} is invalid.`,
      );
    return value.trim();
  }

  private string(value: unknown) {
    return typeof value === "string" ? value : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
