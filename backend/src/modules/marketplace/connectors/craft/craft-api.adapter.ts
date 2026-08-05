import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type CraftCredentials = { apiUrl: string };

export const CRAFT_READ_OPERATIONS = [
  "fetch_blocks",
  "search_in_document",
  "search_documents",
  "list_collections",
  "get_collection_schema",
  "get_collection_items",
  "list_documents",
  "list_folders",
  "list_tasks",
] as const;

export const CRAFT_MANAGE_OPERATIONS = [
  "insert_blocks",
  "delete_blocks",
  "update_blocks",
  "move_blocks",
  "add_collection_items",
  "delete_collection_items",
  "update_collection_items",
  "create_documents",
  "delete_documents",
  "move_documents",
  "create_folders",
  "delete_folders",
  "move_folders",
  "add_tasks",
  "delete_tasks",
  "update_tasks",
] as const;

type CraftReadOperation = (typeof CRAFT_READ_OPERATIONS)[number];
type CraftManageOperation = (typeof CRAFT_MANAGE_OPERATIONS)[number];
type Operation = CraftReadOperation | CraftManageOperation;

type Route = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query: readonly string[];
  body: boolean;
};

const ROUTES: Record<Operation, Route> = {
  fetch_blocks: {
    method: "GET",
    path: "/blocks",
    query: ["date", "id", "maxDepth", "fetchMetadata"],
    body: false,
  },
  search_in_document: {
    method: "GET",
    path: "/blocks/search",
    query: [
      "blockId",
      "documentId",
      "pattern",
      "caseSensitive",
      "beforeBlockCount",
      "afterBlockCount",
    ],
    body: false,
  },
  search_documents: {
    method: "GET",
    path: "/documents/search",
    query: [
      "include",
      "exclude",
      "regexps",
      "createdDateGte",
      "createdDateLte",
      "lastModifiedDateGte",
      "lastModifiedDateLte",
      "dailyNoteDateGte",
      "dailyNoteDateLte",
      "location",
      "fetchMetadata",
    ],
    body: false,
  },
  list_collections: {
    method: "GET",
    path: "/collections",
    query: [],
    body: false,
  },
  get_collection_schema: {
    method: "GET",
    path: "/collections/{collectionId}/schema",
    query: ["format"],
    body: false,
  },
  get_collection_items: {
    method: "GET",
    path: "/collections/{collectionId}/items",
    query: ["maxDepth"],
    body: false,
  },
  list_documents: {
    method: "GET",
    path: "/documents",
    query: ["location", "fetchMetadata"],
    body: false,
  },
  list_folders: {
    method: "GET",
    path: "/folders",
    query: [],
    body: false,
  },
  list_tasks: {
    method: "GET",
    path: "/tasks",
    query: ["scope", "documentId"],
    body: false,
  },
  insert_blocks: { method: "POST", path: "/blocks", query: [], body: true },
  delete_blocks: {
    method: "DELETE",
    path: "/blocks",
    query: [],
    body: true,
  },
  update_blocks: { method: "PUT", path: "/blocks", query: [], body: true },
  move_blocks: {
    method: "PUT",
    path: "/blocks/move",
    query: [],
    body: true,
  },
  add_collection_items: {
    method: "POST",
    path: "/collections/{collectionId}/items",
    query: [],
    body: true,
  },
  delete_collection_items: {
    method: "DELETE",
    path: "/collections/{collectionId}/items",
    query: [],
    body: true,
  },
  update_collection_items: {
    method: "PUT",
    path: "/collections/{collectionId}/items",
    query: [],
    body: true,
  },
  create_documents: {
    method: "POST",
    path: "/documents",
    query: [],
    body: true,
  },
  delete_documents: {
    method: "DELETE",
    path: "/documents",
    query: [],
    body: true,
  },
  move_documents: {
    method: "PUT",
    path: "/documents/move",
    query: [],
    body: true,
  },
  create_folders: {
    method: "POST",
    path: "/folders",
    query: [],
    body: true,
  },
  delete_folders: {
    method: "DELETE",
    path: "/folders",
    query: [],
    body: true,
  },
  move_folders: {
    method: "PUT",
    path: "/folders/move",
    query: [],
    body: true,
  },
  add_tasks: { method: "POST", path: "/tasks", query: [], body: true },
  delete_tasks: {
    method: "DELETE",
    path: "/tasks",
    query: [],
    body: true,
  },
  update_tasks: { method: "PUT", path: "/tasks", query: [], body: true },
};

export class CraftApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class CraftApiAdapter {
  async health(credentials: CraftCredentials) {
    const base = this.base(credentials);
    const folders = await this.request(
      credentials,
      ROUTES.list_folders,
      {},
      {},
    );
    return {
      authorityHash: createHash("sha256").update(base.pathname).digest("hex"),
      folderCount: Array.isArray(folders.items)
        ? Math.min(folders.items.length, 1_000)
        : null,
      providerRequestCount: 1,
    };
  }

  callRead(credentials: CraftCredentials, input: JsonObject) {
    const operation = this.operation(input.operation, CRAFT_READ_OPERATIONS);
    return this.execute(credentials, operation, input);
  }

  callManage(credentials: CraftCredentials, input: JsonObject) {
    const operation = this.operation(input.operation, CRAFT_MANAGE_OPERATIONS);
    return this.execute(credentials, operation, input);
  }

