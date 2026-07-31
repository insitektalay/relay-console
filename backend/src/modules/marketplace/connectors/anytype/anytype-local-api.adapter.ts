import { Injectable } from "@nestjs/common";
import { BridgeService } from "../../../bridge/bridge.service";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type AnytypeLocalApiCredentials = {
  apiKey: string;
  sourceHostId: string;
  sourceHostType: "hermes_bridge" | "openclaw_bridge" | "runtime_host";
  runtime: "desktop" | "cli";
};

export const ANYTYPE_API_VERSION = "2025-11-08";

export const ANYTYPE_READ_OPERATIONS = [
  "search_global",
  "search_space",
  "list_spaces",
  "get_space",
  "list_chats",
  "list_chat_messages",
  "get_chat_message",
  "search_chat_messages",
  "list_list_views",
  "list_list_objects",
  "list_members",
  "get_member",
  "list_objects",
  "get_object",
  "list_properties",
  "get_property",
  "list_tags",
  "get_tag",
  "list_types",
  "get_type",
  "list_templates",
  "get_template",
] as const;

export const ANYTYPE_MANAGE_OPERATIONS = [
  "create_space",
  "update_space",
  "create_chat",
  "add_chat_message",
  "edit_chat_message",
  "delete_chat_message",
  "toggle_chat_reaction",
  "mark_chat_messages_read",
  "mark_chat_reactions_read",
  "mark_all_chat_messages_read",
  "add_objects_to_list",
  "remove_objects_from_list",
  "create_object",
  "update_object",
  "delete_object",
  "create_property",
  "update_property",
  "delete_property",
  "create_tag",
  "update_tag",
  "delete_tag",
  "create_type",
  "update_type",
  "delete_type",
] as const;

type Operation =
  | (typeof ANYTYPE_READ_OPERATIONS)[number]
  | (typeof ANYTYPE_MANAGE_OPERATIONS)[number];

type Route = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body: boolean;
};

