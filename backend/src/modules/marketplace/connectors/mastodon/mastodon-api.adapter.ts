import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import { isPublicIpAddress } from "../../../../common/security/safe-outbound-http";

type JsonObject = Record<string, unknown>;

export class MastodonApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MastodonApiAdapter {
  normalizeInstanceOrigin(value: unknown) {
    if (typeof value !== "string" || !value.trim())
      throw new MastodonApiError(
        "provider_validation_error",
        "A Mastodon instance URL is required",
      );
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new MastodonApiError(
        "provider_validation_error",
        "Mastodon instance URL is invalid",
      );
    }
    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !url.hostname ||
      isIP(url.hostname) !== 0 ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".local")
    )
      throw new MastodonApiError(
        "provider_validation_error",
        "Mastodon requires one public HTTPS origin with no path or custom port",
      );
    return `https://${url.hostname.toLowerCase()}`;
  }

  async registerApp(
    originInput: unknown,
    callbackUrl: string,
    scopes: string[],
  ) {
    const origin = this.normalizeInstanceOrigin(originInput);
    const instance = await this.getInstance(origin);
    const app = this.object(
      await this.request(origin, "/api/v1/apps", {
        method: "POST",
        form: {
          client_name: "Relay Console",
          redirect_uris: callbackUrl,
          scopes: scopes.join(" "),
          website: "https://relayconsole.work/",
        },
      }),
    );
    const clientId = this.required(app.client_id, "client ID", 512);
    const clientSecret = this.required(app.client_secret, "client secret", 512);
    return { origin, clientId, clientSecret, ...instance };
  }

  async getInstance(originInput: unknown) {
    const origin = this.normalizeInstanceOrigin(originInput);
    const instance = this.object(
      await this.request(origin, "/api/v2/instance", { method: "GET" }),
    );
    const domain = this.required(instance.domain, "instance domain", 253);
    if (domain.toLowerCase() !== new URL(origin).hostname)
      throw new MastodonApiError(
        "provider_validation_error",
        "Mastodon instance identity did not match the requested origin",
      );
    const statuses = this.object(this.object(instance.configuration).statuses);
    const advertisedMax =
      typeof statuses.max_characters === "number"
        ? Math.trunc(statuses.max_characters)
        : 500;
    return {
      instanceDomain: domain.toLowerCase(),
      instanceVersion: this.required(instance.version, "instance version", 100),
      maxCharacters: Math.max(1, Math.min(500, advertisedMax)),
    };
  }

  async getAccount(origin: string, token: string) {
    return this.account(
      await this.request(origin, "/api/v1/accounts/verify_credentials", {
        method: "GET",
        token,
      }),
    );
  }

  async exchangeAuthorizationCode(
    origin: string,
    code: string,
    callbackUrl: string,
    clientId: string,
    clientSecret: string,
    codeVerifier: string,
  ) {
    const token = this.object(
      await this.request(origin, "/oauth/token", {
        method: "POST",
        form: {
          grant_type: "authorization_code",
          code,
          redirect_uri: callbackUrl,
          client_id: clientId,
          client_secret: clientSecret,
          code_verifier: codeVerifier,
        },
      }),
    );
    return {
      access_token: this.required(token.access_token, "access token", 4_096),
      token_type: this.optional(token.token_type, 100) ?? "Bearer",
      scope: this.optional(token.scope, 1_000) ?? undefined,
      expires_in:
        typeof token.expires_in === "number" ? token.expires_in : undefined,
    };
  }

  async listOwnStatuses(
    origin: string,
    token: string,
    accountIdInput: unknown,
    limitInput: unknown,
  ) {
    const accountId = this.identifier(accountIdInput, "account ID");
    const limit = this.limit(limitInput);
    const statuses = await this.request(
      origin,
      `/api/v1/accounts/${encodeURIComponent(accountId)}/statuses`,
      {
        method: "GET",
        token,
        query: {
          limit: String(limit),
          exclude_reblogs: "true",
          exclude_replies: "true",
        },
      },
    );
    return (Array.isArray(statuses) ? statuses : [])
      .filter((value) => {
        const status = this.object(value);
        return !status.reblog && !status.in_reply_to_id;
      })
      .slice(0, limit)
      .map((value) => this.status(value));
  }

  draftText(
    textInput: unknown,
    visibilityInput: unknown,
    languageInput: unknown,
    maxCharactersInput: unknown,
  ) {
    const maxCharacters = Math.max(
      1,
      Math.min(500, Number(maxCharactersInput) || 500),
    );
    const text = typeof textInput === "string" ? textInput.trim() : "";
    if (!text || [...text].length > maxCharacters)
      throw new MastodonApiError(
        "provider_validation_error",
        `Mastodon text must contain 1-${maxCharacters} characters`,
      );
    const visibility =
      visibilityInput === "public" || visibilityInput === "unlisted"
        ? visibilityInput
        : null;
    if (!visibility)
      throw new MastodonApiError(
        "provider_validation_error",
        "Mastodon visibility must be public or unlisted",
      );
    const language =
      languageInput === undefined || languageInput === null
        ? null
        : typeof languageInput === "string" && /^[a-z]{2}$/.test(languageInput)
          ? languageInput
          : null;
    if (languageInput && !language)
      throw new MastodonApiError(
        "provider_validation_error",
        "Mastodon language must be an ISO 639-1 code",
      );
    return { text, visibility, language, characterCount: [...text].length };
  }

  async publishText(
    origin: string,
    token: string,
    textInput: unknown,
    visibilityInput: unknown,
    languageInput: unknown,
    maxCharacters: unknown,
    idempotencyKey: string,
  ) {
    const draft = this.draftText(
      textInput,
      visibilityInput,
      languageInput,
      maxCharacters,
    );
    return this.status(
      await this.request(origin, "/api/v1/statuses", {
        method: "POST",
        token,
        idempotencyKey,
        body: {
          status: draft.text,
          visibility: draft.visibility,
          ...(draft.language ? { language: draft.language } : {}),
        },
      }),
    );
  }

  async revoke(
    origin: string,
    clientId: string,
    clientSecret: string,
    token: string,
  ) {
    await this.request(origin, "/oauth/revoke", {
      method: "POST",
      form: { client_id: clientId, client_secret: clientSecret, token },
    });
  }

  private async request(
    originInput: unknown,
    path: string,
    options: {
      method: "GET" | "POST";
      token?: string;
      body?: JsonObject;
      form?: Record<string, string>;
      query?: Record<string, string>;
      idempotencyKey?: string;
    },
  ): Promise<unknown> {
    const origin = this.normalizeInstanceOrigin(originInput);
    const target = new URL(path, `${origin}/`);
    for (const [key, value] of Object.entries(options.query ?? {}))
      target.searchParams.set(key, value);
    const resolved = await this.resolvePublic(target.hostname);
    const selected = resolved[0];
    const body = options.form
      ? new URLSearchParams(options.form).toString()
      : options.body
        ? JSON.stringify(options.body)
        : null;
    return await new Promise((resolve, reject) => {
      const request = httpsRequest(
        target,
        {
          method: options.method,
          headers: {
            Accept: "application/json",
            "User-Agent": "ClawChat-Mastodon/1.0",
            ...(options.token
              ? { Authorization: `Bearer ${options.token}` }
              : {}),
            ...(body
              ? {
                  "Content-Type": options.form
                    ? "application/x-www-form-urlencoded"
                    : "application/json",
                  "Content-Length": Buffer.byteLength(body),
                }
              : {}),
            ...(options.idempotencyKey
              ? { "Idempotency-Key": options.idempotencyKey }
              : {}),
          },
          lookup: (_hostname, _options, callback) =>
            callback(null, selected.address, selected.family),
          timeout: 20_000,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 2_000_000) {
              request.destroy(
                new MastodonApiError(
                  "provider_validation_error",
                  "Mastodon response exceeded Relay bounds",
                ),
              );
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () => {
            const status = response.statusCode ?? 0;
            if (status >= 300 && status < 400) {
              reject(
                new MastodonApiError(
                  "provider_validation_error",
                  "Mastodon redirects are not allowed",
                  status,
                ),
              );
              return;
            }
            const raw = Buffer.concat(chunks).toString("utf8");
            let parsed: unknown;
            try {
              parsed = raw ? JSON.parse(raw) : {};
            } catch {
              reject(
                new MastodonApiError(
                  "provider_validation_error",
                  "Mastodon returned invalid JSON",
                  status,
                ),
              );
              return;
            }
            if (status < 200 || status >= 300) {
              reject(
                new MastodonApiError(
                  this.errorCode(status),
                  `Mastodon request failed with ${status}`,
                  status,
                ),
              );
              return;
            }
            resolve(parsed);
          });
        },
      );
      request.on("timeout", () =>
        request.destroy(
          new MastodonApiError(
            "provider_unavailable",
            "Mastodon request timed out",
          ),
        ),
      );
      request.on("error", (error) =>
        reject(
          error instanceof MastodonApiError
            ? error
            : new MastodonApiError(
                "provider_unavailable",
                "Mastodon request failed",
              ),
        ),
      );
      if (body) request.write(body);
      request.end();
    });
  }

  private async resolvePublic(hostname: string) {
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new MastodonApiError(
        "provider_unavailable",
        "Mastodon instance DNS lookup failed",
      );
    }
    if (
      !addresses.length ||
      addresses.length > 16 ||
      addresses.some((entry) => !isPublicIpAddress(entry.address))
    )
      throw new MastodonApiError(
        "provider_validation_error",
        "Mastodon instance must resolve only to public network addresses",
      );
    return addresses;
  }

  private account(value: unknown) {
    const account = this.object(value);
    return {
      accountId: this.identifier(account.id, "account ID"),
      username: this.required(account.username, "username", 128),
      acct: this.required(account.acct, "account handle", 253),
      displayName: this.cleanText(account.display_name, 300),
      url: this.httpsUrl(account.url),
      locked: account.locked === true,
      bot: account.bot === true,
    };
  }

  private status(value: unknown) {
    const status = this.object(value);
    const tags = (Array.isArray(status.tags) ? status.tags : [])
      .slice(0, 20)
      .map((tag) => this.cleanText(this.object(tag).name, 100))
      .filter((tag): tag is string => Boolean(tag));
    return {
      statusId: this.identifier(status.id, "status ID"),
      createdAt: this.optional(status.created_at, 100),
      visibility: this.optional(status.visibility, 30),
      text: this.cleanText(status.content, 2_000) ?? "",
      spoilerText: this.cleanText(status.spoiler_text, 500),
      language: this.optional(status.language, 20),
      url: this.httpsUrl(status.url),
      tags,
    };
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private optional(value: unknown, max: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, max)
      : null;
  }
  private required(value: unknown, field: string, max: number) {
    const text = this.optional(value, max);
    if (!text || text.length > max)
      throw new MastodonApiError(
        "provider_validation_error",
        `Mastodon ${field} is invalid`,
      );
    return text;
  }
  private identifier(value: unknown, field: string) {
    const id = this.optional(value, 256);
    if (!id || !/^[A-Za-z0-9_:-]{1,256}$/.test(id))
      throw new MastodonApiError(
        "provider_validation_error",
        `Mastodon ${field} is invalid`,
      );
    return id;
  }
  private limit(value: unknown) {
    const number = typeof value === "number" ? value : Number(value ?? 10);
    return Number.isFinite(number)
      ? Math.max(1, Math.min(10, Math.trunc(number)))
      : 10;
  }
  private cleanText(value: unknown, max: number) {
    const text = this.optional(value, max * 3);
    if (!text) return null;
    return text
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }
  private httpsUrl(value: unknown) {
    const text = this.optional(value, 2_048);
    if (!text) return null;
    try {
      const url = new URL(text);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "connection_not_ready";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
