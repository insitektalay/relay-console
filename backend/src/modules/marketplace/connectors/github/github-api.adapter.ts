import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class GitHubApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class GitHubApiAdapter {
  private readonly baseUrl = "https://api.github.com";

  async getUser(accessToken: string) {
    const body = this.object(await this.request(accessToken, "/user"));
    const id = this.number(body.id);
    const login = this.string(body.login);
    if (id === null || !login) {
      throw new GitHubApiError(
        "provider_validation_error",
        "GitHub connected-user identity is incomplete",
      );
    }
    return { id: String(id), login };
  }

  async searchRepositories(
    accessToken: string,
    queryInput: unknown,
    maxResultsInput: unknown,
  ) {
    const query = this.requiredText(queryInput, "query", 256);
    const maxResults = this.limit(maxResultsInput, 25);
    const body = this.object(
      await this.request(accessToken, "/search/repositories", {
        q: query,
        per_page: String(maxResults),
      }),
    );
    const repositories = this.array(body.items)
      .slice(0, maxResults)
      .map((value) => this.shapeRepository(value));
    return {
      query,
      repositories,
      count: repositories.length,
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async listIssues(
    accessToken: string,
    ownerInput: unknown,
    repoInput: unknown,
    stateInput: unknown,
    maxResultsInput: unknown,
  ) {
    const { owner, repo } = this.repository(ownerInput, repoInput);
    const state = this.state(stateInput);
    const maxResults = this.limit(maxResultsInput, 50);
    const body = this.array(
      await this.request(
        accessToken,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
        { state, per_page: String(maxResults) },
      ),
    );
    const issues = body
      .filter((value) => !this.object(value).pull_request)
      .slice(0, maxResults)
      .map((value) => this.shapeIssue(value));
    return {
      owner,
      repo,
      state,
      issues,
      count: issues.length,
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async listPullRequests(
    accessToken: string,
    ownerInput: unknown,
    repoInput: unknown,
    stateInput: unknown,
    maxResultsInput: unknown,
  ) {
    const { owner, repo } = this.repository(ownerInput, repoInput);
    const state = this.state(stateInput);
    const maxResults = this.limit(maxResultsInput, 50);
    const body = this.array(
      await this.request(
        accessToken,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
        { state, per_page: String(maxResults) },
      ),
    );
    const pullRequests = body
      .slice(0, maxResults)
      .map((value) => this.shapePullRequest(value));
    return {
      owner,
      repo,
      state,
      pullRequests,
      count: pullRequests.length,
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async createConversationComment(
    accessToken: string,
    input: {
      owner: unknown;
      repo: unknown;
      number: unknown;
      body: unknown;
      idempotencyKey: unknown;
    },
  ) {
    const { owner, repo } = this.repository(input.owner, input.repo);
    const number = this.positiveInteger(input.number, "number");
    const body = this.requiredText(input.body, "body", 8000);
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const response = this.object(
      await this.request(
        accessToken,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}/comments`,
        undefined,
        { body },
      ),
    );
    const commentId = this.number(response.id);
    if (commentId === null) {
      throw new GitHubApiError(
        "provider_validation_error",
        "GitHub comment response is incomplete",
      );
    }
    return {
      owner,
      repo,
      number,
      commentId: String(commentId),
      commentUrl: this.httpsUrl(response.html_url),
      bodyHashInputLength: body.length,
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  private async request(
    accessToken: string,
    path: string,
    query?: Record<string, string>,
    jsonBody?: JsonObject,
  ) {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: jsonBody ? "POST" : "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${accessToken}`,
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": "RelayConsole",
          ...(jsonBody ? { "Content-Type": "application/json" } : {}),
        },
        body: jsonBody ? JSON.stringify(jsonBody) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new GitHubApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "GitHub request timed out"
          : "GitHub request failed",
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok) {
      throw new GitHubApiError(
        this.errorCode(response.status),
        this.safeErrorMessage(response.status, body),
        response.status,
      );
    }
    return body;
  }

  private shapeRepository(value: unknown) {
    const repository = this.object(value);
    const fullName = this.string(repository.full_name);
    if (!fullName) {
      throw new GitHubApiError(
        "provider_validation_error",
        "GitHub repository result is incomplete",
      );
    }
    const owner = this.object(repository.owner);
    return {
      id: this.numberString(repository.id),
      fullName,
      name: this.string(repository.name),
      owner: this.string(owner.login),
      description: this.text(repository.description, 1000),
      visibility: this.string(repository.visibility),
      isPrivate: repository.private === true,
      defaultBranch: this.string(repository.default_branch),
      url: this.httpsUrl(repository.html_url),
      updatedAt: this.isoDate(repository.updated_at),
    };
  }

  private shapeIssue(value: unknown) {
    const issue = this.object(value);
    const number = this.number(issue.number);
    const title = this.string(issue.title);
    if (number === null || !title) {
      throw new GitHubApiError(
        "provider_validation_error",
        "GitHub issue result is incomplete",
      );
    }
    const user = this.object(issue.user);
    return {
      id: this.numberString(issue.id),
      number,
      title,
      state: this.string(issue.state),
      author: this.string(user.login),
      comments: this.number(issue.comments),
      url: this.httpsUrl(issue.html_url),
      createdAt: this.isoDate(issue.created_at),
      updatedAt: this.isoDate(issue.updated_at),
    };
  }

  private shapePullRequest(value: unknown) {
    const pull = this.object(value);
    const number = this.number(pull.number);
    const title = this.string(pull.title);
    if (number === null || !title) {
      throw new GitHubApiError(
        "provider_validation_error",
        "GitHub pull-request result is incomplete",
      );
    }
    const user = this.object(pull.user);
    const head = this.object(pull.head);
    const base = this.object(pull.base);
    return {
      id: this.numberString(pull.id),
      number,
      title,
      state: this.string(pull.state),
      isDraft: pull.draft === true,
      author: this.string(user.login),
      head: this.string(head.ref),
      base: this.string(base.ref),
      url: this.httpsUrl(pull.html_url),
      createdAt: this.isoDate(pull.created_at),
      updatedAt: this.isoDate(pull.updated_at),
    };
  }

  private repository(ownerInput: unknown, repoInput: unknown) {
    const owner = this.repositoryPart(ownerInput, "owner");
    const repo = this.repositoryPart(repoInput, "repo");
    return { owner, repo };
  }

  private repositoryPart(value: unknown, field: string) {
    const text = this.string(value);
    if (!text || text.length > 100 || !/^[A-Za-z0-9_.-]+$/.test(text)) {
      throw new GitHubApiError(
        "provider_validation_error",
        `${field} must be a valid GitHub repository name component`,
      );
    }
    return text;
  }

  private state(value: unknown) {
    const state = this.string(value) ?? "open";
    if (!new Set(["open", "closed", "all"]).has(state)) {
      throw new GitHubApiError(
        "provider_validation_error",
        "state must be open, closed, or all",
      );
    }
    return state;
  }

  private positiveInteger(value: unknown, field: string) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < 1) {
      throw new GitHubApiError(
        "provider_validation_error",
        `${field} must be a positive integer`,
      );
    }
    return number;
  }

  private idempotencyKey(value: unknown) {
    const key = this.string(value);
    if (!key || !/^[A-Za-z0-9_-]{8,64}$/.test(key)) {
      throw new GitHubApiError(
        "provider_validation_error",
        "idempotencyKey must be 8 to 64 URL-safe characters",
      );
    }
    return key;
  }

  private requiredText(value: unknown, field: string, maximum: number) {
    const text = this.string(value);
    if (!text) {
      throw new GitHubApiError(
        "provider_validation_error",
        `${field} is required`,
      );
    }
    if (text.length > maximum) {
      throw new GitHubApiError(
        "provider_validation_error",
        `${field} must be ${maximum} characters or fewer`,
      );
    }
    return text;
  }

  private limit(value: unknown, maximum: number) {
    const number = typeof value === "number" ? value : Number(value ?? maximum);
    if (!Number.isFinite(number)) return maximum;
    return Math.max(1, Math.min(maximum, Math.trunc(number)));
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private string(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private text(value: unknown, maximum: number) {
    const text = this.string(value);
    return text === null ? null : text.slice(0, maximum);
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value)
      ? value
      : null;
  }

  private numberString(value: unknown) {
    const number = this.number(value);
    return number === null ? null : String(number);
  }

  private isoDate(value: unknown) {
    const text = this.string(value);
    if (!text || Number.isNaN(Date.parse(text))) return null;
    return new Date(text).toISOString();
  }

  private httpsUrl(value: unknown) {
    const text = this.string(value);
    if (!text) return null;
    try {
      const url = new URL(text);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }

  private async safeBody(response: Response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return {};
    }
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 422) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private safeErrorMessage(status: number, value: unknown) {
    const body = this.object(value);
    const providerMessage = this.string(body.message)?.toLowerCase() ?? "";
    if (status === 401) return "GitHub authorization is invalid or expired";
    if (status === 403 && providerMessage.includes("rate limit"))
      return "GitHub rate limit reached";
    if (status === 403) return "GitHub authorization lacks required permission";
    if (status === 404) return "GitHub repository or resource was not found";
    if (status === 422) return "GitHub rejected the supplied request fields";
    if (status === 429) return "GitHub rate limit reached";
    if (status >= 500) return "GitHub is temporarily unavailable";
    return "GitHub request was rejected";
  }
}
