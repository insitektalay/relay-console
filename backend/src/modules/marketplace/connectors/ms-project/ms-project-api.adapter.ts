import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export const MS_PROJECT_ENTITY_SETS = {
  projects: "msdyn_projects",
  tasks: "msdyn_projecttasks",
  dependencies: "msdyn_projecttaskdependencies",
  assignments: "msdyn_resourceassignments",
  buckets: "msdyn_projectbuckets",
  teamMembers: "msdyn_projectteams",
  checklists: "msdyn_projectchecklists",
  labels: "msdyn_projectlabels",
  taskLabels: "msdyn_projecttasktolabels",
  sprints: "msdyn_projectsprints",
} as const;

export const MS_PROJECT_SCHEDULE_ACTIONS = [
  "msdyn_CreateProjectV1",
  "msdyn_CreateTeamMemberV1",
  "msdyn_CreateOperationSetV1",
  "msdyn_PssCreateV1",
  "msdyn_PssCreateV2",
  "msdyn_PssUpdateV1",
  "msdyn_PssUpdateV2",
  "msdyn_PssDeleteV1",
  "msdyn_PssDeleteV2",
  "msdyn_ExecuteOperationSetV1",
  "msdyn_PssUpdateResourceAssignmentContourV1",
  "msdyn_ExecuteOperationSetV3",
] as const;

export class MsProjectApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MsProjectApiAdapter {
  async health(accessToken: string, environmentOrigin: string) {
    return this.request(accessToken, environmentOrigin, {
      method: "GET",
      path: "/WhoAmI",
    });
  }

  async read(
    accessToken: string,
    environmentOrigin: string,
    input: JsonObject,
  ) {
    const entity = this.entitySet(input.entity);
    const id = this.optionalGuid(input.id, "id");
    const select = this.fieldList(input.select);
    const filter = this.odataExpression(input.filter, "filter", 2_000);
    const orderBy = this.odataExpression(input.orderBy, "orderBy", 500);
    const top = this.integer(input.top, 25, 1, 100);
    const query: Record<string, string> = {};
    if (select.length) query.$select = select.join(",");
    if (!id) {
      query.$top = String(top);
      if (filter) query.$filter = filter;
      if (orderBy) query.$orderby = orderBy;
    } else if (filter || orderBy) {
      throw new MsProjectApiError(
        "provider_validation_error",
        "filter and orderBy cannot be used when reading one row.",
      );
    }
    return this.request(accessToken, environmentOrigin, {
      method: "GET",
      path: `/${entity}${id ? `(${id})` : ""}`,
      query,
    });
  }

  async schedule(
    accessToken: string,
    environmentOrigin: string,
    input: JsonObject,
  ) {
    const action = this.requiredString(input.action, "action", 100);
    if (!(MS_PROJECT_SCHEDULE_ACTIONS as readonly string[]).includes(action)) {
      throw new MsProjectApiError(
        "policy_blocked",
        "That Microsoft Project schedule action is not in Relay's documented allowlist.",
      );
    }
    const parameters = this.object(input.parameters, "parameters");
    this.validatePayload(parameters);
    return this.request(accessToken, environmentOrigin, {
      method: "POST",
      path: `/${action}`,
      json: parameters,
    });
  }

