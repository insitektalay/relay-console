import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type SimplyBookMeCredentials = {
  companyLogin: string;
  apiKey: string;
  userLogin?: string;
  userApiKey?: string;
};
const PUBLIC_MANAGE = new Set([
  "book",
  "cancelBooking",
  "confirmBooking",
  "confirmBookingBatch",
  "confirmBookingBatchPayment",
  "confirmBookingCart",
  "createBatch",
  "validatePayment",
]);
const PUBLIC_READ = new Set([
  "calculateEndTime",
  "filterAvailableUnits",
  "getAdditionalFields",
  "getAnyUnitData",
  "getAvailableTimeIntervals",
  "getAvailableUnits",
  "getBooking",
  "getBookingCart",
  "getBookingDetails",
  "getCategoriesList",
  "getCompanyInfo",
  "getCompanyParam",
  "getCompanyParams",
  "getCompanyTimezoneOffset",
  "getCountryPhoneCodes",
  "getEventList",
  "getFirstWorkingDay",
  "getLocationsList",
  "getPaymentProcessorConfig",
  "getPluginStatuses",
  "getPromocodeInfo",
  "getRecurringDatetimes",
  "getReservedTime",
  "getReservedTimeIntervals",
  "getStartTimeMatrix",
  "getTimeframe",
  "getTimelineType",
  "getUnitList",
  "getUserLicenseText",
  "getWorkCalendar",
  "getWorkDaysInfo",
  "hasUpcommingPromotions",
  "isPaymentRequired",
  "isPluginActivated",
  "validatePromoCode",
]);
const ADMIN_MANAGE = new Set([
  "addClient",
  "addDeviceToken",
  "book",
  "cancelBatch",
  "cancelBooking",
  "createBatch",
  "deleteDeviceToken",
  "editBook",
  "editClient",
  "pluginApproveBookingApprove",
  "pluginApproveBookingCancel",
  "setBookingComment",
  "setStatus",
  "updateNotification",
  "setWorkDayInfo",
  "deleteSpecialDay",
  "addServiceProvider",
  "editServiceProvider",
]);
const ADMIN_READ = new Set([
  "calculateEndTime",
  "filterAvailableUnits",
  "getAdditionalFields",
  "getAnyUnitData",
  "getAvailableTimeIntervals",
  "getAvailableUnits",
  "getBookingCancellationsInfo",
  "getBookingComment",
  "getBookingDetails",
  "getBookingLimitUnavailableTimeInterval",
  "getBookingRevenue",
  "getBookingStats",
  "getBookings",
  "getBookingsZapier",
  "getCategoriesList",
  "getClient",
  "getClientComments",
  "getClientList",
  "getCompanyCurrency",
  "getCompanyInfo",
  "getCompanyParam",
  "getCompanyParams",
  "getCompanyTimezoneOffset",
  "getCountryList",
  "getCountryPhoneCodes",
  "getCurrentTariffInfo",
  "getCurrentUserDetails",
  "getEventList",
  "getFeedbacks",
  "getFirstWorkingDay",
  "getGoogleCalendarBusyTime",
  "getGoogleCalendarBusyTimeAvailableUnits",
  "getLastNotificationUpdate",
  "getLocationsList",
  "getPluginList",
  "getPluginStatuses",
  "getRecentActions",
  "getRecurringDatetimes",
  "getRecurringSettings",
  "getRegistrations",
  "getReservedTime",
  "getReservedTimeIntervals",
  "getSocialCounterStats",
  "getStartTimeMatrix",
  "getStatuses",
  "getTimeframe",
  "getTimelineType",
  "getTopPerformers",
  "getTopServices",
  "getUnitList",
  "getUnitWorkdayInfo",
  "getUnitWorkingDurations",
  "getVisitorStats",
  "getWarnings",
  "getWorkCalendar",
  "getWorkDaysInfo",
  "getWorkDaysTimes",
  "getWorkload",
  "isPluginActivated",
  "pluginApproveGetPendingBookings",
  "pluginApproveGetPendingBookingsCount",
  "getBookingStatus",
]);

