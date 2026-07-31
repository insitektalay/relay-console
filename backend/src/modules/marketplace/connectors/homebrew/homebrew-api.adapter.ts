import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type HomebrewCredentials = {
  formulaToken: string;
  caskToken: string;
};

export class HomebrewApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class HomebrewApiAdapter {
  private readonly origin = "https://formulae.brew.sh";

  async health(credentials: HomebrewCredentials) {
    return this.getFormulaSummary(credentials);
  }

  async getFormulaSummary(credentials: HomebrewCredentials) {
    this.validate(credentials);
    const row = await this.get(
      `/api/formula/${encodeURIComponent(credentials.formulaToken)}.json`,
    );
    const versions = this.optionalObject(row.versions);
    return {
      formula: {
        token: this.exactToken(row.name, credentials.formulaToken, "formula"),
        fullName: this.text(row.full_name, 256),
        tap: this.text(row.tap, 128),
        stableVersion: this.text(versions?.stable, 128),
        revision: this.integer(row.revision),
        deprecated: this.boolean(row.deprecated),
        disabled: this.boolean(row.disabled),
        sourceAndInstallDetailsIncluded: false,
      },
    };
  }

  async getCaskSummary(credentials: HomebrewCredentials) {
    this.validate(credentials);
    const row = await this.get(
      `/api/cask/${encodeURIComponent(credentials.caskToken)}.json`,
    );
    return {
      cask: {
        token: this.exactToken(row.token, credentials.caskToken, "cask"),
        fullToken: this.text(row.full_token, 256),
        tap: this.text(row.tap, 128),
        version: this.text(row.version, 128),
        autoUpdates: this.boolean(row.auto_updates),
        deprecated: this.boolean(row.deprecated),
        disabled: this.boolean(row.disabled),
        artifactAndInstallDetailsIncluded: false,
      },
    };
  }

  private async get(path: string) {
    const url = new URL(path, this.origin);
    if (
      url.origin !== this.origin ||
      url.pathname !== path ||
      url.search ||
      url.hash
    )
      throw new HomebrewApiError(
        "policy_blocked",
        "Homebrew requests must stay on one approved selected-item path.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "ClawChat Marketplace (https://clawchat.com)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new HomebrewApiError(
        "provider_unavailable",
        "Homebrew Formulae API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new HomebrewApiError(
        "policy_blocked",
        "Homebrew response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new HomebrewApiError(
        this.safeCode(response.status),
        `Homebrew Formulae API returned HTTP ${response.status}.`,
        response.status,
      );
    return this.object(value, "selected item");
  }

  private validate(value: HomebrewCredentials) {
    if (!this.token(value.formulaToken) || !this.token(value.caskToken))
      throw new HomebrewApiError(
        "provider_validation_error",
        "Homebrew requires exact safe formula and cask tokens.",
        400,
      );
  }

  private exactToken(value: unknown, expected: string, kind: string) {
    if (value !== expected)
      throw new HomebrewApiError(
        "provider_validation_error",
        `Homebrew returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return expected;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new HomebrewApiError(
        "provider_validation_error",
        `Homebrew returned an invalid ${label}.`,
        502,
      );
    return value as JsonObject;
  }

  private optionalObject(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }

  private integer(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value)
      ? value
      : null;
  }

  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
  }

  private token(value: string) {
    return /^[a-z0-9][a-z0-9@+._-]{0,127}$/.test(value);
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 404 || status === 400 || status === 422)
      return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
