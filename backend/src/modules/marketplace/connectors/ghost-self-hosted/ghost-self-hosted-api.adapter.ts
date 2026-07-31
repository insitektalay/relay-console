import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type GhostSelfHostedCredentials = {
  installationUrl: string;
  adminApiKey: string;
};

export class GhostSelfHostedApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class GhostSelfHostedApiAdapter {
  async health(credentials: GhostSelfHostedCredentials) {
    await this.listPosts(credentials, { limit: 1 });
    const url = await this.baseUrl(credentials.installationUrl);
    return { host: url.hostname };
  }

  async listPosts(credentials: GhostSelfHostedCredentials, input: JsonObject) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const target = await this.postsUrl(credentials, "");
    target.searchParams.set("limit", String(limit));
    target.searchParams.set("page", "1");
    target.searchParams.set("order", "updated_at DESC");
    target.searchParams.set("fields", this.fields(false));
    const parsed = await this.request(credentials, target, "GET");
    return this.shapeCollection(parsed, limit);
  }

  async getPost(credentials: GhostSelfHostedCredentials, input: JsonObject) {
    const id = this.postId(input.postId);
    const target = await this.postsUrl(credentials, `${id}/`);
    target.searchParams.set("fields", this.fields(true));
    target.searchParams.set("formats", "html");
    const parsed = await this.request(credentials, target, "GET");
    return this.shapePost(this.firstPost(parsed), true);
  }

  async createDraft(
    credentials: GhostSelfHostedCredentials,
    input: JsonObject,
  ) {
    const title = this.requiredText(input.title, "title", 1, 200);
    const html = this.requiredText(input.html, "HTML", 1, 50_000);
    const target = await this.postsUrl(credentials, "");
    target.searchParams.set("source", "html");
    target.searchParams.set("fields", this.fields(false));
    const parsed = await this.request(credentials, target, "POST", {
      posts: [{ title, html, status: "draft" }],
    });
    return this.shapePost(this.firstPost(parsed), false);
  }

  async updatePost(credentials: GhostSelfHostedCredentials, input: JsonObject) {
    const id = this.postId(input.postId);
    const updatedAt = this.timestamp(input.updatedAt);
    const update: JsonObject = { updated_at: updatedAt };
    if (input.title !== undefined)
      update.title = this.requiredText(input.title, "title", 1, 200);
    if (input.html !== undefined)
      update.html = this.requiredText(input.html, "HTML", 1, 50_000);
    if (update.title === undefined && update.html === undefined)
      throw this.invalid("Provide a title or HTML update.");
    const target = await this.postsUrl(credentials, `${id}/`);
    target.searchParams.set("source", "html");
    target.searchParams.set("fields", this.fields(false));
    const parsed = await this.request(credentials, target, "PUT", {
      posts: [update],
    });
    return this.shapePost(this.firstPost(parsed), false);
  }

  async setStatus(credentials: GhostSelfHostedCredentials, input: JsonObject) {
    const id = this.postId(input.postId);
    const updatedAt = this.timestamp(input.updatedAt);
    const status = String(input.status ?? "");
    if (!["draft", "published"].includes(status))
      throw this.invalid("Ghost post status must be draft or published.");
    const target = await this.postsUrl(credentials, `${id}/`);
    target.searchParams.set("fields", this.fields(false));
    const parsed = await this.request(credentials, target, "PUT", {
      posts: [{ status, updated_at: updatedAt }],
    });
    return this.shapePost(this.firstPost(parsed), false);
  }

  async deletePost(credentials: GhostSelfHostedCredentials, input: JsonObject) {
    const id = this.postId(input.postId);
    const target = await this.postsUrl(credentials, `${id}/`);
    await this.request(credentials, target, "DELETE");
    return { deleted: true, postId: id };
  }

  private async postsUrl(
    credentials: GhostSelfHostedCredentials,
    suffix: string,
  ) {
    this.assertKey(credentials.adminApiKey);
    const base = await this.baseUrl(credentials.installationUrl);
    return new URL(
      `${base.toString().replace(/\/$/, "")}/ghost/api/admin/posts/${suffix}`,
    );
  }

  private async request(
    credentials: GhostSelfHostedCredentials,
    target: URL,
    method: "GET" | "POST" | "PUT" | "DELETE",
    body?: JsonObject,
  ) {
    let response: Response;
    try {
      response = await safeConnectorFetch(target, {
        method,
        headers: {
          Accept: "application/json",
          "Accept-Version": "v6.0",
          Authorization: `Ghost ${this.token(credentials.adminApiKey)}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0",
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new GhostSelfHostedApiError(
        "provider_unavailable",
        "Ghost Self-Hosted could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 262_144)
      throw this.invalid(
        "Ghost Self-Hosted response exceeded the 256 KiB Relay limit.",
      );
    if (!response.ok)
      throw new GhostSelfHostedApiError(
        this.safeCode(response.status),
        "Ghost Self-Hosted rejected the bounded Admin API request.",
        response.status,
      );
    if (!raw.byteLength) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      throw new GhostSelfHostedApiError(
        "provider_unavailable",
        "Ghost Self-Hosted returned invalid JSON.",
        response.status,
      );
    }
  }

  private token(key: string) {
    this.assertKey(key);
    const [id, secret] = key.split(":");
    const now = Math.floor(Date.now() / 1000);
    const header = this.base64url(
      JSON.stringify({ alg: "HS256", kid: id, typ: "JWT" }),
    );
    const payload = this.base64url(
      JSON.stringify({ iat: now, exp: now + 60, aud: "/admin/" }),
    );
    const unsigned = `${header}.${payload}`;
    const signature = createHmac("sha256", Buffer.from(secret, "hex"))
      .update(unsigned)
      .digest("base64url");
    return `${unsigned}.${signature}`;
  }

  private base64url(value: string) {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  private fields(includeHtml: boolean) {
    const fields = [
      "id",
      "title",
      "slug",
      "status",
      "visibility",
      "created_at",
      "updated_at",
      "published_at",
    ];
    if (includeHtml) fields.push("html");
    return fields.join(",");
  }

  private shapeCollection(value: unknown, limit: number) {
    const envelope = this.object(value);
    const posts = Array.isArray(envelope?.posts) ? envelope.posts : null;
    if (!posts)
      throw this.invalid("Ghost Self-Hosted returned an invalid posts list.");
    const rows = posts
      .slice(0, limit)
      .map((post) => this.shapePost(post, false));
    const pagination = this.object(this.object(envelope?.meta)?.pagination);
    const total = this.number(pagination?.total);
    return {
      rows,
      count: rows.length,
      total,
      truncated: total !== null ? total > rows.length : posts.length >= limit,
    };
  }

  private firstPost(value: unknown) {
    const posts = this.object(value)?.posts;
    if (!Array.isArray(posts) || !posts.length)
      throw this.invalid(
        "Ghost Self-Hosted returned an invalid post response.",
      );
    return posts[0];
  }

  private shapePost(value: unknown, includeHtml: boolean) {
    const post = this.object(value);
    const id = this.text(post?.id, 64);
    const title = this.text(post?.title, 200);
    const updatedAt = this.text(post?.updated_at, 40);
    if (!post || !id || !title || !updatedAt)
      throw this.invalid("Ghost Self-Hosted returned an invalid post.");
    const result: JsonObject = {
      id,
      title,
      slug: this.text(post.slug, 200),
      status: this.text(post.status, 40),
      visibility: this.text(post.visibility, 40),
      createdAt: this.text(post.created_at, 40),
      updatedAt,
      publishedAt: this.text(post.published_at, 40),
    };
    if (includeHtml && typeof post.html === "string")
      result.html = post.html.slice(0, 50_000);
    return result;
  }

  private async baseUrl(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.invalid("Enter a valid Ghost installation URL.");
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
      throw new GhostSelfHostedApiError(
        "policy_blocked",
        "Ghost Self-Hosted requires a public HTTPS installation URL without embedded credentials, ports, query, or fragment.",
        403,
      );
    await this.requirePublicHost(url.hostname);
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url;
  }

  private async requirePublicHost(hostname: string) {
    if (isIP(hostname) && this.isPrivateAddress(hostname))
      throw new GhostSelfHostedApiError(
        "policy_blocked",
        "Ghost Self-Hosted cannot use a private, local, reserved, or link-local address.",
        403,
      );
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new GhostSelfHostedApiError(
        "provider_unavailable",
        "Ghost Self-Hosted hostname could not be resolved.",
        502,
      );
    }
    if (
      !addresses.length ||
      addresses.some((item) => this.isPrivateAddress(item.address))
    )
      throw new GhostSelfHostedApiError(
        "policy_blocked",
        "Ghost Self-Hosted hostname must resolve only to public addresses.",
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

  private assertKey(key: string) {
    if (!/^[0-9a-f]{8,64}:[0-9a-f]{32,128}$/i.test(key))
      throw new GhostSelfHostedApiError(
        "credential_missing",
        "A valid Ghost Admin API key is required.",
        401,
      );
  }

  private postId(value: unknown) {
    const id = String(value ?? "");
    if (!/^[0-9a-f]{24}$/i.test(id))
      throw this.invalid("Ghost post ID must be one exact 24-character ID.");
    return id;
  }

  private timestamp(value: unknown) {
    const timestamp = String(value ?? "");
    if (
      timestamp.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp) ||
      !Number.isFinite(Date.parse(timestamp))
    )
      throw this.invalid("Ghost updatedAt must be an exact UTC timestamp.");
    return timestamp;
  }

  private requiredText(
    value: unknown,
    label: string,
    minimum: number,
    maximum: number,
  ) {
    if (typeof value !== "string")
      throw this.invalid(`Ghost ${label} is required.`);
    const text = value.trim();
    if (text.length < minimum || text.length > maximum || /\u0000/.test(text))
      throw this.invalid(
        `Ghost ${label} must be between ${minimum} and ${maximum} characters.`,
      );
    return text;
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
        `Ghost integer must be between ${minimum} and ${maximum}.`,
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
    return new GhostSelfHostedApiError("provider_validation_error", message);
  }
}
