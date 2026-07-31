import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type LessAnnoyingCrmCredentials = { apiKey: string };

const API_URL = "https://api.lessannoyingcrm.com/v2/";
const UID = /^[1-9][0-9]{0,63}$/;

export class LessAnnoyingCrmApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class LessAnnoyingCrmApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: LessAnnoyingCrmCredentials) {
    const user = this.user(
      this.object(await this.send(credentials, "GetUser", {})),
    );
    if (!user.userId) {
      throw new LessAnnoyingCrmApiError(
        "provider_validation_error",
        "Less Annoying CRM did not return the API-key-bound user.",
      );
    }
    return { userId: user.userId, apiVersion: "v2", reachable: true };
  }

  async getCurrentUser(credentials: LessAnnoyingCrmCredentials) {
    return {
      user: this.user(this.object(await this.send(credentials, "GetUser", {}))),
    };
  }

  async searchContacts(
    credentials: LessAnnoyingCrmCredentials,
    input: JsonObject,
  ) {
    const searchTerms = this.searchTerms(input.searchTerms);
    const limit = this.limit(input.limit);
    const body = this.object(
      await this.send(credentials, "GetContacts", {
        SearchTerms: searchTerms,
        MaxNumberOfResults: limit,
        Page: 1,
      }),
    );
    const results = Array.isArray(body.Results) ? body.Results : [];
    return {
      contacts: results
        .slice(0, limit)
        .map((value) => this.contact(this.object(value))),
      hasMore: body.HasMoreResults === true,
    };
  }

  async getContact(credentials: LessAnnoyingCrmCredentials, input: JsonObject) {
    const contactId = this.uid(input.contactId, "Contact");
    const contact = this.contact(
      this.object(
        await this.send(credentials, "GetContact", { ContactId: contactId }),
      ),
    );
    if (contact.contactId !== contactId) {
      throw new LessAnnoyingCrmApiError(
        "provider_validation_error",
        "Less Annoying CRM returned a contact outside the requested binding.",
      );
    }
    return { contact };
  }

  private async send(
    credentials: LessAnnoyingCrmCredentials,
    functionName: "GetUser" | "GetContacts" | "GetContact",
    parameters: JsonObject,
  ) {
    if (!credentials.apiKey.trim() || credentials.apiKey.length > 512) {
      throw new LessAnnoyingCrmApiError(
        "credential_missing",
        "Less Annoying CRM API key is missing or invalid.",
      );
    }
    let response: Response;
    try {
      response = await this.request(API_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: credentials.apiKey,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        body: JSON.stringify({
          Function: functionName,
          Parameters: parameters,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new LessAnnoyingCrmApiError(
        "provider_unavailable",
        "Less Annoying CRM is temporarily unavailable.",
        502,
      );
    }

    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new LessAnnoyingCrmApiError(
        "provider_validation_error",
        "Less Annoying CRM response exceeded the safe size limit.",
      );
    }
    if (!response.ok) {
      throw new LessAnnoyingCrmApiError(
        response.status === 401
          ? "credential_missing"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Less Annoying CRM API request failed.",
        response.status,
      );
    }
    try {
      return raw ? (JSON.parse(raw) as unknown) : {};
    } catch {
      throw new LessAnnoyingCrmApiError(
        "provider_validation_error",
        "Less Annoying CRM returned an invalid response.",
      );
    }
  }

  private user(row: JsonObject) {
    return {
      userId: this.uidOrNull(row.UserId),
      firstName: this.scalar(row.FirstName),
      lastName: this.scalar(row.LastName),
      timezone: this.scalar(row.Timezone),
    };
  }

  private contact(row: JsonObject) {
    return {
      contactId: this.uidOrNull(row.ContactId),
      name: this.scalar(row.Name),
      isCompany: this.scalar(row.IsCompany),
      companyName: this.scalar(row.CompanyName ?? row["Company Name"]),
      dateCreated: this.scalar(row.DateCreated),
      lastUpdate: this.scalar(row.LastUpdate),
    };
  }

  private uid(value: unknown, label: string) {
    if (typeof value !== "string" || !UID.test(value)) {
      throw new LessAnnoyingCrmApiError(
        "provider_validation_error",
        `A valid Less Annoying CRM ${label} ID is required.`,
      );
    }
    return value;
  }

  private uidOrNull(value: unknown) {
    return typeof value === "string" && UID.test(value) ? value : null;
  }

  private searchTerms(value: unknown) {
    if (typeof value !== "string") {
      throw new LessAnnoyingCrmApiError(
        "provider_validation_error",
        "Non-empty Less Annoying CRM search terms are required.",
      );
    }
    const normalized = value.trim();
    if (!normalized || normalized.length > 100) {
      throw new LessAnnoyingCrmApiError(
        "provider_validation_error",
        "Less Annoying CRM search terms are outside the supported range.",
      );
    }
    return normalized;
  }

  private scalar(value: unknown): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, 512);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 25
    ) {
      throw new LessAnnoyingCrmApiError(
        "provider_validation_error",
        "Less Annoying CRM result limit is outside the supported range.",
      );
    }
    return Number(value);
  }
}
