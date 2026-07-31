import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type ApolloGraphOsCredentials = {
  apiKey: string;
  graphId: string;
  variant: string;
};

const TAG_LOCATION_QUERY = `query RelayGraphArtifactTagLocation($graphId: ID!, $variantName: String!) { graphArtifactTagLocation(graphID: $graphId, variantName: $variantName) { repository tag } }`;
const ARTIFACT_QUERY = `query RelayGraphArtifactByTag($graphId: ID!, $tag: String!) { graphArtifactByTag(graphID: $graphId, tag: $tag) { location { digest uri } } }`;
const LAUNCH_QUERY = `query RelayLaunchStatus($graphId: ID!, $graphVariant: String!, $launchId: ID!) { graph(id: $graphId) { variant(name: $graphVariant) { launch(id: $launchId) { status } } } }`;

export class ApolloGraphOsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ApolloGraphOsApiAdapter {
  private readonly endpoint = "https://api.apollographql.com/graphql";
  private readonly maxResponseBytes = 256 * 1024;
  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: ApolloGraphOsCredentials) {
    await this.getGraphArtifact(credentials);
    const c = this.credentials(credentials);
    return {
      apiOrigin: new URL(this.endpoint).origin,
      graphId: c.graphId,
      variant: c.variant,
      graphApiKeyValidated: true,
    };
  }

  async getGraphArtifact(credentials: ApolloGraphOsCredentials) {
    const c = this.credentials(credentials);
    const tagData = await this.query(c, TAG_LOCATION_QUERY, {
      graphId: c.graphId,
      variantName: c.variant,
    });
    const tagLocation = this.object(tagData.graphArtifactTagLocation);
    const repository = this.requiredString(
      tagLocation.repository,
      512,
      "Apollo returned invalid artifact repository metadata",
    );
    const tag = this.requiredString(
      tagLocation.tag,
      256,
      "Apollo returned invalid artifact tag metadata",
    );
    const artifactData = await this.query(c, ARTIFACT_QUERY, {
      graphId: c.graphId,
      tag,
    });
    const location = this.object(
      this.object(artifactData.graphArtifactByTag).location,
    );
    return {
      graphId: c.graphId,
      variant: c.variant,
      repository,
      tag,
      digest: this.requiredString(
        location.digest,
        256,
        "Apollo returned invalid artifact digest metadata",
      ),
      uri: this.requiredString(
        location.uri,
        2048,
        "Apollo returned invalid artifact URI metadata",
      ),
    };
  }

  async getLaunchStatus(
    credentials: ApolloGraphOsCredentials,
    rawLaunchId: unknown,
  ) {
    const c = this.credentials(credentials);
    const launchId = this.identifier(rawLaunchId, 160, "launchId");
    const data = await this.query(c, LAUNCH_QUERY, {
      graphId: c.graphId,
      graphVariant: c.variant,
      launchId,
    });
    const launch = this.object(
      this.object(this.object(data.graph).variant).launch,
    );
    return {
      graphId: c.graphId,
      variant: c.variant,
      launchId,
      status: this.requiredString(
        launch.status,
        80,
        "Apollo returned invalid launch status data",
      ),
    };
  }

  private async query(
    credentials: ApolloGraphOsCredentials,
    query: string,
    variables: JsonObject,
  ) {
    let response: Response;
    try {
      response = await this.requester(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole-ApolloGraphOS/1.0",
          "x-api-key": credentials.apiKey,
        },
        body: JSON.stringify({ query, variables }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ApolloGraphOsApiError(
        "provider_unavailable",
        "Apollo GraphOS could not be reached",
        502,
      );
    }
    const body = this.object(await this.safeBody(response));
    if (!response.ok)
      throw new ApolloGraphOsApiError(
        this.errorCode(response.status),
        `Apollo GraphOS returned HTTP ${response.status}`,
        response.status,
      );
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      const message = this.graphqlErrorMessage(body.errors);
      throw new ApolloGraphOsApiError(
        this.graphqlErrorCode(message),
        "Apollo GraphOS rejected the fixed query",
        400,
      );
    }
    return this.object(body.data);
  }

  private credentials(value: ApolloGraphOsCredentials) {
    const apiKey = typeof value?.apiKey === "string" ? value.apiKey.trim() : "";
    if (
      apiKey.length < 16 ||
      apiKey.length > 512 ||
      /[\u0000-\u0020\u007f]/.test(apiKey)
    )
      throw new ApolloGraphOsApiError(
        "credential_missing",
        "A valid dedicated graph-scoped Apollo GraphOS API key is required",
        401,
      );
    return {
      apiKey,
      graphId: this.identifier(value?.graphId, 128, "graphId"),
      variant: this.identifier(value?.variant, 128, "variant"),
    };
  }
  private identifier(value: unknown, max: number, label: string) {
    if (
      typeof value !== "string" ||
      !new RegExp(`^[A-Za-z0-9._:-]{1,${max}}$`).test(value.trim())
    )
      throw this.invalid(`${label} must be a valid Apollo GraphOS identifier`);
    return value.trim();
  }
  private requiredString(value: unknown, max: number, message: string) {
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    )
      throw this.invalid(message);
    return value;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private graphqlErrorMessage(errors: unknown[]) {
    const message = this.requiredString(
      this.object(errors[0]).message,
      240,
      "Apollo returned an invalid GraphQL error",
    );
    return message.replace(/[\r\n\t]+/g, " ");
  }
  private graphqlErrorCode(message: string): MarketplaceConnectorSafeErrorCode {
    if (/auth|api.?key|credential/i.test(message)) return "token_expired";
    if (/permission|forbidden|scope/i.test(message))
      return "insufficient_scope";
    if (/rate|limit|thrott/i.test(message)) return "provider_rate_limited";
    return "provider_validation_error";
  }
  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Apollo GraphOS response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new ApolloGraphOsApiError(
        "provider_unavailable",
        "Apollo GraphOS response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Apollo GraphOS response exceeded the allowed size");
    if (!bytes.byteLength)
      throw this.invalid("Apollo GraphOS returned an empty response");
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok)
        throw this.invalid("Apollo GraphOS returned invalid JSON");
      return {};
    }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new ApolloGraphOsApiError("provider_validation_error", message, 400);
  }
}
