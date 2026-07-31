import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type SmugMugCredentials = {
  consumerKey: string;
  consumerSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
};
export type SmugMugRequestInput = {
  uri: string;
  query?: JsonObject;
  json?: JsonObject;
};

export class SmugMugApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SmugMugApiAdapter {
  private static readonly API_ORIGIN = "https://api.smugmug.com";
  private static readonly UPLOAD_ORIGIN = "https://upload.smugmug.com";
  private static readonly REQUEST_TOKEN =
    "https://api.smugmug.com/services/oauth/1.0a/getRequestToken";
  private static readonly AUTHORIZE =
    "https://api.smugmug.com/services/oauth/1.0a/authorize";
  private static readonly ACCESS_TOKEN =
    "https://api.smugmug.com/services/oauth/1.0a/getAccessToken";

  async requestToken(
    consumerKey: string,
    consumerSecret: string,
    callback: string,
  ) {
    const response = await this.oauthTokenRequest(
      SmugMugApiAdapter.REQUEST_TOKEN,
      { consumerKey, consumerSecret },
      { oauth_callback: callback },
    );
    if (response.get("oauth_callback_confirmed") !== "true")
      throw new SmugMugApiError(
        "provider_validation_error",
        "SmugMug did not confirm the OAuth callback.",
      );
    return this.tokenPair(response, "request");
  }

  authorizationUrl(token: string) {
    const url = new URL(SmugMugApiAdapter.AUTHORIZE);
    url.searchParams.set(
      "oauth_token",
      this.credential(token, "request token"),
    );
    url.searchParams.set("Access", "Full");
    url.searchParams.set("Permissions", "Modify");
    return url.toString();
  }

  async exchangeAccessToken(
    consumerKey: string,
    consumerSecret: string,
    requestToken: string,
    requestTokenSecret: string,
    verifier: string,
  ) {
    const response = await this.oauthTokenRequest(
      SmugMugApiAdapter.ACCESS_TOKEN,
      {
        consumerKey,
        consumerSecret,
        accessToken: requestToken,
        accessTokenSecret: requestTokenSecret,
      },
      { oauth_verifier: this.credential(verifier, "OAuth verifier") },
    );
    return this.tokenPair(response, "access");
  }

  health(credentials: SmugMugCredentials) {
    return this.request(credentials, "GET", {
      uri: "/api/v2!authuser",
      query: { _verbosity: "1" },
    });
  }

  describe(credentials: SmugMugCredentials, input: SmugMugRequestInput) {
    return this.request(credentials, "OPTIONS", input);
  }

  read(credentials: SmugMugCredentials, input: SmugMugRequestInput) {
    return this.request(credentials, "GET", input);
  }

  manage(
    credentials: SmugMugCredentials,
    method: "POST" | "PATCH" | "DELETE",
    input: SmugMugRequestInput,
  ) {
    return this.request(credentials, method, input);
  }

