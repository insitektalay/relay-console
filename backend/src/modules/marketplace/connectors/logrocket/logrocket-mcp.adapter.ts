import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type LogRocketCredentials = {
  apiKey: string;
  organizationId: string;
  projectId: string;
};

export class LogRocketMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class LogRocketMcpAdapter {
  private static readonly ORIGIN = "https://mcp.logrocket.com";
  private static readonly TOOL = "find_issues";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: LogRocketCredentials) {
    const tools = await this.withSession(credentials, (session) =>
      this.rpc(credentials, session, "tools/list", {}),
    );
    const names = this.tools(tools).map((tool) => this.string(tool.name));
    if (!names.includes(LogRocketMcpAdapter.TOOL))
      throw this.validation(
        "LogRocket's project-scoped issues toolset did not expose find_issues.",
      );
    return {
      apiKeyVerified: true,
      exactProjectBound: true,
      issuesToolsetOnly: true,
      toolName: LogRocketMcpAdapter.TOOL,
      sessionReplayReturned: false,
      writesEnabled: false,
    };
  }

  async findIssues(credentials: LogRocketCredentials, input: JsonObject) {
    const args = this.arguments(input.arguments);
    this.rejectCredentialFields(args);
    if (Buffer.byteLength(JSON.stringify(args)) > 64_000)
      throw this.validation(
        "LogRocket issue arguments exceed the 64 KB bound.",
      );
    return this.withSession(credentials, async (session) => {
      const listed = await this.rpc(credentials, session, "tools/list", {});
      const tool = this.tools(listed).find(
        (candidate) => this.string(candidate.name) === LogRocketMcpAdapter.TOOL,
      );
      if (!tool)
        throw this.validation(
          "LogRocket's project-scoped issues toolset did not expose find_issues.",
        );
      const schema = this.object(tool.inputSchema);
      if (schema.type !== "object")
        throw this.validation(
          "LogRocket returned an unsupported find_issues input schema.",
        );
      const result = this.object(
        await this.rpc(credentials, session, "tools/call", {
          name: LogRocketMcpAdapter.TOOL,
          arguments: args,
        }),
      );
      if (result.isError === true)
        throw this.validation("LogRocket reported that find_issues failed.");
      return {
        semanticReadContract: "logrocket-project-issues-v1",
        result: this.redactAndBound(result),
        exactProjectBound: true,
        issuesToolsetOnly: true,
        remoteToolName: LogRocketMcpAdapter.TOOL,
        sessionDiscoveryEnabled: false,
        sessionWatchingEnabled: false,
        metricsEnabled: false,
        galileoEnabled: false,
        organizationDiscoveryEnabled: false,
        projectDiscoveryEnabled: false,
        writesEnabled: false,
        automaticPagination: false,
        automaticRetries: false,
      };
    });
  }

  private async withSession<T>(
    credentials: LogRocketCredentials,
    operation: (session: { id?: string; requestId: number }) => Promise<T>,
  ) {
    this.validateCredentials(credentials);
    const session: { id?: string; requestId: number } = { requestId: 1 };
    const initialized = this.object(
      await this.rpc(credentials, session, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "Relay Console Railway", version: "1.0" },
      }),
    );
    if (!this.object(initialized.capabilities).tools)
      throw this.validation("LogRocket MCP did not advertise tool support.");
    await this.notify(credentials, session, "notifications/initialized", {});
    return operation(session);
  }

  private async rpc(
    credentials: LogRocketCredentials,
    session: { id?: string; requestId: number },
    method: string,
    params: JsonObject,
  ) {
    const id = session.requestId++;
    const response = await this.send(credentials, session, method, {
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    const payloads = this.payloads(await this.boundedText(response));
    const payload =
      payloads.find((candidate) => candidate.id === id) ?? payloads[0];
    if (!payload)
      throw new LogRocketMcpError(
        "provider_unavailable",
        "LogRocket MCP returned an empty response.",
        502,
      );
    if (payload.error)
      throw this.validation(
        this.string(this.object(payload.error).message) ??
          "LogRocket MCP request failed.",
      );
    return payload.result;
  }

  private async notify(
    credentials: LogRocketCredentials,
    session: { id?: string },
    method: string,
    params: JsonObject,
  ) {
    await this.send(credentials, session, method, {
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  private async send(
    credentials: LogRocketCredentials,
    session: { id?: string },
    method: string,
    body: JsonObject,
  ) {
    let response: Response;
    try {
      response = await this.request(this.endpoint(credentials), {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${credentials.apiKey.trim()}`,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-06-18",
          "Mcp-Method": method,
          "Mcp-Name": "Relay Console Railway",
          ...(session.id ? { "Mcp-Session-Id": session.id } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new LogRocketMcpError(
        "provider_unavailable",
        "LogRocket MCP could not be reached.",
        502,
      );
    }
    const sessionId = response.headers.get("mcp-session-id");
    if (sessionId) session.id = sessionId;
    if (!response.ok && response.status !== 202 && response.status !== 204)
      throw new LogRocketMcpError(
        this.errorCode(response.status),
        "LogRocket MCP rejected the bounded request.",
        response.status,
      );
    return response;
  }

  private endpoint(credentials: LogRocketCredentials) {
    const organizationId = this.safeId(
      credentials.organizationId,
      "organization ID",
    );
    const projectId = this.safeId(credentials.projectId, "project ID");
    return `${LogRocketMcpAdapter.ORIGIN}/mcp/${organizationId}/${projectId}?toolsets=issues`;
  }

  private validateCredentials(credentials: LogRocketCredentials) {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new LogRocketMcpError(
        "credential_missing",
        "LogRocket project API key is missing.",
        401,
      );
    this.endpoint(credentials);
  }

  private safeId(value: string, label: string) {
    const id = value?.trim();
    if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
      throw this.validation(
        `LogRocket ${label} must be the exact safe identifier from the project App ID.`,
      );
    return id;
  }

  private async boundedText(response: Response) {
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 1_000_000)
      throw this.validation("LogRocket MCP response exceeds the 1 MB bound.");
    const text = await response.text();
    if (Buffer.byteLength(text) > 1_000_000)
      throw this.validation("LogRocket MCP response exceeds the 1 MB bound.");
    return text;
  }

  private payloads(text: string): JsonObject[] {
    if (!text.trim()) return [];
    const values = text.includes("data:")
      ? text
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
      : [text];
    return values.flatMap((value) => {
      try {
        return [this.object(JSON.parse(value))];
      } catch {
        return [];
      }
    });
  }

  private tools(value: unknown) {
    const tools = this.object(value).tools;
    return Array.isArray(tools)
      ? tools.slice(0, 20).map((item) => this.object(item))
      : [];
  }

  private arguments(value: unknown): JsonObject {
    if (value === undefined) return {};
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.validation("arguments must be an object.");
    return value as JsonObject;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 8)
      throw new LogRocketMcpError(
        "policy_blocked",
        "LogRocket issue arguments are too deeply nested.",
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
        throw new LogRocketMcpError(
          "policy_blocked",
          `Credential-bearing argument field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 100_000);
    if (Array.isArray(value))
      return value
        .slice(0, 100)
        .map((item) => this.redactAndBound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 200)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redactAndBound(item, depth + 1),
        ]),
    );
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new LogRocketMcpError("provider_validation_error", message);
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
