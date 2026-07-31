import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ProofCredentials = { apiKey: string };

export class ProofApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ProofApiAdapter {
  async health(credentials: ProofCredentials) {
    return this.listTransactions(credentials);
  }

  async listTransactions(credentials: ProofCredentials) {
    const value = await this.request(
      credentials,
      "/v1/transactions?limit=10&offset=0&document_url_version=v2",
    );
    const rows = this.rows(value)
      .slice(0, 10)
      .map((row) => this.summary(row));
    return { transactions: rows, count: rows.length, nextPageFollowed: false };
  }

  async getTransaction(credentials: ProofCredentials, transactionId: string) {
    if (!/^ot_[A-Za-z0-9-]{1,100}$/.test(transactionId))
      throw new ProofApiError(
        "provider_validation_error",
        "Proof transactionId must be one exact ot_ transaction ID.",
        400,
      );
    return {
      transaction: this.summary(
        await this.request(
          credentials,
          `/v1/transactions/${encodeURIComponent(transactionId)}?document_url_version=v2`,
        ),
      ),
    };
  }

  private async request(
    credentials: ProofCredentials,
    path: string,
  ): Promise<unknown> {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 8000 ||
      /[\r\n]/.test(credentials.apiKey)
    )
      throw new ProofApiError(
        "credential_missing",
        "A valid encrypted Proof API key is required.",
        401,
      );
    const url = new URL(path, "https://api.proof.com");
    if (
      url.origin !== "https://api.proof.com" ||
      !url.pathname.startsWith("/v1/transactions")
    )
      throw new ProofApiError(
        "policy_blocked",
        "Proof requests must stay on the fixed transaction-read routes.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: { Accept: "application/json", ApiKey: credentials.apiKey },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ProofApiError(
        "provider_unavailable",
        "Proof could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 1_000_000)
      throw new ProofApiError(
        "policy_blocked",
        "Proof response exceeded the one-megabyte Relay bound.",
        403,
      );
    let value: unknown;
    try {
      value = raw.length ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      value = null;
    }
    if (!response.ok)
      throw new ProofApiError(
        this.safeCode(response.status),
        `Proof returned HTTP ${response.status}.`,
        response.status,
      );
    return value;
  }

  private rows(value: unknown): JsonObject[] {
    if (Array.isArray(value)) return value.filter(this.isObject);
    if (!this.isObject(value)) return [];
    for (const key of ["transactions", "results", "data"]) {
      const candidate = value[key];
      if (Array.isArray(candidate)) return candidate.filter(this.isObject);
    }
    return [];
  }

  private summary(value: unknown) {
    if (!this.isObject(value))
      throw new ProofApiError(
        "provider_validation_error",
        "Proof returned an invalid transaction summary.",
        502,
      );
    return {
      id: this.text(value.id, 120),
      status: this.text(value.status, 120),
      detailedStatus: this.text(value.detailed_status, 200),
      transactionType: this.text(value.transaction_type, 200),
      createdAt: this.text(value.date_created, 100),
      updatedAt: this.text(value.date_updated, 100),
    };
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }
  private isObject(value: unknown): value is JsonObject {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
