import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;

export class GoogleSlidesApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleSlidesApiAdapter {
  private readonly apiOrigin = "https://slides.googleapis.com/v1";
  async health(token: string) {
    if (!token || token.length > 8000)
      throw new GoogleSlidesApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }

  async getPresentation(token: string, input: JsonObject) {
    const presentationId = this.id(input.presentationId, "presentationId");
    const value = await this.requestJson(
      token,
      "GET",
      `${this.apiOrigin}/presentations/${presentationId}`,
    );
    const slides = this.array(value.slides)
      .slice(0, 50)
      .map((slide) => this.page(slide));
    return {
      presentation: {
        presentationId: this.text(value.presentationId),
        title: this.text(value.title),
        locale: this.text(value.locale),
        slideCount: slides.length,
        slides,
        mastersReturned: false,
        layoutsReturned: false,
        themesReturned: false,
      },
      providerRequestCount: 1,
    };
  }

  async getPage(token: string, input: JsonObject) {
    const presentationId = this.id(input.presentationId, "presentationId"),
      pageObjectId = this.id(input.pageObjectId, "pageObjectId");
    return {
      page: this.page(
        await this.requestJson(
          token,
          "GET",
          `${this.apiOrigin}/presentations/${presentationId}/pages/${pageObjectId}`,
        ),
      ),
      providerRequestCount: 1,
    };
  }

  prepareUpdate(input: JsonObject) {
    const operation =
      input.operation === "text_replace" || input.operation === "slide_create"
        ? input.operation
        : null;
    if (!operation)
      throw new GoogleSlidesApiError(
        "provider_validation_error",
        "operation must be text_replace or slide_create.",
      );
    const change = {
      presentationId: this.id(input.presentationId, "presentationId"),
      operation,
    };
    return {
      change,
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      providerRequestCount: 0,
    };
  }

  async replaceText(token: string, input: JsonObject) {
    const presentationId = this.id(input.presentationId, "presentationId"),
      matchText = this.requiredText(input.matchText, 1000, "matchText"),
      replacementText = this.textValue(
        input.replacementText,
        20000,
        true,
        "replacementText",
      ),
      requiredRevisionId = this.optionalId(
        input.requiredRevisionId,
        "requiredRevisionId",
      );
    const value = await this.requestJson(
      token,
      "POST",
      `${this.apiOrigin}/presentations/${presentationId}:batchUpdate`,
      {
        requests: [
          {
            replaceAllText: {
              containsText: {
                text: matchText,
                matchCase: input.matchCase !== false,
              },
              replaceText: replacementText,
            },
          },
        ],
        ...(requiredRevisionId ? { writeControl: { requiredRevisionId } } : {}),
      },
    );
    return this.writeResult(
      "replace_text",
      presentationId,
      input.idempotencyKey,
      value,
    );
  }

  async createSlide(token: string, input: JsonObject) {
    const presentationId = this.id(input.presentationId, "presentationId"),
      slideObjectId = this.id(input.slideObjectId, "slideObjectId", 5, 50);
    const layout =
      typeof input.layout === "string" ? input.layout : "TITLE_AND_BODY";
    if (
      ![
        "BLANK",
        "TITLE",
        "TITLE_AND_BODY",
        "TITLE_ONLY",
        "SECTION_HEADER",
      ].includes(layout)
    )
      throw new GoogleSlidesApiError(
        "provider_validation_error",
        "Slide layout is not allowlisted.",
      );
    const value = await this.requestJson(
      token,
      "POST",
      `${this.apiOrigin}/presentations/${presentationId}:batchUpdate`,
      {
        requests: [
          {
            createSlide: {
              objectId: slideObjectId,
              slideLayoutReference: { predefinedLayout: layout },
            },
          },
        ],
      },
    );
    return this.writeResult(
      "create_slide",
      presentationId,
      input.idempotencyKey,
      value,
    );
  }

  private writeResult(
    operation: string,
    presentationId: string,
    idempotencyKey: unknown,
    value: JsonObject,
  ) {
    return {
      operation,
      presentationId: this.text(value.presentationId) ?? presentationId,
      replyCount: this.array(value.replies).slice(0, 20).length,
      requiredRevisionId: this.text(
        this.object(value.writeControl).requiredRevisionId,
      ),
      idempotencyKey: this.key(idempotencyKey),
      providerRequestCount: 1,
    };
  }
  private page(value: unknown) {
    const item = this.object(value),
      elements = this.array(item.pageElements).slice(0, 100);
    const semanticText = elements
      .map((element) => this.elementText(element))
      .filter(Boolean)
      .join("\n")
      .slice(0, 10000);
    return {
      objectId: this.text(item.objectId),
      elementCount: elements.length,
      semanticText,
      mediaBytesReturned: false,
      speakerNotesReturned: false,
    };
  }
  private elementText(value: unknown) {
    const shape = this.object(this.object(value).shape),
      text = this.object(shape.text);
    return this.array(text.textElements)
      .map(
        (element) =>
          this.text(this.object(this.object(element).textRun).content) ?? "",
      )
      .join("")
      .slice(0, 10000);
  }

  private async requestJson(
    token: string,
    method: string,
    url: string,
    body?: JsonObject,
  ) {
    if (!token || token.length > 8000)
      throw new GoogleSlidesApiError(
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
      throw new GoogleSlidesApiError(
        "provider_unavailable",
        "Google Slides could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2097152)
      throw new GoogleSlidesApiError(
        "provider_validation_error",
        "Google Slides response exceeded the 2 MiB Relay bound.",
      );
    if (!response.ok)
      throw new GoogleSlidesApiError(
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
          ? "Google Slides rate limit reached; retry later."
          : "Google Slides rejected the bounded request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleSlidesApiError(
        "provider_validation_error",
        "Google Slides returned invalid JSON.",
      );
    }
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown) {
    return typeof value === "string" && value.length <= 20000 ? value : null;
  }
  private id(value: unknown, field: string, min = 1, max = 200) {
    const result = this.text(value);
    if (
      !result ||
      result.length < min ||
      result.length > max ||
      !/^[A-Za-z0-9_:-]+$/.test(result)
    )
      throw new GoogleSlidesApiError(
        "provider_validation_error",
        `${field} is invalid.`,
      );
    return result;
  }
  private optionalId(value: unknown, field: string) {
    return value == null || value === "" ? null : this.id(value, field);
  }
  private requiredText(value: unknown, max: number, field: string) {
    return this.textValue(value, max, false, field);
  }
  private textValue(
    value: unknown,
    max: number,
    allowEmpty: boolean,
    field: string,
  ) {
    if (
      typeof value !== "string" ||
      (!allowEmpty && !value.length) ||
      value.length > max
    )
      throw new GoogleSlidesApiError(
        "provider_validation_error",
        `${field} exceeds Relay bounds.`,
      );
    return value;
  }
  private key(value: unknown) {
    const result = this.text(value);
    if (!result || result.length < 8 || result.length > 200)
      throw new GoogleSlidesApiError(
        "provider_validation_error",
        "idempotencyKey is invalid.",
      );
    return result;
  }
}
