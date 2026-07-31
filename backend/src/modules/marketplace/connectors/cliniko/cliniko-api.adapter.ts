import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PATCH" | "DELETE";
type ClinikoCredentials = { apiKey: string };

const READ_OPERATIONS = new Set<string>([
  "GET /appointment_types",
  "GET /appointment_types/{id}",
  "GET /practitioners/{practitioner_id}/appointment_types",
  "GET /appointment_type_billable_items",
  "GET /appointment_type_billable_items/{id}",
  "GET /appointment_type_products",
  "GET /appointment_type_products/{id}",
  "GET /attendees",
  "GET /attendees/{id}",
  "GET /availability_blocks",
  "GET /availability_blocks/{id}",
  "GET /businesses/{business_id}/practitioners/{practitioner_id}/appointment_types/{appointment_type_id}/available_times",
  "GET /businesses/{business_id}/practitioners/{practitioner_id}/appointment_types/{appointment_type_id}/next_available_time",
  "GET /billable_items",
  "GET /billable_items/{id}",
  "GET /bookings",
  "GET /bookings/{id}",
  "GET /businesses",
  "GET /businesses/{id}",
  "GET /communications",
  "GET /communications/{id}",
  "GET /concession_prices",
  "GET /concession_prices/{id}",
  "GET /concession_types",
  "GET /concession_types/{id}",
  "GET /contacts",
  "GET /contacts/{id}",
  "GET /daily_availabilities",
  "GET /daily_availabilities/{id}",
  "GET /businesses/{business_id}/daily_availabilities",
  "GET /practitioners/{practitioner_id}/daily_availabilities",
  "GET /group_appointments",
  "GET /group_appointments/{id}",
  "GET /group_appointments/{id}/conflicts",
  "GET /individual_appointments",
  "GET /individual_appointments/{id}",
  "GET /individual_appointments/{id}/conflicts",
  "GET /invoices",
  "GET /invoices/{id}",
  "GET /appointments/{appointment_id}/invoices",
  "GET /patient_cases/{patient_case_id}/invoices",
  "GET /invoice_items",
  "GET /invoice_items/{id}",
  "GET /medical_alerts",
  "GET /medical_alerts/{id}",
  "GET /patients",
  "GET /patients/{id}",
  "GET /patient_attachments",
  "GET /patient_attachments/{id}",
  "GET /patient_cases/{patient_case_id}/patient_attachments",
  "GET /patient_cases",
  "GET /patient_cases/active",
  "GET /patient_cases/{id}",
  "GET /patient_forms",
  "GET /patient_forms/{id}",
  "GET /patient_form_templates",
  "GET /patient_form_templates/{id}",
  "GET /practitioners",
  "GET /practitioners/inactive",
  "GET /practitioners/{id}",
  "GET /appointment_types/{appointment_type_id}/practitioners",
  "GET /businesses/{business_id}/practitioners",
  "GET /appointment_types/{appointment_type_id}/practitioners/inactive",
  "GET /businesses/{business_id}/practitioners/inactive",
  "GET /practitioner_reference_numbers",
  "GET /practitioner_reference_numbers/{id}",
  "GET /products",
  "GET /products/{id}",
  "GET /product_suppliers",
  "GET /product_suppliers/{id}",
  "GET /settings/public",
  "GET /recalls",
  "GET /recalls/{id}",
  "GET /recall_types",
  "GET /recall_types/{id}",
  "GET /referral_sources",
  "GET /patients/{patient_id}/referral_source",
  "GET /referral_source_types",
  "GET /referral_source_types/{id}",
  "GET /relationships",
  "GET /relationships/{id}",
  "GET /services",
  "GET /businesses/{business_id}/services",
  "GET /settings",
  "GET /patient_forms/{patient_form_id}/signatures/{id}",
  "GET /stock_adjustments",
  "GET /stock_adjustments/{id}",
  "GET /taxes",
  "GET /taxes/{id}",
  "GET /treatment_notes",
  "GET /treatment_notes/{id}",
  "GET /patients/{patient_id}/treatment_notes",
  "GET /treatment_note_templates",
  "GET /treatment_note_templates/{id}",
  "GET /unavailable_blocks",
  "GET /unavailable_blocks/{id}",
  "GET /unavailable_blocks/{id}/conflicts",
  "GET /unavailable_block_types",
  "GET /unavailable_block_types/{id}",
  "GET /user",
  "GET /users",
  "GET /users/{id}",
]);
const MANAGE_OPERATIONS = new Set<string>([
  "POST /appointment_types",
  "PATCH /appointment_types/{id}",
  "POST /appointment_types/{id}/archive",
  "POST /appointment_type_billable_items",
  "PATCH /appointment_type_billable_items/{id}",
  "DELETE /appointment_type_billable_items/{id}",
  "POST /appointment_type_products",
  "PATCH /appointment_type_products/{id}",
  "DELETE /appointment_type_products/{id}",
  "POST /attendees",
  "PATCH /attendees/{id}",
  "POST /attendees/{id}/archive",
  "PATCH /attendees/{id}/cancel",
  "POST /availability_blocks",
  "POST /billable_items",
  "PATCH /billable_items/{id}",
  "POST /billable_items/{id}/archive",
  "POST /businesses",
  "PATCH /businesses/{id}",
  "POST /businesses/{id}/archive",
  "POST /businesses/{id}/unarchive",
  "POST /communications",
  "PATCH /communications/{id}",
  "POST /communications/{id}/archive",
  "POST /concession_prices",
  "PATCH /concession_prices/{id}",
  "POST /concession_types",
  "PATCH /concession_types/{id}",
  "POST /contacts",
  "PATCH /contacts/{id}",
  "POST /contacts/{id}/archive",
  "POST /group_appointments",
  "PATCH /group_appointments/{id}",
  "POST /group_appointments/{id}/archive",
  "POST /individual_appointments",
  "PATCH /individual_appointments/{id}",
  "POST /individual_appointments/{id}/archive",
  "PATCH /individual_appointments/{id}/cancel",
  "POST /medical_alerts",
  "PATCH /medical_alerts/{id}",
  "DELETE /medical_alerts/{id}",
  "POST /patients",
  "PATCH /patients/{id}",
  "POST /patients/{id}/archive",
  "POST /patients/{id}/unarchive",
  "PATCH /patient_attachments/{id}",
  "POST /patient_attachments/{id}/archive",
  "POST /patient_cases",
  "PATCH /patient_cases/{id}",
  "POST /patient_cases/{id}/archive",
  "POST /patient_forms",
  "PATCH /patient_forms/{id}",
  "POST /patient_forms/{id}/archive",
  "POST /patient_form_templates",
  "PATCH /patient_form_templates/{id}",
  "POST /patient_form_templates/{id}/archive",
  "POST /practitioner_reference_numbers",
  "PATCH /practitioner_reference_numbers/{id}",
  "DELETE /practitioner_reference_numbers/{id}",
  "POST /products",
  "PATCH /products/{id}",
  "POST /products/{id}/archive",
  "POST /product_suppliers",
  "PATCH /product_suppliers/{id}",
  "DELETE /product_suppliers/{id}",
  "POST /recalls",
  "PATCH /recalls/{id}",
  "POST /recalls/{id}/archive",
  "POST /recall_types",
  "PATCH /recall_types/{id}",
  "POST /recall_types/{id}/archive",
  "PATCH /patients/{patient_id}/referral_source",
  "POST /relationships",
  "PATCH /relationships/{id}",
  "POST /relationships/{id}/archive",
  "POST /stock_adjustments",
  "POST /taxes",
  "PATCH /taxes/{id}",
  "DELETE /taxes/{id}",
  "POST /treatment_notes",
  "PATCH /treatment_notes/{id}",
  "POST /treatment_notes/{id}/archive",
  "POST /treatment_notes/{id}/unarchive",
  "POST /treatment_note_templates",
  "PATCH /treatment_note_templates/{id}",
  "POST /treatment_note_templates/{id}/archive",
  "POST /unavailable_blocks",
  "PATCH /unavailable_blocks/{id}",
  "POST /unavailable_blocks/{id}/archive",
  "POST /unavailable_block_types",
  "PATCH /unavailable_block_types/{id}",
  "POST /unavailable_block_types/{id}/archive",
]);
const ID_SEGMENT = "[1-9][0-9]{0,19}";

