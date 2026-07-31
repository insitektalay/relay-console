import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type McpTool = { name: string; inputSchema: JsonObject };
type Waiter = {
  resolve: (value: JsonObject) => void;
  reject: (error: Error) => void;
};
type Session = {
  controller: AbortController;
  endpoint: string;
  requestId: number;
  waiters: Map<number, Waiter>;
  buffered: Map<number, JsonObject>;
};

const MUTATION_NAME =
  /(^|[_.-])(add|archive|assign|clear|complete|create|delete|edit|import|invite|manage|move|remove|reorder|set|sync|unassign|uncomplete|update|write)([_.-]|$)/i;

export class AnyDoMcpError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class AnyDoMcpAdapter {
  async health(accessToken: string) {
    return this.withSession(accessToken, async (session) => {
      const tools = await this.listTools(accessToken, session);
      if (!tools.length) {
        throw new AnyDoMcpError(
          "provider_validation_error",
          "Any.do MCP did not expose any tools with valid object schemas.",
        );
      }
      return { toolCount: tools.length, toolsVerified: true };
    });
  }

  callRead(accessToken: string, input: JsonObject) {
    return this.callDiscovered(accessToken, input, false);
  }

  callWrite(accessToken: string, input: JsonObject) {
    return this.callDiscovered(accessToken, input, true);
  }

  private async callDiscovered(
    accessToken: string,
    input: JsonObject,
    allowMutations: boolean,
  ) {
    const toolName = this.requiredString(input.toolName, "toolName", 200);
    if (!allowMutations && MUTATION_NAME.test(toolName)) {
      throw new AnyDoMcpError(
        "policy_blocked",
        `Any.do MCP tool ${toolName} may mutate provider data and must use the managed action.`,
        403,
      );
    }
    const args = this.object(input.arguments);
    this.rejectCredentialFields(args);
    if (Buffer.byteLength(JSON.stringify(args)) > 1_000_000) {
      throw new AnyDoMcpError(
        "provider_validation_error",
        "Any.do MCP arguments exceed 1 MB.",
      );
    }
    return this.withSession(accessToken, async (session) => {
      const tool = (await this.listTools(accessToken, session)).find(
        (candidate) => candidate.name === toolName,
      );
      if (!tool) {
        throw new AnyDoMcpError(
          "provider_validation_error",
          `Any.do MCP did not expose ${toolName} with a valid object schema.`,
        );
      }
      const result = this.object(
        await this.rpc(accessToken, session, "tools/call", {
          name: tool.name,
          arguments: args,
        }),
      );
      if (result.isError === true) {
        throw new AnyDoMcpError(
          "provider_validation_error",
          `Any.do MCP ${toolName} failed.`,
        );
      }
      return this.redactAndBound(result);
    });
  }

