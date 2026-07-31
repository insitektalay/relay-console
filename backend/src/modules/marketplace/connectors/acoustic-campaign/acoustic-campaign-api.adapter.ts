import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  ACOUSTIC_CAMPAIGN_OPERATION_BY_ID,
  type AcousticCampaignOperation,
} from "./acoustic-campaign-operation-registry";

type JsonObject = Record<string, unknown>;
export type AcousticCampaignCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  pod: string;
};
export type AcousticCampaignInput = {
  programId?: unknown;
  databaseId?: unknown;
  contactId?: unknown;
  fields?: JsonObject;
  consentAttestation?: boolean;
};

@Injectable()
export class AcousticCampaignApiAdapter {
  private static readonly POD_ORIGINS: Record<string, string> = {
    "1": "https://api-campaign-us-1.goacoustic.com",
    "2": "https://api-campaign-us-2.goacoustic.com",
    "3": "https://api-campaign-us-3.goacoustic.com",
    "4": "https://api-campaign-us-4.goacoustic.com",
    "5": "https://api-campaign-us-5.goacoustic.com",
    "6": "https://api-campaign-eu-1.goacoustic.com",
    "7": "https://api-campaign-ap-2.goacoustic.com",
    "8": "https://api-campaign-ca-1.goacoustic.com",
    "9": "https://api-campaign-us-6.goacoustic.com",
    B: "https://api-campaign-ap-3.goacoustic.com",
  };
  private readonly tokens = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  async health(credentials: AcousticCampaignCredentials) {
    await this.accessToken(credentials);
    return { authenticated: true, pod: credentials.pod.toUpperCase() };
  }

