import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type MailchimpTransactionalCredentials = {
  apiKey: string;
  senderBoundary: string;
};

export class MailchimpTransactionalApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MailchimpTransactionalApiAdapter {
  async health(credentials: MailchimpTransactionalCredentials) {
    const data = await this.call(credentials, "/users/ping2", {});
    return { verified: true, data };
  }

  getAccount(credentials: MailchimpTransactionalCredentials) {
    return this.call(credentials, "/users/info", {});
  }

  listSenderDomains(credentials: MailchimpTransactionalCredentials) {
    return this.call(credentials, "/senders/domains", {});
  }

  listSenders(credentials: MailchimpTransactionalCredentials) {
    return this.call(credentials, "/senders/list", {});
  }

  sendMessage(
    credentials: MailchimpTransactionalCredentials,
    input: JsonObject,
  ) {
    const message = this.requiredObject(input.message, "message");
    this.assertMessageBoundary(message, credentials.senderBoundary);
    return this.call(credentials, "/messages/send", {
      message,
      async: this.booleanOrUndefined(input.async),
      ip_pool: this.stringOrUndefined(input.ipPool),
      send_at: this.stringOrUndefined(input.sendAt),
    });
  }

  sendTemplate(
    credentials: MailchimpTransactionalCredentials,
    input: JsonObject,
  ) {
    const message = this.requiredObject(input.message, "message");
    this.assertMessageBoundary(message, credentials.senderBoundary);
    return this.call(credentials, "/messages/send-template", {
      template_name: this.requiredString(input.templateName, "templateName"),
      template_content: Array.isArray(input.templateContent)
        ? input.templateContent.slice(0, 100)
        : [],
      message,
      async: this.booleanOrUndefined(input.async),
      ip_pool: this.stringOrUndefined(input.ipPool),
      send_at: this.stringOrUndefined(input.sendAt),
    });
  }

  sendMailchimpTemplate(
    credentials: MailchimpTransactionalCredentials,
    input: JsonObject,
  ) {
    const message = this.requiredObject(input.message, "message");
    this.assertMessageBoundary(message, credentials.senderBoundary);
    const templateId = Number(input.templateId);
    if (!Number.isSafeInteger(templateId) || templateId < 1)
      throw new MailchimpTransactionalApiError(
        "provider_validation_error",
        "templateId must be a positive integer.",
      );
    const version = this.stringOrUndefined(input.templateVersion);
    if (version && version !== "draft" && version !== "published")
      throw new MailchimpTransactionalApiError(
        "provider_validation_error",
        "templateVersion must be draft or published.",
      );
    return this.call(credentials, "/messages/send-mc-template", {
      mc_template_id: templateId,
      mc_template_version: version,
      message,
      async: this.booleanOrUndefined(input.async),
      ip_pool: this.stringOrUndefined(input.ipPool),
      send_at: this.stringOrUndefined(input.sendAt),
    });
  }

  request(
    credentials: MailchimpTransactionalCredentials,
    input: { path: string; payload?: JsonObject },
  ) {
    return this.call(credentials, input.path, input.payload ?? {}, true);
  }

