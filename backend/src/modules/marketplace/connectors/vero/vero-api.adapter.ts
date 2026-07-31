import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  VERO_OPERATION_BY_ID,
  type VeroOperation,
} from "./vero-operation-registry";

type JsonObject = Record<string, unknown>;
export type VeroCredentials = {
  trackingApiKey: string;
  campaignsApiKey: string;
};
export type VeroInput = {
  pathParams?: JsonObject;
  query?: JsonObject;
  body?: JsonObject;
  consentAttestation?: boolean;
};

@Injectable()
export class VeroApiAdapter {
  private static readonly ORIGIN = "https://api.getvero.com";
  private static readonly CAMPAIGNS_REVISION = "2026-03-01";

  health(credentials: VeroCredentials) {
    return this.read(credentials, "list_broadcasts", { query: { limit: 1 } });
  }

  read(credentials: VeroCredentials, operationId: string, input: VeroInput) {
    const operation = this.operation(operationId);
    if (operation.policy === "manage")
      throw this.validation("Vero read accepts read operations only.");
    return this.request(credentials, operation, input);
  }

  manage(credentials: VeroCredentials, operationId: string, input: VeroInput) {
    const operation = this.operation(operationId);
    if (operation.policy !== "manage")
      throw this.validation("Vero manage accepts mutation operations only.");
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: VeroCredentials,
    operation: VeroOperation,
    input: VeroInput,
  ) {
    const trackingApiKey = credentials.trackingApiKey.trim();
    const campaignsApiKey = credentials.campaignsApiKey.trim();
    if (!trackingApiKey || trackingApiKey.length > 20_000)
      throw new VeroApiError(
        "credential_missing",
        "Vero tracking API key is missing.",
      );
    if (!campaignsApiKey || campaignsApiKey.length > 20_000)
      throw new VeroApiError(
        "credential_missing",
        "Vero Campaigns API secret key is missing.",
      );
    this.rejectSecrets(input);
    const url = new URL(
      this.path(operation, input.pathParams ?? {}),
      VeroApiAdapter.ORIGIN,
    );
    this.query(url.searchParams, operation, input.query ?? {});
    if (
      url.origin !== VeroApiAdapter.ORIGIN ||
      !url.pathname.startsWith("/api/v2/")
    )
      throw new VeroApiError(
        "policy_blocked",
        "Vero request escaped the fixed v2 API origin.",
      );
    let bodyObject: JsonObject | undefined;
    if (operation.body) {
      if (!input.body || typeof input.body !== "object")
        throw this.validation("Vero operation requires a JSON body.");
      bodyObject = { ...input.body };
      this.bound(operation.id, bodyObject, input.consentAttestation === true);
      if (operation.auth === "track")
        bodyObject.tracking_api_key = trackingApiKey;
    } else if (input.body !== undefined)
      throw this.validation("Vero operation does not accept a body.");
    const body = bodyObject ? JSON.stringify(bodyObject) : undefined;
    if (body && Buffer.byteLength(body) > 512_000)
      throw this.validation("Vero request exceeds 512 KB.");
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          ...(operation.auth === "campaign"
            ? {
                Authorization: `Bearer ${campaignsApiKey}`,
                revision: VeroApiAdapter.CAMPAIGNS_REVISION,
              }
            : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(
          operation.policy === "manage" ? 30_000 : 20_000,
        ),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 3_000_000)
        throw this.validation("Vero response exceeds 3 MB.");
      const data = this.redact(raw.length ? this.parse(raw) : {});
      if (!response.ok)
        throw new VeroApiError(
          this.safeCode(response.status),
          `Vero returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof VeroApiError) throw error;
      throw new VeroApiError(
        "provider_unavailable",
        "Vero could not be reached.",
      );
    }
  }

  private path(operation: VeroOperation, params: JsonObject) {
    const allowed = new Set(operation.pathParams ?? []);
    if (Object.keys(params).some((key) => !allowed.has(key)))
      throw this.validation("Vero path parameters are not allowlisted.");
    let path = operation.path;
    for (const name of allowed) {
      const value = ["string", "number"].includes(typeof params[name])
        ? String(params[name]).trim()
        : "";
      if (!/^\d{1,20}$/.test(value))
        throw this.validation(`Vero ${name} must be a numeric resource ID.`);
      path = path.replace(`{${name}}`, encodeURIComponent(value));
    }
    return path;
  }

  private query(
    params: URLSearchParams,
    operation: VeroOperation,
    query: JsonObject,
  ) {
    const allowed = new Set(operation.query ?? []);
    if (Object.keys(query).some((key) => !allowed.has(key)))
      throw this.validation("Vero query field is not allowlisted.");
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === "") continue;
      if (!["string", "number", "boolean"].includes(typeof value))
        throw this.validation(`Vero ${key} must be scalar.`);
      const text = String(value);
      if (text.length > 200 || /[\r\n]/.test(text))
        throw this.validation(`Vero ${key} is invalid.`);
      params.set(key, text);
    }
    if (["list_broadcasts", "list_journeys"].includes(operation.id)) {
      if (!params.has("limit")) params.set("limit", "25");
      if (!this.integerInRange(params.get("limit"), 1, 100))
        throw this.validation("Vero list reads allow at most 100 records.");
    }
  }

  private bound(operationId: string, body: JsonObject, consent: boolean) {
    if (
      ["identify_user", "track_event", "resubscribe_user"].includes(
        operationId,
      ) &&
      !consent
    )
      throw new VeroApiError(
        "policy_blocked",
        "Vero profile creation, event ingestion, and resubscription require an explicit recorded consent attestation.",
      );
    if (operationId === "edit_user_tags") {
      for (const key of ["add", "remove"]) {
        const values = body[key];
        if (
          values !== undefined &&
          (!Array.isArray(values) || values.length > 25)
        )
          throw this.validation(`Vero ${key} allows at most 25 tags.`);
      }
    }
    if (
      operationId === "create_broadcast" &&
      ("audience" in body || "schedule" in body)
    )
      throw new VeroApiError(
        "policy_blocked",
        "Vero broadcast audience and scheduling are not agent-facing.",
      );
  }

  private operation(id: string) {
    const operation = VERO_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new VeroApiError(
        "tool_unavailable",
        "Vero operation is not pinned.",
      );
    return operation;
  }

  private integerInRange(value: string | null, min: number, max: number) {
    return (
      !!value &&
      /^\d+$/.test(value) &&
      Number(value) >= min &&
      Number(value) <= max
    );
  }

  private rejectSecrets(value: unknown) {
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk);
      if (!entry || typeof entry !== "object") return;
      for (const [key, child] of Object.entries(entry as JsonObject)) {
        if (
          /(auth.?token|tracking.?api.?key|api.?key|password|secret|authorization|cookie)/i.test(
            key,
          )
        )
          throw new VeroApiError(
            "policy_blocked",
            "Credential-bearing Vero input fields are blocked.",
          );
        if (
          /(url|uri|endpoint|link)$/i.test(key) &&
          typeof child === "string"
        ) {
          let url: URL;
          try {
            url = new URL(child);
          } catch {
            throw this.validation(`Vero ${key} must be an absolute URL.`);
          }
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            [...url.searchParams.keys()].some((name) =>
              /(key|token|secret|password|auth)/i.test(name),
            )
          )
            throw new VeroApiError(
              "policy_blocked",
              "Credential-bearing or non-HTTPS Vero URLs are blocked.",
            );
        }
        walk(child);
      }
    };
    walk(value);
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 200).map((entry) => this.redact(entry));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 20_000) : value;
    const out: JsonObject = {};
    for (const [key, entry] of Object.entries(value as JsonObject).slice(
      0,
      500,
    ))
      out[key] =
        /(auth.?token|tracking.?api.?key|api.?key|password|secret|authorization|cookie)/i.test(
          key,
        )
          ? "[REDACTED]"
          : this.redact(entry);
    return out;
  }

  private parse(raw: Buffer): unknown {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      throw this.validation("Vero returned invalid JSON.");
    }
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new VeroApiError("provider_validation_error", message);
  }
}

export class VeroApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
