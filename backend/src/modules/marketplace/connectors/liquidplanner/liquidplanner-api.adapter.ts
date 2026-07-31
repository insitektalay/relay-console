import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type LiquidPlannerCredentials = { apiToken: string };

export class LiquidPlannerApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class LiquidPlannerApiAdapter {
  private static readonly origin = "https://next.liquidplanner.com";

  async health(credentials: LiquidPlannerCredentials) {
    const result = await this.listWorkspaces(credentials, { limit: 1 });
    return { workspaceCount: result.count };
  }

  async listWorkspaces(
    credentials: LiquidPlannerCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const parsed = await this.request(
      credentials,
      `/api/workspaces/v1?limit=${limit}`,
      "GET",
    );
    return this.page(parsed, limit, (value) => this.workspace(value));
  }

  async listItems(credentials: LiquidPlannerCredentials, input: JsonObject) {
    const workspaceId = this.id(input.workspaceId, "workspace");
    const limit = this.limit(input.limit);
    const itemType = this.itemType(input.itemType);
    const query = new URLSearchParams({ limit: String(limit) });
    query.set("itemType[is]", itemType);
    if (input.parentId !== undefined)
      query.set("parentId[is]", this.id(input.parentId, "parent item"));
    const parsed = await this.request(
      credentials,
      `/api/workspaces/${workspaceId}/items/v1?${query.toString()}`,
      "GET",
    );
    return this.page(parsed, limit, (value) => this.item(value));
  }

  async getItem(credentials: LiquidPlannerCredentials, input: JsonObject) {
    const workspaceId = this.id(input.workspaceId, "workspace");
    const itemId = this.id(input.itemId, "item");
    const query = new URLSearchParams({ limit: "1" });
    query.set("id[is]", itemId);
    const parsed = await this.request(
      credentials,
      `/api/workspaces/${workspaceId}/items/v1?${query.toString()}`,
      "GET",
    );
    const record = this.collection(parsed)[0];
    if (!record)
      throw new LiquidPlannerApiError(
        "provider_validation_error",
        "LiquidPlanner item was not found.",
        404,
      );
    return this.item(record);
  }

  async createTask(credentials: LiquidPlannerCredentials, input: JsonObject) {
    const workspaceId = this.id(input.workspaceId, "workspace");
    const parentId = this.id(input.parentId, "parent item");
    const parsed = await this.request(
      credentials,
      `/api/workspaces/${workspaceId}/items/v1`,
      "POST",
      {
        workspaceId: Number(workspaceId),
        parentId: Number(parentId),
        itemType: "tasks",
        name: this.text(input.name, "task name", 1, 200),
      },
    );
    return this.item(this.single(parsed));
  }

  async renameItem(credentials: LiquidPlannerCredentials, input: JsonObject) {
    const workspaceId = this.id(input.workspaceId, "workspace");
    const itemId = this.id(input.itemId, "item");
    const expectedName = this.text(input.expectedName, "expected name", 1, 200);
    const current = await this.getItem(credentials, { workspaceId, itemId });
    if (current.name !== expectedName)
      throw new LiquidPlannerApiError(
        "provider_validation_error",
        "LiquidPlanner item changed before update.",
        409,
      );
    return this.item(
      this.single(
        await this.request(
          credentials,
          `/api/workspaces/${workspaceId}/items/v1/${itemId}`,
          "PUT",
          { name: this.text(input.name, "item name", 1, 200) },
        ),
      ),
    );
  }

