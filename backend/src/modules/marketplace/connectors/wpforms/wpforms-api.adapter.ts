import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type WpFormsCredentials = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
};
export type WpFormsOperationInput = {
  formId?: unknown;
  entryId?: unknown;
  status?: unknown;
  type?: unknown;
  limit?: unknown;
  offset?: unknown;
};

export const WPFORMS_READ_OPERATIONS = [
  "forms.list",
  "forms.get",
  "form-stats.get",
  "entry-summaries.list",
  "entries.get",
] as const;

const ABILITY_BY_OPERATION: Record<
  (typeof WPFORMS_READ_OPERATIONS)[number],
  string
> = {
  "forms.list": "list-forms",
  "forms.get": "get-form",
  "form-stats.get": "get-form-stats",
  "entry-summaries.list": "get-entry-summaries",
  "entries.get": "get-entry",
};

export class WpFormsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class WpFormsApiAdapter {
  health(credentials: WpFormsCredentials) {
    return this.request(credentials, "forms.list", {
      status: "publish",
      limit: 1,
      offset: 0,
    });
  }

  read(
    credentials: WpFormsCredentials,
    operation: string,
    input: WpFormsOperationInput,
  ) {
    this.rejectUnknownInput(input);
    if (!WPFORMS_READ_OPERATIONS.includes(operation as never)) {
      throw this.invalid(
        "WPForms operation is not in Relay's pinned read-only contract.",
      );
    }
    const typedOperation =
      operation as (typeof WPFORMS_READ_OPERATIONS)[number];
    return this.request(
      credentials,
      typedOperation,
      this.abilityInput(typedOperation, input),
    );
  }

  private abilityInput(
    operation: (typeof WPFORMS_READ_OPERATIONS)[number],
    input: WpFormsOperationInput,
  ): JsonObject {
    if (operation === "forms.list") {
      this.requireOnly(input, ["status", "limit", "offset"]);
      return {
        status: this.enumValue(
          input.status,
          "status",
          ["publish", "draft", "trash"],
          "publish",
        ),
        limit: this.integer(input.limit, "limit", 1, 25, 20),
        offset: this.integer(input.offset, "offset", 0, 10_000, 0),
      };
    }
    if (operation === "forms.get") {
      this.requireOnly(input, ["formId"]);
      return { form_id: this.id(input.formId, "formId"), include_fields: true };
    }
    if (operation === "form-stats.get") {
      this.requireOnly(input, ["formId"]);
      return { form_id: this.id(input.formId, "formId") };
    }
    if (operation === "entry-summaries.list") {
      this.requireOnly(input, ["formId", "status", "type", "limit", "offset"]);
      return {
        form_id: this.id(input.formId, "formId"),
        status: this.enumValue(
          input.status,
          "status",
          ["", "partial", "abandoned", "spam", "trash"],
          "",
        ),
        type: this.enumValue(
          input.type,
          "type",
          ["", "read", "unread", "starred"],
          "",
        ),
        include_fields: false,
        limit: this.integer(input.limit, "limit", 1, 25, 20),
        offset: this.integer(input.offset, "offset", 0, 10_000, 0),
      };
    }
    this.requireOnly(input, ["entryId"]);
    return {
      entry_id: this.id(input.entryId, "entryId"),
      include_fields: true,
    };
  }

  private async request(
    credentials: WpFormsCredentials,
    operation: (typeof WPFORMS_READ_OPERATIONS)[number],
    parameters: JsonObject,
  ) {
    this.requireCredentials(credentials);
    const root = await this.apiRoot(credentials.siteUrl);
    const ability = ABILITY_BY_OPERATION[operation];
    const url = new URL(`abilities/wpforms/${ability}/run`, root);
    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(`input[${key}]`, String(value));
    }
    if (
      url.protocol !== "https:" ||
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      throw new WpFormsApiError(
        "policy_blocked",
        "WPForms requests must stay on the configured site's HTTPS WordPress Abilities API route.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.applicationPassword}`).toString("base64")}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof WpFormsApiError) throw error;
      throw new WpFormsApiError(
        "provider_unavailable",
        "The configured WPForms site could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000) {
      throw this.invalid("WPForms response exceeds Relay's 2.5 MB limit.");
    }
    const data = this.redact(this.parse(raw));
    if (!response.ok) {
      throw new WpFormsApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `WPForms returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return operation === "entries.get" ? this.entry(data) : data;
  }

  private async apiRoot(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.invalid("Enter a valid WPForms site URL.");
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
      throw new WpFormsApiError(
        "policy_blocked",
        "WPForms requires a public HTTPS site URL without embedded credentials, ports, query, or fragment.",
        403,
      );
    }
    await this.requirePublicHost(url.hostname);
    const sitePath = url.pathname.replace(/\/+$/, "");
    return new URL(`${url.origin}${sitePath}/wp-json/wp-abilities/v1/`);
  }

  private async requirePublicHost(hostname: string) {
    if (isIP(hostname) && this.isPrivateAddress(hostname)) {
      throw new WpFormsApiError(
        "policy_blocked",
        "WPForms site URL cannot use a private or local address.",
        403,
      );
    }
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new WpFormsApiError(
        "provider_unavailable",
        "WPForms site hostname could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some((item) => this.isPrivateAddress(item.address))
    ) {
      throw new WpFormsApiError(
        "policy_blocked",
        "WPForms site hostname must resolve only to public addresses.",
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
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part)))
      return true;
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

  private entry(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    return Object.fromEntries(
      Object.entries(body).filter(
        ([key]) => !["ip_address", "user_ip", "user_agent"].includes(key),
      ),
    );
  }

  private id(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    const number = Number(text);
    if (!/^[1-9]\d{0,18}$/.test(text) || !Number.isSafeInteger(number)) {
      throw this.invalid(`WPForms ${name} must be a positive integer.`);
    }
    return number;
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

  private enumValue(
    value: unknown,
    name: string,
    allowed: readonly string[],
    fallback: string,
  ) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !allowed.includes(value)) {
      throw this.invalid(`${name} is not supported for this operation.`);
    }
    return value;
  }

  private requireOnly(
    input: WpFormsOperationInput,
    allowed: readonly string[],
  ) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key))) {
      throw this.invalid(
        "WPForms input contains fields unsupported by the selected operation.",
      );
    }
  }

  private rejectUnknownInput(input: WpFormsOperationInput) {
    const allowed = new Set([
      "formId",
      "entryId",
      "status",
      "type",
      "limit",
      "offset",
    ]);
    if (Object.keys(input).some((key) => !allowed.has(key))) {
      throw new WpFormsApiError(
        "policy_blocked",
        "WPForms accepts only pinned operation inputs.",
        403,
      );
    }
  }

  private requireCredentials(credentials: WpFormsCredentials) {
    for (const [name, value] of [
      ["WordPress username", credentials.username],
      ["WordPress Application Password", credentials.applicationPassword],
    ] as const) {
      if (!value || value.length > 16_000 || /[\r\n:]/.test(value)) {
        throw new WpFormsApiError(
          "credential_missing",
          `A valid WPForms ${name} is required.`,
          401,
        );
      }
    }
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
      return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
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
    return new WpFormsApiError("provider_validation_error", message, 400);
  }
}
