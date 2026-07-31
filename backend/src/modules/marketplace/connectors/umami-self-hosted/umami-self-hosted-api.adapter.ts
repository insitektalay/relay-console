import { safeConnectorFetch } from "../safe-connector-fetch";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type WindowName = "day" | "24h" | "7d" | "28d" | "month";

export type UmamiSelfHostedCredentials = {
  installationUrl: string;
  username: string;
  password: string;
  websiteId: string;
};

export class UmamiSelfHostedApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class UmamiSelfHostedApiAdapter {
  async health(credentials: UmamiSelfHostedCredentials) {
    await this.stats(credentials, { window: "day" });
    return { websiteId: credentials.websiteId };
  }

  stats(credentials: UmamiSelfHostedCredentials, input: JsonObject) {
    return this.analytics(credentials, "stats", input);
  }

  pageviews(credentials: UmamiSelfHostedCredentials, input: JsonObject) {
    return this.analytics(credentials, "pageviews", input);
  }

  topPages(credentials: UmamiSelfHostedCredentials, input: JsonObject) {
    return this.analytics(credentials, "metrics", input);
  }

  activeVisitors(credentials: UmamiSelfHostedCredentials) {
    return this.analytics(credentials, "active", {});
  }

  private async analytics(
    credentials: UmamiSelfHostedCredentials,
    report: "stats" | "pageviews" | "metrics" | "active",
    input: JsonObject,
  ) {
    this.assertCredentials(credentials);
    const base = await this.baseUrl(credentials.installationUrl);
    const token = await this.login(base, credentials);
    const target = new URL(
      `${base.toString().replace(/\/$/, "")}/api/websites/${encodeURIComponent(credentials.websiteId)}/${report}`,
    );
    const window = this.window(input.window);
    if (report !== "active") {
      const { startAt, endAt } = this.range(window);
      target.searchParams.set("startAt", String(startAt));
      target.searchParams.set("endAt", String(endAt));
    }
    if (report === "pageviews") {
      target.searchParams.set("unit", this.unit(window));
      target.searchParams.set("timezone", "UTC");
    }
    const limit =
      report === "metrics" ? this.integer(input.limit, 1, 20, 10) : 1;
    if (report === "metrics") {
      target.searchParams.set("type", "path");
      target.searchParams.set("limit", String(limit));
      target.searchParams.set("offset", "0");
    }
    const parsed = await this.request(target, token);
    if (report === "stats") return this.shapeStats(parsed);
    if (report === "pageviews") return this.shapePageviews(parsed, window);
    if (report === "metrics") return this.shapeMetrics(parsed, limit, window);
    const visitors = this.number(this.object(parsed)?.visitors);
    if (visitors === null)
      throw this.invalid(
        "Umami Self-Hosted returned an invalid active visitor count.",
      );
    return { visitors };
  }

  private async login(base: URL, credentials: UmamiSelfHostedCredentials) {
    const target = new URL(
      `${base.toString().replace(/\/$/, "")}/api/auth/login`,
    );
    let response: Response;
    try {
      response = await safeConnectorFetch(target, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0",
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new UmamiSelfHostedApiError(
        "provider_unavailable",
        "Umami Self-Hosted could not be reached.",
        502,
      );
    }
    const parsed = await this.parse(response, "authentication");
    if (!response.ok)
      throw new UmamiSelfHostedApiError(
        this.safeCode(response.status),
        "Umami Self-Hosted rejected the encrypted login credentials.",
        response.status,
      );
    const token = this.object(parsed)?.token;
    if (typeof token !== "string" || token.length < 20 || token.length > 4096)
      throw this.invalid(
        "Umami Self-Hosted returned an invalid authentication token.",
      );
    return token;
  }

  private async request(target: URL, token: string) {
    let response: Response;
    try {
      response = await safeConnectorFetch(target, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new UmamiSelfHostedApiError(
        "provider_unavailable",
        "Umami Self-Hosted could not be reached.",
        502,
      );
    }
    const parsed = await this.parse(response, "analytics query");
    if (!response.ok)
      throw new UmamiSelfHostedApiError(
        this.safeCode(response.status),
        "Umami Self-Hosted rejected the bounded analytics query.",
        response.status,
      );
    return parsed;
  }

  private async parse(response: Response, operation: string) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 262_144)
      throw this.invalid(
        "Umami Self-Hosted response exceeded the 256 KiB Relay limit.",
      );
    try {
      return raw.byteLength ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      throw new UmamiSelfHostedApiError(
        response.ok ? "provider_unavailable" : this.safeCode(response.status),
        `Umami Self-Hosted returned invalid JSON for the ${operation}.`,
        response.status,
      );
    }
  }