const ROUTES: Record<Operation, Route> = {
  search_global: { method: "POST", path: "/v1/search", body: true },
  search_space: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/search",
    body: true,
  },
  list_spaces: { method: "GET", path: "/v1/spaces", body: false },
  get_space: { method: "GET", path: "/v1/spaces/{spaceId}", body: false },
  create_space: { method: "POST", path: "/v1/spaces", body: true },
  update_space: { method: "PATCH", path: "/v1/spaces/{spaceId}", body: true },
  create_chat: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/chats",
    body: true,
  },
  list_chats: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/chats",
    body: false,
  },
  add_chat_message: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/chats/{chatId}/messages",
    body: true,
  },
  list_chat_messages: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/chats/{chatId}/messages",
    body: false,
  },
  get_chat_message: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/chats/{chatId}/messages/{messageId}",
    body: false,
  },
  edit_chat_message: {
    method: "PATCH",
    path: "/v1/spaces/{spaceId}/chats/{chatId}/messages/{messageId}",
    body: true,
  },
  delete_chat_message: {
    method: "DELETE",
    path: "/v1/spaces/{spaceId}/chats/{chatId}/messages/{messageId}",
    body: false,
  },
  search_chat_messages: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/chats/{chatId}/messages/search",
    body: false,
  },
  toggle_chat_reaction: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/chats/{chatId}/messages/{messageId}/reactions",
    body: true,
  },
  mark_chat_messages_read: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/chats/{chatId}/messages/read",
    body: true,
  },
  mark_chat_reactions_read: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/chats/{chatId}/reactions/read",
    body: true,
  },
  mark_all_chat_messages_read: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/chats/{chatId}/read_all",
    body: false,
  },
  list_list_views: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/lists/{listId}/views",
    body: false,
  },
  list_list_objects: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/lists/{listId}/views/{viewId}/objects",
    body: false,
  },
  add_objects_to_list: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/lists/{listId}/objects",
    body: true,
  },
  remove_objects_from_list: {
    method: "DELETE",
    path: "/v1/spaces/{spaceId}/lists/{listId}/objects/{objectId}",
    body: false,
  },
  list_members: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/members",
    body: false,
  },
  get_member: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/members/{memberId}",
    body: false,
  },
  list_objects: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/objects",
    body: false,
  },
  create_object: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/objects",
    body: true,
  },
  get_object: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/objects/{objectId}",
    body: false,
  },
  update_object: {
    method: "PATCH",
    path: "/v1/spaces/{spaceId}/objects/{objectId}",
    body: true,
  },
  delete_object: {
    method: "DELETE",
    path: "/v1/spaces/{spaceId}/objects/{objectId}",
    body: false,
  },
  list_properties: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/properties",
    body: false,
  },
  create_property: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/properties",
    body: true,
  },
  get_property: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/properties/{propertyId}",
    body: false,
  },
  update_property: {
    method: "PATCH",
    path: "/v1/spaces/{spaceId}/properties/{propertyId}",
    body: true,
  },
  delete_property: {
    method: "DELETE",
    path: "/v1/spaces/{spaceId}/properties/{propertyId}",
    body: false,
  },
  list_tags: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/properties/{propertyId}/tags",
    body: false,
  },
  create_tag: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/properties/{propertyId}/tags",
    body: true,
  },
  get_tag: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/properties/{propertyId}/tags/{tagId}",
    body: false,
  },
  update_tag: {
    method: "PATCH",
    path: "/v1/spaces/{spaceId}/properties/{propertyId}/tags/{tagId}",
    body: true,
  },
  delete_tag: {
    method: "DELETE",
    path: "/v1/spaces/{spaceId}/properties/{propertyId}/tags/{tagId}",
    body: false,
  },
  list_types: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/types",
    body: false,
  },
  create_type: {
    method: "POST",
    path: "/v1/spaces/{spaceId}/types",
    body: true,
  },
  get_type: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/types/{typeId}",
    body: false,
  },
  update_type: {
    method: "PATCH",
    path: "/v1/spaces/{spaceId}/types/{typeId}",
    body: true,
  },
  delete_type: {
    method: "DELETE",
    path: "/v1/spaces/{spaceId}/types/{typeId}",
    body: false,
  },
  list_templates: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/types/{typeId}/templates",
    body: false,
  },
  get_template: {
    method: "GET",
    path: "/v1/spaces/{spaceId}/types/{typeId}/templates/{templateId}",
    body: false,
  },
};

export class AnytypeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AnytypeLocalApiAdapter {
  constructor(private readonly bridge: BridgeService) {}

  async health(workspaceId: string, credentials: AnytypeLocalApiCredentials) {
    const result = await this.execute(
      workspaceId,
      credentials,
      "list_spaces",
      {},
    );
    const spaces = this.object(result.result).data;
    return {
      runtime: credentials.runtime,
      spaceCount: Array.isArray(spaces) ? Math.min(spaces.length, 1_000) : null,
      providerRequestCount: 1,
    };
  }

  callRead(
    workspaceId: string,
    credentials: AnytypeLocalApiCredentials,
    input: JsonObject,
  ) {
    return this.execute(
      workspaceId,
      credentials,
      this.operation(input.operation, ANYTYPE_READ_OPERATIONS),
      input,
    );
  }

  callManage(
    workspaceId: string,
    credentials: AnytypeLocalApiCredentials,
    input: JsonObject,
  ) {
    return this.execute(
      workspaceId,
      credentials,
      this.operation(input.operation, ANYTYPE_MANAGE_OPERATIONS),
      input,
    );
  }

