import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export const MICROSOFT_DYNAMICS_365_SALES_OPERATIONS = [
  "identity.get",
] as const;

export class MicrosoftDynamics365SalesApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class MicrosoftDynamics365SalesApiAdapter {
  health(accessToken: string, environmentOrigin: string) {
    return this.read(accessToken, environmentOrigin, "identity.get");
  }

  read(accessToken: string, environmentOrigin: string, operation: string) {
    if (!MICROSOFT_DYNAMICS_365_SALES_OPERATIONS.includes(operation as never))
      throw new MicrosoftDynamics365SalesApiError(
        "policy_blocked",
        "Microsoft Dynamics 365 Sales operation is outside Relay's pinned connection-summary contract.",
        403,
      );
    return this.identity(accessToken, environmentOrigin);
  }

  normalizeEnvironment(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw this.invalid("Enter a valid Dynamics 365 Sales environment URL.");
    }
    const host = url.hostname.toLowerCase();
    const supported = [
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\d*\.dynamics\.com$/,
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\.dynamics\.cn$/,
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\.microsoftdynamics\.us$/,
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\.appsplatform\.us$/,
    ].some((pattern) => pattern.test(host));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !supported
    )
      throw new MicrosoftDynamics365SalesApiError(
        "policy_blocked",
        "Dynamics 365 Sales requires an allowlisted HTTPS Dataverse environment origin without a path.",
        403,
      );
    return url.origin;
  }

  private async identity(accessToken: string, environmentValue: string) {
    if (
      !accessToken ||
      accessToken.length > 32_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new MicrosoftDynamics365SalesApiError(
        "credential_missing",
        "A valid Microsoft access token is required.",
        401,
      );
    const environmentOrigin = this.normalizeEnvironment(environmentValue);
    const url = new URL("/api/data/v9.2/WhoAmI", environmentOrigin);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "OData-MaxVersion": "4.0",
          "OData-Version": "4.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new MicrosoftDynamics365SalesApiError(
        "provider_unavailable",
        "Microsoft Dynamics 365 Sales could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 100_000)
      throw this.invalid(
        "Dynamics 365 Sales response exceeds Relay's 100 KB limit.",
      );
    const data = this.parse(raw);
    if (!response.ok)
      throw new MicrosoftDynamics365SalesApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Microsoft Dynamics 365 Sales returned HTTP ${response.status}.`,
        response.status,
      );
    const body = this.object(data);
    return {
      userId: this.guid(body.UserId),
      organizationId: this.guid(body.OrganizationId),
      businessUnitId: this.guid(body.BusinessUnitId),
      environmentOrigin,
    };
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401 || status === 403) return "credential_missing";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    const body = this.object(value);
    const nested = this.object(body.error);
    const candidate = nested.message ?? body.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private guid(value: unknown) {
    return typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
      ? value
      : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new MicrosoftDynamics365SalesApiError(
      "provider_validation_error",
      message,
      400,
    );
  }
}
