import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type GravityFormsCredentials = {
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
};
export type GravityFormsOperationInput = {
  formId?: unknown;
  entryId?: unknown;
  fieldIds?: unknown;
  limit?: unknown;
  offset?: unknown;
};

export const GRAVITY_FORMS_READ_OPERATIONS = [
  "forms.list",
  "forms.get",
  "entries.list",
  "entries.get",
] as const;

export class GravityFormsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class GravityFormsApiAdapter {
  health(credentials: GravityFormsCredentials) {
    return this.directRequest(credentials, "forms", "forms.list");
  }

  read(
    credentials: GravityFormsCredentials,
    operation: string,
    input: GravityFormsOperationInput,
  ) {
    this.rejectUnknownInput(input);
    if (!GRAVITY_FORMS_READ_OPERATIONS.includes(operation as never)) {
      throw this.invalid(
        "Gravity Forms operation is not in Relay's pinned read-only contract.",
      );
    }
    if (operation === "forms.list") {
      this.requireOnly(input, []);
      return this.directRequest(credentials, "forms", operation);
    }
    if (operation === "forms.get") {
      this.requireOnly(input, ["formId"]);
      return this.directRequest(
        credentials,
        `forms/${this.id(input.formId, "formId")}`,
        operation,
      );
    }
    if (operation === "entries.list") {
      this.requireOnly(input, ["formId", "fieldIds", "limit", "offset"]);
      const query = this.entryQuery(input, true);
      return this.directRequest(
        credentials,
        `forms/${this.id(input.formId, "formId")}/entries?${query}`,
        operation,
      );
    }
    this.requireOnly(input, ["entryId", "fieldIds"]);
    const query = this.entryQuery(input, false);
    return this.directRequest(
      credentials,
      `entries/${this.id(input.entryId, "entryId")}?${query}`,
      operation,
    );
  }

