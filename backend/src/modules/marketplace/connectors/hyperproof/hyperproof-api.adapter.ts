import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type HyperproofCredentials = { clientId: string; clientSecret: string };
export const HYPERPROOF_OPERATIONS = ["controls.get"] as const;

export class HyperproofApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class HyperproofApiAdapter {
  private readonly apiOrigin = "https://api.hyperproof.app";
  private readonly tokenEndpoint =
    "https://accounts.hyperproof.app/oauth/token";

  async health(credentials: HyperproofCredentials) {
    await this.token(credentials);
    return {
      apiOrigin: this.apiOrigin,
      tokenEndpoint: this.tokenEndpoint,
      clientCredentialsVerified: true,
    };
  }

  async read(credentials: HyperproofCredentials, input: JsonObject) {
    if (input.operation !== "controls.get")
      throw new HyperproofApiError(
        "policy_blocked",
        "Hyperproof operation is outside Relay's pinned single-control read.",
        403,
      );
    const controlId = this.uuid(input.controlId);
    if (!controlId)
      throw new HyperproofApiError(
        "provider_validation_error",
        "A valid Hyperproof control UUID is required.",
      );
    const token = await this.token(credentials);
    const response = await this.request(
      new URL(`/v1/controls/${controlId}`, this.apiOrigin),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const body = await this.body(response);
    if (!response.ok) throw this.httpError(response.status, "API");
    const id = this.uuid(body.id);
    if (!id)
      throw new HyperproofApiError(
        "provider_validation_error",
        "Hyperproof returned an invalid control record.",
        502,
      );
    return {
      control: {
        id,
        identifier: this.text(body.controlIdentifier, 200),
        name: this.text(body.name, 300),
        workStatus: this.text(body.workStatus, 100),
        status: this.text(body.status, 100),
      },
    };
  }

  private async token(credentials: HyperproofCredentials) {
    const clientId = this.credential(credentials.clientId, "client ID");
    const clientSecret = this.credential(
      credentials.clientSecret,
      "client secret",
    );
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    });
    const response = await this.request(new URL(this.tokenEndpoint), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = await this.body(response, 100_000);
    if (!response.ok) throw this.httpError(response.status, "token service");
    const accessToken = this.text(data.access_token, 20_000);
    if (!accessToken || /[\r\n]/.test(accessToken))
      throw new HyperproofApiError(
        "credential_missing",
        "Hyperproof did not return a valid access token.",
        401,
      );
    return accessToken;
  }

  private async request(url: URL, init: RequestInit) {
    try {
      return await safeConnectorFetch(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new HyperproofApiError(
        "provider_unavailable",
        "Hyperproof API could not be reached.",
        502,
      );
    }
  }

  private httpError(status: number, service: string) {
    return new HyperproofApiError(
      status === 429
        ? "provider_rate_limited"
        : status >= 500
          ? "provider_unavailable"
          : status === 401 || status === 403
            ? "credential_missing"
            : "provider_validation_error",
      `Hyperproof ${service} returned HTTP ${status}.`,
      status || 400,
    );
  }

  private credential(value: string, label: string) {
    if (!value || value.length > 2_000 || /[\r\n]/.test(value))
      throw new HyperproofApiError(
        "credential_missing",
        `A valid Hyperproof ${label} is required.`,
        401,
      );
    return value;
  }

  private uuid(value: unknown): string | null {
    return typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
      ? value.toLowerCase()
      : null;
  }

  private async body(response: Response, max = 500_000) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > max)
      throw new HyperproofApiError(
        "provider_validation_error",
        "Hyperproof response exceeds Relay's size limit.",
      );
    try {
      return this.object(JSON.parse(raw.toString("utf8")));
    } catch {
      return {};
    }
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
