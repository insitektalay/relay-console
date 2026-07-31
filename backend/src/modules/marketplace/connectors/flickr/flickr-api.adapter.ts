import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHmac, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type FlickrCredentials = {
  consumerKey: string;
  consumerSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
};

export class FlickrApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FlickrApiAdapter {
  private static readonly REST = "https://www.flickr.com/services/rest";
  private static readonly REQUEST_TOKEN =
    "https://www.flickr.com/services/oauth/request_token";
  private static readonly AUTHORIZE =
    "https://www.flickr.com/services/oauth/authorize";
  private static readonly ACCESS_TOKEN =
    "https://www.flickr.com/services/oauth/access_token";

  async requestToken(
    consumerKey: string,
    consumerSecret: string,
    callback: string,
  ) {
    const response = await this.tokenRequest(
      FlickrApiAdapter.REQUEST_TOKEN,
      { consumerKey, consumerSecret },
      { oauth_callback: callback },
    );
    if (response.get("oauth_callback_confirmed") !== "true")
      throw this.invalid("Flickr did not confirm the OAuth callback.");
    return this.tokenPair(response, "request");
  }

  authorizationUrl(token: string) {
    const url = new URL(FlickrApiAdapter.AUTHORIZE);
    url.searchParams.set(
      "oauth_token",
      this.credential(token, "request token"),
    );
    url.searchParams.set("perms", "delete");
    return url.toString();
  }

  async exchangeAccessToken(
    consumerKey: string,
    consumerSecret: string,
    requestToken: string,
    requestTokenSecret: string,
    verifier: string,
  ) {
    const response = await this.tokenRequest(
      FlickrApiAdapter.ACCESS_TOKEN,
      {
        consumerKey,
        consumerSecret,
        accessToken: requestToken,
        accessTokenSecret: requestTokenSecret,
      },
      { oauth_verifier: this.credential(verifier, "OAuth verifier") },
    );
    return {
      ...this.tokenPair(response, "access"),
      userNsid: response.get("user_nsid"),
      username: response.get("username"),
      fullName: response.get("fullname"),
    };
  }

  health(credentials: FlickrCredentials) {
    return this.call(credentials, "GET", "flickr.test.login", {});
  }

  describe(credentials: FlickrCredentials, method: string) {
    return this.call(credentials, "GET", "flickr.reflection.getMethodInfo", {
      method_name: this.method(method),
    });
  }

  async read(credentials: FlickrCredentials, method: string, args: JsonObject) {
    const normalized = this.method(method);
    if (!this.readMethod(normalized))
      throw this.invalid(
        "Flickr read accepts only reflected read-style methods; use manage for all other published methods.",
      );
    await this.describe(credentials, normalized);
    return this.call(credentials, "GET", normalized, args);
  }

  async manage(
    credentials: FlickrCredentials,
    method: string,
    args: JsonObject,
  ) {
    const normalized = this.method(method);
    if (
      normalized.startsWith("flickr.auth.") ||
      normalized.startsWith("flickr.auth.oauth.")
    )
      throw new FlickrApiError(
        "policy_blocked",
        "Legacy and raw Flickr authentication methods are not exposed.",
        403,
      );
    await this.describe(credentials, normalized);
    return this.call(credentials, "POST", normalized, args);
  }

