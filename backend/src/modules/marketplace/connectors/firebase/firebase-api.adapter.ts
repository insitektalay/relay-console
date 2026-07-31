export const FIREBASE_API_ORIGIN = "https://firebase.googleapis.com";

export const FIREBASE_SCOPES = [
  "https://www.googleapis.com/auth/firebase.readonly",
];

export type FirebaseCredentials = {
  accessToken: string;
  projectId: string;
};

export class FirebaseApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class FirebaseApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: FirebaseCredentials) {
    const { project } = await this.getProject(credentials);
    return { ready: true, projectId: project.projectId };
  }

  async listProjects(
    credentials: FirebaseCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const root = this.record(
      await this.request(
        credentials,
        `/v1beta1/projects?pageSize=${limit}&showDeleted=false`,
      ),
    );
    const projects = this.array(root.results)
      .slice(0, limit)
      .map((value) => this.project(value));
    return {
      projects,
      returnedCount: projects.length,
      more: Boolean(this.text(root.nextPageToken)),
      automaticPagination: false,
    };
  }

  async getProject(credentials: FirebaseCredentials) {
    const projectId = this.projectId(credentials.projectId);
    const project = this.project(
      await this.request(credentials, `/v1beta1/projects/${projectId}`),
    );
    if (project.projectId !== projectId)
      throw new FirebaseApiError(
        "firebase_project_binding_mismatch",
        "Firebase selected Project binding changed.",
        403,
      );
    return { project };
  }

  async listApps(credentials: FirebaseCredentials, input: { limit?: unknown }) {
    const projectId = this.projectId(credentials.projectId);
    const limit = this.limit(input.limit);
    const root = this.record(
      await this.request(
        credentials,
        `/v1beta1/projects/${projectId}:searchApps?pageSize=${limit}&showDeleted=false`,
      ),
    );
    const apps = this.array(root.apps)
      .slice(0, limit)
      .map((value) => this.app(value, projectId));
    return {
      apps,
      returnedCount: apps.length,
      more: Boolean(this.text(root.nextPageToken)),
      automaticPagination: false,
      apiKeyIdsReturned: false,
      appConfigsReturned: false,
    };
  }

  private async request(credentials: FirebaseCredentials, path: string) {
    if (
      !/^\/v1beta1\/projects(?:\?pageSize=(?:[1-9]|1[0-9]|2[0-5])&showDeleted=false|\/[a-z][a-z0-9-]{4,28}[a-z0-9](?::searchApps\?pageSize=(?:[1-9]|1[0-9]|2[0-5])&showDeleted=false)?)$/.test(
        path,
      )
    )
      throw new FirebaseApiError(
        "firebase_path_invalid",
        "Firebase Management API path is invalid.",
        400,
      );
    if (!credentials.accessToken || credentials.accessToken.length > 30_000)
      throw new FirebaseApiError(
        "firebase_credential_missing",
        "Firebase OAuth access token is missing.",
        401,
      );
    const response = await this.requester(`${FIREBASE_API_ORIGIN}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-Firebase/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "firebase_token_invalid"
          : response.status === 403
            ? "firebase_scope_or_iam_denied"
            : response.status === 404
              ? "firebase_project_not_found"
              : response.status === 429
                ? "firebase_rate_limited"
                : "firebase_unavailable";
      throw new FirebaseApiError(
        code,
        "Firebase Management API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new FirebaseApiError(
        "firebase_response_too_large",
        "Firebase response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new FirebaseApiError(
        "firebase_response_invalid",
        "Firebase returned an invalid response.",
      );
    }
  }

  private project(value: unknown) {
    const project = this.record(value);
    const projectId = this.projectId(project.projectId);
    const name = this.text(project.name);
    if (name !== `projects/${projectId}`)
      throw new FirebaseApiError(
        "firebase_project_binding_mismatch",
        "Firebase Project resource name does not match its Project ID.",
        403,
      );
    const annotations = this.record(project.annotations);
    return {
      name,
      projectId,
      projectNumber: this.numericId(project.projectNumber),
      displayName: this.text(project.displayName),
      state: this.enumValue(project.state, ["ACTIVE", "DELETED"]),
      resourcesLocationId: this.text(project.resourcesLocationId),
      defaultHostingSite: this.text(project.defaultHostingSite),
      createTime: this.text(annotations.createTime),
      updateTime: this.text(annotations.updateTime),
      adminSdkConfigReturned: false,
    };
  }

  private app(value: unknown, projectId: string) {
    const app = this.record(value);
    const name = this.text(app.name);
    if (
      !new RegExp(
        `^projects/${projectId}/(?:iosApps|androidApps|webApps)/[^/]{1,256}$`,
      ).test(name)
    )
      throw new FirebaseApiError(
        "firebase_app_binding_mismatch",
        "Firebase App resource is outside the selected Project.",
        403,
      );
    return {
      name,
      displayName: this.text(app.displayName),
      platform: this.enumValue(app.platform, ["IOS", "ANDROID", "WEB"]),
      appId: this.text(app.appId),
      namespace: this.text(app.namespace),
      state: this.enumValue(app.state, ["ACTIVE", "DELETED"]),
      expireTime: this.text(app.expireTime),
      apiKeyIdReturned: false,
      configReturned: false,
    };
  }

  private projectId(value: unknown) {
    const text = this.text(value);
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(text))
      throw new FirebaseApiError(
        "firebase_project_id_invalid",
        "Firebase Project ID is invalid.",
        400,
      );
    return text;
  }

  private numericId(value: unknown) {
    const text = this.text(value);
    if (text && !/^[1-9][0-9]{0,30}$/.test(text))
      throw new FirebaseApiError(
        "firebase_project_number_invalid",
        "Firebase Project number is invalid.",
      );
    return text;
  }

  private limit(value: unknown) {
    const limit = value === undefined ? 10 : Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25)
      throw new FirebaseApiError(
        "firebase_limit_invalid",
        "Firebase limit must be an integer from 1 through 25.",
        400,
      );
    return limit;
  }

  private record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 1_200) : "";
  }

  private enumValue(value: unknown, allowed: string[]) {
    const text = this.text(value);
    return allowed.includes(text) ? text : "UNSPECIFIED";
  }
}
