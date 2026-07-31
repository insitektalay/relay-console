import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type StructureForJiraCredentials = {
  personalAccessToken: string;
  region: string;
};

export class StructureForJiraApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class StructureForJiraApiAdapter {
  async health(credentials: StructureForJiraCredentials) {
    await this.listStructures(credentials, { limit: 1 });
    return { region: this.region(credentials.region) };
  }

  async listStructures(
    credentials: StructureForJiraCredentials,
    input: JsonObject,
  ) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const parsed = await this.request(
      credentials,
      `/structures?offset=0&limit=${limit}`,
      "GET",
    );
    const envelope = this.object(parsed);
    const source = Array.isArray(envelope?.structures)
      ? envelope.structures
      : null;
    if (!source)
      throw this.invalid(
        "Structure Cloud returned an invalid structures list.",
      );
    const rows = source.slice(0, limit).map((item) => this.structure(item));
    return {
      rows,
      count: rows.length,
      truncated: envelope?.hasMore === true || source.length > limit,
    };
  }

  async getStructure(
    credentials: StructureForJiraCredentials,
    input: JsonObject,
  ) {
    return this.structure(
      await this.request(
        credentials,
        `/structures/${this.structureId(input.structureId)}`,
        "GET",
      ),
    );
  }

  async createPrivateStructure(
    credentials: StructureForJiraCredentials,
    input: JsonObject,
  ) {
    const name = this.requiredText(input.name, "name", 1, 120);
    const description = this.optionalText(
      input.description,
      "description",
      1000,
    );
    const result = await this.request(credentials, "/structures", "POST", {
      name,
      description,
      permissions: [],
    });
    return this.structure(result);
  }

  async listViews(credentials: StructureForJiraCredentials, input: JsonObject) {
    const limit = this.integer(input.limit, 1, 20, 10);
    const parsed = await this.request(
      credentials,
      `/views?offset=0&limit=${limit}`,
      "GET",
    );
    const envelope = this.object(parsed);
    const source = Array.isArray(envelope?.views) ? envelope.views : null;
    if (!source)
      throw this.invalid("Structure Cloud returned an invalid views list.");
    const rows = source.slice(0, limit).map((item) => this.view(item, false));
    return {
      rows,
      count: rows.length,
      truncated: envelope?.hasMore === true || source.length > limit,
    };
  }

  async getView(credentials: StructureForJiraCredentials, input: JsonObject) {
    const id = String(input.viewId ?? "");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw this.invalid("Structure Cloud view ID must be one exact UUID.");
    return this.view(
      await this.request(credentials, `/views/${id}`, "GET"),
      true,
    );
  }

  private async request(
    credentials: StructureForJiraCredentials,
    path: string,
    method: "GET" | "POST",
    body?: JsonObject,
  ) {
    this.assertToken(credentials.personalAccessToken);
    const origin = this.origin(credentials.region);
    let response: Response;
    try {
      response = await safeConnectorFetch(`${origin}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.personalAccessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "RelayConsole/1.0",
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new StructureForJiraApiError(
        "provider_unavailable",
        "Structure Cloud could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 262_144)
      throw this.invalid(
        "Structure Cloud response exceeded the 256 KiB Relay limit.",
      );
    let parsed: unknown = null;
    try {
      parsed = raw.byteLength ? JSON.parse(raw.toString("utf8")) : null;
    } catch {
      throw new StructureForJiraApiError(
        response.ok ? "provider_unavailable" : this.safeCode(response.status),
        "Structure Cloud returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new StructureForJiraApiError(
        this.safeCode(response.status),
        "Structure Cloud rejected the fixed API request.",
        response.status,
      );
    return parsed;
  }

  private structure(value: unknown) {
    const item = this.object(value);
    const id = this.number(item?.id);
    const name = this.text(item?.name, 120);
    if (!item || id === null || id < 1 || !name)
      throw this.invalid("Structure Cloud returned an invalid structure.");
    return {
      id,
      name,
      description: this.text(item.description, 1000),
      accessLevel: this.text(item.accessLevel, 40),
      label: this.uuidOrNull(item.label),
    };
  }

  private view(value: unknown, detailed: boolean) {
    const item = this.object(value);
    const id = this.uuidOrNull(item?.id);
    const name = this.text(item?.name, 120);
    if (!item || !id || !name)
      throw this.invalid("Structure Cloud returned an invalid view.");
    const result: JsonObject = {
      id,
      name,
      description: this.text(item.description, 1000),
      accessLevel: this.text(item.accessLevel, 40),
    };
    if (detailed) {
      const specification = this.object(item.specification);
      const columns = Array.isArray(specification?.columns)
        ? specification.columns.slice(0, 20)
        : [];
      result.layout = {
        columnDisplayMode: this.text(specification?.columnDisplayMode, 40),
        rowDisplayMode: this.text(specification?.rowDisplayMode, 40),
        showBorders: specification?.showBorders === true,
        columnKeys: columns
          .map((column) => this.text(this.object(column)?.key, 80))
          .filter(Boolean),
      };
    }
    return result;
  }

  private origin(region: string) {
    return this.region(region) === "europe"
      ? "https://api.prod-eu-central-1.structure.app/api/v1"
      : "https://api.structure.app/api/v1";
  }
  private region(value: unknown) {
    const region = String(value ?? "").toLowerCase();
    if (region !== "americas" && region !== "europe")
      throw this.invalid("Structure Cloud region must be americas or europe.");
    return region;
  }
  private assertToken(token: string) {
    if (
      !token ||
      token.length < 20 ||
      token.length > 500 ||
      /[\s\u0000]/.test(token)
    )
      throw new StructureForJiraApiError(
        "credential_missing",
        "A valid Structure Cloud personal access token is required.",
        401,
      );
  }
  private structureId(value: unknown) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1)
      throw this.invalid(
        "Structure Cloud structure ID must be one exact positive integer.",
      );
    return id;
  }
  private integer(value: unknown, min: number, max: number, fallback: number) {
    const parsed = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max)
      throw this.invalid(
        `Structure Cloud integer must be between ${min} and ${max}.`,
      );
    return parsed;
  }
  private requiredText(
    value: unknown,
    label: string,
    min: number,
    max: number,
  ) {
    const text = String(value ?? "").trim();
    if (text.length < min || text.length > max || /\u0000/.test(text))
      throw this.invalid(`Structure Cloud ${label} is invalid.`);
    return text;
  }
  private optionalText(value: unknown, label: string, max: number) {
    if (value === undefined || value === null) return "";
    const text = String(value).trim();
    if (text.length > max || /\u0000/.test(text))
      throw this.invalid(`Structure Cloud ${label} is invalid.`);
    return text;
  }
  private uuidOrNull(value: unknown) {
    const id = typeof value === "string" ? value : "";
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
      ? id
      : null;
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
  private invalid(message: string) {
    return new StructureForJiraApiError(
      "provider_validation_error",
      message,
      400,
    );
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "policy_blocked";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
