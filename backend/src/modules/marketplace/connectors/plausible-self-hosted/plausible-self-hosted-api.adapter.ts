import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type ReportName = "overview" | "pages" | "sources" | "countries";

export type PlausibleSelfHostedCredentials = {
  installationUrl: string;
  apiKey: string;
  siteId: string;
};

export class PlausibleSelfHostedApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class PlausibleSelfHostedApiAdapter {
  async health(credentials: PlausibleSelfHostedCredentials) {
    await this.overview(credentials, { window: "day" });
    return { siteId: credentials.siteId };
  }

  overview(credentials: PlausibleSelfHostedCredentials, input: JsonObject) {
    return this.query(credentials, "overview", input);
  }

  topPages(credentials: PlausibleSelfHostedCredentials, input: JsonObject) {
    return this.query(credentials, "pages", input);
  }

  sources(credentials: PlausibleSelfHostedCredentials, input: JsonObject) {
    return this.query(credentials, "sources", input);
  }

  countries(credentials: PlausibleSelfHostedCredentials, input: JsonObject) {
    return this.query(credentials, "countries", input);
  }

  private async query(
    credentials: PlausibleSelfHostedCredentials,
    report: ReportName,
    input: JsonObject,
  ) {
    this.assertCredentials(credentials);
    const endpoint = await this.endpoint(credentials.installationUrl);
    const definition = this.definition(report);
    const limit =
      report === "overview" ? 1 : this.integer(input.limit, 1, 20, 10);
    const body = {
      site_id: credentials.siteId,
      metrics: definition.metrics,
      date_range: this.window(input.window),
      dimensions: definition.dimensions,
      filters: [],
      include: { imports: false, total_rows: false },
      pagination: { limit, offset: 0 },
    };
    let response: Response;
    try {
      response = await safeConnectorFetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${credentials.apiKey}`,
          "User-Agent": "RelayConsole/1.0",
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof PlausibleSelfHostedApiError) throw error;
      throw new PlausibleSelfHostedApiError(
        "provider_unavailable",
        "Plausible Self-Hosted could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 262_144)
      throw this.invalid(
        "Plausible Self-Hosted response exceeded the 256 KiB Relay limit.",
      );
    let parsed: unknown;
    try {
      parsed = raw.byteLength ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      throw new PlausibleSelfHostedApiError(
        response.ok ? "provider_unavailable" : this.safeCode(response.status),
        "Plausible Self-Hosted returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new PlausibleSelfHostedApiError(
        this.safeCode(response.status),
        "Plausible Self-Hosted rejected the bounded stats query.",
        response.status,
      );
    const envelope = this.object(parsed);
    const results = Array.isArray(envelope?.results) ? envelope.results : null;
    if (!results)
      throw this.invalid(
        "Plausible Self-Hosted returned an invalid stats result.",
      );
    const rows = results
      .slice(0, limit)
      .map((row) =>
        this.row(row, definition.dimensions, definition.metrics, report),
      );
    if (report === "overview")
      return rows[0]?.metrics ?? this.emptyMetrics(definition.metrics);
    return {
      rows,
      count: rows.length,
      truncated: results.length >= limit,
      window: input.window ?? "7d",
    };
  }

  private row(
    value: unknown,
    dimensions: string[],
    metrics: string[],
    report: ReportName,
  ) {
    const row = this.object(value) ?? {};
    const rawDimensions = Array.isArray(row.dimensions) ? row.dimensions : [];
    const rawMetrics = Array.isArray(row.metrics) ? row.metrics : [];
    const shapedDimensions: JsonObject = {};
    dimensions.forEach((name, index) => {
      const label = this.text(rawDimensions[index], 500);
      shapedDimensions[this.dimensionLabel(name)] =
        report === "pages" ? this.safePageLabel(label) : label;
    });
    const shapedMetrics: JsonObject = {};
    metrics.forEach((name, index) => {
      const number = this.number(rawMetrics[index]);
      if (number !== null) shapedMetrics[name] = number;
    });
    return { dimensions: shapedDimensions, metrics: shapedMetrics };
  }

  private definition(report: ReportName) {
    const reports: Record<
      ReportName,
      { dimensions: string[]; metrics: string[] }
    > = {
      overview: {
        dimensions: [],
        metrics: [
          "visitors",
          "visits",
          "pageviews",
          "views_per_visit",
          "bounce_rate",
          "visit_duration",
        ],
      },
      pages: {
        dimensions: ["event:page"],
        metrics: ["visitors", "pageviews", "bounce_rate", "time_on_page"],
      },
      sources: {
        dimensions: ["visit:source"],
        metrics: ["visitors", "visits", "bounce_rate"],
      },
      countries: {
        dimensions: ["visit:country_name"],
        metrics: ["visitors", "visits", "bounce_rate"],
      },
    };
    return reports[report];
  }

  private async endpoint(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.invalid("Enter a valid Plausible installation URL.");
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
      throw new PlausibleSelfHostedApiError(
        "policy_blocked",
        "Plausible Self-Hosted requires a public HTTPS installation URL without embedded credentials, ports, query, or fragment.",
        403,
      );
    await this.requirePublicHost(url.hostname);
    const basePath = url.pathname.replace(/\/+$/, "");
    return new URL(`${url.origin}${basePath}/api/v2/query`);
  }

  private async requirePublicHost(hostname: string) {
    if (isIP(hostname) && this.isPrivateAddress(hostname))
      throw new PlausibleSelfHostedApiError(
        "policy_blocked",
        "Plausible Self-Hosted cannot use a private, local, reserved, or link-local address.",
        403,
      );
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new PlausibleSelfHostedApiError(
        "provider_unavailable",
        "Plausible Self-Hosted hostname could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some((item) => this.isPrivateAddress(item.address))
    )
      throw new PlausibleSelfHostedApiError(
        "policy_blocked",
        "Plausible Self-Hosted hostname must resolve only to public addresses.",
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
        /^fe[89ab]/.test(normalized)
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

  private assertCredentials(credentials: PlausibleSelfHostedCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length < 20 ||
      credentials.apiKey.length > 500 ||
      /[\s\u0000]/.test(credentials.apiKey)
    )
      throw new PlausibleSelfHostedApiError(
        "credential_missing",
        "A valid Plausible Stats API key is required.",
        401,
      );
    if (
      !/^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/.test(
        credentials.siteId,
      )
    )
      throw this.invalid(
        "Plausible site ID must be one exact configured domain.",
      );
  }

  private window(value: unknown) {
    const selected = value ?? "7d";
    if (!["day", "24h", "7d", "28d", "month"].includes(String(selected)))
      throw this.invalid("Plausible report window is invalid.");
    return String(selected);
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
        `Plausible integer must be between ${minimum} and ${maximum}.`,
      );
    return parsed;
  }

  private safePageLabel(value: string | null) {
    if (!value) return null;
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`.slice(0, 500);
    } catch {
      return value.split(/[?#]/, 1)[0].slice(0, 500);
    }
  }

  private dimensionLabel(value: string) {
    return (
      value
        .split(":")
        .pop()
        ?.replace(/_name$/, "") ?? "label"
    );
  }

  private emptyMetrics(metrics: string[]) {
    return Object.fromEntries(metrics.map((name) => [name, 0]));
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
    if (status === 408 || status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }

  private invalid(message: string) {
    return new PlausibleSelfHostedApiError(
      "provider_validation_error",
      message,
    );
  }
}
