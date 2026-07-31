import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type AirtableFormsOperationInput = { baseId?: unknown };
export const AIRTABLE_FORMS_READ_OPERATIONS = ["forms.list"] as const;

export class AirtableFormsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AirtableFormsApiAdapter {
  health(accessToken: string, baseId: string) {
    return this.read(accessToken, "forms.list", { baseId });
  }

  read(
    accessToken: string,
    operation: string,
    input: AirtableFormsOperationInput,
  ) {
    this.requireToken(accessToken);
    if (
      !AIRTABLE_FORMS_READ_OPERATIONS.includes(operation as never) ||
      Object.keys(input).some((key) => key !== "baseId")
    )
      throw new AirtableFormsApiError(
        "policy_blocked",
        "Airtable Forms accepts only Relay's pinned form-index operation.",
        403,
      );
    return this.request(accessToken, this.baseId(input.baseId));
  }

  private async request(accessToken: string, baseId: string) {
    const root = new URL("https://api.airtable.com/v0/meta/bases/");
    const url = new URL(`${baseId}/views`, root);
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
      throw new AirtableFormsApiError(
        "policy_blocked",
        "Airtable Forms requests must stay on the HTTPS metadata API route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AirtableFormsApiError(
        "provider_unavailable",
        "Airtable could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Airtable response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new AirtableFormsApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Airtable returned HTTP ${response.status}.`,
        response.status,
      );
    return this.minimize(data, baseId);
  }

  private minimize(value: unknown, baseId: string) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { baseId, forms: [], count: 0, truncated: false };
    const views = Array.isArray((value as JsonObject).views)
      ? ((value as JsonObject).views as unknown[])
      : [];
    const formViews = views.filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        (entry as JsonObject).type === "form",
    );
    const forms = formViews.slice(0, 50).map((entry) => {
      const item = entry as JsonObject;
      return { id: item.id, name: item.name, type: "form" };
    });
    return {
      baseId,
      forms,
      count: forms.length,
      truncated: formViews.length > forms.length,
    };
  }

  private requireToken(token: string) {
    if (!token || token.length > 16_000 || /[\r\n]/.test(token))
      throw new AirtableFormsApiError(
        "credential_missing",
        "A valid Airtable OAuth access token is required.",
        401,
      );
  }

  private baseId(value: unknown) {
    const id = String(value ?? "");
    if (!/^app[A-Za-z0-9]{14}$/.test(id))
      throw this.invalid("baseId must be a valid Airtable base ID.");
    return id;
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
      return value.slice(0, 5_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 10_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|personalForUserId|email|url)/i.test(
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
    const error =
      body.error && typeof body.error === "object" && !Array.isArray(body.error)
        ? (body.error as JsonObject)
        : {};
    const candidate = error.message ?? body.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new AirtableFormsApiError("provider_validation_error", message, 400);
  }
}