  private async call(
    credentials: MailchimpTransactionalCredentials,
    path: string,
    payload: JsonObject,
    raw = false,
  ) {
    const normalizedPath = this.normalizedPath(path);
    if (raw) this.assertRawPath(normalizedPath);
    this.rejectSecretFields(payload);
    const body = this.compact({ key: credentials.apiKey, ...payload });
    const encoded = JSON.stringify(body);
    if (Buffer.byteLength(encoded) > 10 * 1024 * 1024)
      throw new MailchimpTransactionalApiError(
        "provider_validation_error",
        "Mailchimp Transactional request exceeds Relay's 10 MB boundary.",
      );
    const response = await safeConnectorFetch(
      `https://mandrillapp.com/api/1.0${normalizedPath}.json`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: encoded,
      },
    );
    const rawText = await response.text();
    if (Buffer.byteLength(rawText) > 5 * 1024 * 1024)
      throw new MailchimpTransactionalApiError(
        "provider_validation_error",
        "Mailchimp Transactional response exceeds Relay's 5 MB boundary.",
        response.status,
      );
    let parsed: unknown = rawText;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = rawText.slice(0, 8_192);
    }
    const safe = this.redact(parsed);
    const error = this.object(safe);
    if (!response.ok || error?.status === "error")
      throw new MailchimpTransactionalApiError(
        this.errorCode(response.status, error),
        this.errorMessage(error) ??
          `Mailchimp Transactional returned ${response.status}.`,
        response.status,
      );
    return {
      status: response.status,
      data: safe,
      requestId:
        response.headers.get("x-request-id") ??
        response.headers.get("x-mandrill-request-id"),
    };
  }

  private normalizedPath(path: string) {
    const value = path.trim().replace(/\.json$/i, "");
    if (!/^\/[a-z0-9-]+\/[a-z0-9-]+$/.test(value))
      throw new MailchimpTransactionalApiError(
        "provider_validation_error",
        "Mailchimp Transactional path must be one documented category/method path.",
      );
    return value;
  }

  private assertRawPath(path: string) {
    const wrapperOnly = new Set([
      "/messages/send",
      "/messages/send-template",
      "/messages/send-mc-template",
    ]);
    if (wrapperOnly.has(path))
      throw new MailchimpTransactionalApiError(
        "policy_blocked",
        "Email sends must use a sender-bound Mailchimp Transactional send tool.",
      );
    if (
      path === "/messages/send-sms" ||
      path === "/inbound/send-raw" ||
      path.startsWith("/exports/")
    )
      throw new MailchimpTransactionalApiError(
        "policy_blocked",
        "SMS, raw MIME relay, and export jobs are outside this connector boundary.",
      );
  }

  private assertMessageBoundary(message: JsonObject, boundary: string) {
    const from = this.requiredString(message.from_email, "message.from_email");
    const normalizedBoundary = boundary.toLowerCase().replace(/^@/, "");
    const normalizedFrom = from.toLowerCase();
    const allowed = normalizedBoundary.includes("@")
      ? normalizedFrom === normalizedBoundary
      : normalizedFrom.endsWith(`@${normalizedBoundary}`);
    if (!allowed)
      throw new MailchimpTransactionalApiError(
        "sender_identity_not_approved",
        `Sender must match ${boundary}.`,
      );
    const recipients = Array.isArray(message.to) ? message.to : [];
    if (recipients.length < 1 || recipients.length > 1_000)
      throw new MailchimpTransactionalApiError(
        "provider_validation_error",
        "A message must contain 1 to 1,000 recipients.",
      );
    for (const recipient of recipients) {
      const email = this.stringOrUndefined(this.object(recipient)?.email);
      if (!email)
        throw new MailchimpTransactionalApiError(
          "provider_validation_error",
          "Every recipient must include an email address.",
        );
    }
  }

  private rejectSecretFields(value: unknown) {
    const visit = (entry: unknown, path: string) => {
      if (Array.isArray(entry)) {
        entry.forEach((item, index) => visit(item, `${path}[${index}].`));
        return;
      }
      const object = this.object(entry);
      if (!object) return;
      for (const [key, child] of Object.entries(object)) {
        if (
          /^(key|api.?keys?|password|secret|authorization|credentials?|access.?token|refresh.?token)$/i.test(
            key,
          )
        )
          throw new MailchimpTransactionalApiError(
            "policy_blocked",
            `Credential-bearing field ${path}${key} is not allowed.`,
          );
        visit(child, `${path}${key}.`);
      }
    };
    visit(value, "");
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item));
    if (typeof value === "string") return this.redactUrlQuery(value);
    const object = this.object(value);
    if (!object) return value;
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(object).slice(0, 500))
      result[key] =
        /(key|password|secret|authorization|credential|token)/i.test(key)
          ? "[REDACTED]"
          : this.redact(entry);
    return result;
  }

  private redactUrlQuery(value: string) {
    if (!/^https:\/\//i.test(value)) return value;
    try {
      const url = new URL(value);
      return url.search ? `${url.origin}${url.pathname}?[REDACTED]` : value;
    } catch {
      return value;
    }
  }

  private errorCode(status: number, body: JsonObject | null) {
    const name = this.stringOrUndefined(body?.name)?.toLowerCase() ?? "";
    if (status === 401 || name.includes("invalid_key"))
      return "credential_missing" as const;
    if (status === 429) return "provider_rate_limited" as const;
    if (status >= 500) return "provider_unavailable" as const;
    return "provider_validation_error" as const;
  }

  private errorMessage(body: JsonObject | null) {
    return (
      this.stringOrUndefined(body?.message) ??
      this.stringOrUndefined(body?.name) ??
      null
    );
  }

  private compact(value: JsonObject) {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined),
    );
  }

  private requiredObject(value: unknown, field: string) {
    const result = this.object(value);
    if (!result)
      throw new MailchimpTransactionalApiError(
        "provider_validation_error",
        `${field} is required.`,
      );
    return result;
  }

  private requiredString(value: unknown, field: string) {
    const result = this.stringOrUndefined(value);
    if (!result)
      throw new MailchimpTransactionalApiError(
        "provider_validation_error",
        `${field} is required.`,
      );
    return result;
  }

  private stringOrUndefined(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private booleanOrUndefined(value: unknown) {
    return typeof value === "boolean" ? value : undefined;
  }

  private object(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }
}
