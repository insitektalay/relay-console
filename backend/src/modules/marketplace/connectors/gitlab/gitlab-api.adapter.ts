import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class GitLabApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class GitLabApiAdapter {
  private readonly baseUrl = "https://gitlab.com/api/v4";

  async getUser(accessToken: string) {
    const body = this.object(await this.request(accessToken, "/user"));
    const id = this.number(body.id);
    const username = this.string(body.username);
    if (id === null || !username)
      throw new GitLabApiError(
        "provider_validation_error",
        "GitLab connected-user identity is incomplete",
      );
    return { id: String(id), username };
  }

  async searchProjects(
    accessToken: string,
    queryInput: unknown,
    maxResultsInput: unknown,
  ) {
    const query = this.requiredText(queryInput, "query", 256);
    const maxResults = this.limit(maxResultsInput, 25);
    const projects = this.array(
      await this.request(accessToken, "/projects", {
        search: query,
        membership: "true",
        simple: "true",
        order_by: "last_activity_at",
        sort: "desc",
        per_page: String(maxResults),
        page: "1",
      }),
    )
      .slice(0, maxResults)
      .map((value) => this.shapeProject(value));
    return {
      query,
      projects,
      count: projects.length,
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async listIssues(
    accessToken: string,
    projectPathInput: unknown,
    stateInput: unknown,
    maxResultsInput: unknown,
  ) {
    const projectPath = this.projectPath(projectPathInput);
    const state = this.issueState(stateInput);
    const maxResults = this.limit(maxResultsInput, 50);
    const query: Record<string, string> = {
      per_page: String(maxResults),
      page: "1",
      order_by: "updated_at",
      sort: "desc",
    };
    if (state !== "all") query.state = state;
    const issues = this.array(
      await this.request(
        accessToken,
        `/projects/${encodeURIComponent(projectPath)}/issues`,
        query,
      ),
    )
      .slice(0, maxResults)
      .map((value) => this.shapeIssue(value));
    return {
      projectPath,
      state,
      issues,
      count: issues.length,
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async listMergeRequests(
    accessToken: string,
    projectPathInput: unknown,
    stateInput: unknown,
    maxResultsInput: unknown,
  ) {
    const projectPath = this.projectPath(projectPathInput);
    const state = this.mergeRequestState(stateInput);
    const maxResults = this.limit(maxResultsInput, 50);
    const query: Record<string, string> = {
      scope: "all",
      per_page: String(maxResults),
      page: "1",
      order_by: "updated_at",
      sort: "desc",
    };
    if (state !== "all") query.state = state;
    const mergeRequests = this.array(
      await this.request(
        accessToken,
        `/projects/${encodeURIComponent(projectPath)}/merge_requests`,
        query,
      ),
    )
      .slice(0, maxResults)
      .map((value) => this.shapeMergeRequest(value));
    return {
      projectPath,
      state,
      mergeRequests,
      count: mergeRequests.length,
      providerRequestCount: 1,
      nextPageFollowed: false,
    };
  }

  async createComment(
    accessToken: string,
    input: {
      projectPath: unknown;
      iid: unknown;
      target: "issue" | "merge_request";
      body: unknown;
      idempotencyKey: unknown;
    },
  ) {
    const projectPath = this.projectPath(input.projectPath);
    const iid = this.positiveInteger(input.iid, "iid");
    const body = this.requiredText(input.body, "body", 8000);
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const resource = input.target === "issue" ? "issues" : "merge_requests";
    const response = this.object(
      await this.request(
        accessToken,
        `/projects/${encodeURIComponent(projectPath)}/${resource}/${iid}/notes`,
        undefined,
        { body },
      ),
    );
    const noteId = this.number(response.id);
    if (noteId === null)
      throw new GitLabApiError(
        "provider_validation_error",
        "GitLab comment response is incomplete",
      );
    return {
      projectPath,
      iid,
      target: input.target,
      noteId: String(noteId),
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
      throw new GitLabApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "GitLab request timed out"
          : "GitLab request failed",
      );
    }
    const value = await this.safeBody(response);
    if (!response.ok)
      throw new GitLabApiError(
        this.errorCode(response.status),
        this.safeErrorMessage(response.status),
        response.status,
      );
    return value;
  }

  private shapeProject(value: unknown) {
    const project = this.object(value);
    const id = this.number(project.id);
    const pathWithNamespace = this.string(project.path_with_namespace);
    if (id === null || !pathWithNamespace)
      throw new GitLabApiError(
        "provider_validation_error",
        "GitLab project result is incomplete",
      );
    return {
      id: String(id),
      pathWithNamespace,
      name: this.string(project.name),
      description: this.text(project.description, 1000),
      visibility: this.string(project.visibility),
      webUrl: this.httpsUrl(project.web_url),
      defaultBranch: this.string(project.default_branch),
      lastActivityAt: this.isoDate(project.last_activity_at),
    };
  }

  private shapeIssue(value: unknown) {
    const issue = this.object(value);
    const iid = this.number(issue.iid);
    const title = this.string(issue.title);
    if (iid === null || !title)
      throw new GitLabApiError(
        "provider_validation_error",
        "GitLab issue result is incomplete",
      );
    const author = this.object(issue.author);
    return {
      id: this.numberString(issue.id),
      iid,
      title,
      state: this.string(issue.state),
      author: this.string(author.username),
      webUrl: this.httpsUrl(issue.web_url),
      createdAt: this.isoDate(issue.created_at),
      updatedAt: this.isoDate(issue.updated_at),
    };
  }

  private shapeMergeRequest(value: unknown) {
    const mr = this.object(value);
    const iid = this.number(mr.iid);
    const title = this.string(mr.title);
    if (iid === null || !title)
      throw new GitLabApiError(
        "provider_validation_error",
        "GitLab merge-request result is incomplete",
      );
    const author = this.object(mr.author);
    return {
      id: this.numberString(mr.id),
      iid,
      title,
      state: this.string(mr.state),
      isDraft: mr.draft === true,
      author: this.string(author.username),
      sourceBranch: this.string(mr.source_branch),
      targetBranch: this.string(mr.target_branch),
      detailedMergeStatus: this.string(mr.detailed_merge_status),
      webUrl: this.httpsUrl(mr.web_url),
      createdAt: this.isoDate(mr.created_at),
      updatedAt: this.isoDate(mr.updated_at),
    };
  }

  private projectPath(value: unknown) {
    const path = this.string(value);
    if (
      !path ||
      path.length > 255 ||
      path.startsWith("/") ||
      path.endsWith("/") ||
      !/^[A-Za-z0-9_.\/-]+$/.test(path)
    )
      throw new GitLabApiError(
        "provider_validation_error",
        "projectPath must be a valid GitLab namespace/project path",
      );
    return path;
  }
  private issueState(value: unknown) {
    const state = this.string(value) ?? "opened";
    if (!["opened", "closed", "all"].includes(state))
      throw new GitLabApiError(
        "provider_validation_error",
        "state must be opened, closed, or all",
      );
    return state;
  }
  private mergeRequestState(value: unknown) {
    const state = this.string(value) ?? "opened";
    if (!["opened", "closed", "merged", "all"].includes(state))
      throw new GitLabApiError(
        "provider_validation_error",
        "state must be opened, closed, merged, or all",
      );
    return state;
  }
  private positiveInteger(value: unknown, field: string) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < 1)
      throw new GitLabApiError(
        "provider_validation_error",
        `${field} must be a positive integer`,
      );
    return number;
  }
  private idempotencyKey(value: unknown) {
    const key = this.string(value);
    if (!key || !/^[A-Za-z0-9_-]{8,64}$/.test(key))
      throw new GitLabApiError(
        "provider_validation_error",
        "idempotencyKey must be 8 to 64 URL-safe characters",
      );
    return key;
  }
  private requiredText(value: unknown, field: string, maximum: number) {
    const text = this.string(value);
    if (!text)
      throw new GitLabApiError(
        "provider_validation_error",
        `${field} is required`,
      );
    if (text.length > maximum)
      throw new GitLabApiError(
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
  private numberString(value: unknown) {
    const number = this.number(value);
    return number === null ? null : String(number);
  }
  private isoDate(value: unknown) {
    const text = this.string(value);
    return !text || Number.isNaN(Date.parse(text))
      ? null
      : new Date(text).toISOString();
  }
  private httpsUrl(value: unknown) {
    const text = this.string(value);
    if (!text) return null;
    try {
      const url = new URL(text);
      return url.protocol === "https:" && url.hostname === "gitlab.com"
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
    if (status === 404 || status === 400 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private safeErrorMessage(status: number) {
    if (status === 401) return "GitLab authorization is invalid or expired";
    if (status === 403) return "GitLab authorization lacks required permission";
    if (status === 404) return "GitLab project or resource was not found";
    if (status === 429) return "GitLab rate limit reached";
    if (status >= 500) return "GitLab is temporarily unavailable";
    return "GitLab rejected the supplied request";
  }
}
