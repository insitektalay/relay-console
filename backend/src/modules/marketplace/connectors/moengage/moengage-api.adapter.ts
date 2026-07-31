import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  MOENGAGE_OPERATION_BY_ID,
  type MoEngageOperation,
} from "./moengage-operation-registry";
type JsonObject = Record<string, unknown>;
export type MoEngageCredentials = {
  workspaceId: string;
  apiKey: string;
  dataCenter: string;
  healthCustomerId: string;
};
export type MoEngageInput = {
  customerId?: unknown;
  attributes?: JsonObject;
  consentAttestation?: boolean;
};
@Injectable()
export class MoEngageApiAdapter {
  private static readonly ORIGINS: Record<string, string> = Object.fromEntries(
    ["01", "02", "03", "04", "05", "06"].map((dc) => [
      dc,
      `https://api-${dc}.moengage.com`,
    ]),
  );
  health(credentials: MoEngageCredentials) {
    return this.read(credentials, "get_user", {
      customerId: credentials.healthCustomerId,
    });
  }
  read(
    credentials: MoEngageCredentials,
    operationId: string,
    input: MoEngageInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy !== "sensitive_read")
      throw this.validation("MoEngage read accepts the exact-user read only.");
    return this.request(credentials, operation, input);
  }
  manage(
    credentials: MoEngageCredentials,
    operationId: string,
    input: MoEngageInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy !== "manage")
      throw this.validation("MoEngage manage accepts one-user updates only.");
    return this.request(credentials, operation, input);
  }
  private async request(
    credentials: MoEngageCredentials,
    operation: MoEngageOperation,
    input: MoEngageInput,
  ) {
    this.rejectSecrets(input);
    const workspaceId = this.text(credentials.workspaceId, "workspace ID", 200);
    const apiKey = credentials.apiKey.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new MoEngageApiError(
        "credential_missing",
        "MoEngage Data API key is missing.",
      );
    const origin = MoEngageApiAdapter.ORIGINS[credentials.dataCenter.trim()];
    if (!origin)
      throw this.validation("MoEngage data center must be 01 through 06.");
    const customerId = this.text(input.customerId, "customerId", 500);
    let path = operation.path.replace(
      "{workspaceId}",
      encodeURIComponent(workspaceId),
    );
    const url = new URL(path, origin);
    url.searchParams.set("app_id", workspaceId);
    let payload: JsonObject;
    if (operation.policy === "sensitive_read") {
      payload = {
        data: {
          identifiers: [
            { identifier_type: "customer_id", identifier: customerId },
          ],
        },
      };
    } else {
      if (input.consentAttestation !== true)
        throw new MoEngageApiError(
          "policy_blocked",
          "MoEngage user updates require explicit recorded user authorization.",
        );
      payload = {
        type: "customer",
        customer_id: customerId,
        attributes: this.attributes(input.attributes),
      };
    }
    const body = JSON.stringify(payload);
    if (Buffer.byteLength(body) > 64_000)
      throw this.validation("MoEngage request exceeds 64 KB.");
    try {
      const response = await safeConnectorFetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${workspaceId}:${apiKey}`, "utf8").toString("base64")}`,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(
          operation.policy === "manage" ? 30_000 : 20_000,
        ),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("MoEngage response exceeds 1 MB.");
      const data = this.parseJson(raw);
      if (!response.ok)
        throw new MoEngageApiError(
          this.safeCode(response.status),
          `MoEngage returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data: this.redact(data),
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof MoEngageApiError) throw error;
      throw new MoEngageApiError(
        "provider_unavailable",
        "MoEngage could not be reached.",
      );
    }
  }
  private attributes(value: JsonObject | undefined) {
    if (
      !value ||
      Array.isArray(value) ||
      Object.keys(value).length < 1 ||
      Object.keys(value).length > 20
    )
      throw this.validation(
        "MoEngage attributes must contain 1 to 20 entries.",
      );
    const output: JsonObject = {};
    for (const [key, raw] of Object.entries(value)) {
      if (!/^[A-Za-z0-9 _.-]{1,100}$/.test(key))
        throw this.validation("MoEngage attribute name is invalid.");
      if (
        /(consent|opt.?in|opt.?out|subscription|suppression|unsubscribe|push.?permission)/i.test(
          key,
        )
      )
        throw new MoEngageApiError(
          "policy_blocked",
          "MoEngage consent and subscription attributes are blocked.",
        );
      if (
        !["string", "number", "boolean"].includes(typeof raw) ||
        String(raw).length > 4_000 ||
        /[\u0000]/.test(String(raw))
      )
        throw this.validation(`MoEngage ${key} value is invalid.`);
      output[key] = raw;
    }
    return output;
  }
  private text(value: unknown, label: string, maximum: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > maximum || /[\u0000\r\n]/.test(text))
      throw this.validation(`MoEngage ${label} is invalid.`);
    return text;
  }
  private operation(id: string) {
    const operation = MOENGAGE_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new MoEngageApiError(
        "tool_unavailable",
        "MoEngage operation is not pinned.",
      );
    return operation;
  }
  private rejectSecrets(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value as JsonObject))
      if (
        /(api.?key|authorization|password|cookie|url|uri|endpoint|workspace.?id|app.?id|data.?center)/i.test(
          key,
        )
      )
        throw new MoEngageApiError(
          "policy_blocked",
          "Credential or routing MoEngage input fields are blocked.",
        );
  }
  private parseJson(raw: Buffer): JsonObject | unknown[] {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object") return value;
    } catch {
      /* normalize */
    }
    throw this.validation("MoEngage returned invalid JSON.");
  }
  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 200).map((entry) => this.redact(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, child]) => [
          key,
          /(api.?key|authorization|password|cookie)/i.test(key)
            ? "[REDACTED]"
            : this.redact(child),
        ]),
    );
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new MoEngageApiError("provider_validation_error", message);
  }
}
export class MoEngageApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