  async upload(credentials: SmugMugCredentials, input: JsonObject) {
    this.requireCredentials(credentials);
    this.rejectCredentialFields(input);
    const albumUri = this.uri(input.albumUri);
    if (!/^\/api\/v2\/album\/[A-Za-z0-9_-]+$/.test(albumUri))
      throw this.invalid("SmugMug albumUri must identify one album.");
    const base64 = this.string(input.base64, "base64", 35_000_000);
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.byteLength > 25_000_000)
      throw this.invalid("SmugMug upload must be between 1 byte and 25 MB.");
    const mimeType = this.string(input.mimeType, "mimeType", 100);
    if (
      !/^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime))$/i.test(mimeType)
    )
      throw this.invalid("SmugMug upload MIME type is not supported.");
    const fileName = this.string(input.fileName, "fileName", 250);
    if (/[\r\n/\\]/.test(fileName))
      throw this.invalid("SmugMug upload fileName is invalid.");
    const url = new URL("/", SmugMugApiAdapter.UPLOAD_ORIGIN);
    const authorization = this.authorization("POST", url, credentials, {});
    const response = await this.fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        "Content-Type": mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-MD5": createHash("md5").update(bytes).digest("base64"),
        "X-Smug-AlbumUri": albumUri,
        "X-Smug-FileName": fileName,
        "X-Smug-ResponseType": "JSON",
        "X-Smug-Version": "v2",
        ...(typeof input.title === "string"
          ? { "X-Smug-Title": input.title.slice(0, 250) }
          : {}),
        ...(typeof input.caption === "string"
          ? { "X-Smug-Caption": input.caption.slice(0, 2_000) }
          : {}),
      },
      body: bytes,
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    return this.response(response);
  }

  private async request(
    credentials: SmugMugCredentials,
    method: "GET" | "POST" | "PATCH" | "DELETE" | "OPTIONS",
    input: SmugMugRequestInput,
  ) {
    this.requireCredentials(credentials);
    this.rejectCredentialFields(input);
    const url = new URL(this.uri(input.uri), SmugMugApiAdapter.API_ORIGIN);
    const query = input.query ?? {};
    if (Object.keys(query).length > 40)
      throw this.invalid("SmugMug query has too many fields.");
    for (const [key, raw] of Object.entries(query)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(key))
        throw this.invalid(`SmugMug query field ${key} is invalid.`);
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.invalid(`SmugMug query field ${key} has too many values.`);
      for (const value of values) {
        if (value === null || value === undefined || value === "") continue;
        if (typeof value === "object")
          throw this.invalid(`SmugMug query field ${key} must be scalar.`);
        const text = String(value);
        if (text.length > 2_000 || /[\r\n]/.test(text))
          throw this.invalid(`SmugMug query field ${key} is invalid.`);
        url.searchParams.append(key, text);
      }
    }
    if (method === "GET" && !url.searchParams.has("_pretty"))
      url.searchParams.set("_pretty", "0");
    const body =
      input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && !["POST", "PATCH"].includes(method))
      throw this.invalid(`SmugMug ${method} does not accept a JSON body.`);
    if (body && Buffer.byteLength(body) > 2_000_000)
      throw this.invalid("SmugMug request exceeds the 2 MB Relay limit.");
    const authorization = this.authorization(method, url, credentials, {});
    const response = await this.fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
    });
    return this.response(response);
  }

  private async oauthTokenRequest(
    target: string,
    credentials: SmugMugCredentials,
    extraOAuth: Record<string, string>,
  ) {
    this.requireConsumer(credentials);
    const url = new URL(target);
    const authorization = this.authorization(
      "POST",
      url,
      credentials,
      extraOAuth,
    );
    const response = await this.fetch(url, {
      method: "POST",
      headers: {
        Authorization: authorization,
        Accept: "application/x-www-form-urlencoded",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.text();
    if (!response.ok)
      throw new SmugMugApiError(
        this.code(response.status),
        this.oauthMessage(raw, response.status),
        response.status,
      );
    return new URLSearchParams(raw);
  }

  private authorization(
    method: string,
    url: URL,
    credentials: SmugMugCredentials,
    extraOAuth: Record<string, string>,
  ) {
    const oauth: Record<string, string> = {
      oauth_consumer_key: credentials.consumerKey,
      oauth_nonce: randomBytes(18).toString("hex"),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: String(Math.floor(Date.now() / 1000)),
      oauth_version: "1.0",
      ...(credentials.accessToken
        ? { oauth_token: credentials.accessToken }
        : {}),
      ...extraOAuth,
    };
    const parameters: Array<[string, string]> = [...url.searchParams.entries()];
    parameters.push(...Object.entries(oauth));
    parameters.sort(([ak, av], [bk, bv]) =>
      ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk),
    );
    const parameterString = parameters
      .map(([key, value]) => `${this.encode(key)}=${this.encode(value)}`)
      .join("&");
    const baseUrl = `${url.origin}${url.pathname}`;
    const signatureBase = `${method.toUpperCase()}&${this.encode(baseUrl)}&${this.encode(parameterString)}`;
    const signingKey = `${this.encode(credentials.consumerSecret)}&${this.encode(credentials.accessTokenSecret ?? "")}`;
    oauth.oauth_signature = createHmac("sha1", signingKey)
      .update(signatureBase)
      .digest("base64");
    return `OAuth ${Object.entries(oauth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${this.encode(key)}="${this.encode(value)}"`)
      .join(", ")}`;
  }

  private async fetch(url: URL, init: RequestInit) {
    try {
      return await safeConnectorFetch(url, { ...init, cache: "no-store" });
    } catch (error) {
      if (error instanceof SmugMugApiError) throw error;
      throw new SmugMugApiError(
        "provider_unavailable",
        "SmugMug could not be reached.",
        502,
      );
    }
  }

  private async response(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 5_000_000)
      throw this.invalid("SmugMug response exceeds the 5 MB Relay limit.");
    let data: unknown;
    try {
      data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      data = { message: raw.toString("utf8").slice(0, 4_000) };
    }
    data = this.redact(data);
    if (!response.ok)
      throw new SmugMugApiError(
        this.code(response.status),
        this.apiMessage(data, response.status),
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
  }

  private uri(value: unknown) {
    const uri = this.string(value, "uri", 2_000);
    if (
      !/^\/api\/v2(?:[!/][A-Za-z0-9_.,~:;=@%+!$&'()*\-/]*)?$/.test(uri) ||
      uri.includes("..") ||
      uri.includes("//")
    )
      throw this.invalid("SmugMug uri must be a canonical /api/v2 URI.");
    return uri;
  }

  private requireConsumer(credentials: SmugMugCredentials) {
    this.credential(credentials.consumerKey, "consumer key");
    this.credential(credentials.consumerSecret, "consumer secret");
  }

  private requireCredentials(credentials: SmugMugCredentials) {
    this.requireConsumer(credentials);
    this.credential(credentials.accessToken ?? "", "access token");
    this.credential(credentials.accessTokenSecret ?? "", "access token secret");
  }

  private credential(value: string, label: string) {
    const text = value?.trim();
    if (!text || text.length > 20_000 || /[\r\n]/.test(text))
      throw new SmugMugApiError(
        "credential_missing",
        `SmugMug ${label} is missing.`,
        401,
      );
    return text;
  }

  private tokenPair(params: URLSearchParams, label: string) {
    const token = params.get("oauth_token") ?? "";
    const secret = params.get("oauth_token_secret") ?? "";
    if (!token || !secret)
      throw new SmugMugApiError(
        "provider_validation_error",
        `SmugMug ${label}-token response was incomplete.`,
      );
    return { token, secret };
  }

  private string(value: unknown, name: string, maximum: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > maximum)
      throw this.invalid(`SmugMug ${name} is invalid.`);
    return text;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12)
      throw new SmugMugApiError(
        "policy_blocked",
        "SmugMug request is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) =>
        this.rejectCredentialFields(item, depth + 1),
      );
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new SmugMugApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(child, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 100_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private apiMessage(value: unknown, status: number) {
    if (value && typeof value === "object") {
      const response = (value as JsonObject).Response;
      if (response && typeof response === "object") {
        const message = (response as JsonObject).Message;
        if (typeof message === "string" && message.trim())
          return message.trim().slice(0, 500);
      }
    }
    return `SmugMug returned HTTP ${status}.`;
  }

  private oauthMessage(raw: string, status: number) {
    const params = new URLSearchParams(raw);
    return (
      params.get("oauth_problem")?.slice(0, 500) ??
      `SmugMug OAuth returned HTTP ${status}.`
    );
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private encode(value: string) {
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  private invalid(message: string) {
    return new SmugMugApiError("provider_validation_error", message, 400);
  }
}