  read(
    credentials: AcousticCampaignCredentials,
    operationId: string,
    input: AcousticCampaignInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy === "manage")
      throw this.validation(
        "Acoustic Campaign read accepts read operations only.",
      );
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: AcousticCampaignCredentials,
    operationId: string,
    input: AcousticCampaignInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.policy !== "manage")
      throw this.validation(
        "Acoustic Campaign manage accepts one-contact updates only.",
      );
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: AcousticCampaignCredentials,
    operation: AcousticCampaignOperation,
    input: AcousticCampaignInput,
  ) {
    this.rejectSecrets(input);
    let path = operation.path;
    for (const key of ["programId", "databaseId", "contactId"] as const)
      if (path.includes(`{${key}}`))
        path = path.replace(`{${key}}`, this.positiveInteger(input[key], key));
    let body: string | undefined;
    if (operation.policy === "manage") {
      if (input.consentAttestation !== true)
        throw new AcousticCampaignApiError(
          "policy_blocked",
          "Acoustic Campaign contact updates require explicit recorded contact authorization.",
        );
      body = JSON.stringify({ fields: this.fields(input.fields) });
    } else if (input.fields !== undefined) {
      throw this.validation("Acoustic Campaign reads do not accept fields.");
    }
    const token = await this.accessToken(credentials);
    const url = new URL(path, this.origin(credentials.pod));
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(
          operation.policy === "manage" ? 30_000 : 20_000,
        ),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Acoustic Campaign response exceeds 1 MB.");
      const data = this.parseJson(raw);
      if (!response.ok)
        throw new AcousticCampaignApiError(
          this.safeCode(response.status),
          `Acoustic Campaign returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data: this.redact(data),
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof AcousticCampaignApiError) throw error;
      throw new AcousticCampaignApiError(
        "provider_unavailable",
        "Acoustic Campaign could not be reached.",
      );
    }
  }

  private async accessToken(credentials: AcousticCampaignCredentials) {
    const origin = this.origin(credentials.pod);
    const clientId = credentials.clientId.trim();
    const clientSecret = credentials.clientSecret.trim();
    const refreshToken = credentials.refreshToken.trim();
    if (
      !clientId ||
      !clientSecret ||
      !refreshToken ||
      clientId.length > 500 ||
      clientSecret.length > 20_000 ||
      refreshToken.length > 20_000
    )
      throw new AcousticCampaignApiError(
        "credential_missing",
        "Acoustic Campaign OAuth credentials are missing.",
      );
    const key = createHash("sha256")
      .update(`${origin}\0${clientId}\0${clientSecret}\0${refreshToken}`)
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    let response: Response;
    try {
      response = await safeConnectorFetch(`${origin}/oauth/token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }).toString(),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AcousticCampaignApiError(
        "token_refresh_failed",
        "Acoustic Campaign token exchange failed.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 64_000)
      throw new AcousticCampaignApiError(
        "token_refresh_failed",
        "Acoustic Campaign token response is invalid.",
      );
    const data = this.parseJson(raw);
    if (Array.isArray(data))
      throw new AcousticCampaignApiError(
        "token_refresh_failed",
        "Acoustic Campaign token response is invalid.",
      );
    const token =
      typeof data.access_token === "string" ? data.access_token : "";
    const expiresIn = Number(data.expires_in);
    if (!response.ok || !token || !Number.isFinite(expiresIn) || expiresIn < 1)
      throw new AcousticCampaignApiError(
        "token_refresh_failed",
        "Acoustic Campaign did not return a usable access token.",
        response.status,
      );
    this.tokens.set(key, {
      token,
      expiresAt: Date.now() + Math.min(expiresIn, 10_800) * 1_000,
    });
    return token;
  }

  private origin(value: string) {
    const origin =
      AcousticCampaignApiAdapter.POD_ORIGINS[value.trim().toUpperCase()];
    if (!origin)
      throw this.validation("Acoustic Campaign pod must be one of 1-9 or B.");
    return origin;
  }
  private fields(value: JsonObject | undefined) {
    if (
      !value ||
      Array.isArray(value) ||
      Object.keys(value).length < 1 ||
      Object.keys(value).length > 20
    )
      throw this.validation(
        "Acoustic Campaign fields must contain 1 to 20 entries.",
      );
    const output: JsonObject = {};
    for (const [name, raw] of Object.entries(value)) {
      if (!/^[A-Za-z0-9 _-]{1,100}$/.test(name))
        throw this.validation("Acoustic Campaign field name is invalid.");
      if (
        /(consent|opt.?in|opt.?out|status|suppression|unsubscribe)/i.test(name)
      )
        throw new AcousticCampaignApiError(
          "policy_blocked",
          "Acoustic Campaign consent and subscription fields are blocked.",
        );
      if (
        !["string", "number", "boolean"].includes(typeof raw) ||
        String(raw).length > 4_000 ||
        /[\u0000]/.test(String(raw))
      )
        throw this.validation(`Acoustic Campaign ${name} value is invalid.`);
      output[name] = raw;
    }
    return output;
  }
  private positiveInteger(value: unknown, label: string) {
    const text =
      typeof value === "number" ? String(value) : String(value ?? "").trim();
    if (!/^\d{1,18}$/.test(text) || Number(text) < 1)
      throw this.validation(
        `Acoustic Campaign ${label} must be a positive integer.`,
      );
    return text;
  }
  private operation(id: string) {
    const operation = ACOUSTIC_CAMPAIGN_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new AcousticCampaignApiError(
        "tool_unavailable",
        "Acoustic Campaign operation is not pinned.",
      );
    return operation;
  }
  private rejectSecrets(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value as JsonObject))
      if (
        /(client.?id|client.?secret|refresh.?token|access.?token|authorization|cookie|url|uri|endpoint|pod)/i.test(
          key,
        )
      )
        throw new AcousticCampaignApiError(
          "policy_blocked",
          "Credential or routing Acoustic Campaign input fields are blocked.",
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
    throw this.validation("Acoustic Campaign returned invalid JSON.");
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
          /(client.?secret|refresh.?token|access.?token|authorization|cookie)/i.test(
            key,
          )
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
    return new AcousticCampaignApiError("provider_validation_error", message);
  }
}

export class AcousticCampaignApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
