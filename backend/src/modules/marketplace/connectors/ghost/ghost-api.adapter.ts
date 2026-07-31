import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type GhostCredentials = { adminUrl: string; adminApiKey: string };

export class GhostApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class GhostApiAdapter {
  getSite(credentials: GhostCredentials) {
    return this.request(credentials, "GET", "/site/");
  }

  async listPosts(credentials: GhostCredentials, input: JsonObject = {}) {
    const query = new URLSearchParams({
      limit: String(this.integer(input.limit, 15, 1, 25)),
      page: String(this.integer(input.page, 1, 1, 10_000)),
      formats: "lexical,html",
      order: this.enumValue(
        input.order,
        [
          "updated_at desc",
          "updated_at asc",
          "published_at desc",
          "published_at asc",
          "title asc",
          "title desc",
        ],
        "updated_at desc",
      ),
    });
    if (input.status !== undefined) {
      query.set(
        "filter",
        `status:${this.enumValue(input.status, ["draft", "published", "scheduled"], "draft")}`,
      );
    }
    return this.request(credentials, "GET", `/posts/?${query}`);
  }

  getPost(credentials: GhostCredentials, input: JsonObject) {
    const postId = this.id(input.postId, "postId");
    return this.request(
      credentials,
      "GET",
      `/posts/${encodeURIComponent(postId)}/?formats=lexical,html`,
    );
  }

  preparePostChange(input: JsonObject) {
    const operation = this.enumValue(
      input.operation,
      ["create_draft", "update_draft", "publish"],
      "create_draft",
    );
    const post = this.postInput(input, operation === "create_draft");
    if (operation !== "create_draft") {
      post.id = this.id(input.postId, "postId");
      post.updated_at = this.timestamp(
        input.expectedUpdatedAt,
        "expectedUpdatedAt",
      );
    }
    const normalized = { operation, post };
    return {
      ...normalized,
      digest: createHash("sha256")
        .update(JSON.stringify(normalized))
        .digest("hex"),
      mutatesProvider: false,
    };
  }

  createDraft(credentials: GhostCredentials, input: JsonObject) {
    const post = { ...this.postInput(input, true), status: "draft" };
    return this.request(credentials, "POST", "/posts/?source=html", {
      posts: [post],
    });
  }

  async updateDraft(credentials: GhostCredentials, input: JsonObject) {
    const postId = this.id(input.postId, "postId");
    const expectedUpdatedAt = this.timestamp(
      input.expectedUpdatedAt,
      "expectedUpdatedAt",
    );
    await this.assertCurrentDraft(credentials, postId, expectedUpdatedAt);
    const post = {
      ...this.postInput(input, false),
      id: postId,
      updated_at: expectedUpdatedAt,
      status: "draft",
    };
    if (Object.keys(post).length <= 3) {
      throw new GhostApiError(
        "provider_validation_error",
        "A Ghost draft update needs at least one changed field.",
      );
    }
    return this.request(
      credentials,
      "PUT",
      `/posts/${encodeURIComponent(postId)}/?source=html`,
      { posts: [post] },
    );
  }

  async publishPost(credentials: GhostCredentials, input: JsonObject) {
    const postId = this.id(input.postId, "postId");
    const expectedUpdatedAt = this.timestamp(
      input.expectedUpdatedAt,
      "expectedUpdatedAt",
    );
    await this.assertCurrentDraft(credentials, postId, expectedUpdatedAt);
    return this.request(
      credentials,
      "PUT",
      `/posts/${encodeURIComponent(postId)}/`,
      {
        posts: [
          { id: postId, updated_at: expectedUpdatedAt, status: "published" },
        ],
      },
    );
  }

