import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type MessageBirdCredentials = {
  organizationId: string;
  workspaceId: string;
  accessKey: string;
};

export class MessageBirdApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MessageBirdApiAdapter {
  private readonly origin = "https://api.bird.com";
  private readonly maxResponseBytes = 64 * 1024;
  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: MessageBirdCredentials) {
    await this.readWorkspace(credentials);
    return { apiOrigin: this.origin, accessKeyValidated: true };
  }

  async getWorkspaceStatus(credentials: MessageBirdCredentials) {
    return this.readWorkspace(credentials);
  }

  private async readWorkspace(credentials: MessageBirdCredentials) {
    const organizationId = this.uuid(
      credentials.organizationId,
      "organization ID",
    );
    const workspaceId = this.uuid(credentials.workspaceId, "workspace ID");
    const accessKey = credentials.accessKey.trim();
    if (
      accessKey.length < 16 ||
      accessKey.length > 512 ||
      /[\s\u0000-\u001f\u007f]/.test(accessKey)
    )
      throw new MessageBirdApiError(
        "credential_missing",
        "A valid dedicated Bird access key is required",
        401,
      );
    const endpoint = `${this.origin}/organizations/${organizationId}/workspaces/${workspaceId}`;
    let response: Response;
    try {
      response = await this.requester(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `AccessKey ${accessKey}`,
          "User-Agent": "RelayConsole-Bird/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new MessageBirdApiError(
        "provider_unavailable",
        "Bird could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new MessageBirdApiError(
        this.errorCode(response.status),
        `Bird returned HTTP ${response.status}`,
        response.status,
      );
    const record = this.object(body);
    if (
      record.id !== workspaceId ||
      record.organizationId !== organizationId ||
      !["active", "disabled", "terminated", "deleted"].includes(
        String(record.status),
      )
    )
      throw this.invalid("Bird returned invalid workspace metadata");
    return { workspaceStatus: String(record.status) };
  }

  private uuid(value: string, label: string) {
    const normalized = value.trim().toLowerCase();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        normalized,
      )
    )
      throw new MessageBirdApiError(
        "credential_missing",
        `A valid Bird ${label} is required`,
        401,
      );
    return normalized;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Bird response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new MessageBirdApiError(
        "provider_unavailable",
        "Bird response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Bird response exceeded the allowed size");
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Bird returned invalid JSON");
      return {};
    }
  }
  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new MessageBirdApiError("provider_validation_error", message, 400);
  }
}