  private shapeStats(value: unknown) {
    const row = this.object(value);
    if (!row)
      throw this.invalid(
        "Umami Self-Hosted returned invalid website statistics.",
      );
    const names = ["pageviews", "visitors", "visits", "bounces", "totaltime"];
    const result: JsonObject = {};
    for (const name of names) {
      const number = this.number(row[name]);
      if (number === null)
        throw this.invalid(
          "Umami Self-Hosted returned invalid website statistics.",
        );
      result[name] = number;
    }
    return result;
  }

  private shapePageviews(value: unknown, window: WindowName) {
    const row = this.object(value);
    const pageviews = this.series(row?.pageviews);
    const sessions = this.series(row?.sessions);
    if (!row || !pageviews || !sessions)
      throw this.invalid(
        "Umami Self-Hosted returned an invalid pageview series.",
      );
    return { pageviews, sessions, window };
  }

  private shapeMetrics(value: unknown, limit: number, window: WindowName) {
    if (!Array.isArray(value))
      throw this.invalid("Umami Self-Hosted returned invalid page metrics.");
    const rows = value.slice(0, limit).map((item) => {
      const row = this.object(item);
      const path = this.text(row?.x, 500);
      const visitors = this.number(row?.y);
      if (!row || !path || visitors === null)
        throw this.invalid("Umami Self-Hosted returned invalid page metrics.");
      return { path: path.split(/[?#]/, 1)[0], visitors };
    });
    return {
      rows,
      count: rows.length,
      truncated: value.length >= limit,
      window,
    };
  }

  private series(value: unknown) {
    if (!Array.isArray(value) || value.length > 744) return null;
    const result: Array<{ timestamp: string; count: number }> = [];
    for (const item of value) {
      const row = this.object(item);
      const timestamp = this.text(row?.x, 40);
      const count = this.number(row?.y);
      if (!row || !timestamp || count === null) return null;
      result.push({ timestamp, count });
    }
    return result;
  }

  private async baseUrl(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.invalid("Enter a valid Umami installation URL.");
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
      throw new UmamiSelfHostedApiError(
        "policy_blocked",
        "Umami Self-Hosted requires a public HTTPS installation URL without embedded credentials, ports, query, or fragment.",
        403,
      );
    await this.requirePublicHost(url.hostname);
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url;
  }

  private async requirePublicHost(hostname: string) {
    if (isIP(hostname) && this.isPrivateAddress(hostname))
      throw new UmamiSelfHostedApiError(
        "policy_blocked",
        "Umami Self-Hosted cannot use a private, local, reserved, or link-local address.",
        403,
      );
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new UmamiSelfHostedApiError(
        "provider_unavailable",
        "Umami Self-Hosted hostname could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some((item) => this.isPrivateAddress(item.address))
    )
      throw new UmamiSelfHostedApiError(
        "policy_blocked",
        "Umami Self-Hosted hostname must resolve only to public addresses.",
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

  private assertCredentials(credentials: UmamiSelfHostedCredentials) {
    if (
      !credentials.username ||
      credentials.username.length > 200 ||
      /[\r\n\u0000]/.test(credentials.username)
    )
      throw new UmamiSelfHostedApiError(
        "credential_missing",
        "A valid Umami username is required.",
        401,
      );
    if (
      !credentials.password ||
      credentials.password.length > 500 ||
      /[\u0000]/.test(credentials.password)
    )
      throw new UmamiSelfHostedApiError(
        "credential_missing",
        "A valid Umami password is required.",
        401,
      );
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(credentials.websiteId))
      throw this.invalid("Umami website ID must be one exact UUID.");
  }

  private window(value: unknown): WindowName {
    const selected = String(value ?? "7d") as WindowName;
    if (!["day", "24h", "7d", "28d", "month"].includes(selected))
      throw this.invalid("Umami report window is invalid.");
    return selected;
  }

  private range(window: WindowName) {
    const endAt = Date.now();
    const day = 86_400_000;
    const durations: Record<WindowName, number> = {
      day,
      "24h": day,
      "7d": 7 * day,
      "28d": 28 * day,
      month: 30 * day,
    };
    return { startAt: endAt - durations[window], endAt };
  }

  private unit(window: WindowName) {
    return window === "day" || window === "24h" ? "hour" : "day";
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
        `Umami integer must be between ${minimum} and ${maximum}.`,
      );
    return parsed;
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
    return new UmamiSelfHostedApiError("provider_validation_error", message);
  }
}
