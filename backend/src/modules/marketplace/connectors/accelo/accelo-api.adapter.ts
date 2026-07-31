import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type AcceloCredentials = {
  deployment: string;
  clientId: string;
  clientSecret: string;
  jobId: string;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

export class AcceloApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AcceloApiAdapter {
  private readonly tokens = new Map<string, CachedToken>();

  async health(credentials: AcceloCredentials) {
    return this.getSelectedProjectState(credentials);
  }

  async getSelectedProjectState(credentials: AcceloCredentials) {
    const deployment = this.deployment(credentials.deployment);
    const jobId = this.id(credentials.jobId, "project");
    const accessToken = await this.accessToken({ ...credentials, deployment });
    const body = await this.fetchJson(
      `https://${deployment}.api.accelo.com/api/v0/jobs/${jobId}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
      "resource",
    );
    const meta = this.object(body.meta, "response metadata");
    if (meta.status !== "ok" || this.integer(meta.response_code) !== 200)
      throw this.invalid("Accelo returned unsuccessful response metadata.");
    const job = this.object(body.response, "selected project");
    if (String(job.id) !== jobId)
      throw this.invalid("Accelo returned a different project than selected.");
    return {
      project: {
        projectId: jobId,
        standing: this.text(job.standing, "project standing", 40),
        pausedDays: this.nonnegativeInteger(job.paused, "paused days"),
        scheduledStartAtUnix: this.optionalUnix(
          job.date_started,
          "scheduled start",
        ),
        dueAtUnix: this.optionalUnix(job.date_due, "due date"),
        completedAtUnix: this.optionalUnix(
          job.date_completed,
          "completion date",
        ),
        titleOrClientIncluded: false,
        peopleOrFinancialsIncluded: false,
      },
    };
  }

  private async accessToken(credentials: AcceloCredentials) {
    const deployment = this.deployment(credentials.deployment);
    const clientId = this.credential(credentials.clientId, "client ID", 8);
    const clientSecret = this.credential(
      credentials.clientSecret,
      "client secret",
      16,
    );
    if (clientId.includes(":"))
      throw new AcceloApiError(
        "credential_missing",
        "Accelo client ID is invalid.",
        401,
      );
    const key = createHash("sha256")
      .update(`${deployment}\0${clientId}\0${clientSecret}`)
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000)
      return cached.accessToken;
    const authorization = Buffer.from(
      `${clientId}:${clientSecret}`,
      "utf8",
    ).toString("base64");
    const body = await this.fetchJson(
      `https://${deployment}.api.accelo.com/oauth2/v0/token`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "RelayConsole/1.0",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "read(jobs)",
          expires_in: "3600",
        }).toString(),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
      "token",
    );
    const tokenBody = this.tokenPayload(body);
    const accessToken = this.credential(
      String(tokenBody.access_token ?? ""),
      "access token",
      8,
    );
    const expiresIn = this.integer(tokenBody.expires_in);
    if (!expiresIn || expiresIn < 60 || expiresIn > 2_592_000)
      throw this.invalid("Accelo returned an invalid token lifetime.");
    if (tokenBody.deployment !== deployment)
      throw this.invalid("Accelo returned a token for another deployment.");
    if (typeof tokenBody.scope === "string") {
      const scope = tokenBody.scope.trim();
      if (scope !== "read(jobs)")
        throw this.invalid(
          "Accelo returned broader or unexpected token scope.",
        );
    }
    this.tokens.set(key, {
      accessToken,
      expiresAt: Date.now() + Math.min(expiresIn, 3_600) * 1_000,
    });
    return accessToken;
  }

  private async fetchJson(
    url: string,
    init: RequestInit,
    phase: "token" | "resource",
  ) {
    let response: Response;
    try {
      response = await safeConnectorFetch(url, init);
    } catch {
      throw new AcceloApiError(
        "provider_unavailable",
        "Accelo API could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 262_144)
      throw this.invalid("Accelo response exceeded the 256 KiB Relay bound.");
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new AcceloApiError(
        this.safeCode(response.status, phase),
        `Accelo API returned HTTP ${response.status}.`,
        response.status,
      );
    return this.object(value, "API response");
  }

  private tokenPayload(body: JsonObject) {
    if (body.response && typeof body.response === "object")
      return this.object(body.response, "token response");
    return body;
  }

  private deployment(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized))
      throw new AcceloApiError(
        "credential_missing",
        "Accelo deployment must be one exact deployment prefix.",
        401,
      );
    return normalized;
  }

  private credential(value: string, label: string, minimum: number) {
    if (
      typeof value !== "string" ||
      value.length < minimum ||
      value.length > 4_096 ||
      !/^[\x21-\x7e]+$/.test(value)
    )
      throw new AcceloApiError(
        "credential_missing",
        `Accelo ${label} is missing or invalid.`,
        401,
      );
    return value;
  }

  private id(value: string, label: string) {
    if (!/^[1-9][0-9]{0,18}$/.test(value))
      throw this.invalid(
        `Accelo ${label} ID must be one positive integer.`,
        400,
      );
    return value;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.invalid(`Accelo returned an invalid ${label}.`);
    return value as JsonObject;
  }

  private text(value: unknown, label: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum)
      throw this.invalid(`Accelo returned an invalid ${label}.`);
    return value;
  }

  private integer(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  private nonnegativeInteger(value: unknown, label: string) {
    const parsed = this.integer(value);
    if (parsed === null || parsed < 0 || parsed > 100_000)
      throw this.invalid(`Accelo returned invalid ${label}.`);
    return parsed;
  }

  private optionalUnix(value: unknown, label: string) {
    if (value === null || value === undefined || value === "") return null;
    if (
      (typeof value !== "string" && typeof value !== "number") ||
      !/^[0-9]{1,12}$/.test(String(value))
    )
      throw this.invalid(`Accelo returned an invalid ${label}.`);
    return String(value);
  }

  private invalid(message: string, statusCode = 502) {
    return new AcceloApiError("provider_validation_error", message, statusCode);
  }

  private safeCode(
    status: number,
    phase: "token" | "resource",
  ): MarketplaceConnectorSafeErrorCode {
    if (status === 401)
      return phase === "token" ? "credential_missing" : "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500 || status === 408) return "provider_unavailable";
    return "provider_validation_error";
  }
}