export class SimplyBookMeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SimplyBookMeApiAdapter {
  async health(credentials: SimplyBookMeCredentials) {
    const token = await this.publicToken(credentials);
    const company = await this.rpc(
      "https://user-api.simplybook.me/",
      token,
      credentials.companyLogin,
      "getCompanyInfo",
      [],
    );
    if (credentials.userLogin || credentials.userApiKey) {
      const adminToken = await this.adminToken(credentials);
      await this.rpc(
        "https://user-api.simplybook.me/admin",
        adminToken,
        undefined,
        "getCurrentUserDetails",
        [],
      );
    }
    return { accountVerified: true, company };
  }
  async publicRead(credentials: SimplyBookMeCredentials, input: JsonObject) {
    return this.call(credentials, input, "public", "read");
  }
  async publicManage(credentials: SimplyBookMeCredentials, input: JsonObject) {
    return this.call(credentials, input, "public", "manage");
  }
  async adminRead(credentials: SimplyBookMeCredentials, input: JsonObject) {
    return this.call(credentials, input, "admin", "read");
  }
  async adminManage(credentials: SimplyBookMeCredentials, input: JsonObject) {
    return this.call(credentials, input, "admin", "manage");
  }
  private async call(
    credentials: SimplyBookMeCredentials,
    input: JsonObject,
    surface: "public" | "admin",
    action: "read" | "manage",
  ) {
    const method = this.required(input.method, "method", 100);
    const allowed =
      surface === "public"
        ? action === "read"
          ? PUBLIC_READ
          : PUBLIC_MANAGE
        : action === "read"
          ? ADMIN_READ
          : ADMIN_MANAGE;
    if (!allowed.has(method))
      throw this.validation(
        `SimplyBook.me ${surface} ${action} method is not supported.`,
      );
    const params = input.params === undefined ? [] : input.params;
    if (!Array.isArray(params) || params.length > 50)
      throw this.validation(
        "SimplyBook.me params must be an array of at most 50 items.",
      );
    this.rejectSecrets(params);
    const token =
      surface === "public"
        ? await this.publicToken(credentials)
        : await this.adminToken(credentials);
    return this.rpc(
      surface === "public"
        ? "https://user-api.simplybook.me/"
        : "https://user-api.simplybook.me/admin",
      token,
      surface === "public" ? credentials.companyLogin : undefined,
      method,
      params,
    );
  }
  private async publicToken(credentials: SimplyBookMeCredentials) {
    const companyLogin = this.credential(
      credentials.companyLogin,
      "company login",
      500,
    );
    const apiKey = this.credential(credentials.apiKey, "API key", 10_000);
    return this.login("getToken", [companyLogin, apiKey]);
  }
  private async adminToken(credentials: SimplyBookMeCredentials) {
    const companyLogin = this.credential(
      credentials.companyLogin,
      "company login",
      500,
    );
    const userLogin = this.credential(
      credentials.userLogin,
      "administration user login",
      500,
    );
    const userApiKey = this.credential(
      credentials.userApiKey,
      "administration API User Key",
      10_000,
    );
    return this.login("getUserToken", [companyLogin, userLogin, userApiKey]);
  }
  private async login(method: "getToken" | "getUserToken", params: string[]) {
    const value = await this.rpc(
      "https://user-api.simplybook.me/login",
      undefined,
      undefined,
      method,
      params,
    );
    if (typeof value !== "string" || !value.trim() || value.length > 20_000)
      throw new SimplyBookMeApiError(
        "token_expired",
        "SimplyBook.me did not return a valid access token.",
        401,
      );
    return value;
  }
  private async rpc(
    url: string,
    token: string | undefined,
    companyLogin: string | undefined,
    method: string,
    params: unknown[],
  ) {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (token) headers["X-Token"] = token;
    if (companyLogin) headers["X-Company-Login"] = companyLogin;
    const body = JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 });
    if (Buffer.byteLength(body) > 2_000_000)
      throw this.validation("SimplyBook.me request exceeds 2 MB.");
    try {
      const response = await safeConnectorFetch(url, {
        method: "POST",
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000)
        throw this.validation("SimplyBook.me response exceeds 5 MB.");
      const text = raw.toString("utf8");
      let payload: JsonObject;
      try {
        payload = text ? (JSON.parse(text) as JsonObject) : {};
      } catch {
        throw new SimplyBookMeApiError(
          "provider_validation_error",
          "SimplyBook.me returned invalid JSON.",
          response.status,
        );
      }
      if (!response.ok)
        throw new SimplyBookMeApiError(
          this.code(response.status),
          this.message(payload) ??
            `SimplyBook.me returned HTTP ${response.status}.`,
          response.status,
        );
      if (payload.error)
        throw new SimplyBookMeApiError(
          this.rpcCode(payload.error),
          this.message(payload.error) ?? "SimplyBook.me rejected the request.",
        );
      return this.redact(payload.result);
    } catch (error) {
      if (error instanceof SimplyBookMeApiError) throw error;
      throw new SimplyBookMeApiError(
        "provider_unavailable",
        "SimplyBook.me could not be reached.",
        502,
      );
    }
  }
  private rejectSecrets(value: unknown, depth = 0) {
    if (depth > 12)
      throw new SimplyBookMeApiError(
        "policy_blocked",
        "SimplyBook.me parameters are too deeply nested.",
      );
    if (Array.isArray(value)) {
      if (value.length > 1000)
        throw new SimplyBookMeApiError(
          "policy_blocked",
          "SimplyBook.me parameter array is too large.",
        );
      value.forEach((child) => this.rejectSecrets(child, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 1000)
      throw new SimplyBookMeApiError(
        "policy_blocked",
        "SimplyBook.me parameter object is too large.",
      );
    for (const [key, child] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new SimplyBookMeApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
        );
      this.rejectSecrets(child, depth + 1);
    }
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }
  private message(value: unknown) {
    if (typeof value === "string") return value.slice(0, 500);
    const object =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const candidate = object?.message ?? object?.error;
    return typeof candidate === "string"
      ? candidate.slice(0, 500)
      : candidate && typeof candidate === "object"
        ? this.message(candidate)
        : null;
  }
  private rpcCode(error: unknown): MarketplaceConnectorSafeErrorCode {
    const code =
      error && typeof error === "object"
        ? Number((error as JsonObject).code)
        : 0;
    if ([-33002, -33003, -33004, -33005, -32600].includes(code))
      return "token_expired";
    return "provider_validation_error";
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new SimplyBookMeApiError("provider_validation_error", message);
  }
  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is required.`);
    return value.trim();
  }
  private credential(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new SimplyBookMeApiError(
        "credential_missing",
        `SimplyBook.me ${name} is required.`,
        401,
      );
    return value.trim();
  }
}
