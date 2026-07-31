import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type ReportWindow = "today" | "yesterday" | "this_week" | "this_month";

export type MatomoSelfHostedCredentials = {
  installationUrl: string;
  tokenAuth: string;
  siteId: number;
};

export class MatomoSelfHostedApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MatomoSelfHostedApiAdapter {
  async health(credentials: MatomoSelfHostedCredentials) {
    await this.summary(credentials, { window: "today" });
    return { siteId: credentials.siteId };
  }

  summary(credentials: MatomoSelfHostedCredentials, input: JsonObject) {
    return this.report(credentials, "VisitsSummary.get", input, false);
  }

  topPages(credentials: MatomoSelfHostedCredentials, input: JsonObject) {
    return this.report(credentials, "Actions.getPageUrls", input, true);
  }

  referrerTypes(credentials: MatomoSelfHostedCredentials, input: JsonObject) {
    return this.report(credentials, "Referrers.getReferrerType", input, true);
  }

  countries(credentials: MatomoSelfHostedCredentials, input: JsonObject) {
    return this.report(credentials, "UserCountry.getCountry", input, true);
  }

  private async report(
    credentials: MatomoSelfHostedCredentials,
    method: string,
    input: JsonObject,
    table: boolean,
  ) {
    this.assertCredentials(credentials);
    const endpoint = await this.endpoint(credentials.installationUrl);
    const window = this.window(input.window);
    const limit = table ? this.integer(input.limit, 1, 20, 10) : 1;
    const form = new URLSearchParams({
      module: "API",
      method,
      idSite: String(credentials.siteId),
      period: window.period,
      date: window.date,
      format: "JSON",
      format_metrics: "0",
      showMetadata: "0",
      filter_limit: String(limit),
      ...(method === "Actions.getPageUrls" ? { flat: "1" } : {}),
      token_auth: credentials.tokenAuth,
    });
    let response: Response;
    try {
      response = await safeConnectorFetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "RelayConsole/1.0",
        },
        body: form.toString(),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof MatomoSelfHostedApiError) throw error;
      throw new MatomoSelfHostedApiError(
        "provider_unavailable",
        "Matomo Self-Hosted could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 262_144)
      throw new MatomoSelfHostedApiError(
        "provider_validation_error",
        "Matomo Self-Hosted response exceeded the 256 KiB Relay limit.",
      );
    let parsed: unknown;
    try {
      parsed = raw.byteLength ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      throw new MatomoSelfHostedApiError(
        response.ok ? "provider_unavailable" : this.safeCode(response.status),
        "Matomo Self-Hosted returned invalid JSON.",
        response.status,
      );
    }
    const envelope = this.object(parsed);
    if (!response.ok || envelope?.result === "error")
      throw new MatomoSelfHostedApiError(
        this.safeCode(response.status),
        "Matomo Self-Hosted rejected the bounded reporting request.",
        response.status,
      );
    if (method === "VisitsSummary.get") return this.metrics(envelope ?? {});
    if (!Array.isArray(parsed))
      throw new MatomoSelfHostedApiError(
        "provider_validation_error",
        "Matomo Self-Hosted returned an invalid report table.",
      );
    return {
      rows: parsed.slice(0, limit).map((row) => this.row(row, method)),
      count: Math.min(parsed.length, limit),
      truncated: parsed.length >= limit,
      window: input.window ?? "today",
    };
  }

  private row(value: unknown, method: string) {
    const row = this.object(value) ?? {};
    return {
      label:
        method === "Actions.getPageUrls"
          ? this.safePageLabel(row.label)
          : this.text(row.label, 300),
      ...(method === "UserCountry.getCountry"
        ? { code: this.text(row.code, 16) }
        : {}),
      ...this.metrics(row),
    };
  }

