import { Inject, Injectable, Optional } from "@nestjs/common";

export type FuseBaseMcpCredentials = { url: string; token: string };

export class FuseBaseMcpError extends Error {
  constructor(
    readonly code: "credential_missing" | "insufficient_scope" | "provider_rate_limited" | "provider_unavailable" | "provider_validation_error" | "policy_blocked",
    message: string,
    readonly statusCode = 400,
  ) { super(message); }
}

type JsonObject = Record<string, unknown>;
type McpTool = { name: string; description?: string; inputSchema?: JsonObject };

@Injectable()
export class FuseBaseMcpAdapter {
  private readonly fetchImpl: typeof fetch;

  constructor(
    @Optional() @Inject("FUSEBASE_MCP_FETCH") fetchImpl?: typeof fetch,
  ) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async health(credentials: FuseBaseMcpCredentials) {
    const tools = await this.listTools(credentials);
    return { toolCount: tools.length };
  }

  async listTools(credentials: FuseBaseMcpCredentials): Promise<McpTool[]> {
    return this.withSession(credentials, async (session) => {
      const tools: McpTool[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        const result = await this.rpc(credentials, session, "tools/list", cursor ? { cursor } : {});
        const object = this.object(result);
        const pageTools = Array.isArray(object.tools) ? object.tools : [];
        for (const item of pageTools) {
          const tool = this.object(item);
          const name = this.string(tool.name);
          if (!name || tools.some((candidate) => candidate.name === name)) continue;
          tools.push({ name: name.slice(0, 200), description: this.string(tool.description)?.slice(0, 2_000), inputSchema: this.object(tool.inputSchema) });
          if (tools.length >= 500) return tools;
        }
        cursor = this.string(object.nextCursor);
        if (!cursor) break;
      }
      return tools;
    });
  }

  async callReadTool(credentials: FuseBaseMcpCredentials, input: JsonObject) {
    const name = this.requiredToolName(input);
    if (!this.isReadOnlyTool(name)) throw new FuseBaseMcpError("policy_blocked", `${name} is not classified as a read-only FuseBase tool. Use the full tool wrapper with Safe approval or Dangerous mode.`, 403);
    return this.callDiscovered(credentials, name, this.arguments(input));
  }

  async callTool(credentials: FuseBaseMcpCredentials, input: JsonObject) {
    return this.callDiscovered(credentials, this.requiredToolName(input), this.arguments(input));
  }

  private async callDiscovered(credentials: FuseBaseMcpCredentials, name: string, args: JsonObject) {
    this.rejectCredentialFields(args);
    return this.withSession(credentials, async (session) => {
      const list = await this.rpc(credentials, session, "tools/list", {});
      const tools = Array.isArray(this.object(list).tools) ? this.object(list).tools as unknown[] : [];
      if (!tools.some((item) => this.string(this.object(item).name) === name)) throw new FuseBaseMcpError("provider_validation_error", `${name} is not granted by this FuseBase MCP configuration.`);
      const result = this.object(await this.rpc(credentials, session, "tools/call", { name, arguments: args }));
      if (result.isError === true) throw new FuseBaseMcpError("provider_validation_error", "FuseBase reported that the tool call failed.");
      return this.redactAndBound(result);
    });
  }

