import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export const DROPBOX_PAPER_READ_ROUTES = [
  "/users/get_current_account",
  "/users/features/get_values",
  "/paper/docs/download",
  "/paper/docs/folder_users/list",
  "/paper/docs/folder_users/list/continue",
  "/paper/docs/get_folder_info",
  "/paper/docs/list",
  "/paper/docs/list/continue",
  "/paper/docs/sharing_policy/get",
  "/paper/docs/users/list",
  "/paper/docs/users/list/continue",
  "/files/export",
  "/files/get_metadata",
  "/files/list_folder",
  "/files/list_folder/continue",
  "/sharing/list_folder_members",
  "/sharing/list_folder_members/continue",
  "/sharing/get_shared_link_metadata",
  "/sharing/list_file_members",
  "/sharing/list_file_members/continue",
] as const;

export const DROPBOX_PAPER_WRITE_ROUTES = [
  "/paper/docs/archive",
  "/paper/docs/create",
  "/paper/docs/permanently_delete",
  "/paper/docs/sharing_policy/set",
  "/paper/docs/update",
  "/paper/docs/users/add",
  "/paper/docs/users/remove",
  "/paper/folders/create",
  "/files/create_folder_v2",
  "/files/delete_v2",
  "/files/paper/create",
  "/files/paper/update",
  "/files/permanently_delete",
  "/sharing/create_shared_link_with_settings",
  "/sharing/add_file_member",
  "/sharing/remove_file_member_2",
] as const;

const CONTENT_ROUTES = new Set([
  "/paper/docs/download",
  "/paper/docs/create",
  "/paper/docs/update",
  "/files/export",
  "/files/paper/create",
  "/files/paper/update",
]);
const CONTENT_WRITE_ROUTES = new Set([
  "/paper/docs/create",
  "/paper/docs/update",
  "/files/paper/create",
  "/files/paper/update",
]);

export class DropboxPaperApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DropboxPaperApiAdapter {
  getCurrentAccount(accessToken: string) {
    return this.request(accessToken, "/users/get_current_account", {}, false);
  }

  getPaperStorageMode(accessToken: string) {
    return this.request(
      accessToken,
      "/users/features/get_values",
      { features: [{ ".tag": "paper_as_files" }] },
      false,
    );
  }

  read(accessToken: string, route: string, args: JsonObject) {
    if (!(DROPBOX_PAPER_READ_ROUTES as readonly string[]).includes(route)) {
      throw new DropboxPaperApiError(
        "provider_validation_error",
        "Dropbox Paper read route is not allowed.",
      );
    }
    return this.request(accessToken, route, args, false);
  }

  write(
    accessToken: string,
    route: string,
    args: JsonObject,
    content?: string,
  ) {
    if (!(DROPBOX_PAPER_WRITE_ROUTES as readonly string[]).includes(route)) {
      throw new DropboxPaperApiError(
        "provider_validation_error",
        "Dropbox Paper mutation route is not allowed.",
      );
    }
    if (content !== undefined && !CONTENT_WRITE_ROUTES.has(route)) {
      throw new DropboxPaperApiError(
        "provider_validation_error",
        "Dropbox Paper content is allowed only for document create or update routes.",
      );
    }
    if (CONTENT_WRITE_ROUTES.has(route) && typeof content !== "string") {
      throw new DropboxPaperApiError(
        "provider_validation_error",
        "Dropbox Paper document content is required for this route.",
      );
    }
    return this.request(accessToken, route, args, true, content);
  }

  private async request(
    accessToken: string,
    route: string,
    args: JsonObject,
    mutation: boolean,
    content?: string,
  ) {
    if (!accessToken) {
      throw new DropboxPaperApiError(
        "credential_missing",
        "Dropbox access token is required.",
        401,
      );
    }
    this.rejectCredentialFields(args);
    const encodedArgs = JSON.stringify(args);
    if (Buffer.byteLength(encodedArgs) > 512_000) {
      throw new DropboxPaperApiError(
        "provider_validation_error",
        "Dropbox Paper arguments exceed 512 KB.",
      );
    }
    if (content !== undefined && Buffer.byteLength(content) > 2_000_000) {
      throw new DropboxPaperApiError(
        "provider_validation_error",
        "Dropbox Paper content exceeds 2 MB.",
      );
    }
    const isContentRoute = CONTENT_ROUTES.has(route);
    const origin = isContentRoute
      ? "https://content.dropboxapi.com"
      : "https://api.dropboxapi.com";
    const response = await safeConnectorFetch(`${origin}/2${route}`, {
      method: "POST",
      headers: {
        Accept: isContentRoute
          ? "application/json, text/html, text/markdown, text/plain"
          : "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(isContentRoute
          ? {
              "Content-Type": CONTENT_WRITE_ROUTES.has(route)
                ? "application/octet-stream"
                : "text/plain; charset=utf-8",
              "Dropbox-API-Arg": encodedArgs,
            }
          : { "Content-Type": "application/json" }),
      },
      body: isContentRoute
        ? CONTENT_WRITE_ROUTES.has(route)
          ? content
          : undefined
        : encodedArgs,
      redirect: "error",
      signal: AbortSignal.timeout(mutation ? 30_000 : 20_000),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 2_500_000) {
      throw new DropboxPaperApiError(
        "provider_validation_error",
        "Dropbox Paper response exceeds 2.5 MB.",
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    let data: unknown;
    if (isContentRoute && response.ok) {
      data = {
        metadata: this.parseHeader(response.headers.get("dropbox-api-result")),
        content: bytes.toString("utf8").slice(0, 2_500_000),
      };
    } else {
      const raw = bytes.toString("utf8");
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = raw.slice(0, 2_500_000);
      }
    }
    data = this.redact(data);
    if (!response.ok) {
      throw new DropboxPaperApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Dropbox returned HTTP ${response.status}${contentType ? ` (${contentType})` : ""}.`,
        response.status,
      );
    }
    return data;
  }

  private parseHeader(value: string | null) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(0, 10_000);
    }
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 10 || value === null || value === undefined) return;
    if (Array.isArray(value)) {
      if (value.length > 1_000) {
        throw new DropboxPaperApiError(
          "provider_validation_error",
          "Dropbox Paper arguments contain too many array items.",
        );
      }
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 500) {
      throw new DropboxPaperApiError(
        "provider_validation_error",
        "Dropbox Paper arguments contain too many fields.",
      );
    }
    for (const [key, item] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|client[_-]?id|app[_-]?key)/i.test(
          key,
        )
      ) {
        throw new DropboxPaperApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
        );
      }
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 2_500_000);
    if (Array.isArray(value)) {
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential)/i.test(key)
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorMessage(value: unknown) {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const summary = body?.error_summary ?? body?.error_description;
    if (typeof summary === "string") return summary.slice(0, 500);
    const error = body?.error;
    if (typeof error === "string") return error.slice(0, 500);
    return null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 409) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
