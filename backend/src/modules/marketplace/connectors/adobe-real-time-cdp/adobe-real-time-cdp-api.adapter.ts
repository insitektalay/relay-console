import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  ADOBE_REAL_TIME_CDP_OPERATION_BY_ID,
  type AdobeRealTimeCdpOperation,
} from "./adobe-real-time-cdp-operation-registry";

type JsonObject = Record<string, unknown>;
export type AdobeRealTimeCdpCredentials = {
  clientId: string;
  clientSecret: string;
  scopes: string;
  organizationId: string;
  sandboxName: string;
};
export type AdobeRealTimeCdpInput = {
  start?: unknown;
  entityId?: unknown;
  entityIdNamespace?: unknown;
  fields?: unknown;
};

@Injectable()
export class AdobeRealTimeCdpApiAdapter {
  private static readonly API_ORIGIN = "https://platform.adobe.io";
  private static readonly TOKEN_URL =
    "https://ims-na1.adobelogin.com/ims/token/v3";
  private static readonly PROFILE_FIELDS = new Set([
    "identities",
    "person.name",
    "personalEmail",
    "workEmail",
  ]);
  private readonly tokens = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  async health(credentials: AdobeRealTimeCdpCredentials) {
    await this.accessToken(credentials);
    this.headers(credentials, "health");
    return { authenticated: true, sandbox: credentials.sandboxName };
  }

