import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

export type RiversideFmCredentials = { apiKey: string };
export class RiversideFmApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
type JsonObject = Record<string, unknown>;
const ORIGIN = "https://platform.riverside.fm";
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:=-]{0,499}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

@Injectable()
export class RiversideFmApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: RiversideFmCredentials) {
    return this.listWorkspace(credentials);
  }

  async listWorkspace(credentials: RiversideFmCredentials) {
    const value = await this.json(credentials, "GET", "/api/v3/productions");
    const productions = Array.isArray(value)
      ? value.slice(0, 500)
      : Array.isArray(this.object(value).productions)
        ? (this.object(value).productions as unknown[]).slice(0, 500)
        : [];
    return { productions: this.safeValue(productions) };
  }

  async listRecordings(credentials: RiversideFmCredentials, input: JsonObject) {
    return this.listPage(credentials, "/api/v3/recordings", input, 0);
  }

  async getRecording(credentials: RiversideFmCredentials, input: JsonObject) {
    const recordingId = this.identifier(input.recordingId, "recordingId");
    return {
      recording: this.safeValue(
        await this.json(
          credentials,
          "GET",
          `/api/v3/recordings/${encodeURIComponent(recordingId)}`,
        ),
      ),
    };
  }

  async deleteRecording(
    credentials: RiversideFmCredentials,
    input: JsonObject,
  ) {
    const recordingId = this.identifier(input.recordingId, "recordingId");
    await this.json(
      credentials,
      "DELETE",
      `/api/v3/recordings/${encodeURIComponent(recordingId)}`,
    );
    return { recordingId, deleted: true, deletionType: "soft" };
  }

  async downloadRecordingFile(
    credentials: RiversideFmCredentials,
    input: JsonObject,
  ) {
    const fileId = this.identifier(input.fileId, "fileId");
    return this.download(
      credentials,
      `/api/v3/download/file/${encodeURIComponent(fileId)}`,
      "file",
      fileId,
    );
  }

  async downloadTranscript(
    credentials: RiversideFmCredentials,
    input: JsonObject,
  ) {
    const recordingId = this.identifier(input.recordingId, "recordingId");
    const format = this.enumValue(input.format, "format", ["srt", "txt"]);
    const query: Record<string, string> = { type: format };
    if (input.fileName !== undefined)
      query.fileName = this.fileName(input.fileName);
    const response = await this.call(
      credentials,
      "GET",
      `/api/v3/download/transcription/${encodeURIComponent(recordingId)}`,
      query,
    );
    const content = await response.text();
    if (content.length > 2_000_000)
      throw new RiversideFmApiError(
        "provider_validation_error",
        "Riverside transcript exceeded the safe size limit.",
      );
    return { recordingId, format, content };
  }

  async listExports(credentials: RiversideFmCredentials, input: JsonObject) {
    return this.listPage(credentials, "/api/v3/exports", input, 1);
  }

  async getExport(credentials: RiversideFmCredentials, input: JsonObject) {
    const exportId = this.identifier(input.exportId, "exportId");
    return {
      export: this.safeValue(
        await this.json(
          credentials,
          "GET",
          `/api/v3/exports/${encodeURIComponent(exportId)}`,
        ),
      ),
    };
  }

  async downloadExport(credentials: RiversideFmCredentials, input: JsonObject) {
    const exportId = this.identifier(input.exportId, "exportId");
    return this.download(
      credentials,
      `/api/v3/download/export/${encodeURIComponent(exportId)}`,
      "export",
      exportId,
    );
  }

  async deleteExport(credentials: RiversideFmCredentials, input: JsonObject) {
    const exportId = this.identifier(input.exportId, "exportId");
    await this.json(
      credentials,
      "DELETE",
      `/api/v3/exports/${encodeURIComponent(exportId)}`,
    );
    return { exportId, deleted: true, deletionType: "permanent" };
  }

  async listRegistrants(
    credentials: RiversideFmCredentials,
    input: JsonObject,
  ) {
    const eventId = this.identifier(input.eventId, "eventId");
    const query: Record<string, string> = {
      limit: String(this.integer(input.limit, "limit", 1, 100, 100)),
      sort:
        input.sort === undefined
          ? "registeredAt"
          : this.enumValue(input.sort, "sort", [
              "registeredAt",
              "email",
              "name",
            ]),
      order: input.order === "asc" ? "asc" : "desc",
    };
    if (input.cursor !== undefined)
      query.cursor = this.string(input.cursor, "cursor", 1000);
    if (typeof input.approved === "boolean")
      query.approved = String(input.approved);
    if (typeof input.participated === "boolean")
      query.participated = String(input.participated);
    if (input.search !== undefined)
      query.search = this.string(input.search, "search", 200);
    if (input.updatedAfter !== undefined)
      query.updated_after = this.timestamp(input.updatedAfter, "updatedAfter");
    const body = this.object(
      await this.json(
        credentials,
        "GET",
        `/api/v3/events/${encodeURIComponent(eventId)}/registrants`,
        query,
      ),
    );
    return {
      eventId,
      items: this.safeValue(
        Array.isArray(body.items) ? body.items.slice(0, 100) : [],
      ),
      page: this.safeValue(body.page),
    };
  }

  async registerAttendee(
    credentials: RiversideFmCredentials,
    input: JsonObject,
  ) {
    const eventId = this.identifier(input.eventId, "eventId");
    const email = this.email(input.email);
    const firstName = this.string(input.firstName, "firstName", 100);
    const lastName = this.string(input.lastName, "lastName", 100);
    const customFields = this.customFields(input.customFields);
    return {
      registration: this.safeValue(
        await this.json(
          credentials,
          "POST",
          `/api/v3/events/${encodeURIComponent(eventId)}/registrants`,
          {},
          {
            email,
            first_name: firstName,
            last_name: lastName,
            ...(customFields.length ? { custom_fields: customFields } : {}),
          },
        ),
      ),
    };
  }

  async listEdits(credentials: RiversideFmCredentials, input: JsonObject) {
    const query: Record<string, string> = {
      page: String(this.integer(input.page, "page", 1, 1000, 1)),
    };
    if (input.studioId !== undefined)
      query.studioId = this.identifier(input.studioId, "studioId");
    if (input.projectId !== undefined)
      query.projectId = this.identifier(input.projectId, "projectId");
    if (input.startDate !== undefined)
      query.start_date = this.timestamp(input.startDate, "startDate");
    if (input.endDate !== undefined)
      query.end_date = this.timestamp(input.endDate, "endDate");
    this.assertRange(query.start_date, query.end_date);
    const body = this.object(
      await this.json(credentials, "GET", "/api/v3/edits", query),
    );
    return this.boundedPage(body, 20);
  }

  async createTimeline(credentials: RiversideFmCredentials, input: JsonObject) {
    const clipId = this.identifier(input.clipId, "clipId");
    const target = this.enumValue(input.target, "target", [
      "premiere_pro",
      "final_cut_pro",
      "pro_tools",
    ]);
    if (typeof input.includeCommentsMarkersChapters !== "boolean")
      this.invalid("includeCommentsMarkersChapters");
    return {
      timeline: this.safeValue(
        await this.json(
          credentials,
          "POST",
          `/api/v3/edits/${encodeURIComponent(clipId)}/timeline`,
          {},
          {
            target,
            include_comments_markers_chapters:
              input.includeCommentsMarkersChapters,
          },
        ),
      ),
    };
  }

  async getTimeline(credentials: RiversideFmCredentials, input: JsonObject) {
    const timelineId = this.identifier(input.timelineId, "timelineId");
    return {
      timeline: this.safeValue(
        await this.json(
          credentials,
          "GET",
          `/api/v3/timelines/${encodeURIComponent(timelineId)}`,
        ),
      ),
    };
  }

  async downloadTimeline(
    credentials: RiversideFmCredentials,
    input: JsonObject,
  ) {
    const timelineId = this.identifier(input.timelineId, "timelineId");
    return this.download(
      credentials,
      `/api/v3/download/timeline/${encodeURIComponent(timelineId)}`,
      "timeline",
      timelineId,
    );
  }

  private async listPage(
    credentials: RiversideFmCredentials,
    path: string,
    input: JsonObject,
    defaultPage: number,
  ) {
    const query: Record<string, string> = {
      page: String(this.integer(input.page, "page", 0, 1000, defaultPage)),
    };
    if (input.studioId !== undefined)
      query.studioId = this.identifier(input.studioId, "studioId");
    if (input.projectId !== undefined)
      query.projectId = this.identifier(input.projectId, "projectId");
    if (input.startDate !== undefined)
      query.start_date = this.date(input.startDate, "startDate");
    if (input.endDate !== undefined)
      query.end_date = this.date(input.endDate, "endDate");
    this.assertRange(query.start_date, query.end_date);
    return this.boundedPage(
      this.object(await this.json(credentials, "GET", path, query)),
      20,
    );
  }

  private boundedPage(body: JsonObject, limit: number) {
    return {
      page: Number.isSafeInteger(body.page) ? body.page : 0,
      totalItems: Number.isSafeInteger(body.total_items) ? body.total_items : 0,
      totalPages: Number.isSafeInteger(body.total_pages) ? body.total_pages : 0,
      hasNextPage: typeof body.next_page_url === "string",
      data: this.safeValue(
        Array.isArray(body.data) ? body.data.slice(0, limit) : [],
      ),
    };
  }

  private async download(
    credentials: RiversideFmCredentials,
    path: string,
    kind: string,
    id: string,
  ) {
    const response = await this.call(
      credentials,
      "GET",
      path,
      {},
      undefined,
      true,
    );
    if (![301, 302, 307, 308].includes(response.status))
      throw new RiversideFmApiError(
        "provider_validation_error",
        "Riverside did not return a supported download redirect.",
        response.status,
      );
    const location = response.headers.get("location");
    let url: URL;
    try {
      url = new URL(location ?? "");
    } catch {
      this.invalid("download redirect");
    }
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "riverside.fm" ||
        url.hostname.endsWith(".riverside.fm")
      )
    )
      throw new RiversideFmApiError(
        "policy_blocked",
        "Riverside returned a download location outside its allowlisted domain.",
      );
    return { kind, id, downloadUrl: url.toString(), shortLived: true };
  }

  private async json(
    credentials: RiversideFmCredentials,
    method: string,
    path: string,
    query: Record<string, string> = {},
    body?: JsonObject,
  ) {
    const response = await this.call(credentials, method, path, query, body);
    if (
      response.status === 204 ||
      (response.status === 202 && !response.headers.get("content-type"))
    )
      return {};
    const raw = await response.text();
    if (raw.length > 3_000_000)
      throw new RiversideFmApiError(
        "provider_validation_error",
        "Riverside response exceeded the safe size limit.",
      );
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      throw new RiversideFmApiError(
        "provider_unavailable",
        "Riverside returned invalid JSON.",
      );
    }
  }

  private async call(
    credentials: RiversideFmCredentials,
    method: string,
    path: string,
    query: Record<string, string> = {},
    body?: JsonObject,
    allowRedirect = false,
  ) {
    this.assertCredentials(credentials);
    const url = new URL(path, ORIGIN);
    if (
      url.origin !== ORIGIN ||
      !url.pathname.startsWith("/api/v3/") ||
      path.includes("..")
    )
      throw new RiversideFmApiError(
        "policy_blocked",
        "Riverside request path is not allowlisted.",
      );
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole-Riverside/1.0",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new RiversideFmApiError(
        "provider_unavailable",
        "Riverside is temporarily unavailable.",
      );
    }
    if (allowRedirect && [301, 302, 307, 308].includes(response.status))
      return response;
    if (!response.ok) this.requestFailed(response.status);
    return response;
  }

  private requestFailed(status: number): never {
    throw new RiversideFmApiError(
      status === 401
        ? "credential_missing"
        : status === 403
          ? "insufficient_scope"
          : status === 429
            ? "provider_rate_limited"
            : status >= 500
              ? "provider_unavailable"
              : "provider_validation_error",
      "Riverside API request failed.",
      status,
    );
  }

  private assertCredentials(credentials: RiversideFmCredentials) {
    if (!credentials.apiKey.trim())
      throw new RiversideFmApiError(
        "credential_missing",
        "Riverside Business API key is missing.",
      );
  }

  private customFields(value: unknown) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 50)
      this.invalid("customFields");
    return value.map((entry, index) => {
      const item = this.object(entry);
      const label = this.string(
        item.label,
        `customFields[${index}].label`,
        100,
      );
      const fieldValue = item.value;
      if (typeof fieldValue === "string")
        return { label, value: fieldValue.slice(0, 256) };
      if (typeof fieldValue === "boolean") return { label, value: fieldValue };
      const phone = this.object(fieldValue);
      if (
        typeof phone.countryCode === "string" &&
        /^\+[1-9]\d{0,3}$/.test(phone.countryCode) &&
        typeof phone.phoneNumber === "string" &&
        /^\d{4,20}$/.test(phone.phoneNumber)
      )
        return {
          label,
          value: {
            countryCode: phone.countryCode,
            phoneNumber: phone.phoneNumber,
          },
        };
      return this.invalid(`customFields[${index}].value`);
    });
  }

  private identifier(value: unknown, field: string) {
    if (typeof value !== "string" || !IDENTIFIER.test(value))
      this.invalid(field);
    return String(value);
  }

  private string(value: unknown, field: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      this.invalid(field);
    return value.trim();
  }

  private email(value: unknown) {
    const email = this.string(value, "email", 320).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) this.invalid("email");
    return email;
  }

  private fileName(value: unknown) {
    const name = this.string(value, "fileName", 120);
    if (!/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,119}$/.test(name))
      this.invalid("fileName");
    return name;
  }

  private integer(
    value: unknown,
    field: string,
    min: number,
    max: number,
    fallback: number,
  ) {
    if (value === undefined) return fallback;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < min ||
      Number(value) > max
    )
      this.invalid(field);
    return Number(value);
  }

  private enumValue(value: unknown, field: string, allowed: string[]) {
    if (typeof value !== "string" || !allowed.includes(value))
      this.invalid(field);
    return String(value);
  }

  private date(value: unknown, field: string) {
    if (
      typeof value !== "string" ||
      !DATE.test(value) ||
      Number.isNaN(Date.parse(value))
    )
      this.invalid(field);
    return String(value);
  }

  private timestamp(value: unknown, field: string) {
    if (
      typeof value !== "string" ||
      !TIMESTAMP.test(value) ||
      Number.isNaN(Date.parse(value))
    )
      this.invalid(field);
    return String(value);
  }

  private assertRange(start?: string, end?: string) {
    if (start && end && Date.parse(end) < Date.parse(start))
      this.invalid("date range");
  }

  private invalid(field: string): never {
    throw new RiversideFmApiError(
      "provider_validation_error",
      `Riverside ${field} is invalid.`,
    );
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private safeValue(value: unknown, depth = 0): unknown {
    if (depth > 6) return null;
    if (typeof value === "string") return value.slice(0, 20_000);
    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    )
      return value;
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.safeValue(item, depth + 1));
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(this.object(value)).slice(
      0,
      100,
    )) {
      if (/api.?key|authorization|password|secret/i.test(key)) continue;
      out[key] = this.safeValue(item, depth + 1);
    }
    return out;
  }
}
