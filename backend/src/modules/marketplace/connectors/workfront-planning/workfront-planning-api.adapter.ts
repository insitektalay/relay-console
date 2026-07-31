import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type WorkfrontPlanningCredentials = {
  clientId: string;
  clientSecret: string;
  imsOrgId: string;
  scope: string;
  customerHostname: string;
};

export class WorkfrontPlanningApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class WorkfrontPlanningApiAdapter {
  private readonly tokens = new Map<
    string,
    { accessToken: string; expiresAt: number }
  >();

  async health(credentials: WorkfrontPlanningCredentials) {
    const result = await this.listWorkspaces(credentials, { limit: 1 });
    return {
      customerHostname: this.hostname(credentials.customerHostname),
      workspaceCount: result.count,
    };
  }

  async listWorkspaces(
    credentials: WorkfrontPlanningCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const parsed = await this.request(
      credentials,
      `/maestro/api/v2/workspaces?limit=${limit}`,
    );
    return this.page(parsed, limit, (value) => this.workspace(value));
  }

  async getWorkspace(
    credentials: WorkfrontPlanningCredentials,
    input: JsonObject,
  ) {
    const workspaceId = this.id(input.workspaceId, "workspace");
    return this.workspace(
      await this.request(
        credentials,
        `/maestro/api/v2/workspaces/${workspaceId}`,
      ),
    );
  }

  async listRecordTypes(
    credentials: WorkfrontPlanningCredentials,
    input: JsonObject,
  ) {
    const workspaceId = this.id(input.workspaceId, "workspace");
    const limit = this.limit(input.limit);
    const parsed = await this.request(
      credentials,
      `/maestro/api/v2/workspaces/${workspaceId}/record-types?limit=${limit}`,
    );
    return this.page(parsed, limit, (value) => this.recordType(value));
  }

  async getRecordType(
    credentials: WorkfrontPlanningCredentials,
    input: JsonObject,
  ) {
    const recordTypeId = this.id(input.recordTypeId, "record type");
    return this.recordType(
      await this.request(
        credentials,
        `/maestro/api/v2/record-types/${recordTypeId}`,
      ),
    );
  }

