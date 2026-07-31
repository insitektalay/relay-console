export const DIGITALOCEAN_API_ORIGIN = "https://api.digitalocean.com";

export type DigitalOceanCredentials = {
  accessToken: string;
  teamId: string;
  projectId: string;
  resourceUrn: string;
};

export class DigitalOceanApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class DigitalOceanApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: DigitalOceanCredentials) {
    const project = await this.getProject(credentials);
    const membership = await this.projectResources(credentials, 25);
    const urn = this.resource(credentials.resourceUrn).urn;
    if (!membership.resources.some((item) => item.urn === urn))
      throw new DigitalOceanApiError(
        "digitalocean_project_membership_unverified",
        "DigitalOcean selected resource is not in the bounded Project page.",
        403,
      );
    return {
      ready: true,
      teamId: this.uuid(credentials.teamId, "team"),
      projectId: project.project.id,
      resourceUrn: urn,
    };
  }

  async listProjects(
    credentials: DigitalOceanCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const root = this.record(
      await this.request(credentials, `/v2/projects?page=1&per_page=${limit}`),
    );
    const projects = this.array(root.projects)
      .slice(0, limit)
      .map((value) => this.project(value, credentials.teamId));
    return {
      projects,
      returnedCount: projects.length,
      more: this.more(root),
      automaticPagination: false,
    };
  }

  async getProject(credentials: DigitalOceanCredentials) {
    const projectId = this.uuid(credentials.projectId, "project");
    const root = this.record(
      await this.request(credentials, `/v2/projects/${projectId}`),
    );
    const project = this.project(root.project, credentials.teamId);
    if (project.id !== projectId)
      throw new DigitalOceanApiError(
        "digitalocean_project_binding_mismatch",
        "DigitalOcean selected Project binding changed.",
        403,
      );
    return { project };
  }

  async listProjectResources(
    credentials: DigitalOceanCredentials,
    input: { limit?: unknown },
  ) {
    return this.projectResources(credentials, this.limit(input.limit));
  }

  async getSelectedResource(credentials: DigitalOceanCredentials) {
    const selected = this.resource(credentials.resourceUrn);
    const membership = await this.projectResources(credentials, 25);
    if (!membership.resources.some((item) => item.urn === selected.urn))
      throw new DigitalOceanApiError(
        "digitalocean_project_membership_unverified",
        "DigitalOcean selected resource is not in the bounded Project page.",
        403,
      );
    const root = this.record(
      await this.request(
        credentials,
        selected.kind === "droplet"
          ? `/v2/droplets/${selected.id}`
          : `/v2/apps/${selected.id}`,
      ),
    );
    const resource =
      selected.kind === "droplet"
        ? this.droplet(root.droplet, selected.id)
        : this.app(root.app, selected.id);
    return {
      resourceKind: selected.kind,
      resource,
      projectMembershipVerified: true,
    };
  }

  private async projectResources(
    credentials: DigitalOceanCredentials,
    limit: number,
  ) {
    const projectId = this.uuid(credentials.projectId, "project");
    const root = this.record(
      await this.request(
        credentials,
        `/v2/projects/${projectId}/resources?page=1&per_page=${limit}`,
      ),
    );
    const resources = this.array(root.resources)
      .slice(0, limit)
      .flatMap((value) => {
        const resource = this.projectResource(value);
        return resource ? [resource] : [];
      });
    return {
      resources,
      returnedCount: resources.length,
      more: this.more(root),
      automaticPagination: false,
    };
  }

  private async request(credentials: DigitalOceanCredentials, path: string) {
    if (
      !/^\/v2\/(?:projects(?:\?page=1&per_page=(?:[1-9]|1[0-9]|2[0-5]))?|projects\/[0-9a-fA-F-]{36}(?:\/resources\?page=1&per_page=(?:[1-9]|1[0-9]|2[0-5]))?|droplets\/[1-9][0-9]{0,19}|apps\/[0-9a-fA-F-]{36})$/.test(
        path,
      )
    )
      throw new DigitalOceanApiError(
        "digitalocean_path_invalid",
        "DigitalOcean API path is invalid.",
        400,
      );
    if (!credentials.accessToken || credentials.accessToken.length > 30_000)
      throw new DigitalOceanApiError(
        "digitalocean_credential_missing",
        "DigitalOcean OAuth access token is missing.",
        401,
      );
    const response = await this.requester(`${DIGITALOCEAN_API_ORIGIN}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-DigitalOcean/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "digitalocean_token_invalid"
          : response.status === 403
            ? "digitalocean_scope_or_team_denied"
            : response.status === 404
              ? "digitalocean_not_found"
              : response.status === 429
                ? "digitalocean_rate_limited"
                : "digitalocean_unavailable";
      throw new DigitalOceanApiError(
        code,
        "DigitalOcean API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new DigitalOceanApiError(
        "digitalocean_response_too_large",
        "DigitalOcean response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new DigitalOceanApiError(
        "digitalocean_response_invalid",
        "DigitalOcean returned an invalid response.",
      );
    }
  }

  private project(value: unknown, expectedTeamId: string) {
    const project = this.record(value);
    const teamId = this.uuid(expectedTeamId, "team");
    if (this.text(project.owner_uuid) !== teamId)
      throw new DigitalOceanApiError(
        "digitalocean_team_binding_mismatch",
        "DigitalOcean Project Team binding changed.",
        403,
      );
    return {
      id: this.uuid(project.id, "project response"),
      teamId,
      name: this.text(project.name),
      description: this.text(project.description),
      purpose: this.text(project.purpose),
      environment: this.text(project.environment),
      isDefault: this.boolean(project.is_default),
      createdAt: this.text(project.created_at),
      updatedAt: this.text(project.updated_at),
    };
  }

  private projectResource(value: unknown) {
    const resource = this.record(value);
    if (
      typeof resource.urn !== "string" ||
      !/^(?:do:droplet:[1-9][0-9]{0,19}|do:app:[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})$/.test(
        resource.urn,
      )
    )
      return null;
    const selected = this.resource(resource.urn);
    return {
      urn: selected.urn,
      kind: selected.kind,
      assignedAt: this.text(resource.assigned_at),
      status: this.text(resource.status),
    };
  }

  private droplet(value: unknown, expectedId: string) {
    const droplet = this.record(value);
    const id = this.integerId(droplet.id, "droplet response");
    if (id !== expectedId)
      throw new DigitalOceanApiError(
        "digitalocean_resource_binding_mismatch",
        "DigitalOcean selected Droplet binding changed.",
        403,
      );
    const region = this.record(droplet.region);
    const size = this.record(droplet.size);
    const image = this.record(droplet.image);
    const networks = this.record(droplet.networks);
    const addresses = [...this.array(networks.v4), ...this.array(networks.v6)]
      .slice(0, 10)
      .map((value) => {
        const network = this.record(value);
        return {
          ipAddress: this.text(network.ip_address),
          type: this.text(network.type),
          netmask: this.text(network.netmask),
          gateway: this.text(network.gateway),
        };
      });
    return {
      id,
      name: this.text(droplet.name),
      status: this.text(droplet.status),
      locked: this.boolean(droplet.locked),
      memoryMb: this.number(droplet.memory),
      vcpus: this.number(droplet.vcpus),
      diskGb: this.number(droplet.disk),
      region: { slug: this.text(region.slug), name: this.text(region.name) },
      size: {
        slug: this.text(size.slug),
        description: this.text(size.description),
      },
      image: {
        id: this.scalar(image.id),
        name: this.text(image.name),
        distribution: this.text(image.distribution),
      },
      tags: this.array(droplet.tags)
        .slice(0, 25)
        .map((tag) => this.text(tag)),
      networkAddresses: addresses,
      createdAt: this.text(droplet.created_at),
      userDataReturned: false,
      volumesReturned: false,
      featuresReturned: false,
    };
  }

  private app(value: unknown, expectedId: string) {
    const app = this.record(value);
    const id = this.uuid(app.id, "app response");
    if (id !== expectedId)
      throw new DigitalOceanApiError(
        "digitalocean_resource_binding_mismatch",
        "DigitalOcean selected App binding changed.",
        403,
      );
    const spec = this.record(app.spec);
    const deployment = this.record(app.active_deployment);
    const progress = this.record(deployment.progress);
    const components = [
      ...this.array(spec.services),
      ...this.array(spec.workers),
      ...this.array(spec.jobs),
      ...this.array(spec.static_sites),
    ]
      .slice(0, 25)
      .map((value) => this.text(this.record(value).name));
    return {
      id,
      name: this.text(spec.name ?? app.name),
      region: this.text(spec.region ?? app.region),
      tier: this.text(spec.tier_slug),
      liveUrl: this.text(app.live_url),
      createdAt: this.text(app.created_at),
      updatedAt: this.text(app.updated_at),
      activeDeployment: {
        id: this.text(deployment.id),
        phase: this.text(deployment.phase),
        createdAt: this.text(deployment.created_at),
        updatedAt: this.text(deployment.updated_at),
        stepsSuccess: this.number(progress.steps_success),
        stepsTotal: this.number(progress.steps_total),
      },
      componentNames: components,
      environmentValuesReturned: false,
      sourceMetadataReturned: false,
      logsReturned: false,
      consoleReturned: false,
    };
  }

  private resource(value: unknown) {
    if (typeof value !== "string")
      throw new DigitalOceanApiError(
        "digitalocean_resource_urn_invalid",
        "DigitalOcean selected resource URN is invalid.",
        400,
      );
    const droplet = /^do:droplet:([1-9][0-9]{0,19})$/.exec(value);
    if (droplet)
      return { urn: value, kind: "droplet" as const, id: droplet[1] };
    const app =
      /^do:app:([0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})$/.exec(
        value,
      );
    if (app) return { urn: value, kind: "app" as const, id: app[1] };
    throw new DigitalOceanApiError(
      "digitalocean_resource_urn_invalid",
      "DigitalOcean selected resource must be one Droplet or App URN.",
      400,
    );
  }

  private uuid(value: unknown, label: string) {
    if (
      typeof value !== "string" ||
      !/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(value)
    )
      throw new DigitalOceanApiError(
        `digitalocean_${label.replaceAll(" ", "_")}_id_invalid`,
        `DigitalOcean ${label} ID is invalid.`,
        400,
      );
    return value;
  }
  private integerId(value: unknown, label: string) {
    const normalized =
      typeof value === "number" && Number.isSafeInteger(value) && value > 0
        ? String(value)
        : typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value)
          ? value
          : null;
    if (!normalized)
      throw new DigitalOceanApiError(
        `digitalocean_${label.replaceAll(" ", "_")}_id_invalid`,
        `DigitalOcean ${label} ID is invalid.`,
        400,
      );
    return normalized;
  }
  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new DigitalOceanApiError(
        "digitalocean_limit_invalid",
        "DigitalOcean result limit must be between 1 and 25.",
        400,
      );
    return Number(value);
  }
  private more(root: Record<string, unknown>) {
    return Boolean(this.record(this.record(root.links).pages).next);
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
  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
  }
  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private scalar(value: unknown) {
    return typeof value === "string" ||
      (typeof value === "number" && Number.isFinite(value))
      ? value
      : null;
  }
}