  private async request(
    credentials: LiquidPlannerCredentials,
    path: string,
    method: "GET" | "POST" | "PUT",
    body?: unknown,
  ) {
    const token = credentials.apiToken.trim();
    if (!token || token.length > 2_048)
      throw new LiquidPlannerApiError(
        "connection_not_ready",
        "LiquidPlanner API token is required.",
      );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await safeConnectorFetch(`${LiquidPlannerApiAdapter.origin}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
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
          throw new LiquidPlannerApiError(
            "provider_unavailable",
            "LiquidPlanner returned invalid JSON.",
            response.status,
          );
        }
      }
      if (!response.ok)
        throw new LiquidPlannerApiError(
          this.errorCode(response.status),
          this.errorMessage(response.status),
          response.status,
        );
      return parsed;
    } catch (error) {
      if (error instanceof LiquidPlannerApiError) throw error;
      if (error instanceof Error && error.name === "AbortError")
        throw new LiquidPlannerApiError(
          "provider_unavailable",
          "LiquidPlanner request timed out.",
        );
      throw new LiquidPlannerApiError(
        "provider_unavailable",
        "LiquidPlanner request failed.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readBounded(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > 262_144)
      throw new LiquidPlannerApiError(
        "provider_unavailable",
        "LiquidPlanner response exceeded 256 KiB.",
        response.status,
      );
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 262_144)
      throw new LiquidPlannerApiError(
        "provider_unavailable",
        "LiquidPlanner response exceeded 256 KiB.",
        response.status,
      );
    return text;
  }

  private page<T>(
    value: unknown,
    limit: number,
    map: (record: unknown) => T,
  ) {
    const source = this.collection(value);
    const rows = source.slice(0, limit).map(map);
    const object = this.object(value, true);
    return {
      rows,
      count: rows.length,
      truncated:
        source.length > limit ||
        (object.continuationToken !== null &&
          object.continuationToken !== undefined),
    };
  }

  private collection(value: unknown): unknown[] {
    const object = this.object(value, true);
    return Array.isArray(object.data) ? object.data : [];
  }

  private single(value: unknown) {
    const rows = this.collection(value);
    return rows[0] ?? value;
  }

  private workspace(value: unknown) {
    const object = this.object(value);
    return {
      id: this.clean(object.id, 20),
      name: this.clean(object.name, 200),
    };
  }

  private item(value: unknown) {
    const object = this.object(value);
    return {
      id: this.clean(object.id, 20),
      name: this.clean(object.name, 200),
      itemType: this.clean(object.itemType, 32),
      workspaceId: this.clean(object.workspaceId, 20),
      parentId: this.clean(object.parentId, 20),
      packageStatus: this.clean(object.packageStatus, 32),
      folderStatus: this.clean(object.folderStatus, 32),
      taskStatusId: this.clean(object.taskStatusId, 20),
      targetStart: this.clean(object.targetStart, 40),
      targetFinish: this.clean(object.targetFinish, 40),
      doneDate: this.clean(object.doneDate, 40),
      createdAt: this.clean(object.createdAt, 40),
      updatedAt: this.clean(object.updatedAt, 40),
    };
  }

  private object(value: unknown, optional = false): JsonObject {
    if (value && typeof value === "object" && !Array.isArray(value))
      return value as JsonObject;
    if (optional) return {};
    throw this.validation("LiquidPlanner returned an invalid record.");
  }

  private clean(value: unknown, max: number) {
    return typeof value === "string" || typeof value === "number"
      ? String(value).slice(0, max)
      : null;
  }

  private id(value: unknown, label: string) {
    if (typeof value !== "string" || !/^\d{1,20}$/.test(value))
      throw this.validation(`LiquidPlanner ${label} ID is invalid.`);
    return value;
  }

  private text(value: unknown, label: string, min: number, max: number) {
    if (typeof value !== "string")
      throw this.validation(`LiquidPlanner ${label} is required.`);
    const text = value.trim();
    if (text.length < min || text.length > max)
      throw this.validation(`LiquidPlanner ${label} is invalid.`);
    return text;
  }

  private itemType(value: unknown) {
    if (
      value !== "packages" &&
      value !== "projects" &&
      value !== "folders" &&
      value !== "tasks"
    )
      throw this.validation("LiquidPlanner item type is invalid.");
    return value;
  }

  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 20)
      throw this.validation("LiquidPlanner limit must be from 1 to 20.");
    return Number(value);
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 409 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(status: number) {
    if (status === 401) return "LiquidPlanner rejected the API token.";
    if (status === 403)
      return "LiquidPlanner denied this action for the token owner.";
    if (status === 404) return "LiquidPlanner resource was not found.";
    if (status === 429) return "LiquidPlanner rate limited the request.";
    if (status >= 500) return "LiquidPlanner is unavailable.";
    return "LiquidPlanner rejected the fixed request.";
  }

  private validation(message: string) {
    return new LiquidPlannerApiError("provider_validation_error", message);
  }
}
