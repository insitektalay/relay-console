import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  REPLICON_OPERATION_BY_ID,
  type RepliconOperation,
} from "./replicon-operation-registry";

type JsonObject = Record<string, unknown>;
export type RepliconCredentials = {
  companyKey: string;
  accessToken: string;
};
export type RepliconOperationInput = { json?: JsonObject };

export class RepliconApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class RepliconApiAdapter {
  private static readonly DISCOVERY_URL =
    "https://global.replicon.com/DiscoveryService1.svc/GetTenantEndpointDetails";
  private static readonly APPLICATION = "RelayConsole_Marketplace_1.0";

  async health(credentials: RepliconCredentials) {
    return this.directRequest(
      credentials,
      "/UserAccessControlService1.svc/GetMyIdentity",
      {},
    );
  }

  read(
    credentials: RepliconCredentials,
    operationId: string,
    input: RepliconOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (!operation.readOnly)
      throw this.invalid("Replicon read accepts read-only operations only.");
    return this.request(credentials, operation, input);
  }

  manage(
    credentials: RepliconCredentials,
    operationId: string,
    input: RepliconOperationInput,
  ) {
    const operation = this.operation(operationId);
    if (operation.readOnly)
      throw this.invalid("Replicon manage accepts mutation operations only.");
    return this.request(credentials, operation, input);
  }

  private async request(
    credentials: RepliconCredentials,
    operation: RepliconOperation,
    input: RepliconOperationInput,
  ) {
    this.requireCredentials(credentials);
    this.rejectCredentialFields(input);
    if (
      !operation.path.startsWith("/") ||
      operation.path.includes("..") ||
      operation.path.includes("://")
    )
      throw new RepliconApiError(
        "policy_blocked",
        "Replicon path escaped the pinned services route.",
        403,
      );
    const json = input.json ?? {};
    const body = JSON.stringify(json);
    if (Buffer.byteLength(body) > 2_000_000)
      throw this.invalid("Replicon request exceeds the 2 MB Relay limit.");
    return this.directRequest(credentials, operation.path, json);
  }

  private async directRequest(
    credentials: RepliconCredentials,
    path: string,
    json: JsonObject,
  ) {
    this.requireCredentials(credentials);
    const root = await this.discover(credentials.companyKey);
    const companyKey = encodeURIComponent(credentials.companyKey);
    const url = new URL(
      `${companyKey}/services${path}`,
      root.href.endsWith("/") ? root : new URL(`${root.href}/`),
    );
    if (
      url.protocol !== "https:" ||
      !this.isRepliconHost(url.hostname) ||
      url.port ||
      !url.pathname.startsWith(`/${companyKey}/services/`) ||
      url.username ||
      url.password
    )
      throw new RepliconApiError(
        "policy_blocked",
        "Replicon requests must stay on the discovered HTTPS tenant services route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Replicon-Application": RepliconApiAdapter.APPLICATION,
        },
        body: JSON.stringify(json),
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof RepliconApiError) throw error;
      throw new RepliconApiError(
        "provider_unavailable",
        "Replicon could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Replicon response exceeds the 2.5 MB Relay limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new RepliconApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Replicon returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private async discover(companyKey: string) {
    let response: Response;
    try {
      response = await safeConnectorFetch(RepliconApiAdapter.DISCOVERY_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json; charset=UTF-8",
          "X-Replicon-Application": RepliconApiAdapter.APPLICATION,
        },
        body: JSON.stringify({ tenant: { companyKey } }),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch {
      throw new RepliconApiError(
        "provider_unavailable",
        "Replicon tenant discovery could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    const data = this.parse(raw);
    if (!response.ok)
      throw new RepliconApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Replicon tenant discovery returned HTTP ${response.status}.`,
        response.status,
      );
    const applicationRootUrl = this.applicationRoot(data);
    let root: URL;
    try {
      root = new URL(applicationRootUrl);
    } catch {
      throw new RepliconApiError(
        "provider_unavailable",
        "Replicon returned an invalid tenant endpoint.",
        502,
      );
    }
    if (
      root.protocol !== "https:" ||
      !this.isRepliconHost(root.hostname) ||
      root.port ||
      root.username ||
      root.password ||
      !/^\/$/.test(root.pathname)
    )
      throw new RepliconApiError(
        "policy_blocked",
        "Replicon tenant discovery returned an endpoint outside replicon.com.",
        403,
      );
    return root;
  }

  private applicationRoot(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new RepliconApiError(
        "provider_unavailable",
        "Replicon tenant discovery returned no endpoint.",
        502,
      );
    const body = value as JsonObject;
    const data =
      body.d && typeof body.d === "object" && !Array.isArray(body.d)
        ? (body.d as JsonObject)
        : body;
    if (typeof data.applicationRootUrl !== "string")
      throw new RepliconApiError(
        "provider_unavailable",
        "Replicon tenant discovery returned no endpoint.",
        502,
      );
    return data.applicationRootUrl;
  }

  private isRepliconHost(hostname: string) {
    return hostname === "replicon.com" || hostname.endsWith(".replicon.com");
  }

  private operation(id: string) {
    const operation = REPLICON_OPERATION_BY_ID.get(id);
    if (!operation)
      throw this.invalid(
        "Replicon operation is not in the pinned official public API contract.",
      );
    return operation;
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 12)
      throw new RepliconApiError(
        "policy_blocked",
        "Replicon request is too deeply nested.",
        403,
      );
    if (Array.isArray(value)) {
      if (value.length > 2_000)
        throw this.invalid("Replicon request contains too many array items.");
      return value.forEach((item) =>
        this.rejectCredentialFields(item, depth + 1),
      );
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 2_000)
      throw this.invalid("Replicon request contains too many fields.");
    for (const [key, item] of entries) {
      if (
        /^(?:access.?token|refresh.?token|authorization|password|secret|cookie|credential|api.?key|signed.?url)$/i.test(
          key,
        )
      )
        throw new RepliconApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private requireCredentials(credentials: RepliconCredentials) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(credentials.companyKey ?? ""))
      throw new RepliconApiError(
        "credential_missing",
        "A valid Replicon company key is required.",
        401,
      );
    if (
      !credentials.accessToken ||
      credentials.accessToken.length < 16 ||
      credentials.accessToken.length > 16_000 ||
      /[\r\n]/.test(credentials.accessToken)
    )
      throw new RepliconApiError(
        "credential_missing",
        "A valid customer-owned Replicon access token is required.",
        401,
      );
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
      return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /^(?:access.?token|refresh.?token|authorization|password|secret|cookie|credential|api.?key|signed.?url)$/i.test(
            key,
          )
            ? "[REDACTED]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if ([402, 403, 499].includes(status)) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const body = value as JsonObject;
    const nested =
      body.error && typeof body.error === "object" && !Array.isArray(body.error)
        ? (body.error as JsonObject)
        : null;
    const candidate =
      nested?.reason ??
      nested?.message ??
      body.error ??
      body.message ??
      body.reason;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new RepliconApiError("provider_validation_error", message, 400);
  }
}