  async upload(
    credentials: FlickrCredentials,
    input: JsonObject,
    replace: boolean,
  ) {
    this.requireCredentials(credentials);
    this.rejectCredentialFields(input);
    const base64 = this.text(input.base64, "base64", 35_000_000);
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.byteLength > 25_000_000)
      throw this.invalid("Flickr upload must be between 1 byte and 25 MB.");
    const fileName = this.text(input.fileName, "fileName", 250);
    if (/[\r\n/\\]/.test(fileName))
      throw this.invalid("Flickr upload fileName is invalid.");
    const mimeType = this.text(input.mimeType, "mimeType", 100);
    if (
      !/^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime))$/i.test(mimeType)
    )
      throw this.invalid("Flickr upload MIME type is not supported.");
    const target = replace
      ? "https://up.flickr.com/services/replace/"
      : "https://up.flickr.com/services/upload/";
    const url = new URL(target);
    const authorization = this.authorization("POST", url, credentials, {}, []);
    const form = new FormData();
    form.set("photo", new Blob([bytes], { type: mimeType }), fileName);
    if (replace) form.set("photo_id", this.text(input.photoId, "photoId", 100));
    for (const key of [
      "title",
      "description",
      "tags",
      "is_public",
      "is_friend",
      "is_family",
      "safety_level",
      "content_type",
      "hidden",
    ]) {
      const value = input[key];
      if (value !== undefined && value !== null)
        form.set(key, String(value).slice(0, 2_000));
    }
    const response = await this.fetch(url, {
      method: "POST",
      headers: {
        Authorization: authorization,
        Accept: "application/json, application/xml",
      },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    return this.response(response);
  }

  private async call(
    credentials: FlickrCredentials,
    httpMethod: "GET" | "POST",
    method: string,
    args: JsonObject,
  ) {
    this.requireCredentials(credentials);
    this.rejectCredentialFields(args);
    const fields: Array<[string, string]> = [
      ["method", this.method(method)],
      ["format", "json"],
      ["nojsoncallback", "1"],
    ];
    if (Object.keys(args).length > 60)
      throw this.invalid("Flickr request has too many arguments.");
    for (const [key, value] of Object.entries(args)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(key))
        throw this.invalid(`Flickr argument ${key} is invalid.`);
      if (value === undefined || value === null || value === "") continue;
      if (typeof value === "object")
        throw this.invalid(`Flickr argument ${key} must be scalar.`);
      const text = String(value);
      if (text.length > 20_000 || /[\r\n]/.test(text))
        throw this.invalid(`Flickr argument ${key} is invalid.`);
      fields.push([key, text]);
    }
    const url = new URL(FlickrApiAdapter.REST);
    if (httpMethod === "GET")
      for (const [key, value] of fields) url.searchParams.append(key, value);
    const authorization = this.authorization(
      httpMethod,
      url,
      credentials,
      {},
      httpMethod === "POST" ? fields : [],
    );
    const body =
      httpMethod === "POST"
        ? new URLSearchParams(fields).toString()
        : undefined;
    const response = await this.fetch(url, {
      method: httpMethod,
      headers: {
        Authorization: authorization,
        Accept: "application/json",
        ...(body
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(httpMethod === "GET" ? 20_000 : 30_000),
    });
    return this.response(response);
  }

  private async tokenRequest(
    target: string,
    credentials: FlickrCredentials,
    extraOAuth: Record<string, string>,
  ) {
    this.requireConsumer(credentials);
    const url = new URL(target);
    const authorization = this.authorization(
      "GET",
      url,
      credentials,
      extraOAuth,
      [],
    );
    const response = await this.fetch(url, {
      method: "GET",
      headers: { Authorization: authorization },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.text();
    if (!response.ok)
      throw new FlickrApiError(
        this.code(response.status),
        this.oauthMessage(raw, response.status),
        response.status,
      );
    return new URLSearchParams(raw);
  }

  private authorization(
    method: string,
    url: URL,
    credentials: FlickrCredentials,
    extraOAuth: Record<string, string>,
    bodyFields: Array<[string, string]>,
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
    const params: Array<[string, string]> = [
      ...url.searchParams.entries(),
      ...bodyFields,
      ...Object.entries(oauth),
    ];
    params.sort(([ak, av], [bk, bv]) =>
      ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk),
    );
    const parameterString = params
      .map(([key, value]) => `${this.encode(key)}=${this.encode(value)}`)
      .join("&");
    const base = `${method.toUpperCase()}&${this.encode(`${url.origin}${url.pathname}`)}&${this.encode(parameterString)}`;
    const key = `${this.encode(credentials.consumerSecret)}&${this.encode(credentials.accessTokenSecret ?? "")}`;
    oauth.oauth_signature = createHmac("sha1", key)
      .update(base)
      .digest("base64");
    return `OAuth ${Object.entries(oauth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${this.encode(key)}="${this.encode(value)}"`)
      .join(", ")}`;
  }

  private async fetch(url: URL, init: RequestInit) {
    try {
      return await safeConnectorFetch(url, { ...init, cache: "no-store" });
    } catch {
      throw new FlickrApiError(
        "provider_unavailable",
        "Flickr could not be reached.",
        502,
      );
    }
  }

  private async response(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 5_000_000)
      throw this.invalid("Flickr response exceeds the 5 MB Relay limit.");
    const text = raw.toString("utf8");
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { response: text.slice(0, 100_000) };
    }
    data = this.redact(data);
    const apiFailure =
      data && typeof data === "object" && (data as JsonObject).stat === "fail";
    if (!response.ok || apiFailure)
      throw new FlickrApiError(
        this.code(response.status),
        this.apiMessage(data, response.status),
        response.status || 400,
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

  private method(value: unknown) {
    const method = this.text(value, "method", 200);
    if (!/^flickr(?:\.[a-z][A-Za-z0-9]*){2,6}$/.test(method))
      throw this.invalid("Flickr method name is invalid.");
    return method;
  }

  private readMethod(method: string) {
    const action = method.split(".").at(-1) ?? "";
    return (
      /^(get|list|search|find|lookup|check|test|echo|browse|recent|hot|suggest|resolve)/i.test(
        action,
      ) || method.startsWith("flickr.reflection.")
    );
  }

  private requireConsumer(value: FlickrCredentials) {
    this.credential(value.consumerKey, "API key");
    this.credential(value.consumerSecret, "API secret");
  }

  private requireCredentials(value: FlickrCredentials) {
    this.requireConsumer(value);
    this.credential(value.accessToken ?? "", "access token");
    this.credential(value.accessTokenSecret ?? "", "access token secret");
  }

  private credential(value: string, label: string) {
    const text = value?.trim();
    if (!text || text.length > 20_000 || /[\r\n]/.test(text))
      throw new FlickrApiError(
        "credential_missing",
        `Flickr ${label} is missing.`,
        401,
      );
    return text;
  }

  private tokenPair(params: URLSearchParams, label: string) {
    const token = params.get("oauth_token") ?? "";
    const secret = params.get("oauth_token_secret") ?? "";
    if (!token || !secret)
      throw this.invalid(`Flickr ${label}-token response was incomplete.`);
    return { token, secret };
  }

  private text(value: unknown, name: string, maximum: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > maximum)
      throw this.invalid(`Flickr ${name} is invalid.`);
    return text;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12)
      throw new FlickrApiError(
        "policy_blocked",
        "Flickr request is too deeply nested.",
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
        throw new FlickrApiError(
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
    if (
      value &&
      typeof value === "object" &&
      typeof (value as JsonObject).message === "string"
    )
      return String((value as JsonObject).message).slice(0, 500);
    return `Flickr returned HTTP ${status}.`;
  }

  private oauthMessage(raw: string, status: number) {
    return (
      new URLSearchParams(raw).get("oauth_problem")?.slice(0, 500) ??
      `Flickr OAuth returned HTTP ${status}.`
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
    return new FlickrApiError("provider_validation_error", message, 400);
  }
}
