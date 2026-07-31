import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type DocuSignClmOperationInput = {
  apiOrigin?: unknown;
  accountId?: unknown;
  folderId?: unknown;
};
export const DOCUSIGN_CLM_READ_OPERATIONS = ["folder.get"] as const;

export class DocuSignClmApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DocuSignClmApiAdapter {
  health(accessToken: string, input: DocuSignClmOperationInput) {
    return this.read(accessToken, "folder.get", input);
  }

  read(
    accessToken: string,
    operation: string,
    input: DocuSignClmOperationInput,
  ) {
    this.requireToken(accessToken);
    if (
      !DOCUSIGN_CLM_READ_OPERATIONS.includes(operation as never) ||
      Object.keys(input).some(
        (key) => !["apiOrigin", "accountId", "folderId"].includes(key),
      )
    )
      throw new DocuSignClmApiError(
        "policy_blocked",
        "DocuSign CLM accepts only Relay's pinned folder-metadata operation.",
        403,
      );
    return this.request(
      accessToken,
      this.origin(input.apiOrigin),
      this.uuid(input.accountId, "accountId"),
      this.uuid(input.folderId, "folderId"),
    );
  }

  private async request(
    accessToken: string,
    origin: string,
    accountId: string,
    folderId: string,
  ) {
    const root = new URL(`${origin}/`);
    const url = new URL(`v2/${accountId}/folders/${folderId}`, root);
    if (url.origin !== root.origin || !url.pathname.startsWith("/v2/"))
      throw new DocuSignClmApiError(
        "policy_blocked",
        "DocuSign CLM requests must stay on the validated Object API route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new DocuSignClmApiError(
        "provider_unavailable",
        "DocuSign CLM could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("DocuSign CLM response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new DocuSignClmApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `DocuSign CLM returned HTTP ${response.status}.`,
        response.status,
      );
    return this.minimize(data, accountId, folderId);
  }

  private minimize(value: unknown, accountId: string, folderId: string) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { accountId, folderId, folder: null };
    const item = value as JsonObject;
    const fields = [
      "Id",
      "Name",
      "Description",
      "Type",
      "FolderType",
      "ParentFolderId",
      "CreatedDate",
      "ModifiedDate",
      "IsDeleted",
    ];
    return {
      accountId,
      folderId,
      folder: Object.fromEntries(
        fields
          .filter((field) => item[field] !== undefined)
          .map((field) => [field, item[field]]),
      ),
    };
  }

  private requireToken(token: string) {
    if (!token || token.length > 16_000 || /[\r\n]/.test(token))
      throw new DocuSignClmApiError(
        "credential_missing",
        "A valid DocuSign OAuth access token is required.",
        401,
      );
  }

  private origin(value: unknown) {
    const text = String(value ?? "").replace(/\/$/, "");
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw this.invalid("apiOrigin must be a valid DocuSign CLM API origin.");
    }
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !/^api\.[a-z0-9-]+\.[a-z0-9-]+\.clm(?:\.demo)?\.docusign\.net$/i.test(
        url.hostname,
      )
    )
      throw this.invalid(
        "apiOrigin must be an account-issued DocuSign CLM Object API origin.",
      );
    return url.origin;
  }

  private uuid(value: unknown, name: string) {
    const id = String(value ?? "");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw this.invalid(`${name} must be a valid UUID.`);
    return id;
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 50).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 5_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|href|url|owner|user|party|email|document|attribute|content)/i.test(
            key,
          )
            ? "[REDACTED]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const body = value as JsonObject;
    const candidate = body.Message ?? body.message ?? body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new DocuSignClmApiError("provider_validation_error", message, 400);
  }
}
