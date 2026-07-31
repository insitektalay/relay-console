import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type MyobCredentials = {
  accessToken: string;
  clientId: string;
  companyFileId: string;
  companyFileToken: string;
};

const GUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class MyobApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class MyobApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: MyobCredentials) {
    const result = await this.getCompanyFile(credentials);
    return { companyFileId: result.companyFile.companyFileId, reachable: true };
  }

  async getCompanyFile(credentials: MyobCredentials) {
    const validated = this.credentials(credentials);
    const data = await this.get(validated, "/");
    const rows = Array.isArray(data) ? data : [data];
    const exact = rows
      .map((value) => this.object(value))
      .find(
        (value) =>
          this.text(value.Id ?? value.id).toLowerCase() ===
          validated.companyFileId,
      );
    if (!exact) {
      throw new MyobApiError(
        "provider_validation_error",
        "MYOB returned a company file outside the consent-selected binding.",
      );
    }
    return { companyFile: this.companyFile(exact) };
  }

  async getApiInfo(credentials: MyobCredentials, input: JsonObject) {
    const validated = this.credentials(credentials);
    const limit = this.limit(input.limit);
    const data = this.object(await this.get(validated, "/Info"));
    const resources = Array.isArray(data.Resources) ? data.Resources : [];
    return {
      companyFileId: validated.companyFileId,
      build: this.text(data.Build),
      resources: resources
        .slice(0, limit)
        .map((value) => this.resource(this.object(value))),
      nextPageFollowed: false,
    };
  }

  private async get(
    credentials: ReturnType<MyobApiAdapter["credentials"]>,
    path: "/" | "/Info",
  ): Promise<JsonObject | unknown[]> {
    const url = `https://api.myob.com/accountright/${credentials.companyFileId}${path}`;
    let response: Response;
    try {
      response = await this.request(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "x-myobapi-cftoken": credentials.companyFileToken,
          "x-myobapi-key": credentials.clientId,
          "x-myobapi-version": "v2",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new MyobApiError(
        "provider_unavailable",
        "MYOB is temporarily unavailable.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new MyobApiError(
        "provider_validation_error",
        "MYOB response exceeded the safe size limit.",
      );
    }
    if (!response.ok) {
      throw new MyobApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "MYOB API request failed.",
        response.status,
      );
    }
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (Array.isArray(parsed)) return parsed;
      return this.object(parsed);
    } catch {
      throw new MyobApiError(
        "provider_validation_error",
        "MYOB returned an invalid response.",
      );
    }
  }

  private credentials(credentials: MyobCredentials) {
    const accessToken = credentials.accessToken.trim();
    const clientId = credentials.clientId.trim();
    const companyFileId = credentials.companyFileId.trim().toLowerCase();
    const companyFileToken = credentials.companyFileToken.trim();
    if (!GUID.test(companyFileId)) {
      throw new MyobApiError(
        "provider_validation_error",
        "A valid consent-selected MYOB company-file binding is required.",
      );
    }
    if (
      !accessToken ||
      accessToken.length > 16_384 ||
      !clientId ||
      clientId.length > 512 ||
      !companyFileToken ||
      companyFileToken.length > 8_192 ||
      !this.validCompanyFileToken(companyFileToken)
    ) {
      throw new MyobApiError(
        "credential_missing",
        "MYOB OAuth, API-key, or company-file credentials are missing or invalid.",
      );
    }
    return { accessToken, clientId, companyFileId, companyFileToken };
  }

  private companyFile(row: JsonObject) {
    const level = this.object(row.ProductLevel ?? row.productLevel);
    return {
      companyFileId: this.text(row.Id ?? row.id).toLowerCase(),
      name: this.text(row.Name ?? row.name),
      productVersion: this.text(row.ProductVersion ?? row.productVersion),
      productLevel: {
        code: this.scalar(level.Code ?? level.code),
        name: this.text(level.Name ?? level.name),
      },
      country: this.text(row.Country ?? row.country),
      uiAccessFlags: this.scalar(row.UIAccessFlags ?? row.uiAccessFlags),
      checkedOut: Boolean(row.CheckedOutDate ?? row.checkedOutDate),
    };
  }

  private resource(row: JsonObject) {
    const level = this.object(
      row.MinimumProductLevel ?? row.minimumProductLevel,
    );
    return {
      path: this.text(row.ResourcePath ?? row.resourcePath),
      version: this.text(row.Version ?? row.version),
      fromProductVersion: this.text(
        row.FromProductVersion ?? row.fromProductVersion,
      ),
      toProductVersion: this.text(row.ToProductVersion ?? row.toProductVersion),
      minimumProductLevel: {
        code: this.scalar(level.Code ?? level.code),
        name: this.text(level.Name ?? level.name),
      },
    };
  }

  private validCompanyFileToken(value: string) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
    try {
      const decoded = Buffer.from(value, "base64").toString("utf8");
      return decoded.includes(":") && !/[\r\n\0]/.test(decoded);
    } catch {
      return false;
    }
  }

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 25
    ) {
      throw new MyobApiError(
        "provider_validation_error",
        "MYOB result limit is outside the supported range.",
      );
    }
    return Number(value);
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 512) : "";
  }

  private scalar(value: unknown) {
    return typeof value === "string" || typeof value === "number"
      ? value
      : null;
  }
}
