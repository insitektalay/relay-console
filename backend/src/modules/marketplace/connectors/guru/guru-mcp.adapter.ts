import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type GuruToolKind = "list_agents" | "ask" | "search" | "create_draft" | "update_card";
type McpTool = { name: string; description: string; inputSchema: JsonObject };

export class GuruMcpError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); }
}

@Injectable()
export class GuruMcpAdapter {
  async listAgents(accessToken: string) { return this.callTyped(accessToken, "list_agents", {}); }
  async ask(accessToken: string, input: JsonObject) {
    return this.callTyped(accessToken, "ask", { question: this.requiredString(input.question, "question", 10_000), ...(this.optionalString(input.agentId, 500) ? { agentId: this.optionalString(input.agentId, 500) } : {}) });
  }
  async search(accessToken: string, input: JsonObject) {
    return this.callTyped(accessToken, "search", { query: this.requiredString(input.query, "query", 2_000), ...(this.optionalString(input.agentId, 500) ? { agentId: this.optionalString(input.agentId, 500) } : {}), limit: this.clamp(input.limit, 20, 1, 50) });
  }
  async createDraft(accessToken: string, input: JsonObject) {
    return this.callTyped(accessToken, "create_draft", { title: this.requiredString(input.title, "title", 500), content: this.requiredString(input.content, "content", 100_000), ...(this.optionalString(input.collectionId, 500) ? { collectionId: this.optionalString(input.collectionId, 500) } : {}) });
  }
  async updateCard(accessToken: string, input: JsonObject) {
    return this.callTyped(accessToken, "update_card", { cardId: this.requiredString(input.cardId, "cardId", 500), content: this.requiredString(input.content, "content", 100_000), ...(this.optionalString(input.message, 2_000) ? { message: this.optionalString(input.message, 2_000) } : {}) });
  }

