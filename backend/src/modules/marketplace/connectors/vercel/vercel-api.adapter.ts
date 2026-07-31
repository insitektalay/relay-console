export const VERCEL_API_ORIGIN = "https://api.vercel.com";

export type VercelCredentials = {
  accessToken: string;
  projectId: string;
  teamId: string | null;
  installationId: string;
};

export class VercelApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class VercelApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: VercelCredentials) {
    const result = await this.getProject(credentials);
    return {
      ready: true,
      projectId: result.project.id,
      projectName: result.project.name,
      teamId: credentials.teamId,
      installationId: this.id(credentials.installationId, "installation"),
    };
  }

  async listProjects(
    credentials: VercelCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const body = await this.request(
      credentials,
      "/v9/projects",
      this.query(credentials, { limit: String(limit) }),
    );
    const root = this.record(body);
    const projects = this.array(root.projects)
      .slice(0, limit)
      .map((value) => this.project(value));
    const pagination = this.record(root.pagination);
    return {
      projects,
      returnedCount: projects.length,
      more: pagination.next !== undefined && pagination.next !== null,
      automaticPagination: false,
    };
  }

  async getProject(credentials: VercelCredentials) {
    const projectId = this.id(credentials.projectId, "project");
    const body = await this.request(
      credentials,
      `/v9/projects/${projectId}`,
      this.query(credentials),
    );
    const project = this.project(body);
    if (project.id !== projectId)
      throw new VercelApiError(
        "vercel_project_binding_mismatch",
        "Vercel selected-project binding changed.",
        403,
      );
    return { project };
  }

  async listDeployments(
    credentials: VercelCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const body = await this.request(
      credentials,
      "/v6/deployments",
      this.query(credentials, {
        projectId: this.id(credentials.projectId, "project"),
        limit: String(limit),
      }),
    );
    const root = this.record(body);
    const deployments = this.array(root.deployments)
      .slice(0, limit)
      .map((value) => this.deployment(value, credentials.projectId));
    const pagination = this.record(root.pagination);
    return {
      deployments,
      returnedCount: deployments.length,
      more: pagination.next !== undefined && pagination.next !== null,
      automaticPagination: false,
    };
  }

  private async request(
    credentials: VercelCredentials,
    path: string,
    query: URLSearchParams,
  ) {
    if (
      !/^\/(?:v9\/projects(?:\/[A-Za-z0-9_-]{3,128})?|v6\/deployments)$/.test(
        path,
      )
    )
      throw new VercelApiError(
        "vercel_path_invalid",
        "Vercel API path is invalid.",
        400,
      );
    if (!credentials.accessToken || credentials.accessToken.length > 30_000)
      throw new VercelApiError(
        "vercel_credential_missing",
        "Vercel integration access token is missing.",
        401,
      );
    const response = await this.requester(
      `${VERCEL_API_ORIGIN}${path}?${query.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "User-Agent": "RelayConsole-Vercel/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const code =
        response.status === 401
          ? "vercel_token_invalid"
          : response.status === 403
            ? "vercel_scope_or_configuration_denied"
            : response.status === 404
              ? "vercel_not_found"
              : response.status === 429
                ? "vercel_rate_limited"
                : "vercel_unavailable";
      throw new VercelApiError(
        code,
        "Vercel API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new VercelApiError(
        "vercel_response_too_large",
        "Vercel response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new VercelApiError(
        "vercel_response_invalid",
        "Vercel returned an invalid response.",
      );
    }
  }

  private query(
    credentials: VercelCredentials,
    values: Record<string, string> = {},
  ) {
    const query = new URLSearchParams(values);
    if (credentials.teamId)
      query.set("teamId", this.id(credentials.teamId, "team"));
    return query;
  }

  private project(value: unknown) {
    const project = this.record(value);
    const latestDeployments = this.array(project.latestDeployments);
    const latest = latestDeployments.length
      ? this.record(latestDeployments[0])
      : this.record(this.record(project.targets).production);
    return {
      id: this.requiredId(project.id, "project response"),
      name: this.text(project.name),
      framework: this.text(project.framework),
      createdAt: this.scalar(project.createdAt),
      updatedAt: this.scalar(project.updatedAt),
      latestDeployment: {
        id: this.text(latest.id ?? latest.uid),
        url: this.text(latest.url),
        state: this.text(latest.state ?? latest.readyState),
        createdAt: this.scalar(latest.createdAt ?? latest.created),
      },
      domainCount: Math.min(this.array(project.domains).length, 10_000),
      environmentValuesReturned: false,
      rawLogsReturned: false,
      sourceMetadataReturned: false,
    };
  }

  private deployment(value: unknown, selectedProjectId: string) {
    const deployment = this.record(value);
    const project = this.record(deployment.project);
    const returnedProjectId = this.text(project.id ?? deployment.projectId);
    if (returnedProjectId && returnedProjectId !== selectedProjectId)
      throw new VercelApiError(
        "vercel_project_binding_mismatch",
        "Vercel deployment project binding changed.",
        403,
      );
    const creator = this.record(deployment.creator);
    return {
      id: this.requiredId(
        deployment.uid ?? deployment.id,
        "deployment response",
      ),
      name: this.text(deployment.name),
      url: this.text(deployment.url),
      state: this.text(deployment.state ?? deployment.readyState),
      target: this.text(deployment.target),
      createdAt: this.scalar(deployment.created ?? deployment.createdAt),
      readyAt: this.scalar(deployment.ready ?? deployment.readyAt),
      project: {
        id: returnedProjectId ?? selectedProjectId,
        name: this.text(project.name),
      },
      creator: {
        id: this.text(creator.uid ?? creator.id),
        name: this.text(creator.username ?? creator.name),
      },
      environmentValuesReturned: false,
      rawLogsReturned: false,
      filesReturned: false,
      sourceMetadataReturned: false,
    };
  }

  private id(value: unknown, label: string) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{3,128}$/.test(value))
      throw new VercelApiError(
        `vercel_${label}_id_invalid`,
        `Vercel ${label} ID is invalid.`,
        400,
      );
    return value;
  }
  private requiredId(value: unknown, label: string) {
    return this.id(value, label.replaceAll(" ", "_"));
  }
  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new VercelApiError(
        "vercel_limit_invalid",
        "Vercel result limit must be between 1 and 25.",
        400,
      );
    return Number(value);
  }
  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 1_000) : null;
  }
  private scalar(value: unknown) {
    return typeof value === "string" ||
      (typeof value === "number" && Number.isFinite(value))
      ? value
      : null;
  }
}
