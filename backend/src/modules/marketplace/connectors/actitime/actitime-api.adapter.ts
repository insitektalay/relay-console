import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  ACTITIME_OPERATION_BY_ID,
  type ActiTimeOperation,
} from "./actitime-operation-registry";

type JsonObject = Record<string, unknown>;
export type ActiTimeCredentials = {
  installationUrl: string;
  username: string;
  password: string;
};
export type ActiTimeOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: unknown;
};

export class ActiTimeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ActiTimeApiAdapter {
  async health(credentials: ActiTimeCredentials) {
    return this.directRequest(credentials, "/users/me", "GET");
  }

  read(
    credentials: ActiTimeCredentials,
    operationId: string,
    input: ActiTimeOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.invalid("actiTIME read accepts read-only operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: ActiTimeCredentials,
    operationId: string,
    input: ActiTimeOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.invalid("actiTIME manage accepts mutation operations only.");
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: ActiTimeCredentials,
    operation: ActiTimeOperation,
    input: ActiTimeOperationInput,
  ) {
    this.rejectCredentialFields(input);
    let path = operation.path;
    const pathParameters = input.pathParameters ?? {};
    this.exactPathKeys(pathParameters, operation.pathParameters);
    for (const name of operation.pathParameters) {
      path = path.replaceAll(
        `{${name}}`,
        encodeURIComponent(this.segment(pathParameters[name], name)),
      );
    }
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://"))
      throw new ActiTimeApiError(
        "policy_blocked",
        "actiTIME path escaped the pinned public API route.",
        403,
      );
    const query = this.query(input.query);
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !operation.bodyAllowed)
      throw this.invalid(
        "This actiTIME operation does not accept a JSON body.",
      );
    if (body && Buffer.byteLength(body) > 2_000_000)
      throw this.invalid("actiTIME request exceeds the 2 MB Relay limit.");
    return this.directRequest(
      credentials,
      `${path}${query}`,
      operation.method,
      body,
    );
  }

  private async directRequest(
    credentials: ActiTimeCredentials,
    target: string,
    method: string,
    body?: string,
  ) {
    this.requireCredentials(credentials);
    const root = await this.apiRoot(credentials.installationUrl);
    const relative = target.replace(/^\/+/, "");
    const url = new URL(relative, root);
    if (
      url.protocol !== "https:" ||
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new ActiTimeApiError(
        "policy_blocked",
        "actiTIME requests must stay on the configured HTTPS installation API route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json; charset=UTF-8",
          Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}`,
          ...(body
            ? { "Content-Type": "application/json; charset=UTF-8" }
            : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof ActiTimeApiError) throw error;
      throw new ActiTimeApiError(
        "provider_unavailable",
        "actiTIME could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("actiTIME response exceeds the 2.5 MB Relay limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new ActiTimeApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `actiTIME returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private async apiRoot(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.invalid("Enter a valid actiTIME installation URL.");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !url.hostname ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost")
    )
      throw new ActiTimeApiError(
        "policy_blocked",
        "actiTIME requires a public HTTPS installation URL without embedded credentials, ports, query, or fragment.",
        403,
      );
    await this.requirePublicHost(url.hostname);
    const basePath = `${url.pathname.replace(/\/+$/, "")}/api/v1/`.replace(
      /^\/\//,
      "/",
    );
    return new URL(`${url.origin}${basePath}`);
  }

  private async requirePublicHost(hostname: string) {
    if (isIP(hostname) && this.isPrivateAddress(hostname))
      throw new ActiTimeApiError(
        "policy_blocked",
        "actiTIME installation URL cannot use a private or local address.",
        403,
      );
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new ActiTimeApiError(
        "provider_unavailable",
        "actiTIME installation hostname could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some((item) => this.isPrivateAddress(item.address))
    )
      throw new ActiTimeApiError(
        "policy_blocked",
        "actiTIME installation hostname must resolve only to public addresses.",
        403,
      );
  }

  private isPrivateAddress(address: string) {
    const normalized = address.toLowerCase().replace(/^::ffff:/, "");
    if (normalized.includes(":"))
      return (
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("fe8") ||
        normalized.startsWith("fe9") ||
        normalized.startsWith("fea") ||
        normalized.startsWith("feb")
      );
    const parts = normalized.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part)))
      return true;
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }

  private query(value: JsonObject | undefined) {
    if (!value) return "";
    const entries = Object.entries(value);
    if (entries.length > 100)
      throw this.invalid("actiTIME query contains too many fields.");
    const params = new URLSearchParams();
    for (const [name, raw] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(name))
        throw this.invalid(`actiTIME query parameter ${name} is invalid.`);
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.invalid(`actiTIME query ${name} has too many values.`);
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        if (typeof item === "object")
          throw this.invalid(`actiTIME query ${name} must be scalar.`);
        const text = String(item);
        if (text.length > 2_000 || /[\r\n]/.test(text))
          throw this.invalid(`actiTIME query ${name} is invalid.`);
        params.append(name, text);
      }
    }
    const result = params.toString();
    return result ? `?${result}` : "";
  }

  private exactPathKeys(value: JsonObject, allowed: readonly string[]) {
    const keys = Object.keys(value);
    if (
      keys.length !== allowed.length ||
      keys.some((key) => !allowed.includes(key))
    )
      throw this.invalid(
        "actiTIME path parameters must exactly match the selected operation.",
      );
  }

  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:@+-]{1,200}$/.test(text))
      throw this.invalid(`actiTIME ${name} path parameter is invalid.`);
    return text;
  }

  private operation(id: string) {
    const item = ACTITIME_OPERATION_BY_ID.get(id);
    if (!item)
      throw this.invalid(
        "actiTIME operation is not in the pinned public API contract.",
      );
    return item;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12)
      throw new ActiTimeApiError(
        "policy_blocked",
        "actiTIME request is too deeply nested.",
        403,
      );
    if (Array.isArray(value)) {
      if (value.length > 2_000)
        throw this.invalid("actiTIME request contains too many array items.");
      return value.forEach((item) =>
        this.rejectCredentialFields(item, depth + 1),
      );
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 2_000)
      throw this.invalid("actiTIME request contains too many fields.");
    for (const [key, item] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key|signed.?url)/i.test(
          key,
        )
      )
        throw new ActiTimeApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private requireCredentials(credentials: ActiTimeCredentials) {
    if (
      !credentials.username ||
      credentials.username.length > 320 ||
      /[\r\n:]/.test(credentials.username)
    )
      throw new ActiTimeApiError(
        "credential_missing",
        "A valid actiTIME username is required.",
        401,
      );
    if (
      !credentials.password ||
      credentials.password.length > 16_000 ||
      /[\r\n]/.test(credentials.password)
    )
      throw new ActiTimeApiError(
        "credential_missing",
        "A valid actiTIME password is required.",
        401,
      );
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|signed.?url)/i.test(
            key,
          )
            ? "[REDACTED]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const body = value as JsonObject;
    const candidate = body.message ?? body.error ?? body.reason;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new ActiTimeApiError("provider_validation_error", message, 400);
  }
}
