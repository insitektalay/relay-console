import { Injectable, Logger } from "@nestjs/common";
import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = { name: string; inputSchema: JsonObject };

export const JOTFORM_MCP_URL = "https://mcp.jotform.com";
export const JOTFORM_MCP_RESOURCE = "https://mcp.jotform.com";
export const JOTFORM_MCP_REGISTRATION_URL =
  "https://oauth2.jotform.com/register-public-client";

export const JOTFORM_MCP_READ_TOOLS = ["form_list", "get_submissions"] as const;

export const JOTFORM_MCP_WRITE_TOOLS = ["create_form", "edit_form"] as const;

const JOTFORM_MCP_TOOL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  form_list: ["form_list", "list_forms", "search"],
};

const JOTFORM_OPERATION_ALIASES: Readonly<Record<string, string>> = {
  "user.forms.list": "form_list",
};

export class JotformMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class JotformMcpAdapter {
  private readonly logger = new Logger(JotformMcpAdapter.name);

  private readonly publicClientRegistrations = new Map<
    string,
    Promise<{ clientId: string }>
  >();

  async registerPublicClient(redirectUri: string) {
    const existing = this.publicClientRegistrations.get(redirectUri);
    if (existing) return existing;

    const registration = this.performPublicClientRegistration(redirectUri);
    this.publicClientRegistrations.set(redirectUri, registration);
    try {
      return await registration;
    } catch (error) {
      if (error instanceof JotformMcpError) throw error;
      throw new JotformMcpError(
        "provider_unavailable",
        "Jotform took too long to prepare secure sign-in. Please try again.",
        503,
      );
    } finally {
      if (this.publicClientRegistrations.get(redirectUri) === registration) {
        this.publicClientRegistrations.delete(redirectUri);
      }
    }
  }

  private async performPublicClientRegistration(redirectUri: string) {
    const response = await safeConnectorFetch(JOTFORM_MCP_REGISTRATION_URL, {
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
        token_endpoint_auth_method: "none",
        scope: "readOnly full",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const body = this.object(await response.json().catch(() => ({})));
    const clientId = this.string(body.client_id);
    if (!response.ok || !clientId) {
      throw new JotformMcpError(
        "provider_unavailable",
        "Jotform could not prepare secure sign-in. Please try again.",
        response.status || 502,
      );
    }
    return { clientId: clientId.slice(0, 500) };
  }

  async health(
    accessToken: string,
    grantedScope: "readOnly" | "full" = "full",
  ) {
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      const requiredTools =
        grantedScope === "full"
          ? [...JOTFORM_MCP_READ_TOOLS, ...JOTFORM_MCP_WRITE_TOOLS]
          : [...JOTFORM_MCP_READ_TOOLS];
      for (const required of requiredTools) {
        if (!this.resolveTool(tools, required)) {
          this.logger.warn(
            JSON.stringify({
              event: "jotform.mcp.tool_surface_mismatch",
              grantedScope,
              requiredTool: required,
              availableTools: tools
                .map((tool) => tool.name)
                .filter((name) => /^[a-z][a-z0-9_]{0,119}$/.test(name))
                .slice(0, 50),
            }),
          );
          throw new JotformMcpError(
            "provider_validation_error",
            `Jotform MCP did not expose the documented ${required} tool with a valid object schema.`,
          );
        }
      }
      const discoveryTool = this.resolveTool(tools, "form_list")!;
      const discoveryResult = this.object(
        await this.rpc(accessToken, session, "tools/call", {
          name: discoveryTool.name,
          arguments: this.argumentsForResolvedTool(
            "form_list",
            discoveryTool,
            {},
          ),
        }),
      );
      if (discoveryResult.isError === true) {
        const providerMessage = this.providerErrorMessage(discoveryResult);
        throw new JotformMcpError(
          "provider_validation_error",
          providerMessage
            ? `Jotform MCP form discovery failed: ${providerMessage}`
            : "Jotform MCP form discovery failed.",
        );
      }
      return {
        toolCount: tools.length,
        documentedToolsVerified: true,
        readToolCount: JOTFORM_MCP_READ_TOOLS.length,
        writeToolCount:
          grantedScope === "full" ? JOTFORM_MCP_WRITE_TOOLS.length : 0,
      };
    });
  }

