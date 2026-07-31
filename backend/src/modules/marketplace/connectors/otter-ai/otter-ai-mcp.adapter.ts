import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = { name: string; normalized: string; inputSchema: JsonObject };

export class OtterAiMcpError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode = 400) { super(message); }
}

@Injectable()
export class OtterAiMcpAdapter {
  async health(accessToken: string) {
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      for (const required of ["getuserinfo", "search", "fetch"]) if (!tools.some((tool) => tool.normalized === required)) throw new OtterAiMcpError("provider_validation_error", `Otter MCP did not expose its documented ${required} tool with a valid object schema.`);
      return { toolCount: tools.length, documentedToolsVerified: true };
    });
  }
  getUserInfo(accessToken: string) { return this.call(accessToken, "getuserinfo", {}); }
  search(accessToken: string, input: JsonObject) { return this.call(accessToken, "search", { query: this.requiredString(input.query, "query", 10_000) }); }
  fetch(accessToken: string, input: JsonObject) { return this.call(accessToken, "fetch", { id: this.requiredString(input.id, "id", 10_000) }); }

  private async call(accessToken: string, normalized: string, args: JsonObject) {
    this.rejectCredentialFields(args); if (Buffer.byteLength(JSON.stringify(args)) > 100_000) throw new OtterAiMcpError("provider_validation_error", "Otter MCP arguments exceed 100 KB.");
    return this.withSession(accessToken, async (session) => {
      const matches = (await this.listTools(accessToken, session)).filter((tool) => tool.normalized === normalized);
      if (matches.length !== 1) throw new OtterAiMcpError("provider_validation_error", `Otter MCP ${normalized} tool schema is unavailable or ambiguous.`);
      const result = this.object(await this.rpc(accessToken, session, "tools/call", { name: matches[0].name, arguments: args }));
      if (result.isError === true) throw new OtterAiMcpError("provider_validation_error", `Otter MCP ${matches[0].name} failed.`);
      return this.redactAndBound(result);
    });
  }
  private async withSession<T>(accessToken: string, fn: (session: Session) => Promise<T>) {
    if (!accessToken) throw new OtterAiMcpError("credential_missing", "Otter OAuth access token is required.", 401);
    const session: Session = { requestId: 1 };
    const initialized = this.object(await this.rpc(accessToken, session, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "Relay Console Railway", version: "1.0" } }));
    if (!this.object(initialized.capabilities).tools) throw new OtterAiMcpError("provider_validation_error", "Otter MCP did not advertise tool support.");
    await this.notify(accessToken, session, "notifications/initialized", {}); return fn(session);
  }
  private async listTools(accessToken: string, session: Session): Promise<McpTool[]> {
    const tools: McpTool[] = []; let cursor: string | undefined;
    for (let page = 0; page < 4; page += 1) {
      const result = this.object(await this.rpc(accessToken, session, "tools/list", cursor ? { cursor } : {}));
      for (const item of Array.isArray(result.tools) ? result.tools : []) { const tool = this.object(item); const name = this.string(tool.name); const schema = this.object(tool.inputSchema); if (!name || schema.type !== "object" || tools.some((candidate) => candidate.name === name)) continue; tools.push({ name: name.slice(0, 200), normalized: name.replace(/[^a-z0-9]/gi, "").toLowerCase(), inputSchema: schema }); if (tools.length >= 20) return tools; }
      cursor = this.string(result.nextCursor); if (!cursor) break;
    }
    return tools;
  }
  private async rpc(accessToken: string, session: Session, method: string, params: JsonObject) { const id = session.requestId++; const response = await this.request(accessToken, session, { jsonrpc: "2.0", id, method, params }); const raw = await response.text(); if (Buffer.byteLength(raw) > 5_000_000) throw new OtterAiMcpError("provider_validation_error", "Otter MCP response exceeds 5 MB."); const payloads = this.payloads(raw); const payload = payloads.find((item) => item.id === id) ?? payloads[0]; if (!payload) throw new OtterAiMcpError("provider_unavailable", "Otter MCP returned an empty response.", 502); if (payload.error) throw new OtterAiMcpError("provider_validation_error", this.string(this.object(payload.error).message) ?? "Otter MCP request failed."); return payload.result; }
  private async notify(accessToken: string, session: Session, method: string, params: JsonObject) { await this.request(accessToken, session, { jsonrpc: "2.0", method, params }); }
  private async request(accessToken: string, session: Session, body: JsonObject) { try { const response = await safeConnectorFetch("https://mcp.otter.ai/mcp", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json, text/event-stream", "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18", ...(session.id ? { "Mcp-Session-Id": session.id } : {}) }, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(20_000) }); const sessionId = response.headers.get("mcp-session-id"); if (sessionId) session.id = sessionId; if (response.status === 401) throw new OtterAiMcpError("credential_missing", "Otter MCP rejected the OAuth token.", 401); if (response.status === 403) throw new OtterAiMcpError("insufficient_scope", "Otter MCP denied this capability.", 403); if (response.status === 429) throw new OtterAiMcpError("provider_rate_limited", "Otter MCP rate limit reached.", 429); if (!response.ok && response.status !== 202 && response.status !== 204) throw new OtterAiMcpError(response.status >= 500 ? "provider_unavailable" : "provider_validation_error", `Otter MCP returned HTTP ${response.status}.`, response.status); return response; } catch (error) { if (error instanceof OtterAiMcpError) throw error; throw new OtterAiMcpError("provider_unavailable", "Otter MCP could not be reached.", 502); } }
  private payloads(value: string): JsonObject[] { if (!value.trim()) return []; const values = value.includes("data:") ? value.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()) : [value]; return values.flatMap((item) => { try { return [this.object(JSON.parse(item))]; } catch { return []; } }); }
  private rejectCredentialFields(value: unknown, depth = 0) { if (depth > 8) throw new OtterAiMcpError("policy_blocked", "Otter MCP arguments are too deeply nested.", 403); if (Array.isArray(value)) return value.forEach((item) => this.rejectCredentialFields(item, depth + 1)); if (!value || typeof value !== "object") return; for (const [key, item] of Object.entries(value as JsonObject)) { if (/(token|secret|password|credential|authorization|api.?key|cookie)/i.test(key)) throw new OtterAiMcpError("policy_blocked", `Credential-bearing argument ${key} is not allowed.`, 403); this.rejectCredentialFields(item, depth + 1); } }
  private redactAndBound(value: unknown, depth = 0): unknown { if (depth > 8) return "[truncated]"; if (typeof value === "string") return value.slice(0, 1_000_000); if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redactAndBound(item, depth + 1)); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 500).map(([key, item]) => [key, /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(key) ? "[redacted]" : this.redactAndBound(item, depth + 1)])); }
  private requiredString(value: unknown, name: string, max: number) { if (typeof value !== "string" || !value.trim() || value.length > max) throw new OtterAiMcpError("provider_validation_error", `${name} is required and must be at most ${max} characters.`); return value.trim(); }
  private object(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
  private string(value: unknown) { return typeof value === "string" ? value : undefined; }
}
