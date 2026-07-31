import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type KlaviyoSmsCredentials = { accessToken: string; accountId: string };
export const KLAVIYO_SMS_REVISION = "2026-07-15.pre";

const OPS: Record<
  string,
  {
    method: "GET" | "POST";
    path: (c: KlaviyoSmsCredentials, i: JsonObject) => string;
  }
> = {
  get_configuration: {
    method: "GET",
    path: (c) =>
      `/api/text-messaging-configurations/${id(c.accountId, "accountId")}/`,
  },
  list_senders: {
    method: "GET",
    path: () =>
      "/api/text-messaging-senders/?page%5Bsize%5D=20&sort=-created_at",
  },
  get_sender: {
    method: "GET",
    path: (_, i) =>
      `/api/text-messaging-senders/${id(i.senderId, "senderId")}/`,
  },
  get_sender_registration: {
    method: "GET",
    path: (_, i) =>
      `/api/text-messaging-senders/${id(i.senderId, "senderId")}/text-messaging-sender-registration`,
  },
  get_registration: {
    method: "GET",
    path: (_, i) =>
      `/api/text-messaging-sender-registrations/${id(i.registrationId, "registrationId")}/`,
  },
  create_configuration: {
    method: "POST",
    path: () => "/api/text-messaging-configurations/",
  },
  create_sender: { method: "POST", path: () => "/api/text-messaging-senders/" },
  resubmit_registration: {
    method: "POST",
    path: () => "/api/text-messaging-sender-registrations/",
  },
};

@Injectable()
export class KlaviyoSmsApiAdapter {
  async health(credentials: KlaviyoSmsCredentials) {
    return {
      verified: true,
      accountId: credentials.accountId,
      revision: KLAVIYO_SMS_REVISION,
      data: await this.request(credentials, "list_senders", {}),
    };
  }

  request(
    credentials: KlaviyoSmsCredentials,
    operation: string,
    input: JsonObject,
  ) {
    const op = OPS[operation];
    if (!op)
      throw new KlaviyoSmsApiError(
        "tool_unavailable",
        "Klaviyo SMS operation is not pinned.",
      );
    return this.send(
      credentials,
      op.method,
      op.path(credentials, input),
      input.data,
    );
  }

  private async send(
    credentials: KlaviyoSmsCredentials,
    method: "GET" | "POST",
    path: string,
    data: unknown,
  ) {
    if (
      !/^[A-Za-z0-9_-]{1,64}$/.test(credentials.accountId) ||
      !credentials.accessToken.trim()
    )
      throw new KlaviyoSmsApiError(
        "credential_missing",
        "Klaviyo SMS account or token binding is missing.",
      );
    const url = new URL(path, "https://a.klaviyo.com");
    if (
      url.origin !== "https://a.klaviyo.com" ||
      !url.pathname.startsWith("/api/text-messaging-")
    )
      throw new KlaviyoSmsApiError(
        "policy_blocked",
        "Klaviyo SMS request escaped the pinned text-messaging API.",
      );
    if (method === "POST") this.validatePayload(data);
    const encoded = method === "POST" ? JSON.stringify({ data }) : undefined;
    if (encoded && Buffer.byteLength(encoded) > 512_000)
      throw new KlaviyoSmsApiError(
        "provider_validation_error",
        "Klaviyo SMS registration payload exceeds 512 KB.",
      );
    const response = await safeConnectorFetch(url, {
      method,
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${credentials.accessToken}`,
        revision: KLAVIYO_SMS_REVISION,
        ...(method === "POST"
          ? { "Content-Type": "application/vnd.api+json" }
          : {}),
      },
      body: encoded,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new KlaviyoSmsApiError(
        "provider_validation_error",
        "Klaviyo SMS response exceeded 2 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new KlaviyoSmsApiError(
        "provider_validation_error",
        "Klaviyo SMS returned invalid JSON.",
      );
    }
    if (!response.ok)
      throw new KlaviyoSmsApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Klaviyo SMS API request failed.",
        response.status,
      );
    return this.redact(body);
  }

  private validatePayload(value: unknown) {
    const object =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    if (!object || typeof object.type !== "string")
      throw new KlaviyoSmsApiError(
        "provider_validation_error",
        "A JSON:API resource data object is required.",
      );
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk);
      if (!entry || typeof entry !== "object") return;
      for (const [key, child] of Object.entries(entry as JsonObject)) {
        if (/(token|password|secret|authorization|api.?key)/i.test(key))
          throw new KlaviyoSmsApiError(
            "policy_blocked",
            "Credential-bearing registration fields are blocked.",
          );
        walk(child);
      }
    };
    walk(object);
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 100).map((v) => this.redact(v));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 20_000) : value;
    const out: JsonObject = {};
    for (const [key, entry] of Object.entries(value as JsonObject).slice(
      0,
      300,
    ))
      out[key] = /(token|password|secret|authorization|api.?key)/i.test(key)
        ? "[REDACTED]"
        : this.redact(entry);
    return out;
  }
}

export class KlaviyoSmsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

function id(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(text))
    throw new KlaviyoSmsApiError(
      "provider_validation_error",
      `${field} is invalid.`,
    );
  return encodeURIComponent(text);
}
