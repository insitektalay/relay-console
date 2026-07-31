import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHmac, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import { audiomackOperation } from "./audiomack-operation-registry";

type JsonObject = Record<string, unknown>;
export type AudiomackCredentials = {
  consumerKey: string;
  consumerSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
};

export class AudiomackApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AudiomackApiAdapter {
  private static readonly ORIGIN = "https://api.audiomack.com";
  private static readonly REQUEST_TOKEN = `${AudiomackApiAdapter.ORIGIN}/v1/request_token`;
  private static readonly ACCESS_TOKEN = `${AudiomackApiAdapter.ORIGIN}/v1/access_token`;

  requestToken(consumerKey: string, consumerSecret: string, callback: string) {
    return this.tokenRequest(
      AudiomackApiAdapter.REQUEST_TOKEN,
      { consumerKey, consumerSecret },
      { oauth_callback: callback },
    );
  }

  authorizationUrl(token: string) {
    const url = new URL("https://audiomack.com/oauth/authenticate");
    url.searchParams.set(
      "oauth_token",
      this.credential(token, "request token"),
    );
    return url.toString();
  }

  exchangeAccessToken(
    consumerKey: string,
    consumerSecret: string,
    requestToken: string,
    requestTokenSecret: string,
    verifier: string,
  ) {
    return this.tokenRequest(
      AudiomackApiAdapter.ACCESS_TOKEN,
      {
        consumerKey,
        consumerSecret,
        accessToken: requestToken,
        accessTokenSecret: requestTokenSecret,
      },
      { oauth_verifier: this.credential(verifier, "OAuth verifier") },
    );
  }

  health(credentials: AudiomackCredentials) {
    return this.execute(credentials, "user-get", {});
  }

  async execute(
    credentials: AudiomackCredentials,
    operationId: string,
    input: JsonObject,
  ) {
    this.requireCredentials(credentials);
    this.rejectSecrets(input);
    const operation = audiomackOperation(operationId);
    if (!operation)
      throw this.invalid("Audiomack operation is not in the pinned registry.");
    const pathValues = this.object(input.path);
    const query = this.object(input.query);
    const body = input.body == null ? {} : input.body;
    let path = operation.path;
    for (const name of Array.from(
      path.matchAll(/:([A-Za-z][A-Za-z0-9]*)/g),
      (match) => match[1],
    )) {
      const value = this.segment(pathValues[name], name);
      path = path.replace(`:${name}`, encodeURIComponent(value));
    }
    if (path.includes(":"))
      throw this.invalid("Audiomack path parameters are incomplete.");
    const url = new URL(path, AudiomackApiAdapter.ORIGIN);
    this.appendFields(url.searchParams, query, 30);

    let requestBody: BodyInit | undefined;
    let bodyFields: Array<[string, string]> = [];
    const headers: Record<string, string> = { Accept: "application/json" };
    if (operation.method !== "GET") {
      if (operation.json) {
        const json = this.jsonBody(body);
        requestBody = JSON.stringify(json);
        if (Buffer.byteLength(requestBody) > 1_000_000)
          throw this.invalid("Audiomack JSON body exceeds 1 MB.");
        headers["Content-Type"] = "application/json";
      } else {
        bodyFields = this.scalarFields(body, 40);
        requestBody = new URLSearchParams(bodyFields).toString();
        if (Buffer.byteLength(requestBody) > 3_000_000)
          throw this.invalid("Audiomack form body exceeds 3 MB.");
        if (requestBody)
          headers["Content-Type"] = "application/x-www-form-urlencoded";
      }
    }
    headers.Authorization = this.authorization(
      operation.method,
      url,
      credentials,
      {},
      bodyFields,
    );
    const response = await this.fetch(url, {
      method: operation.method,
      headers,
      body: requestBody,
      redirect: "error",
      signal: AbortSignal.timeout(operation.method === "GET" ? 20_000 : 30_000),
    });
    return this.response(response);
  }

  private async tokenRequest(
    target: string,
    credentials: AudiomackCredentials,
    extra: Record<string, string>,
  ) {
    this.requireConsumer(credentials);
    const url = new URL(target);
    const response = await this.fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authorization("POST", url, credentials, extra, []),
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.text();
    if (!response.ok)
      throw new AudiomackApiError(
        this.code(response.status),
        this.oauthMessage(raw, response.status),
        response.status,
      );
    const params = new URLSearchParams(raw);
    const token = params.get("oauth_token") ?? "";
    const secret = params.get("oauth_token_secret") ?? "";
    if (!token || !secret)
      throw this.invalid("Audiomack token response was incomplete.");
    return { token, secret };
  }

