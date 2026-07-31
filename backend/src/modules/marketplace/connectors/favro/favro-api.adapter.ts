import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type FavroCredentials = { email: string; apiToken: string };

export class FavroApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FavroApiAdapter {
  async health(credentials: FavroCredentials) {
    const result = await this.listOrganizations(credentials, { limit: 1 });
    return { organizationCount: result.count };
  }

  async listOrganizations(credentials: FavroCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const parsed = await this.request(
      credentials,
      `/api/v1/organizations?limit=${limit}&page=0`,
      "GET",
    );
    return this.page(parsed, limit, (value) => this.organization(value));
  }

  async listCollections(credentials: FavroCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const organizationId = this.id(input.organizationId, "organization");
    const parsed = await this.request(
      credentials,
      `/api/v1/collections?archived=false&limit=${limit}&page=0`,
      "GET",
      organizationId,
    );
    return this.page(parsed, limit, (value) => this.collection(value));
  }

  async getCollection(credentials: FavroCredentials, input: JsonObject) {
    const organizationId = this.id(input.organizationId, "organization");
    const collectionId = this.id(input.collectionId, "collection");
    return this.collection(
      await this.request(
        credentials,
        `/api/v1/collections/${encodeURIComponent(collectionId)}`,
        "GET",
        organizationId,
      ),
    );
  }

  async listWidgets(credentials: FavroCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const organizationId = this.id(input.organizationId, "organization");
    const collectionId = this.id(input.collectionId, "collection");
    const parsed = await this.request(
      credentials,
      `/api/v1/widgets?collectionId=${encodeURIComponent(collectionId)}&archived=false&limit=${limit}&page=0`,
      "GET",
      organizationId,
    );
    return this.page(parsed, limit, (value) => this.widget(value));
  }

  async getWidget(credentials: FavroCredentials, input: JsonObject) {
    const organizationId = this.id(input.organizationId, "organization");
    const widgetCommonId = this.id(input.widgetCommonId, "widget");
    return this.widget(
      await this.request(
        credentials,
        `/api/v1/widgets/${encodeURIComponent(widgetCommonId)}`,
        "GET",
        organizationId,
      ),
    );
  }

  async listCards(credentials: FavroCredentials, input: JsonObject) {
    const limit = this.limit(input.limit);
    const organizationId = this.id(input.organizationId, "organization");
    const collectionId = this.optionalId(input.collectionId, "collection");
    const widgetCommonId = this.optionalId(input.widgetCommonId, "widget");
    if ((collectionId ? 1 : 0) + (widgetCommonId ? 1 : 0) !== 1)
      throw new FavroApiError(
        "provider_validation_error",
        "Favro card listing requires exactly one collection or widget ID.",
      );
    const filter = collectionId
      ? `collectionId=${encodeURIComponent(collectionId)}`
      : `widgetCommonId=${encodeURIComponent(widgetCommonId!)}`;
    const parsed = await this.request(
      credentials,
      `/api/v1/cards?${filter}&unique=true&archived=false&descriptionFormat=plaintext&limit=${limit}&page=0`,
      "GET",
      organizationId,
    );
    return this.page(parsed, limit, (value) => this.card(value));
  }

  async getCard(credentials: FavroCredentials, input: JsonObject) {
    const organizationId = this.id(input.organizationId, "organization");
    const cardId = this.id(input.cardId, "card");
    return this.card(
      await this.request(
        credentials,
        `/api/v1/cards/${encodeURIComponent(cardId)}?descriptionFormat=plaintext`,
        "GET",
        organizationId,
      ),
    );
  }

  async createCard(credentials: FavroCredentials, input: JsonObject) {
    const organizationId = this.id(input.organizationId, "organization");
    const widgetCommonId = this.id(input.widgetCommonId, "widget");
    return this.card(
      await this.request(credentials, "/api/v1/cards", "POST", organizationId, {
        name: this.text(input.name, "name", 1, 200),
        widgetCommonId,
      }),
    );
  }

  async updateCard(credentials: FavroCredentials, input: JsonObject) {
    const organizationId = this.id(input.organizationId, "organization");
    const cardId = this.id(input.cardId, "card");
    const expectedName = this.text(input.expectedName, "expected name", 1, 200);
    const current = await this.getCard(credentials, { organizationId, cardId });
    if (current.name !== expectedName)
      throw new FavroApiError(
        "provider_validation_error",
        "Favro card name changed before update.",
        409,
      );
    return this.card(
      await this.request(
        credentials,
        `/api/v1/cards/${encodeURIComponent(cardId)}`,
        "PUT",
        organizationId,
        { name: this.text(input.name, "name", 1, 200) },
      ),
    );
  }

  async deleteCard(credentials: FavroCredentials, input: JsonObject) {
    const organizationId = this.id(input.organizationId, "organization");
    const cardId = this.id(input.cardId, "card");
    const expectedName = this.text(input.expectedName, "expected name", 1, 200);
    const current = await this.getCard(credentials, { organizationId, cardId });
    if (current.name !== expectedName)
      throw new FavroApiError(
        "provider_validation_error",
        "Favro card name changed before deletion.",
        409,
      );
    const result = await this.request(
      credentials,
      `/api/v1/cards/${encodeURIComponent(cardId)}?everywhere=false`,
      "DELETE",
      organizationId,
    );
    const deletedIds = Array.isArray(result)
      ? result
          .slice(0, 20)
          .map((value) => this.clean(value, 64))
          .filter(Boolean)
      : [];
    return { deleted: true, cardId, deletedIds };
  }

