import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type PadletCredentials = { apiKey: string };

export class PadletApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PadletApiAdapter {
  health(credentials: PadletCredentials) {
    return this.getCurrentUser(credentials, {});
  }

  getCurrentUser(credentials: PadletCredentials, input: JsonObject = {}) {
    const include = this.include(input.include, ["boards", "organizations"]);
    return this.request(
      credentials,
      "GET",
      "/me",
      undefined,
      include ? { include } : undefined,
    );
  }

  getBoard(credentials: PadletCredentials, input: JsonObject) {
    const boardId = this.segment(input.boardId, "boardId");
    const include = this.include(input.include, [
      "posts",
      "sections",
      "comments",
    ]);
    return this.request(
      credentials,
      "GET",
      `/boards/${boardId}`,
      undefined,
      include ? { include } : undefined,
    );
  }

  getOrganization(credentials: PadletCredentials, input: JsonObject) {
    const organizationId = this.segment(input.organizationId, "organizationId");
    return this.request(
      credentials,
      "GET",
      `/organizations/${organizationId}`,
      undefined,
      input.includeUsers === false ? undefined : { include: "users" },
    );
  }

  getUserInOrganization(credentials: PadletCredentials, input: JsonObject) {
    const organizationId = this.segment(input.organizationId, "organizationId");
    const userId = this.segment(input.userId, "userId");
    return this.request(
      credentials,
      "GET",
      `/organizations/${organizationId}/users/${userId}`,
      undefined,
      input.includeBoards === false ? undefined : { include: "boards" },
    );
  }

  getPostAttachmentData(credentials: PadletCredentials, input: JsonObject) {
    return this.request(
      credentials,
      "GET",
      `/posts/${this.segment(input.postId, "postId")}/attachmentData`,
    );
  }

  getAiRecipeBoardStatus(credentials: PadletCredentials, input: JsonObject) {
    return this.request(
      credentials,
      "GET",
      `/ai-recipe-boards/status/${this.segment(input.statusKey, "statusKey")}`,
    );
  }

  createPost(credentials: PadletCredentials, input: JsonObject) {
    const boardId = this.segment(input.boardId, "boardId");
    const content = this.object(input.content, "content");
    if (
      ![content.subject, content.body, content.attachment].some(
        (value) => value !== undefined && value !== null && value !== "",
      )
    ) {
      throw new PadletApiError(
        "provider_validation_error",
        "A Padlet post needs a subject, body, or attachment.",
      );
    }
    const attributes: JsonObject = { content };
    for (const key of [
      "color",
      "status",
      "manualSortPosition",
      "mapProps",
      "canvasProps",
      "customFields",
    ] as const) {
      if (input[key] !== undefined) attributes[key] = input[key];
    }
    const data: JsonObject = { type: "post", attributes };
    if (input.sectionId !== undefined) {
      data.relationships = {
        section: {
          data: {
            id: this.segment(input.sectionId, "sectionId"),
            type: "section",
          },
        },
      };
    }
    return this.request(credentials, "POST", `/boards/${boardId}/posts`, {
      data,
    });
  }

  createComment(credentials: PadletCredentials, input: JsonObject) {
    const attributes: JsonObject = {};
    if (typeof input.htmlContent === "string" && input.htmlContent.trim())
      attributes.htmlContent = input.htmlContent;
    if (typeof input.attachmentUrl === "string" && input.attachmentUrl.trim())
      attributes.attachment = {
        url: this.publicUrl(input.attachmentUrl, "attachmentUrl"),
      };
    if (Object.keys(attributes).length === 0)
      throw new PadletApiError(
        "provider_validation_error",
        "A Padlet comment needs HTML content or an attachment URL.",
      );
    return this.request(
      credentials,
      "POST",
      `/posts/${this.segment(input.postId, "postId")}/comments`,
      { data: { type: "comment", attributes } },
    );
  }

