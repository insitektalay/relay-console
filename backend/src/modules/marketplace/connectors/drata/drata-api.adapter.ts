import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type DrataCredentials = {
  region: string;
  workspaceId: string;
  apiKey: string;
};
export const DRATA_OPERATIONS = ["frameworks.list"] as const;

export class DrataApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class DrataApiAdapter {
  async health(credentials: DrataCredentials) {
    const result = await this.read(credentials, {
      operation: "frameworks.list",
      size: 1,
    });
    return {
      region: this.region(credentials.region),
      workspaceId: this.workspaceId(credentials.workspaceId),
      frameworkDirectoryVerified: true,
      visibleCountAtLeast: result.frameworks.length,
    };
  }

  async read(credentials: DrataCredentials, input: JsonObject) {
    if (input.operation !== "frameworks.list")
      throw new DrataApiError(
        "policy_blocked",
        "Drata operation is outside Relay's pinned framework directory.",
        403,
      );
    const size = this.integer(input.size, 1, 20, 20);
    const cursor = this.cursor(input.cursor);
    const workspaceId = this.workspaceId(credentials.workspaceId);
    const url = new URL(
      `/public/v2/workspaces/${workspaceId}/frameworks`,
      this.origin(credentials.region),
    );
    url.searchParams.set("size", String(size));
    if (cursor) url.searchParams.set("cursor", cursor);

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.credential(credentials.apiKey)}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new DrataApiError(
        "provider_unavailable",
        "Drata API could not be reached.",
        502,
      );
    }

    const body = await this.body(response);
    if (!response.ok)
      throw new DrataApiError(
        response.status === 429
          ? "provider_rate_limited"
          : response.status >= 500
            ? "provider_unavailable"
            : response.status === 401 || response.status === 403
              ? "credential_missing"
              : "provider_validation_error",
        `Drata returned HTTP ${response.status}.`,
        response.status || 400,
      );
    if (!Array.isArray(body.data))
      throw new DrataApiError(
        "provider_validation_error",
        "Drata returned an invalid framework directory.",
        502,
      );

    const pagination = this.object(body.pagination);
    return {
      frameworks: body.data
        .slice(0, size)
        .map((entry) => this.object(entry))
        .map((item) => ({
          id: this.positiveInteger(item.id),
          name: this.text(item.name, 250),
          slug: this.text(item.slug, 191),
          tag: this.text(item.tag, 100),
          isReady: typeof item.isReady === "boolean" ? item.isReady : null,
          isEnabled:
            typeof item.isEnabled === "boolean" ? item.isEnabled : null,
        }))
        .filter((item) => item.id !== null),
      size,
      nextCursor: this.outputCursor(pagination.cursor),
    };
  }

  private origin(value: string) {
    switch (this.region(value)) {
      case "eu":
        return "https://public-api.eu.drata.com";
      case "apac":
        return "https://public-api.apac.drata.com";
      default:
        return "https://public-api.drata.com";
    }
  }

  private region(value: string) {
    const region = value.trim().toLowerCase();
    if (region !== "us" && region !== "eu" && region !== "apac")
      throw new DrataApiError(
        "provider_validation_error",
        "Drata region must be us, eu, or apac.",
      );
    return region;
  }

  private workspaceId(value: string) {
    if (!/^[1-9][0-9]{0,14}$/.test(value))
      throw new DrataApiError(
        "provider_validation_error",
        "A valid numeric Drata workspace ID is required.",
      );
    const id = Number(value);
    if (!Number.isSafeInteger(id))
      throw new DrataApiError(
        "provider_validation_error",
        "A valid numeric Drata workspace ID is required.",
      );
    return id;
  }

  private credential(value: string) {
    if (!value || value.length > 4_000 || /[\r\n ]/.test(value))
      throw new DrataApiError(
        "credential_missing",
        "A valid Drata API key is required.",
        401,
      );
    return value;
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new DrataApiError(
        "provider_validation_error",
        `Integer must be between ${min} and ${max}.`,
      );
    return Number(value);
  }

  private cursor(value: unknown) {
    if (value === undefined) return null;
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > 500 ||
      !/^[A-Za-z0-9+/=_-]+$/.test(value)
    )
      throw new DrataApiError(
        "provider_validation_error",
        "Drata cursor is invalid.",
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
      throw new DrataApiError(
        "provider_validation_error",
        "Drata response exceeds Relay's size limit.",
      );
    try {
      return this.object(JSON.parse(raw.toString("utf8")));
    } catch {
      return {};
    }
  }

  private positiveInteger(value: unknown) {
    return Number.isSafeInteger(value) && Number(value) > 0
      ? Number(value)
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
