import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class TeamsPhoneGraphError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class TeamsPhoneGraphAdapter {
  private readonly baseUrl = "https://graph.microsoft.com/v1.0";

  async health(accessToken: string) {
    const body = await this.request(accessToken, { $top: "1" });
    return { authorized: true, sampleCount: this.array(body.value).length };
  }

  async listAssignments(accessToken: string, input: JsonObject) {
    return this.list(accessToken, input, false);
  }

  async listUnassigned(accessToken: string, input: JsonObject) {
    return this.list(accessToken, input, true);
  }

  private async list(
    accessToken: string,
    input: JsonObject,
    unassignedOnly: boolean,
  ) {
    const limit = this.limit(input.limit);
    const numberType = this.numberType(input.numberType);
    const filters = [
      ...(unassignedOnly ? ["assignmentStatus eq 'unassigned'"] : []),
      ...(numberType ? [`numberType eq '${numberType}'`] : []),
    ];
    const body = await this.request(accessToken, {
      $top: String(limit),
      ...(filters.length ? { $filter: filters.join(" and ") } : {}),
    });
    const assignments = this.array(body.value)
      .slice(0, limit)
      .map((value) => this.shape(value));
    return {
      assignments,
      count: assignments.length,
      unassignedOnly,
      numberType: numberType ?? null,
      nextPageUsed: false,
      completeInventory: false,
    };
  }

  private shape(value: unknown) {
    const assignment = this.object(value);
    return {
      telephoneNumberMasked: this.maskNumber(assignment.telephoneNumber),
      numberType: this.enumText(assignment.numberType, [
        "directRouting",
        "callingPlan",
        "operatorConnect",
      ]),
      numberSource: this.text(assignment.numberSource, 50),
      activationState: this.text(assignment.activationState, 50),
      assignmentCategory: this.text(assignment.assignmentCategory, 50),
      assignmentStatus: this.text(assignment.assignmentStatus, 50),
      portInStatus: this.text(assignment.portInStatus, 50),
      capabilities: this.array(assignment.capabilities)
        .slice(0, 10)
        .flatMap((value) => {
          const text = this.text(value, 80);
          return text ? [text] : [];
        }),
    };
  }

  private async request(accessToken: string, query: Record<string, string>) {
    if (!accessToken)
      throw new TeamsPhoneGraphError(
        "credential_missing",
        "Teams Phone OAuth access is missing.",
        401,
      );
    const url = new URL(
      `${this.baseUrl}/admin/teams/telephoneNumberManagement/numberAssignments`,
    );
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new TeamsPhoneGraphError(
        "provider_unavailable",
        error instanceof Error && error.name === "TimeoutError"
          ? "Teams Phone request timed out."
          : "Microsoft Graph could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new TeamsPhoneGraphError(
        "provider_validation_error",
        "Teams Phone returned more than 1 MB.",
      );
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    const body = this.object(parsed);
    if (!response.ok)
      throw new TeamsPhoneGraphError(
        this.safeCode(response.status),
        this.safeMessage(response.status),
        response.status,
      );
    return body;
  }

  private numberType(value: unknown) {
    if (value == null || value === "") return null;
    if (
      typeof value !== "string" ||
      !["directRouting", "callingPlan", "operatorConnect"].includes(value)
    )
      throw new TeamsPhoneGraphError(
        "provider_validation_error",
        "Teams Phone numberType is invalid.",
      );
    return value;
  }
  private maskNumber(value: unknown) {
    const number =
      typeof value === "string" ? value.replace(/[^0-9+]/g, "") : "";
    const digits = number.replace(/\D/g, "");
    if (!digits) return null;
    return `${number.startsWith("+") ? "+" : ""}${"*".repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
  }
  private limit(value: unknown) {
    const number = Number(value ?? 25);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), 1), 25)
      : 25;
  }
  private enumText(value: unknown, allowed: string[]) {
    const text = this.text(value, 80);
    return text && allowed.includes(text) ? text : null;
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maximum)
      : null;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private safeMessage(status: number) {
    if (status === 401)
      return "Teams Phone authorization is invalid or expired.";
    if (status === 403)
      return "Teams Phone requires admin-consented TeamsTelephoneNumber.Read.All and an authorized tenant role.";
    if (status === 429)
      return "Microsoft Graph rate limited the Teams Phone request.";
    if (status >= 500) return "Microsoft Graph is temporarily unavailable.";
    return "Microsoft Graph rejected the Teams Phone request.";
  }
}
