export const HEROKU_API_ORIGIN = "https://api.heroku.com";

export type HerokuCredentials = {
  accessToken: string;
  teamId: string;
  appId: string;
};

export class HerokuApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class HerokuApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: HerokuCredentials) {
    const app = await this.request(
      credentials,
      `/apps/${this.id(credentials.appId, "app")}`,
    );
    const summary = this.app(app.body, credentials.teamId);
    if (summary.id !== credentials.appId)
      throw new HerokuApiError(
        "heroku_app_binding_mismatch",
        "Heroku selected-App binding changed.",
        403,
      );
    return {
      ready: true,
      teamId: this.id(credentials.teamId, "team"),
      appId: summary.id,
      appName: summary.name,
    };
  }

  async listTeamApps(
    credentials: HerokuCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const teamId = this.id(credentials.teamId, "team");
    const response = await this.request(
      credentials,
      `/teams/${teamId}/apps`,
      `name ..; max=${limit};`,
    );
    const apps = this.array(response.body)
      .slice(0, limit)
      .map((value) => this.app(value, teamId));
    return {
      apps,
      returnedCount: apps.length,
      more: response.more,
      automaticPagination: false,
    };
  }

  async listReleases(
    credentials: HerokuCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const appId = this.id(credentials.appId, "app");
    const response = await this.request(
      credentials,
      `/apps/${appId}/releases`,
      `version ..; order=desc,max=${limit};`,
    );
    const releases = this.array(response.body)
      .slice(0, limit)
      .map((value) => this.release(value, appId));
    return {
      releases,
      returnedCount: releases.length,
      more: response.more,
      automaticPagination: false,
    };
  }

  async listDynos(credentials: HerokuCredentials, input: { limit?: unknown }) {
    const limit = this.limit(input.limit);
    const appId = this.id(credentials.appId, "app");
    const response = await this.request(
      credentials,
      `/apps/${appId}/dynos`,
      `name ..; max=${limit};`,
    );
    const dynos = this.array(response.body)
      .slice(0, limit)
      .map((value) => this.dyno(value, appId));
    return {
      dynos,
      returnedCount: dynos.length,
      more: response.more,
      automaticPagination: false,
    };
  }

  private async request(
    credentials: HerokuCredentials,
    path: string,
    range?: string,
  ) {
    if (
      !/^\/(?:teams\/[0-9a-fA-F-]{36}\/apps|apps\/[0-9a-fA-F-]{36}(?:\/(?:releases|dynos))?)$/.test(
        path,
      )
    )
      throw new HerokuApiError(
        "heroku_path_invalid",
        "Heroku Platform API path is invalid.",
        400,
      );
    if (!credentials.accessToken || credentials.accessToken.length > 30_000)
      throw new HerokuApiError(
        "heroku_credential_missing",
        "Heroku OAuth access token is missing.",
        401,
      );
    const response = await this.requester(`${HEROKU_API_ORIGIN}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/vnd.heroku+json; version=3",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-Heroku/1.0",
        ...(range ? { Range: range } : {}),
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "heroku_token_invalid"
          : response.status === 403
            ? "heroku_scope_or_team_denied"
            : response.status === 404
              ? "heroku_not_found"
              : response.status === 416
                ? "heroku_range_invalid"
                : response.status === 429
                  ? "heroku_rate_limited"
                  : "heroku_unavailable";
      throw new HerokuApiError(
        code,
        "Heroku Platform API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new HerokuApiError(
        "heroku_response_too_large",
        "Heroku response exceeded Relay's limit.",
      );
    try {
      return {
        body: JSON.parse(text) as unknown,
        more:
          response.status === 206 ||
          Boolean(response.headers.get("next-range")),
      };
    } catch {
      throw new HerokuApiError(
        "heroku_response_invalid",
        "Heroku returned an invalid response.",
      );
    }
  }

  private app(value: unknown, expectedTeamId: string) {
    const app = this.record(value);
    const team = this.record(app.team);
    const teamId = this.text(team.id);
    if (teamId !== this.id(expectedTeamId, "team"))
      throw new HerokuApiError(
        "heroku_team_binding_mismatch",
        "Heroku App Team binding changed.",
        403,
      );
    const region = this.record(app.region);
    const stack = this.record(app.stack ?? app.build_stack);
    const space = this.record(app.space);
    return {
      id: this.id(app.id, "app response"),
      name: this.text(app.name),
      maintenance: this.boolean(app.maintenance),
      archivedAt: this.text(app.archived_at),
      locked: this.boolean(app.locked),
      team: { id: teamId, name: this.text(team.name) },
      region: { id: this.text(region.id), name: this.text(region.name) },
      stack: { id: this.text(stack.id), name: this.text(stack.name) },
      space: { id: this.text(space.id), name: this.text(space.name) },
      releasedAt: this.text(app.released_at),
      createdAt: this.text(app.created_at),
      updatedAt: this.text(app.updated_at),
      webUrl: this.text(app.web_url),
      configValuesReturned: false,
      credentialMetadataReturned: false,
    };
  }

  private release(value: unknown, expectedAppId: string) {
    const release = this.record(value);
    const app = this.record(release.app);
    if (this.text(app.id) !== expectedAppId)
      throw new HerokuApiError(
        "heroku_app_binding_mismatch",
        "Heroku Release App binding changed.",
        403,
      );
    return {
      id: this.id(release.id, "release response"),
      appId: expectedAppId,
      version: this.number(release.version),
      status: this.text(release.status),
      current: this.boolean(release.current),
      eligibleForRollback: this.boolean(release.eligible_for_rollback),
      description: this.text(release.description),
      createdAt: this.text(release.created_at),
      updatedAt: this.text(release.updated_at),
      outputStreamReturned: false,
      artifactDetailsReturned: false,
      addonPlansReturned: false,
      userEmailReturned: false,
      configValuesReturned: false,
    };
  }

  private dyno(value: unknown, expectedAppId: string) {
    const dyno = this.record(value);
    const app = this.record(dyno.app);
    if (this.text(app.id) !== expectedAppId)
      throw new HerokuApiError(
        "heroku_app_binding_mismatch",
        "Heroku Dyno App binding changed.",
        403,
      );
    const release = this.record(dyno.release);
    return {
      id: this.id(dyno.id, "dyno response"),
      appId: expectedAppId,
      name: this.text(dyno.name),
      type: this.text(dyno.type),
      size: this.text(dyno.size),
      state: this.text(dyno.state),
      release: {
        id: this.text(release.id),
        version: this.number(release.version),
      },
      createdAt: this.text(dyno.created_at),
      updatedAt: this.text(dyno.updated_at),
      attachUrlReturned: false,
      commandReturned: false,
      environmentReturned: false,
    };
  }

  private id(value: unknown, label: string) {
    if (
      typeof value !== "string" ||
      !/^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(value)
    )
      throw new HerokuApiError(
        `heroku_${label.replaceAll(" ", "_")}_id_invalid`,
        `Heroku ${label} ID is invalid.`,
        400,
      );
    return value;
  }
  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new HerokuApiError(
        "heroku_limit_invalid",
        "Heroku result limit must be between 1 and 25.",
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
  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
  }
  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
}
