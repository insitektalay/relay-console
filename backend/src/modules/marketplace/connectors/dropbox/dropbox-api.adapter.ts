import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class DropboxApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DropboxApiAdapter {
  private readonly apiOrigin = "https://api.dropboxapi.com/2";
  private readonly contentOrigin = "https://content.dropboxapi.com/2";

  async getCurrentAccount(token: string) {
    const value = await this.rpc(token, "/users/get_current_account", {});
    return {
      accountId: this.text(value.account_id),
      name: this.safe(value.name, 8_000),
      email: this.text(value.email),
      emailVerified: value.email_verified === true,
      disabled: value.disabled === true,
      rootInfo: this.safe(value.root_info, 8_000),
      providerRequestCount: 1,
    };
  }
  async listFolder(token: string, input: JsonObject) {
    const folderPath = this.readPath(input.path, "path", true),
      max = this.limit(input.maxResults, 25, 50);
    const value = await this.rpc(token, "/files/list_folder", {
      path: folderPath,
      recursive: false,
      include_deleted: false,
      include_non_downloadable_files: true,
      limit: max,
    });
    const entries = this.array(value.entries)
      .slice(0, max)
      .map((entry) => this.metadata(entry));
    return {
      path: folderPath,
      entries,
      count: entries.length,
      cursorReturned: Boolean(this.text(value.cursor)),
      hasMore: value.has_more === true,
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }
  async getMetadata(token: string, input: JsonObject) {
    const entryPath = this.readPath(input.path, "path");
    return {
      path: entryPath,
      entry: this.metadata(
        await this.rpc(token, "/files/get_metadata", {
          path: entryPath,
          include_media_info: false,
          include_deleted: false,
          include_has_explicit_shared_members: false,
        }),
      ),
      providerRequestCount: 1,
    };
  }
  async search(token: string, input: JsonObject) {
    const query = this.requiredText(input.query, "query", 200),
      folderPath = this.readPath(input.path, "path", true),
      max = this.limit(input.maxResults, 10, 25);
    const options: JsonObject = {
      max_results: max,
      file_status: "active",
      filename_only: false,
    };
    if (folderPath) options.path = folderPath;
    const value = await this.rpc(token, "/files/search_v2", { query, options });
    const matches = this.array(value.matches)
      .slice(0, max)
      .map((entry) => {
        const match = this.object(entry),
          wrapper = this.object(match.metadata);
        return {
          matchType: this.text(this.object(match.match_type)[".tag"]),
          metadata: this.metadata(wrapper.metadata ?? match.metadata),
        };
      });
    return {
      query,
      path: folderPath,
      matches,
      count: matches.length,
      hasMore: value.has_more === true,
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }
  async downloadText(token: string, input: JsonObject) {
    const entryPath = this.readPath(input.path, "path"),
      max = this.limit(input.maxBytes, 262_144, 262_144);
    const response = await this.content(token, "/files/download", {
      path: entryPath,
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > max)
      throw new DropboxApiError(
        "provider_validation_error",
        "Dropbox file exceeds the requested text bound.",
      );
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new DropboxApiError(
        "provider_validation_error",
        "Dropbox file is not valid UTF-8 text.",
      );
    }
    return {
      path: entryPath,
      content,
      byteCount: bytes.byteLength,
      metadata: this.headerMetadata(response.headers.get("dropbox-api-result")),
      providerRequestCount: 1,
    };
  }
  draftChange(input: JsonObject) {
    const operation = this.operation(input.operation),
      change = this.change(operation, input);
    return {
      change,
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      providerRequestCount: 0,
    };
  }
  async createFolder(token: string, input: JsonObject) {
    return this.writeResult(
      "create_folder",
      input,
      await this.rpc(token, "/files/create_folder_v2", {
        path: this.writePath(input.path, "path"),
        autorename: input.autorename === true,
      }),
    );
  }
  async uploadText(token: string, input: JsonObject) {
    const path = this.writePath(input.path, "path"),
      text = this.boundedText(input.text),
      mode = input.mode === "overwrite" ? "overwrite" : "add";
    const response = await this.content(
      token,
      "/files/upload",
      {
        path,
        mode,
        autorename: input.autorename !== false,
        mute: true,
        strict_conflict: true,
      },
      new TextEncoder().encode(text),
    );
    return this.writeResult(
      "upload_text",
      input,
      this.headerMetadata(await response.text()),
    );
  }
  async copyEntry(token: string, input: JsonObject) {
    return this.writeResult(
      "copy",
      input,
      await this.rpc(token, "/files/copy_v2", {
        from_path: this.readPath(input.fromPath, "fromPath"),
        to_path: this.writePath(input.toPath, "toPath"),
        autorename: input.autorename === true,
        allow_shared_folder: false,
      }),
    );
  }
  async moveEntry(token: string, input: JsonObject) {
    return this.writeResult(
      "move",
      input,
      await this.rpc(token, "/files/move_v2", {
        from_path: this.readPath(input.fromPath, "fromPath"),
        to_path: this.writePath(input.toPath, "toPath"),
        autorename: input.autorename === true,
        allow_shared_folder: false,
      }),
    );
  }
  async deleteEntry(token: string, input: JsonObject) {
    return this.writeResult(
      "delete",
      input,
      await this.rpc(token, "/files/delete_v2", {
        path: this.readPath(input.path, "path"),
      }),
    );
  }

  private async rpc(
    token: string,
    endpoint: string,
    body: JsonObject,
  ): Promise<JsonObject> {
    const response = await this.fetch(
      token,
      `${this.apiOrigin}${endpoint}`,
      { "Content-Type": "application/json" },
      JSON.stringify(body),
    );
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new DropboxApiError(
        "provider_validation_error",
        "Dropbox response exceeded Relay bounds.",
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      return {};
    }
  }
  private async content(
    token: string,
    endpoint: string,
    arg: JsonObject,
    body?: Uint8Array,
  ): Promise<Response> {
    return this.fetch(
      token,
      `${this.contentOrigin}${endpoint}`,
      {
        "Content-Type": body ? "application/octet-stream" : "",
        "Dropbox-API-Arg": JSON.stringify(arg),
      },
      body,
    );
  }
  private async fetch(
    token: string,
    url: string,
    headers: Record<string, string>,
    body: string | Uint8Array | undefined,
  ): Promise<Response> {
    if (!token || token.length > 8_000)
      throw new DropboxApiError(
        "credential_missing",
        "A Dropbox OAuth access token is required.",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...Object.fromEntries(
            Object.entries(headers).filter(([, value]) => value),
          ),
        },
        ...(body === undefined ? {} : { body: body as BodyInit }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new DropboxApiError(
        "provider_unavailable",
        "Dropbox could not be reached.",
        502,
      );
    }
    if (!response.ok)
      throw new DropboxApiError(
        this.code(response.status),
        response.status === 429
          ? "Dropbox rate limit reached; retry later."
          : "Dropbox rejected the request.",
        response.status,
      );
    return response;
  }
  private writeResult(operation: string, input: JsonObject, value: JsonObject) {
    const metadata = this.metadata(value.metadata ?? value),
      asyncJobId = this.text(value.async_job_id);
    return {
      operation,
      ...(asyncJobId ? { asyncJobId } : { entry: metadata }),
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount: 1,
    };
  }
  private change(operation: string, input: JsonObject): JsonObject {
    if (operation === "create_folder")
      return {
        operation,
        path: this.writePath(input.path, "path"),
        autorename: input.autorename === true,
      };
    if (operation === "upload_text")
      return {
        operation,
        path: this.writePath(input.path, "path"),
        text: this.boundedText(input.text),
        mode: input.mode === "overwrite" ? "overwrite" : "add",
        autorename: input.autorename !== false,
      };
    if (operation === "copy" || operation === "move")
      return {
        operation,
        fromPath: this.readPath(input.fromPath, "fromPath"),
        toPath: this.writePath(input.toPath, "toPath"),
        autorename: input.autorename === true,
      };
    return { operation, path: this.readPath(input.path, "path") };
  }
  private operation(value: unknown) {
    const operation = this.text(value);
    if (
      !operation ||
      !["create_folder", "upload_text", "copy", "move", "delete"].includes(
        operation,
      )
    )
      throw new DropboxApiError(
        "provider_validation_error",
        "Dropbox operation is invalid.",
      );
    return operation;
  }
  private metadata(value: unknown) {
    const object = this.object(value);
    return {
      type: this.text(object[".tag"]),
      id: this.text(object.id),
      name: this.text(object.name),
      pathLower: this.text(object.path_lower),
      pathDisplay: this.text(object.path_display),
      revision: this.text(object.rev),
      size: typeof object.size === "number" ? object.size : null,
      serverModified: this.text(object.server_modified),
      contentHash: this.text(object.content_hash),
      downloadable: object.is_downloadable === true,
    };
  }
  private headerMetadata(value: string | null): JsonObject {
    if (!value || value.length > 100_000) return {};
    try {
      return this.object(JSON.parse(value));
    } catch {
      return {};
    }
  }
  private readPath(value: unknown, field: string, allowRoot = false) {
    const path = typeof value === "string" ? value.trim() : "";
    if (allowRoot && !path) return "";
    if (
      !path ||
      path.length > 1024 ||
      path.includes("\0") ||
      !/^(\/|id:|ns:|rev:)/.test(path)
    )
      throw new DropboxApiError(
        "provider_validation_error",
        `Dropbox ${field} is invalid.`,
      );
    return path;
  }
  private writePath(value: unknown, field: string) {
    const path = this.readPath(value, field);
    if (!path.startsWith("/") || path === "/")
      throw new DropboxApiError(
        "provider_validation_error",
        `Dropbox ${field} must be a non-root path.`,
      );
    return path;
  }
  private boundedText(value: unknown) {
    if (
      typeof value !== "string" ||
      new TextEncoder().encode(value).byteLength > 262_144
    )
      throw new DropboxApiError(
        "provider_validation_error",
        "Dropbox text must be at most 256 KiB.",
      );
    return value;
  }
  private requiredText(value: unknown, field: string, max: number) {
    const text = this.text(value);
    if (!text || text.length > max)
      throw new DropboxApiError(
        "provider_validation_error",
        `Dropbox ${field} is invalid.`,
      );
    return text;
  }
  private key(value: unknown) {
    const key = this.text(value);
    if (!key || key.length > 180)
      throw new DropboxApiError(
        "provider_validation_error",
        "Dropbox idempotencyKey is required.",
      );
    return key;
  }
  private limit(value: unknown, fallback: number, max: number) {
    const number = Number(value);
    return Number.isInteger(number)
      ? Math.max(1, Math.min(max, number))
      : fallback;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private safe(value: unknown, max: number) {
    const encoded = JSON.stringify(value ?? {});
    return encoded.length <= max
      ? (value ?? {})
      : { truncated: true, preview: encoded.slice(0, max) };
  }
}
