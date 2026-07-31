import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type MindbodyCredentials = {
  apiKey: string;
  siteId: string;
  staffToken: string;
};

const READ_ROUTES = new Set([
  "GET /public/v6/appointment/activesessiontimes",
  "GET /public/v6/appointment/addons",
  "GET /public/v6/appointment/appointmentoptions",
  "GET /public/v6/appointment/availabledates",
  "GET /public/v6/appointment/bookableitems",
  "GET /public/v6/appointment/scheduleitems",
  "GET /public/v6/appointment/staffappointments",
  "GET /public/v6/appointment/unavailabilities",
  "GET /public/v6/class/classdescriptions",
  "GET /public/v6/class/classes",
  "GET /public/v6/class/classschedules",
  "GET /public/v6/class/classvisits",
  "GET /public/v6/class/courses",
  "GET /public/v6/class/semesters",
  "GET /public/v6/class/waitlistentries",
  "GET /public/v6/client/activeclientmemberships",
  "GET /public/v6/client/activeclientsmemberships",
  "GET /public/v6/client/clientaccountbalances",
  "GET /public/v6/client/clientcompleteinfo",
  "GET /public/v6/client/clientcontracts",
  "GET /public/v6/client/clientdirectdebitinfo",
  "GET /public/v6/client/clientduplicates",
  "GET /public/v6/client/clientformulanotes",
  "GET /public/v6/client/clientindexes",
  "GET /public/v6/client/clientpurchases",
  "GET /public/v6/client/clientreferraltypes",
  "GET /public/v6/client/clientrewards",
  "GET /public/v6/client/clients",
  "GET /public/v6/client/clientschedule",
  "GET /public/v6/client/clientservices",
  "GET /public/v6/client/clientvisits",
  "GET /public/v6/client/contactlogs",
  "GET /public/v6/client/contactlogtypes",
  "GET /public/v6/client/crossregionalclientassociations",
  "GET /public/v6/client/customclientfields",
  "GET /public/v6/client/requiredclientfields",
  "GET /public/v6/enrollment/enrollments",
  "GET /public/v6/payroll/commissions",
  "GET /public/v6/payroll/scheduledserviceearnings",
  "GET /public/v6/payroll/timecards",
  "GET /public/v6/payroll/tips",
  "GET /public/v6/pickaspot/v1/class",
  "GET /public/v6/sale/acceptedcardtypes",
  "GET /public/v6/sale/alternativepaymentmethods",
  "GET /public/v6/sale/contracts",
  "GET /public/v6/sale/custompaymentmethods",
  "GET /public/v6/sale/giftcardbalance",
  "GET /public/v6/sale/giftcards",
  "GET /public/v6/sale/packages",
  "GET /public/v6/sale/products",
  "GET /public/v6/sale/productsinventory",
  "GET /public/v6/sale/purchasecontractstatus",
  "GET /public/v6/sale/sales",
  "GET /public/v6/sale/services",
  "GET /public/v6/sale/transactions",
  "GET /public/v6/site/activationcode",
  "GET /public/v6/site/categories",
  "GET /public/v6/site/genders",
  "GET /public/v6/site/liabilitywaiver",
  "GET /public/v6/site/locations",
  "GET /public/v6/site/memberships",
  "GET /public/v6/site/mobileproviders",
  "GET /public/v6/site/paymenttypes",
  "GET /public/v6/site/programs",
  "GET /public/v6/site/promocodes",
  "GET /public/v6/site/prospectstages",
  "GET /public/v6/site/relationships",
  "GET /public/v6/site/resourceavailabilities",
  "GET /public/v6/site/resources",
  "GET /public/v6/site/sessiontypes",
  "GET /public/v6/site/sites",
  "GET /public/v6/staff/imageurl",
  "GET /public/v6/staff/salesreps",
  "GET /public/v6/staff/sessiontypes",
  "GET /public/v6/staff/staff",
  "GET /public/v6/staff/staffpermissions",
]);
const MANAGE_ROUTES = new Set([
  "DELETE /public/v6/appointment/appointmentfromwaitlist",
  "DELETE /public/v6/appointment/availability",
  "DELETE /public/v6/appointment/deleteappointmentaddon",
  "DELETE /public/v6/client/clientdirectdebitinfo",
  "DELETE /public/v6/client/clientformulanote",
  "DELETE /public/v6/client/deletecontactlog",
  "POST /public/v6/appointment/addappointment",
  "POST /public/v6/appointment/addappointmentaddon",
  "POST /public/v6/appointment/addmultipleappointments",
  "POST /public/v6/appointment/availabilities",
  "POST /public/v6/appointment/updateappointment",
  "POST /public/v6/class/addclassschedule",
  "POST /public/v6/class/addclienttoclass",
  "POST /public/v6/class/cancelsingleclass",
  "POST /public/v6/class/removeclientfromclass",
  "POST /public/v6/class/removeclientsfromclasses",
  "POST /public/v6/class/removefromwaitlist",
  "POST /public/v6/class/substituteclassteacher",
  "POST /public/v6/class/updateclassschedule",
  "POST /public/v6/client/addarrival",
  "POST /public/v6/client/addclient",
  "POST /public/v6/client/addclientdirectdebitinfo",
  "POST /public/v6/client/addclientformulanote",
  "POST /public/v6/client/addcontactlog",
  "POST /public/v6/client/clientrewards",
  "POST /public/v6/client/mergeclients",
  "POST /public/v6/client/sendautoemail",
  "POST /public/v6/client/sendpasswordresetemail",
  "POST /public/v6/client/suspendcontract",
  "POST /public/v6/client/terminatecontract",
  "POST /public/v6/client/updateclient",
  "POST /public/v6/client/updateclientcontractautopays",
  "POST /public/v6/client/updateclientservice",
  "POST /public/v6/client/updateclientvisit",
  "POST /public/v6/client/updatecontactlog",
  "POST /public/v6/client/uploadclientdocument",
  "POST /public/v6/client/uploadclientphoto",
  "POST /public/v6/crossSite/copycreditcard",
  "POST /public/v6/enrollment/addclienttoenrollment",
  "POST /public/v6/enrollment/addenrollmentschedule",
  "POST /public/v6/enrollment/updateenrollmentschedule",
  "POST /public/v6/sale/checkoutshoppingcart",
  "POST /public/v6/sale/completecheckoutshoppingcart",
  "POST /public/v6/sale/initiatecheckoutshoppingcart",
  "POST /public/v6/sale/initiatepurchasecontract",
  "POST /public/v6/sale/purchaseaccountcredit",
  "POST /public/v6/sale/purchasecontract",
  "POST /public/v6/sale/purchasegiftcard",
  "POST /public/v6/sale/returnsale",
  "POST /public/v6/sale/updateproductprice",
  "POST /public/v6/site/addclientindex",
  "POST /public/v6/site/addpromocode",
  "POST /public/v6/site/deactivatepromocode",
  "POST /public/v6/site/updateclientindex",
  "POST /public/v6/staff/addstaff",
  "POST /public/v6/staff/assignsessiontype",
  "POST /public/v6/staff/staffavailability",
  "POST /public/v6/staff/updatestaff",
  "POST /public/v6/staff/updatestaffpermissions",
  "PUT /public/v6/appointment/availabilities",
  "PUT /public/v6/sale/products",
  "PUT /public/v6/sale/services",
  "PUT /public/v6/sale/updatesaledate",
]);
const READ_PATTERNS = [
  /^GET \/public\/v6\/pickaspot\/v1\/class\/[A-Za-z0-9_.:-]{1,200}$/,
  /^GET \/public\/v6\/pickaspot\/v1\/reservation\/[A-Za-z0-9_.:-]{1,200}$/,
];
const MANAGE_PATTERNS = [
  /^DELETE \/public\/v6\/pickaspot\/v1\/reservation\/[A-Za-z0-9_.:-]{1,200}$/,
  /^PATCH \/public\/v6\/class\/updateclassschedulenotes\/[A-Za-z0-9_.:-]{1,200}$/,
  /^POST \/public\/v6\/pickaspot\/v1\/reservation\/[A-Za-z0-9_.:-]{1,200}$/,
  /^PUT \/public\/v6\/pickaspot\/v1\/reservation\/[A-Za-z0-9_.:-]{1,200}$/,
];

