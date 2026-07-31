export const GREENHOUSE_API_ORIGIN = "https://harvest.greenhouse.io";
export const GREENHOUSE_SCOPES = [
  "harvest:jobs:list",
  "harvest:offices:list",
  "harvest:departments:list",
];

export type GreenhouseCredentials = {
  accessToken: string;
  organizationId: string;
};

export class GreenhouseApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class GreenhouseApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: GreenhouseCredentials) {
    await this.listDepartments(credentials, { limit: 1 });
    return {
      ready: true,
      organizationId: this.organizationId(credentials.organizationId),
    };
  }

  async listJobs(
    credentials: GreenhouseCredentials,
    input: { limit?: unknown },
  ) {
    return this.list(credentials, "jobs", input.limit, (value) =>
      this.job(value),
    );
  }

  async listOffices(
    credentials: GreenhouseCredentials,
    input: { limit?: unknown },
  ) {
    return this.list(credentials, "offices", input.limit, (value) =>
      this.office(value),
    );
  }

  async listDepartments(
    credentials: GreenhouseCredentials,
    input: { limit?: unknown },
  ) {
    return this.list(credentials, "departments", input.limit, (value) =>
      this.department(value),
    );
  }

  private async list<T>(
    credentials: GreenhouseCredentials,
    resource: "jobs" | "offices" | "departments",
    value: unknown,
    map: (value: unknown) => T,
  ) {
    this.organizationId(credentials.organizationId);
    const limit = this.limit(value);
    const root = await this.request(
      credentials,
      `/v3/${resource}?per_page=${limit}`,
    );
    const record = this.record(root);
    const values = Array.isArray(root)
      ? root
      : Array.isArray(record.data)
        ? record.data
        : [];
    return {
      [resource]: values.slice(0, limit).map(map),
      limit,
      automaticPagination: false,
    };
  }

  private async request(credentials: GreenhouseCredentials, path: string) {
    if (
      !/^\/v3\/(?:jobs|offices|departments)\?per_page=(?:[1-9]|1[0-9]|2[0-5])$/.test(
        path,
      )
    )
      throw new GreenhouseApiError(
        "greenhouse_path_invalid",
        "Greenhouse Harvest v3 path is invalid.",
        400,
      );
    if (!credentials.accessToken || credentials.accessToken.length > 30_000)
      throw new GreenhouseApiError(
        "greenhouse_credential_missing",
        "Greenhouse OAuth access token is missing.",
        401,
      );
    const response = await this.requester(`${GREENHOUSE_API_ORIGIN}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-Greenhouse/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "greenhouse_token_invalid"
          : response.status === 403
            ? "greenhouse_scope_or_admin_denied"
            : response.status === 404
              ? "greenhouse_resource_not_found"
              : response.status === 429
                ? "greenhouse_rate_limited"
                : "greenhouse_unavailable";
      throw new GreenhouseApiError(
        code,
        "Greenhouse Harvest v3 request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new GreenhouseApiError(
        "greenhouse_response_too_large",
        "Greenhouse response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new GreenhouseApiError(
        "greenhouse_response_invalid",
        "Greenhouse returned an invalid response.",
      );
    }
  }

  private job(value: unknown) {
    const job = this.record(value);
    return {
      id: this.scalar(job.id),
      name: this.text(job.name),
      status: this.text(job.status),
      requisitionId: this.text(job.requisition_id),
      departmentId: this.scalar(job.department_id),
      officeIds: this.ids(job.office_ids ?? job.offices),
      confidential: this.boolean(job.confidential),
      openedAt: this.text(job.opened_at),
      closedAt: this.text(job.closed_at),
      createdAt: this.text(job.created_at),
      updatedAt: this.text(job.updated_at),
      hiringTeamReturned: false,
      notesReturned: false,
      customFieldsReturned: false,
      candidateDataReturned: false,
    };
  }

  private office(value: unknown) {
    const office = this.record(value);
    return {
      id: this.scalar(office.id),
      name: this.text(office.name),
      parentId: this.scalar(office.parent_id),
      externalId: this.text(office.external_id),
      createdAt: this.text(office.created_at),
      updatedAt: this.text(office.updated_at),
      physicalLocationReturned: false,
      contactUserReturned: false,
    };
  }

  private department(value: unknown) {
    const department = this.record(value);
    return {
      id: this.scalar(department.id),
      name: this.text(department.name),
      parentId: this.scalar(department.parent_id),
      externalId: this.text(department.external_id),
      createdAt: this.text(department.created_at),
      updatedAt: this.text(department.updated_at),
    };
  }

  private ids(value: unknown) {
    return (Array.isArray(value) ? value : [])
      .slice(0, 25)
      .map((item) => this.scalar(this.record(item).id ?? item));
  }
  private organizationId(value: unknown) {
    const text = this.text(value);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(text))
      throw new GreenhouseApiError(
        "greenhouse_organization_id_invalid",
        "Greenhouse Organization ID is invalid.",
        400,
      );
    return text;
  }
  private limit(value: unknown) {
    const limit = value === undefined ? 25 : Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25)
      throw new GreenhouseApiError(
        "greenhouse_limit_invalid",
        "Greenhouse limit must be an integer from 1 through 25.",
        400,
      );
    return limit;
  }
  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 1_200) : "";
  }
  private scalar(value: unknown) {
    return typeof value === "string"
      ? value.slice(0, 1_200)
      : typeof value === "number" && Number.isSafeInteger(value)
        ? value
        : null;
  }
  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : false;
  }
}