  callRead(accessToken: string, input: JsonObject) {
    return this.callAllowed(
      accessToken,
      input,
      new Set<string>(JOTFORM_MCP_READ_TOOLS),
    );
  }

  callWrite(accessToken: string, input: JsonObject) {
    return this.callAllowed(
      accessToken,
      input,
      new Set<string>(JOTFORM_MCP_WRITE_TOOLS),
    );
  }

  private async callAllowed(
    accessToken: string,
    input: JsonObject,
    allowed: Set<string>,
  ) {
    const toolName = this.requestedToolName(input);
    if (!allowed.has(toolName)) {
      throw new JotformMcpError(
        "policy_blocked",
        `Jotform MCP tool ${toolName} is not allowed by this Relay action.`,
        403,
      );
    }
    const args = this.object(input.arguments);
    this.rejectCredentialFields(args);
    if (Buffer.byteLength(JSON.stringify(args)) > 1_000_000) {
      throw new JotformMcpError(
        "provider_validation_error",
        "Jotform MCP arguments exceed 1 MB.",
      );
    }
    return this.withSession(accessToken, async (session) => {
      const tool = this.resolveTool(
        await this.listTools(accessToken, session),
        toolName,
      );
      if (!tool) {
        throw new JotformMcpError(
          "provider_validation_error",
          `Jotform MCP did not expose ${toolName} with a valid object schema.`,
        );
      }
      const toolArguments = this.argumentsForResolvedTool(toolName, tool, args);
      const result = this.object(
        await this.rpc(accessToken, session, "tools/call", {
          name: tool.name,
          arguments: toolArguments,
        }),
      );
      if (result.isError === true) {
        const providerMessage = this.providerErrorMessage(result);
        this.logger.warn(
          JSON.stringify({
            event: "jotform.mcp.tool_call_rejected",
            canonicalTool: toolName,
            resolvedTool: tool.name,
            requiredArguments: Array.isArray(tool.inputSchema.required)
              ? tool.inputSchema.required
                  .filter((value): value is string => typeof value === "string")
                  .slice(0, 25)
              : [],
            argumentProperties: Object.keys(
              this.object(tool.inputSchema.properties),
            ).slice(0, 50),
            providedArguments: Object.keys(toolArguments).slice(0, 50),
            structuredProviderMessage: providerMessage ?? null,
          }),
        );
        throw new JotformMcpError(
          "provider_validation_error",
          providerMessage
            ? `Jotform MCP ${toolName} failed: ${providerMessage}`
            : `Jotform MCP ${toolName} failed.`,
        );
      }
      return this.redactAndBound(result);
    });
  }

  private resolveTool(tools: McpTool[], canonicalName: string) {
    const acceptedNames = JOTFORM_MCP_TOOL_ALIASES[canonicalName] ?? [
      canonicalName,
    ];
    return tools.find((tool) => acceptedNames.includes(tool.name));
  }

  private requestedToolName(input: JsonObject) {
    const explicitToolName = this.string(input.toolName);
    if (explicitToolName) {
      return this.requiredString(explicitToolName, "toolName", 120);
    }
    const operation = this.requiredString(input.operation, "operation", 120);
    return JOTFORM_OPERATION_ALIASES[operation] ?? operation;
  }

  private argumentsForResolvedTool(
    canonicalName: string,
    tool: McpTool,
    args: JsonObject,
  ) {
    if (canonicalName === "form_list" && tool.name === "search") {
      const required = Array.isArray(tool.inputSchema.required)
        ? tool.inputSchema.required
        : [];
      const query =
        this.string(args.user_query) ??
        this.string(args.query) ??
        "list accessible forms";
      if (required.includes("user_query")) {
        const { query: _legacyQuery, ...rest } = args;
        return { ...rest, user_query: query };
      }
      if (required.includes("query") && !this.string(args.query)) {
        return { ...args, query };
      }
    }
    return args;
  }