  private authorization(
    method: string,
    url: URL,
    credentials: AudiomackCredentials,
    extra: Record<string, string>,
    body: Array<[string, string]>,
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
      ...extra,
    };
    const params: Array<[string, string]> = [
      ...url.searchParams.entries(),
      ...body,
      ...Object.entries(oauth),
    ];
    params.sort(([ak, av], [bk, bv]) =>
      ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk),
    );
    const normalized = params
      .map(([key, value]) => `${this.encode(key)}=${this.encode(value)}`)
      .join("&");
    const base = `${method.toUpperCase()}&${this.encode(`${url.origin}${url.pathname}`)}&${this.encode(normalized)}`;
    const signingKey = `${this.encode(credentials.consumerSecret)}&${this.encode(credentials.accessTokenSecret ?? "")}`;
    oauth.oauth_signature = createHmac("sha1", signingKey)
      .update(base)
      .digest("base64");
    return `OAuth ${Object.entries(oauth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${this.encode(key)}="${this.encode(value)}"`)
      .join(", ")}`;
  }

  private async response(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 5_000_000)
      throw this.invalid("Audiomack response exceeds 5 MB.");
    let data: unknown;
    try {
      data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      data = { response: raw.toString("utf8").slice(0, 100_000) };
    }
    data = this.redact(data);
    if (!response.ok)
      throw new AudiomackApiError(
        this.code(response.status),
        this.message(data, response.status),
        response.status,
      );
    return {
      data,
      rateLimit: { retryAfter: response.headers.get("retry-after") },
    };
  }

  private async fetch(url: URL, init: RequestInit) {
    try {
      return await safeConnectorFetch(url, { ...init, cache: "no-store" });
    } catch {
      throw new AudiomackApiError(
        "provider_unavailable",
        "Audiomack could not be reached.",
        502,
      );
    }
  }

  private object(value: unknown): JsonObject {
    if (value == null) return {};
    if (typeof value !== "object" || Array.isArray(value))
      throw this.invalid("Audiomack input section must be an object.");
    return value as JsonObject;
  }

  private jsonBody(value: unknown) {
    if (!Array.isArray(value) && (!value || typeof value !== "object"))
      throw this.invalid(
        "Audiomack pinned content body must be an object or array.",
      );
    return value;
  }

  private segment(value: unknown, name: string) {
    const text =
      typeof value === "number"
        ? String(value)
        : typeof value === "string"
          ? value.trim()
          : "";
    if (!text || text.length > 200 || !/^[A-Za-z0-9_.+-]+$/.test(text))
      throw this.invalid(`Audiomack path field ${name} is invalid.`);
    return text;
  }

  private appendFields(
    params: URLSearchParams,
    value: JsonObject,
    maximum: number,
  ) {
    for (const [key, text] of this.scalarFields(value, maximum)) {
      if (
        key === "limit" &&
        (!/^\d{1,3}$/.test(text) || Number(text) < 1 || Number(text) > 100)
      )
        throw this.invalid("Audiomack limit must be 1 through 100.");
      params.append(key, text);
    }
  }

  private scalarFields(
    value: unknown,
    maximum: number,
  ): Array<[string, string]> {
    const object = this.object(value);
    if (Object.keys(object).length > maximum)
      throw this.invalid("Audiomack request has too many fields.");
    return Object.entries(object).flatMap(([key, raw]) => {
      if (
        !/^[A-Za-z_][A-Za-z0-9_-]{0,99}$/.test(key) ||
        typeof raw === "object"
      )
        throw this.invalid(`Audiomack field ${key} is invalid.`);
      if (raw == null || raw === "") return [];
      const text = String(raw);
      if (text.length > 3_000_000 || /[\r\n]/.test(text))
        throw this.invalid(`Audiomack field ${key} is invalid.`);
      return [[key, text] as [string, string]];
    });
  }

  private requireConsumer(value: AudiomackCredentials) {
    this.credential(value.consumerKey, "consumer key");
    this.credential(value.consumerSecret, "consumer secret");
  }
  private requireCredentials(value: AudiomackCredentials) {
    this.requireConsumer(value);
    this.credential(value.accessToken ?? "", "access token");
    this.credential(value.accessTokenSecret ?? "", "access token secret");
  }
  private credential(value: string, label: string) {
    const text = value?.trim();
    if (!text || text.length > 20_000 || /[\r\n]/.test(text))
      throw new AudiomackApiError(
        "credential_missing",
        `Audiomack ${label} is missing.`,
        401,
      );
    return text;
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (depth > 12)
      throw new AudiomackApiError(
        "policy_blocked",
        "Audiomack input is too deeply nested.",
        403,
      );
    if (Array.isArray(value))
      return value.forEach((item) => this.rejectSecrets(item, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new AudiomackApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectSecrets(child, depth + 1);
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
          /(token|secret|authorization|password|cookie|api.?key|streaming_url)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }
  private message(value: unknown, status: number) {
    return value &&
      typeof value === "object" &&
      typeof (value as JsonObject).message === "string"
      ? String((value as JsonObject).message).slice(0, 500)
      : `Audiomack returned HTTP ${status}.`;
  }
  private oauthMessage(raw: string, status: number) {
    return (
      new URLSearchParams(raw).get("oauth_problem")?.slice(0, 500) ??
      `Audiomack OAuth returned HTTP ${status}.`
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
    return new AudiomackApiError("provider_validation_error", message, 400);
  }
}
