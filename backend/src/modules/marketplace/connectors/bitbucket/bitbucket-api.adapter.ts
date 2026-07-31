import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class BitbucketApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class BitbucketApiAdapter {
  private readonly baseUrl = "https://api.bitbucket.org/2.0";

  async getUser(accessToken: string) {
    const body = this.object(await this.request(accessToken, "/user"));
    const uuid = this.string(body.uuid);
    const displayName = this.string(body.display_name);
    if (!uuid || !displayName)
      throw new BitbucketApiError(
        "provider_validation_error",
        "Bitbucket connected-user identity is incomplete",
      );
    return {
      uuid,
      accountId: this.string(body.account_id),
      nickname: this.string(body.nickname),
      displayName,
      avatarUrl: this.httpsUrl(this.object(body.links).avatar),
      webUrl: this.httpsUrl(this.object(body.links).html),
    };
  }

  async searchRepositories(
    accessToken: string,
    queryInput: unknown,
    maxResultsInput: unknown,
  ) {
    const query = this.requiredText(queryInput, "query", 256);
    const maxResults = this.limit(maxResultsInput, 25);
    const envelope = this.object(
      await this.request(accessToken, "/user/permissions/repositories", {
        q: `repository.name ~ ${JSON.stringify(query)}`,
        sort: "-repository.updated_on",
        pagelen: String(maxResults),
        page: "1",
      }),
    );
    const repositories = this.array(envelope.values)
      .slice(0, maxResults)
      .map((value) => this.shapeRepository(this.object(value).repository));
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
    repositoryPathInput: unknown,
    stateInput: unknown,
    maxResultsInput: unknown,
  ) {
    const repositoryPath = this.repositoryPath(repositoryPathInput);
    const state = this.issueState(stateInput);
    const maxResults = this.limit(maxResultsInput, 50);
    const envelope = this.object(
      await this.request(
        accessToken,
        `/repositories/${this.path(repositoryPath)}/issues`,
        {
          ...(state === "all" ? {} : { q: `state = ${JSON.stringify(state)}` }),
          sort: "-updated_on",
          pagelen: String(maxResults),
          page: "1",
        },
      ),
    );
    const issues = this.array(envelope.values)
      .slice(0, maxResults)
      .map((value) => this.shapeIssue(value));
    return {
      repositoryPath,
      state,
      issues,
      count: issues.length,
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async listPullRequests(
    accessToken: string,
    repositoryPathInput: unknown,
    stateInput: unknown,
    maxResultsInput: unknown,
  ) {
    const repositoryPath = this.repositoryPath(repositoryPathInput);
    const state = this.pullRequestState(stateInput);
    const maxResults = this.limit(maxResultsInput, 50);
    const envelope = this.object(
      await this.request(
        accessToken,
        `/repositories/${this.path(repositoryPath)}/pullrequests`,
        {
          ...(state === "all" ? {} : { state }),
          sort: "-updated_on",
          pagelen: String(maxResults),
          page: "1",
        },
      ),
    );
    const pullRequests = this.array(envelope.values)
      .slice(0, maxResults)
      .map((value) => this.shapePullRequest(value));
    return {
      repositoryPath,
      state,
      pullRequests,
      count: pullRequests.length,
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async createComment(
    accessToken: string,
    input: {
      repositoryPath: unknown;
      id: unknown;
      target: "issue" | "pull_request";
      body: unknown;
      idempotencyKey: unknown;
    },
  ) {
    const repositoryPath = this.repositoryPath(input.repositoryPath);
    const id = this.positiveInteger(input.id, "id");
    const body = this.requiredText(input.body, "body", 8000);
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const collection = input.target === "issue" ? "issues" : "pullrequests";
    const response = this.object(
      await this.request(
        accessToken,
        `/repositories/${this.path(repositoryPath)}/${collection}/${id}/comments`,
        undefined,
        { content: { raw: body } },
      ),
    );
    const commentId = this.number(response.id);
    if (commentId === null)
      throw new BitbucketApiError(
        "provider_validation_error",
        "Bitbucket comment response is incomplete",
      );
    return {
      repositoryPath,
      id,
      target: input.target,
      commentId: String(commentId),
      webUrl: this.httpsUrl(this.object(response.links).html),
      bodyLength: body.length,
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
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {}))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: jsonBody ? "POST" : "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(jsonBody ? { "Content-Type": "application/json" } : {}),
        },
        body: jsonBody ? JSON.stringify(jsonBody) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new BitbucketApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Bitbucket request timed out"
          : "Bitbucket request failed",
      );
    }
    const value = await this.safeBody(response);
    if (!response.ok)
      throw new BitbucketApiError(
        this.errorCode(response.status),
        this.safeErrorMessage(response.status),
        response.status,
      );
    return value;
  }

  private shapeRepository(value: unknown) {
    const repository = this.object(value);
    const uuid = this.string(repository.uuid);
    const fullName = this.string(repository.full_name);
    if (!uuid || !fullName)
      throw new BitbucketApiError(
        "provider_validation_error",
        "Bitbucket repository result is incomplete",
      );
    return {
      uuid,
      fullName,
      name: this.string(repository.name),
      description: this.text(repository.description, 1000),
      isPrivate: repository.is_private === true,
      language: this.string(repository.language),
      mainBranch: this.string(this.object(repository.mainbranch).name),
      webUrl: this.httpsUrl(this.object(repository.links).html),
      updatedAt: this.isoDate(repository.updated_on),
    };
  }

  private shapeIssue(value: unknown) {
    const issue = this.object(value);
    const id = this.number(issue.id);
    const title = this.string(issue.title);
    if (id === null || !title)
      throw new BitbucketApiError(
        "provider_validation_error",
        "Bitbucket issue result is incomplete",
      );
    return {
      id,
      title,
      state: this.string(issue.state),
      priority: this.string(issue.priority),
      reporter: this.string(this.object(issue.reporter).display_name),
      webUrl: this.httpsUrl(this.object(issue.links).html),
      createdAt: this.isoDate(issue.created_on),
      updatedAt: this.isoDate(issue.updated_on),
    };
  }

  private shapePullRequest(value: unknown) {
    const pullRequest = this.object(value);
    const id = this.number(pullRequest.id);
    const title = this.string(pullRequest.title);
    if (id === null || !title)
      throw new BitbucketApiError(
        "provider_validation_error",
        "Bitbucket pull-request result is incomplete",
      );
    return {
      id,
      title,
      state: this.string(pullRequest.state),
      author: this.string(this.object(pullRequest.author).display_name),
      sourceBranch: this.string(
        this.object(this.object(pullRequest.source).branch).name,
      ),
      destinationBranch: this.string(
        this.object(this.object(pullRequest.destination).branch).name,
      ),
      webUrl: this.httpsUrl(this.object(pullRequest.links).html),
      createdAt: this.isoDate(pullRequest.created_on),
      updatedAt: this.isoDate(pullRequest.updated_on),
    };
  }

  private repositoryPath(value: unknown) {
    const path = this.string(value);
    if (
      !path ||
      path.length > 255 ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(path)
    )
      throw new BitbucketApiError(
        "provider_validation_error",
        "repositoryPath must be a workspace/repository slug",
      );
    return path;
  }
  private path(value: string) {
    return value.split("/").map(encodeURIComponent).join("/");
  }
  private issueState(value: unknown) {
    const state = this.string(value) ?? "open";
    if (
      ![
        "new",
        "open",
        "resolved",
        "on hold",
        "invalid",
        "duplicate",
        "wontfix",
        "closed",
        "all",
      ].includes(state)
    )
      throw new BitbucketApiError(
        "provider_validation_error",
        "state is not a supported Bitbucket issue state",
      );
    return state;
  }
  private pullRequestState(value: unknown) {
    const state = this.string(value) ?? "OPEN";
    if (!["OPEN", "MERGED", "DECLINED", "SUPERSEDED", "all"].includes(state))
      throw new BitbucketApiError(
        "provider_validation_error",
        "state is not a supported Bitbucket pull-request state",
      );
    return state;
  }
  private positiveInteger(value: unknown, field: string) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < 1)
      throw new BitbucketApiError(
        "provider_validation_error",
        `${field} must be a positive integer`,
      );
    return number;
  }
  private idempotencyKey(value: unknown) {
    const key = this.string(value);
    if (!key || !/^[A-Za-z0-9_-]{8,64}$/.test(key))
      throw new BitbucketApiError(
        "provider_validation_error",
        "idempotencyKey must be 8 to 64 URL-safe characters",
      );
    return key;
  }
  private requiredText(value: unknown, field: string, maximum: number) {
    const text = this.string(value);
    if (!text)
      throw new BitbucketApiError(
        "provider_validation_error",
        `${field} is required`,
      );
    if (text.length > maximum)
      throw new BitbucketApiError(
        "provider_validation_error",
        `${field} must be ${maximum} characters or fewer`,
      );
    return text;
  }
  private limit(value: unknown, maximum: number) {
    const number = typeof value === "number" ? value : Number(value ?? maximum);
    return Number.isFinite(number)
      ? Math.max(1, Math.min(maximum, Math.trunc(number)))
      : maximum;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
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
  private isoDate(value: unknown) {
    const text = this.string(value);
    return !text || Number.isNaN(Date.parse(text))
      ? null
      : new Date(text).toISOString();
  }
  private httpsUrl(value: unknown) {
    const href = this.string(this.object(value).href) ?? this.string(value);
    if (!href) return null;
    try {
      const url = new URL(href);
      return url.protocol === "https:" &&
        ["bitbucket.org", "api.bitbucket.org"].includes(url.hostname)
        ? url.toString()
        : null;
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
    if ([400, 404, 422].includes(status)) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private safeErrorMessage(status: number) {
    if (status === 401) return "Bitbucket authorization is invalid or expired";
    if (status === 403)
      return "Bitbucket authorization lacks required permission";
    if (status === 404) return "Bitbucket repository or resource was not found";
    if (status === 429) return "Bitbucket rate limit reached";
    if (status >= 500) return "Bitbucket is temporarily unavailable";
    return "Bitbucket rejected the supplied request";
  }
}
