import { Injectable } from "@nestjs/common";
import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = {
  name: string;
  inputSchema: JsonObject;
  annotations: JsonObject;
};

export const CRAFT_MCP_URL = "https://mcp.craft.do/my/mcp";
export const CRAFT_MCP_RESOURCE = "https://mcp.craft.do/my";
export const CRAFT_MCP_REGISTRATION_URL =
  "https://mcp.craft.do/my/auth/register";

export class CraftMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class CraftMcpAdapter {
  private readonly registrations = new Map<
    string,
    Promise<{ clientId: string; clientSecret: string }>
  >();

  async registerClient(redirectUri: string) {
    const existing = this.registrations.get(redirectUri);
    if (existing) return existing;
    const registration = this.performRegistration(redirectUri);
    this.registrations.set(redirectUri, registration);
    try {
      return await registration;
    } finally {
      if (this.registrations.get(redirectUri) === registration)
        this.registrations.delete(redirectUri);
    }
  }

  private async performRegistration(redirectUri: string) {
    try {
      const response = await safeConnectorFetch(CRAFT_MCP_REGISTRATION_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_name: "Relay Console",
          redirect_uris: [redirectUri],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "client_secret_post",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      const body = this.object(await response.json().catch(() => ({})));
      const clientId = this.string(body.client_id);
      const clientSecret = this.string(body.client_secret);
      if (!response.ok || !clientId || !clientSecret)
        throw new CraftMcpError(
          "provider_unavailable",
          "Craft could not prepare secure sign-in. Please try again.",
          response.status || 502,
        );
      return {
        clientId: clientId.slice(0, 500),
        clientSecret: clientSecret.slice(0, 2_000),
      };
    } catch (error) {
      if (error instanceof CraftMcpError) throw error;
      throw new CraftMcpError(
        "provider_unavailable",
        "Craft could not prepare secure sign-in. Please try again.",
        503,
      );
    }
  }

  async health(accessToken: string) {
    return this.withSession(accessToken, async (session) => {
      const tools = (await this.listTools(accessToken, session)).filter(
        (tool) => this.isSupportedTool(tool),
      );
      if (!tools.length)
        throw new CraftMcpError(
          "provider_validation_error",
          "Craft MCP did not expose any valid tools for the selected space.",
        );
      const readToolCount = tools.filter((tool) =>
        this.isReadTool(tool),
      ).length;
      return {
        toolCount: tools.length,
        readToolCount,
        manageToolCount: tools.length - readToolCount,
        liveToolsVerified: true,
      };
    });
  }

  callRead(accessToken: string, input: JsonObject) {
    return this.callAllowed(accessToken, input, true);
  }

  discoverTools(accessToken: string) {
    return this.withSession(accessToken, async (session) =>
      (await this.listTools(accessToken, session))
        .filter((tool) => this.isSupportedTool(tool))
        .map((tool) => ({
          name: tool.name,
          inputSchema: this.redactAndBound(tool.inputSchema),
          readOnly: this.isReadTool(tool),
        })),
    );
  }

  callManage(accessToken: string, input: JsonObject) {
    return this.callAllowed(accessToken, input, false);
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
      throw new CraftMcpError(
        "provider_validation_error",
        "Craft MCP arguments exceed 1 MB.",
      );
    return this.withSession(accessToken, async (session) => {
      const tool = (await this.listTools(accessToken, session)).find(
        (candidate) =>
          candidate.name === toolName && this.isSupportedTool(candidate),
      );
      if (!tool)
        throw new CraftMcpError(
          "provider_validation_error",
          `Craft MCP did not expose ${toolName} with a valid object schema.`,
        );
      if (this.isReadTool(tool) !== readAction)
        throw new CraftMcpError(
          "policy_blocked",
          readAction
            ? `Craft MCP tool ${toolName} is not provider-declared read-only.`
            : `Craft MCP tool ${toolName} belongs to the read action.`,
          403,
        );
      const result = this.object(
        await this.rpc(accessToken, session, "tools/call", {
          name: tool.name,
          arguments: args,
        }),
      );
      if (result.isError === true)
        throw new CraftMcpError(
          "provider_validation_error",
          `Craft MCP ${toolName} failed.`,
        );
      return this.redactAndBound(result);
    });
  }

  private isReadTool(tool: McpTool) {
    return tool.annotations.readOnlyHint === true;
  }

  private isSupportedTool(tool: McpTool) {
    const name = tool.name.toLowerCase();
    if (
      /(admin|billing|member|permission|webhook|integration|export|import)/.test(
        name,
      )
    )
      return false;
    return /(block|document|collection|folder|task|search|daily|note|tag)/.test(
      name,
    );
  }

  private async withSession<T>(
    accessToken: string,
    operation: (session: Session) => Promise<T>,
  ) {
    if (!accessToken)
      throw new CraftMcpError(
        "credential_missing",
        "Craft OAuth access token is required.",
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
      throw new CraftMcpError(
        "provider_validation_error",
        "Craft MCP did not advertise tool support.",
      );
    await this.notify(accessToken, session, "notifications/initialized", {});
    return operation(session);
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
        const annotations = this.object(tool.annotations);
        if (
          !name ||
          inputSchema.type !== "object" ||
          typeof annotations.readOnlyHint !== "boolean" ||
          tools.some((candidate) => candidate.name === name)
        )
          continue;
        tools.push({ name: name.slice(0, 200), inputSchema, annotations });
        if (tools.length >= 100) return tools;
      }
      cursor = this.string(result.nextCursor);
      if (!cursor) break;
    }
    return tools;
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

  private async rpc(
    accessToken: string,
    session: Session,
    method: string,
    params: JsonObject,
  ) {
    const id = session.requestId++;
    const payload = await this.request(accessToken, session, {
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    if (!payload)
      throw new CraftMcpError(
        "provider_unavailable",
        "Craft MCP returned an empty response.",
        502,
      );
    const error = this.object(payload.error);
    if (Object.keys(error).length)
      throw new CraftMcpError(
        "provider_validation_error",
        this.string(error.message) ?? "Craft MCP request failed.",
      );
    return payload.result;
  }

  private async request(
    accessToken: string,
    session: Session,
    body: JsonObject,
  ): Promise<JsonObject | null> {
    try {
      const response = await safeConnectorFetch(CRAFT_MCP_URL, {
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
      if (sessionId) session.id = sessionId.slice(0, 500);
      if (response.status === 401)
        throw new CraftMcpError(
          "credential_missing",
          "Craft MCP rejected the OAuth token.",
          401,
        );
      if (response.status === 403)
        throw new CraftMcpError(
          "insufficient_scope",
          "Craft MCP denied this operation for the selected space.",
          403,
        );
      if (response.status === 429)
        throw new CraftMcpError(
          "provider_rate_limited",
          "Craft MCP rate limit reached.",
          429,
        );
      if (!response.ok && response.status !== 202 && response.status !== 204)
        throw new CraftMcpError(
          response.status >= 500
            ? "provider_unavailable"
            : "provider_validation_error",
          `Craft MCP returned HTTP ${response.status}.`,
          response.status,
        );
      if (response.status === 202 || response.status === 204) return null;
      const raw = await response.text();
      if (Buffer.byteLength(raw) > 5_000_000)
        throw new CraftMcpError(
          "provider_validation_error",
          "Craft MCP response exceeds 5 MB.",
        );
      return this.parseResponse(
        raw,
        response.headers.get("content-type") ?? "",
      );
    } catch (error) {
      if (error instanceof CraftMcpError) throw error;
      throw new CraftMcpError(
        "provider_unavailable",
        "Craft MCP could not be reached.",
        502,
      );
    }
  }

  private parseResponse(raw: string, contentType: string) {
    if (!raw.trim()) return null;
    if (contentType.includes("text/event-stream")) {
      const data = raw
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter((line) => line && line !== "[DONE]")
        .at(-1);
      return data ? this.object(JSON.parse(data)) : null;
    }
    return this.object(JSON.parse(raw));
  }

  private rejectCredentialFields(value: unknown, depth = 0): void {
    if (depth > 12)
      throw new CraftMcpError(
        "policy_blocked",
        "Craft MCP arguments are too deeply nested.",
        403,
      );
    if (Array.isArray(value)) {
      if (value.length > 500)
        throw new CraftMcpError(
          "provider_validation_error",
          "Craft MCP arrays exceed 500 items.",
        );
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 500)
      throw new CraftMcpError(
        "provider_validation_error",
        "Craft MCP objects exceed 500 fields.",
      );
    for (const [key, item] of entries) {
      if (
        /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(
          key,
        )
      )
        throw new CraftMcpError(
          "policy_blocked",
          `Credential-bearing argument ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 14) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 250_000);
    if (Array.isArray(value))
      return value
        .slice(0, 1_000)
        .map((item) => this.redactAndBound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .filter(
          ([key]) =>
            !/(token|secret|password|credential|authorization|api.?key|cookie)/i.test(
              key,
            ),
        )
        .slice(0, 1_000)
        .map(([key, item]) => [key, this.redactAndBound(item, depth + 1)]),
    );
  }

  private requiredString(value: unknown, field: string, maxLength: number) {
    const result = this.string(value)?.trim();
    if (!result || result.length > maxLength)
      throw new CraftMcpError(
        "provider_validation_error",
        `Craft ${field} is required and must be at most ${maxLength} characters.`,
      );
    return result;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private string(value: unknown) {
    return typeof value === "string" ? value : null;
  }
}
