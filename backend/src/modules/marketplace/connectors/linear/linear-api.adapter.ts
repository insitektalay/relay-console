import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export class LinearApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class LinearApiAdapter {
  private readonly endpoint = "https://api.linear.app/graphql";

  async getIdentity(accessToken: string) {
    const data = await this.graphql(
      accessToken,
      `query RelayLinearIdentity { viewer { id name email } organization { id name urlKey } }`,
    );
    const viewer = this.object(data.viewer);
    const organization = this.object(data.organization);
    const userId = this.requiredId(viewer.id, "viewer.id");
    const organizationId = this.requiredId(organization.id, "organization.id");
    return {
      userId,
      name: this.text(viewer.name),
      email: this.text(viewer.email),
      organizationId,
      organizationName: this.text(organization.name),
      organizationKey: this.text(organization.urlKey),
    };
  }

  async listTeams(accessToken: string, maxInput: unknown) {
    const maxResults = this.limit(maxInput, 25);
    const data = await this.graphql(
      accessToken,
      `query RelayLinearTeams($first: Int!) { teams(first: $first) { nodes { id key name description private icon color } pageInfo { hasNextPage } } }`,
      { first: maxResults },
    );
    const connection = this.object(data.teams);
    const teams = this.array(connection.nodes)
      .slice(0, maxResults)
      .map((item) => this.shapeTeam(item));
    return {
      teams,
      count: teams.length,
      providerRequestCount: 1,
      nextCursorFollowed: false,
      hasMore: this.object(connection.pageInfo).hasNextPage === true,
    };
  }

  async searchIssues(
    accessToken: string,
    queryInput: unknown,
    teamIdInput: unknown,
    maxInput: unknown,
  ) {
    const query = this.requiredText(queryInput, "query", 200);
    const teamId = this.optionalId(teamIdInput, "teamId");
    const maxResults = this.limit(maxInput, 25);
    const filter = {
      title: { containsIgnoreCase: query },
      ...(teamId ? { team: { id: { eq: teamId } } } : {}),
    };
    const data = await this.graphql(
      accessToken,
      `query RelayLinearIssues($first: Int!, $filter: IssueFilter) { issues(first: $first, filter: $filter, orderBy: updatedAt) { nodes { id identifier title description priority createdAt updatedAt url state { id name type } team { id key name } assignee { id name } project { id name } } pageInfo { hasNextPage } } }`,
      { first: maxResults, filter },
    );
    const connection = this.object(data.issues);
    const issues = this.array(connection.nodes)
      .slice(0, maxResults)
      .map((item) => this.shapeIssue(item));
    return {
      query,
      teamId,
      issues,
      count: issues.length,
      providerRequestCount: 1,
      nextCursorFollowed: false,
      hasMore: this.object(connection.pageInfo).hasNextPage === true,
    };
  }

  async getIssue(
    accessToken: string,
    issueIdInput: unknown,
    maxCommentsInput: unknown,
  ) {
    const issueId = this.requiredId(issueIdInput, "issueId");
    const maxComments = this.limit(maxCommentsInput, 25);
    const data = await this.graphql(
      accessToken,
      `query RelayLinearIssue($id: String!, $comments: Int!) { issue(id: $id) { id identifier title description priority createdAt updatedAt url state { id name type } team { id key name } assignee { id name } project { id name } comments(first: $comments) { nodes { id body createdAt updatedAt url user { id name } } pageInfo { hasNextPage } } } }`,
      { id: issueId, comments: maxComments },
    );
    const issue = this.object(data.issue);
    const commentsConnection = this.object(issue.comments);
    const comments = this.array(commentsConnection.nodes)
      .slice(0, maxComments)
      .map((item) => this.shapeComment(item));
    return {
      issue: {
        ...this.shapeIssue(issue),
        comments,
        commentsHaveMore:
          this.object(commentsConnection.pageInfo).hasNextPage === true,
      },
      providerRequestCount: 1,
      nextCursorFollowed: false,
    };
  }

  async listProjects(accessToken: string, maxInput: unknown) {
    const maxResults = this.limit(maxInput, 25);
    const data = await this.graphql(
      accessToken,
      `query RelayLinearProjects($first: Int!) { projects(first: $first, orderBy: updatedAt) { nodes { id name description state createdAt updatedAt url progress lead { id name } teams { nodes { id key name } } } pageInfo { hasNextPage } } }`,
      { first: maxResults },
    );
    const connection = this.object(data.projects);
    const projects = this.array(connection.nodes)
      .slice(0, maxResults)
      .map((value) => {
        const project = this.object(value);
        return {
          id: this.requiredId(project.id, "project.id"),
          name: this.text(project.name),
          description: this.boundedText(project.description, 5000),
          state: this.text(project.state),
          url: this.httpsUrl(project.url),
          progress:
            typeof project.progress === "number" ? project.progress : null,
          createdAt: this.isoDate(project.createdAt),
          updatedAt: this.isoDate(project.updatedAt),
          lead: this.shapePerson(project.lead),
          teams: this.array(this.object(project.teams).nodes)
            .slice(0, 25)
            .map((team) => this.shapeTeam(team)),
        };
      });
    return {
      projects,
      count: projects.length,
      providerRequestCount: 1,
      nextCursorFollowed: false,
      hasMore: this.object(connection.pageInfo).hasNextPage === true,
    };
  }

  async createIssue(accessToken: string, input: JsonObject) {
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const issueInput = this.issueFields(input, true);
    const data = await this.graphql(
      accessToken,
      `mutation RelayLinearIssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title description priority createdAt updatedAt url state { id name type } team { id key name } assignee { id name } project { id name } } } }`,
      { input: issueInput },
    );
    const payload = this.object(data.issueCreate);
    if (payload.success !== true)
      throw new LinearApiError(
        "provider_validation_error",
        "Linear did not create the issue",
      );
    return {
      issue: this.shapeIssue(this.object(payload.issue)),
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async updateIssue(accessToken: string, input: JsonObject) {
    const issueId = this.requiredId(input.issueId, "issueId");
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const fields = this.issueFields(input, false);
    if (!Object.keys(fields).length)
      throw new LinearApiError(
        "provider_validation_error",
        "At least one issue field must be provided",
      );
    const data = await this.graphql(
      accessToken,
      `mutation RelayLinearIssueUpdate($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id identifier title description priority createdAt updatedAt url state { id name type } team { id key name } assignee { id name } project { id name } } } }`,
      { id: issueId, input: fields },
    );
    const payload = this.object(data.issueUpdate);
    if (payload.success !== true)
      throw new LinearApiError(
        "provider_validation_error",
        "Linear did not update the issue",
      );
    return {
      issue: this.shapeIssue(this.object(payload.issue)),
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  async createComment(accessToken: string, input: JsonObject) {
    const issueId = this.requiredId(input.issueId, "issueId");
    const body = this.requiredText(input.body, "body", 10000);
    const idempotencyKey = this.idempotencyKey(input.idempotencyKey);
    const data = await this.graphql(
      accessToken,
      `mutation RelayLinearCommentCreate($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id body createdAt updatedAt url user { id name } } } }`,
      { input: { issueId, body } },
    );
    const payload = this.object(data.commentCreate);
    if (payload.success !== true)
      throw new LinearApiError(
        "provider_validation_error",
        "Linear did not create the comment",
      );
    return {
      comment: this.shapeComment(this.object(payload.comment)),
      idempotencyKey,
      providerRequestCount: 1,
    };
  }

  private async graphql(
    accessToken: string,
    query: string,
    variables: JsonObject = {},
  ) {
    let response: Response;
    try {
      response = await safeConnectorFetch(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new LinearApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Linear request timed out"
          : "Linear request failed",
      );
    }
    const envelope = this.object(await response.json().catch(() => ({})));
    const errors = this.array(envelope.errors);
    if (!response.ok || errors.length) {
      const firstError = this.object(errors[0]);
      const code = this.text(this.object(firstError.extensions).code);
      throw new LinearApiError(
        response.status === 429 || code === "RATELIMITED"
          ? "provider_rate_limited"
          : response.status === 401
            ? "token_expired"
            : response.status === 403
              ? "scope_not_granted"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        response.status === 401
          ? "Linear authorization expired"
          : response.status === 403
            ? "Linear did not grant this operation"
            : response.status === 429 || code === "RATELIMITED"
              ? "Linear rate limit reached"
              : "Linear rejected the bounded request",
        response.status,
      );
    }
    return this.object(envelope.data);
  }

  private issueFields(input: JsonObject, creating: boolean) {
    const result: JsonObject = {};
    if (creating) {
      result.teamId = this.requiredId(input.teamId, "teamId");
      result.title = this.requiredText(input.title, "title", 200);
    } else if (input.title !== undefined)
      result.title = this.requiredText(input.title, "title", 200);
    if (input.description !== undefined)
      result.description = this.optionalText(
        input.description,
        "description",
        20000,
      );
    for (const key of ["projectId", "assigneeId"] as const)
      if (input[key] === null) result[key] = null;
      else if (input[key] !== undefined)
        result[key] = this.requiredId(input[key], key);
    if (input.stateId !== undefined)
      result.stateId = this.requiredId(input.stateId, "stateId");
    if (input.priority !== undefined) {
      const priority = Number(input.priority);
      if (!Number.isInteger(priority) || priority < 0 || priority > 4)
        throw new LinearApiError(
          "provider_validation_error",
          "priority must be between zero and four",
        );
      result.priority = priority;
    }
    return result;
  }
  private shapeIssue(value: unknown) {
    const issue = this.object(value);
    return {
      id: this.requiredId(issue.id, "issue.id"),
      identifier: this.text(issue.identifier),
      title: this.text(issue.title),
      description: this.boundedText(issue.description, 20000),
      priority: typeof issue.priority === "number" ? issue.priority : null,
      url: this.httpsUrl(issue.url),
      createdAt: this.isoDate(issue.createdAt),
      updatedAt: this.isoDate(issue.updatedAt),
      state: this.shapeNamed(issue.state),
      team: this.shapeTeam(issue.team),
      assignee: this.shapePerson(issue.assignee),
      project: this.shapeNamed(issue.project),
    };
  }
  private shapeTeam(value: unknown) {
    const team = this.object(value);
    return {
      id: this.requiredId(team.id, "team.id"),
      key: this.text(team.key),
      name: this.text(team.name),
      description: this.boundedText(team.description, 2000),
      private: team.private === true,
      icon: this.text(team.icon),
      color: this.text(team.color),
    };
  }
  private shapeComment(value: unknown) {
    const comment = this.object(value);
    return {
      id: this.requiredId(comment.id, "comment.id"),
      body: this.boundedText(comment.body, 10000),
      url: this.httpsUrl(comment.url),
      createdAt: this.isoDate(comment.createdAt),
      updatedAt: this.isoDate(comment.updatedAt),
      user: this.shapePerson(comment.user),
    };
  }
  private shapeNamed(value: unknown) {
    const item = this.object(value);
    const id = this.text(item.id);
    return id
      ? { id, name: this.text(item.name), type: this.text(item.type) }
      : null;
  }
  private shapePerson(value: unknown) {
    const item = this.object(value);
    const id = this.text(item.id);
    return id ? { id, name: this.text(item.name) } : null;
  }
  private limit(value: unknown, fallback: number) {
    const number = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(number) || number < 1 || number > fallback)
      throw new LinearApiError(
        "provider_validation_error",
        `limit must be between one and ${fallback}`,
      );
    return number;
  }
  private requiredId(value: unknown, field: string) {
    return this.requiredText(value, field, 100);
  }
  private optionalId(value: unknown, field: string) {
    return value === undefined || value === null || value === ""
      ? null
      : this.requiredId(value, field);
  }
  private idempotencyKey(value: unknown) {
    const key = this.text(value);
    if (
      !key ||
      key.length < 8 ||
      key.length > 128 ||
      !/^[A-Za-z0-9._:-]+$/.test(key)
    )
      throw new LinearApiError(
        "provider_validation_error",
        "idempotencyKey is invalid",
      );
    return key;
  }
  private requiredText(value: unknown, field: string, max: number) {
    const text = this.text(value)?.trim();
    if (!text || text.length > max)
      throw new LinearApiError(
        "provider_validation_error",
        `${field} is required and must be ${max} characters or fewer`,
      );
    return text;
  }
  private optionalText(value: unknown, field: string, max: number) {
    if (value === null) return null;
    const text = this.text(value);
    if (text === null || text.length > max)
      throw new LinearApiError(
        "provider_validation_error",
        `${field} must be ${max} characters or fewer`,
      );
    return text;
  }
  private boundedText(value: unknown, max: number) {
    return this.text(value)?.slice(0, max) ?? null;
  }
  private httpsUrl(value: unknown) {
    const text = this.text(value);
    if (!text) return null;
    try {
      const url = new URL(text);
      return url.protocol === "https:" &&
        (url.hostname === "linear.app" || url.hostname.endsWith(".linear.app"))
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }
  private isoDate(value: unknown) {
    const text = this.text(value);
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }
  private text(value: unknown) {
    return typeof value === "string" ? value : null;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }
}