  private async execute(
    workspaceId: string,
    credentials: AnytypeLocalApiCredentials,
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
    if (route.body !== (body !== undefined))
      throw new AnytypeApiError(
        "provider_validation_error",
        `Anytype ${operation} ${route.body ? "requires" : "does not accept"} a JSON body.`,
      );
    this.rejectCredentials(pathParams);
    this.rejectCredentials(query);
    this.rejectCredentials(body);
    this.boundInput(query, "query", 100_000);
    this.boundInput(body, "body", 1_000_000);
    let path = route.path.replace(/\{([A-Za-z0-9]+)\}/g, (_match, key) =>
      encodeURIComponent(this.id(pathParams[key], key)),
    );
    if (Object.keys(pathParams).some((key) => !route.path.includes(`{${key}}`)))
      throw new AnytypeApiError(
        "provider_validation_error",
        "Anytype path parameters include an unsupported field.",
      );
    const response = await this.bridge.callMarketplaceLocalApi({
      workspaceId,
      appSlug: "anytype",
      sourceHostId: this.text(credentials.sourceHostId, "source host", 200),
      sourceHostType: credentials.sourceHostType,
      runtime: credentials.runtime,
      bearerToken: this.text(credentials.apiKey, "API key", 4_096),
      apiVersion: ANYTYPE_API_VERSION,
      method: route.method,
      path,
      query,
      body: body ?? {},
      timeoutMs: 20_000,
      maxResponseBytes: 2_000_000,
    });
    const status = Number(response.httpStatus);
    if (
      response.status !== "ok" ||
      !Number.isFinite(status) ||
      status < 200 ||
      status >= 300
    )
      throw new AnytypeApiError(
        this.code(status),
        status === 429
          ? "Anytype Local API rate limit reached; retry later."
          : status === 401
            ? "Anytype rejected the stored API key."
            : "Anytype Local API rejected the bounded request.",
        status,
      );
    const rawResult = response.data ?? response.body ?? {};
    if (Buffer.byteLength(JSON.stringify(rawResult)) > 2_000_000)
      throw new AnytypeApiError(
        "provider_validation_error",
        "Anytype Local API response exceeds 2 MB.",
      );
    const result = this.bound(rawResult, 0);
    return { operation, result, providerRequestCount: 1 };
  }

  private operation<T extends readonly string[]>(value: unknown, allowed: T) {
    if (typeof value !== "string" || !allowed.includes(value))
      throw new AnytypeApiError(
        "provider_validation_error",
        "Anytype operation is not supported by this Relay action.",
      );
    return value as T[number];
  }

  private inputObject(value: unknown, label: string): JsonObject {
    if (value === undefined) return {};
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new AnytypeApiError(
        "provider_validation_error",
        `Anytype ${label} must be an object.`,
      );
    return value as JsonObject;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private id(value: unknown, label: string) {
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > 200 ||
      !/^[A-Za-z0-9._:-]+$/.test(value)
    )
      throw new AnytypeApiError(
        "provider_validation_error",
        `Anytype ${label} is invalid.`,
      );
    return value;
  }

  private text(value: unknown, label: string, max: number) {
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > max ||
      /[\u0000\r\n]/.test(value)
    )
      throw new AnytypeApiError(
        "credential_missing",
        `A valid Anytype ${label} is required.`,
      );
    return value;
  }

  private boundInput(value: unknown, label: string, max: number) {
    if (value === undefined) return;
    if (Buffer.byteLength(JSON.stringify(value)) > max)
      throw new AnytypeApiError(
        "provider_validation_error",
        `Anytype ${label} exceeds Relay bounds.`,
      );
  }

  private rejectCredentials(value: unknown, depth = 0) {
    if (depth > 12)
      throw new AnytypeApiError(
        "policy_blocked",
        "Anytype input is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) => this.rejectCredentials(item, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|password|credential|authorization|api.?key|base.?url|cookie)/i.test(
          key,
        )
      )
        throw new AnytypeApiError(
          "policy_blocked",
          `Credential-bearing Anytype field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentials(item, depth + 1);
    }
  }

  private bound(value: unknown, depth: number): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 200_000);
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.bound(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, item]) => [
          key,
          /(token|secret|password|credential|authorization|api.?key|cookie)/i.test(
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
    if (!Number.isFinite(status) || status >= 500)
      return "provider_unavailable";
    return "provider_validation_error";
  }
}
