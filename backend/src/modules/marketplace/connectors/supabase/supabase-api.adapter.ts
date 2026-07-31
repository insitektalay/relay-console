export const SUPABASE_API_ORIGIN = "https://api.supabase.com";
export const SUPABASE_SCOPES = ["organizations:read", "projects:read"];

export type SupabaseCredentials = {
  accessToken: string;
  organizationSlug: string;
  projectRef: string;
};

export class SupabaseApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class SupabaseApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: SupabaseCredentials) {
    const { organization } = await this.getOrganization(credentials);
    const { project } = await this.getProject(credentials);
    return {
      ready: true,
      organizationSlug: organization.slug,
      projectRef: project.ref,
    };
  }

  async getOrganization(credentials: SupabaseCredentials) {
    const slug = this.organizationSlug(credentials.organizationSlug);
    const organization = this.organization(
      await this.request(credentials, `/v1/organizations/${slug}`),
      slug,
    );
    return { organization };
  }

  async listProjects(
    credentials: SupabaseCredentials,
    input: { limit?: unknown },
  ) {
    const slug = this.organizationSlug(credentials.organizationSlug);
    const limit = this.limit(input.limit);
    const root = this.record(
      await this.request(
        credentials,
        `/v1/organizations/${slug}/projects?offset=0&limit=${limit}`,
      ),
    );
    const projects = this.array(root.projects)
      .slice(0, limit)
      .map((value) => this.project(value, slug));
    const pagination = this.record(root.pagination);
    return {
      projects,
      pagination: {
        count: this.nonnegativeInteger(pagination.count),
        limit,
        offset: 0,
      },
      automaticPagination: false,
    };
  }

  async getProject(credentials: SupabaseCredentials) {
    const slug = this.organizationSlug(credentials.organizationSlug);
    const ref = this.projectRef(credentials.projectRef);
    const project = this.project(
      await this.request(credentials, `/v1/projects/${ref}`),
      slug,
    );
    if (project.ref !== ref)
      throw new SupabaseApiError(
        "supabase_project_binding_mismatch",
        "Supabase selected Project binding changed.",
        403,
      );
    return { project };
  }

  private async request(credentials: SupabaseCredentials, path: string) {
    if (
      !/^\/v1\/(?:organizations\/[a-z0-9][a-z0-9_-]{1,127}(?:\/projects\?offset=0&limit=(?:[1-9]|1[0-9]|2[0-5]))?|projects\/[a-z]{20})$/.test(
        path,
      )
    )
      throw new SupabaseApiError(
        "supabase_path_invalid",
        "Supabase Management API path is invalid.",
        400,
      );
    if (!credentials.accessToken || credentials.accessToken.length > 30_000)
      throw new SupabaseApiError(
        "supabase_credential_missing",
        "Supabase OAuth access token is missing.",
        401,
      );
    const response = await this.requester(`${SUPABASE_API_ORIGIN}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-Supabase/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "supabase_token_invalid"
          : response.status === 403
            ? "supabase_scope_or_membership_denied"
            : response.status === 404
              ? "supabase_resource_not_found"
              : response.status === 429
                ? "supabase_rate_limited"
                : "supabase_unavailable";
      throw new SupabaseApiError(
        code,
        "Supabase Management API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new SupabaseApiError(
        "supabase_response_too_large",
        "Supabase response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new SupabaseApiError(
        "supabase_response_invalid",
        "Supabase returned an invalid response.",
      );
    }
  }

  private organization(value: unknown, expectedSlug: string) {
    const organization = this.record(value);
    const responseSlug = this.organizationSlug(organization.slug);
    if (responseSlug !== expectedSlug)
      throw new SupabaseApiError(
        "supabase_organization_binding_mismatch",
        "Supabase Organization binding changed.",
        403,
      );
    return {
      id: this.text(organization.id),
      slug: responseSlug,
      name: this.text(organization.name),
      plan: this.text(organization.plan),
      membersReturned: false,
      entitlementsReturned: false,
    };
  }

  private project(value: unknown, expectedOrganizationSlug: string) {
    const project = this.record(value);
    const organizationSlug = this.organizationSlug(project.organization_slug);
    if (organizationSlug !== expectedOrganizationSlug)
      throw new SupabaseApiError(
        "supabase_organization_binding_mismatch",
        "Supabase Project is outside the selected Organization.",
        403,
      );
    return {
      id: this.text(project.id),
      ref: this.projectRef(project.ref),
      name: this.text(project.name),
      organizationId: this.text(project.organization_id),
      organizationSlug,
      cloudProvider: this.text(project.cloud_provider),
      region: this.text(project.region),
      isBranch: this.boolean(project.is_branch),
      status: this.text(project.status),
      createdAt: this.text(project.created_at ?? project.inserted_at),
      databaseDetailsReturned: false,
    };
  }

  private organizationSlug(value: unknown) {
    const text = this.text(value);
    if (!/^[a-z0-9][a-z0-9_-]{1,127}$/.test(text))
      throw new SupabaseApiError(
        "supabase_organization_slug_invalid",
        "Supabase Organization slug is invalid.",
        400,
      );
    return text;
  }

  private projectRef(value: unknown) {
    const text = this.text(value);
    if (!/^[a-z]{20}$/.test(text))
      throw new SupabaseApiError(
        "supabase_project_ref_invalid",
        "Supabase Project ref must be exactly twenty lowercase letters.",
        400,
      );
    return text;
  }

  private limit(value: unknown) {
    const limit = value === undefined ? 25 : Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25)
      throw new SupabaseApiError(
        "supabase_limit_invalid",
        "Supabase limit must be an integer from 1 through 25.",
        400,
      );
    return limit;
  }

  private nonnegativeInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0
      ? value
      : 0;
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
    return typeof value === "string" ? value.slice(0, 1_200) : "";
  }

  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : false;
  }
}
