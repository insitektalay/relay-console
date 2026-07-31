import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type RefinerCredentials = { apiKey: string };
export type RefinerOperationInput = {
  page?: unknown;
  limit?: unknown;
  list?: unknown;
  formUuid?: unknown;
  type?: unknown;
  dateStart?: unknown;
  dateEnd?: unknown;
};
export const REFINER_READ_OPERATIONS = [
  "account.get",
  "forms.list",
  "responses.list",
  "reporting.get",
  "segments.list",
] as const;

export class RefinerApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class RefinerApiAdapter {
  health(credentials: RefinerCredentials) {
    return this.request(credentials, "account", {});
  }

  read(
    credentials: RefinerCredentials,
    operation: string,
    input: RefinerOperationInput,
  ) {
    this.rejectUnknownInput(input);
    if (!REFINER_READ_OPERATIONS.includes(operation as never))
      throw this.invalid(
        "Refiner operation is outside Relay's pinned read-only contract.",
      );
    if (operation === "account.get") {
      this.requireOnly(input, []);
      return this.request(credentials, "account", {});
    }
    const page = this.integer(input.page, "page", 1, 10_000, 1);
    const pageLength = this.integer(input.limit, "limit", 1, 25, 20);
    if (operation === "forms.list") {
      this.requireOnly(input, ["page", "limit", "list"]);
      const list = input.list === undefined ? "all" : String(input.list);
      if (!["all", "published", "drafts", "archived"].includes(list))
        throw this.invalid("list is not supported.");
      return this.request(credentials, "forms", {
        page,
        page_length: pageLength,
        list,
        include_config: 0,
        include_info: 1,
      });
    }
    if (operation === "responses.list") {
      this.requireOnly(input, [
        "page",
        "limit",
        "formUuid",
        "dateStart",
        "dateEnd",
      ]);
      return this.request(credentials, "responses", {
        page,
        page_length: pageLength,
        include: "completed",
        ...this.filters(input, true),
      });
    }
    if (operation === "reporting.get") {
      this.requireOnly(input, ["type", "formUuid", "dateStart", "dateEnd"]);
      const type = String(input.type ?? "");
      if (!["nps", "csat", "ratings", "distribution", "count"].includes(type))
        throw this.invalid(
          "type must be nps, csat, ratings, distribution, or count.",
        );
      return this.request(credentials, "reporting", {
        type,
        ...this.filters(input, true),
      });
    }
    this.requireOnly(input, ["page", "limit"]);
    return this.request(credentials, "segments", {
      page,
      page_length: pageLength,
    });
  }

  private filters(input: RefinerOperationInput, allowForm: boolean) {
    const formUuid =
      allowForm && input.formUuid !== undefined
        ? this.uuid(input.formUuid, "formUuid")
        : undefined;
    const dateStart = this.date(input.dateStart, "dateStart");
    const dateEnd = this.date(input.dateEnd, "dateEnd");
    if (dateStart && dateEnd && Date.parse(dateStart) > Date.parse(dateEnd))
      throw this.invalid("dateStart cannot be later than dateEnd.");
    return {
      ...(formUuid ? { form_uuid: formUuid } : {}),
      ...(dateStart ? { date_start: dateStart } : {}),
      ...(dateEnd ? { date_end: dateEnd } : {}),
    };
  }

  private async request(
    credentials: RefinerCredentials,
    target: string,
    query: Record<string, string | number>,
  ) {
    this.requireCredentials(credentials);
    const root = new URL("https://api.refiner.io/v1/");
    const url = new URL(target, root);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
      throw new RefinerApiError(
        "policy_blocked",
        "Refiner requests must stay on the HTTPS API v1 route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiKey}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new RefinerApiError(
        "provider_unavailable",
        "Refiner could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Refiner response exceeds Relay's 2.5 MB limit.");
    const parsed = this.redact(this.parse(raw));
    if (!response.ok)
      throw new RefinerApiError(
        this.safeCode(response.status),
        this.errorMessage(parsed) ??
          `Refiner returned HTTP ${response.status}.`,
        response.status,
      );
    return target === "responses"
      ? this.minimizeResponses(parsed)
      : target === "segments"
        ? this.minimizeSegments(parsed)
        : parsed;
  }

  private minimizeResponses(value: unknown): unknown {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    const items = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.responses)
        ? body.responses
        : undefined;
    if (!items) return value;
    const minimized = items.slice(0, 25).map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const response = item as JsonObject;
      const contact = response.contact;
      return Object.fromEntries(
        [
          "uuid",
          "form_uuid",
          "form",
          "data",
          "completed_at",
          "created_at",
          "updated_at",
        ]
          .filter((key) => response[key] !== undefined)
          .map((key) => [key, response[key]])
          .concat(
            contact &&
              typeof contact === "object" &&
              !Array.isArray(contact) &&
              typeof (contact as JsonObject).uuid === "string"
              ? [["contact", { uuid: (contact as JsonObject).uuid }]]
              : [],
          ),
      );
    });
    return {
      ...body,
      ...(Array.isArray(body.items)
        ? { items: minimized }
        : { responses: minimized }),
    };
  }

  private minimizeSegments(value: unknown): unknown {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    const items = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.segments)
        ? body.segments
        : undefined;
    if (!items) return value;
    const minimized = items
      .slice(0, 25)
      .map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? Object.fromEntries(
              ["uuid", "name", "is_manual"]
                .filter((key) => (item as JsonObject)[key] !== undefined)
                .map((key) => [key, (item as JsonObject)[key]]),
            )
          : null,
      );
    return {
      ...body,
      ...(Array.isArray(body.items)
        ? { items: minimized }
        : { segments: minimized }),
    };
  }

  private requireCredentials(credentials: RefinerCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 16_000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new RefinerApiError(
        "credential_missing",
        "A valid Refiner API key is required.",
        401,
      );
  }

  private integer(
    value: unknown,
    name: string,
    min: number,
    max: number,
    fallback: number,
  ) {
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max)
      throw this.invalid(`${name} must be an integer from ${min} to ${max}.`);
    return number;
  }

  private uuid(value: unknown, name: string) {
    const text = String(value);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        text,
      )
    )
      throw this.invalid(`${name} must be a UUID.`);
    return text;
  }

  private date(value: unknown, name: string) {
    if (value === undefined) return undefined;
    const text = String(value);
    if (
      text.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(text) ||
      Number.isNaN(Date.parse(text))
    )
      throw this.invalid(`${name} must be an ISO date or UTC datetime.`);
    return text;
  }

  private requireOnly(
    input: RefinerOperationInput,
    allowed: readonly string[],
  ) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key)))
      throw this.invalid(
        "Refiner input contains fields unsupported by the selected operation.",
      );
  }

  private rejectUnknownInput(input: RefinerOperationInput) {
    const allowed = new Set([
      "page",
      "limit",
      "list",
      "formUuid",
      "type",
      "dateStart",
      "dateEnd",
    ]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new RefinerApiError(
        "policy_blocked",
        "Refiner accepts only pinned operation inputs.",
        403,
      );
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 25).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|signed.?url)/i.test(
            key,
          )
            ? "[REDACTED]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const body = value as JsonObject;
    const candidate = body.message ?? body.error ?? body.reason;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new RefinerApiError("provider_validation_error", message, 400);
  }
}
