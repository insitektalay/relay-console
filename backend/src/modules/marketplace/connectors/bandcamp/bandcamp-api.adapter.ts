import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
export type BandcampCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};
const OPERATIONS = {
  "my-bands": { path: "/api/account/1/my_bands", mutation: false },
  "sales-report": { path: "/api/sales/4/sales_report", mutation: false },
  "generate-sales-report": {
    path: "/api/sales/2/generate_sales_report",
    mutation: true,
  },
  "fetch-sales-report": {
    path: "/api/sales/4/fetch_sales_report",
    mutation: false,
  },
  "get-merch-details": {
    path: "/api/merchorders/1/get_merch_details",
    mutation: false,
  },
  "get-shipping-origins": {
    path: "/api/merchorders/1/get_shipping_origin_details",
    mutation: false,
  },
  "get-orders": { path: "/api/merchorders/4/get_orders", mutation: false },
  "update-shipped": {
    path: "/api/merchorders/2/update_shipped",
    mutation: true,
  },
  "mark-date-range-shipped": {
    path: "/api/merchorders/1/mark_date_range_as_shipped",
    mutation: true,
  },
  "update-quantities": {
    path: "/api/merchorders/1/update_quantities",
    mutation: true,
  },
  "update-sku": { path: "/api/merchorders/1/update_sku", mutation: true },
} as const;
export const BANDCAMP_READ_OPERATIONS = Object.entries(OPERATIONS)
  .filter(([, v]) => !v.mutation)
  .map(([k]) => k);
export const BANDCAMP_MUTATION_OPERATIONS = Object.entries(OPERATIONS)
  .filter(([, v]) => v.mutation)
  .map(([k]) => k);
export class BandcampApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
@Injectable()
export class BandcampApiAdapter {
  private readonly cache = new Map<
    string,
    { token: string; expiresAt: number }
  >();
  health(credentials: BandcampCredentials) {
    return this.read(credentials, "my-bands", {});
  }
  read(credentials: BandcampCredentials, id: string, input: JsonObject) {
    const operation = this.operation(id);
    if (operation.mutation)
      throw this.invalid("Bandcamp read accepts query operations only.");
    return this.request(credentials, operation.path, input);
  }
  manage(credentials: BandcampCredentials, id: string, input: JsonObject) {
    const operation = this.operation(id);
    if (!operation.mutation)
      throw this.invalid("Bandcamp manage accepts mutation operations only.");
    return this.request(credentials, operation.path, input);
  }
  private async request(
    credentials: BandcampCredentials,
    path: string,
    input: JsonObject,
  ) {
    this.rejectSecrets(input);
    const token = await this.token(credentials);
    const rawBody = JSON.stringify(input);
    if (Buffer.byteLength(rawBody) > 2_000_000)
      throw this.invalid("Bandcamp request exceeds 2 MB.");
    try {
      const response = await safeConnectorFetch(new URL(path, "https://bandcamp.com"), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: rawBody,
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 10_000_000)
        throw this.invalid("Bandcamp response exceeds 10 MB.");
      const data = this.redact(this.parse(raw));
      const apiError =
        data &&
        typeof data === "object" &&
        ((data as JsonObject).error === true ||
          (data as JsonObject).ok === false);
      if (!response.ok || apiError)
        throw new BandcampApiError(
          this.code(response.status),
          this.message(data) ?? `Bandcamp returned HTTP ${response.status}.`,
          response.status || 400,
        );
      return {
        data,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof BandcampApiError) throw error;
      throw new BandcampApiError(
        "provider_unavailable",
        "Bandcamp could not be reached.",
        502,
      );
    }
  }
  private async token(credentials: BandcampCredentials) {
    const clientId = this.credential(credentials.clientId, "client ID");
    const secret = this.credential(credentials.clientSecret, "client secret");
    const refresh = this.credential(credentials.refreshToken, "refresh token");
    const key = createHash("sha256")
      .update(`${clientId}\0${refresh}`)
      .digest("hex");
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: secret,
      refresh_token: refresh,
    });
    try {
      const response = await safeConnectorFetch("https://bandcamp.com/oauth_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const data = this.object(
        this.parse(Buffer.from(await response.arrayBuffer())),
      );
      if (!response.ok)
        throw new BandcampApiError(
          "token_refresh_failed",
          this.message(data) ?? "Bandcamp rejected the refresh token.",
          response.status,
        );
      const token =
        typeof data?.access_token === "string" ? data.access_token : "";
      if (!token)
        throw new BandcampApiError(
          "token_refresh_failed",
          "Bandcamp returned no access token.",
          502,
        );
      const expires = Number(data?.expires_in ?? 3600);
      this.cache.set(key, {
        token,
        expiresAt: Date.now() + Math.max(60, Math.min(expires, 3600)) * 1000,
      });
      return token;
    } catch (error) {
      if (error instanceof BandcampApiError) throw error;
      throw new BandcampApiError(
        "provider_unavailable",
        "Bandcamp token service could not be reached.",
        502,
      );
    }
  }
  private operation(id: string) {
    const operation = (
      OPERATIONS as Record<string, { path: string; mutation: boolean }>
    )[id];
    if (!operation)
      throw this.invalid("Bandcamp operation is not in the pinned registry.");
    return operation;
  }
  private credential(value: string, label: string) {
    const text = value?.trim();
    if (!text || text.length > 20_000 || /[\r\n]/.test(text))
      throw new BandcampApiError(
        "credential_missing",
        `Bandcamp ${label} is missing.`,
        401,
      );
    return text;
  }
  private rejectSecrets(value: unknown, depth = 0) {
    if (depth > 12)
      throw new BandcampApiError(
        "policy_blocked",
        "Bandcamp input is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((child) => this.rejectSecrets(child, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|password|cookie|authorization|credential|api.?key)/i.test(
          key,
        )
      )
        throw new BandcampApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectSecrets(child, depth + 1);
    }
  }
  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { response: raw.toString("utf8").slice(0, 100_000) };
    }
  }
  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value))
      return value
        .slice(0, 5_000)
        .map((child) => this.redact(child, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 500_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 5_000)
        .map(([key, child]) => [
          key,
          /(token|secret|password|cookie|authorization)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }
  private message(value: unknown) {
    const object = this.object(value);
    const message =
      object?.error_message ?? object?.error_description ?? object?.error;
    return typeof message === "string" ? message.slice(0, 500) : null;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new BandcampApiError("provider_validation_error", message, 400);
  }
}
