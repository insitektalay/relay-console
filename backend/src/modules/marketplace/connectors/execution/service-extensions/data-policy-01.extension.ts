import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import {
  type MarketplaceConnectorExecutorRequest,
  type MarketplaceConnectorExecutorResult,
  type MarketplaceConnectorSafeErrorCode,
} from "../../types";
import { ConnectorExecutionError } from "../connector-execution.error";
import { mapKnownConnectorError } from "../connector-safe-error.mapper";

export const DataPolicyExtension1 = {
  redact(this: MarketplaceConnectorExecutionService, value: unknown) {
    if (typeof value !== "string") return value;
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
      .replace(
        /https?:\/\/\S*(reset|token|auth|login|verify|code)\S*/gi,
        "[REDACTED_LINK]",
      )
      .replace(/\b\d{6,8}\b/g, "[REDACTED_CODE]")
      .replace(
        /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g,
        "[REDACTED_TOKEN]",
      )
      .replace(
        /\b(?:sk|pk|rk|api)[_-][A-Za-z0-9_-]{16,}\b/gi,
        "[REDACTED_SECRET]",
      );
  },

  redactContent(
    this: MarketplaceConnectorExecutionService,
    value: unknown,
    maxLength: number,
  ) {
    const redacted = this.redact(value);
    if (typeof redacted !== "string") return redacted;
    return redacted.length > maxLength
      ? `${redacted.slice(0, maxLength).trimEnd()}\n[TRUNCATED]`
      : redacted;
  },

  safeUrlHost(
    this: MarketplaceConnectorExecutionService,
    value: string | null,
  ) {
    if (!value) return null;
    try {
      return new URL(value).hostname.slice(0, 253);
    } catch {
      return null;
    }
  },

  shapeDataForSeoSerpResponse(
    this: MarketplaceConnectorExecutionService,
    data: unknown,
  ) {
    const object = this.objectOrNull(data) ?? {};
    const items = Array.isArray(object.items)
      ? object.items.map((item) => this.shapeDataForSeoSerpItem(item))
      : [];
    return {
      keyword: object.keyword,
      locationCode: object.location_code,
      languageCode: object.language_code,
      checkUrl: object.check_url,
      items,
      organicItems: items.filter((item) => item.type === "organic"),
    };
  },

  shapeDataForSeoRankingResponse(
    this: MarketplaceConnectorExecutionService,
    data: unknown,
    input: Record<string, unknown>,
  ) {
    const serp = this.shapeDataForSeoSerpResponse(data);
    const target = (this.stringOrNull(input.target) ?? "").toLowerCase();
    const matchMode = this.stringOrNull(input.matchMode) ?? "domain";
    const matches = serp.items.filter((item) =>
      this.dataForSeoRankMatch(item, target, matchMode),
    );
    return {
      ...serp,
      target,
      matchMode,
      found: matches.length > 0,
      bestRank:
        matches
          .map((item) =>
            typeof item.rankAbsolute === "number" ? item.rankAbsolute : null,
          )
          .filter((rank): rank is number => rank !== null)
          .sort((a, b) => a - b)[0] ?? null,
      matches,
    };
  },

  shapeDataForSeoSerpItem(
    this: MarketplaceConnectorExecutionService,
    item: unknown,
  ) {
    const object = this.objectOrNull(item) ?? {};
    return {
      type: object.type,
      rankAbsolute: object.rank_absolute,
      url: object.url,
      domain: object.domain,
      title: this.redactContent(object.title, 500),
      description: this.redactContent(object.description, 1200),
      breadcrumb: this.redactContent(object.breadcrumb, 500),
    };
  },

  shapeDataForSeoTaskResults(
    this: MarketplaceConnectorExecutionService,
    task: unknown,
  ) {
    const object = this.objectOrNull(task) ?? {};
    const results = Array.isArray(object.result) ? object.result : [];
    return {
      statusCode: object.status_code,
      statusMessage: object.status_message,
      resultCount: results.length,
      results: results.map((item) => this.redactDataForSeoObject(item, 80)),
    };
  },

  shapeDataForSeoBacklinksResponse(
    this: MarketplaceConnectorExecutionService,
    task: unknown,
  ) {
    const shaped = this.shapeDataForSeoTaskResults(task);
    return {
      ...shaped,
      results: shaped.results.map((item) => {
        const object = this.objectOrNull(item) ?? {};
        const backlinks = Array.isArray(object.items)
          ? object.items
              .slice(0, 50)
              .map((entry) => this.redactDataForSeoObject(entry, 50))
          : [];
        return { ...object, items: backlinks, itemCount: backlinks.length };
      }),
    };
  },

  shapeDataForSeoBacklinkVerification(
    this: MarketplaceConnectorExecutionService,
    task: unknown,
    input: Record<string, unknown>,
  ) {
    const referringUrl =
      this.stringOrNull(input.referringUrl)?.toLowerCase() ?? "";
    const shaped = this.shapeDataForSeoBacklinksResponse(task);
    const backlinks = shaped.results.flatMap((result) =>
      Array.isArray((result as Record<string, unknown>).items)
        ? ((result as Record<string, unknown>).items as unknown[])
        : [],
    );
    const matches = backlinks.filter((entry) => {
      const object = this.objectOrNull(entry) ?? {};
      const url =
        this.stringOrNull(object.url_from) ??
        this.stringOrNull(object.referring_url) ??
        this.stringOrNull(object.page_from) ??
        "";
      return url.toLowerCase() === referringUrl;
    });
    return {
      ...shaped,
      referringUrl,
      found: matches.length > 0,
      matches,
    };
  },

  shapeDataForSeoPageInspection(
    this: MarketplaceConnectorExecutionService,
    task: unknown,
  ) {
    const shaped = this.shapeDataForSeoTaskResults(task);
    return {
      ...shaped,
      results: shaped.results.map((item) => {
        const object = this.objectOrNull(item) ?? {};
        return {
          url: object.url,
          statusCode: object.status_code,
          meta: this.redactDataForSeoObject(object.meta, 40),
          checks: this.redactDataForSeoObject(object.checks, 80),
          pageTiming: object.page_timing,
          resourceErrors: Array.isArray(object.resource_errors)
            ? object.resource_errors
                .slice(0, 10)
                .map((entry) => this.redactDataForSeoObject(entry, 20))
            : undefined,
        };
      }),
    };
  },

  redactDataForSeoObject(
    this: MarketplaceConnectorExecutionService,
    value: unknown,
    maxKeys: number,
  ): unknown {
    if (typeof value === "string") return this.redactContent(value, 2000);
    if (Array.isArray(value))
      return value
        .slice(0, 50)
        .map((entry) => this.redactDataForSeoObject(entry, maxKeys));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, maxKeys)
        .map(([key, entry]) => [
          key,
          this.redactDataForSeoObject(entry, maxKeys),
        ]),
    );
  },

  safeDataForSeoAudit(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    tool: { name: string; capability: string; platformCapability: string },
    shaped: unknown,
  ) {
    const object = this.objectOrNull(shaped);
    const items = Array.isArray(object?.items) ? object.items : [];
    const results = Array.isArray(object?.results) ? object.results : [];
    return {
      toolName: tool.name,
      capability: tool.capability,
      platformCapability: tool.platformCapability,
      queryHash: this.hash(this.stringOrNull(input.input.query) ?? ""),
      targetHash: this.hash(this.stringOrNull(input.input.target) ?? ""),
      urlHash: this.hash(
        this.stringOrNull(input.input.url) ??
          this.stringOrNull(input.input.referringUrl) ??
          "",
      ),
      itemCount: items.length,
      resultCount: results.length,
      depth: input.input.depth ?? null,
      limit: input.input.limit ?? null,
    };
  },

  shapeExaSearchResponse(
    this: MarketplaceConnectorExecutionService,
    data: unknown,
  ) {
    const object = this.objectOrNull(data);
    const results = Array.isArray(object?.results)
      ? object.results.map((item) => this.shapeExaResult(item))
      : [];
    return { ...object, results };
  },

  shapeExaContentsResponse(
    this: MarketplaceConnectorExecutionService,
    data: unknown,
  ) {
    const object = this.objectOrNull(data);
    const results = Array.isArray(object?.results)
      ? object.results.map((item) => this.shapeExaResult(item, true))
      : [];
    return { ...object, results };
  },

  shapeExaAnswerResponse(
    this: MarketplaceConnectorExecutionService,
    data: unknown,
  ) {
    const object = this.objectOrNull(data);
    return {
      answer: this.redactContent(object?.answer, 8000),
      citations: Array.isArray(object?.citations)
        ? object.citations.map((item) => this.shapeExaResult(item))
        : [],
    };
  },

  shapeExaResearchResponse(
    this: MarketplaceConnectorExecutionService,
    data: unknown,
  ) {
    const shaped = this.shapeExaSearchResponse(data);
    const object = this.objectOrNull(shaped) ?? {};
    return {
      ...object,
      researchMode: "deep_reasoning_search",
      findings: Array.isArray(object.results) ? object.results : [],
    };
  },

  shapeExaResult(
    this: MarketplaceConnectorExecutionService,
    item: unknown,
    includeText = false,
  ) {
    const object = this.objectOrNull(item);
    return {
      id: object?.id,
      url: object?.url,
      title: this.redactContent(object?.title, 500),
      author: object?.author,
      publishedDate: object?.publishedDate,
      score: object?.score,
      highlights: Array.isArray(object?.highlights)
        ? object.highlights
            .slice(0, 5)
            .map((entry) => this.redactContent(entry, 1200))
        : undefined,
      summary: this.redactContent(object?.summary, 2500),
      ...(includeText ? { text: this.redactContent(object?.text, 12000) } : {}),
    };
  },

  safeExaAudit(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
    tool: { name: string; capability: string; platformCapability: string },
    shaped: unknown,
  ) {
    const object = this.objectOrNull(shaped);
    const results = Array.isArray(object?.results) ? object.results : [];
    return {
      toolName: tool.name,
      capability: tool.capability,
      platformCapability: tool.platformCapability,
      queryHash: this.hash(
        this.stringOrNull(input.input.query) ??
          this.stringOrNull(input.input.instructions) ??
          "",
      ),
      urlCount: this.stringArray(input.input.urls).length,
      resultCount: results.length,
    };
  },

  normalizeBody(
    this: MarketplaceConnectorExecutionService,
    body: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    const objectBody =
      body && typeof body === "object" && !Array.isArray(body) ? body : {};
    const args = objectBody.arguments ?? objectBody.args;
    return args && typeof args === "object" && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : objectBody;
  },

  mapError(
    this: MarketplaceConnectorExecutionService,
    error: unknown,
  ): MarketplaceConnectorExecutorResult {
    const known = mapKnownConnectorError(error);
    if (known) return known;
    if (error instanceof ConnectorExecutionError)
      return {
        ok: false,
        statusCode: 400,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
    if (error instanceof Error && error.message === "token_refresh_failed")
      return this.safeError(
        "token_refresh_failed",
        "Connector token refresh failed",
      );
    return this.safeError(
      "graph_error",
      error instanceof Error ? error.message : "Connector execution failed",
    );
  },

  safeError(
    this: MarketplaceConnectorExecutionService,
    code: MarketplaceConnectorSafeErrorCode,
    message: string,
    statusCode = 400,
  ): MarketplaceConnectorExecutorResult {
    return { ok: false, statusCode, error: { code, message } };
  },

  hash(this: MarketplaceConnectorExecutionService, value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }
    return value ? `h${Math.abs(hash).toString(16)}` : null;
  },
};