  read(
    credentials: AdobeRealTimeCdpCredentials,
    operationId: string,
    input: AdobeRealTimeCdpInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: AdobeRealTimeCdpCredentials,
    operation: AdobeRealTimeCdpOperation,
    input: AdobeRealTimeCdpInput,
  ) {
    this.rejectSecrets(input);
    const url = new URL(operation.path, AdobeRealTimeCdpApiAdapter.API_ORIGIN);
    if (operation.id === "list_datasets") {
      url.searchParams.set("limit", "20");
      url.searchParams.set(
        "properties",
        "name,description,schemaRef,state,created,updated,tags",
      );
    } else if (operation.id === "list_audience_definitions") {
      url.searchParams.set("start", String(this.start(input.start)));
      url.searchParams.set("limit", "20");
      url.searchParams.set("sort", "updateTime:desc");
    } else {
      url.searchParams.set("schema.name", "_xdm.context.profile");
      url.searchParams.set(
        "entityId",
        this.text(input.entityId, "entityId", 500),
      );
      url.searchParams.set(
        "entityIdNS",
        this.identifier(input.entityIdNamespace, "entityIdNamespace", 100),
      );
      url.searchParams.set("fields", this.fields(input.fields).join(","));
    }
    if (
      operation.id !== "list_audience_definitions" &&
      input.start !== undefined
    )
      throw this.validation(
        "Adobe Real-Time CDP start is accepted only for audience listing.",
      );
    if (
      operation.id !== "get_profile" &&
      (input.entityId !== undefined ||
        input.entityIdNamespace !== undefined ||
        input.fields !== undefined)
    )
      throw this.validation(
        "Adobe Real-Time CDP identity fields are accepted only for exact profile lookup.",
      );
    const token = await this.accessToken(credentials);
    try {
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          ...this.headers(credentials, token),
          Accept: "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Adobe Real-Time CDP response exceeds 1 MB.");
      const data = this.parseJson(raw);
      if (!response.ok)
        throw new AdobeRealTimeCdpApiError(
          this.safeCode(response.status),
          `Adobe Real-Time CDP returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data: this.redact(data),
        rateLimit: {
          retryAfter: response.headers.get("retry-after"),
          remaining: response.headers.get("x-ratelimit-remaining"),
        },
      };
    } catch (error) {
      if (error instanceof AdobeRealTimeCdpApiError) throw error;
      throw new AdobeRealTimeCdpApiError(
        "provider_unavailable",
        "Adobe Real-Time CDP could not be reached.",
      );
    }
  }

  private async accessToken(credentials: AdobeRealTimeCdpCredentials) {
    const clientId = credentials.clientId.trim();
    const clientSecret = credentials.clientSecret.trim();
    const scopes = credentials.scopes.trim();
    if (
      !clientId ||
      !clientSecret ||
      !/^[A-Za-z0-9._,: -]{1,2000}$/.test(scopes) ||
      clientId.length > 500 ||
      clientSecret.length > 20_000
    )
      throw new AdobeRealTimeCdpApiError(
        "credential_missing",
        "Adobe Real-Time CDP OAuth server-to-server credentials are missing.",
      );
    const key = createHash("sha256")
      .update(`${clientId}\0${clientSecret}\0${scopes}`)
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    let response: Response;
    try {
      response = await safeConnectorFetch(AdobeRealTimeCdpApiAdapter.TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
          scope: scopes,
        }).toString(),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AdobeRealTimeCdpApiError(
        "token_refresh_failed",
        "Adobe IMS token exchange failed.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 64_000)
      throw new AdobeRealTimeCdpApiError(
        "token_refresh_failed",
        "Adobe IMS returned an invalid token response.",
      );
    const data = this.parseJson(raw);
    if (Array.isArray(data))
      throw new AdobeRealTimeCdpApiError(
        "token_refresh_failed",
        "Adobe IMS returned an invalid token response.",
      );
    const token =
      typeof data.access_token === "string" ? data.access_token : "";
    const expiresIn = Number(data.expires_in);
    if (!response.ok || !token || !Number.isFinite(expiresIn) || expiresIn < 1)
      throw new AdobeRealTimeCdpApiError(
        "token_refresh_failed",
        "Adobe IMS did not return a usable access token.",
        response.status,
      );
    this.tokens.set(key, {
      token,
      expiresAt: Date.now() + Math.min(expiresIn, 86_400) * 1_000,
    });
    return token;
  }

  private headers(credentials: AdobeRealTimeCdpCredentials, token: string) {
    return {
      Authorization: `Bearer ${token}`,
      "x-api-key": this.identifier(credentials.clientId, "clientId", 500),
      "x-gw-ims-org-id": this.organizationId(credentials.organizationId),
      "x-sandbox-name": this.identifier(
        credentials.sandboxName,
        "sandboxName",
        100,
      ),
    };
  }

  private fields(value: unknown) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 4)
      throw this.validation(
        "Adobe Real-Time CDP fields must contain 1 to 4 allowlisted profile fields.",
      );
    const fields = [...new Set(value.map((field) => String(field)))];
    if (
      fields.some(
        (field) => !AdobeRealTimeCdpApiAdapter.PROFILE_FIELDS.has(field),
      )
    )
      throw this.validation(
        "Adobe Real-Time CDP profile field is not allowlisted.",
      );
    return fields;
  }

  private start(value: unknown) {
    if (value === undefined) return 0;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 0 ||
      Number(value) > 10_000
    )
      throw this.validation(
        "Adobe Real-Time CDP start must be an integer from 0 to 10000.",
      );
    return Number(value);
  }

  private text(value: unknown, label: string, maximum: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > maximum || /[\u0000-\u001f\u007f]/.test(text))
      throw this.validation(`Adobe Real-Time CDP ${label} is invalid.`);
    return text;
  }

  private identifier(value: unknown, label: string, maximum: number) {
    const text = this.text(value, label, maximum);
    if (!/^[A-Za-z0-9@._:-]+$/.test(text))
      throw this.validation(`Adobe Real-Time CDP ${label} is invalid.`);
    return text;
  }

  private organizationId(value: unknown) {
    const id = this.identifier(value, "organizationId", 200);
    if (!id.endsWith("@AdobeOrg"))
      throw this.validation(
        "Adobe Real-Time CDP organizationId must end in @AdobeOrg.",
      );
    return id;
  }

  private operation(id: string) {
    const operation = ADOBE_REAL_TIME_CDP_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new AdobeRealTimeCdpApiError(
        "tool_unavailable",
        "Adobe Real-Time CDP operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: AdobeRealTimeCdpInput) {
    for (const key of Object.keys(value))
      if (
        /(client.?id|client.?secret|scope|access.?token|authorization|cookie|url|uri|endpoint|origin|organization|sandbox)/i.test(
          key,
        )
      )
        throw new AdobeRealTimeCdpApiError(
          "policy_blocked",
          "Credential or routing Adobe Real-Time CDP input fields are blocked.",
        );
  }

  private parseJson(raw: Buffer): JsonObject | unknown[] {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object") return value;
    } catch {
      /* normalize */
    }
    throw this.validation("Adobe Real-Time CDP returned invalid JSON.");
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 200).map((entry) => this.redact(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, child]) => [
          key,
          /(client.?secret|access.?token|authorization|cookie)/i.test(key)
            ? "[REDACTED]"
            : this.redact(child),
        ]),
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new AdobeRealTimeCdpApiError("provider_validation_error", message);
  }
}

export class AdobeRealTimeCdpApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