  private async withSession<T>(
    accessToken: string,
    operation: (session: Session) => Promise<T>,
  ) {
    if (!accessToken) {
      throw new JotformMcpError(
        "credential_missing",
        "Jotform OAuth access token is required.",
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
      throw new JotformMcpError(
        "provider_validation_error",
        "Jotform MCP did not advertise tool support.",
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
        if (tools.length >= 50) return tools;
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
      throw new JotformMcpError(
        "provider_validation_error",
        "Jotform MCP response exceeds 5 MB.",
      );
    }
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload) {
      throw new JotformMcpError(
        "provider_unavailable",
        "Jotform MCP returned an empty response.",
        502,
      );
    }
    if (payload.error) {
      throw new JotformMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ??
          "Jotform MCP request failed.",
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
    const response = await safeConnectorFetch(JOTFORM_MCP_URL, {
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
      throw new JotformMcpError(
        "credential_missing",
        "Jotform MCP rejected the OAuth token.",
        401,
      );
    }
    if (response.status === 403) {
      throw new JotformMcpError(
        "insufficient_scope",
        "Jotform MCP denied this capability.",
        403,
      );
    }
    if (response.status === 429) {
      throw new JotformMcpError(
        "provider_rate_limited",
        "Jotform MCP rate limited the request.",
        429,
      );
    }
    if (!response.ok) {
      throw new JotformMcpError(
        "provider_unavailable",
        `Jotform MCP returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return response;
  }

  private payloads(raw: string): JsonObject[] {
    const payloads: JsonObject[] = [];
    const candidates = raw.includes("data:")
      ? raw
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
      : [raw.trim()];
    for (const candidate of candidates) {
      if (!candidate || candidate === "[DONE]") continue;
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          payloads.push(parsed as JsonObject);
        }
      } catch {
        throw new JotformMcpError(
          "provider_validation_error",
          "Jotform MCP returned invalid JSON.",
        );
      }
    }
    return payloads;
  }

  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value)) {
      return value
        .slice(0, 1_000)
        .map((item) => this.redactAndBound(item, depth + 1));
    }
    if (!value || typeof value !== "object") {
      return typeof value === "string" ? value.slice(0, 100_000) : value;
    }
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, item]) => [
          key,
          /token|secret|password|api[_-]?key|authorization/i.test(key)
            ? "[redacted]"
            : this.redactAndBound(item, depth + 1),
        ]),
    );
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12) {
      throw new JotformMcpError(
        "provider_validation_error",
        "Jotform MCP arguments are nested too deeply.",
      );
    }
    if (Array.isArray(value)) {
      for (const item of value) this.rejectCredentialFields(item, depth + 1);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (/token|secret|password|api[_-]?key|authorization/i.test(key)) {
        throw new JotformMcpError(
          "policy_blocked",
          `Jotform MCP arguments may not contain credential field ${key}.`,
          403,
        );
      }
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private providerErrorMessage(result: JsonObject) {
    for (const item of Array.isArray(result.content) ? result.content : []) {
      const text = this.string(this.object(item).text);
      if (!text) continue;
      try {
        const parsed = this.object(JSON.parse(text));
        const message =
          this.string(parsed.message) ??
          this.string(this.object(parsed.error).message);
        if (message) return message.slice(0, 300);
      } catch {
        // Do not expose unstructured provider text. It can contain user data.
      }
    }
    return undefined;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private requiredString(value: unknown, label: string, maxLength: number) {
    const result = this.string(value);
    if (!result || result.length > maxLength) {
      throw new JotformMcpError(
        "provider_validation_error",
        `${label} is required and must be at most ${maxLength} characters.`,
      );
    }
    return result;
  }
}
