import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type TlDvCredentials = { apiKey: string };

export class TlDvApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class TlDvApiAdapter {
  health(credentials: TlDvCredentials) {
    return this.listMeetings(credentials, { limit: 1 });
  }

  listMeetings(credentials: TlDvCredentials, input: JsonObject = {}) {
    return this.request(credentials, {
      method: "GET",
      path: "/meetings",
      query: this.meetingQuery(input),
    });
  }

  getMeeting(credentials: TlDvCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: `/meetings/${this.meetingId(input.meetingId)}`,
    });
  }

  getTranscript(credentials: TlDvCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: `/meetings/${this.meetingId(input.meetingId)}/transcript`,
    });
  }

  getNotes(credentials: TlDvCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: `/meetings/${this.meetingId(input.meetingId)}/notes`,
    });
  }

  getRecordingDownload(credentials: TlDvCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: `/meetings/${this.meetingId(input.meetingId)}/download`,
    });
  }

  importMeeting(credentials: TlDvCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "POST",
      path: "/meetings/import",
      json: this.importBody(input),
    });
  }

  async request(
    credentials: TlDvCredentials,
    input: { method: string; path: string; query?: JsonObject; json?: JsonObject },
  ) {
    this.requireCredentials(credentials);
    const method = input.method.toUpperCase();
    if (!this.allowed(method, input.path)) {
      throw new TlDvApiError(
        "provider_validation_error",
        "tl;dv method or path is outside the documented public v1alpha1 API boundary.",
      );
    }
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);
    const url = new URL(`https://pasta.tldv.io/v1alpha1${input.path}`);
    this.appendQuery(url.searchParams, input.query ?? {});
    const body = input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body) > 100_000) {
      throw new TlDvApiError(
        "provider_validation_error",
        "tl;dv request exceeds 100 KB.",
      );
    }

    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "x-api-key": credentials.apiKey,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status >= 300 && response.status < 400) {
        return {
          status: "download_ready",
          message:
            "tl;dv prepared the recording download. The signed location is withheld from agent output.",
        };
      }
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 10_000_000) {
        throw new TlDvApiError(
          "provider_validation_error",
          "tl;dv response exceeds 10 MB.",
        );
      }
      let data: unknown;
      try {
        data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
      } catch {
        data = { content: raw.toString("utf8").slice(0, 1_000_000) };
      }
      data = this.redact(data);
      if (!response.ok) {
        throw new TlDvApiError(
          this.safeCode(response.status),
          this.message(data) ?? `tl;dv returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof TlDvApiError) throw error;
      throw new TlDvApiError(
        "provider_unavailable",
        "tl;dv could not be reached.",
        502,
      );
    }
  }

  private allowed(method: string, path: string) {
    if (
      !path.startsWith("/") ||
      path.includes("..") ||
      path.length > 500 ||
      !/^[A-Za-z0-9_./-]+$/.test(path)
    ) {
      return false;
    }
    if (method === "GET") {
      return (
        path === "/meetings" ||
        /^\/meetings\/[A-Za-z0-9_-]{1,200}$/.test(path) ||
        /^\/meetings\/[A-Za-z0-9_-]{1,200}\/(transcript|notes|download|highlights)$/.test(
          path,
        )
      );
    }
    return method === "POST" && path === "/meetings/import";
  }

  private requireCredentials(credentials: TlDvCredentials) {
    if (!credentials.apiKey?.trim() || credentials.apiKey.length > 4_000) {
      throw new TlDvApiError(
        "credential_missing",
        "tl;dv API key is required.",
        401,
      );
    }
  }

  private meetingQuery(input: JsonObject) {
    const query: JsonObject = {
      page: this.integer(input.page, 1, 1, 10_000),
      limit: this.integer(input.limit, 20, 1, 100),
    };
    for (const key of ["query", "from", "to", "meetingType"]) {
      if (input[key] !== undefined && input[key] !== null && input[key] !== "") {
        query[key] = input[key];
      }
    }
    if (typeof input.onlyParticipated === "boolean") {
      query.onlyParticipated = input.onlyParticipated;
    }
    return query;
  }

  private importBody(input: JsonObject) {
    const name = this.requiredString(input.name, "name", 1_000);
    const url = this.publicHttpsUrl(input.url);
    const body: JsonObject = { name, url };
    if (input.happenedAt !== undefined) {
      body.happenedAt = this.requiredString(input.happenedAt, "happenedAt", 100);
    }
    if (input.dryRun !== undefined) body.dryRun = input.dryRun === true;
    if (input.participants !== undefined) {
      if (!Array.isArray(input.participants) || input.participants.length > 100) {
        throw new TlDvApiError(
          "provider_validation_error",
          "participants must contain at most 100 email addresses.",
        );
      }
      body.participants = input.participants.map((value) =>
        this.requiredString(value, "participant", 320),
      );
    }
    return body;
  }

  private publicHttpsUrl(value: unknown) {
    const text = this.requiredString(value, "url", 4_000);
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new TlDvApiError(
        "provider_validation_error",
        "url must be a public HTTPS media URL.",
      );
    }
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "0.0.0.0" ||
      host === "::1" ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      throw new TlDvApiError(
        "policy_blocked",
        "tl;dv imports require a public HTTPS media URL.",
        403,
      );
    }
    return url.toString();
  }

  private meetingId(value: unknown) {
    const id = this.requiredString(value, "meetingId", 200);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new TlDvApiError(
        "provider_validation_error",
        "meetingId is invalid.",
      );
    }
    return id;
  }

  private requiredString(value: unknown, name: string, maxLength: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
      throw new TlDvApiError(
        "provider_validation_error",
        `${name} is required and must be at most ${maxLength} characters.`,
      );
    }
    return value.trim();
  }

  private integer(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value ?? fallback);
    return Number.isSafeInteger(number) && number >= min && number <= max
      ? number
      : fallback;
  }

  private appendQuery(params: URLSearchParams, query: JsonObject) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (!/^[A-Za-z0-9_]{1,100}$/.test(key)) {
        throw new TlDvApiError(
          "provider_validation_error",
          "tl;dv query key is invalid.",
        );
      }
      params.append(key, String(value).slice(0, 10_000));
    }
  }

  private rejectCredentials(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 10) {
        throw new TlDvApiError(
          "policy_blocked",
          "tl;dv request is too deeply nested.",
          403,
        );
      }
      if (Array.isArray(item)) return item.forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (/(api.?key|access.?token|secret|authorization|password|cookie|credential)/i.test(key)) {
          throw new TlDvApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        }
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) {
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key|download.?url|signed.?url)/i.test(key)
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
    const candidate = body?.message ?? body?.error ?? body?.reason;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 402 || status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