  private async withSession<T>(
    accessToken: string,
    operation: (session: Session) => Promise<T>,
  ) {
    if (!accessToken) {
      throw new AnyDoMcpError(
        "credential_missing",
        "Any.do OAuth access token is required.",
        401,
      );
    }
    const session = await this.openSession(accessToken);
    try {
      const initialized = this.object(
        await this.rpc(accessToken, session, "initialize", {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "Relay Console Railway", version: "1.0" },
        }),
      );
      if (!this.object(initialized.capabilities).tools) {
        throw new AnyDoMcpError(
          "provider_validation_error",
          "Any.do MCP did not advertise tool support.",
        );
      }
      await this.post(accessToken, session, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      });
      return await operation(session);
    } finally {
      session.controller.abort();
      for (const waiter of session.waiters.values()) {
        waiter.reject(
          new AnyDoMcpError(
            "provider_unavailable",
            "Any.do MCP session closed.",
            502,
          ),
        );
      }
    }
  }

  private async openSession(accessToken: string): Promise<Session> {
    const controller = new AbortController();
    let response: Response;
    try {
      response = await safeConnectorFetch("https://mcp.any.do/sse", {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${accessToken}`,
          "MCP-Protocol-Version": "2025-06-18",
        },
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      throw new AnyDoMcpError(
        "provider_unavailable",
        "Any.do MCP could not be reached.",
        502,
      );
    }
    this.requireResponse(response);
    if (!response.body) {
      throw new AnyDoMcpError(
        "provider_unavailable",
        "Any.do MCP returned no event stream.",
        502,
      );
    }

    const waiters = new Map<number, Waiter>();
    const buffered = new Map<number, JsonObject>();
    let endpointResolve!: (value: string) => void;
    let endpointReject!: (error: Error) => void;
    const endpointPromise = new Promise<string>((resolve, reject) => {
      endpointResolve = resolve;
      endpointReject = reject;
    });
    void this.consumeEvents(
      response.body,
      waiters,
      buffered,
      endpointResolve,
      endpointReject,
    );
    const endpoint = await this.withTimeout(
      endpointPromise,
      10_000,
      "Any.do MCP did not establish a message endpoint.",
    );
    const endpointUrl = new URL(endpoint, "https://mcp.any.do");
    if (endpointUrl.origin !== "https://mcp.any.do") {
      controller.abort();
      throw new AnyDoMcpError(
        "provider_validation_error",
        "Any.do MCP returned an untrusted message endpoint.",
      );
    }
    return {
      controller,
      endpoint: endpointUrl.toString(),
      requestId: 1,
      waiters,
      buffered,
    };
  }

  private async consumeEvents(
    body: ReadableStream<Uint8Array>,
    waiters: Map<number, Waiter>,
    buffered: Map<number, JsonObject>,
    endpointResolve: (value: string) => void,
    endpointReject: (error: Error) => void,
  ) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let endpointFound = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        if (Buffer.byteLength(pending) > 5_000_000) {
          throw new AnyDoMcpError(
            "provider_validation_error",
            "Any.do MCP event buffer exceeds 5 MB.",
          );
        }
        const frames = pending.split(/\r?\n\r?\n/);
        pending = frames.pop() ?? "";
        for (const frame of frames) {
          const event = this.parseEvent(frame);
          if (event.event === "endpoint" && event.data) {
            endpointFound = true;
            endpointResolve(event.data);
            continue;
          }
          if (!event.data) continue;
          let payload: JsonObject;
          try {
            payload = this.object(JSON.parse(event.data));
          } catch {
            continue;
          }
          const id = typeof payload.id === "number" ? payload.id : null;
          if (id === null) continue;
          const waiter = waiters.get(id);
          if (waiter) {
            waiters.delete(id);
            waiter.resolve(payload);
          } else {
            buffered.set(id, payload);
          }
        }
      }
      if (!endpointFound) {
        endpointReject(
          new AnyDoMcpError(
            "provider_unavailable",
            "Any.do MCP event stream ended before initialization.",
            502,
          ),
        );
      }
    } catch (error) {
      const mapped =
        error instanceof AnyDoMcpError
          ? error
          : new AnyDoMcpError(
              "provider_unavailable",
              "Any.do MCP event stream failed.",
              502,
            );
      endpointReject(mapped);
      for (const waiter of waiters.values()) waiter.reject(mapped);
      waiters.clear();
    }
  }

  private parseEvent(frame: string) {
    let event = "message";
    const data: string[] = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    return { event, data: data.join("\n") };
  }

  private async rpc(
    accessToken: string,
    session: Session,
    method: string,
    params: JsonObject,
  ) {
    const id = session.requestId++;
    const buffered = session.buffered.get(id);
    if (buffered) session.buffered.delete(id);
    const responsePromise = buffered
      ? Promise.resolve(buffered)
      : new Promise<JsonObject>((resolve, reject) => {
          session.waiters.set(id, { resolve, reject });
        });
    await this.post(accessToken, session, {
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    const payload = await this.withTimeout(
      responsePromise,
      20_000,
      "Any.do MCP response timed out.",
    );
    if (payload.error) {
      throw new AnyDoMcpError(
        "provider_validation_error",
        this.string(this.object(payload.error).message) ??
          "Any.do MCP request failed.",
      );
    }
    return payload.result;
  }

  private async post(accessToken: string, session: Session, body: JsonObject) {
    let response: Response;
    try {
      response = await safeConnectorFetch(session.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-06-18",
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new AnyDoMcpError(
        "provider_unavailable",
        "Any.do MCP message endpoint could not be reached.",
        502,
      );
    }
    this.requireResponse(response);
  }

  private async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    message: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(new AnyDoMcpError("provider_unavailable", message, 502)),
        timeoutMs,
      );
      timer.unref?.();
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private requireResponse(response: Response) {
    if (response.status === 401)
      throw new AnyDoMcpError(
        "credential_missing",
        "Any.do MCP rejected the OAuth token.",
        401,
      );
    if (response.status === 403)
      throw new AnyDoMcpError(
        "insufficient_scope",
        "Any.do MCP denied this capability.",
        403,
      );
    if (response.status === 429)
      throw new AnyDoMcpError(
        "provider_rate_limited",
        "Any.do MCP rate limit reached.",
        429,
      );
    if (!response.ok && response.status !== 202 && response.status !== 204) {
      throw new AnyDoMcpError(
        response.status >= 500
          ? "provider_unavailable"
          : "provider_validation_error",
        `Any.do MCP returned HTTP ${response.status}.`,
        response.status,
      );
    }
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

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12)
      throw new AnyDoMcpError(
        "policy_blocked",
        "Any.do MCP arguments are too deeply nested.",
        403,
      );
    if (Array.isArray(value)) {
      if (value.length > 500)
        throw new AnyDoMcpError(
          "provider_validation_error",
          "Any.do MCP argument array is too large.",
        );
      return value.forEach((item) =>
        this.rejectCredentialFields(item, depth + 1),
      );
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 500)
      throw new AnyDoMcpError(
        "provider_validation_error",
        "Any.do MCP argument object is too large.",
      );
    for (const [key, item] of entries) {
      if (
        /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(
          key,
        )
      ) {
        throw new AnyDoMcpError(
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
    if (Array.isArray(value))
      return value
        .slice(0, 500)
        .map((item) => this.redactAndBound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
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

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw new AnyDoMcpError(
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
