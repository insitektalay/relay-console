import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class CanvaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class CanvaApiAdapter {
  private readonly origin = "https://api.canva.com";

  async getCurrentUser(token: string) {
    const value = await this.request(token, "GET", "/rest/v1/users/me");
    const teamUser = this.object(value.team_user);
    const userId = this.text(teamUser.user_id);
    const teamId = this.text(teamUser.team_id);
    if (!userId || !teamId)
      throw new CanvaApiError(
        "provider_validation_error",
        "Canva did not return a connected user and team.",
      );
    return { user: { userId, teamId }, providerRequestCount: 1 };
  }

  async listDesigns(token: string, input: JsonObject) {
    const maxResults = this.limit(input.maxResults, 25, 100);
    const value = await this.request(token, "GET", "/rest/v1/designs", {
      limit: String(maxResults),
      ...(this.optionalText(input.query, 255)
        ? { query: this.optionalText(input.query, 255)! }
        : {}),
      ...(this.ownership(input.ownership)
        ? { ownership: this.ownership(input.ownership)! }
        : {}),
      ...(this.sortBy(input.sortBy)
        ? { sort_by: this.sortBy(input.sortBy)! }
        : {}),
      ...(this.optionalText(input.continuation, 2000)
        ? { continuation: this.optionalText(input.continuation, 2000)! }
        : {}),
    });
    const designs = this.array(value.items)
      .slice(0, maxResults)
      .map((item) => this.design(item));
    return {
      designs,
      count: designs.length,
      continuation: this.text(value.continuation),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  async getDesign(token: string, input: JsonObject) {
    const designId = this.id(input.designId, "designId");
    const value = await this.request(
      token,
      "GET",
      `/rest/v1/designs/${this.segment(designId)}`,
    );
    return {
      design: this.design(value.design ?? value),
      providerRequestCount: 1,
    };
  }

  async listFolderItems(token: string, input: JsonObject) {
    const folderId = this.id(input.folderId, "folderId");
    const maxResults = this.limit(input.maxResults, 25, 100);
    const itemTypes = this.itemTypes(input.itemTypes);
    const value = await this.request(
      token,
      "GET",
      `/rest/v1/folders/${this.segment(folderId)}/items`,
      {
        limit: String(maxResults),
        ...(itemTypes.length ? { item_types: itemTypes.join(",") } : {}),
        ...(this.optionalText(input.continuation, 2000)
          ? { continuation: this.optionalText(input.continuation, 2000)! }
          : {}),
      },
    );
    const items = this.array(value.items)
      .slice(0, maxResults)
      .map((item) => this.folderItem(item));
    return {
      folderId,
      items,
      count: items.length,
      continuation: this.text(value.continuation),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }

  prepareDesign(input: JsonObject) {
    const design = this.normalizedDesign(input);
    return {
      design,
      digest: createHash("sha256").update(JSON.stringify(design)).digest("hex"),
      providerMutation: false,
      providerRequestCount: 0,
      blankDesignWarning:
        "Canva may permanently delete an unedited blank design after seven days.",
    };
  }

  async createDesign(token: string, input: JsonObject) {
    const design = this.normalizedDesign(input);
    const value = await this.request(
      token,
      "POST",
      "/rest/v1/designs",
      {},
      this.createBody(design),
    );
    return {
      operation: "create",
      design: this.design(value.design ?? value),
      digest: createHash("sha256").update(JSON.stringify(design)).digest("hex"),
      idempotencyKey: this.id(input.idempotencyKey, "idempotencyKey"),
      providerRequestCount: 1,
      blankDesignWarning:
        "Canva may permanently delete an unedited blank design after seven days.",
    };
  }

  private async request(
    token: string,
    method: string,
    path: string,
    query: Record<string, string> = {},
    body?: JsonObject,
  ): Promise<JsonObject> {
    if (!token || token.length > 10000)
      throw new CanvaApiError(
        "credential_missing",
        "A Canva OAuth access token is required.",
        401,
      );
    if (
      !path.startsWith("/rest/v1/") ||
      path.includes("..") ||
      path.includes("//")
    )
      throw new CanvaApiError(
        "provider_validation_error",
        "Canva API path is invalid.",
      );
    const url = new URL(`${this.origin}${path}`);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    const encoded = body ? JSON.stringify(body) : undefined;
    if (encoded && Buffer.byteLength(encoded) > 100000)
      throw new CanvaApiError(
        "provider_validation_error",
        "Canva request exceeds 100 KB.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(encoded ? { "Content-Type": "application/json" } : {}),
        },
        body: encoded,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new CanvaApiError(
        "provider_unavailable",
        "Canva could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (raw.length > 4000000)
      throw new CanvaApiError(
        "provider_validation_error",
        "Canva response exceeded Relay bounds.",
      );
    let value: JsonObject = {};
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      value = {};
    }
    if (!response.ok)
      throw new CanvaApiError(
        this.code(response.status),
        response.status === 429
          ? "Canva rate limit reached; retry later."
          : response.status === 401
            ? "Canva authorization expired; reconnect the account."
            : response.status === 403
              ? "Canva denied the requested scope or resource permission."
              : "Canva rejected the request.",
        response.status,
      );
    return value;
  }

  private normalizedDesign(input: JsonObject) {
    const designType = this.text(input.designType) ?? "";
    if (designType !== "preset" && designType !== "custom")
      throw new CanvaApiError(
        "provider_validation_error",
        "Canva designType must be preset or custom.",
      );
    const design: JsonObject = { designType };
    if (designType === "preset") {
      const presetName = this.text(input.presetName);
      if (
        !presetName ||
        !["doc", "email", "presentation", "whiteboard"].includes(presetName)
      )
        throw new CanvaApiError(
          "provider_validation_error",
          "Canva presetName is invalid.",
        );
      design.presetName = presetName;
    } else {
      const width = this.dimension(input.width, "width");
      const height = this.dimension(input.height, "height");
      if (width * height > 25000000)
        throw new CanvaApiError(
          "provider_validation_error",
          "Canva custom dimensions exceed 25 million pixels.",
        );
      design.width = width;
      design.height = height;
    }
    const title = this.optionalText(input.title, 255);
    if (title) design.title = title;
    return design;
  }

  private createBody(design: JsonObject) {
    return {
      design_type:
        design.designType === "custom"
          ? { type: "custom", width: design.width, height: design.height }
          : { type: "preset", name: design.presetName },
      ...(design.title ? { title: design.title } : {}),
    };
  }

  private design(value: unknown) {
    const design = this.object(value);
    const owner = this.object(design.owner);
    const thumbnail = this.object(design.thumbnail);
    return {
      id: this.text(design.id),
      title: this.bounded(this.text(design.title), 1000),
      owner: {
        userId: this.text(owner.user_id),
        teamId: this.text(owner.team_id),
      },
      createdAt: this.text(design.created_at),
      updatedAt: this.text(design.updated_at),
      designTypes: this.array(design.design_types)
        .map((item) => this.text(item))
        .filter((item): item is string => !!item)
        .slice(0, 20),
      pageCount: this.numeric(design.page_count),
      thumbnail: {
        width: this.numeric(thumbnail.width),
        height: this.numeric(thumbnail.height),
        urlPersisted: false,
      },
      navigation: {
        available: !!design.urls,
        temporaryDays: 30,
        userBound: true,
        urlPersisted: false,
      },
    };
  }

  private folderItem(value: unknown) {
    const item = this.object(value);
    const type = this.text(item.type) ?? "unknown";
    if (type === "design") return { type, design: this.design(item.design) };
    const resource = this.object(item[type]);
    return {
      type,
      resource: {
        id: this.text(resource.id),
        name: this.bounded(this.text(resource.name ?? resource.title), 1000),
        createdAt: this.text(resource.created_at),
        updatedAt: this.text(resource.updated_at),
      },
    };
  }

  private itemTypes(value: unknown) {
    if (value === undefined) return [];
    const allowed = ["folder", "design", "image", "brand_template"];
    if (!Array.isArray(value) || value.length > 4)
      throw new CanvaApiError(
        "provider_validation_error",
        "Canva itemTypes is invalid.",
      );
    const types = value.map((item) => this.text(item));
    if (types.some((item) => !item || !allowed.includes(item)))
      throw new CanvaApiError(
        "provider_validation_error",
        "Canva itemTypes is invalid.",
      );
    return Array.from(new Set(types as string[]));
  }
  private ownership(value: unknown) {
    const ownership = this.text(value);
    if (ownership && !["any", "owned", "shared"].includes(ownership))
      throw new CanvaApiError(
        "provider_validation_error",
        "Canva ownership filter is invalid.",
      );
    return ownership;
  }
  private sortBy(value: unknown) {
    const sort = this.text(value);
    if (
      sort &&
      ![
        "relevance",
        "modified_descending",
        "modified_ascending",
        "title_descending",
        "title_ascending",
      ].includes(sort)
    )
      throw new CanvaApiError(
        "provider_validation_error",
        "Canva design sort is invalid.",
      );
    return sort;
  }
  private dimension(value: unknown, field: string) {
    if (!Number.isInteger(value) || Number(value) < 40 || Number(value) > 8000)
      throw new CanvaApiError(
        "provider_validation_error",
        `Canva ${field} must be an integer from 40 to 8000.`,
      );
    return Number(value);
  }
  private id(value: unknown, field: string) {
    const id = this.text(value);
    if (!id || !/^[A-Za-z0-9._:@%+=~-]{1,500}$/.test(id))
      throw new CanvaApiError(
        "provider_validation_error",
        `Canva ${field} is invalid.`,
      );
    return id;
  }
  private segment(value: string) {
    return encodeURIComponent(value);
  }
  private limit(value: unknown, fallback: number, maximum: number) {
    return Number.isInteger(value)
      ? Math.max(1, Math.min(maximum, Number(value)))
      : fallback;
  }
  private optionalText(value: unknown, maximum: number) {
    const text = this.text(value)?.trim();
    if (!text) return null;
    if (text.length > maximum)
      throw new CanvaApiError(
        "provider_validation_error",
        "Canva text exceeds the supported bound.",
      );
    return text;
  }
  private bounded(value: string | null, maximum: number) {
    return value ? value.slice(0, maximum) : null;
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
    return typeof value === "string" && value.length <= 10000 ? value : null;
  }
  private numeric(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
