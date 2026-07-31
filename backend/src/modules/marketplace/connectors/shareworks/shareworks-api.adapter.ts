import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { randomUUID, sign } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ShareworksCredentials = {
  accountNumber: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
};
export const SHAREWORKS_OPERATIONS = ["company.list"] as const;

export class ShareworksApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class ShareworksApiAdapter {
  private readonly apiOrigin = "https://shareworks-api.solium.com";

  async health(credentials: ShareworksCredentials) {
    const result = await this.read(credentials, {
      operation: "company.list",
      pageSize: 1,
      pageNumber: 1,
    });
    return {
      apiOrigin: this.apiOrigin,
      companyDirectoryVerified: true,
      visibleCountAtLeast: result.companies.length,
    };
  }

  async read(credentials: ShareworksCredentials, input: JsonObject) {
    if (input.operation !== "company.list")
      throw new ShareworksApiError(
        "policy_blocked",
        "Shareworks operation is outside Relay's pinned company directory.",
        403,
      );
    const pageSize = this.integer(input.pageSize, 1, 20, 20);
    const pageNumber = this.integer(input.pageNumber, 1, 10_000, 1);
    const token = await this.token(credentials);
    const url = new URL("/rest/admin/v1/company", this.apiOrigin);
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("pageNumber", String(pageNumber));
    const response = await this.request(url, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    const body = await this.body(response);
    if (!response.ok) throw this.httpError(response.status, "API");
    if (!Array.isArray(body))
      throw new ShareworksApiError(
        "provider_validation_error",
        "Shareworks returned an invalid company directory.",
        502,
      );
    const companies = body
      .slice(0, pageSize)
      .map((entry) => this.object(entry))
      .map((company) => ({
        id: this.id(company.companyId),
        name: this.text(company.companyName, 1_000),
      }))
      .filter((company) => company.id !== null && company.name);
    return {
      companies,
      pageSize,
      pageNumber,
      nextPageNumber: body.length === pageSize ? pageNumber + 1 : null,
    };
  }

  private async token(credentials: ShareworksCredentials) {
    const verificationToken = this.verificationToken(credentials);
    const response = await this.request(
      new URL("/rest/admin/v1/auth/tokens", this.apiOrigin),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${verificationToken}`,
          "Content-Length": "0",
          "Content-Type": "text/plain",
        },
      },
    );
    const body = this.object(await this.body(response, 100_000));
    if (!response.ok) throw this.httpError(response.status, "token service");
    const accessToken = this.text(body.accessToken, 20_000);
    if (!accessToken || /[\r\n]/.test(accessToken))
      throw new ShareworksApiError(
        "credential_missing",
        "Shareworks did not return a valid access token.",
        401,
      );
    return accessToken;
  }

  private verificationToken(credentials: ShareworksCredentials) {
    const accountNumber = this.credential(
      credentials.accountNumber,
      "account number",
    );
    const clientId = this.credential(credentials.clientId, "client ID");
    const clientSecret = this.credential(
      credentials.clientSecret,
      "client secret",
    );
    const privateKey = credentials.privateKey?.trim();
    if (
      !privateKey ||
      privateKey.length > 20_000 ||
      !/^-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+-----END (?:RSA )?PRIVATE KEY-----$/.test(
        privateKey,
      )
    )
      throw new ShareworksApiError(
        "credential_missing",
        "A valid Shareworks RSA private key is required.",
        401,
      );
    const now = Math.floor(Date.now() / 1_000);
    const header = this.base64Url({ alg: "RS256", typ: "JWT" });
    const payload = this.base64Url({
      iss: "shareworks.com",
      iat: now,
      exp: now + 900,
      aud: "shareworks-api.solium.com",
      sub: accountNumber,
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      jti: randomUUID(),
    });
    const signingInput = `${header}.${payload}`;
    try {
      const signature = sign(
        "RSA-SHA256",
        Buffer.from(signingInput),
        privateKey,
      );
      return `${signingInput}.${signature.toString("base64url")}`;
    } catch {
      throw new ShareworksApiError(
        "credential_missing",
        "Shareworks RSA private key could not sign the verification token.",
        401,
      );
    }
  }

  private base64Url(value: JsonObject) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
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
      throw new ShareworksApiError(
        "provider_unavailable",
        "Shareworks API could not be reached.",
        502,
      );
    }
  }

  private httpError(status: number, service: string) {
    return new ShareworksApiError(
      status === 429
        ? "provider_rate_limited"
        : status >= 500
          ? "provider_unavailable"
          : status === 401 || status === 403
            ? "credential_missing"
            : "provider_validation_error",
      `Shareworks ${service} returned HTTP ${status}.`,
      status || 400,
    );
  }

  private credential(value: string, label: string) {
    if (!value || value.length > 2_000 || /[\r\n]/.test(value))
      throw new ShareworksApiError(
        "credential_missing",
        `A valid Shareworks ${label} is required.`,
        401,
      );
    return value;
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new ShareworksApiError(
        "provider_validation_error",
        `Integer must be between ${min} and ${max}.`,
      );
    return Number(value);
  }

  private async body(response: Response, max = 250_000): Promise<unknown> {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > max)
      throw new ShareworksApiError(
        "provider_validation_error",
        "Shareworks response exceeds Relay's size limit.",
      );
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return null;
    }
  }

  private id(value: unknown) {
    return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
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
