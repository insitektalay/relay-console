import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  MESSAGEGEARS_OPERATION_BY_ID,
  type MessageGearsOperation,
} from "./messagegears-operation-registry";

type JsonObject = Record<string, unknown>;
export type MessageGearsCredentials = { accountId: string; apiKey: string };
export type MessageGearsInput = {
  parameters?: JsonObject;
  consentAttestation?: boolean;
};

@Injectable()
export class MessageGearsApiAdapter {
  private static readonly URL = "https://api.messagegears.net/3.1/WebService";

  health(credentials: MessageGearsCredentials) {
    const yesterday = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);
    return this.read(credentials, "get_account_summary", {
      parameters: { ActivityDate: yesterday },
    });
  }

  read(
    credentials: MessageGearsCredentials,
    operationId: string,
    input: MessageGearsInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy === "manage")
      throw this.validation(
        "MessageGears read accepts read and preview operations only.",
      );
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: MessageGearsCredentials,
    operationId: string,
    input: MessageGearsInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy !== "manage")
      throw this.validation(
        "MessageGears manage accepts transactional send operations only.",
      );
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: MessageGearsCredentials,
    operation: MessageGearsOperation,
    input: MessageGearsInput,
  ) {
    const accountId = credentials.accountId.trim();
    const apiKey = credentials.apiKey.trim();
    if (!accountId || accountId.length > 200)
      throw new MessageGearsApiError(
        "credential_missing",
        "MessageGears account ID is missing.",
      );
    if (!apiKey || apiKey.length > 20_000)
      throw new MessageGearsApiError(
        "credential_missing",
        "MessageGears API key is missing.",
      );
    this.rejectSecrets(input);
    if (operation.policy === "manage" && input.consentAttestation !== true)
      throw new MessageGearsApiError(
        "policy_blocked",
        "MessageGears transactional sends require an explicit recorded recipient authorization attestation.",
      );
    const parameters = input.parameters ?? {};
    const allowed = new Set(operation.parameters);
    if (Object.keys(parameters).some((key) => !allowed.has(key)))
      throw this.validation("MessageGears parameter is not allowlisted.");
    const form = new URLSearchParams({
      Action: operation.action,
      AccountId: accountId,
      ApiKey: apiKey,
    });
    for (const [key, raw] of Object.entries(parameters)) {
      if (raw == null || raw === "") continue;
      if (!["string", "number", "boolean"].includes(typeof raw))
        throw this.validation(`MessageGears ${key} must be scalar.`);
      const value = String(raw);
      if (value.length > 400_000 || /[\u0000]/.test(value))
        throw this.validation(`MessageGears ${key} is invalid.`);
      if (/Xml$/i.test(key)) this.validateXml(key, value);
      form.set(key, value);
    }
    this.required(operation.id, form);
    const body = form.toString();
    if (Buffer.byteLength(body) > 512_000)
      throw this.validation("MessageGears request exceeds 512 KB.");
    try {
      const response = await safeConnectorFetch(MessageGearsApiAdapter.URL, {
        method: "POST",
        headers: {
          Accept: "application/xml, text/xml",
          "Content-Type": "application/x-www-form-urlencoded",
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
        throw this.validation("MessageGears response exceeds 1 MB.");
      const xml = this.redactXml(raw.toString("utf8"));
      if (!response.ok)
        throw new MessageGearsApiError(
          this.safeCode(response.status),
          `MessageGears returned HTTP ${response.status}.`,
          response.status,
        );
      if (/AuthenticationException/i.test(xml))
        throw new MessageGearsApiError(
          "token_expired",
          "MessageGears rejected the account credentials.",
        );
      if (/<Result>REQUEST_FAILED<\/Result>/i.test(xml))
        throw new MessageGearsApiError(
          "provider_validation_error",
          "MessageGears rejected the request.",
        );
      return {
        data: { xml: xml.slice(0, 1_000_000) },
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof MessageGearsApiError) throw error;
      throw new MessageGearsApiError(
        "provider_unavailable",
        "MessageGears could not be reached.",
      );
    }
  }

  private required(operationId: string, form: URLSearchParams) {
    if (
      operationId === "get_account_summary" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(form.get("ActivityDate") ?? "")
    )
      throw this.validation("MessageGears ActivityDate must use YYYY-MM-DD.");
    if (operationId === "get_bulk_job_summary") {
      const ids = ["BulkJobRequestId", "BulkJobCorrelationId"].filter((key) =>
        form.has(key),
      );
      if (ids.length !== 1)
        throw this.validation(
          "MessageGears bulk summary requires exactly one request or correlation ID.",
        );
    }
    if (["preview_message", "send_transactional_job"].includes(operationId)) {
      for (const key of ["FromAddress", "SubjectLine", "RecipientXml"])
        if (!form.has(key))
          throw this.validation(`MessageGears ${operationId} requires ${key}.`);
      if (!form.has("HtmlTemplate") && !form.has("TextTemplate"))
        throw this.validation(
          `MessageGears ${operationId} requires an HTML or text template.`,
        );
    }
    if (operationId === "send_transactional_campaign")
      for (const key of ["CampaignId", "RecipientXml"])
        if (!form.has(key))
          throw this.validation(
            `MessageGears transactional campaign requires ${key}.`,
          );
  }

  private validateXml(key: string, value: string) {
    if (/<!DOCTYPE|<!ENTITY/i.test(value))
      throw new MessageGearsApiError(
        "policy_blocked",
        "MessageGears XML declarations and entities are blocked.",
      );
    if (key === "RecipientXml") {
      if (!/^\s*<Recipient(?:\s|>)/i.test(value))
        throw this.validation(
          "MessageGears RecipientXml must start with Recipient.",
        );
      if ((value.match(/<EmailAddress(?:\s|>)/gi) ?? []).length !== 1)
        throw this.validation(
          "MessageGears RecipientXml requires exactly one EmailAddress.",
        );
    }
  }

  private operation(id: string) {
    const operation = MESSAGEGEARS_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new MessageGearsApiError(
        "tool_unavailable",
        "MessageGears operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: unknown) {
    const walk = (entry: unknown) => {
      if (Array.isArray(entry)) return entry.forEach(walk);
      if (!entry || typeof entry !== "object") return;
      for (const [key, child] of Object.entries(entry as JsonObject)) {
        if (
          /(account.?id|api.?key|token|password|secret|authorization|cookie)/i.test(
            key,
          )
        )
          throw new MessageGearsApiError(
            "policy_blocked",
            "Credential-bearing MessageGears input fields are blocked.",
          );
        if (/(url|uri|endpoint)$/i.test(key))
          throw new MessageGearsApiError(
            "policy_blocked",
            "Agent-supplied MessageGears URLs are blocked.",
          );
        walk(child);
      }
    };
    walk(value);
  }

  private redactXml(xml: string) {
    return xml
      .replace(
        /<(ApiKey|AccountId|AuthToken)>[\s\S]*?<\/\1>/gi,
        "<$1>[REDACTED]</$1>",
      )
      .slice(0, 1_000_000);
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new MessageGearsApiError("provider_validation_error", message);
  }
}

export class MessageGearsApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