  private async directRequest(
    credentials: GravityFormsCredentials,
    target: string,
    operation: string,
  ) {
    this.requireCredentials(credentials);
    const root = await this.apiRoot(credentials.siteUrl);
    const url = new URL(target.replace(/^\/+/, ""), root);
    if (
      url.protocol !== "https:" ||
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      throw new GravityFormsApiError(
        "policy_blocked",
        "Gravity Forms requests must stay on the configured site's HTTPS REST API v2 route.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString("base64")}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof GravityFormsApiError) throw error;
      throw new GravityFormsApiError(
        "provider_unavailable",
        "The configured Gravity Forms site could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000) {
      throw this.invalid(
        "Gravity Forms response exceeds Relay's 2.5 MB limit.",
      );
    }
    const data = this.redact(this.parse(raw));
    if (!response.ok) {
      throw new GravityFormsApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Gravity Forms returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return operation === "forms.get" ? this.formSchema(data) : data;
  }

  private async apiRoot(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.invalid("Enter a valid Gravity Forms site URL.");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !url.hostname ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost")
    ) {
      throw new GravityFormsApiError(
        "policy_blocked",
        "Gravity Forms requires a public HTTPS site URL without embedded credentials, ports, query, or fragment.",
        403,
      );
    }
    await this.requirePublicHost(url.hostname);
    const sitePath = url.pathname.replace(/\/+$/, "");
    return new URL(`${url.origin}${sitePath}/wp-json/gf/v2/`);
  }

  private async requirePublicHost(hostname: string) {
    if (isIP(hostname) && this.isPrivateAddress(hostname)) {
      throw new GravityFormsApiError(
        "policy_blocked",
        "Gravity Forms site URL cannot use a private or local address.",
        403,
      );
    }
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new GravityFormsApiError(
        "provider_unavailable",
        "Gravity Forms site hostname could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some((item) => this.isPrivateAddress(item.address))
    ) {
      throw new GravityFormsApiError(
        "policy_blocked",
        "Gravity Forms site hostname must resolve only to public addresses.",
        403,
      );
    }
  }

  private isPrivateAddress(address: string) {
    const normalized = address.toLowerCase().replace(/^::ffff:/, "");
    if (normalized.includes(":")) {
      return (
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("fe8") ||
        normalized.startsWith("fe9") ||
        normalized.startsWith("fea") ||
        normalized.startsWith("feb")
      );
    }
    const parts = normalized.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
      return true;
    }
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }

  private entryQuery(input: GravityFormsOperationInput, paged: boolean) {
    const params = new URLSearchParams();
    params.set("_field_ids", this.fieldIds(input.fieldIds));
    params.set("_labels", "1");
    if (paged) {
      params.set(
        "paging[page_size]",
        String(this.integer(input.limit, "limit", 1, 25, 10)),
      );
      params.set(
        "paging[offset]",
        String(this.integer(input.offset, "offset", 0, 10_000, 0)),
      );
    }
    return params.toString();
  }

  private fieldIds(value: unknown) {
    const defaults = [
      "id",
      "form_id",
      "date_created",
      "date_updated",
      "status",
      "is_read",
      "is_starred",
    ];
    const values = value === undefined ? defaults : value;
    if (!Array.isArray(values) || !values.length || values.length > 20) {
      throw this.invalid("fieldIds must contain between 1 and 20 fields.");
    }
    const allowedProperty =
      /^(?:id|form_id|date_created|date_updated|status|is_read|is_starred|created_by|payment_status|payment_amount)$/;
    const result = values.map((item) => String(item).trim());
    if (
      result.some(
        (item) => !/^\d+(?:\.\d+)?$/.test(item) && !allowedProperty.test(item),
      ) ||
      new Set(result).size !== result.length
    ) {
      throw this.invalid(
        "fieldIds may contain unique numeric field IDs and supported entry metadata only.",
      );
    }
    return result.join(",");
  }

  private id(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    if (!/^[1-9]\d{0,18}$/.test(text)) {
      throw this.invalid(`Gravity Forms ${name} must be a positive integer.`);
    }
    return text;
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
    if (!Number.isInteger(number) || number < min || number > max) {
      throw this.invalid(`${name} must be an integer from ${min} to ${max}.`);
    }
    return number;
  }

  private requireOnly(
    input: GravityFormsOperationInput,
    allowed: readonly string[],
  ) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key))) {
      throw this.invalid(
        "Gravity Forms input contains fields unsupported by the selected operation.",
      );
    }
  }

  private rejectUnknownInput(input: GravityFormsOperationInput) {
    const allowed = new Set([
      "formId",
      "entryId",
      "fieldIds",
      "limit",
      "offset",
    ]);
    if (Object.keys(input).some((key) => !allowed.has(key))) {
      throw new GravityFormsApiError(
        "policy_blocked",
        "Gravity Forms accepts only pinned operation inputs.",
        403,
      );
    }
  }

  private requireCredentials(credentials: GravityFormsCredentials) {
    for (const [name, value] of [
      ["consumer key", credentials.consumerKey],
      ["consumer secret", credentials.consumerSecret],
    ] as const) {
      if (!value || value.length > 16_000 || /[\r\n:]/.test(value)) {
        throw new GravityFormsApiError(
          "credential_missing",
          `A valid Gravity Forms ${name} is required.`,
          401,
        );
      }
    }
  }

  private formSchema(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const form = value as JsonObject;
    const fields = Array.isArray(form.fields)
      ? form.fields.slice(0, 250).map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item))
            return null;
          const field = item as JsonObject;
          return Object.fromEntries(
            [
              "id",
              "label",
              "adminLabel",
              "type",
              "inputType",
              "description",
              "isRequired",
              "visibility",
              "inputs",
              "choices",
            ]
              .filter((key) => field[key] !== undefined)
              .map((key) => [key, field[key]]),
          );
        })
      : [];
    return {
      id: form.id,
      title: form.title,
      description: form.description,
      is_active: form.is_active,
      fields,
    };
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
    if (Array.isArray(value)) {
      return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") {
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    }
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
    return new GravityFormsApiError("provider_validation_error", message, 400);
  }
}
