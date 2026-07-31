import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  AMPLITUDE_EXPERIMENT_OPERATION_BY_ID,
  type AmplitudeExperimentOperation,
} from "./amplitude-experiment-operation-registry";

type JsonObject = Record<string, unknown>;
export type AmplitudeExperimentCredentials = {
  managementApiKey: string;
  region: string;
  projectId: string;
};
export type AmplitudeExperimentInput = { resourceId?: unknown };

@Injectable()
export class AmplitudeExperimentApiAdapter {
  private static readonly ORIGINS: Record<string, string> = {
    us: "https://experiment.amplitude.com",
    eu: "https://experiment.eu.amplitude.com",
  };

  health(credentials: AmplitudeExperimentCredentials) {
    return this.read(credentials, "list_flags", {});
  }

  read(
    credentials: AmplitudeExperimentCredentials,
    operationId: string,
    input: AmplitudeExperimentInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: AmplitudeExperimentCredentials,
    operation: AmplitudeExperimentOperation,
    input: AmplitudeExperimentInput,
  ) {
    this.rejectSecrets(input);
    let path = operation.path;
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        this.identifier(input.resourceId, "resourceId"),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "Amplitude Experiment resourceId is accepted only for exact reads.",
      );
    const apiKey = credentials.managementApiKey.trim();
    const origin =
      AmplitudeExperimentApiAdapter.ORIGINS[
        credentials.region.trim().toLowerCase()
      ];
    const projectId = this.identifier(credentials.projectId, "projectId");
    if (!apiKey || apiKey.length > 20_000 || !origin)
      throw new AmplitudeExperimentApiError(
        "credential_missing",
        "Amplitude Experiment management API key or region is missing.",
      );
    const url = new URL(path, origin);
    if (operation.collection) {
      url.searchParams.set("projectId", projectId);
      url.searchParams.set("limit", "25");
      url.searchParams.set("includeArchived", "false");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Amplitude Experiment response exceeds 1 MB.");
      const data = this.parseJson(raw);
      if (!response.ok)
        throw new AmplitudeExperimentApiError(
          this.safeCode(response.status),
          `Amplitude Experiment returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data: this.redact(data),
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof AmplitudeExperimentApiError) throw error;
      throw new AmplitudeExperimentApiError(
        "provider_unavailable",
        "Amplitude Experiment could not be reached.",
      );
    }
  }

  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9_-]{1,255}$/.test(text))
      throw this.validation(`Amplitude Experiment ${label} is invalid.`);
    return encodeURIComponent(text);
  }

  private operation(id: string) {
    const operation = AMPLITUDE_EXPERIMENT_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new AmplitudeExperimentApiError(
        "tool_unavailable",
        "Amplitude Experiment operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: AmplitudeExperimentInput) {
    for (const key of Object.keys(value))
      if (
        /(api.?key|token|authorization|cookie|url|uri|endpoint|origin|region|project)/i.test(
          key,
        )
      )
        throw new AmplitudeExperimentApiError(
          "policy_blocked",
          "Credential or routing Amplitude Experiment input fields are blocked.",
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
    throw this.validation("Amplitude Experiment returned invalid JSON.");
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 100).map((entry) => this.redact(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, child]) => [
          key,
          /(api.?key|deployment.?key|token|authorization|cookie)/i.test(key)
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
    return new AmplitudeExperimentApiError(
      "provider_validation_error",
      message,
    );
  }
}

export class AmplitudeExperimentApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
