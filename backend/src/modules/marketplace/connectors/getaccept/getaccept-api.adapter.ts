import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type GetAcceptCredentials = { accessToken: string };

export class GetAcceptApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class GetAcceptApiAdapter {
  private static readonly API_ORIGIN = "https://api.getaccept.com";

  health(credentials: GetAcceptCredentials) {
    this.accessToken(credentials);
    return {
      credentialPresent: true,
      validationMode: "presence_only",
      providerRequestCount: 0,
      automaticSendingEnabled: false,
    };
  }

  async createDocumentDraft(
    credentials: GetAcceptCredentials,
    input: JsonObject,
  ) {
    const token = this.accessToken(credentials);
    const name = this.requiredString(input.name, "name", 200);
    const fileUrl = this.publicHttpsUrl(input.fileUrl);
    const recipients = this.recipients(input.recipients);
    const customFields = this.customFields(input.customFields);
    const body: JsonObject = {
      name,
      file_url: fileUrl,
      recipients,
      is_automatic_sending: false,
    };
    if (customFields.length) body.custom_fields = customFields;
    const encoded = JSON.stringify(body);
    if (Buffer.byteLength(encoded) > 150_000)
      throw this.validation(
        "GetAccept draft input exceeded Relay's 150 KB bound.",
      );

    let response: Response;
    try {
      response = await safeConnectorFetch(`${GetAcceptApiAdapter.API_ORIGIN}/v1/documents`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: encoded,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new GetAcceptApiError(
        "provider_unavailable",
        "GetAccept could not be reached.",
        502,
      );
    }

    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("GetAccept response exceeded Relay's 1 MB bound.");
    let value: JsonObject = {};
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw this.validation("GetAccept returned invalid JSON.");
    }
    if (!response.ok)
      throw new GetAcceptApiError(
        this.errorCode(response.status),
        "GetAccept rejected the bounded draft request.",
        response.status,
      );

    return {
      semanticWriteContract: "getaccept-document-draft-create-v1",
      document: {
        documentId: this.scalar(value.id ?? value.document_id, 256),
        name: this.scalar(value.name, 200) ?? name,
        status: this.scalar(value.status, 96),
        createdAt: this.scalar(value.created_at ?? value.created, 64),
      },
      recipientCount: recipients.length,
      customFieldCount: customFields.length,
      automaticSendingEnabled: false,
      sent: false,
      providerRequestCount: 1,
      rawProviderResponseReturned: false,
      recipientIdentityReturned: false,
      fileUrlReturned: false,
      accessTokenReturned: false,
      automaticRetries: false,
    };
  }

  private accessToken(credentials: GetAcceptCredentials) {
    const token = credentials.accessToken?.trim();
    if (!token || token.length > 10_000)
      throw new GetAcceptApiError(
        "credential_missing",
        "GetAccept access token is missing.",
        401,
      );
    return token;
  }

  private publicHttpsUrl(value: unknown) {
    if (typeof value !== "string" || value.length > 2_048)
      throw this.validation("fileUrl must be a public HTTPS URL.");
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw this.validation("fileUrl must be a public HTTPS URL.");
    }
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.port ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      !host.includes(".") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
      host.includes(":")
    )
      throw this.validation(
        "fileUrl must use a public HTTPS hostname without credentials, fragments, ports, or IP literals.",
      );
    return url.toString();
  }

  private recipients(value: unknown) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 20)
      throw this.validation("GetAccept requires one to 20 recipients.");
    const emails = new Set<string>();
    return value.map((entry) => {
      const item = this.object(entry);
      const email = this.requiredString(
        item.email,
        "recipient email",
        320,
      ).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || emails.has(email))
        throw this.validation(
          "GetAccept recipient emails must be valid and unique.",
        );
      emails.add(email);
      return {
        first_name: this.requiredString(
          item.firstName,
          "recipient firstName",
          100,
        ),
        last_name: this.requiredString(
          item.lastName,
          "recipient lastName",
          100,
        ),
        email,
        role: "signer",
      };
    });
  }

  private customFields(value: unknown) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 50)
      throw this.validation(
        "GetAccept supports at most 50 custom fields per draft.",
      );
    return value.map((entry) => {
      const item = this.object(entry);
      const id = this.optionalString(item.id, 200);
      const name = this.optionalString(item.name, 200);
      if ((id ? 1 : 0) + (name ? 1 : 0) !== 1)
        throw this.validation(
          "Each custom field requires exactly one id or name.",
        );
      return {
        ...(id ? { id } : { name }),
        value:
          typeof item.value === "string" && item.value.length <= 5_000
            ? item.value
            : (() => {
                throw this.validation(
                  "Each GetAccept custom-field value must be a string of at most 5000 characters.",
                );
              })(),
      };
    });
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(
        `${name} is required and must be at most ${max} characters.`,
      );
    return value.trim();
  }

  private optionalString(value: unknown, max: number) {
    return typeof value === "string" && value.trim() && value.length <= max
      ? value.trim()
      : undefined;
  }

  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new GetAcceptApiError("provider_validation_error", message);
  }
}