export class MindbodyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MindbodyApiAdapter {
  async health(credentials: MindbodyCredentials) {
    const normalized = this.credentials(credentials);
    await this.request(normalized, {
      method: "GET",
      path: "/public/v6/site/sites",
    });
    return { credentialsVerified: true, siteId: normalized.siteId };
  }

  read(credentials: MindbodyCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 500);
    if (!this.allowed("GET", path, READ_ROUTES, READ_PATTERNS))
      throw this.validation("Mindbody read endpoint is not supported.");
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: MindbodyCredentials, input: JsonObject) {
    const method = this.required(
      input.method,
      "method",
      10,
    ).toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (!this.allowed(method, path, MANAGE_ROUTES, MANAGE_PATTERNS))
      throw this.validation("Mindbody mutation endpoint is not supported.");
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  private credentials(credentials: MindbodyCredentials) {
    const apiKey = credentials.apiKey?.trim();
    const staffToken = credentials.staffToken?.trim();
    const siteId = credentials.siteId?.trim();
    if (!apiKey || apiKey.length > 10_000)
      throw new MindbodyApiError(
        "credential_missing",
        "Mindbody API key is required.",
        401,
      );
    if (!staffToken || staffToken.length > 20_000)
      throw new MindbodyApiError(
        "credential_missing",
        "Mindbody staff token is required.",
        401,
      );
    if (!/^-?\d{1,12}$/.test(siteId ?? ""))
      throw new MindbodyApiError(
        "credential_missing",
        "Mindbody site ID must be numeric.",
        401,
      );
    return { apiKey, staffToken, siteId: siteId! };
  }

  private async request(
    rawCredentials: MindbodyCredentials,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const permitted =
      this.allowed(input.method, input.path, READ_ROUTES, READ_PATTERNS) ||
      this.allowed(input.method, input.path, MANAGE_ROUTES, MANAGE_PATTERNS);
    if (!permitted) throw this.validation("Mindbody endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const credentials = this.credentials(rawCredentials);
    const query = this.bindSiteQuery(credentials.siteId, input.query);
    const json =
      input.method === "GET"
        ? undefined
        : this.bindSiteBody(credentials.siteId, input.json);
    const url = new URL(`https://api.mindbodyonline.com${input.path}`);
    this.appendQuery(url.searchParams, query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "API-Key": credentials.apiKey,
      Authorization: credentials.staffToken,
      "User-Agent": "RelayConsole/1.0",
    };
    let body: string | undefined;
    if (json) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(json);
      if (Buffer.byteLength(body) > 2_000_000)
        throw this.validation("Mindbody request exceeds 2 MB.");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: input.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000)
        throw this.validation("Mindbody response exceeds 5 MB.");
      let data = this.parse(raw);
      data = this.redact(data);
      if (!response.ok)
        throw new MindbodyApiError(
          this.code(response.status),
          this.message(data) ?? `Mindbody returned HTTP ${response.status}.`,
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof MindbodyApiError) throw error;
      throw new MindbodyApiError(
        "provider_unavailable",
        "Mindbody could not be reached.",
        502,
      );
    }
  }

  private bindSiteQuery(siteId: string, value?: JsonObject) {
    const query = { ...(value ?? {}) };
    if (!Object.keys(query).some((key) => key.toLowerCase() === "siteid")) {
      query.SiteId = siteId;
    }
    return query;
  }

  private bindSiteBody(siteId: string, value?: JsonObject) {
    const json = { ...(value ?? {}) };
    if (!Object.keys(json).some((key) => key.toLowerCase() === "siteid")) {
      json.SiteId = Number(siteId);
    }
    return json;
  }

  private allowed(
    method: Method,
    path: string,
    fixed: Set<string>,
    patterns: RegExp[],
  ) {
    const key = `${method} ${path}`;
    return fixed.has(key) || patterns.some((candidate) => candidate.test(key));
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 40)
      throw this.validation("Mindbody query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(key))
        throw this.validation("Mindbody query field is invalid.");
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 50)
        throw this.validation("Mindbody query array is too large.");
      for (const child of values) {
        if (child == null || child === "") continue;
        if (!["string", "number", "boolean"].includes(typeof child))
          throw this.validation("Mindbody query value is invalid.");
        params.append(key, String(child).slice(0, 10_000));
      }
    }
  }

  private parse(raw: Buffer): unknown {
    const text = raw.toString("utf8");
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return text.slice(0, 1_000_000);
    }
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }

  private rejectSecrets(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new MindbodyApiError(
          "policy_blocked",
          "Mindbody request is too deeply nested.",
        );
      if (Array.isArray(item)) {
        if (item.length > 1000)
          throw new MindbodyApiError(
            "policy_blocked",
            "Mindbody request array is too large.",
          );
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000)
        throw new MindbodyApiError(
          "policy_blocked",
          "Mindbody request object is too large.",
        );
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new MindbodyApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
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
    const object = this.object(value);
    const error = this.object(object?.Error ?? object?.error);
    const candidate =
      object?.Message ?? object?.message ?? error?.Message ?? error?.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new MindbodyApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is required.`);
    return value.trim();
  }
}