  createReaction(credentials: PadletCredentials, input: JsonObject) {
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < -1 || value > 100)
      throw new PadletApiError(
        "provider_validation_error",
        "Padlet reaction value is invalid.",
      );
    const attributes: JsonObject = { value };
    if (input.reactionType !== undefined)
      attributes.reactionType = input.reactionType;
    return this.request(
      credentials,
      "POST",
      `/posts/${this.segment(input.postId, "postId")}/reactions`,
      { data: { type: "reaction", attributes } },
    );
  }

  createAiRecipeBoard(credentials: PadletCredentials, input: JsonObject) {
    const instructions = this.text(
      input.boardCreationInstructions,
      "boardCreationInstructions",
      2_000,
    );
    const role = this.text(input.role, "role", 500);
    const attributes: JsonObject = {
      boardCreationInstructions: instructions,
      role,
    };
    if (input.workspaceId !== undefined)
      attributes.workspaceId = this.segment(input.workspaceId, "workspaceId");
    return this.request(credentials, "POST", "/ai-recipe-boards", {
      data: { type: "ai_recipe_board", attributes },
    });
  }

  private async request(
    credentials: PadletCredentials,
    method: "GET" | "POST",
    path: string,
    json?: JsonObject,
    query?: JsonObject,
  ) {
    this.requireCredentials(credentials);
    this.rejectCredentials(json);
    const url = new URL(`https://api.padlet.dev/v1${path}`);
    for (const [key, value] of Object.entries(query ?? {}))
      url.searchParams.set(key, String(value));
    const body = json === undefined ? undefined : JSON.stringify(json);
    if (body && Buffer.byteLength(body) > 1_000_000)
      throw new PadletApiError(
        "provider_validation_error",
        "Padlet request exceeds 1 MB.",
      );
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/vnd.api+json, application/json",
          "x-api-key": credentials.apiKey,
          ...(body ? { "Content-Type": "application/vnd.api+json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 5_000_000)
        throw new PadletApiError(
          "provider_validation_error",
          "Padlet response exceeds 5 MB.",
        );
      const text = raw.toString("utf8");
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 5_000_000);
      }
      data = this.redact(data);
      if (!response.ok)
        throw new PadletApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Padlet returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof PadletApiError) throw error;
      throw new PadletApiError(
        "provider_unavailable",
        "Padlet could not be reached.",
        502,
      );
    }
  }

  private requireCredentials(credentials: PadletCredentials) {
    if (!credentials.apiKey?.trim() || credentials.apiKey.length > 4_000)
      throw new PadletApiError(
        "credential_missing",
        "Padlet personal access token is required.",
        401,
      );
  }

  private segment(value: unknown, name: string) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > 200 ||
      !/^[A-Za-z0-9_-]+$/.test(value.trim())
    )
      throw new PadletApiError(
        "provider_validation_error",
        `${name} is invalid.`,
      );
    return value.trim();
  }

  private text(value: unknown, name: string, maxLength: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maxLength)
      throw new PadletApiError(
        "provider_validation_error",
        `${name} is invalid.`,
      );
    return value.trim();
  }

  private object(value: unknown, name: string) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new PadletApiError(
        "provider_validation_error",
        `${name} must be an object.`,
      );
    return value as JsonObject;
  }

  private include(value: unknown, allowed: string[]) {
    if (value === undefined || value === null) return "";
    if (
      !Array.isArray(value) ||
      value.length > allowed.length ||
      value.some((item) => typeof item !== "string" || !allowed.includes(item))
    )
      throw new PadletApiError(
        "provider_validation_error",
        "Padlet include contains an unsupported relationship.",
      );
    return [...new Set(value as string[])].join(",");
  }

  private publicUrl(value: string, name: string) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" && url.protocol !== "http:")
        throw new Error("protocol");
      if (
        ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())
      )
        throw new Error("host");
      return url.toString();
    } catch {
      throw new PadletApiError(
        "provider_validation_error",
        `${name} must be a public HTTP or HTTPS URL.`,
      );
    }
  }

  private rejectCredentials(value: unknown, depth = 0) {
    if (depth > 12)
      throw new PadletApiError(
        "policy_blocked",
        "Padlet request is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) => this.rejectCredentials(item, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new PadletApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentials(item, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private message(value: unknown) {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const errors = Array.isArray(body?.errors) ? body?.errors : [];
    const first =
      errors[0] && typeof errors[0] === "object"
        ? (errors[0] as JsonObject)
        : null;
    const candidate =
      first?.detail ?? first?.title ?? body?.message ?? body?.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