  private async assertCurrentDraft(
    credentials: GhostCredentials,
    postId: string,
    expectedUpdatedAt: string,
  ) {
    const result = await this.getPost(credentials, { postId });
    const post = this.firstPost(result);
    if (!post) {
      throw new GhostApiError(
        "provider_validation_error",
        "Ghost did not return the requested post.",
      );
    }
    if (post.status !== "draft") {
      throw new GhostApiError(
        "policy_blocked",
        "Only a Ghost draft can be changed by this action.",
        403,
      );
    }
    if (post.updated_at !== expectedUpdatedAt) {
      throw new GhostApiError(
        "approval_mismatch",
        "The Ghost post changed after it was reviewed; reload it before retrying.",
        409,
      );
    }
  }

  private async request(
    credentials: GhostCredentials,
    method: "GET" | "POST" | "PUT",
    path: string,
    json?: JsonObject,
  ) {
    const origin = this.adminOrigin(credentials.adminUrl);
    const token = this.adminToken(credentials.adminApiKey);
    const url = new URL(`/ghost/api/admin${path}`, origin);
    const body = json ? JSON.stringify(json) : undefined;
    if (body && Buffer.byteLength(body) > 250_000) {
      throw new GhostApiError(
        "provider_validation_error",
        "Ghost request exceeds 250 KB.",
      );
    }
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Accept-Version": "v5.0",
          Authorization: `Ghost ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 2_000_000) {
        throw new GhostApiError(
          "provider_validation_error",
          "Ghost response exceeded Relay bounds.",
        );
      }
      const data = this.parse(raw);
      if (!response.ok) {
        throw new GhostApiError(
          this.safeCode(response.status),
          this.errorMessage(data, response.status),
          response.status,
        );
      }
      return this.redact(data);
    } catch (error) {
      if (error instanceof GhostApiError) throw error;
      throw new GhostApiError(
        "provider_unavailable",
        "Ghost could not be reached.",
        502,
      );
    }
  }

  private adminOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new GhostApiError(
        "provider_validation_error",
        "Ghost publication URL is invalid.",
      );
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      this.privateHost(url.hostname)
    ) {
      throw new GhostApiError(
        "policy_blocked",
        "Ghost publication URL must be a public HTTPS origin.",
        403,
      );
    }
    return url.origin;
  }

  private privateHost(hostname: string) {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    )
      return true;
    if (isIP(host) === 6) {
      return (
        host === "::1" ||
        host.startsWith("fc") ||
        host.startsWith("fd") ||
        host.startsWith("fe80:")
      );
    }
    if (isIP(host) === 4) {
      const [a, b] = host.split(".").map(Number);
      return (
        a === 10 ||
        a === 127 ||
        a === 0 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      );
    }
    return false;
  }

  private adminToken(value: string) {
    const match = /^([a-f0-9]{24}):([a-f0-9]{64})$/i.exec(value.trim());
    if (!match) {
      throw new GhostApiError(
        "credential_missing",
        "A valid Ghost Custom Integration Admin API key is required.",
        401,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const header = this.base64url({ alg: "HS256", kid: match[1], typ: "JWT" });
    const payload = this.base64url({
      iat: now,
      exp: now + 300,
      aud: "/admin/",
    });
    const unsigned = `${header}.${payload}`;
    const signature = createHmac("sha256", Buffer.from(match[2], "hex"))
      .update(unsigned)
      .digest("base64url");
    return `${unsigned}.${signature}`;
  }

  private base64url(value: JsonObject) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  }

  private postInput(input: JsonObject, requireContent: boolean) {
    const post: JsonObject = {};
    const title = this.optionalString(input.title, 300);
    const html = this.optionalString(input.html, 100_000);
    if (requireContent && (!title || !html)) {
      throw new GhostApiError(
        "provider_validation_error",
        "A Ghost draft requires a title and HTML content.",
      );
    }
    if (title !== undefined) post.title = title;
    if (html !== undefined) post.html = html;
    const excerpt = this.optionalString(input.customExcerpt, 300);
    if (excerpt !== undefined) post.custom_excerpt = excerpt;
    const slug = this.optionalString(input.slug, 200);
    if (slug !== undefined) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new GhostApiError(
          "provider_validation_error",
          "Ghost slug is invalid.",
        );
      }
      post.slug = slug;
    }
    if (input.featureImage !== undefined) {
      const image = this.publicHttpsUrl(input.featureImage, "featureImage");
      post.feature_image = image;
    }
    if (input.tags !== undefined) {
      if (!Array.isArray(input.tags) || input.tags.length > 20) {
        throw new GhostApiError(
          "provider_validation_error",
          "Ghost tags are invalid.",
        );
      }
      const names = input.tags.map((tag) =>
        this.requiredString(tag, "tag", 100),
      );
      if (
        new Set(names.map((name) => name.toLowerCase())).size !== names.length
      ) {
        throw new GhostApiError(
          "provider_validation_error",
          "Ghost tags contain duplicates.",
        );
      }
      post.tags = names.map((name) => ({ name }));
    }
    return post;
  }

  private publicHttpsUrl(value: unknown, field: string) {
    const text = this.requiredString(value, field, 2_000);
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new GhostApiError(
        "provider_validation_error",
        `Ghost ${field} is invalid.`,
      );
    }
    if (url.protocol !== "https:" || this.privateHost(url.hostname)) {
      throw new GhostApiError(
        "policy_blocked",
        `Ghost ${field} must use a public HTTPS URL.`,
        403,
      );
    }
    return url.toString();
  }

  private firstPost(value: unknown): JsonObject | null {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const posts = (value as JsonObject).posts;
    return Array.isArray(posts) && posts[0] && typeof posts[0] === "object"
      ? (posts[0] as JsonObject)
      : null;
  }

  private parse(raw: Buffer): unknown {
    const text = raw.toString("utf8");
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new GhostApiError(
        "provider_validation_error",
        "Ghost returned invalid JSON.",
      );
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 100_000);
    if (Array.isArray(value))
      return value.slice(0, 100).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 200)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorMessage(value: unknown, status: number) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const errors = (value as JsonObject).errors;
      if (Array.isArray(errors) && errors[0] && typeof errors[0] === "object") {
        const message = (errors[0] as JsonObject).message;
        if (typeof message === "string") return message.slice(0, 500);
      }
    }
    if (status === 401) return "Ghost rejected the Custom Integration key.";
    if (status === 403)
      return "Ghost denied this Custom Integration operation.";
    if (status === 429)
      return "Ghost rate limit reached; retry after the provider window.";
    if (status === 409)
      return "Ghost reported a content conflict; reload the post before retrying.";
    return `Ghost returned HTTP ${status}.`;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 409) return "approval_mismatch";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private id(value: unknown, field: string) {
    const text = this.requiredString(value, field, 64);
    if (!/^[a-f0-9-]+$/i.test(text)) {
      throw new GhostApiError(
        "provider_validation_error",
        `Ghost ${field} is invalid.`,
      );
    }
    return text;
  }

  private timestamp(value: unknown, field: string) {
    const text = this.requiredString(value, field, 40);
    if (!Number.isFinite(Date.parse(text))) {
      throw new GhostApiError(
        "provider_validation_error",
        `Ghost ${field} is invalid.`,
      );
    }
    return text;
  }

  private requiredString(value: unknown, field: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw new GhostApiError(
        "provider_validation_error",
        `Ghost ${field} is required and must be at most ${max} characters.`,
      );
    }
    return value.trim();
  }

  private optionalString(value: unknown, max: number) {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || value.length > max) {
      throw new GhostApiError(
        "provider_validation_error",
        "Ghost text field is invalid.",
      );
    }
    return value.trim();
  }

  private integer(value: unknown, fallback: number, min: number, max: number) {
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw new GhostApiError(
        "provider_validation_error",
        "Ghost pagination value is invalid.",
      );
    }
    return number;
  }

  private enumValue(value: unknown, allowed: string[], fallback: string) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !allowed.includes(value)) {
      throw new GhostApiError(
        "provider_validation_error",
        "Ghost enum value is invalid.",
      );
    }
    return value;
  }
}
