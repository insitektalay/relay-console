import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import { MIXPANEL_COHORTS_OPERATION_BY_ID } from "./mixpanel-cohorts-operation-registry";

type JsonObject = Record<string, unknown>;
export type MixpanelCohortsCredentials = {
  serviceAccountUsername: string;
  serviceAccountSecret: string;
  region: string;
  projectId: string;
  workspaceId: string;
};

@Injectable()
export class MixpanelCohortsApiAdapter {
  private static readonly ORIGINS: Record<string, string> = {
    us: "https://mixpanel.com",
    eu: "https://eu.mixpanel.com",
    in: "https://in.mixpanel.com",
  };

  health(credentials: MixpanelCohortsCredentials) {
    return this.read(credentials, "list_saved_cohorts", {});
  }

  async read(
    credentials: MixpanelCohortsCredentials,
    operationId: string,
    input: Record<string, unknown>,
  ) {
    this.rejectInput(input);
    const operation = MIXPANEL_COHORTS_OPERATION_BY_ID.get(operationId);
    if (!operation)
      throw new MixpanelCohortsApiError(
        "tool_unavailable",
        "Mixpanel Cohorts operation is not pinned.",
      );
    const username = this.credential(
      credentials.serviceAccountUsername,
      "service account username",
      500,
    );
    const secret = this.credential(
      credentials.serviceAccountSecret,
      "service account secret",
      20_000,
    );
    const origin =
      MixpanelCohortsApiAdapter.ORIGINS[
        credentials.region.trim().toLowerCase()
      ];
    if (!origin)
      throw new MixpanelCohortsApiError(
        "credential_missing",
        "Mixpanel Cohorts region is missing.",
      );
    const url = new URL(operation.path, origin);
    url.searchParams.set(
      "project_id",
      this.positiveInteger(credentials.projectId, "projectId"),
    );
    url.searchParams.set(
      "workspace_id",
      this.positiveInteger(credentials.workspaceId, "workspaceId"),
    );
    try {
      const response = await safeConnectorFetch(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${username}:${secret}`).toString("base64")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Mixpanel Cohorts response exceeds 1 MB.");
      const data = this.parseJson(raw);
      if (!response.ok)
        throw new MixpanelCohortsApiError(
          this.safeCode(response.status),
          `Mixpanel Cohorts returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data: this.redact(data),
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof MixpanelCohortsApiError) throw error;
      throw new MixpanelCohortsApiError(
        "provider_unavailable",
        "Mixpanel Cohorts could not be reached.",
      );
    }
  }

  private rejectInput(input: Record<string, unknown>) {
    if (Object.keys(input).length)
      throw new MixpanelCohortsApiError(
        "policy_blocked",
        "Mixpanel Cohorts accepts no agent-controlled query or routing input.",
      );
  }

  private credential(value: string, label: string, maximum: number) {
    const text = value.trim();
    if (!text || text.length > maximum || /[\u0000\r\n]/.test(text))
      throw new MixpanelCohortsApiError(
        "credential_missing",
        `Mixpanel Cohorts ${label} is missing.`,
      );
    return text;
  }

  private positiveInteger(value: string, label: string) {
    const text = value.trim();
    if (!/^\d{1,18}$/.test(text) || Number(text) < 1)
      throw this.validation(
        `Mixpanel Cohorts ${label} must be a positive integer.`,
      );
    return text;
  }

  private parseJson(raw: Buffer): JsonObject | unknown[] {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object") return value;
    } catch {
      /* normalize */
    }
    throw this.validation("Mixpanel Cohorts returned invalid JSON.");
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
          /(secret|token|authorization|cookie)/i.test(key)
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
    return new MixpanelCohortsApiError("provider_validation_error", message);
  }
}

export class MixpanelCohortsApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
