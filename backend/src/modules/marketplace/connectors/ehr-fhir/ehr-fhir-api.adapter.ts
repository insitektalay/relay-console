import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type EhrFhirCredentials = {
  fhirBaseUrl: string;
  accessToken: string;
};

export type EhrFhirSearchInput = {
  resourceType: string;
  query?: JsonObject;
};

export type EhrFhirReadInput = {
  resourceType: string;
  id: string;
};

const ALLOWED_RESOURCE_TYPES = new Set([
  "AllergyIntolerance",
  "Appointment",
  "CarePlan",
  "Condition",
  "DiagnosticReport",
  "DocumentReference",
  "Encounter",
  "Immunization",
  "Location",
  "MedicationRequest",
  "Observation",
  "Organization",
  "Patient",
  "Practitioner",
  "Procedure",
]);

export class EhrFhirApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class EhrFhirApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async smartConfiguration(credentials: EhrFhirCredentials) {
    return await this.request(credentials, "/.well-known/smart-configuration", {
      omitAuthorization: true,
    });
  }

  async capabilityStatement(credentials: EhrFhirCredentials) {
    return this.minimizeCapability(
      await this.request(credentials, "/metadata", { omitAuthorization: true }),
    );
  }

  async search(credentials: EhrFhirCredentials, input: EhrFhirSearchInput) {
    const resourceType = this.resourceType(input.resourceType);
    const query = this.query(input.query);
    const result = await this.request(credentials, `/${resourceType}`, {
      query,
    });
    return this.minimizeBundle(result);
  }

  async read(credentials: EhrFhirCredentials, input: EhrFhirReadInput) {
    const resourceType = this.resourceType(input.resourceType);
    const id = this.id(input.id);
    const result = await this.request(credentials, `/${resourceType}/${id}`, {});
    return this.minimizeResource(result);
  }

  private async request(
    credentials: EhrFhirCredentials,
    path: string,
    options: { query?: JsonObject; omitAuthorization?: boolean },
  ) {
    const root = this.root(credentials.fhirBaseUrl);
    const url = new URL(path.replace(/^\/+/, ""), root);
    this.appendQuery(url.searchParams, options.query);
    if (
      url.protocol !== "https:" ||
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      throw new EhrFhirApiError(
        "policy_blocked",
        "FHIR request must stay on the connected HTTPS FHIR origin.",
        403,
      );
    }
    let response: Response;
    try {
      response = await this.requester(url, {
        method: "GET",
        headers: {
          Accept: "application/fhir+json, application/json",
          ...(options.omitAuthorization
            ? {}
            : { Authorization: `Bearer ${this.token(credentials.accessToken)}` }),
          "User-Agent": "RelayConsole-ehr-fhir/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof EhrFhirApiError) throw error;
      throw new EhrFhirApiError("provider_unavailable", "FHIR endpoint could not be reached.", 502);
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw new EhrFhirApiError(
        "provider_validation_error",
        "FHIR response exceeds Relay's 2.5 MB bridge limit.",
        400,
      );
    const data = this.parse(raw);
    if (!response.ok)
      throw new EhrFhirApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `FHIR endpoint returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }

  private root(value: string) {
    let root: URL;
    try {
      root = new URL(value.endsWith("/") ? value : `${value}/`);
    } catch {
      throw new EhrFhirApiError("provider_validation_error", "FHIR base URL is invalid.", 400);
    }
    if (
      root.protocol !== "https:" ||
      root.username ||
      root.password ||
      root.port ||
      root.search ||
      root.hash
    ) {
      throw new EhrFhirApiError(
        "provider_validation_error",
        "FHIR base URL must be a pinned HTTPS origin/path without credentials, port, query, or fragment.",
        400,
      );
    }
    return root;
  }

  private resourceType(value: string) {
    const text = String(value ?? "").trim();
    if (!ALLOWED_RESOURCE_TYPES.has(text))
      throw new EhrFhirApiError(
        "policy_blocked",
        "FHIR resource type is outside Relay's healthcare V1 allowlist.",
        403,
      );
    return text;
  }

  private id(value: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9.-]{0,127}$/.test(text))
      throw new EhrFhirApiError("provider_validation_error", "FHIR resource ID is invalid.", 400);
    return text;
  }

  private token(value: string) {
    const text = String(value ?? "").trim();
    if (!text || text.length > 16_000 || /[\r\n]/.test(text))
      throw new EhrFhirApiError("credential_missing", "A valid FHIR bearer token is required.", 401);
    return text;
  }

  private query(value: JsonObject | undefined) {
    const query: JsonObject = { ...(value ?? {}) };
    const count = Number(query._count ?? 25);
    query._count = Number.isFinite(count) && count > 0 ? Math.min(count, 25) : 25;
    return query;
  }

  private appendQuery(params: URLSearchParams, value: JsonObject | undefined) {
    if (!value) return;
    const entries = Object.entries(value);
    if (entries.length > 25)
      throw new EhrFhirApiError("provider_validation_error", "FHIR query has too many parameters.", 400);
    for (const [name, raw] of entries) {
      if (!/^-?[A-Za-z_][A-Za-z0-9_.:-]{0,79}$/.test(name))
        throw new EhrFhirApiError("provider_validation_error", "FHIR query parameter name is invalid.", 400);
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 25)
        throw new EhrFhirApiError("provider_validation_error", "FHIR query parameter has too many values.", 400);
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        if (typeof item === "object")
          throw new EhrFhirApiError("provider_validation_error", "FHIR query values must be scalar.", 400);
        const text = String(item);
        if (text.length > 500 || /[\r\n]/.test(text))
          throw new EhrFhirApiError("provider_validation_error", "FHIR query value is invalid.", 400);
        params.append(name, text);
      }
    }
  }

  private minimizeBundle(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { resourceType: "Bundle", entry: [] };
    const bundle = value as JsonObject;
    const entries = Array.isArray(bundle.entry) ? bundle.entry.slice(0, 25) : [];
    return {
      resourceType: bundle.resourceType,
      type: bundle.type,
      total: bundle.total,
      entry: entries.map((entry) =>
        this.minimizeResource(
          entry && typeof entry === "object" && !Array.isArray(entry)
            ? (entry as JsonObject).resource
            : entry,
        ),
      ),
    };
  }

  private minimizeCapability(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const statement = value as JsonObject;
    const rest = Array.isArray(statement.rest) ? statement.rest : [];
    const resources = rest.flatMap((item) =>
      item && typeof item === "object" && !Array.isArray(item) && Array.isArray((item as JsonObject).resource)
        ? ((item as JsonObject).resource as unknown[])
        : [],
    );
    return {
      resourceType: statement.resourceType,
      fhirVersion: statement.fhirVersion,
      status: statement.status,
      date: statement.date,
      software: this.compactObject(statement.software),
      implementation: this.compactObject(statement.implementation),
      resources: resources
        .map((item) => this.compactObject(item))
        .map((item) => ({
          type: item.type,
          profile: item.profile,
          interaction: Array.isArray(item.interaction)
            ? item.interaction.map((interaction) => this.compactObject(interaction))
            : [],
        }))
        .filter((item) => item.type),
    };
  }

  private minimizeResource(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const resource = value as JsonObject;
    const code = this.compactCode(resource.code);
    return {
      resourceType: resource.resourceType,
      id: resource.id,
      status: resource.status,
      intent: resource.intent,
      type: this.compactCode(resource.type),
      category: this.compactCode(resource.category),
      code,
      class: this.compactCode(resource.class),
      meta: this.compactObject(resource.meta),
      subject: this.referenceOnly(resource.subject),
      patient: this.referenceOnly(resource.patient),
      encounter: this.referenceOnly(resource.encounter),
      authoredOn: resource.authoredOn,
      effectiveDateTime: resource.effectiveDateTime,
      issued: resource.issued,
      date: resource.date,
    };
  }

  private compactCode(value: unknown): unknown {
    if (Array.isArray(value)) return value.slice(0, 5).map((item) => this.compactCode(item));
    if (!value || typeof value !== "object") return value;
    const record = value as JsonObject;
    return {
      coding: Array.isArray(record.coding)
        ? record.coding.slice(0, 5).map((item) => {
            const coding = this.compactObject(item);
            return { system: coding.system, code: coding.code };
          })
        : undefined,
    };
  }

  private referenceOnly(value: unknown) {
    const record = this.compactObject(value);
    return record.reference ? { reference: record.reference, type: record.type } : undefined;
  }

  private compactObject(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private parse(raw: Buffer) {
    if (raw.byteLength === 0) return null;
    const text = raw.toString("utf8");
    try {
      return JSON.parse(text);
    } catch {
      return { text: text.slice(0, 500) };
    }
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown): string | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const issue = (value as JsonObject).issue;
    if (Array.isArray(issue)) {
      const first = issue.find((item) => item && typeof item === "object") as JsonObject | undefined;
      if (typeof first?.diagnostics === "string") return first.diagnostics.slice(0, 500);
    }
    return null;
  }
}
