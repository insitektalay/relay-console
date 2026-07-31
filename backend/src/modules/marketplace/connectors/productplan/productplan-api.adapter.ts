import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type ProductPlanCredentials = { apiToken: string };

export class ProductPlanApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class ProductPlanApiAdapter {
  private readonly origin = "https://app.productplan.com/api/v2";

  async health(credentials: ProductPlanCredentials) {
    const result = await this.listRoadmaps(credentials, { limit: 1 });
    return { accessibleRoadmaps: result.count };
  }

  async listRoadmaps(credentials: ProductPlanCredentials, input: JsonObject) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const suffix = this.query(input.nameContains);
    const parsed = await this.request(credentials, `/roadmaps${suffix}`, "GET");
    const source = this.collection(parsed, "roadmaps");
    const rows = source.slice(0, limit).map((item) => this.roadmap(item));
    return { rows, count: rows.length, truncated: source.length > limit };
  }

  async getRoadmap(credentials: ProductPlanCredentials, input: JsonObject) {
    return this.roadmap(
      await this.request(
        credentials,
        `/roadmaps/${this.id(input.roadmapId, "roadmap")}`,
        "GET",
      ),
    );
  }

  async listBars(credentials: ProductPlanCredentials, input: JsonObject) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const roadmapId = this.id(input.roadmapId, "roadmap");
    const suffix = this.query(input.nameContains);
    const parsed = await this.request(
      credentials,
      `/roadmaps/${roadmapId}/bars${suffix}`,
      "GET",
    );
    const source = this.collection(parsed, "bars");
    const rows = source.slice(0, limit).map((item) => this.bar(item));
    return { rows, count: rows.length, truncated: source.length > limit };
  }

  async getBar(credentials: ProductPlanCredentials, input: JsonObject) {
    return this.bar(
      await this.request(
        credentials,
        `/bars/${this.id(input.barId, "bar")}`,
        "GET",
      ),
    );
  }

  async createParkedBar(
    credentials: ProductPlanCredentials,
    input: JsonObject,
  ) {
    const body: JsonObject = {
      roadmap_id: this.id(input.roadmapId, "roadmap"),
      name: this.requiredText(input.name, "name", 160),
      parked: true,
      is_container: false,
    };
    if (input.description !== undefined)
      body.description = this.optionalText(
        input.description,
        "description",
        4000,
      );
    if (input.percentDone !== undefined)
      body.percent_done = this.percent(input.percentDone, false);
    return this.bar(await this.request(credentials, "/bars", "POST", body));
  }

  async updateBar(credentials: ProductPlanCredentials, input: JsonObject) {
    const body: JsonObject = {};
    if (input.name !== undefined)
      body.name = this.requiredText(input.name, "name", 160);
    if (input.description !== undefined)
      body.description = this.optionalText(
        input.description,
        "description",
        4000,
      );
    if (input.percentDone !== undefined)
      body.percent_done = this.percent(input.percentDone, true);
    if (!Object.keys(body).length)
      throw this.invalid(
        "ProductPlan update requires at least one supported field.",
      );
    return this.bar(
      await this.request(
        credentials,
        `/bars/${this.id(input.barId, "bar")}`,
        "PATCH",
        body,
      ),
    );
  }

  async deleteBar(credentials: ProductPlanCredentials, input: JsonObject) {
    const barId = this.id(input.barId, "bar");
    const expectedName = this.requiredText(
      input.expectedName,
      "expectedName",
      160,
    );
    const current = await this.getBar(credentials, { barId });
    if (current.name !== expectedName)
      throw this.invalid(
        "ProductPlan bar name changed or did not match deletion confirmation.",
      );
    await this.request(credentials, `/bars/${barId}`, "DELETE");
    return { deleted: true, barId };
  }

  private async request(
    credentials: ProductPlanCredentials,
    path: string,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body?: JsonObject,
  ) {
    this.assertToken(credentials.apiToken);
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.origin}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiToken}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0",
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new ProductPlanApiError(
        "provider_unavailable",
        "ProductPlan could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 262_144)
      throw this.invalid(
        "ProductPlan response exceeded the 256 KiB Relay limit.",
      );
    let parsed: unknown = null;
    if (raw.byteLength) {
      try {
        parsed = JSON.parse(raw.toString("utf8"));
      } catch {
        throw new ProductPlanApiError(
          response.ok ? "provider_unavailable" : this.safeCode(response.status),
          "ProductPlan returned invalid JSON.",
          response.status,
        );
      }
    }
    if (!response.ok)
      throw new ProductPlanApiError(
        this.safeCode(response.status),
        "ProductPlan rejected the fixed API request.",
        response.status,
      );
    return parsed;
  }

  private roadmap(value: unknown) {
    const item = this.unwrap(value, "roadmap");
    const id = this.number(item?.id);
    const name = this.text(item?.name, 160);
    if (!item || id === null || id < 1 || !name)
      throw this.invalid("ProductPlan returned an invalid roadmap.");
    return {
      id,
      name,
      description: this.text(item.description, 4000),
      createdAt: this.text(item.created_at, 40),
      updatedAt: this.text(item.updated_at, 40),
    };
  }

  private bar(value: unknown) {
    const item = this.unwrap(value, "bar");
    const id = this.number(item?.id);
    const name = this.text(item?.name, 160);
    if (!item || id === null || id < 1 || !name)
      throw this.invalid("ProductPlan returned an invalid bar.");
    return {
      id,
      name,
      description: this.text(item.description, 4000),
      startsOn: this.text(item.starts_on, 20),
      endsOn: this.text(item.ends_on, 20),
      percentDone: this.boundedNumber(item.percent_done, 0, 100),
      parked: item.parked === true,
      isContainer: item.is_container === true,
      roadmapId: this.number(item.roadmap_id),
      updatedAt: this.text(item.updated_at, 40),
    };
  }

  private query(value: unknown) {
    if (value === undefined || value === null) return "";
    const text = this.requiredText(value, "nameContains", 80);
    return `?q[name_cont]=${encodeURIComponent(text)}&q[s]=id+asc`;
  }
  private collection(value: unknown, key: string) {
    if (Array.isArray(value)) return value;
    const object = this.object(value);
    const named = object?.[key];
    if (Array.isArray(named)) return named;
    if (Array.isArray(object?.data)) return object.data;
    throw this.invalid(`ProductPlan returned an invalid ${key} list.`);
  }
  private unwrap(value: unknown, key: string) {
    const object = this.object(value);
    if (!object) return null;
    return this.object(object[key]) ?? this.object(object.data) ?? object;
  }
  private assertToken(token: string) {
    if (!token || token.length !== 64 || !/^[a-f0-9]{64}$/i.test(token))
      throw new ProductPlanApiError(
        "credential_missing",
        "A valid 64-character ProductPlan API token is required.",
        401,
      );
  }
  private id(value: unknown, label: string) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1)
      throw this.invalid(`ProductPlan ${label} ID must be a positive integer.`);
    return id;
  }
  private integer(value: unknown, min: number, max: number, fallback: number) {
    const parsed = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max)
      throw this.invalid(
        `ProductPlan integer must be between ${min} and ${max}.`,
      );
    return parsed;
  }
  private percent(value: unknown, nullable: boolean) {
    if (nullable && value === null) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100)
      throw this.invalid("ProductPlan percentDone must be between 0 and 100.");
    return parsed;
  }
  private requiredText(value: unknown, label: string, max: number): string;
  private requiredText(
    value: unknown,
    label: string,
    min: number,
    max: number,
  ): string;
  private requiredText(
    value: unknown,
    label: string,
    minOrMax: number,
    possibleMax?: number,
  ) {
    const min = possibleMax === undefined ? 1 : minOrMax;
    const max = possibleMax ?? minOrMax;
    const text = String(value ?? "").trim();
    if (text.length < min || text.length > max || /\u0000/.test(text))
      throw this.invalid(`ProductPlan ${label} is invalid.`);
    return text;
  }
  private optionalText(value: unknown, label: string, max: number) {
    if (value === null) return null;
    const text = String(value ?? "").trim();
    if (text.length > max || /\u0000/.test(text))
      throw this.invalid(`ProductPlan ${label} is invalid.`);
    return text;
  }
  private object(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }
  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }
  private number(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : null;
  }
  private boundedNumber(value: unknown, min: number, max: number) {
    if (value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max
      ? number
      : null;
  }
  private invalid(message: string) {
    return new ProductPlanApiError("provider_validation_error", message, 400);
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "policy_blocked";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
