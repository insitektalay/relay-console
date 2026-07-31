import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class ExaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: unknown,
  ) {
    super(message);
  }
}

@Injectable()
export class ExaApiAdapter {
  private readonly baseUrl = "https://api.exa.ai";

  async search(apiKey: string, input: JsonObject) {
    return this.request(apiKey, "/search", this.searchBody(input));
  }

  async getContents(apiKey: string, input: JsonObject) {
    return this.request(apiKey, "/contents", this.contentsBody(input));
  }

  async findSimilar(apiKey: string, input: JsonObject) {
    return this.request(apiKey, "/findSimilar", this.findSimilarBody(input));
  }

  async answer(apiKey: string, input: JsonObject) {
    return this.request(apiKey, "/answer", this.answerBody(input));
  }

  async research(apiKey: string, input: JsonObject) {
    return this.request(apiKey, "/search", {
      ...this.searchBody({
        ...input,
        query: this.string(input.instructions) ?? this.string(input.query),
        type: "deep-reasoning",
      }),
      outputSchema: this.object(input.outputSchema) ?? undefined,
      systemPrompt:
        this.string(input.systemPrompt) ??
        "Return structured research findings with citations/source URLs. Avoid private, login-protected, or sensitive personal data.",
      contents: { highlights: true, summary: { query: "Summarize evidence relevant to the research request." } },
    });
  }

  async health(apiKey: string) {
    return this.search(apiKey, {
      query: "Exa API health check",
      numResults: 1,
      type: "fast",
    });
  }

  private searchBody(input: JsonObject) {
    const query = this.requiredString(input.query, "query");
    const type = this.string(input.type) ?? "auto";
    const body: JsonObject = {
      query,
      type,
      numResults: this.clampNumber(input.numResults, type.startsWith("deep") ? 10 : 10, 1, type.startsWith("deep") ? 10 : 25),
      moderation: input.moderation === true,
    };
    this.copyStringArray(input, body, "includeDomains", 50);
    this.copyStringArray(input, body, "excludeDomains", 50);
    this.copyString(input, body, "category");
    this.copyString(input, body, "startPublishedDate");
    this.copyString(input, body, "endPublishedDate");
    this.copyString(input, body, "startCrawlDate");
    this.copyString(input, body, "endCrawlDate");
    const contents = this.object(input.contents);
    if (contents) body.contents = contents;
    return body;
  }

  private contentsBody(input: JsonObject) {
    const urls = this.stringArray(input.urls, 10);
    if (!urls.length) throw new ExaApiError("provider_validation_error", "urls is required");
    const body: JsonObject = {
      urls,
      text: input.text === true || typeof input.text === "object" ? input.text : false,
      highlights: input.highlights === false ? false : (typeof input.highlights === "object" ? input.highlights : true),
      subpages: this.clampNumber(input.subpages, 0, 0, 5),
    };
    if (this.object(input.summary)) body.summary = input.summary;
    if (typeof input.maxAgeHours === "number") body.maxAgeHours = this.clampNumber(input.maxAgeHours, 24, -1, 720);
    if (this.string(input.subpageTarget)) body.subpageTarget = this.string(input.subpageTarget);
    else if (Array.isArray(input.subpageTarget)) body.subpageTarget = this.stringArray(input.subpageTarget, 5);
    return body;
  }

  private findSimilarBody(input: JsonObject) {
    const body = this.searchBody({ ...input, query: this.string(input.query) ?? this.requiredString(input.url, "url") });
    delete body.query;
    body.url = this.requiredString(input.url, "url");
    return body;
  }

  private answerBody(input: JsonObject) {
    const body: JsonObject = {
      query: this.requiredString(input.query, "query"),
      text: input.text === true,
    };
    const outputSchema = this.object(input.outputSchema);
    if (outputSchema) body.outputSchema = outputSchema;
    return body;
  }

  private async request(apiKey: string, path: string, body: JsonObject) {
    const response = await safeConnectorFetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
    const responseBody = await this.safeBody(response);
    if (!response.ok) {
      throw new ExaApiError(
        this.errorCodeForStatus(response.status),
        this.safeMessage(responseBody) ?? `Exa returned ${response.status}`,
        response.status,
        responseBody,
      );
    }
    return responseBody;
  }

  private async safeBody(response: Response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  }

  private safeMessage(body: unknown) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const object = body as Record<string, unknown>;
    return this.string(object.message) ?? this.string(object.error) ?? this.string(object.detail);
  }

  private errorCodeForStatus(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401 || status === 403) return "credential_missing";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    if (status >= 400) return "provider_validation_error";
    return "provider_unavailable";
  }

  private copyString(input: JsonObject, output: JsonObject, key: string) {
    const value = this.string(input[key]);
    if (value) output[key] = value;
  }

  private copyStringArray(input: JsonObject, output: JsonObject, key: string, maxItems: number) {
    const value = this.stringArray(input[key], maxItems);
    if (value.length) output[key] = value;
  }

  private requiredString(value: unknown, field: string) {
    const stringValue = this.string(value);
    if (!stringValue) throw new ExaApiError("provider_validation_error", `${field} is required`);
    return stringValue;
  }

  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private stringArray(value: unknown, maxItems: number) {
    return Array.isArray(value)
      ? value.map((entry) => this.string(entry)).filter((entry): entry is string => Boolean(entry)).slice(0, maxItems)
      : [];
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
  }

  private clampNumber(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value ?? fallback);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(Math.max(Math.floor(number), min), max);
  }
}
