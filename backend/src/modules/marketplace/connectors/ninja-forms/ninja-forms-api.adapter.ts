import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type NinjaFormsCredentials = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
};
export type NinjaFormsOperationInput = {
  formId?: unknown;
  submissionId?: unknown;
  title?: unknown;
  limit?: unknown;
  format?: unknown;
};

export const NINJA_FORMS_READ_OPERATIONS = [
  "forms.list",
  "forms.get",
  "field-types.list",
  "calculations.list",
  "submission-fields.get",
] as const;

const ABILITY_BY_OPERATION: Record<
  (typeof NINJA_FORMS_READ_OPERATIONS)[number],
  string
> = {
  "forms.list": "list-forms",
  "forms.get": "get-form",
  "field-types.list": "list-field-types",
  "calculations.list": "list-calculations",
  "submission-fields.get": "get-submission-fields",
};

export class NinjaFormsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class NinjaFormsApiAdapter {
  health(credentials: NinjaFormsCredentials) {
    return this.request(credentials, "forms.list", {
      include_fields: false,
      include_actions: false,
      limit: 1,
    });
  }

  read(
    credentials: NinjaFormsCredentials,
    operation: string,
    input: NinjaFormsOperationInput,
  ) {
    this.rejectUnknownInput(input);
    if (!NINJA_FORMS_READ_OPERATIONS.includes(operation as never)) {
      throw this.invalid(
        "Ninja Forms operation is not in Relay's pinned read-only contract.",
      );
    }
    const typedOperation =
      operation as (typeof NINJA_FORMS_READ_OPERATIONS)[number];
    return this.request(
      credentials,
      typedOperation,
      this.abilityInput(typedOperation, input),
    );
  }

  private abilityInput(
    operation: (typeof NINJA_FORMS_READ_OPERATIONS)[number],
    input: NinjaFormsOperationInput,
  ): JsonObject {
    if (operation === "forms.list") {
      this.requireOnly(input, ["title", "limit"]);
      const title = this.optionalText(input.title, "title", 200);
      return {
        ...(title ? { title } : {}),
        include_fields: true,
        include_actions: false,
        limit: this.integer(input.limit, "limit", 1, 25, 20),
      };
    }
    if (operation === "forms.get") {
      this.requireOnly(input, ["formId"]);
      return {
        form_id: this.id(input.formId, "formId"),
        include_fields: true,
        include_actions: false,
        include_calculations: true,
      };
    }
    if (operation === "field-types.list") {
      this.requireOnly(input, ["format"]);
      const format = input.format === undefined ? "simple" : input.format;
      if (format !== "simple" && format !== "detailed") {
        throw this.invalid("format must be simple or detailed.");
      }
      return { format };
    }
    if (operation === "calculations.list") {
      this.requireOnly(input, ["formId"]);
      return { form_id: this.id(input.formId, "formId") };
    }
    this.requireOnly(input, ["submissionId"]);
    return {
      submission_id: this.id(input.submissionId, "submissionId"),
      include_labels: true,
    };
  }

