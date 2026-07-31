import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type SlackEnterpriseGridCredentials = { adminToken: string };

export class SlackEnterpriseGridApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SlackEnterpriseGridApiAdapter {
  async identity(credentials: SlackEnterpriseGridCredentials) {
    const body = await this.request(credentials, "auth.test", {});
    const enterpriseId = this.enterpriseId(body.enterprise_id);
    if (!enterpriseId)
      throw new SlackEnterpriseGridApiError(
        "insufficient_scope",
        "Slack authorization is not bound to an Enterprise organization.",
        403,
      );
    return {
      enterpriseId,
      enterpriseName: this.text(body.enterprise, 200),
      userId: this.userId(body.user_id),
      teamId: this.optionalTeamId(body.team_id),
    };
  }

  async listWorkspaces(
    credentials: SlackEnterpriseGridCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const body = await this.request(credentials, "admin.teams.list", { limit });
    const workspaces = this.array(body.teams)
      .slice(0, limit)
      .map((value) => {
        const team = this.object(value);
        const primaryOwner = this.object(team.primary_owner);
        return {
          teamId: this.teamId(team.id),
          name: this.text(team.name, 200),
          discoverability: this.text(team.discoverability, 40),
          workspaceUrl: this.httpsSlackUrl(team.team_url),
          primaryOwnerUserId: this.userId(primaryOwner.user_id),
        };
      });
    return { workspaces, count: workspaces.length, nextCursorUsed: false };
  }

  listWorkspaceAdmins(
    credentials: SlackEnterpriseGridCredentials,
    input: JsonObject,
  ) {
    return this.listWorkspacePeople(
      credentials,
      input,
      "admin.teams.admins.list",
      "admin_ids",
    );
  }

  listWorkspaceOwners(
    credentials: SlackEnterpriseGridCredentials,
    input: JsonObject,
  ) {
    return this.listWorkspacePeople(
      credentials,
      input,
      "admin.teams.owners.list",
      "owner_ids",
    );
  }

  private async listWorkspacePeople(
    credentials: SlackEnterpriseGridCredentials,
    input: JsonObject,
    method: string,
    field: string,
  ) {
    const teamId = this.teamId(input.teamId);
    const limit = this.limit(input.limit);
    const body = await this.request(credentials, method, {
      team_id: teamId,
      limit,
    });
    const userIds = this.array(body[field])
      .slice(0, limit)
      .map((value) => this.userId(value));
    return { teamId, userIds, count: userIds.length, nextCursorUsed: false };
  }

  private async request(
    credentials: SlackEnterpriseGridCredentials,
    method: string,
    json: JsonObject,
  ) {
    if (!credentials.adminToken)
      throw new SlackEnterpriseGridApiError(
        "credential_missing",
        "Slack Enterprise organization admin token is required.",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(`https://slack.com/api/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.adminToken}`,
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(json),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new SlackEnterpriseGridApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Slack Enterprise request timed out."
          : "Slack Enterprise request failed.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new SlackEnterpriseGridApiError(
        "provider_validation_error",
        "Slack Enterprise response exceeds 1 MB.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    const body = this.object(parsed);
    if (!response.ok || body.ok === false) {
      const providerError = this.text(body.error, 100) ?? "unknown_error";
      throw new SlackEnterpriseGridApiError(
        this.safeCode(response.status, providerError),
        this.safeMessage(providerError),
        response.status,
      );
    }
    return body;
  }

  private safeCode(
    status: number,
    providerError: string,
  ): MarketplaceConnectorSafeErrorCode {
    if (
      status === 401 ||
      /^(invalid_auth|not_authed|token_expired|token_revoked)$/.test(
        providerError,
      )
    )
      return "credential_missing";
    if (
      status === 403 ||
      /^(missing_scope|not_an_admin|not_allowed_token_type|team_access_not_granted|feature_not_enabled)$/.test(
        providerError,
      )
    )
      return "insufficient_scope";
    if (status === 429 || providerError === "ratelimited")
      return "provider_rate_limited";
    if (
      status >= 500 ||
      /^(internal_error|service_unavailable|fatal_error)$/.test(providerError)
    )
      return "provider_unavailable";
    return "provider_validation_error";
  }

  private safeMessage(providerError: string) {
    const known: Record<string, string> = {
      invalid_auth: "Slack Enterprise authorization is invalid.",
      not_authed: "Slack Enterprise authorization is missing.",
      token_expired: "Slack Enterprise authorization has expired.",
      token_revoked: "Slack Enterprise authorization was revoked.",
      missing_scope:
        "Slack Enterprise authorization is missing admin.teams:read.",
      not_an_admin:
        "The authorized Slack user is not an Enterprise org owner or admin.",
      not_allowed_token_type:
        "Slack Enterprise Admin APIs require an org-installed user token.",
      feature_not_enabled:
        "Slack Admin APIs are unavailable for this organization or plan.",
      ratelimited: "Slack Enterprise rate limited this request.",
    };
    return known[providerError] ?? "Slack Enterprise rejected the request.";
  }

  private teamId(value: unknown) {
    const id = this.text(value, 32);
    if (!id || !/^T[A-Z0-9]{2,31}$/.test(id))
      throw new SlackEnterpriseGridApiError(
        "provider_validation_error",
        "teamId must be a Slack workspace ID.",
      );
    return id;
  }
  private optionalTeamId(value: unknown) {
    try {
      return value ? this.teamId(value) : null;
    } catch {
      return null;
    }
  }
  private enterpriseId(value: unknown) {
    const id = this.text(value, 32);
    return id && /^E[A-Z0-9]{2,31}$/.test(id) ? id : null;
  }
  private userId(value: unknown) {
    const id = this.text(value, 32);
    if (!id || !/^[UW][A-Z0-9]{2,31}$/.test(id))
      throw new SlackEnterpriseGridApiError(
        "provider_validation_error",
        "Slack user ID is invalid.",
      );
    return id;
  }
  private httpsSlackUrl(value: unknown) {
    const text = this.text(value, 500);
    if (!text) return null;
    try {
      const url = new URL(text);
      return url.protocol === "https:" && url.hostname.endsWith(".slack.com")
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }
  private limit(value: unknown) {
    const number = Number(value ?? 50);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), 1), 100)
      : 50;
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maximum)
      : null;
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
