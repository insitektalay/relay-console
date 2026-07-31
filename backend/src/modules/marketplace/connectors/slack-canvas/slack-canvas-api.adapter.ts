import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type SlackCanvasCredentials = { accessToken: string };
export class SlackCanvasApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SlackCanvasApiAdapter {
  async health(credentials: SlackCanvasCredentials) {
    const body = await this.request(credentials, "auth.test", {});
    return {
      teamId: this.id(body.team_id, /^[TE][A-Z0-9]{2,31}$/),
      userId: this.id(body.user_id, /^[UW][A-Z0-9]{2,31}$/),
    };
  }
  async lookupSections(credentials: SlackCanvasCredentials, input: JsonObject) {
    const canvasId = this.canvasId(input.canvasId);
    const sectionTypes = this.sectionTypes(input.sectionTypes);
    const containsText = this.text(input.containsText, 200, false);
    const body = await this.request(credentials, "canvases.sections.lookup", {
      canvas_id: canvasId,
      criteria: {
        ...(sectionTypes.length ? { section_types: sectionTypes } : {}),
        ...(containsText ? { contains_text: containsText } : {}),
      },
    });
    const sectionIds = this.array(body.sections)
      .slice(0, 100)
      .map((value) => this.text(this.object(value).id, 100, true));
    return { canvasId, sectionIds, count: sectionIds.length };
  }
  draft(input: JsonObject) {
    return {
      title: this.text(input.title, 200, false),
      markdown: this.text(input.markdown, 20_000, true),
      providerSideEffect: false,
    };
  }
  async create(credentials: SlackCanvasCredentials, input: JsonObject) {
    const title = this.text(input.title, 200, false);
    const markdown = this.text(input.markdown, 20_000, true);
    const body = await this.request(credentials, "canvases.create", {
      ...(title ? { title } : {}),
      document_content: { type: "markdown", markdown },
    });
    return { canvasId: this.canvasId(body.canvas_id), title };
  }
  async append(credentials: SlackCanvasCredentials, input: JsonObject) {
    const canvasId = this.canvasId(input.canvasId);
    const position =
      input.position === "start"
        ? "insert_at_start"
        : input.position === "end"
          ? "insert_at_end"
          : null;
    if (!position)
      throw new SlackCanvasApiError(
        "provider_validation_error",
        "position must be start or end.",
      );
    const markdown = this.text(input.markdown, 20_000, true);
    await this.request(credentials, "canvases.edit", {
      canvas_id: canvasId,
      changes: [
        {
          operation: position,
          document_content: { type: "markdown", markdown },
        },
      ],
    });
    return {
      canvasId,
      position: input.position,
      appendedCharacters: markdown.length,
    };
  }
  private async request(
    credentials: SlackCanvasCredentials,
    method: string,
    json: JsonObject,
  ) {
    if (!credentials.accessToken)
      throw new SlackCanvasApiError(
        "credential_missing",
        "Slack Canvas token is required.",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(`https://slack.com/api/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(json),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new SlackCanvasApiError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Slack Canvas request timed out."
          : "Slack Canvas request failed.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new SlackCanvasApiError(
        "provider_validation_error",
        "Slack Canvas response exceeds 1 MB.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    const body = this.object(parsed);
    if (!response.ok || body.ok === false) {
      const providerError =
        this.text(body.error, 100, false) ?? "unknown_error";
      throw new SlackCanvasApiError(
        this.safeCode(response.status, providerError),
        this.safeMessage(providerError),
        response.status,
      );
    }
    return body;
  }
  private safeCode(
    status: number,
    error: string,
  ): MarketplaceConnectorSafeErrorCode {
    if (
      status === 401 ||
      /^(invalid_auth|not_authed|token_expired|token_revoked)$/.test(error)
    )
      return "credential_missing";
    if (
      status === 403 ||
      /^(missing_scope|no_permission|restricted_action|canvas_not_found|team_access_not_granted)$/.test(
        error,
      )
    )
      return "insufficient_scope";
    if (status === 429 || error === "ratelimited")
      return "provider_rate_limited";
    if (
      status >= 500 ||
      /^(internal_error|service_unavailable|fatal_error)$/.test(error)
    )
      return "provider_unavailable";
    return "provider_validation_error";
  }
  private safeMessage(error: string) {
    return (
      (
        {
          invalid_auth: "Slack Canvas authorization is invalid.",
          not_authed: "Slack Canvas authorization is missing.",
          token_expired: "Slack Canvas authorization has expired.",
          token_revoked: "Slack Canvas authorization was revoked.",
          missing_scope:
            "Slack Canvas authorization is missing canvases:read or canvases:write.",
          canvas_not_found: "The Slack canvas is unavailable to this app.",
          canvas_disabled_user_team:
            "Slack Canvas is unavailable for this workspace or plan.",
          ratelimited: "Slack rate limited the Canvas request.",
        } as Record<string, string>
      )[error] ?? "Slack rejected the Canvas request."
    );
  }
  private canvasId(value: unknown) {
    return this.id(value, /^F[A-Z0-9]{2,31}$/);
  }
  private id(value: unknown, pattern: RegExp) {
    const id = this.text(value, 64, true);
    if (!pattern.test(id))
      throw new SlackCanvasApiError(
        "provider_validation_error",
        "Slack identifier is invalid.",
      );
    return id;
  }
  private sectionTypes(value: unknown) {
    const allowed = new Set(["h1", "h2", "h3", "any_header"]);
    if (value === undefined) return [];
    if (
      !Array.isArray(value) ||
      value.length > 4 ||
      value.some((item) => typeof item !== "string" || !allowed.has(item))
    )
      throw new SlackCanvasApiError(
        "provider_validation_error",
        "sectionTypes is invalid.",
      );
    return [...new Set(value as string[])];
  }
  private text(value: unknown, maximum: number, required: boolean): string {
    const text = typeof value === "string" ? value.trim() : "";
    if (required && !text)
      throw new SlackCanvasApiError(
        "provider_validation_error",
        "Required Slack Canvas text is missing.",
      );
    if (text.length > maximum)
      throw new SlackCanvasApiError(
        "provider_validation_error",
        `Slack Canvas text must be ${maximum} characters or fewer.`,
      );
    return text;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }
}
