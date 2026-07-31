import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT" | "DELETE";
export type PracticeBetterCredentials = {
  clientId: string;
  clientSecret: string;
};

const READ_OPERATIONS: ReadonlyArray<[Method, string]> = [
  ["GET", "/company/administration/members"],
  ["GET", "/consultant/availability/slots"],
  ["GET", "/consultant/courses"],
  ["GET", "/consultant/courses/{courseId}"],
  ["GET", "/consultant/courses/{courseId}/enrollments"],
  ["GET", "/consultant/dietlifestyle/{recordId}"],
  ["GET", "/consultant/formrequests"],
  ["GET", "/consultant/formrequests/{requestId}"],
  ["GET", "/consultant/forms"],
  ["GET", "/consultant/insurance/cms1500"],
  ["GET", "/consultant/insurance/cms1500/{formId}"],
  ["GET", "/consultant/insurance/superbills"],
  ["GET", "/consultant/insurance/superbills/{billId}"],
  ["GET", "/consultant/labrequests"],
  ["GET", "/consultant/labrequests/{labRequestId}"],
  ["GET", "/consultant/labrequests/{labRequestId}/attachments/{itemId}"],
  ["GET", "/consultant/measurements/{recordId}/blood"],
  ["GET", "/consultant/measurements/{recordId}/blood/{measurementsId}"],
  ["GET", "/consultant/measurements/{recordId}/body"],
  ["GET", "/consultant/measurements/{recordId}/body/{measurementsId}"],
  ["GET", "/consultant/media/{itemId}"],
  ["GET", "/consultant/medicalhistory/{recordId}"],
  ["GET", "/consultant/medicalhistory/{recordId}/healthproducts"],
  ["GET", "/consultant/packages"],
  ["GET", "/consultant/packages/instances"],
  ["GET", "/consultant/packages/instances/{instanceId}"],
  ["GET", "/consultant/payments/invoices"],
  ["GET", "/consultant/payments/invoices/{invoiceId}"],
  ["GET", "/consultant/profile"],
  ["GET", "/consultant/protocols"],
  ["GET", "/consultant/protocols/{protocolId}"],
  ["GET", "/consultant/protocols/{protocolId}/attachments/{itemId}"],
  ["GET", "/consultant/records"],
  ["GET", "/consultant/records/{recordId}"],
  ["GET", "/consultant/reminders"],
  ["GET", "/consultant/reminders/{reminderId}"],
  ["POST", "/consultant/reports/billing/paymenthistory"],
  ["POST", "/consultant/reports/billing/salestax"],
  ["POST", "/consultant/reports/billing/statement"],
  ["POST", "/consultant/reports/insurance/claims"],
  ["GET", "/consultant/services"],
  ["GET", "/consultant/sessionnotes"],
  ["GET", "/consultant/sessionnotes/{notesId}"],
  ["GET", "/consultant/sessions"],
  ["GET", "/consultant/sessions/{sessionId}"],
  ["GET", "/tags"],
  ["GET", "/tags/{tagId}"],
  ["GET", "/timezones"],
  ["GET", "/user/journalentries"],
  ["GET", "/webhooks/delivery"],
  ["GET", "/webhooks/subscription"],
  ["GET", "/webhooks/subscription/event/types"],
  ["GET", "/webhooks/subscription/{subscriptionId}"],
];

const MANAGE_OPERATIONS: ReadonlyArray<[Method, string]> = [
  ["POST", "/consultant/courses/aicontentgenerator"],
  ["POST", "/consultant/courses/{courseId}/enrollments"],
  ["DELETE", "/consultant/courses/{courseId}/enrollments"],
  ["POST", "/consultant/dietlifestyle/{recordId}"],
  ["PUT", "/consultant/dietlifestyle/{recordId}"],
  ["POST", "/consultant/formrequests"],
  ["DELETE", "/consultant/measurements/{recordId}/blood"],
  ["POST", "/consultant/measurements/{recordId}/blood"],
  ["PUT", "/consultant/measurements/{recordId}/blood"],
  ["DELETE", "/consultant/measurements/{recordId}/body"],
  ["POST", "/consultant/measurements/{recordId}/body"],
  ["PUT", "/consultant/measurements/{recordId}/body"],
  ["POST", "/consultant/medicalhistory/{recordId}"],
  ["PUT", "/consultant/medicalhistory/{recordId}"],
  ["POST", "/consultant/medicalhistory/{recordId}/healthproducts"],
  ["PUT", "/consultant/medicalhistory/{recordId}/healthproducts"],
  ["DELETE", "/consultant/medicalhistory/{recordId}/healthproducts/{productId}"],
  ["POST", "/consultant/packages/instances"],
  ["DELETE", "/consultant/packages/instances/{instanceId}"],
  ["POST", "/consultant/packages/instances/{instanceId}/cancel"],
  ["PUT", "/consultant/profile/availability"],
  ["PUT", "/consultant/profile/basic"],
  ["PUT", "/consultant/profile/booking"],
  ["PUT", "/consultant/profile/print"],
  ["PUT", "/consultant/profile/protocols"],
  ["PUT", "/consultant/profile/social"],
  ["PUT", "/consultant/profile/webanalytics"],
  ["POST", "/consultant/records"],
  ["DELETE", "/consultant/records/{recordId}"],
  ["PUT", "/consultant/records/{recordId}"],
  ["POST", "/consultant/sessions"],
  ["DELETE", "/consultant/sessions/{sessionId}"],
  ["POST", "/consultant/sessions/{sessionId}/cancel"],
  ["PUT", "/consultant/sessions/{sessionId}/date"],
  ["PUT", "/consultant/taggables"],
  ["POST", "/tags"],
  ["DELETE", "/tags/{tagId}"],
  ["POST", "/webhooks/subscription"],
  ["DELETE", "/webhooks/subscription/{subscriptionId}"],
];