  normalizeEnvironment(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new MsProjectApiError(
        "provider_validation_error",
        "Enter a valid Microsoft Dataverse environment URL.",
      );
    }
    const host = url.hostname.toLowerCase();
    const supported = [
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\d*\.dynamics\.com$/,
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\.dynamics\.cn$/,
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\.microsoftdynamics\.us$/,
      /^[a-z0-9][a-z0-9-]{0,62}\.crm\.appsplatform\.us$/,
    ].some((pattern) => pattern.test(host));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !supported
    ) {
      throw new MsProjectApiError(
        "provider_validation_error",
        "Microsoft Project requires a supported HTTPS Dataverse environment URL without a path.",
      );
    }
    return url.origin;
  }

  private async request(
    accessToken: string,
    environmentOrigin: string,
    input: {
      method: "GET" | "POST";
      path: string;
      query?: Record<string, string>;
      json?: JsonObject;
    },
  ) {
    if (!accessToken)
      throw new MsProjectApiError(
        "credential_missing",
        "Microsoft Project OAuth access is missing.",
        401,
      );
    const origin = this.normalizeEnvironment(environmentOrigin);
    const url = new URL(`${origin}/api/data/v9.2${input.path}`);
    for (const [key, value] of Object.entries(input.query ?? {}))
      url.searchParams.set(key, value);
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000)
      throw new MsProjectApiError(
        "provider_validation_error",
        "Microsoft Project schedule requests may not exceed 1 MB.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: input.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "OData-MaxVersion": "4.0",
          "OData-Version": "4.0",
          ...(body
            ? { "Content-Type": "application/json; charset=utf-8" }
            : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new MsProjectApiError(
        "provider_unavailable",
        "Microsoft Project's Dataverse environment could not be reached.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 10_000_000)
      throw new MsProjectApiError(
        "provider_validation_error",
        "Microsoft Project returned more than 10 MB.",
      );
    const payload = raw ? this.parseJson(raw, response.status) : null;
    const redacted = this.redact(payload);
    if (!response.ok)
      throw new MsProjectApiError(
        this.safeCode(response.status),
        this.safeMessage(redacted, response.status),
        response.status,
      );
    return redacted;
  }

  private entitySet(value: unknown) {
    const key = this.requiredString(value, "entity", 50);
    const entity =
      MS_PROJECT_ENTITY_SETS[key as keyof typeof MS_PROJECT_ENTITY_SETS];
    if (!entity)
      throw new MsProjectApiError(
        "policy_blocked",
        "That Dataverse entity is outside the Microsoft Project schedule boundary.",
      );
    return entity;
  }

  private fieldList(value: unknown) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > 50)
      throw new MsProjectApiError(
        "provider_validation_error",
        "select must contain at most 50 Microsoft Project fields.",
      );
    return [...new Set(value.map((field) => this.field(field)))];
  }

  private field(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(value)
    )
      throw new MsProjectApiError(
        "provider_validation_error",
        "Microsoft Project field names must be simple Dataverse logical names.",
      );
    return value;
  }

  private odataExpression(value: unknown, label: string, max: number) {
    if (value == null || value === "") return undefined;
    const text = this.requiredString(value, label, max);
    if (/[$@;{}\[\]\\]|https?:|\/api\//i.test(text))
      throw new MsProjectApiError(
        "policy_blocked",
        `${label} contains unsupported OData syntax.`,
      );
    return text;
  }

  private validatePayload(value: unknown, depth = 0, count = { value: 0 }) {
    if (depth > 12)
      throw new MsProjectApiError(
        "policy_blocked",
        "Schedule input is too deeply nested.",
      );
    if (Array.isArray(value)) {
      if (value.length > 100)
        throw new MsProjectApiError(
          "provider_validation_error",
          "A schedule action may include at most 100 records.",
        );
      value.forEach((item) => this.validatePayload(item, depth + 1, count));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      count.value += 1;
      if (count.value > 2_000)
        throw new MsProjectApiError(
          "provider_validation_error",
          "Schedule input contains too many fields.",
        );
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      )
        throw new MsProjectApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
        );
      const bind =
        key.endsWith("@odata.bind") && typeof item === "string" ? item : null;
      if (
        bind &&
        !Object.values(MS_PROJECT_ENTITY_SETS).some((set) =>
          new RegExp(`^/${set}\\([0-9a-f-]{36}\\)$`, "i").test(bind),
        )
      )
        throw new MsProjectApiError(
          "policy_blocked",
          "Schedule relationships may bind only to supported project entities.",
        );
      this.validatePayload(item, depth + 1, count);
    }
  }

  private parseJson(raw: string, status: number) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new MsProjectApiError(
        "provider_unavailable",
        "Microsoft Project returned an invalid response.",
        status,
      );
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|@odata\.nextLink)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private safeMessage(payload: unknown, status: number) {
    const root =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as JsonObject)
        : {};
    const error =
      root.error && typeof root.error === "object" && !Array.isArray(root.error)
        ? (root.error as JsonObject)
        : {};
    const message = typeof error.message === "string" ? error.message : "";
    return message
      ? message
          .replace(/https?:\/\/\S+|Bearer\s+\S+/gi, "[redacted]")
          .slice(0, 500)
      : `Microsoft Project returned HTTP ${status}.`;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 400 && status < 500) return "provider_validation_error";
    return "provider_unavailable";
  }

  private object(value: unknown, label: string) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new MsProjectApiError(
        "provider_validation_error",
        `${label} must be an object.`,
      );
    return value as JsonObject;
  }

  private requiredString(value: unknown, label: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new MsProjectApiError(
        "provider_validation_error",
        `${label} is required and must be at most ${max} characters.`,
      );
    return value.trim();
  }

  private optionalGuid(value: unknown, label: string) {
    if (value == null || value === "") return undefined;
    const text = this.requiredString(value, label, 36);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        text,
      )
    )
      throw new MsProjectApiError(
        "provider_validation_error",
        `${label} must be a GUID.`,
      );
    return text.toLowerCase();
  }

  private integer(value: unknown, fallback: number, min: number, max: number) {
    const number = value == null ? fallback : Number(value);
    if (!Number.isInteger(number) || number < min || number > max)
      throw new MsProjectApiError(
        "provider_validation_error",
        `top must be an integer from ${min} to ${max}.`,
      );
    return number;
  }
}