  private metrics(value: JsonObject) {
    const output: JsonObject = {};
    for (const key of [
      "nb_visits",
      "nb_uniq_visitors",
      "nb_actions",
      "nb_pageviews",
      "nb_uniq_pageviews",
      "nb_visits_converted",
      "bounce_count",
      "bounce_rate",
      "max_actions",
      "sum_visit_length",
      "avg_time_on_site",
      "sum_time_spent",
      "avg_time_on_page",
      "exit_rate",
    ]) {
      const number = this.number(value[key]);
      if (number !== null) output[key] = number;
    }
    return output;
  }

  private async endpoint(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.invalid("Enter a valid Matomo installation URL.");
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
    )
      throw new MatomoSelfHostedApiError(
        "policy_blocked",
        "Matomo Self-Hosted requires a public HTTPS installation URL without embedded credentials, ports, query, or fragment.",
        403,
      );
    await this.requirePublicHost(url.hostname);
    const basePath = url.pathname
      .replace(/\/index\.php\/?$/i, "")
      .replace(/\/+$/, "");
    return new URL(`${url.origin}${basePath}/index.php`);
  }

  private async requirePublicHost(hostname: string) {
    if (isIP(hostname) && this.isPrivateAddress(hostname))
      throw new MatomoSelfHostedApiError(
        "policy_blocked",
        "Matomo Self-Hosted cannot use a private, local, reserved, or link-local address.",
        403,
      );
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new MatomoSelfHostedApiError(
        "provider_unavailable",
        "Matomo Self-Hosted hostname could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some((item) => this.isPrivateAddress(item.address))
    )
      throw new MatomoSelfHostedApiError(
        "policy_blocked",
        "Matomo Self-Hosted hostname must resolve only to public addresses.",
        403,
      );
  }

  private isPrivateAddress(address: string) {
    const normalized = address.toLowerCase().replace(/^::ffff:/, "");
    if (normalized.includes(":"))
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
    const parts = normalized.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part)))
      return true;
    const [a, b, c] = parts;
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
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    );
  }

  private assertCredentials(credentials: MatomoSelfHostedCredentials) {
    if (!/^[A-Za-z0-9_-]{32,200}$/.test(credentials.tokenAuth))
      throw new MatomoSelfHostedApiError(
        "credential_missing",
        "A valid Matomo auth token is required.",
        401,
      );
    if (
      !Number.isInteger(credentials.siteId) ||
      credentials.siteId < 1 ||
      credentials.siteId > Number.MAX_SAFE_INTEGER
    )
      throw this.invalid("Matomo site ID must be a positive integer.");
  }

  private window(value: unknown): { period: string; date: string } {
    const selected = (value ?? "today") as ReportWindow;
    const windows: Record<ReportWindow, { period: string; date: string }> = {
      today: { period: "day", date: "today" },
      yesterday: { period: "day", date: "yesterday" },
      this_week: { period: "week", date: "today" },
      this_month: { period: "month", date: "today" },
    };
    const result = windows[selected];
    if (!result) throw this.invalid("Matomo report window is invalid.");
    return result;
  }

  private integer(
    value: unknown,
    minimum: number,
    maximum: number,
    fallback: number,
  ) {
    const parsed = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
      throw this.invalid(
        `Matomo integer must be between ${minimum} and ${maximum}.`,
      );
    return parsed;
  }

  private safePageLabel(value: unknown) {
    const label = this.text(value, 1_000);
    if (!label) return null;
    try {
      const url = new URL(label);
      return `${url.origin}${url.pathname}`.slice(0, 500);
    } catch {
      return label.split(/[?#]/, 1)[0].slice(0, 500);
    }
  }

  private object(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }

  private text(value: unknown, maximum: number) {
    if (typeof value !== "string" && typeof value !== "number") return null;
    return String(value)
      .replace(/[\r\n\u0000]/g, " ")
      .slice(0, maximum);
  }

  private number(value: unknown) {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 408 || status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }

  private invalid(message: string) {
    return new MatomoSelfHostedApiError("provider_validation_error", message);
  }
}