  private async request(
    credentials: NinjaFormsCredentials,
    operation: (typeof NINJA_FORMS_READ_OPERATIONS)[number],
    parameters: JsonObject,
  ) {
    this.requireCredentials(credentials);
    const root = await this.apiRoot(credentials.siteUrl);
    const ability = ABILITY_BY_OPERATION[operation];
    const url = new URL(`ninjaforms/${ability}/run`, root);
    if (
      url.protocol !== "https:" ||
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      throw new NinjaFormsApiError(
        "policy_blocked",
        "Ninja Forms requests must stay on the configured site's HTTPS WordPress Abilities API route.",
        403,
      );
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.applicationPassword}`).toString("base64")}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body: JSON.stringify({ input: parameters }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof NinjaFormsApiError) throw error;
      throw new NinjaFormsApiError(
        "provider_unavailable",
        "The configured Ninja Forms site could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000) {
      throw this.invalid("Ninja Forms response exceeds Relay's 2.5 MB limit.");
    }
    const data = this.redact(this.parse(raw));
    if (!response.ok) {
      throw new NinjaFormsApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Ninja Forms returned HTTP ${response.status}.`,
        response.status,
      );
    }
    if (operation === "forms.list") return this.formList(data);
    if (operation === "forms.get") return this.formSchema(data);
    return data;
  }

  private async apiRoot(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.invalid("Enter a valid Ninja Forms site URL.");
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
      throw new NinjaFormsApiError(
        "policy_blocked",
        "Ninja Forms requires a public HTTPS site URL without embedded credentials, ports, query, or fragment.",
        403,
      );
    }
    await this.requirePublicHost(url.hostname);
    const sitePath = url.pathname.replace(/\/+$/, "");
    return new URL(`${url.origin}${sitePath}/wp-json/wp-abilities/v1/`);
  }

  private async requirePublicHost(hostname: string) {
    if (isIP(hostname) && this.isPrivateAddress(hostname)) {
      throw new NinjaFormsApiError(
        "policy_blocked",
        "Ninja Forms site URL cannot use a private or local address.",
        403,
      );
    }
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new NinjaFormsApiError(
        "provider_unavailable",
        "Ninja Forms site hostname could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some((item) => this.isPrivateAddress(item.address))
    ) {
      throw new NinjaFormsApiError(
        "policy_blocked",
        "Ninja Forms site hostname must resolve only to public addresses.",
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

  private formList(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    const forms = Array.isArray(body.forms)
      ? body.forms.slice(0, 25).map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item))
            return null;
          const form = item as JsonObject;
          return {
            id: form.id,
            title: form.title,
            created_at: form.created_at,
            field_count: form.field_count,
          };
        })
      : [];
    return {
      success: body.success,
      forms,
      count: body.count,
      message: body.message,
    };
  }

  private formSchema(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    const form =
      body.form && typeof body.form === "object" && !Array.isArray(body.form)
        ? (body.form as JsonObject)
        : body;
    const fields = Array.isArray(form.fields)
      ? form.fields.slice(0, 250).map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item))
            return null;
          const field = item as JsonObject;
          return Object.fromEntries(
            ["id", "key", "label", "type", "required", "options"]
              .filter((key) => field[key] !== undefined)
              .map((key) => [key, field[key]]),
          );
        })
      : [];
    return {
      success: body.success,
      form: {
        id: form.id ?? body.form_id,
        title: form.title,
        created_at: form.created_at,
        fields,
        calculations: Array.isArray(form.calculations)
          ? form.calculations.slice(0, 250)
          : [],
      },
      message: body.message,
    };
  }

  private id(value: unknown, name: string) {
    const text = String(value ?? "").trim();
    const number = Number(text);
    if (!/^[1-9]\d{0,18}$/.test(text) || !Number.isSafeInteger(number)) {
      throw this.invalid(`Ninja Forms ${name} must be a positive integer.`);
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

  private optionalText(value: unknown, name: string, maxLength: number) {
    if (value === undefined) return null;
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > maxLength ||
      /[\r\n]/.test(value)
    ) {
      throw this.invalid(`${name} must be a non-empty single-line string.`);
    }
    return value.trim();
  }

  private requireOnly(
    input: NinjaFormsOperationInput,
    allowed: readonly string[],
  ) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key))) {
      throw this.invalid(
        "Ninja Forms input contains fields unsupported by the selected operation.",
      );
    }
  }

  private rejectUnknownInput(input: NinjaFormsOperationInput) {
    const allowed = new Set([
      "formId",
      "submissionId",
      "title",
      "limit",
      "format",
    ]);
    if (Object.keys(input).some((key) => !allowed.has(key))) {
      throw new NinjaFormsApiError(
        "policy_blocked",
        "Ninja Forms accepts only pinned operation inputs.",
        403,
      );
    }
  }

  private requireCredentials(credentials: NinjaFormsCredentials) {
    for (const [name, value] of [
      ["WordPress username", credentials.username],
      ["WordPress Application Password", credentials.applicationPassword],
    ] as const) {
      if (!value || value.length > 16_000 || /[\r\n:]/.test(value)) {
        throw new NinjaFormsApiError(
          "credential_missing",
          `A valid Ninja Forms ${name} is required.`,
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
    return new NinjaFormsApiError("provider_validation_error", message, 400);
  }
}
