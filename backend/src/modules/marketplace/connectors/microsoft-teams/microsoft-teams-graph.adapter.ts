import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

export class MicrosoftTeamsGraphError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MicrosoftTeamsGraphAdapter {
  async listJoinedTeams(accessToken: string) {
    const root = await this.get(accessToken, "/me/joinedTeams", {});
    const teams = this.values(root)
      .slice(0, 25)
      .map((value) => this.team(value));
    return {
      semanticReadContract: "microsoft-teams-direct-memberships-v1",
      teams,
      resultCount: teams.length,
      truncated: Boolean(root["@odata.nextLink"]),
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getTeam(accessToken: string, input: Record<string, unknown>) {
    const teamId = this.identifier(input.teamId, "teamId");
    const root = await this.get(accessToken, `/teams/${teamId}`, {
      $select:
        "id,displayName,description,visibility,webUrl,isArchived,specialization",
    });
    return {
      semanticReadContract: "microsoft-teams-explicit-team-metadata-v1",
      team: this.team(root),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async listChannels(accessToken: string, input: Record<string, unknown>) {
    const teamId = this.identifier(input.teamId, "teamId");
    const root = await this.get(accessToken, `/teams/${teamId}/channels`, {
      $select: "id,displayName,description,membershipType,webUrl",
    });
    const channels = this.values(root)
      .slice(0, 25)
      .map((value) => this.channel(value));
    return {
      semanticReadContract: "microsoft-teams-visible-channels-v1",
      channels,
      resultCount: channels.length,
      truncated: Boolean(root["@odata.nextLink"]),
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getChannel(accessToken: string, input: Record<string, unknown>) {
    const teamId = this.identifier(input.teamId, "teamId");
    const channelId = this.identifier(input.channelId, "channelId");
    const root = await this.get(
      accessToken,
      `/teams/${teamId}/channels/${channelId}`,
      { $select: "id,displayName,description,membershipType,webUrl,summary" },
    );
    return {
      semanticReadContract: "microsoft-teams-explicit-channel-metadata-v1",
      channel: this.channel(root),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async get(
    accessToken: string,
    path: string,
    query: Record<string, string>,
  ) {
    const url = new URL(`https://graph.microsoft.com/v1.0${path}`);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    this.assertSafeUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
    } catch {
      throw new MicrosoftTeamsGraphError(
        "provider_unavailable",
        "Microsoft Teams request failed safely",
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw this.providerError(response.status);
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > 1_000_000)
      throw new MicrosoftTeamsGraphError(
        "graph_error",
        "Microsoft Teams response exceeded the safe size limit",
      );
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new MicrosoftTeamsGraphError(
        "graph_error",
        "Microsoft Teams returned an invalid response",
      );
    }
  }

  private assertSafeUrl(url: URL) {
    if (
      url.protocol !== "https:" ||
      url.hostname !== "graph.microsoft.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    )
      throw new MicrosoftTeamsGraphError(
        "provider_validation_error",
        "Unsafe Microsoft Teams request",
      );
    const safePath =
      url.pathname === "/v1.0/me/joinedTeams" ||
      /^\/v1\.0\/teams\/[A-Za-z0-9_.:@-]{1,256}(?:\/channels(?:\/[A-Za-z0-9_.:@-]{1,256})?)?$/.test(
        url.pathname,
      );
    if (
      !safePath ||
      [...url.searchParams.keys()].some((key) => key !== "$select")
    )
      throw new MicrosoftTeamsGraphError(
        "provider_validation_error",
        "Unsafe Microsoft Teams request",
      );
  }

  private identifier(value: unknown, field: string) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_.:@-]{1,256}$/.test(value))
      throw new MicrosoftTeamsGraphError(
        "provider_validation_error",
        `A valid ${field} is required`,
      );
    return value;
  }
  private values(root: Record<string, unknown>) {
    return Array.isArray(root.value)
      ? root.value.filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) &&
            typeof value === "object" &&
            !Array.isArray(value),
        )
      : [];
  }
  private scalar(value: unknown, maximum = 512) {
    return typeof value === "string"
      ? value.slice(0, maximum)
      : typeof value === "boolean" || typeof value === "number"
        ? value
        : null;
  }
  private team(value: Record<string, unknown>) {
    return {
      id: this.scalar(value.id, 256),
      displayName: this.scalar(value.displayName),
      description: this.scalar(value.description, 2_000),
      visibility: this.scalar(value.visibility, 32),
      webUrl: this.safeUrl(value.webUrl),
      isArchived: this.scalar(value.isArchived),
      specialization: this.scalar(value.specialization, 64),
    };
  }
  private channel(value: Record<string, unknown>) {
    return {
      id: this.scalar(value.id, 256),
      displayName: this.scalar(value.displayName),
      description: this.scalar(value.description, 2_000),
      membershipType: this.scalar(value.membershipType, 32),
      webUrl: this.safeUrl(value.webUrl),
      summary: this.scalar(value.summary, 2_000),
    };
  }
  private safeUrl(value: unknown) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "teams.microsoft.com"
        ? value.slice(0, 2_048)
        : null;
    } catch {
      return null;
    }
  }
  private boundary() {
    return {
      delegatedOnly: true,
      workSchoolOnly: true,
      messageContentReturned: false,
      membersDirectoryReturned: false,
      otherWorkloadsReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      rawProviderToolExposure: false,
      maxResults: 25,
      maxResponseBytes: 1_000_000,
      timeoutSeconds: 30,
      automaticRetries: false,
    };
  }
  private providerError(status: number) {
    const code: MarketplaceConnectorSafeErrorCode =
      status === 401
        ? "token_expired"
        : status === 403
          ? "insufficient_scope"
          : status === 404
            ? "provider_validation_error"
            : status === 429
              ? "provider_rate_limited"
              : status >= 500
                ? "provider_unavailable"
                : "provider_validation_error";
    return new MicrosoftTeamsGraphError(
      code,
      `Microsoft Teams request failed with ${status}`,
      status,
    );
  }
}
