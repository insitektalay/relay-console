import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type TokenContext = {
  accessToken: string;
  expiresAt: number;
};

export type MarketoCredentials = {
  subscriptionId: string;
  clientId: string;
  clientSecret: string;
  apiUser: string;
  leadId: string;
  programId: string;
};

export class MarketoApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MarketoApiAdapter {
  private readonly tokenCache = new Map<string, TokenContext>();

  async health(credentials: MarketoCredentials) {
    return this.getProgramSummary(credentials);
  }

  async getLeadSummary(credentials: MarketoCredentials) {
    const row = await this.getOne(
      credentials,
      `/rest/v1/lead/${credentials.leadId}.json`,
      new URLSearchParams({ fields: "id,createdAt,updatedAt" }),
      credentials.leadId,
    );
    return {
      lead: {
        id: this.exactId(row.id, credentials.leadId, "lead"),
        createdAt: this.optionalText(row.createdAt, 64),
        updatedAt: this.optionalText(row.updatedAt, 64),
        personalFieldsIncluded: false,
      },
    };
  }

  async getProgramSummary(credentials: MarketoCredentials) {
    const row = await this.getOne(
      credentials,
      `/rest/asset/v1/program/${credentials.programId}.json`,
      new URLSearchParams(),
      credentials.programId,
    );
    return {
      program: {
        id: this.exactId(row.id, credentials.programId, "program"),
        name: this.optionalText(row.name, 300),
        type: this.optionalText(row.type, 100),
        status: this.optionalText(row.status, 100),
        channel: this.optionalText(row.channel, 200),
        workspace: this.optionalText(row.workspace, 200),
        privateAssetDetailsIncluded: false,
      },
    };
  }

  private async getOne(
    credentials: MarketoCredentials,
    path: string,
    query: URLSearchParams,
    expectedId: string,
  ): Promise<JsonObject> {
    this.validateCredentials(credentials);
    const token = await this.token(credentials);
    const origin = this.origin(credentials.subscriptionId);
    const url = new URL(path, origin);
    url.search = query.toString();
    const approvedLead = `/rest/v1/lead/${credentials.leadId}.json`;
    const approvedProgram = `/rest/asset/v1/program/${credentials.programId}.json`;
    if (
      url.origin !== origin ||
      url.protocol !== "https:" ||
      ![approvedLead, approvedProgram].includes(url.pathname) ||
      url.hash ||
      (url.pathname === approvedLead
        ? url.search !== "?fields=id%2CcreatedAt%2CupdatedAt"
        : Boolean(url.search))
    )
      throw new MarketoApiError(
        "policy_blocked",
        "Marketo requests must stay on an approved preselected-resource path.",
        403,
      );
    const value = await this.request(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token.accessToken}`,
      },
    });
    const envelope = this.envelope(value);
    const rows = Array.isArray(envelope.result) ? envelope.result : [];
    if (rows.length !== 1)
      throw new MarketoApiError(
        "provider_validation_error",
        `Marketo did not return exactly one selected resource ${expectedId}.`,
        502,
      );
    return this.object(rows[0], "resource");
  }

  private async token(credentials: MarketoCredentials): Promise<TokenContext> {
    this.validateCredentials(credentials);
    const cacheKey = createHash("sha256")
      .update(
        [
          credentials.subscriptionId,
          credentials.clientId,
          credentials.clientSecret,
          credentials.apiUser,
        ].join("\0"),
      )
      .digest("hex");
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached;

    const url = new URL(
      "/identity/oauth/token",
      this.origin(credentials.subscriptionId),
    );
    url.search = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }).toString();
    const row = this.object(
      await this.request(url, {
        method: "POST",
        headers: { Accept: "application/json" },
      }),
      "token",
    );
    const accessToken =
      typeof row.access_token === "string" ? row.access_token : "";
    const tokenType = typeof row.token_type === "string" ? row.token_type : "";
    const apiUser = typeof row.scope === "string" ? row.scope.trim() : "";
    if (
      !this.secret(accessToken, 2_000) ||
      tokenType.toLowerCase() !== "bearer"
    )
      throw new MarketoApiError(
        "credential_missing",
        "Marketo did not return a valid bearer token.",
        401,
      );
    if (apiUser.toLowerCase() !== credentials.apiUser.toLowerCase())
      throw new MarketoApiError(
        "insufficient_scope",
        "Marketo authenticated a different API-only user than the selected user.",
        403,
      );
    const expiresIn =
      typeof row.expires_in === "number" &&
      Number.isFinite(row.expires_in) &&
      row.expires_in > 0
        ? Math.min(row.expires_in, 3_600)
        : 3_600;
    const context = {
      accessToken,
      expiresAt: Date.now() + Math.max(1, expiresIn - 120) * 1_000,
    };
    this.tokenCache.set(cacheKey, context);
    return context;
  }

  private envelope(value: unknown): JsonObject {
    const row = this.object(value, "response");
    if (row.success === true) return row;
    const errors = Array.isArray(row.errors) ? row.errors : [];
    const code = errors.length
      ? String(this.object(errors[0], "error").code ?? "")
      : "";
    throw new MarketoApiError(
      this.marketoCode(code),
      `Marketo rejected the bounded request${code ? ` with code ${code}` : ""}.`,
      this.statusForCode(code),
    );
  }

  private async request(url: URL, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new MarketoApiError(
        "provider_unavailable",
        "Marketo could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new MarketoApiError(
        "policy_blocked",
        "Marketo response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new MarketoApiError(
        this.httpCode(response.status),
        `Marketo returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private validateCredentials(value: MarketoCredentials) {
    if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/i.test(value.subscriptionId))
      throw new MarketoApiError(
        "provider_validation_error",
        "Marketo requires one exact subscription/Munchkin ID.",
        400,
      );
    if (!this.secret(value.clientId) || !this.secret(value.clientSecret))
      throw new MarketoApiError(
        "credential_missing",
        "Valid encrypted Marketo custom-service credentials are required.",
        401,
      );
    if (!/^[^@\s]{1,128}@[A-Za-z0-9.-]{1,253}$/.test(value.apiUser))
      throw new MarketoApiError(
        "provider_validation_error",
        "Marketo requires the exact API-only user email.",
        400,
      );
    if (!this.id(value.leadId) || !this.id(value.programId))
      throw new MarketoApiError(
        "provider_validation_error",
        "Marketo requires one exact numeric lead ID and program ID.",
        400,
      );
  }

