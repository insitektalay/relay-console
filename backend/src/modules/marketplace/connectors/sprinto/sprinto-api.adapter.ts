import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type SprintoCredentials = { apiKey: string };
export const SPRINTO_OPERATIONS = ["workflow_checks.list"] as const;
const WORKFLOW_CHECKS_QUERY = `query RelayWorkflowChecks($first: Int!, $after: String) {
  workflowChecksPaginated(first: $first, after: $after) {
    edges { cursor node { pk title } }
  }
}`;

export class SprintoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class SprintoApiAdapter {
  private readonly endpoint = "https://app.sprinto.com/dev-api/graphql";

  async health(credentials: SprintoCredentials) {
    const result = await this.read(credentials, {
      operation: "workflow_checks.list",
      first: 1,
    });
    return {
      endpoint: this.endpoint,
      workflowCheckDirectoryVerified: true,
      visibleCountAtLeast: result.workflowChecks.length,
    };
  }

  async read(credentials: SprintoCredentials, input: JsonObject) {
    if (input.operation !== "workflow_checks.list")
      throw new SprintoApiError(
        "policy_blocked",
        "Sprinto operation is outside Relay's pinned workflow-check directory.",
        403,
      );
    const first = this.integer(input.first, 1, 20, 20);
    const after = this.cursor(input.after);
    let response: Response;
    try {
      response = await safeConnectorFetch(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "api-key": this.credential(credentials.apiKey),
        },
        body: JSON.stringify({
          query: WORKFLOW_CHECKS_QUERY,
          variables: { first, after },
          operationName: "RelayWorkflowChecks",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new SprintoApiError(
        "provider_unavailable",
        "Sprinto API could not be reached.",
        502,
      );
    }
    const body = await this.body(response);
    if (!response.ok)
      throw new SprintoApiError(
        response.status === 429
          ? "provider_rate_limited"
          : response.status >= 500
            ? "provider_unavailable"
            : response.status === 401 || response.status === 403
              ? "credential_missing"
              : "provider_validation_error",
        `Sprinto returned HTTP ${response.status}.`,
        response.status || 400,
      );
    if (Array.isArray(body.errors) && body.errors.length)
      throw new SprintoApiError(
        "provider_validation_error",
        "Sprinto rejected the bounded workflow-check query.",
        502,
      );
    const data = this.object(body.data);
    const connection = this.object(data.workflowChecksPaginated);
    if (!Array.isArray(connection.edges))
      throw new SprintoApiError(
        "provider_validation_error",
        "Sprinto returned an invalid workflow-check directory.",
        502,
      );
    const edges = connection.edges
      .slice(0, first)
      .map((entry) => this.object(entry));
    return {
      workflowChecks: edges
        .map((edge) => this.object(edge.node))
        .map((node) => ({
          id: this.id(node.pk),
          title: this.text(node.title, 300),
        }))
        .filter((item) => item.id),
      first,
      nextCursor: this.outputCursor(edges.at(-1)?.cursor),
    };
  }

  private credential(value: string) {
    if (!value || value.length > 4_000 || /[\r\n]/.test(value))
      throw new SprintoApiError(
        "credential_missing",
        "A valid Sprinto API key is required.",
        401,
      );
    return value;
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new SprintoApiError(
        "provider_validation_error",
        `Integer must be between ${min} and ${max}.`,
      );
    return Number(value);
  }

  private cursor(value: unknown) {
    if (value === undefined || value === null) return null;
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > 500 ||
      !/^[A-Za-z0-9+/=_-]+$/.test(value)
    )
      throw new SprintoApiError(
        "provider_validation_error",
        "Sprinto cursor is invalid.",
      );
    return value;
  }

  private outputCursor(value: unknown) {
    return typeof value === "string" &&
      value.length <= 500 &&
      /^[A-Za-z0-9+/=_-]+$/.test(value)
      ? value
      : null;
  }

  private async body(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 500_000)
      throw new SprintoApiError(
        "provider_validation_error",
        "Sprinto response exceeds Relay's size limit.",
      );
    try {
      return this.object(JSON.parse(raw.toString("utf8")));
    } catch {
      return {};
    }
  }

  private id(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value)
      ? value
      : null;
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
