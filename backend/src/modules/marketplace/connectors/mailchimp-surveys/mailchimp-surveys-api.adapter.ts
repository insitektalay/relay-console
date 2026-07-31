import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type MailchimpSurveysCredentials = {
  accessToken: string;
  apiOrigin: string;
  accountId: string;
};

type Operation = {
  method: "GET" | "POST";
  path: (input: JsonObject) => string;
  collection?: boolean;
};

const OPERATIONS: Record<string, Operation> = {
  list_surveys: {
    method: "GET",
    path: (input) => `/3.0/lists/${id(input.listId, "listId")}/surveys`,
    collection: true,
  },
  get_survey: {
    method: "GET",
    path: (input) =>
      `/3.0/lists/${id(input.listId, "listId")}/surveys/${id(input.surveyId, "surveyId")}`,
  },
  list_survey_reports: {
    method: "GET",
    path: () => "/3.0/reporting/surveys",
    collection: true,
  },
  get_survey_report: {
    method: "GET",
    path: (input) => `/3.0/reporting/surveys/${id(input.surveyId, "surveyId")}`,
  },
  list_question_reports: {
    method: "GET",
    path: (input) =>
      `/3.0/reporting/surveys/${id(input.surveyId, "surveyId")}/questions`,
    collection: true,
  },
  get_question_report: {
    method: "GET",
    path: (input) =>
      `/3.0/reporting/surveys/${id(input.surveyId, "surveyId")}/questions/${id(input.questionId, "questionId")}`,
  },
  list_question_answers: {
    method: "GET",
    path: (input) =>
      `/3.0/reporting/surveys/${id(input.surveyId, "surveyId")}/questions/${id(input.questionId, "questionId")}/answers`,
    collection: true,
  },
  list_responses: {
    method: "GET",
    path: (input) =>
      `/3.0/reporting/surveys/${id(input.surveyId, "surveyId")}/responses`,
    collection: true,
  },
  get_response: {
    method: "GET",
    path: (input) =>
      `/3.0/reporting/surveys/${id(input.surveyId, "surveyId")}/responses/${id(input.responseId, "responseId")}`,
  },
  publish: {
    method: "POST",
    path: (input) =>
      `/3.0/lists/${id(input.listId, "listId")}/surveys/${id(input.surveyId, "surveyId")}/actions/publish`,
  },
  unpublish: {
    method: "POST",
    path: (input) =>
      `/3.0/lists/${id(input.listId, "listId")}/surveys/${id(input.surveyId, "surveyId")}/actions/unpublish`,
  },
  create_email: {
    method: "POST",
    path: (input) =>
      `/3.0/lists/${id(input.listId, "listId")}/surveys/${id(input.surveyId, "surveyId")}/actions/create-email`,
  },
};

@Injectable()
export class MailchimpSurveysApiAdapter {
  async health(credentials: MailchimpSurveysCredentials) {
    const body = this.object(
      await this.send(
        credentials,
        "GET",
        "/3.0/?fields=account_id%2Caccount_name%2Crole",
      ),
    );
    if (body.account_id !== credentials.accountId)
      throw new MailchimpSurveysApiError(
        "provider_validation_error",
        "Mailchimp Surveys account binding changed.",
      );
    return {
      reachable: true,
      accountId: credentials.accountId,
      apiOrigin: credentials.apiOrigin,
      apiVersion: "3.0",
    };
  }

  execute(
    credentials: MailchimpSurveysCredentials,
    operationName: string,
    input: JsonObject,
  ) {
    const operation = OPERATIONS[operationName];
    if (!operation)
      throw new MailchimpSurveysApiError(
        "tool_unavailable",
        "Mailchimp Surveys operation is not in the pinned registry.",
      );
    const path = operation.path(input);
    const query = operation.collection ? "?count=25&offset=0" : "";
    return this.send(credentials, operation.method, `${path}${query}`);
  }

  private async send(
    credentials: MailchimpSurveysCredentials,
    method: "GET" | "POST",
    path: string,
  ) {
    const origin = credentials.apiOrigin.replace(/\/$/, "").toLowerCase();
    if (!/^https:\/\/[a-z0-9-]{1,20}\.api\.mailchimp\.com$/.test(origin))
      throw new MailchimpSurveysApiError(
        "provider_validation_error",
        "Mailchimp Surveys API origin is not metadata-bound.",
      );
    if (!/^[a-f0-9]{32}$/i.test(credentials.accountId))
      throw new MailchimpSurveysApiError(
        "provider_validation_error",
        "Mailchimp Surveys account binding is invalid.",
      );
    const url = new URL(path, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/3.0/"))
      throw new MailchimpSurveysApiError(
        "policy_blocked",
        "Mailchimp Surveys request escaped the fixed API boundary.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        body: method === "POST" ? "{}" : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new MailchimpSurveysApiError(
        "provider_unavailable",
        "Mailchimp Surveys is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 2_000_000)
      throw new MailchimpSurveysApiError(
        "provider_validation_error",
        "Mailchimp Surveys response exceeded the 2 MB boundary.",
      );
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      throw new MailchimpSurveysApiError(
        "provider_validation_error",
        "Mailchimp Surveys returned invalid JSON.",
      );
    }
    if (!response.ok)
      throw new MailchimpSurveysApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Mailchimp Surveys API request failed.",
        response.status,
      );
    return this.redact(parsed);
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 100).map((entry) => this.redact(entry));
    const object = this.object(value);
    if (!object)
      return typeof value === "string" ? value.slice(0, 20_000) : value;
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(object).slice(0, 300))
      result[key] = /(token|secret|password|authorization|api.?key)/i.test(key)
        ? "[REDACTED]"
        : this.redact(entry);
    return result;
  }

  private object(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }
}

export class MailchimpSurveysApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

function id(value: unknown, field: string) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!/^[a-z0-9_-]{1,128}$/i.test(result))
    throw new MailchimpSurveysApiError(
      "provider_validation_error",
      `${field} is required and must be a provider ID.`,
    );
  return encodeURIComponent(result);
}
