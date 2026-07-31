import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
export class GoogleFormsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
export class GoogleFormsApiAdapter {
  private readonly origin = "https://forms.googleapis.com/v1";
  async health(token: string) {
    if (!token || token.length > 8000)
      throw new GoogleFormsApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }
  async getForm(token: string, input: JsonObject) {
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/forms/${this.id(input.formId)}`,
    );
    return {
      form: this.form(value),
      responsesReturned: false,
      respondentDataReturned: false,
      providerRequestCount: 1,
    };
  }
  prepareUpdate(input: JsonObject) {
    const operation =
      input.operation === "form_create" || input.operation === "question_create"
        ? input.operation
        : null;
    if (!operation)
      throw new GoogleFormsApiError(
        "provider_validation_error",
        "operation is invalid.",
      );
    const change = {
      operation,
      ...(operation === "question_create"
        ? { formId: this.id(input.formId) }
        : {}),
      title: this.requiredText(input.title, 1000),
    };
    return {
      change,
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      providerRequestCount: 0,
    };
  }
  async createForm(token: string, input: JsonObject) {
    const title = this.requiredText(input.title, 500),
      documentTitle = this.optionalText(input.documentTitle, 500);
    const value = await this.request(
      token,
      "POST",
      `${this.origin}/forms?unpublished=true`,
      { info: { title, ...(documentTitle ? { documentTitle } : {}) } },
    );
    return {
      operation: "create_unpublished_form",
      form: this.form(value),
      unpublished: true,
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount: 1,
    };
  }
  async createQuestion(token: string, input: JsonObject) {
    const formId = this.id(input.formId),
      title = this.requiredText(input.title, 1000),
      questionType = input.questionType;
    const question: JsonObject = { required: input.required === true };
    if (questionType === "text")
      question.textQuestion = { paragraph: input.paragraph === true };
    else if (questionType === "choice")
      question.choiceQuestion = {
        type: this.choiceType(input.choiceType),
        options: this.options(input.options),
        shuffle: false,
      };
    else
      throw new GoogleFormsApiError(
        "provider_validation_error",
        "questionType must be text or choice.",
      );
    const revision = this.optionalId(input.requiredRevisionId),
      index = this.integer(input.index, 0, 100, 0);
    const value = await this.request(
      token,
      "POST",
      `${this.origin}/forms/${formId}:batchUpdate`,
      {
        includeFormInResponse: false,
        requests: [
          {
            createItem: {
              item: { title, questionItem: { question } },
              location: { index },
            },
          },
        ],
        ...(revision ? { writeControl: { requiredRevisionId: revision } } : {}),
      },
    );
    const replies = this.array(value.replies).slice(0, 20);
    return {
      operation: "create_question",
      formId,
      replyCount: replies.length,
      createdItemId: this.text(
        this.object(this.object(replies[0]).createItem).itemId,
      ),
      requiredRevisionId: this.text(
        this.object(value.writeControl).requiredRevisionId,
      ),
      formReturned: false,
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount: 1,
    };
  }
  private form(value: JsonObject) {
    const info = this.object(value.info),
      items = this.array(value.items).slice(0, 100);
    return {
      formId: this.text(value.formId),
      title: this.text(info.title),
      documentTitle: this.text(info.documentTitle),
      description: this.text(info.description),
      revisionId: this.text(value.revisionId),
      items: items.map((v) => this.item(v)),
      itemCount: items.length,
      responsesReturned: false,
      respondentEmailReturned: false,
      linkedSheetIdReturned: false,
      publishSettingsReturned: false,
    };
  }
  private item(value: unknown) {
    const item = this.object(value),
      question = this.object(this.object(item.questionItem).question),
      choice = this.object(question.choiceQuestion);
    return {
      itemId: this.text(item.itemId),
      title: this.text(item.title),
      description: this.text(item.description),
      questionId: this.text(question.questionId),
      questionType: question.textQuestion
        ? "text"
        : question.choiceQuestion
          ? "choice"
          : question.fileUploadQuestion
            ? "file_upload_excluded"
            : "other",
      required: question.required === true,
      choices: this.array(choice.options)
        .slice(0, 50)
        .map((v) => this.text(this.object(v).value)),
      gradingReturned: false,
      mediaReturned: false,
      fileUploadMetadataReturned: false,
    };
  }
  private async request(
    token: string,
    method: string,
    url: string,
    body?: JsonObject,
  ): Promise<JsonObject> {
    if (!token || token.length > 8000)
      throw new GoogleFormsApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new GoogleFormsApiError(
        "provider_unavailable",
        "Google Forms could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2097152)
      throw new GoogleFormsApiError(
        "provider_validation_error",
        "Google Forms response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new GoogleFormsApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Google Forms rejected the bounded request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleFormsApiError(
        "provider_validation_error",
        "Google Forms returned invalid JSON.",
      );
    }
  }
  private object(v: unknown): JsonObject {
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as JsonObject)
      : {};
  }
  private array(v: unknown) {
    return Array.isArray(v) ? v : [];
  }
  private text(v: unknown) {
    return typeof v === "string" && v.length <= 20000 ? v : null;
  }
  private id(v: unknown) {
    const r = this.text(v);
    if (!r || r.length > 200 || !/^[A-Za-z0-9_:-]+$/.test(r))
      throw new GoogleFormsApiError(
        "provider_validation_error",
        "Form identifier is invalid.",
      );
    return r;
  }
  private optionalId(v: unknown) {
    return v == null || v === "" ? null : this.id(v);
  }
  private requiredText(v: unknown, max: number) {
    const r = typeof v === "string" ? v.trim() : "";
    if (!r || r.length > max)
      throw new GoogleFormsApiError(
        "provider_validation_error",
        "Text input is invalid.",
      );
    return r;
  }
  private optionalText(v: unknown, max: number) {
    return v == null || v === "" ? null : this.requiredText(v, max);
  }
  private choiceType(v: unknown) {
    const r = typeof v === "string" ? v : "RADIO";
    if (!["RADIO", "CHECKBOX", "DROP_DOWN"].includes(r))
      throw new GoogleFormsApiError(
        "provider_validation_error",
        "Choice type is invalid.",
      );
    return r;
  }
  private options(v: unknown) {
    if (!Array.isArray(v) || !v.length || v.length > 50)
      throw new GoogleFormsApiError(
        "provider_validation_error",
        "Choice questions require 1-50 options.",
      );
    return v.map((x) => ({ value: this.requiredText(x, 500) }));
  }
  private integer(v: unknown, min: number, max: number, fallback: number) {
    const n = v == null ? fallback : Number(v);
    if (!Number.isInteger(n) || n < min || n > max)
      throw new GoogleFormsApiError(
        "provider_validation_error",
        "Numeric input is invalid.",
      );
    return n;
  }
  private key(v: unknown) {
    const r = this.text(v);
    if (!r || r.length < 8 || r.length > 200)
      throw new GoogleFormsApiError(
        "provider_validation_error",
        "idempotencyKey is invalid.",
      );
    return r;
  }
}