  private async request(
    credentials: FavroCredentials,
    path: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    organizationId?: string,
    body?: unknown,
  ) {
    const email = credentials.email.trim();
    const apiToken = credentials.apiToken.trim();
    if (!this.validEmail(email) || !apiToken || apiToken.length > 512)
      throw new FavroApiError(
        "connection_not_ready",
        "Favro account email and API token are required.",
      );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await safeConnectorFetch(`https://favro.com${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`, "utf8").toString("base64")}`,
          ...(organizationId ? { organizationId } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      const raw = await this.readBounded(response);
      let parsed: unknown = {};
      if (raw.trim()) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw new FavroApiError(
            "provider_unavailable",
            "Favro returned an invalid response.",
            response.status,
          );
        }
      }
      if (!response.ok)
        throw new FavroApiError(
          this.errorCode(response.status),
          this.errorMessage(response.status),
          response.status,
        );
      return parsed;
    } catch (error) {
      if (error instanceof FavroApiError) throw error;
      if (error instanceof Error && error.name === "AbortError")
        throw new FavroApiError(
          "provider_unavailable",
          "Favro request timed out.",
        );
      throw new FavroApiError("provider_unavailable", "Favro request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readBounded(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > 262_144)
      throw new FavroApiError(
        "provider_unavailable",
        "Favro response exceeded 256 KiB.",
        response.status,
      );
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 262_144)
      throw new FavroApiError(
        "provider_unavailable",
        "Favro response exceeded 256 KiB.",
        response.status,
      );
    return text;
  }

  private page<T>(value: unknown, limit: number, map: (value: unknown) => T) {
    const object = this.object(value);
    const source = Array.isArray(object.entities) ? object.entities : [];
    const rows = source.slice(0, limit).map(map);
    const pages = Number(object.pages ?? 1);
    return {
      rows,
      count: rows.length,
      truncated: Number.isFinite(pages) && pages > 1,
    };
  }

  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 20)
      throw new FavroApiError(
        "provider_validation_error",
        "Favro limit must be between 1 and 20.",
      );
    return Number(value);
  }

  private id(value: unknown, label: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(text))
      throw new FavroApiError(
        "provider_validation_error",
        `Favro ${label} ID is invalid.`,
      );
    return text;
  }

  private optionalId(value: unknown, label: string) {
    return value === undefined ? null : this.id(value, label);
  }

  private text(value: unknown, label: string, min: number, max: number) {
    if (typeof value !== "string")
      throw new FavroApiError(
        "provider_validation_error",
        `Favro ${label} must be text.`,
      );
    const text = value.trim();
    if (text.length < min || text.length > max)
      throw new FavroApiError(
        "provider_validation_error",
        `Favro ${label} length is invalid.`,
      );
    return text;
  }

  private validEmail(value: string) {
    return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private clean(value: unknown, max = 200) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private organization(value: unknown) {
    const row = this.object(value);
    return {
      organizationId: this.clean(row.organizationId, 64),
      name: this.clean(row.name),
    };
  }

  private collection(value: unknown) {
    const row = this.object(value);
    return {
      collectionId: this.clean(row.collectionId, 64),
      organizationId: this.clean(row.organizationId, 64),
      name: this.clean(row.name),
      publicSharing: this.clean(row.publicSharing, 32),
      archived: typeof row.archived === "boolean" ? row.archived : null,
      widgetCommonId: this.clean(row.widgetCommonId, 64),
    };
  }

  private widget(value: unknown) {
    const row = this.object(value);
    return {
      widgetCommonId: this.clean(row.widgetCommonId, 64),
      organizationId: this.clean(row.organizationId, 64),
      collectionIds: Array.isArray(row.collectionIds)
        ? row.collectionIds
            .slice(0, 20)
            .map((id) => this.clean(id, 64))
            .filter(Boolean)
        : [],
      name: this.clean(row.name),
      type: this.clean(row.type, 32),
      color: this.clean(row.color, 32),
      archived: typeof row.archived === "boolean" ? row.archived : null,
    };
  }

  private card(value: unknown) {
    const row = this.object(value);
    return {
      cardId: this.clean(row.cardId, 64),
      cardCommonId: this.clean(row.cardCommonId, 64),
      organizationId: this.clean(row.organizationId, 64),
      widgetCommonId: this.clean(row.widgetCommonId, 64),
      columnId: this.clean(row.columnId, 64),
      laneId: this.clean(row.laneId, 64),
      name: this.clean(row.name),
      archived: typeof row.archived === "boolean" ? row.archived : null,
      createdAt: this.clean(row.createdAt, 50),
    };
  }

  private errorMessage(status: number) {
    if (status === 401) return "Favro rejected the account email or API token.";
    if (status === 403)
      return "Favro denied the requested organization or resource permission.";
    if (status === 404) return "Favro resource was not found.";
    if (status === 409) return "Favro reported a conflicting change.";
    if (status === 429) return "Favro rate limit was reached.";
    if (status >= 500) return "Favro is temporarily unavailable.";
    return "Favro rejected the fixed API request.";
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "connection_not_ready";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 409) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
