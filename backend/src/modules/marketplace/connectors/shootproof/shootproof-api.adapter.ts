import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  SHOOTPROOF_OPERATION_BY_ID,
  type ShootProofOperation,
} from "./shootproof-operation-registry";

type JsonObject = Record<string, unknown>;
export type ShootProofOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: JsonObject;
};

export class ShootProofApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ShootProofApiAdapter {
  private static readonly ORIGIN = "https://api.shootproof.com";
  private static readonly BASE_PATH = "/studio";

  health(accessToken: string) {
    return this.directRequest(accessToken, "/studio/me", "GET");
  }

  read(
    accessToken: string,
    operationId: string,
    input: ShootProofOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method !== "GET")
      throw this.invalid("ShootProof read accepts GET operations only.");
    return this.request(accessToken, operation, input);
  }

  manage(
    accessToken: string,
    operationId: string,
    input: ShootProofOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.method === "GET")
      throw this.invalid("ShootProof manage accepts mutation operations only.");
    return this.request(accessToken, operation, input);
  }

  private async request(
    accessToken: string,
    operation: ShootProofOperation,
    input: ShootProofOperationInput,
  ) {
    this.rejectCredentialFields(input);
    let path = operation.path;
    const pathParameters = input.pathParameters ?? {};
    this.exactKeys(pathParameters, operation.pathParameters, "path");
    for (const name of operation.pathParameters) {
      path = path.replaceAll(
        `{${name}}`,
        encodeURIComponent(this.segment(pathParameters[name], name)),
      );
    }
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://"))
      throw new ShootProofApiError(
        "policy_blocked",
        "ShootProof path escaped the pinned Studio API route.",
        403,
      );
    const url = new URL(
      `${ShootProofApiAdapter.BASE_PATH}${path === "/" ? "" : path}`,
      ShootProofApiAdapter.ORIGIN,
    );
    const query = input.query ?? {};
    this.exactKeys(query, operation.queryParameters, "query");
    for (const [name, raw] of Object.entries(query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.invalid(`ShootProof query ${name} has too many values.`);
      for (const value of values) {
        if (value === null || value === undefined || value === "") continue;
        url.searchParams.append(name, this.scalar(value, name));
      }
    }
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !operation.bodyAllowed)
      throw this.invalid(
        "This ShootProof operation does not accept a JSON body.",
      );
    if (body && Buffer.byteLength(body) > 2_000_000)
      throw this.invalid("ShootProof request exceeds the 2 MB Relay limit.");
    return this.directRequest(
      accessToken,
      `${url.pathname}${url.search}`,
      operation.method,
      body,
    );
  }

  private async directRequest(
    accessToken: string,
    target: string,
    method: string,
    body?: string,
  ) {
    const token = accessToken?.trim();
    if (!token || token.length > 20_000 || /[\r\n]/.test(token))
      throw new ShootProofApiError(
        "credential_missing",
        "ShootProof access token is missing.",
        401,
      );
    const url = new URL(target, ShootProofApiAdapter.ORIGIN);
    if (
      url.origin !== ShootProofApiAdapter.ORIGIN ||
      !url.pathname.startsWith(ShootProofApiAdapter.BASE_PATH)
    )
      throw new ShootProofApiError(
        "policy_blocked",
        "ShootProof request escaped the fixed Studio API origin.",
        403,
      );
    try {
      let response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/vnd.shootproof+json, application/json",
          Authorization: `Bearer ${token}`,
          ...(body
            ? { "Content-Type": "application/vnd.shootproof+json" }
            : {}),
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
      if (response.status >= 300 && response.status < 400) {
        if (method !== "GET")
          throw new ShootProofApiError(
            "policy_blocked",
            "ShootProof mutation returned an unexpected redirect.",
            403,
          );
        const redirect = this.safeDownloadUrl(response.headers.get("location"));
        response = await safeConnectorFetch(redirect, {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
          cache: "no-store",
        });
      }
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000)
        throw this.invalid("ShootProof response exceeds the 5 MB Relay limit.");
      const contentType = response.headers.get("content-type") ?? "";
      const data = this.redact(this.parse(raw, contentType));
      if (!response.ok)
        throw new ShootProofApiError(
          this.safeCode(response.status),
          this.message(data) ?? `ShootProof returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data,
        contentType: contentType.split(";", 1)[0] || null,
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof ShootProofApiError) throw error;
      throw new ShootProofApiError(
        "provider_unavailable",
        "ShootProof could not be reached.",
        502,
      );
    }
  }

  private operation(id: string) {
    const operation = SHOOTPROOF_OPERATION_BY_ID.get(id);
    if (!operation)
      throw this.invalid(
        "ShootProof operation is not in the pinned official OpenAPI contract.",
      );
    return operation;
  }

  private exactKeys(
    value: JsonObject,
    allowed: readonly string[],
    label: string,
  ) {
    for (const key of Object.keys(value))
      if (!allowed.includes(key))
        throw this.invalid(
          `ShootProof ${label} parameter ${key} is not allowed for this operation.`,
        );
  }

  private segment(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:-]{1,200}$/.test(text))
      throw this.invalid(`ShootProof ${name} path parameter is invalid.`);
    return text;
  }

  private scalar(value: unknown, name: string) {
    if (typeof value === "object")
      throw this.invalid(
        `ShootProof query ${name} must be a scalar or scalar array.`,
      );
    const text = String(value);
    if (text.length > 2_000 || /[\r\n]/.test(text))
      throw this.invalid(`ShootProof query ${name} is invalid.`);
    return text;
  }

  private safeDownloadUrl(value: string | null) {
    if (!value) throw this.invalid("ShootProof redirect had no location.");
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.invalid("ShootProof redirect location is invalid.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new ShootProofApiError(
        "policy_blocked",
        "ShootProof downloads must use credential-free HTTPS URLs.",
        403,
      );
    return url;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12)
      throw new ShootProofApiError(
        "policy_blocked",
        "ShootProof request is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) =>
        this.rejectCredentialFields(item, depth + 1),
      );
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(access.?token|refresh.?token|client.?secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new ShootProofApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private parse(raw: Buffer, contentType: string): unknown {
    if (!raw.length) return null;
    const text = raw.toString("utf8");
    if (/json|problem\+json/i.test(contentType)) {
      try {
        return JSON.parse(text);
      } catch {
        return { message: text.slice(0, 4_000) };
      }
    }
    if (/^text\//i.test(contentType)) return text.slice(0, 100_000);
    return {
      byteLength: raw.byteLength,
      sha256: createHash("sha256").update(raw).digest("hex"),
      contentOmitted: true,
    };
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 15) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" && value.length > 100_000
        ? `${value.slice(0, 100_000)}…`
        : value;
    const output: JsonObject = {};
    for (const [key, item] of Object.entries(value as JsonObject).slice(
      0,
      1_000,
    ))
      output[key] =
        /(access.?token|refresh.?token|client.?secret|authorization|password|cookie|api.?key)/i.test(
          key,
        )
          ? "[redacted]"
          : this.redact(item, depth + 1);
    return output;
  }

  private message(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const object = value as JsonObject;
    for (const candidate of [
      object.detail,
      object.title,
      object.message,
      object.error,
    ])
      if (typeof candidate === "string" && candidate.trim())
        return candidate.trim().slice(0, 500);
    return null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 400 && status < 500) return "provider_validation_error";
    return "provider_unavailable";
  }

  private invalid(message: string) {
    return new ShootProofApiError("provider_validation_error", message, 400);
  }
}
