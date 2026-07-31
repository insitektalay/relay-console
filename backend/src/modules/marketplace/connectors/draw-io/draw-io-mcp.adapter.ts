import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Session = { id?: string; requestId: number };
type McpTool = { name: string; inputSchema: JsonObject };

export const DRAW_IO_TOOLS = ["create_diagram", "search_shapes"] as const;

export class DrawIoMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class DrawIoMcpAdapter {
  async health() {
    return this.withSession(async (session) => {
      const tools = await this.listTools(session);
      for (const required of DRAW_IO_TOOLS) {
        if (!tools.some((tool) => tool.name === required)) {
          throw new DrawIoMcpError(
            "provider_validation_error",
            `Draw.io MCP did not expose the documented ${required} tool with a valid object schema.`,
          );
        }
      }
      return { toolCount: tools.length, documentedToolsVerified: true };
    });
  }

  call(input: JsonObject) {
    const toolName = this.requiredString(input.toolName, "toolName", 120);
    if (!DRAW_IO_TOOLS.includes(toolName as (typeof DRAW_IO_TOOLS)[number])) {
      throw new DrawIoMcpError(
        "policy_blocked",
        `Draw.io MCP tool ${toolName} is not allowed by Relay.`,
        403,
      );
    }
    const args = this.object(input.arguments);
    this.rejectCredentialFields(args);
    if (Buffer.byteLength(JSON.stringify(args)) > 1_000_000) {
      throw new DrawIoMcpError(
        "provider_validation_error",
        "Draw.io MCP arguments exceed 1 MB.",
      );
    }
    return this.withSession(async (session) => {
      const tool = (await this.listTools(session)).find(
        (candidate) => candidate.name === toolName,
      );
      if (!tool) {
        throw new DrawIoMcpError(
          "provider_validation_error",
          `Draw.io MCP did not expose ${toolName} with a valid object schema.`,
        );
      }
      const result = this.object(
        await this.rpc(session, "tools/call", {
          name: tool.name,
          arguments: args,
        }),
      );
      if (result.isError === true) {
        throw new DrawIoMcpError(
          "provider_validation_error",
          `Draw.io MCP ${toolName} failed.`,
        );
      }
      return this.redactAndBound(result);
    });
  }

  private async withSession<T>(fn: (session: Session) => Promise<T>) {
    const session: Session = { requestId: 1 };
    const initialized = this.object(
      await this.rpc(session, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "Relay Console Railway", version: "1.0" },
      }),
    );
    if (!this.object(initialized.capabilities).tools) {
      throw new DrawIoMcpError(
        "provider_validation_error",
        "Draw.io MCP did not advertise tool support.",
      );
    }
    await this.notify(session, "notifications/initialized", {});
    return fn(session);
  }

  private async listTools(session: Session): Promise<McpTool[]> {
    const result = this.object(await this.rpc(session, "tools/list", {}));
    return (Array.isArray(result.tools) ? result.tools : [])
      .slice(0, 20)
      .flatMap((item) => {
        const tool = this.object(item);
        const name = this.string(tool.name);
        const inputSchema = this.object(tool.inputSchema);
        return name && inputSchema.type === "object"
          ? [{ name: name.slice(0, 200), inputSchema }]
          : [];
      });
  }

  private async rpc(session: Session, method: string, params: JsonObject) {
    const id = session.requestId++;
    const response = await this.request(session, {
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 5_000_000) {
      throw new DrawIoMcpError(
        "provider_validation_error",
        "Draw.io MCP response exceeds 5 MB.",
      );
    }
    const payloads = this.payloads(raw);
    const payload = payloads.find((item) => item.id === id) ?? payloads[0];
    if (!payload) {
      throw new DrawIoMcpError(
        "provider_unavailable",
        "Draw.io MCP returned an empty response.",
        502,
      );
    }
    if (payload.error) {
      throw new DrawIoMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ?? "Draw.io MCP request failed.",
      );
    }
    return payload.result;
  }

  private async notify(session: Session, method: string, params: JsonObject) {
    await this.request(session, { jsonrpc: "2.0", method, params });
  }

  private async request(session: Session, body: JsonObject) {
    try {
      const response = await safeConnectorFetch("https://mcp.draw.io/mcp", {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-03-26",
          "User-Agent": "RelayConsole/1.0",
          ...(session.id ? { "Mcp-Session-Id": session.id } : {}),
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) session.id = sessionId;
      if (response.status === 429) {
        throw new DrawIoMcpError(
          "provider_rate_limited",
          "Draw.io MCP rate limit reached.",
          429,
        );
      }
      if (!response.ok && response.status !== 202 && response.status !== 204) {
        throw new DrawIoMcpError(
          response.status >= 500 ? "provider_unavailable" : "provider_validation_error",
          `Draw.io MCP returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof DrawIoMcpError) throw error;
      throw new DrawIoMcpError(
        "provider_unavailable",
        "Draw.io MCP could not be reached.",
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
    if (depth > 12) {
      throw new DrawIoMcpError(
        "policy_blocked",
        "Draw.io MCP arguments are too deeply nested.",
        403,
      );
    }
    if (Array.isArray(value)) {
      return value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (/(token|secret|password|credential|authorization|api.?key|cookie)/i.test(key)) {
        throw new DrawIoMcpError(
          "policy_blocked",
          `Credential-bearing argument ${key} is not allowed.`,
          403,
        );
      }
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private redactAndBound(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) {
      return value.slice(0, 500).map((item) => this.redactAndBound(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(key)
            ? "[redacted]"
            : this.redactAndBound(item, depth + 1),
        ]),
    );
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw new DrawIoMcpError(
        "provider_validation_error",
        `${name} is required and must be at most ${max} characters.`,
      );
    }
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
