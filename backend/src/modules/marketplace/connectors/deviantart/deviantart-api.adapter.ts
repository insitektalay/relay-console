import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
const ID = "[A-Za-z0-9_-]{1,100}";
const READ = [
  /^\/browse\/(dailydeviations|deviantsyouwatch|home|tags|tags\/search|topics|toptopics)$/,
  new RegExp(`^/browse/(morelikethis/preview|topic)/${ID}$`),
  new RegExp(`^/collections/(all|folders|${ID})$`),
  new RegExp(`^/comments/(deviation|profile|status)/${ID}$`),
  new RegExp(`^/comments/${ID}/siblings$`),
  /^\/data\/(countries|privacy|submission|tos)$/,
  new RegExp(`^/deviation/(${ID}|content|metadata|whofaved)$`),
  new RegExp(`^/deviation/download/${ID}$`),
  /^\/feed\/(home|notifications|profile|settings)$/,
  new RegExp(`^/feed/home/${ID}$`),
  new RegExp(`^/gallery/(all|folders|${ID})$`),
  /^\/messages\/(feed|feedback|mentions)$/,
  new RegExp(`^/messages/(feedback|mentions)/${ID}$`),
  /^\/notes\/(notes|folders)$/,
  new RegExp(`^/notes/${ID}$`),
  new RegExp(`^/user/(friends|profile|watchers|tiers)/${ID}$`),
  new RegExp(`^/user/friends/(search|watching/${ID})$`),
  /^\/user\/(profile\/posts|whoami|whois)$/,
  /^\/util\/placebo$/,
];
const MUTATE = [
  /^\/collections\/(fave|unfave)$/,
  /^\/collections\/folders\/(copy_deviations|create|move_deviations|remove_deviations|update|update_deviation_order|update_order)$/,
  new RegExp(`^/collections/folders/remove/${ID}$`),
  new RegExp(`^/comments/post/(deviation|profile|status)/${ID}$`),
  new RegExp(`^/deviation/edit/${ID}$`),
  /^\/deviation\/(journal|literature)\/create$/,
  new RegExp(`^/deviation/(journal|literature)/update/${ID}$`),
  /^\/feed\/settings\/update$/,
  /^\/gallery\/folders\/(copy_deviations|create|move|move_deviations|remove_deviations|update|update_deviation_order|update_order)$/,
  new RegExp(`^/gallery/folders/remove/${ID}$`),
  /^\/messages\/delete$/,
  /^\/notes\/(delete|mark|move|send)$/,
  /^\/notes\/folders\/(create|rename)$/,
  new RegExp(`^/notes/folders/remove/${ID}$`),
  /^\/stash\/(publish|submit)$/,
  new RegExp(`^/user/friends/(watch|unwatch)/${ID}$`),
  /^\/user\/(profile\/avatar\/update|profile\/update|statuses\/post)$/,
];

export class DeviantArtApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DeviantArtApiAdapter {
  health(token: string) {
    return this.read(token, "/user/whoami", {});
  }
  read(token: string, route: string, input: JsonObject) {
    if (MUTATE.some((pattern) => pattern.test(route)))
      throw this.invalid("DeviantArt read route is not in the official allowlist.");
    if (!READ.some((pattern) => pattern.test(route)))
      throw this.invalid(
        "DeviantArt read route is not in the official allowlist.",
      );
    return this.request(token, "GET", route, input);
  }
  manage(token: string, route: string, input: JsonObject) {
    if (!MUTATE.some((pattern) => pattern.test(route)))
      throw this.invalid(
        "DeviantArt mutation route is not in the official allowlist.",
      );
    return this.request(token, "POST", route, input);
  }
  private async request(
    token: string,
    method: "GET" | "POST",
    route: string,
    input: JsonObject,
  ) {
    const accessToken = this.credential(token);
    this.rejectSecrets(input);
    const url = new URL(`/api/v1/oauth2${route}`, "https://www.deviantart.com");
    const fields = new URLSearchParams();
    this.fields(fields, input);
    let body: string | undefined;
    if (method === "GET")
      for (const [key, value] of fields) url.searchParams.append(key, value);
    else {
      body = fields.toString();
      if (Buffer.byteLength(body) > 2_000_000)
        throw this.invalid("DeviantArt request exceeds 2 MB.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(body
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000)
        throw this.invalid("DeviantArt response exceeds 5 MB.");
      const data = this.redact(this.parse(raw));
      if (!response.ok)
        throw new DeviantArtApiError(
          this.code(response.status),
          this.message(data) ?? `DeviantArt returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data,
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof DeviantArtApiError) throw error;
      throw new DeviantArtApiError(
        "provider_unavailable",
        "DeviantArt could not be reached.",
        502,
      );
    }
  }
  private fields(target: URLSearchParams, input: JsonObject) {
    if (Object.keys(input).length > 80)
      throw this.invalid("DeviantArt request has too many fields.");
    for (const [key, raw] of Object.entries(input)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(key))
        throw this.invalid(`DeviantArt field ${key} is invalid.`);
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.invalid(`DeviantArt field ${key} has too many values.`);
      for (const value of values) {
        if (value === undefined || value === null) continue;
        if (typeof value === "object")
          throw this.invalid(`DeviantArt field ${key} must be scalar.`);
        const text = String(value);
        if (text.length > 100_000 || /[\r\n]/.test(text))
          throw this.invalid(`DeviantArt field ${key} is invalid.`);
        target.append(key, text);
      }
    }
    if (target.has("limit")) {
      const limit = Number(target.get("limit"));
      if (!Number.isInteger(limit) || limit < 1 || limit > 50)
        throw this.invalid("DeviantArt limit must be 1 through 50.");
    }
  }
  private credential(value: string) {
    const text = value?.trim();
    if (!text || text.length > 20_000 || /[\r\n]/.test(text))
      throw new DeviantArtApiError(
        "credential_missing",
        "DeviantArt access token is missing.",
        401,
      );
    return text;
  }
  private rejectSecrets(value: unknown, depth = 0) {
    if (depth > 10)
      throw new DeviantArtApiError(
        "policy_blocked",
        "DeviantArt input is too deeply nested.",
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
        throw new DeviantArtApiError(
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
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 500).map((child) => this.redact(child, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 100_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, child]) => [
          key,
          /(token|secret|password|cookie|authorization)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }
  private message(value: unknown) {
    return value && typeof value === "object"
      ? String(
          (value as JsonObject).error_description ??
            (value as JsonObject).error ??
            "",
        ).slice(0, 500) || null
      : null;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new DeviantArtApiError("provider_validation_error", message, 400);
  }
}
