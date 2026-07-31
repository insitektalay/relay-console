import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type AirfocusCredentials = { apiToken: string; region: string };

export class AirfocusApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AirfocusApiAdapter {
  async health(credentials: AirfocusCredentials) {
    const result = await this.listWorkspaces(credentials, { limit: 1 });
    return {
      region: this.region(credentials.region),
      workspaceCount: result.count,
    };
  }

  async listWorkspaces(credentials: AirfocusCredentials, input: JsonObject) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const body: JsonObject = {
      archived: false,
      sort: { direction: "desc", type: "lastActivity" },
    };
    if (input.keyword !== undefined)
      body.filter = {
        caseSensitive: false,
        text: this.text(input.keyword, "keyword", 1, 80),
        type: "name:contain",
      };
    const parsed = await this.request(
      credentials,
      `/api/workspaces/search?offset=0&limit=${limit}`,
      "POST",
      body,
    );
    const source = this.collection(parsed);
    const rows = source.slice(0, limit).map((entry) => this.workspace(entry));
    return {
      rows,
      count: rows.length,
      truncated: this.total(parsed) > rows.length,
    };
  }

  async getWorkspace(credentials: AirfocusCredentials, input: JsonObject) {
    return this.workspace(
      await this.request(
        credentials,
        `/api/workspaces/${this.uuid(input.workspaceId, "workspace")}`,
        "GET",
      ),
    );
  }

  async listItems(credentials: AirfocusCredentials, input: JsonObject) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const workspaceId = this.uuid(input.workspaceId, "workspace");
    const body: JsonObject = {
      archived: false,
      sort: { direction: "asc", type: "order" },
    };
    if (input.keyword !== undefined)
      body.filter = {
        caseSensitive: false,
        text: this.text(input.keyword, "keyword", 1, 80),
        type: "name:contain",
      };
    const parsed = await this.request(
      credentials,
      `/api/workspaces/${workspaceId}/items/search?offset=0&limit=${limit}`,
      "POST",
      body,
    );
    const source = this.collection(parsed);
    const rows = source.slice(0, limit).map((entry) => this.item(entry));
    return {
      rows,
      count: rows.length,
      truncated: this.total(parsed) > rows.length,
    };
  }

  async getItem(credentials: AirfocusCredentials, input: JsonObject) {
    const workspaceId = this.uuid(input.workspaceId, "workspace");
    const itemId = this.uuid(input.itemId, "item");
    return this.item(
      await this.request(
        credentials,
        `/api/workspaces/${workspaceId}/items/${itemId}`,
        "GET",
      ),
    );
  }

  async createItem(credentials: AirfocusCredentials, input: JsonObject) {
    const workspaceId = this.uuid(input.workspaceId, "workspace");
    return this.item(
      await this.request(
        credentials,
        `/api/workspaces/${workspaceId}/items`,
        "POST",
        { name: this.text(input.name, "name", 1, 160), archived: false },
      ),
    );
  }

  async updateItem(credentials: AirfocusCredentials, input: JsonObject) {
    const workspaceId = this.uuid(input.workspaceId, "workspace");
    const itemId = this.uuid(input.itemId, "item");
    const expectedName = this.text(input.expectedName, "expected name", 1, 160);
    const current = await this.getItem(credentials, { workspaceId, itemId });
    if (current.name !== expectedName)
      throw new AirfocusApiError(
        "provider_validation_error",
        "Airfocus item name changed before update.",
        409,
      );
    const operations: JsonObject[] = [];
    if (input.name !== undefined)
      operations.push({
        op: "replace",
        path: "/name",
        value: this.text(input.name, "name", 1, 160),
      });
    if (input.archived !== undefined)
      operations.push({
        op: "replace",
        path: "/archived",
        value: this.boolean(input.archived, "archived"),
      });
    if (!operations.length)
      throw new AirfocusApiError(
        "provider_validation_error",
        "Airfocus update requires name or archived.",
      );
    return this.item(
      await this.request(
        credentials,
        `/api/workspaces/${workspaceId}/items/${itemId}`,
        "PATCH",
        operations,
      ),
    );
  }

  async deleteItem(credentials: AirfocusCredentials, input: JsonObject) {
    const workspaceId = this.uuid(input.workspaceId, "workspace");
    const itemId = this.uuid(input.itemId, "item");
    const expectedName = this.text(input.expectedName, "expected name", 1, 160);
    const current = await this.getItem(credentials, { workspaceId, itemId });
    if (current.name !== expectedName)
      throw new AirfocusApiError(
        "provider_validation_error",
        "Airfocus item name changed before deletion.",
        409,
      );
    await this.request(
      credentials,
      `/api/workspaces/${workspaceId}/items/${itemId}`,
      "DELETE",
    );
    return { deleted: true, itemId };
  }

  private async request(
    credentials: AirfocusCredentials,
    path: string,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ) {
    const token = credentials.apiToken.trim();
    if (!token)
      throw new AirfocusApiError(
        "connection_not_ready",
        "Airfocus personal access token is required.",
      );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await safeConnectorFetch(
        `${this.origin(credentials.region)}${path}`,
        {
          method,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        },
      );
      const raw = await this.readBounded(response);
      let parsed: unknown = {};
      if (raw.trim()) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw new AirfocusApiError(
            "provider_unavailable",
            "Airfocus returned an invalid response.",
            response.status,
          );
        }
      }
      if (!response.ok)
        throw new AirfocusApiError(
          this.errorCode(response.status),
          this.errorMessage(response.status),
          response.status,
        );
      return parsed;
    } catch (error) {
      if (error instanceof AirfocusApiError) throw error;
      if (error instanceof Error && error.name === "AbortError")
        throw new AirfocusApiError(
          "provider_unavailable",
          "Airfocus request timed out.",
        );
      throw new AirfocusApiError(
        "provider_unavailable",
        "Airfocus request failed.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readBounded(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > 262_144)
      throw new AirfocusApiError(
        "provider_unavailable",
        "Airfocus response exceeded 256 KiB.",
        response.status,
      );
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 262_144)
      throw new AirfocusApiError(
        "provider_unavailable",
        "Airfocus response exceeded 256 KiB.",
        response.status,
      );
    return text;
  }

  private origin(region: string) {
    const value = this.region(region);
    return value === "us"
      ? "https://app.us.airfocus.com"
      : "https://app.airfocus.com";
  }

  private region(region: string) {
    const value = region.trim().toLowerCase();
    if (value !== "eu" && value !== "us")
      throw new AirfocusApiError(
        "provider_validation_error",
        "Airfocus region must be eu or us.",
      );
    return value;
  }

  private uuid(value: unknown, label: string) {
    const text = String(value ?? "").trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        text,
      )
    )
      throw new AirfocusApiError(
        "provider_validation_error",
        `Airfocus ${label} ID must be a UUID.`,
      );
    return text;
  }

  private text(value: unknown, label: string, min: number, max: number) {
    if (typeof value !== "string")
      throw new AirfocusApiError(
        "provider_validation_error",
        `Airfocus ${label} must be text.`,
      );
    const text = value.trim();
    if (text.length < min || text.length > max)
      throw new AirfocusApiError(
        "provider_validation_error",
        `Airfocus ${label} length is invalid.`,
      );
    return text;
  }

  private boolean(value: unknown, label: string) {
    if (typeof value !== "boolean")
      throw new AirfocusApiError(
        "provider_validation_error",
        `Airfocus ${label} must be boolean.`,
      );
    return value;
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new AirfocusApiError(
        "provider_validation_error",
        "Airfocus limit is invalid.",
      );
    return Number(value);
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private collection(value: unknown) {
    if (Array.isArray(value)) return value;
    const object = this.object(value);
    if (Array.isArray(object.items)) return object.items;
    if (Array.isArray(object.results)) return object.results;
    return Array.isArray(object.data) ? object.data : [];
  }
  private total(value: unknown) {
    const object = this.object(value);
    const total = Number(
      object.totalItems ?? object.total ?? object.count ?? 0,
    );
    return Number.isFinite(total) ? total : 0;
  }
  private clean(value: unknown, max = 160) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private workspace(value: unknown) {
    const row = this.object(value);
    const embedded = this.object(row._embedded);
    return {
      id: this.clean(row.id, 50),
      alias: this.clean(row.alias, 80),
      name: this.clean(row.name, 160),
      itemType: this.clean(row.itemType, 80),
      lastActivity: this.clean(row.lastActivity, 50),
      createdAt: this.clean(row.createdAt, 50),
      lastUpdatedAt: this.clean(row.lastUpdatedAt, 50),
      currentPermission: this.clean(embedded.currentPermission, 20),
      itemCount: Number.isFinite(Number(embedded.itemCount))
        ? Number(embedded.itemCount)
        : null,
    };
  }

  private item(value: unknown) {
    const row = this.object(value);
    const embedded = this.object(row._embedded);
    const progress = this.object(embedded.progress);
    return {
      id: this.clean(row.id, 50),
      workspaceId: this.clean(row.workspaceId, 50),
      statusId: this.clean(row.statusId, 50),
      name: this.clean(row.name, 160),
      archived: typeof row.archived === "boolean" ? row.archived : null,
      color: this.clean(row.color, 30),
      number: Number.isFinite(Number(row.number)) ? Number(row.number) : null,
      alias: this.clean(embedded.alias, 80),
      workspaceItemType: this.clean(embedded.workspaceItemType, 80),
      progress: {
        closed: Number.isFinite(Number(progress.closed))
          ? Number(progress.closed)
          : null,
        total: Number.isFinite(Number(progress.total))
          ? Number(progress.total)
          : null,
      },
      createdAt: this.clean(row.createdAt, 50),
      lastUpdatedAt: this.clean(row.lastUpdatedAt, 50),
    };
  }

  private errorMessage(status: number) {
    if (status === 401) return "Airfocus rejected the personal access token.";
    if (status === 403)
      return "Airfocus denied the requested scope or workspace permission.";
    if (status === 404) return "Airfocus resource was not found.";
    if (status === 409) return "Airfocus reported a conflicting change.";
    if (status === 429) return "Airfocus rate limit was reached.";
    if (status >= 500) return "Airfocus is temporarily unavailable.";
    return "Airfocus rejected the fixed API request.";
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
