import { Injectable } from "@nestjs/common";

export class MicrosoftListsApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export type MicrosoftListsBinding = {
  siteId: string;
  listId: string;
  allowedFieldNames: string[];
};

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const API_ORIGIN = "https://graph.microsoft.com";
const SAFE_SITE_ID = /^[A-Za-z0-9.,_-]{1,512}$/;
const SAFE_ID = /^[A-Za-z0-9._!~=-]{1,512}$/;
const SAFE_FIELD = /^[A-Za-z0-9_]{1,64}$/;

@Injectable()
export class MicrosoftListsApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(accessToken: string, binding: MicrosoftListsBinding) {
    await this.getList(accessToken, binding);
    return { reachable: true, selectedListVerified: true };
  }

  async getList(accessToken: string, binding: MicrosoftListsBinding) {
    const bound = this.binding(binding);
    return {
      list: this.list(
        this.object(
          await this.get(
            accessToken,
            `/v1.0/sites/${bound.siteId}/lists/${bound.listId}`,
          ),
        ),
      ),
    };
  }

  async listColumns(accessToken: string, binding: MicrosoftListsBinding) {
    const bound = this.binding(binding);
    const root = this.object(
      await this.get(
        accessToken,
        `/v1.0/sites/${bound.siteId}/lists/${bound.listId}/columns`,
      ),
    );
    const approved = new Set(bound.allowedFieldNames);
    const rows = Array.isArray(root.value)
      ? root.value
          .slice(0, 100)
          .map((row) => this.object(row))
          .filter((row) =>
            typeof row.name === "string" ? approved.has(row.name) : false,
          )
          .slice(0, 20)
          .map((row) => this.column(row))
      : [];
    return { columns: rows, resultCount: rows.length, nextPageFollowed: false };
  }

  async listItems(accessToken: string, binding: MicrosoftListsBinding) {
    const bound = this.binding(binding);
    return this.items(
      await this.get(
        accessToken,
        `/v1.0/sites/${bound.siteId}/lists/${bound.listId}/items`,
        bound.allowedFieldNames,
      ),
      bound.allowedFieldNames,
    );
  }

  async getItem(
    accessToken: string,
    binding: MicrosoftListsBinding,
    input: Record<string, unknown>,
  ) {
    const bound = this.binding(binding);
    const itemId = this.id(input.itemId, "itemId");
    return {
      item: this.item(
        this.object(
          await this.get(
            accessToken,
            `/v1.0/sites/${bound.siteId}/lists/${bound.listId}/items/${itemId}`,
            bound.allowedFieldNames,
          ),
        ),
        bound.allowedFieldNames,
      ),
    };
  }

  private async get(
    accessToken: string,
    path: string,
    allowedFieldNames?: string[],
  ) {
    if (!accessToken.trim())
      throw new MicrosoftListsApiError(
        "microsoft_lists_token_invalid",
        "Microsoft Lists connection token is missing.",
      );
    const url = new URL(path, API_ORIGIN);
    if (allowedFieldNames?.length)
      url.searchParams.set(
        "$expand",
        `fields($select=${allowedFieldNames.join(",")})`,
      );
    const pathAllowed =
      /^\/v1\.0\/sites\/[A-Za-z0-9.,_-]{1,512}\/lists\/[A-Za-z0-9._!~=-]{1,512}(?:\/columns|\/items(?:\/[A-Za-z0-9._!~=-]{1,512})?)?$/.test(
        url.pathname,
      );
    const queryAllowed =
      !url.search ||
      (url.searchParams.size === 1 &&
        url.searchParams.get("$expand") ===
          `fields($select=${allowedFieldNames?.join(",")})`);
    if (
      url.origin !== API_ORIGIN ||
      !pathAllowed ||
      !queryAllowed ||
      /\/(permissions|operations|drive|delta|subscriptions)(\/|$)/i.test(
        url.pathname,
      )
    )
      throw new MicrosoftListsApiError(
        "microsoft_lists_path_blocked",
        "Microsoft Lists request is outside the selected-list approved-field V1 allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new MicrosoftListsApiError(
        "microsoft_lists_unavailable",
        "Microsoft Graph Lists is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new MicrosoftListsApiError(
        "microsoft_lists_response_too_large",
        "Microsoft Graph Lists response exceeded 1 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new MicrosoftListsApiError(
        "microsoft_lists_response_invalid",
        "Microsoft Graph returned an invalid Lists response.",
      );
    }
    if (!response.ok)
      throw new MicrosoftListsApiError(
        response.status === 401
          ? "microsoft_lists_token_invalid"
          : response.status === 403
            ? "microsoft_lists_permission_denied"
            : response.status === 404
              ? "microsoft_lists_not_found"
              : response.status === 429
                ? "microsoft_lists_rate_limited"
                : "microsoft_lists_graph_error",
        "Microsoft Graph Lists request failed.",
        response.status,
      );
    return body;
  }

  private binding(value: MicrosoftListsBinding) {
    if (
      !SAFE_SITE_ID.test(value.siteId) ||
      !SAFE_ID.test(value.listId) ||
      !Array.isArray(value.allowedFieldNames) ||
      value.allowedFieldNames.length < 1 ||
      value.allowedFieldNames.length > 20 ||
      new Set(value.allowedFieldNames).size !==
        value.allowedFieldNames.length ||
      !value.allowedFieldNames.every((field) => SAFE_FIELD.test(field))
    )
      throw new MicrosoftListsApiError(
        "microsoft_lists_binding_invalid",
        "A safe selected-list binding and approved field policy are required.",
      );
    return value;
  }

  private items(value: unknown, allowedFieldNames: string[]) {
    const root = this.object(value);
    const rows = Array.isArray(root.value)
      ? root.value
          .slice(0, 25)
          .map((row) => this.item(this.object(row), allowedFieldNames))
      : [];
    return { items: rows, resultCount: rows.length, nextPageFollowed: false };
  }

  private list(row: Record<string, unknown>) {
    const info = this.object(row.list);
    return {
      id: this.scalar(row.id),
      displayName: this.scalar(row.displayName),
      description: this.scalar(row.description, 1_000),
      webUrl: this.safeWebUrl(row.webUrl),
      createdDateTime: this.scalar(row.createdDateTime),
      lastModifiedDateTime: this.scalar(row.lastModifiedDateTime),
      template: this.scalar(info.template),
      identitiesPermissionsExcluded: true,
    };
  }

  private column(row: Record<string, unknown>) {
    return {
      id: this.scalar(row.id),
      name: this.scalar(row.name, 64),
      displayName: this.scalar(row.displayName, 256),
      description: this.scalar(row.description, 512),
      required: this.scalar(row.required),
      readOnly: this.scalar(row.readOnly),
      hidden: this.scalar(row.hidden),
      approvedField: true,
    };
  }

  private item(row: Record<string, unknown>, allowedFieldNames: string[]) {
    const source = this.object(row.fields);
    const approved = new Set(allowedFieldNames);
    const fields = Object.fromEntries(
      Object.entries(source)
        .filter(([name]) => approved.has(name))
        .map(([name, value]) => [name, this.scalar(value, 1_000)]),
    );
    return {
      id: this.scalar(row.id),
      webUrl: this.safeWebUrl(row.webUrl),
      createdDateTime: this.scalar(row.createdDateTime),
      lastModifiedDateTime: this.scalar(row.lastModifiedDateTime),
      fields,
      fieldPolicyApplied: true,
      identitiesAttachmentsExcluded: true,
    };
  }

  private id(value: unknown, field: string) {
    if (typeof value !== "string" || !SAFE_ID.test(value))
      throw new MicrosoftListsApiError(
        "microsoft_lists_input_invalid",
        `A safe explicit ${field} is required.`,
      );
    return value;
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private scalar(value: unknown, max = 512): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, max);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }

  private safeWebUrl(value: unknown) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.toString().slice(0, 2048) : null;
    } catch {
      return null;
    }
  }
}