export class PracticeBetterApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PracticeBetterApiAdapter {
  async health(credentials: PracticeBetterCredentials) {
    await this.accessToken(this.credentials(credentials));
    return { credentialsVerified: true, origin: "https://api.practicebetter.io" };
  }

  read(credentials: PracticeBetterCredentials, input: JsonObject) {
    const method = String(input.method ?? "GET").toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (!this.matches(READ_OPERATIONS, method, path))
      throw this.validation("Practice Better retrieval endpoint is not supported.");
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  manage(credentials: PracticeBetterCredentials, input: JsonObject) {
    const method = this.required(input.method, "method", 10).toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (!this.matches(MANAGE_OPERATIONS, method, path))
      throw this.validation("Practice Better mutation endpoint is not supported.");
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  private credentials(credentials: PracticeBetterCredentials) {
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    if (!clientId || clientId.length > 10_000)
      throw new PracticeBetterApiError(
        "credential_missing",
        "Practice Better client ID is required.",
        401,
      );
    if (!clientSecret || clientSecret.length > 10_000)
      throw new PracticeBetterApiError(
        "credential_missing",
        "Practice Better client secret is required.",
        401,
      );
    return { clientId, clientSecret };
  }

  private async accessToken(credentials: PracticeBetterCredentials) {
    const body = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });
    try {
      const response = await safeConnectorFetch("https://api.practicebetter.io/oauth2/token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Practice Better token response exceeds 1 MB.");
      const data = this.parse(raw);
      if (!response.ok)
        throw new PracticeBetterApiError(
          response.status === 429 ? "provider_rate_limited" : "token_refresh_failed",
          this.message(data) ?? "Practice Better rejected the client credentials.",
          response.status,
        );
      const token = this.object(data)?.access_token;
      if (typeof token !== "string" || !token.trim() || token.length > 10_000)
        throw new PracticeBetterApiError(
          "token_refresh_failed",
          "Practice Better did not return an access token.",
          502,
        );
      return token.trim();
    } catch (error) {
      if (error instanceof PracticeBetterApiError) throw error;
      throw new PracticeBetterApiError(
        "provider_unavailable",
        "Practice Better's token service could not be reached.",
        502,
      );
    }
  }

  private async request(
    rawCredentials: PracticeBetterCredentials,
    input: { method: Method; path: string; query?: JsonObject; json?: JsonObject },
  ) {
    if (
      !this.matches(READ_OPERATIONS, input.method, input.path) &&
      !this.matches(MANAGE_OPERATIONS, input.method, input.path)
    )
      throw this.validation("Practice Better endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const credentials = this.credentials(rawCredentials);
    const accessToken = await this.accessToken(credentials);
    const url = new URL(input.path, "https://api.practicebetter.io");
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000)
        throw this.validation("Practice Better request exceeds 2 MB.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: input.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000)
        throw this.validation("Practice Better response exceeds 5 MB.");
      const data = this.redact(this.parse(raw));
      if (!response.ok)
        throw new PracticeBetterApiError(
          this.code(response.status),
          this.message(data) ?? `Practice Better returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof PracticeBetterApiError) throw error;
      throw new PracticeBetterApiError(
        "provider_unavailable",
        "Practice Better could not be reached.",
        502,
      );
    }
  }

  private matches(
    operations: ReadonlyArray<[Method, string]>,
    method: Method,
    path: string,
  ) {
    return operations.some(
      ([allowedMethod, template]) =>
        allowedMethod === method && this.routePattern(template).test(path),
    );
  }

  private routePattern(template: string) {
    const pattern = template
      .split("/")
      .map((segment) =>
        /^\{[A-Za-z][A-Za-z0-9]*\}$/.test(segment)
          ? "[A-Za-z0-9_-]{1,200}"
          : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("/");
    return new RegExp(`^${pattern}$`);
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw this.validation("Practice Better query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(key))
        throw this.validation("Practice Better query field is invalid.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.validation("Practice Better query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("Practice Better query value is invalid.");
        params.append(key, String(child).slice(0, 10_000));
      }
    }
  }

  private parse(raw: Buffer): unknown {
    const text = raw.toString("utf8");
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return text.slice(0, 1_000_000);
    }
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }

  private rejectSecrets(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new PracticeBetterApiError(
          "policy_blocked",
          "Practice Better request is too deeply nested.",
        );
      if (Array.isArray(item)) {
        if (item.length > 1000)
          throw new PracticeBetterApiError(
            "policy_blocked",
            "Practice Better request array is too large.",
          );
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000)
        throw new PracticeBetterApiError(
          "policy_blocked",
          "Practice Better request object is too large.",
        );
      for (const [key, child] of entries) {
        if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key))
          throw new PracticeBetterApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private required(value: unknown, name: string, maxLength: number) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength)
      throw this.validation(`Practice Better ${name} is required.`);
    return value.trim();
  }

  private message(value: unknown) {
    if (typeof value === "string") return value.slice(0, 500);
    const object = this.object(value);
    const candidate = object?.message ?? object?.error_description ?? object?.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new PracticeBetterApiError("provider_validation_error", message, 400);
  }
}