export class ClinikoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ClinikoApiAdapter {
  health(credentials: ClinikoCredentials) {
    return this.request(credentials, { method: "GET", path: "/user" });
  }

  read(credentials: ClinikoCredentials, input: JsonObject) {
    const path = this.path(input.path);
    if (!this.allowed(READ_OPERATIONS, "GET", path)) {
      throw this.validation("Cliniko read endpoint is not supported.");
    }
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: ClinikoCredentials, input: JsonObject) {
    const method = this.required(
      input.method,
      "method",
      10,
    ).toUpperCase() as Method;
    const path = this.path(input.path);
    if (!this.allowed(MANAGE_OPERATIONS, method, path)) {
      throw this.validation("Cliniko mutation endpoint is not supported.");
    }
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  async uploadAttachment(credentials: ClinikoCredentials, input: JsonObject) {
    const patientId = this.required(input.patientId, "patientId", 20);
    if (!new RegExp(`^${ID_SEGMENT}$`).test(patientId)) {
      throw this.validation("Cliniko patientId is invalid.");
    }
    const fileName = this.required(input.fileName, "fileName", 200);
    if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,199}$/.test(fileName)) {
      throw this.validation("Cliniko attachment file name is invalid.");
    }
    const contentType = this.required(input.contentType, "contentType", 100);
    if (
      !new Set([
        "application/pdf",
        "image/jpeg",
        "image/png",
        "text/plain",
      ]).has(contentType)
    ) {
      throw this.validation("Cliniko attachment type is not supported.");
    }
    const bytes = Buffer.from(
      this.required(input.fileBase64, "fileBase64", 35_000_000),
      "base64",
    );
    if (!bytes.length || bytes.byteLength > 25_000_000) {
      throw this.validation(
        "Cliniko attachment must be between 1 byte and 25 MB.",
      );
    }
    const presign = await this.request(credentials, {
      method: "GET",
      path: `/patients/${patientId}/attachment_presigned_post`,
      redact: false,
    });
    const record = this.object(presign);
    const uploadUrl = this.httpsS3Url(
      this.required(record?.url, "upload URL", 2_000),
    );
    const fields = this.object(record?.fields);
    if (!fields || Object.keys(fields).length > 30) {
      throw this.validation("Cliniko attachment upload fields are invalid.");
    }
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (
        !/^[A-Za-z0-9_.-]{1,100}$/.test(key) ||
        typeof value !== "string" ||
        value.length > 20_000
      ) {
        throw this.validation("Cliniko attachment upload field is invalid.");
      }
      form.set(key, value);
    }
    form.set(
      "file",
      new Blob([new Uint8Array(bytes)], { type: contentType }),
      fileName,
    );
    const uploaded = await safeConnectorFetch(uploadUrl, {
      method: "POST",
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    const xml = (await uploaded.text()).slice(0, 100_000);
    if (!uploaded.ok) {
      throw new ClinikoApiError(
        "provider_validation_error",
        "Cliniko attachment upload was rejected.",
        uploaded.status,
      );
    }
    const location = /<Location>([^<]+)<\/Location>/i.exec(xml)?.[1];
    if (!location)
      throw this.validation("Cliniko attachment upload response is invalid.");
    const storedUrl = this.httpsS3Url(this.decodeXml(location));
    if (storedUrl.origin !== uploadUrl.origin) {
      throw this.validation("Cliniko attachment upload origin changed.");
    }
    return this.request(credentials, {
      method: "POST",
      path: "/patient_attachments",
      json: {
        patient_id: patientId,
        upload_url: storedUrl.toString(),
        ...(typeof input.description === "string" && input.description.trim()
          ? { description: input.description.trim().slice(0, 5_000) }
          : {}),
      },
    });
  }

  private async request(
    credentials: ClinikoCredentials,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
      redact?: boolean;
    },
  ) {
    const authority = this.authority(credentials.apiKey);
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`${authority.origin}/v1${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${authority.apiKey}:`).toString("base64")}`,
      "User-Agent": "Relay Console (support@relayconsole.work)",
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000)
        throw this.validation("Cliniko request exceeds 2 MB.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: input.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 10_000_000)
        throw this.validation("Cliniko response exceeds 10 MB.");
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      if (input.redact !== false) data = this.redact(data);
      if (!response.ok) {
        throw new ClinikoApiError(
          this.code(response.status),
          this.message(data) ?? `Cliniko returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof ClinikoApiError) throw error;
      throw new ClinikoApiError(
        "provider_unavailable",
        "Cliniko could not be reached.",
        502,
      );
    }
  }

  private authority(value: string) {
    const apiKey = String(value ?? "").trim();
    const match = /^([A-Za-z0-9]{20,256})(?:-([a-z]{2}\d{1,2}))?$/i.exec(
      apiKey,
    );
    if (!match)
      throw new ClinikoApiError(
        "credential_missing",
        "A valid Cliniko API key is required.",
        401,
      );
    const shard = (match[2] ?? "au1").toLowerCase();
    return { apiKey, shard, origin: `https://api.${shard}.cliniko.com` };
  }

  private path(value: unknown) {
    const path = this.required(value, "path", 500);
    if (
      !/^\/[A-Za-z0-9_{}\/-]+$/.test(path) ||
      path.includes("..") ||
      path.includes("//")
    ) {
      throw this.validation("Cliniko path is invalid.");
    }
    return path;
  }

  private allowed(operations: Set<string>, method: Method, path: string) {
    for (const operation of operations) {
      const [allowedMethod, template] = operation.split(" ", 2);
      if (allowedMethod !== method) continue;
      const pattern = `^${template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{[^}]+\\\}/g, ID_SEGMENT)}$`;
      if (new RegExp(pattern).test(path)) return true;
    }
    return false;
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 40)
      throw this.validation("Cliniko query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_:[\].-]{1,100}$/.test(key))
        throw this.validation("Cliniko query field is invalid.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.validation("Cliniko query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("Cliniko query value is invalid.");
        params.append(key, String(child).slice(0, 10_000));
      }
    }
  }

  private httpsS3Url(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.validation("Cliniko attachment storage URL is invalid.");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !/(?:^|\.)s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(url.hostname)
    ) {
      throw this.validation("Cliniko attachment storage URL is invalid.");
    }
    return url;
  }

  private decodeXml(value: string) {
    return value
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }
  private required(value: unknown, label: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`Cliniko ${label} is invalid.`);
    return value.trim();
  }
  private rejectSecrets(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new ClinikoApiError(
          "policy_blocked",
          "Cliniko request is too deeply nested.",
        );
      if (Array.isArray(item)) {
        if (item.length > 1_000)
          throw new ClinikoApiError(
            "policy_blocked",
            "Cliniko request array is too large.",
          );
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1_000)
        throw new ClinikoApiError(
          "policy_blocked",
          "Cliniko request object is too large.",
        );
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new ClinikoApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key|signing.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }
  private message(value: unknown) {
    if (typeof value === "string") return value.slice(0, 500);
    const object = this.object(value);
    const candidate = object?.message ?? object?.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 400 && status < 500) return "provider_validation_error";
    return "provider_unavailable";
  }
  private validation(message: string) {
    return new ClinikoApiError("provider_validation_error", message, 400);
  }
}

export type { ClinikoCredentials };