  private async execute(
    credentials: CraftCredentials,
    operation: Operation,
    input: JsonObject,
  ) {
    const route = ROUTES[operation];
    const pathParams = this.inputObject(input.pathParams, "pathParams");
    const query = this.inputObject(input.query, "query");
    const body =
      input.body === undefined
        ? undefined
        : this.inputObject(input.body, "body");
    if (route.body && body === undefined)
      throw new CraftApiError(
        "provider_validation_error",
        `Craft ${operation} requires a request body.`,
      );
    if (!route.body && body !== undefined)
      throw new CraftApiError(
        "provider_validation_error",
        `Craft ${operation} does not accept a request body.`,
      );
    this.rejectCredentials(pathParams);
    this.rejectCredentials(query);
    this.rejectCredentials(body);
    const result = await this.request(
      credentials,
      route,
      pathParams,
      query,
      body,
    );
    return {
      operation,
      result: this.bound(result, 0),
      providerRequestCount: 1,
    };
  }

  private async request(
    credentials: CraftCredentials,
    route: Route,
    pathParams: JsonObject,
    query: JsonObject,
    body?: JsonObject,
  ): Promise<JsonObject> {
    const base = this.base(credentials);
    const path = route.path.replace(/\{([A-Za-z0-9]+)\}/g, (_match, key) =>
      encodeURIComponent(this.id(pathParams[key], key)),
    );
    if (Object.keys(pathParams).some((key) => !route.path.includes(`{${key}}`)))
      throw new CraftApiError(
        "provider_validation_error",
        "Craft path parameters include an unsupported field.",
      );
    const url = new URL(`${base.pathname}${path}`, base.origin);
    this.appendQuery(url.searchParams, query, new Set(route.query));
    let encoded: string | undefined;
    if (body !== undefined) {
      encoded = JSON.stringify(body);
      if (Buffer.byteLength(encoded) > 1_000_000)
        throw new CraftApiError(
          "provider_validation_error",
          "Craft request body exceeds 1 MB.",
        );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: route.method,
        headers: {
          Accept: "application/json",
          ...(encoded ? { "Content-Type": "application/json" } : {}),
        },
        ...(encoded ? { body: encoded } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (error instanceof CraftApiError) throw error;
      throw new CraftApiError(
        "provider_unavailable",
        "Craft API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000)
      throw new CraftApiError(
        "provider_validation_error",
        "Craft API response exceeds 2 MB.",
      );
    let value: JsonObject = {};
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new CraftApiError(
        "provider_unavailable",
        "Craft API returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new CraftApiError(
        this.code(response.status),
        response.status === 429
          ? "Craft API fair-use limit reached; retry later."
          : "Craft API rejected the request.",
        response.status,
      );
    return value;
  }

  private base(credentials: CraftCredentials) {
    let url: URL;
    try {
      url = new URL(credentials.apiUrl);
    } catch {
      throw new CraftApiError(
        "credential_missing",
        "A valid Craft API connection URL is required.",
        401,
      );
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== "connect.craft.do" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/links?\/[A-Za-z0-9_-]{8,200}\/api\/v1\/?$/.test(url.pathname)
    )
      throw new CraftApiError(
        "provider_validation_error",
        "Craft authority must be an exact connect.craft.do API connection URL.",
      );
    return new URL(`${url.origin}${url.pathname.replace(/\/$/, "")}`);
  }

  private appendQuery(
    target: URLSearchParams,
    query: JsonObject,
    allowed: Set<string>,
  ) {
    if (Object.keys(query).length > 20)
      throw new CraftApiError(
        "provider_validation_error",
        "Craft query has too many fields.",
      );
    for (const [key, raw] of Object.entries(query)) {
      if (!allowed.has(key))
        throw new CraftApiError(
          "provider_validation_error",
          `Craft query field ${key} is not supported for this operation.`,
        );
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 20)
        throw new CraftApiError(
          "provider_validation_error",
          `Craft query field ${key} has too many values.`,
        );
      for (const value of values) {
        const encoded =
          value && typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
        if (encoded.length > 10_000)
          throw new CraftApiError(
            "provider_validation_error",
            `Craft query field ${key} exceeds Relay bounds.`,
          );
        target.append(key, encoded);
      }
    }
  }

  private operation<T extends readonly string[]>(value: unknown, values: T) {
    if (typeof value !== "string" || !values.includes(value))
      throw new CraftApiError(
        "provider_validation_error",
        "Craft operation is not supported by this Relay action.",
      );
    return value as T[number];
  }

  private id(value: unknown, label: string) {
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > 200 ||
      !/^[A-Za-z0-9._:-]+$/.test(value)
    )
      throw new CraftApiError(
        "provider_validation_error",
        `Craft ${label} is invalid.`,
      );
    return value;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private inputObject(value: unknown, label: string): JsonObject {
    if (value === undefined) return {};
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new CraftApiError(
        "provider_validation_error",
        `Craft ${label} must be an object.`,
      );
    return value as JsonObject;
  }

  private rejectCredentials(value: unknown, depth = 0) {
    if (depth > 12)
      throw new CraftApiError(
        "policy_blocked",
        "Craft input is too deeply nested.",
        403,
      );
    if (Array.isArray(value)) {
      value.forEach((item) => this.rejectCredentials(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|password|credential|authorization|api.?url|cookie)/i.test(
          key,
        )
      )
        throw new CraftApiError(
          "policy_blocked",
          `Credential-bearing Craft field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentials(item, depth + 1);
    }
  }

  private bound(value: unknown, depth: number): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") {
      if (/https:\/\/connect\.craft\.do\/link\//i.test(value))
        return "[redacted]";
      return value.slice(0, 200_000);
    }
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.bound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?url|cookie)/i.test(
            key,
          )
            ? "[redacted]"
            : this.bound(item, depth + 1),
        ]),
    );
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
