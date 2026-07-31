import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class AtlassianCompassApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

const COMPONENT_ID =
  /^ari:cloud:compass:[A-Za-z0-9-]{1,100}:component\/[A-Za-z0-9-]{1,100}\/[A-Za-z0-9-]{1,100}$/;
const OWNER_ID = /^ari:cloud:teams::team\/[A-Za-z0-9-]{1,100}$/;
const TYPES = new Set([
  "SERVICE",
  "LIBRARY",
  "APPLICATION",
  "CAPABILITY",
  "CLOUD_RESOURCE",
  "DATA_PIPELINE",
  "MACHINE_LEARNING_MODEL",
  "UI_ELEMENT",
  "WEBSITE",
  "OTHER",
]);

@Injectable()
export class AtlassianCompassApiAdapter {
  health(accessToken: string, cloudId: string, siteUrl: string) {
    const hostName = this.siteHost(siteUrl);
    return this.graphql(
      accessToken,
      `query RelayCompassHealth($hostName: String!) {
        tenantContexts(hostNames: [$hostName]) { cloudId }
      }`,
      { hostName },
    ).then((data) => {
      const rows = Array.isArray(data.tenantContexts)
        ? data.tenantContexts
        : [];
      if (
        rows.length !== 1 ||
        this.string((rows[0] as JsonObject)?.cloudId) !== cloudId
      )
        throw new AtlassianCompassApiError(
          "provider_validation_error",
          "Compass OAuth site binding changed.",
          409,
        );
      return data;
    });
  }

  async componentGet(accessToken: string, componentId: string) {
    if (!COMPONENT_ID.test(componentId))
      throw this.validation("Compass component ID is invalid.");
    return await this.graphql(
      accessToken,
      `query RelayCompassComponent($componentId: ID!) {
        compass {
          component(id: $componentId) {
            __typename
            ... on CompassComponent {
              id name slug description type typeId ownerId state labels
              links { name type url }
            }
            ... on QueryError { message extensions { statusCode errorType } }
          }
        }
      }`,
      { componentId },
    );
  }

  async componentCreate(
    accessToken: string,
    cloudId: string,
    input: {
      name: string;
      typeId: string;
      description?: string;
      ownerId?: string;
    },
  ) {
    if (!/^[A-Za-z0-9-]{1,100}$/.test(cloudId))
      throw this.validation("Atlassian cloud ID is invalid.");
    const name = input.name?.trim();
    if (!name || name.length > 255)
      throw this.validation("Compass component name is required.");
    if (!TYPES.has(input.typeId))
      throw this.validation("Compass component type is invalid.");
    const description = input.description?.trim();
    if (description && description.length > 1000)
      throw this.validation("Compass component description is too long.");
    const ownerId = input.ownerId?.trim();
    if (ownerId && !OWNER_ID.test(ownerId))
      throw this.validation("Compass owner ID is invalid.");
    return await this.graphql(
      accessToken,
      `mutation RelayCompassCreate($cloudId: ID!, $input: CreateCompassComponentInput!) {
        compass {
          createComponent(cloudId: $cloudId, input: $input) {
            success
            errors { message extensions { statusCode errorType } }
            componentDetails { id name slug description type typeId ownerId state }
          }
        }
      }`,
      {
        cloudId,
        input: {
          name,
          typeId: input.typeId,
          ...(description ? { description } : {}),
          ...(ownerId ? { ownerId } : {}),
        },
      },
    );
  }

  private async graphql(
    accessToken: string,
    query: string,
    variables: JsonObject,
  ): Promise<JsonObject> {
    if (!accessToken || accessToken.length > 20_000)
      throw new AtlassianCompassApiError(
        "credential_missing",
        "Compass OAuth access token is required.",
        401,
      );
    const encoded = JSON.stringify({ query, variables });
    if (Buffer.byteLength(encoded) > 100_000)
      throw this.validation("Compass GraphQL request is too large.");
    let response: Response;
    try {
      response = await safeConnectorFetch("https://api.atlassian.com/graphql", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: encoded,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new AtlassianCompassApiError(
        "provider_unavailable",
        "Atlassian Compass could not be reached.",
        502,
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 2_000_000)
      throw this.validation("Compass response exceeds 2 MB.");
    let body: JsonObject;
    try {
      const parsed = bytes.length ? JSON.parse(bytes.toString("utf8")) : {};
      body =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as JsonObject)
          : {};
    } catch {
      throw new AtlassianCompassApiError(
        "provider_unavailable",
        "Atlassian Compass returned invalid JSON.",
        response.status,
      );
    }
    const errors = Array.isArray(body.errors) ? body.errors : [];
    if (!response.ok || errors.length)
      throw new AtlassianCompassApiError(
        this.code(response.status),
        this.errorMessage(errors[0] ?? body) ??
          `Atlassian Compass returned HTTP ${response.status}.`,
        response.status,
      );
    const data =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as JsonObject)
        : null;
    if (!data)
      throw new AtlassianCompassApiError(
        "provider_unavailable",
        "Atlassian Compass returned no GraphQL data.",
        response.status,
      );
    return this.redact(data) as JsonObject;
  }

  private siteHost(siteUrl: string) {
    try {
      const url = new URL(siteUrl);
      if (
        url.protocol !== "https:" ||
        !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.atlassian\.net$/i.test(
          url.hostname,
        )
      )
        throw new Error();
      return url.hostname.toLowerCase();
    } catch {
      throw this.validation("Compass site URL is invalid.");
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 100_000);
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private string(value: unknown) {
    return typeof value === "string" ? value : null;
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const message = (value as JsonObject).message;
    return typeof message === "string" ? message.slice(0, 500) : null;
  }

  private validation(message: string) {
    return new AtlassianCompassApiError("provider_validation_error", message);
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 0) return "provider_unavailable";
    return "provider_validation_error";
  }
}