  private async withSession<T>(credentials: FuseBaseMcpCredentials, fn: (session: { id?: string; requestId: number }) => Promise<T>) {
    this.validateCredentials(credentials);
    const session = { requestId: 1 } as { id?: string; requestId: number };
    const initialized = this.object(await this.rpc(credentials, session, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "Relay Console Railway", version: "1.0" },
    }));
    if (!this.object(initialized.capabilities).tools) throw new FuseBaseMcpError("provider_validation_error", "FuseBase MCP did not advertise tool support.");
    await this.notify(credentials, session, "notifications/initialized", {});
    return fn(session);
  }

  private async rpc(credentials: FuseBaseMcpCredentials, session: { id?: string; requestId: number }, method: string, params: JsonObject) {
    const id = session.requestId++;
    const response = await this.request(credentials, session, method, { jsonrpc: "2.0", id, method, params });
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > 2_000_000) throw new FuseBaseMcpError("provider_validation_error", "FuseBase MCP response exceeds the 2 MB Relay boundary.");
    const responseText = await response.text();
    if (responseText.length > 2_000_000) throw new FuseBaseMcpError("provider_validation_error", "FuseBase MCP response exceeds the 2 MB Relay boundary.");
    const payloads = this.responsePayloads(responseText);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload) throw new FuseBaseMcpError("provider_unavailable", "FuseBase MCP returned an empty response.", 502);
    if (payload.error) throw new FuseBaseMcpError("provider_validation_error", this.string(this.object(payload.error).message) ?? "FuseBase MCP request failed.");
    return payload.result;
  }

  private async notify(credentials: FuseBaseMcpCredentials, session: { id?: string }, method: string, params: JsonObject) {
    await this.request(credentials, session, method, { jsonrpc: "2.0", method, params });
  }

  private async request(credentials: FuseBaseMcpCredentials, session: { id?: string }, method: string, body: JsonObject) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await this.fetchImpl(this.validateUrl(credentials.url), {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-06-18",
          "Mcp-Method": method,
          "Mcp-Name": "Relay Console Railway",
          ...(session.id ? { "Mcp-Session-Id": session.id } : {}),
        },
        body: JSON.stringify(body),
      });
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) session.id = sessionId;
      if (response.status === 401) throw new FuseBaseMcpError("credential_missing", "FuseBase MCP credentials were rejected.", 401);
      if (response.status === 403) throw new FuseBaseMcpError("insufficient_scope", "FuseBase MCP denied this operation.", 403);
      if (response.status === 429) throw new FuseBaseMcpError("provider_rate_limited", "FuseBase MCP rate limit reached.", 429);
      if (!response.ok && response.status !== 202 && response.status !== 204) throw new FuseBaseMcpError(response.status >= 500 ? "provider_unavailable" : "provider_validation_error", `FuseBase MCP returned HTTP ${response.status}.`, response.status);
      return response;
    } catch (error) {
      if (error instanceof FuseBaseMcpError) throw error;
      throw new FuseBaseMcpError("provider_unavailable", "FuseBase MCP could not be reached.", 502);
    } finally { clearTimeout(timer); }
  }

  private validateCredentials(credentials: FuseBaseMcpCredentials) {
    if (!credentials.url || !credentials.token) throw new FuseBaseMcpError("credential_missing", "FuseBase MCP URL and token are required.", 401);
    this.validateUrl(credentials.url);
  }

  private validateUrl(raw: string) {
    let url: URL;
    try { url = new URL(raw); } catch { throw new FuseBaseMcpError("provider_validation_error", "FuseBase MCP URL is invalid."); }
    const host = url.hostname.toLowerCase();
    const allowed = ["thefusebase.com", "nimbusweb.me"].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
    if (url.protocol !== "https:" || !allowed || url.username || url.password || url.hash || (url.port && url.port !== "443")) throw new FuseBaseMcpError("policy_blocked", "FuseBase MCP URL must be an official FuseBase HTTPS endpoint without user-info, fragments, or custom ports.", 403);
    return url.toString();
  }

  private responsePayloads(text: string): JsonObject[] {
    if (!text.trim()) return [];
    const values = text.includes("data:") ? text.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()) : [text];
    return values.flatMap((value) => { try { return [this.object(JSON.parse(value))]; } catch { return []; } });
  }

  private requiredToolName(input: JsonObject) {
    const name = this.string(input.toolName)?.trim();
    if (!name || name.length > 200) throw new FuseBaseMcpError("provider_validation_error", "toolName is required and must be at most 200 characters.");
    return name;
  }
  private arguments(input: JsonObject) { return this.object(input.arguments); }
  private isReadOnlyTool(name: string) {
    const value = name.toLowerCase();
    if (/(create|update|edit|delete|remove|move|copy|set|add|invite|revoke|send|publish|upload|admin|billing|token)/.test(value)) return false;
    return /(^|[._-])(get|list|read|search|find|query|fetch|retrieve|inspect|view|summari[sz]e)([._-]|$)/.test(value);
  }
  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12) throw new FuseBaseMcpError("policy_blocked", "FuseBase tool arguments are too deeply nested.", 403);
    if (Array.isArray(value)) return value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (/(token|secret|password|credential|authorization|api.?key|cookie)/i.test(key)) throw new FuseBaseMcpError("policy_blocked", `Credential-bearing argument field ${key} is not allowed.`, 403);
      this.rejectCredentialFields(item, depth + 1);
    }
  }
  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redactAndBound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 500).map(([key, item]) => [key, /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(key) ? "[redacted]" : this.redactAndBound(item, depth + 1)]));
  }
  private object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
  private string(value: unknown) { return typeof value === "string" ? value : undefined; }
}
