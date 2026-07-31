import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class BoxApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class BoxApiAdapter {
  private readonly apiOrigin = "https://api.box.com/2.0";
  private readonly uploadOrigin = "https://upload.box.com/api/2.0";
  private readonly fields =
    "id,type,name,description,size,etag,sequence_id,sha1,file_version,parent,path_collection,created_at,modified_at,owned_by,item_status,version_number";

  async getCurrentUser(token: string) {
    const value = await this.request(
      token,
      "GET",
      `${this.apiOrigin}/users/me`,
      {
        fields: "id,type,name,login,status,enterprise,space_amount,space_used",
      },
    );
    const enterprise = this.object(value.enterprise);
    return {
      id: this.text(value.id),
      name: this.text(value.name),
      login: this.text(value.login),
      status: this.text(value.status),
      enterprise: {
        id: this.text(enterprise.id),
        name: this.text(enterprise.name),
      },
      spaceAmount: this.number(value.space_amount),
      spaceUsed: this.number(value.space_used),
      providerRequestCount: 1,
    };
  }
  async listFolderItems(token: string, input: JsonObject) {
    const folderId = this.id(input.folderId, "folderId", "0"),
      max = this.limit(input.maxResults, 25, 50),
      marker = this.marker(input.marker);
    const value = await this.request(
      token,
      "GET",
      `${this.apiOrigin}/folders/${folderId}/items`,
      {
        usemarker: "true",
        limit: String(max),
        fields: this.fields,
        ...(marker ? { marker } : {}),
      },
    );
    const entries = this.array(value.entries)
      .slice(0, max)
      .map((entry) => this.item(entry));
    return {
      folderId,
      entries,
      count: entries.length,
      nextMarker: this.text(value.next_marker),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }
  async getFile(token: string, input: JsonObject) {
    return this.getItem(token, "file", this.id(input.fileId, "fileId"));
  }
  async getFolder(token: string, input: JsonObject) {
    return this.getItem(token, "folder", this.id(input.folderId, "folderId"));
  }
  async searchContent(token: string, input: JsonObject) {
    const query = this.requiredText(input.query, "query", 200),
      max = this.limit(input.maxResults, 10, 25),
      marker = this.marker(input.marker),
      ancestorFolderIds = this.ancestorIds(input.ancestorFolderIds);
    const value = await this.request(token, "GET", `${this.apiOrigin}/search`, {
      query,
      usemarker: "true",
      limit: String(max),
      fields: this.fields,
      ...(ancestorFolderIds ? { ancestor_folder_ids: ancestorFolderIds } : {}),
      ...(marker ? { marker } : {}),
    });
    const entries = this.array(value.entries)
      .slice(0, max)
      .map((entry) => this.item(entry));
    return {
      query,
      ancestorFolderIds,
      entries,
      count: entries.length,
      nextMarker: this.text(value.next_marker),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }
  prepareTextUpload(input: JsonObject) {
    const change = {
      parentFolderId: this.id(input.parentFolderId, "parentFolderId", "0"),
      name: this.name(input.name),
      text: this.boundedText(input.text),
    };
    return {
      change,
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      providerRequestCount: 0,
    };
  }
  async createFolder(token: string, input: JsonObject) {
    const parentFolderId = this.id(input.parentFolderId, "parentFolderId", "0"),
      name = this.name(input.name);
    const value = await this.request(
      token,
      "POST",
      `${this.apiOrigin}/folders`,
      { fields: this.fields },
      { name, parent: { id: parentFolderId } },
    );
    return this.writeResult("create_folder", input, value);
  }
  async uploadText(token: string, input: JsonObject) {
    const parentFolderId = this.id(input.parentFolderId, "parentFolderId", "0"),
      name = this.name(input.name),
      content = this.boundedText(input.text),
      boundary = `RelayBox${createHash("sha256").update(`${parentFolderId}:${name}`).digest("hex").slice(0, 24)}`;
    const body = this.multipart(
      boundary,
      { name, parent: { id: parentFolderId } },
      name,
      content,
    );
    const value = await this.request(
      token,
      "POST",
      `${this.uploadOrigin}/files/content`,
      { fields: this.fields },
      body,
      { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    );
    const entry = this.array(value.entries)[0] ?? value;
    return this.writeResult("upload_text", input, this.object(entry));
  }
  async copyItem(token: string, input: JsonObject) {
    const type = this.itemType(input.itemType),
      itemId = this.id(input.itemId, "itemId"),
      destinationFolderId = this.id(
        input.destinationFolderId,
        "destinationFolderId",
        "0",
      ),
      name = this.optionalName(input.name);
    const value = await this.request(
      token,
      "POST",
      `${this.apiOrigin}/${type}s/${itemId}/copy`,
      { fields: this.fields },
      { parent: { id: destinationFolderId }, ...(name ? { name } : {}) },
    );
    return this.writeResult("copy", input, value);
  }
  async moveItem(token: string, input: JsonObject) {
    const type = this.itemType(input.itemType),
      itemId = this.id(input.itemId, "itemId"),
      destinationFolderId = this.id(
        input.destinationFolderId,
        "destinationFolderId",
        "0",
      ),
      name = this.optionalName(input.name),
      etag = this.optionalText(input.etag, 200);
    const value = await this.request(
      token,
      "PUT",
      `${this.apiOrigin}/${type}s/${itemId}`,
      { fields: this.fields },
      { parent: { id: destinationFolderId }, ...(name ? { name } : {}) },
      etag ? { "If-Match": etag } : {},
    );
    return this.writeResult("move", input, value);
  }

  private async getItem(token: string, type: "file" | "folder", id: string) {
    return {
      item: this.item(
        await this.request(token, "GET", `${this.apiOrigin}/${type}s/${id}`, {
          fields: this.fields,
        }),
      ),
      providerRequestCount: 1,
    };
  }
  private async request(
    token: string,
    method: string,
    baseUrl: string,
    query: Record<string, string>,
    body?: JsonObject | Uint8Array,
    extraHeaders: Record<string, string> = {},
  ): Promise<JsonObject> {
    if (!token || token.length > 8_000)
      throw new BoxApiError(
        "credential_missing",
        "A Box OAuth access token is required.",
        401,
      );
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body && !(body instanceof Uint8Array)
            ? { "Content-Type": "application/json" }
            : {}),
          ...extraHeaders,
        },
        ...(body === undefined
          ? {}
          : {
              body: (body instanceof Uint8Array
                ? body
                : JSON.stringify(body)) as BodyInit,
            }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BoxApiError(
        "provider_unavailable",
        "Box could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new BoxApiError(
        "provider_validation_error",
        "Box response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new BoxApiError(
        this.code(response.status),
        response.status === 429
          ? "Box rate limit reached; retry later."
          : response.status === 412
            ? "Box item changed; refresh its metadata before retrying."
            : "Box rejected the request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      return {};
    }
  }
  private multipart(
    boundary: string,
    attributes: JsonObject,
    name: string,
    text: string,
  ) {
    const prefix = `--${boundary}\r\nContent-Disposition: form-data; name="attributes"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(attributes)}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n`;
    return new TextEncoder().encode(`${prefix}${text}\r\n--${boundary}--\r\n`);
  }
  private writeResult(operation: string, input: JsonObject, value: JsonObject) {
    return {
      operation,
      item: this.item(value),
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount: 1,
    };
  }
  private item(value: unknown) {
    const object = this.object(value),
      parent = this.object(object.parent),
      owner = this.object(object.owned_by),
      version = this.object(object.file_version),
      path = this.array(this.object(object.path_collection).entries)
        .slice(0, 100)
        .map((entry) => {
          const item = this.object(entry);
          return { id: this.text(item.id), name: this.text(item.name) };
        });
    return {
      itemType: this.text(object.type),
      id: this.text(object.id),
      name: this.text(object.name),
      description: this.text(object.description),
      size: this.number(object.size),
      etag: this.text(object.etag),
      sequenceId: this.text(object.sequence_id),
      sha1: this.text(object.sha1),
      fileVersionId: this.text(version.id),
      versionNumber: this.text(object.version_number),
      parent: { id: this.text(parent.id), name: this.text(parent.name) },
      path,
      createdAt: this.text(object.created_at),
      modifiedAt: this.text(object.modified_at),
      owner: { id: this.text(owner.id), name: this.text(owner.name) },
      itemStatus: this.text(object.item_status),
    };
  }
  private id(value: unknown, field: string, fallback?: string) {
    const id = this.text(value) ?? fallback;
    if (!id || !/^\d{1,64}$/.test(id))
      throw new BoxApiError(
        "provider_validation_error",
        `Box ${field} is invalid.`,
      );
    return id;
  }
  private ancestorIds(value: unknown) {
    const raw = this.text(value);
    if (!raw) return null;
    const ids = raw.split(",").map((id) => id.trim());
    if (ids.length > 20 || ids.some((id) => !/^\d{1,64}$/.test(id)))
      throw new BoxApiError(
        "provider_validation_error",
        "Box ancestorFolderIds is invalid.",
      );
    return ids.join(",");
  }
  private itemType(value: unknown): "file" | "folder" {
    const type = this.text(value);
    if (type !== "file" && type !== "folder")
      throw new BoxApiError(
        "provider_validation_error",
        "Box itemType must be file or folder.",
      );
    return type;
  }
  private name(value: unknown) {
    const name = this.requiredText(value, "name", 255);
    if (
      name === "." ||
      name === ".." ||
      name.includes("/") ||
      name.includes("\\") ||
      name.includes('"') ||
      /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(name) ||
      name.trim() !== name
    )
      throw new BoxApiError(
        "provider_validation_error",
        "Box item name is invalid.",
      );
    return name;
  }
  private optionalName(value: unknown) {
    return this.text(value) ? this.name(value) : null;
  }
  private boundedText(value: unknown) {
    if (
      typeof value !== "string" ||
      new TextEncoder().encode(value).byteLength > 262_144
    )
      throw new BoxApiError(
        "provider_validation_error",
        "Box text must be at most 256 KiB.",
      );
    return value;
  }
  private requiredText(value: unknown, field: string, max: number) {
    const text = typeof value === "string" ? value : "";
    if (!text || text.length > max)
      throw new BoxApiError(
        "provider_validation_error",
        `Box ${field} is invalid.`,
      );
    return text;
  }
  private optionalText(value: unknown, max: number) {
    const text = this.text(value);
    if (text && text.length > max)
      throw new BoxApiError(
        "provider_validation_error",
        "Box optional value is too long.",
      );
    return text;
  }
  private marker(value: unknown) {
    return this.optionalText(value, 500);
  }
  private key(value: unknown) {
    const key = this.text(value);
    if (!key || key.length > 180)
      throw new BoxApiError(
        "provider_validation_error",
        "Box idempotencyKey is required.",
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
  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
