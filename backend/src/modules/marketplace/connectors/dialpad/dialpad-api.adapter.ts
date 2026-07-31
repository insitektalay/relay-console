import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type CallerIdChoice = {
  label: string;
  type: "primary" | "user" | "office" | "group";
  phoneNumber: string;
  active: boolean;
};

export class DialpadApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DialpadApiAdapter {
  private readonly endpoint = "https://dialpad.com/api/v2/users/me/caller_id";
  private readonly maxResponseBytes = 512 * 1024;

  async getCallerIds(accessToken: string) {
    const body = this.object(await this.request(accessToken));
    const activeValue = this.text(body.caller_id, 64);
    const activeCallerIdBlocked = activeValue === "blocked";
    const activeNumber = activeCallerIdBlocked ? null : activeValue;
    const candidates: Array<{
      number: string;
      label: string;
      type: CallerIdChoice["type"];
    }> = [];

    this.pushCandidate(
      candidates,
      body.primary_phone,
      "Primary phone",
      "primary",
    );
    for (const number of this.array(body.phone_numbers))
      this.pushCandidate(candidates, number, "User phone", "user");
    this.pushCandidate(
      candidates,
      body.office_main_line,
      "Office main line",
      "office",
    );
    for (const value of this.array(body.groups)) {
      const group = this.object(value);
      this.pushCandidate(
        candidates,
        group.caller_id,
        this.text(group.display_name, 100) ?? "Group",
        "group",
      );
    }

    const seen = new Set<string>();
    const unique = candidates.filter(({ number }) => {
      if (seen.has(number)) return false;
      seen.add(number);
      return true;
    });
    const callerIds = unique.slice(0, 10).map(({ number, label, type }) => ({
      label,
      type,
      phoneNumber: this.maskPhone(number),
      active: number === activeNumber,
    }));
    if (!callerIds.length && !activeCallerIdBlocked)
      throw this.invalid("Dialpad did not return useful caller-ID choices");
    return {
      callerIds,
      count: callerIds.length,
      truncated: unique.length > 10,
      activeCallerIdBlocked,
    };
  }

  private pushCandidate(
    target: Array<{
      number: string;
      label: string;
      type: CallerIdChoice["type"];
    }>,
    value: unknown,
    label: string,
    type: CallerIdChoice["type"],
  ) {
    const number = this.text(value, 64);
    if (number) target.push({ number, label, type });
  }

  private async request(accessTokenInput: string) {
    const accessToken = accessTokenInput.trim();
    if (
      !accessToken ||
      accessToken.length > 16_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new DialpadApiError(
        "credential_missing",
        "A valid Dialpad OAuth access token is required",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(this.endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "RelayConsole-Dialpad/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new DialpadApiError(
        "provider_unavailable",
        "Dialpad could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new DialpadApiError(
        this.errorCode(response.status),
        `Dialpad returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private maskPhone(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) throw this.invalid("Dialpad returned an invalid caller ID");
    return `${value.startsWith("+") ? "+" : ""}••••${digits.slice(-4)}`;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown, maxLength: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maxLength)
      : null;
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("Dialpad response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new DialpadApiError(
        "provider_unavailable",
        "Dialpad response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("Dialpad response exceeded the allowed size");
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("Dialpad returned invalid JSON");
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
    return new DialpadApiError("provider_validation_error", message, 400);
  }
}
