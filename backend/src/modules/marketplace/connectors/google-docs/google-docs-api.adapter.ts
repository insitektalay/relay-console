import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class GoogleDocsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleDocsApiAdapter {
  private readonly apiOrigin = "https://docs.googleapis.com/v1";

  async health(token: string) {
    if (!token || token.length > 8000)
      throw new GoogleDocsApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }

  async readDocument(token: string, input: JsonObject) {
    const documentId = this.id(input.documentId);
    const maxBodyChars = this.limit(input.maxBodyChars, 8000, 200, 12000);
    const value = await this.requestJson(
      token,
      "GET",
      `${this.apiOrigin}/documents/${documentId}`,
    );
    const fullText = this.collectText(value);
    return {
      document: {
        documentId: this.text(value.documentId),
        title: this.text(value.title),
        revisionId: this.text(value.revisionId),
      },
      bodyText: fullText.slice(0, maxBodyChars),
      bodyCharacterCount: fullText.length,
      truncated: fullText.length > maxBodyChars,
      providerRequestCount: 1,
    };
  }

  prepareChange(input: JsonObject) {
    const change = this.change(input);
    return {
      change,
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      providerRequestCount: 0,
    };
  }

  async createDocument(token: string, input: JsonObject) {
    const title = this.title(input.title);
    const bodyText = this.optionalBody(input.bodyText);
    const created = await this.requestJson(
      token,
      "POST",
      `${this.apiOrigin}/documents`,
      { title },
    );
    const documentId = this.id(created.documentId);
    let revisionId = this.text(created.revisionId);
    let providerRequestCount = 1;
    if (bodyText) {
      const updated = await this.requestJson(
        token,
        "POST",
        `${this.apiOrigin}/documents/${documentId}:batchUpdate`,
        {
          requests: [
            { insertText: { location: { index: 1 }, text: bodyText } },
          ],
        },
      );
      revisionId =
        this.text(this.object(updated.writeControl).requiredRevisionId) ??
        revisionId;
      providerRequestCount += 1;
    }
    return {
      operation: "create_document",
      document: { documentId, title, revisionId },
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount,
    };
  }

  async applyChange(token: string, input: JsonObject) {
    const change = this.change(input);
    const requiredRevisionId = this.optionalText(input.requiredRevisionId, 200);
    const value = await this.requestJson(
      token,
      "POST",
      `${this.apiOrigin}/documents/${change.documentId}:batchUpdate`,
      {
        requests: [change.request],
        ...(requiredRevisionId ? { writeControl: { requiredRevisionId } } : {}),
      },
    );
    return {
      operation: "apply_document_update",
      documentId: change.documentId,
      revisionId: this.text(this.object(value.writeControl).requiredRevisionId),
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount: 1,
    };
  }

  private change(input: JsonObject) {
    const documentId = this.id(input.documentId);
    const hasInsert = typeof input.insertText === "string";
    const hasReplace =
      typeof input.findText === "string" ||
      typeof input.replaceText === "string";
    if (hasInsert === hasReplace)
      throw new GoogleDocsApiError(
        "provider_validation_error",
        "Provide exactly one insert or replace-all change.",
      );
    if (hasInsert) {
      const text = this.body(input.insertText, false);
      const index = this.limit(input.insertIndex, 1, 1, 1000000);
      return {
        documentId,
        kind: "insert_text",
        request: { insertText: { location: { index }, text } },
      };
    }
    const findText = this.optionalText(input.findText, 500);
    if (!findText)
      throw new GoogleDocsApiError(
        "provider_validation_error",
        "findText is required for a replace-all change.",
      );
    const replaceText = this.body(input.replaceText, true);
    return {
      documentId,
      kind: "replace_all_text",
      request: {
        replaceAllText: {
          containsText: { text: findText, matchCase: input.matchCase === true },
          replaceText,
        },
      },
    };
  }

  private async requestJson(
    token: string,
    method: string,
    url: string,
    body?: JsonObject,
  ) {
    if (!token || token.length > 8000)
      throw new GoogleDocsApiError(
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
      throw new GoogleDocsApiError(
        "provider_unavailable",
        "Google Docs could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 524288)
      throw new GoogleDocsApiError(
        "provider_validation_error",
        "Google Docs response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new GoogleDocsApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        response.status === 429
          ? "Google Docs rate limit reached; retry later."
          : "Google Docs rejected the bounded request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleDocsApiError(
        "provider_validation_error",
        "Google Docs returned invalid JSON.",
      );
    }
  }

  private collectText(value: unknown): string {
    let result = "";
    const visit = (item: unknown) => {
      if (result.length > 20000) return;
      if (Array.isArray(item)) {
        item.forEach(visit);
        return;
      }
      const object = this.object(item);
      const textRun = this.object(object.textRun);
      if (typeof textRun.content === "string") result += textRun.content;
      Object.entries(object).forEach(([key, child]) => {
        if (key !== "textRun") visit(child);
      });
    };
    visit({ body: this.object(value).body, tabs: this.object(value).tabs });
    return result.slice(0, 20001);
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private text(value: unknown) {
    return typeof value === "string" && value.length <= 20000 ? value : null;
  }
  private id(value: unknown) {
    const result = this.text(value);
    if (!result || !/^[A-Za-z0-9_-]{1,200}$/.test(result))
      throw new GoogleDocsApiError(
        "provider_validation_error",
        "documentId is invalid.",
      );
    return result;
  }
  private title(value: unknown) {
    const result = this.text(value)?.trim();
    if (!result || result.length > 200 || /[\r\n]/.test(result))
      throw new GoogleDocsApiError(
        "provider_validation_error",
        "Document title is invalid.",
      );
    return result;
  }
  private body(value: unknown, allowEmpty: boolean) {
    if (
      typeof value !== "string" ||
      (!allowEmpty && !value.length) ||
      value.length > 20000 ||
      Buffer.byteLength(value) > 80000
    )
      throw new GoogleDocsApiError(
        "provider_validation_error",
        "Document text exceeds Relay bounds.",
      );
    return value;
  }
  private optionalBody(value: unknown) {
    return value == null || value === "" ? null : this.body(value, false);
  }
  private optionalText(value: unknown, max: number) {
    if (value == null || value === "") return null;
    const result = this.text(value)?.trim();
    if (!result || result.length > max)
      throw new GoogleDocsApiError(
        "provider_validation_error",
        "Text input is invalid.",
      );
    return result;
  }
  private limit(value: unknown, fallback: number, min: number, max: number) {
    const result = value == null ? fallback : Number(value);
    if (!Number.isInteger(result) || result < min || result > max)
      throw new GoogleDocsApiError(
        "provider_validation_error",
        `Numeric input must be between ${min} and ${max}.`,
      );
    return result;
  }
  private key(value: unknown) {
    const result = this.text(value);
    if (!result || result.length < 8 || result.length > 200)
      throw new GoogleDocsApiError(
        "provider_validation_error",
        "idempotencyKey is invalid.",
      );
    return result;
  }
}