  private async request(
    credentials: WorkfrontPlanningCredentials,
    path: string,
  ) {
    const clientId = this.clientId(credentials.clientId);
    const imsOrgId = this.imsOrgId(credentials.imsOrgId);
    const hostname = this.hostname(credentials.customerHostname);
    const token = await this.accessToken(credentials);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await safeConnectorFetch(`https://${hostname}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "x-api-key": clientId,
          "x-gw-ims-org-id": imsOrgId,
        },
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      const parsed = await this.parse(response, "Workfront Planning");
      if (!response.ok)
        throw new WorkfrontPlanningApiError(
          this.errorCode(response.status),
          this.errorMessage(response.status),
          response.status,
        );
      return parsed;
    } catch (error) {
      if (error instanceof WorkfrontPlanningApiError) throw error;
      if (error instanceof Error && error.name === "AbortError")
        throw new WorkfrontPlanningApiError(
          "provider_unavailable",
          "Workfront Planning request timed out.",
        );
      throw new WorkfrontPlanningApiError(
        "provider_unavailable",
        "Workfront Planning request failed.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async accessToken(credentials: WorkfrontPlanningCredentials) {
    const clientId = this.clientId(credentials.clientId);
    const clientSecret = this.secret(credentials.clientSecret);
    const imsOrgId = this.imsOrgId(credentials.imsOrgId);
    const scope = this.scope(credentials.scope);
    const key = `${clientId}:${imsOrgId}:${scope}`;
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000)
      return cached.accessToken;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope,
      });
      const response = await safeConnectorFetch(
        "https://ims-na1.adobelogin.com/ims/token/v3",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        },
      );
      const parsed = await this.parse(response, "Adobe IMS");
      if (!response.ok)
        throw new WorkfrontPlanningApiError(
          response.status === 429 ? "provider_rate_limited" : "token_expired",
          response.status === 429
            ? "Adobe IMS rate limited token generation."
            : "Adobe IMS rejected the server-to-server credential.",
          response.status,
        );
      const object = this.object(parsed);
      const accessToken =
        typeof object.access_token === "string" ? object.access_token : "";
      const expiresIn = Number(object.expires_in);
      if (!accessToken || accessToken.length > 16_384)
        throw new WorkfrontPlanningApiError(
          "provider_unavailable",
          "Adobe IMS returned an invalid access token.",
        );
      this.tokens.set(key, {
        accessToken,
        expiresAt:
          Date.now() +
          (Number.isFinite(expiresIn) && expiresIn > 0
            ? Math.min(expiresIn, 86_400) * 1_000
            : 3_600_000),
      });
      return accessToken;
    } catch (error) {
      if (error instanceof WorkfrontPlanningApiError) throw error;
      if (error instanceof Error && error.name === "AbortError")
        throw new WorkfrontPlanningApiError(
          "provider_unavailable",
          "Adobe IMS token request timed out.",
        );
      throw new WorkfrontPlanningApiError(
        "provider_unavailable",
        "Adobe IMS token request failed.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parse(response: Response, provider: string) {
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > 262_144)
      throw new WorkfrontPlanningApiError(
        "provider_unavailable",
        `${provider} response exceeded 256 KiB.`,
        response.status,
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 262_144)
      throw new WorkfrontPlanningApiError(
        "provider_unavailable",
        `${provider} response exceeded 256 KiB.`,
        response.status,
      );
    if (!raw.trim()) return {};
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new WorkfrontPlanningApiError(
        "provider_unavailable",
        `${provider} returned invalid JSON.`,
        response.status,
      );
    }
  }

  private page<T>(
    value: unknown,
    limit: number,
    map: (record: unknown) => T,
  ) {
    const object = this.object(value, true);
    const source = Array.isArray(value)
      ? value
      : Array.isArray(object.content)
        ? object.content
        : [];
    const cursor = this.object(object.cursor, true);
    const rows = source.slice(0, limit).map(map);
    return {
      rows,
      count: rows.length,
      truncated: source.length > limit || cursor.hasMore === true,
    };
  }

  private workspace(value: unknown) {
    const object = this.object(value);
    return {
      id: this.clean(object.id, 64),
      name: this.clean(object.name, 200),
      status: this.clean(object.status, 40),
      createdAt: this.clean(object.createdAt, 40),
      updatedAt: this.clean(object.updatedAt, 40),
    };
  }

  private recordType(value: unknown) {
    const object = this.object(value);
    return {
      id: this.clean(object.id, 64),
      name: this.clean(object.name, 200),
      workspaceId: this.clean(object.workspaceId, 64),
      createdAt: this.clean(object.createdAt, 40),
      updatedAt: this.clean(object.updatedAt, 40),
    };
  }

  private object(value: unknown, optional = false): JsonObject {
    if (value && typeof value === "object" && !Array.isArray(value))
      return value as JsonObject;
    if (optional) return {};
    throw this.validation("Workfront Planning returned an invalid record.");
  }

  private clean(value: unknown, max: number) {
    return typeof value === "string" || typeof value === "number"
      ? String(value).slice(0, max)
      : null;
  }

  private id(value: unknown, label: string) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value))
      throw this.validation(`Workfront Planning ${label} ID is invalid.`);
    return value;
  }

  private clientId(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,200}$/.test(value))
      throw this.validation("Adobe IMS client ID is invalid.");
    return value;
  }

  private secret(value: unknown) {
    if (typeof value !== "string" || !value.trim() || value.length > 2_048)
      throw new WorkfrontPlanningApiError(
        "connection_not_ready",
        "Adobe IMS client secret is required.",
      );
    return value.trim();
  }

  private imsOrgId(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9@._-]{1,200}$/.test(value))
      throw this.validation("Adobe IMS organization ID is invalid.");
    return value;
  }

  private scope(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9._,:-]{1,1000}$/.test(value))
      throw this.validation("Adobe IMS scope list is invalid.");
    return value;
  }

  private hostname(value: unknown) {
    if (typeof value !== "string")
      throw this.validation("Workfront customer hostname is required.");
    const hostname = value.trim().toLowerCase();
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.my\.workfront\.com$/.test(
        hostname,
      )
    )
      throw this.validation(
        "Workfront customer hostname must be one tenant under my.workfront.com.",
      );
    return hostname;
  }

  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 20)
      throw this.validation("Workfront Planning limit must be from 1 to 20.");
    return Number(value);
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 409 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(status: number) {
    if (status === 401) return "Workfront Planning rejected the access token.";
    if (status === 403)
      return "Workfront Planning denied this action for the technical account.";
    if (status === 404) return "Workfront Planning resource was not found.";
    if (status === 429) return "Workfront Planning rate limited the request.";
    if (status >= 500) return "Workfront Planning is unavailable.";
    return "Workfront Planning rejected the fixed request.";
  }

  private validation(message: string) {
    return new WorkfrontPlanningApiError("provider_validation_error", message);
  }
}
