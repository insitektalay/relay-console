import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class GoogleMeetApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleMeetApiAdapter {
  private readonly origin = "https://meet.googleapis.com/v2";
  private readonly updateMask =
    "config.accessType,config.entryPointAccess,config.moderation,config.moderationRestrictions,config.attendanceReportGenerationType,config.artifactConfig";

  health(token: string) {
    this.token(token);
    return { appCreatedSpacesOnly: true, providerRequestCount: 0 };
  }

  async getSpace(token: string, input: JsonObject) {
    const name = this.spaceName(input.spaceName);
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/${name}`,
      {},
    );
    return { space: this.space(value), providerRequestCount: 1 };
  }

  prepareSpaceUpdate(input: JsonObject) {
    const operation =
      input.operation === "create" || input.operation === "patch"
        ? input.operation
        : null;
    if (!operation)
      throw new GoogleMeetApiError(
        "provider_validation_error",
        "operation must be create or patch.",
      );
    const configuration = this.safeBody(input);
    const change = {
      operation,
      ...(operation === "patch"
        ? { spaceName: this.spaceName(input.spaceName) }
        : {}),
      configuration,
      ...(operation === "patch" ? { updateMask: this.updateMask } : {}),
      providerMutation: false,
    };
    return {
      change,
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      providerRequestCount: 0,
    };
  }

  async createSpace(token: string, input: JsonObject) {
    const value = await this.request(
      token,
      "POST",
      `${this.origin}/spaces`,
      {},
      this.safeBody(input),
    );
    return {
      operation: "create_space",
      space: this.space(value),
      providerRequestCount: 1,
    };
  }

  async updateSpace(token: string, input: JsonObject) {
    const name = this.spaceName(input.spaceName);
    const value = await this.request(
      token,
      "PATCH",
      `${this.origin}/${name}`,
      { updateMask: this.updateMask },
      { name, ...this.safeBody(input) },
    );
    return {
      operation: "update_space",
      explicitSafetyUpdateMask: true,
      space: this.space(value),
      providerRequestCount: 1,
    };
  }

  private safeBody(input: JsonObject) {
    const accessType = this.choice(
      input.accessType,
      ["RESTRICTED", "TRUSTED"],
      "RESTRICTED",
      "accessType",
    );
    const entryPointAccess = this.choice(
      input.entryPointAccess,
      ["ALL", "CREATOR_APP_ONLY"],
      "ALL",
      "entryPointAccess",
    );
    return {
      config: {
        accessType,
        entryPointAccess,
        moderation: "ON",
        moderationRestrictions: {
          chatRestriction: "HOSTS_ONLY",
          reactionRestriction: "HOSTS_ONLY",
          presentRestriction: "HOSTS_ONLY",
          defaultJoinAsViewerType: "ON",
        },
        attendanceReportGenerationType: "DO_NOT_GENERATE",
        artifactConfig: {
          recordingConfig: { autoRecordingGeneration: "DO_NOT_GENERATE" },
          transcriptionConfig: {
            autoTranscriptionGeneration: "DO_NOT_GENERATE",
          },
          smartNotesConfig: { autoSmartNotesGeneration: "DO_NOT_GENERATE" },
        },
      },
    };
  }

  private async request(
    token: string,
    method: string,
    base: string,
    query: Record<string, string>,
    body?: JsonObject,
  ) {
    this.token(token);
    const url = new URL(base);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "meet.googleapis.com" ||
      !url.pathname.startsWith("/v2/")
    )
      throw new GoogleMeetApiError(
        "provider_validation_error",
        "Google Meet API URL is unsafe.",
      );
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new GoogleMeetApiError(
        "provider_unavailable",
        "Google Meet API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1048576)
      throw new GoogleMeetApiError(
        "provider_validation_error",
        "Google Meet response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new GoogleMeetApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Google Meet API rejected the bounded request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleMeetApiError(
        "provider_validation_error",
        "Google Meet API returned invalid JSON.",
      );
    }
  }

  private space(value: unknown) {
    const record = this.object(value);
    const config = this.object(record.config);
    const restrictions = this.object(config.moderationRestrictions);
    return {
      name: this.text(record.name, 256),
      meetingUri: this.meetingUri(record.meetingUri),
      meetingCode: this.text(record.meetingCode, 128),
      accessType: this.text(config.accessType, 32),
      entryPointAccess: this.text(config.entryPointAccess, 32),
      moderation: this.text(config.moderation, 16),
      chatRestriction: this.text(restrictions.chatRestriction, 32),
      reactionRestriction: this.text(restrictions.reactionRestriction, 32),
      presentRestriction: this.text(restrictions.presentRestriction, 32),
      defaultJoinAsViewerType: this.text(
        restrictions.defaultJoinAsViewerType,
        16,
      ),
      hasActiveConference: Boolean(record.activeConference),
      participantsReturned: false,
      conferenceRecordIdentifierReturned: false,
      artifactsReturned: false,
      phoneAccessReturned: false,
      gatewaySipAccessReturned: false,
    };
  }

  private meetingUri(value: unknown) {
    const raw = this.text(value, 256);
    if (!raw)
      throw new GoogleMeetApiError(
        "provider_validation_error",
        "Meet returned no safe meeting URI.",
      );
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new GoogleMeetApiError(
        "provider_validation_error",
        "Meet returned an invalid meeting URI.",
      );
    }
    if (url.protocol !== "https:" || url.hostname !== "meet.google.com")
      throw new GoogleMeetApiError(
        "provider_validation_error",
        "Meet returned an unsafe meeting URI.",
      );
    return raw;
  }

  private token(value: string) {
    if (!value || value.length > 8000)
      throw new GoogleMeetApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }

  private spaceName(value: unknown) {
    const name = this.text(value, 256);
    if (!name || !/^spaces\/[A-Za-z0-9_-]+$/.test(name))
      throw new GoogleMeetApiError(
        "provider_validation_error",
        "spaceName is invalid.",
      );
    return name;
  }

  private choice(
    value: unknown,
    allowed: string[],
    fallback: string,
    field: string,
  ) {
    const choice = value == null ? fallback : value;
    if (typeof choice !== "string" || !allowed.includes(choice))
      throw new GoogleMeetApiError(
        "provider_validation_error",
        `${field} is outside the safe allowlist.`,
      );
    return choice;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" && value.length <= max ? value : null;
  }
}