  private origin(subscriptionId: string) {
    return `https://${subscriptionId.toLowerCase()}.mktorest.com`;
  }

  private exactId(value: unknown, expected: string, kind: string) {
    const actual =
      typeof value === "number"
        ? String(value)
        : typeof value === "string"
          ? value
          : "";
    if (actual !== expected)
      throw new MarketoApiError(
        "provider_validation_error",
        `Marketo returned a different ${kind} than the selected ${kind}.`,
        502,
      );
    return actual;
  }

  private object(value: unknown, label: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new MarketoApiError(
        "provider_validation_error",
        `Marketo returned an invalid ${label} result.`,
        502,
      );
    return value as JsonObject;
  }

  private optionalText(value: unknown, maximum: number) {
    return typeof value === "string" && value.length <= maximum ? value : null;
  }

  private id(value: string) {
    return (
      /^[1-9][0-9]{0,15}$/.test(value) && Number.isSafeInteger(Number(value))
    );
  }

  private secret(value: string, maximum = 8_000) {
    return Boolean(value) && value.length <= maximum && !/[\r\n]/.test(value);
  }

  private marketoCode(code: string): MarketplaceConnectorSafeErrorCode {
    if (["601", "602"].includes(code)) return "credential_missing";
    if (code === "603") return "insufficient_scope";
    if (["606", "607", "615"].includes(code)) return "provider_rate_limited";
    if (["500", "502", "604", "608", "611", "614"].includes(code))
      return "provider_unavailable";
    return "provider_validation_error";
  }

  private statusForCode(code: string) {
    if (["601", "602"].includes(code)) return 401;
    if (code === "603") return 403;
    if (["606", "607", "615"].includes(code)) return 429;
    if (["500", "502", "604", "608", "611", "614"].includes(code)) return 502;
    return 400;
  }

  private httpCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