  private async callTyped(accessToken: string, kind: GuruToolKind, args: JsonObject) {
    this.rejectCredentialFields(args);
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      const tool = this.resolveTool(kind, tools);
      if (!tool) throw new GuruMcpError("provider_validation_error", `Guru MCP did not expose the documented ${kind} capability with a valid object schema.`);
      const result = this.object(await this.rpc(accessToken, session, "tools/call", { name: tool.name, arguments: args }));
      if (result.isError === true) throw new GuruMcpError("provider_validation_error", `Guru MCP ${kind} failed.`);
      return this.redactAndBound(result);
    });
  }

  private async withSession<T>(accessToken: string, fn: (session: Session) => Promise<T>) {
    if (!accessToken) throw new GuruMcpError("credential_missing", "Guru OAuth access token is required.", 401);
    const session: Session = { requestId: 1 };
    const initialized = this.object(await this.rpc(accessToken, session, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "Relay Console Railway", version: "1.0" } }));
    if (!this.object(initialized.capabilities).tools) throw new GuruMcpError("provider_validation_error", "Guru MCP did not advertise tool support.");
    await this.notify(accessToken, session, "notifications/initialized", {});
    return fn(session);
  }

  private async listTools(accessToken: string, session: Session): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 3; page += 1) {
      const result = this.object(await this.rpc(accessToken, session, "tools/list", cursor ? { cursor } : {}));
      for (const item of Array.isArray(result.tools) ? result.tools : []) {
        const tool = this.object(item); const name = this.string(tool.name); const schema = this.object(tool.inputSchema);
        if (!name || schema.type !== "object" || tools.some((candidate) => candidate.name === name)) continue;
        tools.push({ name: name.slice(0, 200), description: (this.string(tool.description) ?? "").slice(0, 2_000), inputSchema: schema });
        if (tools.length >= 100) return tools;
      }
      cursor = this.string(result.nextCursor);
      if (!cursor) break;
    }
    return tools;
  }

  private resolveTool(kind: GuruToolKind, tools: McpTool[]) {
    const aliases: Record<GuruToolKind, string[]> = {
      list_agents: ["list_agents", "list_knowledge_agents", "guru_list_agents", "get_knowledge_agents"],
      ask: ["ask", "ask_agent", "ask_knowledge_agent", "guru_ask"],
      search: ["search", "search_content", "search_cards", "guru_search"],
      create_draft: ["create_draft", "create_card_draft", "draft_card", "guru_create_draft"],
      update_card: ["update_card", "suggest_card_update", "guru_update_card"],
    };
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const exact = tools.find((tool) => aliases[kind].includes(normalize(tool.name)));
    if (exact) return exact;
    const words: Record<GuruToolKind, string[]> = { list_agents: ["agent", "list"], ask: ["ask", "question"], search: ["search"], create_draft: ["draft", "create"], update_card: ["card", "update"] };
    return tools.find((tool) => words[kind].every((word) => `${tool.name} ${tool.description}`.toLowerCase().includes(word)));
  }

  private async rpc(accessToken: string, session: Session, method: string, params: JsonObject) {
    const id = session.requestId++;
    const response = await this.request(accessToken, session, method, { jsonrpc: "2.0", id, method, params });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 3_000_000) throw new GuruMcpError("provider_validation_error", "Guru MCP response exceeds 3 MB.");
    const payloads = this.payloads(raw); const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload) throw new GuruMcpError("provider_unavailable", "Guru MCP returned an empty response.", 502);
    if (payload.error) throw new GuruMcpError("provider_validation_error", this.string(this.object(payload.error).message) ?? "Guru MCP request failed.");
    return payload.result;
  }
  private async notify(accessToken: string, session: Session, method: string, params: JsonObject) { await this.request(accessToken, session, method, { jsonrpc: "2.0", method, params }); }
  private async request(accessToken: string, session: Session, _method: string, body: JsonObject) {
    try {
      const response = await safeConnectorFetch("https://mcp.api.getguru.com/mcp", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json, text/event-stream", "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18", ...(session.id ? { "Mcp-Session-Id": session.id } : {}) }, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(20_000) });
      const sessionId = response.headers.get("mcp-session-id"); if (sessionId) session.id = sessionId;
      if (response.status === 401) throw new GuruMcpError("credential_missing", "Guru MCP rejected the OAuth token.", 401);
      if (response.status === 403) throw new GuruMcpError("insufficient_scope", "Guru MCP denied this capability.", 403);
      if (response.status === 429) throw new GuruMcpError("provider_rate_limited", "Guru MCP rate limit reached.", 429);
      if (!response.ok && response.status !== 202 && response.status !== 204) throw new GuruMcpError(response.status >= 500 ? "provider_unavailable" : "provider_validation_error", `Guru MCP returned HTTP ${response.status}.`, response.status);
      return response;
    } catch (error) { if (error instanceof GuruMcpError) throw error; throw new GuruMcpError("provider_unavailable", "Guru MCP could not be reached.", 502); }
  }
  private payloads(text: string): JsonObject[] { if (!text.trim()) return []; const values = text.includes("data:") ? text.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()) : [text]; return values.flatMap((value) => { try { return [this.object(JSON.parse(value))]; } catch { return []; } }); }
  private rejectCredentialFields(value: unknown, depth = 0) { if (depth > 12) throw new GuruMcpError("policy_blocked", "Guru MCP arguments are too deeply nested.", 403); if (Array.isArray(value)) return value.forEach((item) => this.rejectCredentialFields(item, depth + 1)); if (!value || typeof value !== "object") return; for (const [key, item] of Object.entries(value as JsonObject)) { if (/(token|secret|password|credential|authorization|api.?key|cookie)/i.test(key)) throw new GuruMcpError("policy_blocked", `Credential-bearing argument ${key} is not allowed.`, 403); this.rejectCredentialFields(item, depth + 1); } }
  private redactAndBound(value: unknown, depth = 0): unknown { if (depth > 8) return "[truncated]"; if (typeof value === "string") return value.slice(0, 500_000); if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redactAndBound(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 500).map(([key, item]) => [key, /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(key) ? "[redacted]" : this.redactAndBound(item, depth + 1)])); }
  private requiredString(value: unknown, name: string, max: number) { if (typeof value !== "string" || !value.trim() || value.length > max) throw new GuruMcpError("provider_validation_error", `${name} is required and must be at most ${max} characters.`); return value.trim(); }
  private optionalString(value: unknown, max: number) { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined; }
  private clamp(value: unknown, fallback: number, min: number, max: number) { const number = Number(value ?? fallback); return Number.isFinite(number) ? Math.min(Math.max(Math.floor(number), min), max) : fallback; }
  private object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
  private string(value: unknown) { return typeof value === "string" ? value : undefined; }
}
